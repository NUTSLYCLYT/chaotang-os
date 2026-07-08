const RAW_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const APP_BASE_PATH =
  RAW_BASE_PATH && RAW_BASE_PATH !== '/' ? RAW_BASE_PATH.replace(/\/$/, '') : '';

export function withBasePath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!APP_BASE_PATH || normalized === APP_BASE_PATH || normalized.startsWith(`${APP_BASE_PATH}/`)) {
    return normalized;
  }
  return `${APP_BASE_PATH}${normalized}`;
}
