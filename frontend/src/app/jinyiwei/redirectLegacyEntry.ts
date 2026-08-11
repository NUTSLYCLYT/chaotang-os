export async function redirectLegacyJinyiweiEntry(
  authenticate: (nextPath: "/jinyiwei") => Promise<unknown>,
  redirectTo: (location: "/zhuanshu/jinyiwei") => never,
): Promise<never> {
  await authenticate("/jinyiwei");
  return redirectTo("/zhuanshu/jinyiwei");
}
