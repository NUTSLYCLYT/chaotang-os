/** Server-only helpers for the opaque session cookie owned by the BFF. */
export const SESSION_COOKIE_NAME = "courtos_session";

function cookieValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Read only the BFF cookie from an incoming server-side request. */
export function readSessionId(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;

  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME && value.length > 0) {
      const sessionId = cookieValue(value.join("="));
      return sessionId !== null && sessionId.trim().length > 0 ? sessionId : null;
    }
  }
  return null;
}

function cookieAttributes(maxAge?: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const expiration = maxAge === undefined ? "" : `; Max-Age=${maxAge}`;
  return `Path=/; HttpOnly; SameSite=Lax${secure}${expiration}`;
}

/** Attach the opaque backend session without exposing it to browser JavaScript. */
export function setSessionCookie(response: Response, sessionId: string): Response {
  response.headers.set(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; ${cookieAttributes()}`,
  );
  return response;
}

/** Expire the session cookie using the same scope as the setter. */
export function clearSessionCookie(response: Response): Response {
  response.headers.set(
    "set-cookie",
    `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`,
  );
  return response;
}
