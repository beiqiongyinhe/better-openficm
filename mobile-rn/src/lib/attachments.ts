import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import { createId } from "@/lib/id";
import {
  MAX_DOCUMENT_IMPORT_BYTES,
  MAX_EXTRACTED_CHARACTERS,
  extensionOf,
  extractDocumentText,
  formatForExtension,
} from "@/lib/text-extract";
import type { ChatAttachment, ChatMessage } from "@/types";

/** 单个附件写进提示词时的字符上限，避免一次发送就把上下文撑满。 */
const MAX_ATTACHMENT_PROMPT_CHARACTERS = 20_000;

const ATTACHMENT_DIRECTORY_NAME = "assistant-attachments";

function attachmentDirectory(): Directory {
  const directory = new Directory(Paths.document, ATTACHMENT_DIRECTORY_NAME);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

/** 附件正文落盘位置；正文以文件形式保存，不塞进数据库。 */
function attachmentTextFile(attachmentId: string): File {
  return new File(attachmentDirectory(), `${attachmentId}.txt`);
}

export function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1_024) return `${sizeBytes} B`;
  if (sizeBytes < 1_024 * 1_024) return `${(sizeBytes / 1_024).toFixed(1)} KB`;
  return `${(sizeBytes / (1_024 * 1_024)).toFixed(1)} MB`;
}

/** 弹出系统文件选择器，把选中的文件抽取成纯文本并落盘，返回可随消息一起保存的附件描述。 */
export async function pickChatAttachment(): Promise<ChatAttachment | null> {
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
  if (!sizeBytes || sizeBytes > MAX_DOCUMENT_IMPORT_BYTES) throw new Error("附件必须小于 50 MB");
  const bytes = await inputFile.bytes();
  const extracted = extractDocumentText(bytes, format);
  if (!extracted.text) throw new Error("附件里没有可读取的正文");
  if (extracted.text.length > MAX_EXTRACTED_CHARACTERS) throw new Error("附件正文超过 800 万字符限制");
  const id = createId();
  const textFile = attachmentTextFile(id);
  textFile.create({ overwrite: true });
  textFile.write(extracted.text);
  return {
    id,
    name: asset.name,
    format,
    sizeBytes,
    characterCount: extracted.text.length,
    textUri: textFile.uri,
  };
}

async function readAttachmentText(attachment: ChatAttachment): Promise<string | null> {
  try {
    const file = new File(attachment.textUri);
    if (!file.exists) return null;
    return await file.text();
  } catch {
    return null;
  }
}

/** 把消息附带的附件正文拼接进提示词；读不到的文件跳过，过长的正文截断并标注。 */
export async function buildPromptContent(message: ChatMessage): Promise<string> {
  const attachments = message.metadata?.attachments;
  if (!attachments?.length) return message.content;
  const blocks: string[] = [];
  for (const attachment of attachments) {
    const text = await readAttachmentText(attachment);
    if (!text) continue;
    const truncated = text.length > MAX_ATTACHMENT_PROMPT_CHARACTERS;
    const body = truncated ? text.slice(0, MAX_ATTACHMENT_PROMPT_CHARACTERS) : text;
    blocks.push(`[附件：${attachment.name}]\n${body}${truncated ? "\n（附件过长，已截断）" : ""}`);
  }
  if (!blocks.length) return message.content;
  return `${message.content}\n\n${blocks.join("\n\n")}`;
}
