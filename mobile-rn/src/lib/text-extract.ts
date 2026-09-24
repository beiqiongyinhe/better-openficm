import { Buffer } from "buffer";
import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import iconv from "iconv-lite";

/** 可抽取纯文本的文档格式，参考书导入与助手附件共用同一套解析实现。 */
export type DocumentFormat = "txt" | "markdown" | "epub";

/** EPUB 书脊中的单个内容段：标题取 <hN> 或 <title>，正文为整段纯文本。 */
export interface DocumentSection {
  title: string | null;
  body: string;
  /**
   * 该段 <title> 声明的页面类型（如 bookcover、封面）。
   * 章节标题优先取 <hN>，但“这是不是封面页”必须看 <title>：
   * 封面/简介页正文里也常有 <h1>书名</h1>，靠标题文本无法与正文页区分。
   */
  titleTag: string | null;
}

/** 结构化抽取结果：保留逐段边界，供小说导入按书脊顺序切分章节。 */
export interface ExtractedDocument {
  title: string | null;
  text: string;
  sections: DocumentSection[];
}

export const MAX_DOCUMENT_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_EXTRACTED_CHARACTERS = 8_000_000;
const MAX_EPUB_TEXT_ENTRY_BYTES = 4 * 1024 * 1024;
const MAX_EPUB_TOTAL_TEXT_BYTES = 20 * 1024 * 1024;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: false,
});

const xhtmlParser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  preserveOrder: true,
  parseTagValue: false,
  trimValues: false,
});

export function extensionOf(fileName: string): string {
  const match = /\.([^.]+)$/.exec(fileName.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

export function decodeText(bytes: Uint8Array): string {
  const buffer = Buffer.from(bytes);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return iconv.decode(buffer.subarray(3), "utf8");
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return iconv.decode(buffer.subarray(2), "utf16-le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return iconv.decode(buffer.subarray(2), "utf16-be");
  const utf8 = iconv.decode(buffer, "utf8");
  const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
  if (utf8ReplacementCount === 0) return utf8;
  const gb18030 = iconv.decode(buffer, "gb18030");
  const gbReplacementCount = (gb18030.match(/\uFFFD/g) ?? []).length;
  return gbReplacementCount < utf8ReplacementCount ? gb18030 : utf8;
}

export function normalizeText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00A0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function archivePath(basePath: string, relativePath: string): string {
  const decoded = decodeURIComponent(relativePath.split("#")[0]);
  const parts = `${basePath}/${decoded}`.split("/");
  const normalized: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") normalized.pop();
    else normalized.push(part);
  }
  return normalized.join("/");
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function findArchiveEntry(entries: Record<string, Uint8Array>, path: string): Uint8Array | null {
  if (entries[path]) return entries[path];
  const lowerPath = path.toLowerCase();
  const key = Object.keys(entries).find((candidate) => candidate.toLowerCase() === lowerPath);
  return key ? entries[key] : null;
}

function collectMarkupText(value: unknown, output: string[], parentKey = ""): void {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    if (text) output.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectMarkupText(item, output, parentKey);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (["script", "style", "head", "svg", "nav"].includes(key.toLowerCase())) continue;
    collectMarkupText(item, output, key);
    if (/^(p|div|section|article|h[1-6]|li|blockquote|br)$/i.test(key) && parentKey !== key) output.push("\n");
  }
}

function fallbackMarkupText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&(nbsp|amp|lt|gt|quot|apos);/gi, (_match, entity: string) => ({
      nbsp: " ",
      amp: "&",
      lt: "<",
      gt: ">",
      quot: '"',
      apos: "'",
    })[entity.toLowerCase()] ?? " ");
}

function extractMarkupText(value: string): string {
  try {
    const output: string[] = [];
    collectMarkupText(xhtmlParser.parse(value), output);
    const parsed = normalizeText(output.join(" "));
    if (parsed) return parsed;
  } catch {
    // Some EPUBs contain non-XML HTML; the bounded fallback still strips executable markup.
  }
  return normalizeText(fallbackMarkupText(value));
}

/** 取一段 xhtml 的 <title> 元数据（页面类型），例如 bookcover、封面。 */
function markupTitleTag(value: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(value);
  if (!match) return null;
  const text = normalizeText(fallbackMarkupText(match[1]));
  return text || null;
}

/** 取一段 xhtml 的标题：优先 <h1..h6>，其次 <title>，用于还原书脊中的章节标题。 */
function markupHeading(value: string): string | null {
  const heading = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i.exec(value);
  if (heading) {
    const text = normalizeText(fallbackMarkupText(heading[2]));
    if (text) return text;
  }
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(value);
  if (title) {
    const text = normalizeText(fallbackMarkupText(title[1]));
    if (text) return text;
  }
  return null;
}

function extractEpub(bytes: Uint8Array): ExtractedDocument {
  let totalTextBytes = 0;
  const entries = unzipSync(bytes, {
    filter: (entry) => {
      const normalizedName = entry.name.toLowerCase();
      const textEntry = normalizedName === "meta-inf/container.xml"
        || /\.(opf|xhtml|html|htm|xml|ncx)$/.test(normalizedName);
      if (!textEntry) return false;
      if (entry.originalSize > MAX_EPUB_TEXT_ENTRY_BYTES) throw new Error("EPUB 单个文本条目超过 4 MB 限制");
      totalTextBytes += entry.originalSize;
      if (totalTextBytes > MAX_EPUB_TOTAL_TEXT_BYTES) throw new Error("EPUB 解压后的文本超过 20 MB 限制");
      return true;
    },
  });
  const containerBytes = findArchiveEntry(entries, "META-INF/container.xml");
  if (!containerBytes) throw new Error("EPUB 缺少 META-INF/container.xml");
  const container = xmlParser.parse(decodeText(containerBytes)) as {
    container?: { rootfiles?: { rootfile?: { "full-path"?: string } | Array<{ "full-path"?: string }> } };
  };
  const rootfile = asArray(container.container?.rootfiles?.rootfile)[0];
  const packagePath = rootfile?.["full-path"];
  if (!packagePath) throw new Error("EPUB 没有声明内容包");
  const packageBytes = findArchiveEntry(entries, packagePath);
  if (!packageBytes) throw new Error("EPUB 内容包不存在");
  const packageDocument = xmlParser.parse(decodeText(packageBytes)) as {
    package?: {
      metadata?: { title?: string | string[] };
      manifest?: { item?: Array<{ id?: string; href?: string; "media-type"?: string }> | { id?: string; href?: string; "media-type"?: string } };
      spine?: { itemref?: Array<{ idref?: string }> | { idref?: string } };
    };
  };
  const packageRoot = packageDocument.package;
  if (!packageRoot) throw new Error("EPUB 内容包格式无效");
  const basePath = packagePath.includes("/") ? packagePath.slice(0, packagePath.lastIndexOf("/")) : "";
  const manifest = new Map(
    asArray(packageRoot.manifest?.item)
      .filter((item) => item.id && item.href)
      .map((item) => [item.id as string, item]),
  );
  const spineItems = asArray(packageRoot.spine?.itemref);
  const sections: DocumentSection[] = [];
  let extractedCharacters = 0;
  for (const itemref of spineItems) {
    const item = itemref.idref ? manifest.get(itemref.idref) : null;
    if (!item?.href) continue;
    const entry = findArchiveEntry(entries, archivePath(basePath, item.href));
    if (!entry) continue;
    const markup = decodeText(entry);
    const body = extractMarkupText(markup);
    const sectionTitle = markupHeading(markup);
    if (!body && !sectionTitle) continue;
    sections.push({ title: sectionTitle, body, titleTag: markupTitleTag(markup) });
    extractedCharacters += body.length;
    if (extractedCharacters > MAX_EXTRACTED_CHARACTERS) {
      throw new Error("EPUB 提取后的正文超过 800 万字符限制");
    }
  }
  const text = normalizeText(sections.map((section) => section.body).filter(Boolean).join("\n\n"));
  if (!text) throw new Error("EPUB 书脊中没有可读取的正文");
  const titleValue = asArray(packageRoot.metadata?.title)[0];
  return { title: typeof titleValue === "string" ? normalizeText(titleValue) : null, text, sections };
}

/** 按扩展名判定可抽取的文档格式；TXT、Markdown 与 EPUB 之外一律拒绝。 */
export function formatForExtension(extension: string): DocumentFormat {
  if (extension === "txt") return "txt";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "epub") return "epub";
  throw new Error("仅支持 TXT、Markdown 和 EPUB 文件");
}

/** 按格式把文件字节解析为纯文本；txt/markdown 走编码嗅探，epub 走书脊顺序抽取。 */
export function extractDocumentText(bytes: Uint8Array, format: DocumentFormat): { title: string | null; text: string } {
  if (format === "epub") return extractEpub(bytes);
  return { title: null, text: normalizeText(decodeText(bytes)) };
}

/**
 * 结构化抽取：在 `extractDocumentText` 之上额外返回逐段边界。
 * EPUB 会保留每个书脊项的标题与正文，供小说导入按章节边界切分；
 * txt/markdown 没有天然分段，sections 为空数组，由调用方按行切分。
 */
export function extractDocumentSections(bytes: Uint8Array, format: DocumentFormat): ExtractedDocument {
  if (format === "epub") return extractEpub(bytes);
  return { title: null, text: normalizeText(decodeText(bytes)), sections: [] };
}
