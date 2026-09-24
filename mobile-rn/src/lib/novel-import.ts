import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";

import { createProjectWithChapters } from "@/data/repositories";
import {
  groupChaptersByVolume,
  splitEpubChapters,
  splitTextChapters,
  type ImportVolume,
} from "@/lib/import-split";
import {
  MAX_DOCUMENT_IMPORT_BYTES,
  MAX_EXTRACTED_CHARACTERS,
  extensionOf,
  extractDocumentSections,
  formatForExtension,
} from "@/lib/text-extract";

const COVER_DIRECTORY_NAME = "covers";

export interface NovelImportResult {
  projectId: string;
  title: string;
  chapterCount: number;
}

function fileNameWithoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim();
}

/** 选取本地小说文件（TXT / Markdown / EPUB）并导入为一部新作品。取消选择时返回 null。 */
export async function importNovelFromDevice(): Promise<NovelImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const format = formatForExtension(extensionOf(asset.name));
  const inputFile = new File(asset.uri);
  const declaredSize = asset.size ?? inputFile.size ?? 0;
  if (declaredSize > MAX_DOCUMENT_IMPORT_BYTES) {
    throw new Error("文件超过 50MB，无法导入");
  }
  const bytes = await inputFile.bytes();
  if (bytes.byteLength > MAX_DOCUMENT_IMPORT_BYTES) {
    throw new Error("文件超过 50MB，无法导入");
  }
  const extracted = extractDocumentSections(bytes, format);
  const text = extracted.text.trim();
  // EPUB 允许正文抽不出纯文本（仅由书脊段落承载），此时按段切分即可，不视为空文件。
  if (!text && extracted.sections.length === 0) {
    throw new Error("文件中没有可导入的正文");
  }
  if (text.length > MAX_EXTRACTED_CHARACTERS) {
    throw new Error("正文内容过长，超出可导入范围");
  }
  const bookTitle = (extracted.title ?? "").trim() || fileNameWithoutExtension(asset.name) || "未命名作品";
  // EPUB 走书脊段落（保留页面边界，卷/章边界最准）；TXT/Markdown 走整文本标题识别。
  const chapters = format === "epub" ? splitEpubChapters(extracted.sections) : splitTextChapters(extracted.text, format, bookTitle);
  const volumes = groupChaptersByVolume(chapters);
  const project = await createProjectWithChapters(bookTitle, "", volumes);
  return { projectId: project.id, title: project.title, chapterCount: chapters.length };
}

function coverDirectory(): Directory {
  const directory = new Directory(Paths.document, COVER_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

/** 选取本地图片，复制到应用私有封面目录；返回新的封面文件路径。取消选择时返回 null。 */
export async function pickCoverImage(projectId: string, previousUri?: string | null): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "image/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const extension = extensionOf(asset.name) || "jpg";
  const source = new File(asset.uri);
  const target = new File(coverDirectory(), `${projectId}-${Date.now()}.${extension}`);
  if (target.exists) target.delete();
  await source.copy(target);
  if (previousUri && previousUri !== target.uri) deleteStoredCover(previousUri);
  return target.uri;
}

/** 删除应用私有封面目录内的旧封面，失败时静默忽略。 */
export function deleteStoredCover(uri: string | null | undefined): void {
  if (!uri) return;
  const name = uri.split("/").pop();
  if (!name) return;
  try {
    const file = new File(coverDirectory(), name);
    if (file.exists) file.delete();
  } catch {
    // 封面清理失败不影响主流程
  }
}
