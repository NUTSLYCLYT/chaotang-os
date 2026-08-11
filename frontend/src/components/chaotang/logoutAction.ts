type LogoutActionOptions = {
  fetchImpl?: typeof fetch;
  redirect?: (href: string) => void;
};

const LOCAL_SESSION_TERMINAL_STATUSES = new Set([204, 401, 503]);

export async function logoutAction({
  fetchImpl = fetch,
  redirect = (href) => window.location.replace(href),
}: LogoutActionOptions = {}): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!LOCAL_SESSION_TERMINAL_STATUSES.has(response.status)) return false;
    redirect("/login");
    return true;
  } catch {
    return false;
  }
}
