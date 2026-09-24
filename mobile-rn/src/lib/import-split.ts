import { normalizeText, type DocumentFormat, type DocumentSection } from "./text-extract";

/**
 * 小说导入的章节切分算法（TXT / Markdown / EPUB 共用）。
 *
 * 算法要点来自真实网文的实测结论：
 * 1. 逐行扫描而不是全文正则 exec 循环：章节标题行极少带句读，逐行判定误报低、边界可控；
 * 2. 标题分四族：第X卷、第X章/节/回、序章/番外等裸标题、英文 chapter N；
 * 3. 站点常把“裸标题行 + 空行 + 缩进短标题”拆成两行，需要按间距合并成一条；
 * 4. 卷名常缺失，用“第X卷 后面的 token”投票补齐（只出现一次的 token 视为噪声）；
 * 5. 任何识别失败都回落到“整本一章”，保证导入不丢字。
 */

/** 中文数字字符集，覆盖“第一百二十三章”这类写法。 */
const NUMERALS = "0-9零〇一二两三四五六七八九十百千万";
/** 无“第X章”前缀的独立标题（序章、番外……）。 */
const SPECIAL_HEADINGS =
  "序章|序言|楔子|引子|前言|后记|尾声|终章|终局|番外|外传|正文|终幕|后传|附记|说明|上架感言";

/** “第X卷”。 */
const VOLUME_PREFIX_PATTERN = new RegExp(`^第([${NUMERALS}]+)卷`);
/** 标题里重复出现的“第X卷 ”前缀。 */
const VOLUME_PREFIX_STRIP_PATTERN = new RegExp(`^第[${NUMERALS}]+卷\s+`);
/** “第X章 / 第X节 / 第X回”，标题后不能再跟数字（“第1章1”这类是页码）。 */
const CHAPTER_HEADING_PATTERN = new RegExp(`^第[${NUMERALS}]+[章节回](?:[^\d]|$)`);
/** 独立的特殊章节名，例如“序章”“番外 3”。 */
const SPECIAL_HEADING_PATTERN = new RegExp(`^(?:${SPECIAL_HEADINGS})(?:\s|$|[~～])`);
/** 西文章节标题。 */
const ENGLISH_HEADING_PATTERN = /^(?:chapter|chap\.?)\s*\d+/i;
/** 含句读或引号的整行是正文句子，即使以“第X章”开头也不能当标题。 */
const REJECT_HEADING_PATTERN = /[。\u201c\u201d\u300c\u300d]/;
/** 站点生成的“作者：xx 字数：NNNN”元数据行。 */
const METADATA_LINE_PATTERN = /^作者[:：].*字数[:：]\s*\d+\s*$/;
/** 封面页标题，只用于跳过，不作为章节名。 */
const COVER_TITLES = new Set(["bookcover", "cover", "封面", "书名页", "titlepage"]);

/** 标题行长度上限：超过这个长度的行按正文处理。 */
const MAX_HEADING_LINE_LENGTH = 60;
/** 单本最多识别的标题数量，防止异常文件拖垮导入。 */
const MAX_MARKER_COUNT = 20_000;
/** “裸标题行 + 缩进短标题”两行格式的合并间距上限。 */
const MERGE_GAP = 200;
/** 卷名投票的最小票数：单票 token 视为噪声。 */
const MIN_VOLUME_VOTES = 2;
/** 与仓储层校验保持一致：单章最多 2000 行或 100000 字符。 */
const MAX_CHAPTER_CHARACTERS = 100_000;
const MAX_CHAPTER_LINES = 2_000;
/** 识别 Markdown 的 1~3 级标题。 */
const MARKDOWN_HEADING_PATTERN = /^[ \t]{0,3}(#{1,3})[ \t]+([^\n]{1,120})[ \t]*$/gm;

/** 切分结果里的一章；volume 为 null 表示原文没有卷信息，导入时并入默认卷。 */
export interface SplitChapter {
  title: string;
  content: string;
  volume: string | null;
}

/** 已合并过的标题位置。 */
interface HeadingMarker {
  /** 标题行在原文中的起始下标。 */
  start: number;
  /** 标题行结束（不含换行符）的下标。 */
  end: number;
  title: string;
  volume: string | null;
}

/** 是否为标题行：四族任一命中，且不含句读、长度受限。 */
function isHeadingLine(value: string): boolean {
  if (!value || value.length > MAX_HEADING_LINE_LENGTH) return false;
  if (REJECT_HEADING_PATTERN.test(value)) return false;
  return VOLUME_PREFIX_PATTERN.test(value)
    || CHAPTER_HEADING_PATTERN.test(value)
    || SPECIAL_HEADING_PATTERN.test(value)
    || ENGLISH_HEADING_PATTERN.test(value);
}

/** 前言只有一行且很短时视为扉页／书名行噪声。 */
function isNoisePreface(content: string): boolean {
  const value = content.trim();
  return value.length > 0 && !value.includes("\n") && value.length <= MAX_HEADING_LINE_LENGTH;
}

/**
 * 统计“第X卷”后面最常见的 token 作为该卷的规范卷名。
 * 过滤形如“83~”“1 标题”的章节号 token，只保留票数达标的卷名。
 */
function canonicalVolumeNames(lines: readonly string[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>();
  for (const line of lines) {
    const value = line.trim();
    const match = VOLUME_PREFIX_PATTERN.exec(value);
    if (!match) continue;
    const rest = value.slice(match[0].length).trim();
    if (!rest) continue;
    const token = rest.split(" ")[0].split("~")[0].split("～")[0];
    if (!token || /^\d/.test(token)) continue;
    const numeral = match[1] ?? "";
    const byToken = votes.get(numeral) ?? new Map<string, number>();
    byToken.set(token, (byToken.get(token) ?? 0) + 1);
    votes.set(numeral, byToken);
  }
  const canonical = new Map<string, string>();
  for (const [numeral, byToken] of votes) {
    let bestToken = "";
    let bestCount = 0;
    for (const [token, count] of byToken) {
      // 平票时保留先出现的 token，与实书扫描顺序一致。
      if (count > bestCount) {
        bestToken = token;
        bestCount = count;
      }
    }
    if (bestCount >= MIN_VOLUME_VOTES) canonical.set(numeral, bestToken);
  }
  return canonical;
}

/** 拆出“第X卷 卷名”与后续的章节标题。 */
function parseHeading(line: string, canonical: Map<string, string>): { volume: string | null; title: string | null } {
  const match = VOLUME_PREFIX_PATTERN.exec(line);
  if (!match) return { volume: null, title: line };
  const numeral = match[1] ?? "";
  const canonicalName = canonical.get(numeral);
  const volume = canonicalName ? `第${numeral}卷 ${canonicalName}` : `第${numeral}卷`;
  let rest = line.slice(match[0].length).trim();
  if (!rest) return { volume, title: null };
  if (canonicalName && rest.startsWith(canonicalName)) rest = rest.slice(canonicalName.length).trim();
  rest = rest.replace(VOLUME_PREFIX_STRIP_PATTERN, "").trim();
  if (!rest) return { volume, title: null };
  return { volume, title: rest };
}

/** 合并“裸标题行 + 缩进短标题”这类被拆成两行的同一标题。 */
function mergeMarkers(markers: readonly HeadingMarker[]): HeadingMarker[] {
  const merged: HeadingMarker[] = [];
  for (const marker of markers) {
    const previous = merged[merged.length - 1];
    if (previous) {
      const title = marker.title;
      const previousTitle = previous.title;
      const gap = marker.start - previous.end;
      const forward = Boolean(title) && (title === previousTitle || previousTitle.endsWith(title));
      const backward = Boolean(previousTitle) && title.endsWith(previousTitle) && gap <= MERGE_GAP;
      if (forward || backward) {
        if (title) previous.title = title;
        previous.end = marker.end;
        if (marker.volume && !previous.volume) previous.volume = marker.volume;
        continue;
      }
    }
    merged.push({ ...marker });
  }
  return merged;
}

/** 逐行扫描标题，并按原文顺序合并双行标题。 */
function collectMarkers(text: string): HeadingMarker[] {
  const lines = text.split("\n");
  const canonical = canonicalVolumeNames(lines);
  const markers: HeadingMarker[] = [];
  let offset = 0;
  for (const line of lines) {
    const value = line.trim();
    if (value && isHeadingLine(value)) {
      if (markers.length >= MAX_MARKER_COUNT) break;
      const parsed = parseHeading(value, canonical);
      markers.push({
        start: offset,
        end: offset + line.length,
        title: parsed.title ?? value,
        volume: parsed.volume,
      });
    }
    offset += line.length + 1;
  }
  return mergeMarkers(markers);
}

/** 相邻重复章节去重，并剔除空壳；全部为空时保留原样以免导入丢字。 */
function dedupeChapters(chapters: readonly SplitChapter[]): SplitChapter[] {
  const unique: SplitChapter[] = [];
  for (const chapter of chapters) {
    const previous = unique[unique.length - 1];
    if (previous && chapter.content && chapter.content === previous.content) continue;
    unique.push(chapter);
  }
  const filtered = unique.filter((chapter) => chapter.content.length > 0);
  return filtered.length > 0 ? filtered : unique;
}

/** 按标题位置切出章节；空白正文的空壳章会在去重时被剔除。 */
function buildChapters(text: string, markers: readonly HeadingMarker[]): SplitChapter[] {
  const chapters: SplitChapter[] = [];
  const preface = markers.length > 0 ? text.slice(0, markers[0].start).trim() : "";
  if (preface && !isNoisePreface(preface)) {
    chapters.push({ title: "前言", content: preface, volume: null });
  }
  let currentVolume: string | null = null;
  for (let index = 0; index < markers.length; index += 1) {
    const marker = markers[index];
    if (marker.volume) currentVolume = marker.volume;
    const start = marker.end;
    const end = index + 1 < markers.length ? markers[index + 1].start : text.length;
    chapters.push({
      title: marker.title,
      content: text.slice(start, end).trim(),
      volume: currentVolume,
    });
  }
  return dedupeChapters(chapters);
}

/** Markdown：按出现最多的标题级别切章，书名行不算章节。 */
function splitMarkdownHeadings(text: string, bookTitle: string): SplitChapter[] | null {
  const pattern = new RegExp(MARKDOWN_HEADING_PATTERN.source, "gm");
  const found: { start: number; end: number; level: number; title: string }[] = [];
  let match = pattern.exec(text);
  while (match !== null && found.length < MAX_MARKER_COUNT) {
    const title = (match[2] ?? "").trim();
    if (title) {
      found.push({ start: match.index, end: match.index + match[0].length, level: match[1]?.length ?? 0, title });
    }
    match = pattern.exec(text);
  }
  if (found.length === 0) return null;
  const levelCounts = new Map<number, number>();
  for (const heading of found) {
    levelCounts.set(heading.level, (levelCounts.get(heading.level) ?? 0) + 1);
  }
  let chapterLevel = found[0].level;
  let bestCount = 0;
  for (const [level, count] of levelCounts) {
    // 取出现次数最多的级别；平票时取更深的级别（更接近正文章节）。
    if (count > bestCount || (count === bestCount && level > chapterLevel)) {
      chapterLevel = level;
      bestCount = count;
    }
  }
  let selected = found.filter((heading) => heading.level === chapterLevel);
  if (selected.length < 2) {
    const deeper = found.filter((heading) => heading.level > chapterLevel);
    if (deeper.length >= 2) {
      chapterLevel = deeper[0].level;
      selected = deeper.filter((heading) => heading.level === chapterLevel);
    }
  }
  if (selected.length === 0) return null;
  if (selected.length === 1 && selected[0].title === bookTitle.trim()) return null;
  return buildChapters(text, selected.map((heading) => ({ ...heading, volume: null })));
}

function chunkLongLine(line: string): string[] {
  if (line.length <= MAX_CHAPTER_CHARACTERS) return [line];
  const chunks: string[] = [];
  for (let offset = 0; offset < line.length; offset += MAX_CHAPTER_CHARACTERS) {
    chunks.push(line.slice(offset, offset + MAX_CHAPTER_CHARACTERS));
  }
  return chunks;
}

/** 把超出“单章 2000 行 / 100000 字符”上限的章节按行二次切开。 */
function splitOversizedChapter(chapter: SplitChapter): SplitChapter[] {
  const lines = chapter.content.split("\n");
  if (lines.length <= MAX_CHAPTER_LINES && chapter.content.length <= MAX_CHAPTER_CHARACTERS) {
    return [chapter];
  }
  const pending: string[] = [];
  for (const line of lines) pending.push(...chunkLongLine(line));
  const parts: SplitChapter[] = [];
  let buffer: string[] = [];
  let bufferCharacters = 0;
  const flush = () => {
    if (buffer.length === 0) return;
    parts.push({ title: chapter.title, content: buffer.join("\n").trim(), volume: chapter.volume });
    buffer = [];
    bufferCharacters = 0;
  };
  for (const line of pending) {
    const wouldExceedLines = buffer.length + 1 > MAX_CHAPTER_LINES;
    const wouldExceedCharacters = bufferCharacters + line.length + 1 > MAX_CHAPTER_CHARACTERS;
    if (buffer.length > 0 && (wouldExceedLines || wouldExceedCharacters)) flush();
    buffer.push(line);
    bufferCharacters += line.length + 1;
  }
  flush();
  const cleaned = parts.filter((part, index) => part.content.length > 0 || index === 0);
  if (cleaned.length === 0) return [{ title: chapter.title, content: "", volume: chapter.volume }];
  if (cleaned.length === 1) return cleaned;
  return cleaned.map((part, index) => ({
    title: `${chapter.title}（${index + 1}）`,
    content: part.content,
    volume: chapter.volume,
  }));
}

/** 保证每一章都不超过编辑器与数据库的行数／字符上限。 */
function enforceChapterLimits(chapters: readonly SplitChapter[]): SplitChapter[] {
  const result: SplitChapter[] = [];
  for (const chapter of chapters) {
    result.push(...splitOversizedChapter(chapter));
  }
  if (result.length === 0) return [{ title: "第一章", content: "", volume: null }];
  return result;
}

/** TXT / Markdown 的入口：识别不到结构时整本一章，保证不丢字。 */
export function splitTextChapters(text: string, format: DocumentFormat, bookTitle: string): SplitChapter[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (format === "markdown") {
    const byMarkdown = splitMarkdownHeadings(normalized, bookTitle);
    if (byMarkdown && byMarkdown.length >= 2) return enforceChapterLimits(byMarkdown);
  }
  const byHeading = buildChapters(normalized, collectMarkers(normalized));
  if (byHeading.length >= 2) return enforceChapterLimits(byHeading);
  return enforceChapterLimits([{ title: "第一章", content: normalized, volume: null }]);
}

/** 去掉站点元数据行，并丢掉与标题重复的首行。 */
function cleanSectionBody(body: string, heading: string | null): string {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !METADATA_LINE_PATTERN.test(line));
  if (lines.length > 0 && heading && lines[0] === heading) lines.shift();
  return lines.join("\n").trim();
}

/** EPUB：按书脊段落还原章节，封面页跳过、纯卷名页只切换当前卷。 */
export function splitEpubChapters(sections: readonly DocumentSection[]): SplitChapter[] {
  const canonical = canonicalVolumeNames(sections.map((section) => section.title ?? ""));
  const chapters: SplitChapter[] = [];
  let currentVolume: string | null = null;
  for (const section of sections) {
    const title = (section.title ?? "").trim();
    // 封面判定看 <title> 元数据：封面/简介页也带 <h1>书名</h1>，光看标题文本会把它当成正文第一章。
    const titleTag = (section.titleTag ?? "").trim().toLowerCase();
    if (titleTag && COVER_TITLES.has(titleTag)) continue;
    if (!titleTag && title && COVER_TITLES.has(title.toLowerCase())) continue;
    let volume: string | null = null;
    let chapterTitle: string | null = title || null;
    if (title) {
      const parsed = parseHeading(title, canonical);
      volume = parsed.volume;
      chapterTitle = parsed.title;
    }
    if (volume) currentVolume = volume;
    // 用原始 <hN>/<title> 去重首行：纯卷名页（正文只剩卷名）剥完为空，只切换卷、不产出空章。
    const body = cleanSectionBody(section.body, title || chapterTitle);
    if (!body) continue;
    chapters.push({
      title: chapterTitle || title || `第${chapters.length + 1}章`,
      content: body,
      volume: volume ?? currentVolume,
    });
  }
  if (chapters.length === 0) {
    const text = sections.map((section) => section.body).filter(Boolean).join("\n\n").trim();
    return text ? [{ title: "第一章", content: text, volume: null }] : [];
  }
  return enforceChapterLimits(chapters);
}

/** 导入用的一卷：卷名 + 该卷下的章节（保持原文顺序）。 */
export interface ImportVolume {
  title: string;
  chapters: SplitChapter[];
}

/** 按卷把章节分组，保持原文出现顺序；没有卷信息的章节并入默认卷。 */
export function groupChaptersByVolume(chapters: readonly SplitChapter[], defaultVolumeTitle = "正文"): ImportVolume[] {
  const groups: ImportVolume[] = [];
  const positions = new Map<string, number>();
  for (const chapter of chapters) {
    const title = (chapter.volume ?? "").trim() || defaultVolumeTitle;
    let position = positions.get(title);
    if (position === undefined) {
      position = groups.length;
      positions.set(title, position);
      groups.push({ title, chapters: [] });
    }
    groups[position].chapters.push(chapter);
  }
  return groups;
}
