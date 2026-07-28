import type { ChancellorConsultState } from "./chancellorConsultStatus";

export async function requestChancellorConsult(
  messages: ChancellorConsultState["messages"],
  fetchImpl: typeof fetch,
): Promise<{ ok: true; reply: string } | { ok: false; unauthenticated?: boolean }> {
  try {
    const response = await fetchImpl("/api/chat/chancellor-consult", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    });
    if (response.status === 401) return { ok: false, unauthenticated: true };
    if (!response.ok) return { ok: false };
    const body = await response.json() as { reply?: unknown };
    return typeof body.reply === "string" && body.reply.trim()
      ? { ok: true, reply: body.reply.trim() }
      : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function submitChancellorConsult(input: {
  state: ChancellorConsultState;
  content: string;
  request(messages: ChancellorConsultState["messages"]): Promise<{ ok: true; reply: string } | { ok: false }>;
}): Promise<{ state: ChancellorConsultState; clearDraft: boolean }> {
  const content = input.content.trim();
  if (!content) return { state: input.state, clearDraft: false };
  const messages = [...input.state.messages, { role: "user" as const, content }];
  const result = await input.request(messages);
  if (!result.ok) {
    return { state: { ...input.state, pending: false, error: "丞相（咨询）暂时无法回应，请稍后再试" }, clearDraft: false };
  }
  return {
    state: { messages: [...messages, { role: "assistant", content: result.reply }], pending: false, error: null },
    clearDraft: true,
  };
}

export async function submitConsultDraft(
  draft: string,
  submit: (content: string) => Promise<boolean>,
): Promise<string> {
  const content = draft.trim();
  if (!content) return draft;
  return await submit(content) ? "" : draft;
}

export function shouldSubmitConsultKey(input: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): boolean {
  return input.key === "Enter" && !input.shiftKey && !input.isComposing;
}
