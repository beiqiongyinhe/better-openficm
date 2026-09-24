import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";

import {
  createStyleSource,
  deleteStyleSourceRecord,
  findStyleSourceByHash,
  getStyleSource,
} from "@/data/style-repositories";
import { createId } from "@/lib/id";
import { sha256File } from "@/lib/sha256";
import {
  MAX_DOCUMENT_IMPORT_BYTES,
  MAX_EXTRACTED_CHARACTERS,
  extensionOf,
  extractDocumentText,
  formatForExtension,
} from "@/lib/text-extract";
import {
  ANALYSIS_PASSAGE_COUNT,
  describeWindow,
  nextSampleWindow,
  spreadIndices,
  type StyleSampleWindow,
  type StyleUnitKind,
} from "@/style/sampling";
import type { StyleSource } from "@/types";

export { nextSampleWindow } from "@/style/sampling";
export type { StyleSampleWindow, StyleUnitKind } from "@/style/sampling";

const ANALYSIS_PASSAGE_CHARACTERS = 1_400;
const ANALYSIS_BATCH_SIZE = 6;
const MIN_CHAPTER_HEADING_COUNT = 8;
const CHAPTER_HEADING_PATTERN = /^[ \t]{0,4}(?:第[0-9零〇一二两三四五六七八九十百千万]+[章节回][^\n]{0,60}|(?:chapter|chap\.?)\s*\d+[^\n]{0,60})[ \t]*$/gim;
const LIBRARY_DIRECTORY_NAME = "style-library";

export interface StyleAnalysisBatch {
  label: string;
  passageCount: number;
  text: string;
}

export interface StyleAnalysisPlan {
  unitKind: StyleUnitKind;
  totalUnits: number;
  window: StyleSampleWindow | null;
  windowLabel: string;
  batches: StyleAnalysisBatch[];
  passageCount: number;
}

function libraryDirectory(): Directory {
  const directory = new Directory(Paths.document, LIBRARY_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function contentFile(sourceId: string): File {
  return new File(libraryDirectory(), `${sourceId}.content.txt`);
}

function sourceTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || "未命名参考书";
}

export async function importStyleSource(): Promise<StyleSource | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const format = formatForExtension(extensionOf(asset.name));
  const inputFile = new File(asset.uri);
  const sizeBytes = asset.size ?? inputFile.size;
  if (!sizeBytes || sizeBytes > MAX_DOCUMENT_IMPORT_BYTES) throw new Error("参考书文件必须小于 50 MB");
  const contentHash = await sha256File(inputFile);
  const duplicate = await findStyleSourceByHash(contentHash);
  if (duplicate) throw new Error(`《${duplicate.title}》已在参考书库中`);
  const bytes = await inputFile.bytes();
  const extracted = extractDocumentText(bytes, format);
  if (!extracted.text) throw new Error("文件中没有可读取的正文");
  if (extracted.text.length > MAX_EXTRACTED_CHARACTERS) throw new Error("正文超过 800 万字符限制");
  const id = createId();
  const originalFile = new File(libraryDirectory(), `${id}.${extensionOf(asset.name)}`);
  const normalizedFile = contentFile(id);
  try {
    originalFile.create({ overwrite: true });
    originalFile.write(bytes);
    normalizedFile.create({ overwrite: true });
    normalizedFile.write(extracted.text);
    return await createStyleSource({
      id,
      title: extracted.title || sourceTitle(asset.name),
      fileName: asset.name,
      format,
      fileUri: originalFile.uri,
      sizeBytes,
      contentHash,
      characterCount: extracted.text.length,
    });
  } catch (error) {
    if (originalFile.exists) originalFile.delete();
    if (normalizedFile.exists) normalizedFile.delete();
    throw error;
  }
}

export async function readStyleSourceText(sourceId: string): Promise<string> {
  const source = await getStyleSource(sourceId);
  if (!source) throw new Error("参考书不存在");
  const file = contentFile(source.id);
  if (!file.exists) throw new Error("参考书正文文件已丢失，请重新导入");
  return file.text();
}

type SourceOutline = {
  unitKind: StyleUnitKind;
  unitStarts: number[];
};

// 章节标题足够多时按章切分，否则退化为定长连续段落，两种情况都得到统一的"单元"序列。
function sourceOutline(text: string): SourceOutline {
  const chapterStarts = [...text.matchAll(CHAPTER_HEADING_PATTERN)]
    .map((match) => match.index ?? 0)
    .filter((start, index, values) => index === 0 || start > values[index - 1]);
  if (chapterStarts.length >= MIN_CHAPTER_HEADING_COUNT) {
    return { unitKind: "chapter", unitStarts: chapterStarts };
  }
  const unitStarts: number[] = [];
  for (let start = 0; start < text.length; start += ANALYSIS_PASSAGE_CHARACTERS) {
    const paragraphStart = text.lastIndexOf("\n", start);
    unitStarts.push(Math.max(0, paragraphStart >= start - 500 ? paragraphStart + 1 : start));
  }
  return { unitKind: "segment", unitStarts: unitStarts.length ? unitStarts : [0] };
}

function passageAt(text: string, outline: SourceOutline, index: number): string {
  const start = outline.unitStarts[index];
  if (start === undefined) return "";
  const nextStart = outline.unitStarts[index + 1] ?? text.length;
  return text.slice(start, Math.min(nextStart, start + ANALYSIS_PASSAGE_CHARACTERS)).trim();
}

function buildBatches(
  text: string,
  outline: SourceOutline,
  indices: number[],
  describe: (unitIndex: number) => string,
): StyleAnalysisBatch[] {
  const selected = indices
    .map((unitIndex) => ({ unitIndex, passage: passageAt(text, outline, unitIndex) }))
    .filter((item) => item.passage);
  if (!selected.length) throw new Error("参考书中没有可分析的正文");
  const batchCount = Math.ceil(selected.length / ANALYSIS_BATCH_SIZE);
  return Array.from({ length: batchCount }, (_, batchIndex) => {
    const offset = batchIndex * ANALYSIS_BATCH_SIZE;
    const items = selected.slice(offset, offset + ANALYSIS_BATCH_SIZE);
    return {
      label: `${describe(items[0].unitIndex)} 起的 ${items.length} 个样本`,
      passageCount: items.length,
      text: items
        .map((item) => `[${describe(item.unitIndex)}]\n${item.passage}`)
        .join("\n\n"),
    };
  });
}

/**
 * window 优先：断点续跑时按记录的窗口原样重放。
 * 否则 coveredUntil 为 null 时按全书均匀分布抽样（Agent 工具的取样行为），
 * 传入数字时选出下一个连续窗口，供多轮"继续蒸馏"使用。
 */
export async function readStyleSourceAnalysisPlan(input: {
  sourceId: string;
  coveredUntil?: number | null;
  window?: StyleSampleWindow | null;
  random?: () => number;
}): Promise<StyleAnalysisPlan> {
  const text = await readStyleSourceText(input.sourceId);
  const outline = sourceOutline(text);
  const totalUnits = outline.unitStarts.length;
  const unitName = outline.unitKind === "chapter" ? "章" : "段";
  const describe = (unitIndex: number) => `第 ${unitIndex + 1} ${unitName}`;
  const buildPlan = (window: StyleSampleWindow | null): StyleAnalysisPlan => {
    const indices = window
      ? Array.from({ length: window.count }, (_, index) => window.start + index)
      : spreadIndices(totalUnits, ANALYSIS_PASSAGE_COUNT);
    const batches = buildBatches(text, outline, indices, describe);
    return {
      unitKind: outline.unitKind,
      totalUnits,
      window,
      windowLabel: window ? describeWindow(outline.unitKind, window) : "全书均匀分布",
      batches,
      passageCount: batches.reduce((total, batch) => total + batch.passageCount, 0),
    };
  };
  if (input.window) {
    const start = Math.max(0, Math.min(Math.floor(input.window.start), Math.max(0, totalUnits - 1)));
    const count = Math.max(1, Math.min(Math.floor(input.window.count), totalUnits - start));
    return buildPlan({ start, count });
  }
  if (input.coveredUntil === null || input.coveredUntil === undefined) return buildPlan(null);
  const window = nextSampleWindow({
    totalUnits,
    coveredUntil: input.coveredUntil,
    random: input.random,
  });
  if (!window) {
    throw new Error(`已蒸馏到全书末尾（共 ${totalUnits} ${unitName}）。如需重新扫描请点击“重新开始”。`);
  }
  return buildPlan(window);
}

export async function readStyleSourceSample(sourceId: string): Promise<string> {
  const plan = await readStyleSourceAnalysisPlan({ sourceId });
  return plan.batches.map((batch) => batch.text.slice(0, ANALYSIS_PASSAGE_CHARACTERS + 200)).join("\n\n");
}

export async function deleteStyleSource(sourceId: string): Promise<void> {
  const source = await getStyleSource(sourceId);
  if (!source) throw new Error("参考书不存在");
  await deleteStyleSourceRecord(source.id);
  const originalFile = new File(source.fileUri);
  const normalizedFile = contentFile(source.id);
  if (originalFile.exists) originalFile.delete();
  if (normalizedFile.exists) normalizedFile.delete();
}
