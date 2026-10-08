import { previewJinyiweiNews, type JinyiweiNewsPreviewInput } from "../../../../lib/backendClient.ts";
import { readSessionId } from "../../../../lib/session.ts";

const FRIENDLY = {
  validation: "离线快照格式未通过校验。",
  not_found: "来源目录不存在。",
  storage: "锦衣卫新闻预览暂时不可用，请稍后重试。",
  network: "离线快照预览不应访问外网，请检查后端配置。",
  unknown: "锦衣卫新闻预览暂时不可用，请稍后重试。",
} as const;
const ENTRY_KEYS = ["sourceId", "url", "title", "publishedAt", "updatedAt", "author", "publisher", "summary", "content", "contentHash"];
const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function parseInput(value: unknown): JinyiweiNewsPreviewInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 2 || typeof record.snapshotId !== "string" || !record.snapshotId.trim() || !Array.isArray(record.entries) || record.entries.length > 200) return null;
  const entries = record.entries.map((entry) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return null;
    const item = entry as Record<string, unknown>;
    if (Object.keys(item).sort().join("\0") !== [...ENTRY_KEYS].sort().join("\0")) return null;
    if (![item.sourceId, item.url, item.title, item.publishedAt, item.publisher, item.content, item.contentHash].every((part) => typeof part === "string" && part.trim())) return null;
    if (!(item.updatedAt === null || typeof item.updatedAt === "string") || !(item.author === null || typeof item.author === "string") || !(item.summary === null || typeof item.summary === "string")) return null;
    return item as unknown as JinyiweiNewsPreviewInput["entries"][number];
  });
  return entries.some((entry) => entry === null) ? null : { snapshotId: record.snapshotId, entries: entries as JinyiweiNewsPreviewInput["entries"] };
}

export function createNewsHandler(readNews: typeof previewJinyiweiNews = previewJinyiweiNews, readSession: typeof readSessionId = readSessionId) {
  return async function handleNews(request: Request): Promise<Response> {
    const sessionId = readSession(request);
    if (!sessionId) return reply({ status: "error", reason: "unauthenticated", message: "authentication required" }, 401);
    if (request.method !== "POST" || [...new URL(request.url).searchParams.keys()].length > 0) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    let input: JinyiweiNewsPreviewInput | null;
    try { input = parseInput(await request.json()); } catch { input = null; }
    if (!input) return reply({ status: "error", reason: "validation", message: FRIENDLY.validation }, 400);
    const result = await readNews(input, { sessionId });
    if (result.ok) return reply({ status: "ok", news: result.data }, 200);
    const status = result.kind === "validation" ? 400 : result.kind === "not_found" ? 404 : 503;
    return reply({ status: "error", reason: result.kind, message: FRIENDLY[result.kind] }, status);
  };
}

export const POST = createNewsHandler();
