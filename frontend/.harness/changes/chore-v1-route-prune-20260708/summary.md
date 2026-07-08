# chore-v1-route-prune-20260708

Status: DELIVERED

## Scope

Finalize Chaotang OS 1.0 page routes without redesigning page UI.

Canonical routes:

- `/dadian`
- `/shangshufang`
- `/junjichu`
- `/liubu`
- `/zhusi`
- `/shiguan`
- `/zhusi/jinyiwei`
- `/liubu/hubu/yusuan`
- `/liubu/hubu/chuna`
- `/liubu/libu/renmian`
- `/liubu/libu/zhaopin`
- `/liubu/bingbu/baojia`
- `/liubu/bingbu/xiansuo`
- `/liubu/xingbu/hetong`
- `/liubu/gongbu/chan-yan`

## Notes

Old extra page routes were moved to `dev/_attic/v1-route-prune-20260708/`.
Legacy URLs are temporary 307 redirects in `next.config.ts`.
Login/register/invite/enter infrastructure pages remain.

## Verification

- `pnpm exec tsc --noEmit`: pass
- `NEXT_PUBLIC_API_MODE=real pnpm build`: pass
