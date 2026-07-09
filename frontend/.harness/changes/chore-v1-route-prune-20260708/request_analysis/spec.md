# Spec

## Background

1.0 产品面需要一组小而固定的页面地图：
大殿、上书房、军机处、六部、诸司、史馆，并只保留用户要求的二级司局入口。

## Scope

- Keep existing page implementations.
- 将 canonical App Router 目录移动到 1.0 路径。
- Retire extra page routes into attic instead of deleting irreversibly.
- 保留旧 URL 的临时 redirect。

## Non-goals

- No visual redesign.
- No 后端 swarm changes.
- No new department capability claims.

## 验收

- `src/app` 只暴露 1.0 业务路由以及 auth/entry 基础设施。
- 六部支持用户要求的二级路径。
- TypeScript and production build pass.

