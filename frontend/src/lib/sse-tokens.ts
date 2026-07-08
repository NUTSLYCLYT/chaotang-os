/**
 * Reads an SSE response body, yielding each token string as it arrives.
 *
 * Handles:
 *   - Both \n\n and \r\n\r\n frame delimiters
 *   - TextDecoder flush at stream end (split multibyte UTF-8)
 *   - Server-sent data: {"error":"..."} frames — throws so callers can surface them
 *   - JSON parse failures (partial chunks) — silently ignored
 *   - Reader lock released on abort or error
 */
export async function* streamSseTokens(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      yield* drainFrames();
    }
    buf += decoder.decode(); // flush remaining bytes
    yield* drainFrames();
  } finally {
    reader.releaseLock();
  }

  function* drainFrames(): Generator<string> {
    const lines = buf.replace(/\r\n/g, '\n').split('\n\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      try {
        const obj = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
        if (typeof obj['token'] === 'string' && obj['token']) yield obj['token'];
        else if (obj['error']) throw new Error(String(obj['error']));
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
      }
    }
  }
}
