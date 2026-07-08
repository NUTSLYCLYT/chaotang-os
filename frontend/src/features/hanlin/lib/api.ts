import { withBasePath } from '@/lib/base-path';

export function hanlinApi(path: string): string {
  return withBasePath(path);
}
