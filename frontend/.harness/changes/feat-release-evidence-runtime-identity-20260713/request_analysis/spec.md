# S8 发布证据与运行身份门

## 背景

S5 已提供不可变 production build，S6 已提供唯一 Release Commander，但原 `prod-doctor` 只根据进程 cwd 和共享 `.next` 判断，不能证明 3050 实际加载的 build、Git HEAD、gate report 与发布证据相同。

## 范围

- 从 3050 socket inode 定位唯一 PID，并以 `/proc` 核验 PID/start ticks/PGID/cwd。
- 从监听进程实际 cwd 的不可变 build 目录读取 BUILD_ID、manifest，并独立重算 next/public/runtime config digest。
- `prod-doctor` 使用严格运行身份，不再用共享 `.next` 代表 production build。

## 非目标

- 不修改页面、路由或业务 API。
- 不把本地签名锚声明为外部独立信任锚。
- 不绕过 S5/S6 的 build/port/release 锁。

## 验收

- 伪环境 SHA、非监听 PID、其他 build cwd、旧 build 与运行期 artifact 修改均 STOP。
- `HEAD = build = runtime = evidence = gate report`，任一不等返回 `STOP/runtime_identity_mismatch`。
- 外部 protected trust root 未启用时只能 `IMPLEMENTED_LOCAL`，不能 READY。
