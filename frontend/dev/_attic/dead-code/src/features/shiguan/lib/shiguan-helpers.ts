/**
 * 史馆 · 纯函数 helpers
 */

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })
}
