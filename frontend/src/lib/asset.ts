/**
 * Static asset URL helper.
 * 原生 <img src="/heroes/x.webp"> 不会自动应用 next.config.ts 的 basePath，
 * prod 在 /chaotang 下会 404。所有 public/ 资源都要用 assetUrl() 包一层。
 *
 * 注意：next/image 的 <Image> 组件 自动应用 basePath，不需要 helper。
 *      但项目内大量 <img> 用了硬编码路径，统一用此 helper 修。
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function assetUrl(path: string): string {
  if (!path.startsWith('/')) return path; // 绝对 URL / 相对路径不动
  if (BASE_PATH && path.startsWith(BASE_PATH + '/')) return path; // 已带前缀
  return `${BASE_PATH}${path}`;
}
