# Scene Pack V1 执行权威

`execution-authority.scene-pack-v1` 是 `SCENE-PACK-V1-FIRST-REAL-SCENES-20260903` 的窄作用域施工闸门。

它不修改 `execution-authority.v1` 和 `execution-authority.v2`：

- v1 继续作为 M0-M10 inactive guard，固定 `STOP`。
- v2 继续作为 R0 合同内核 authority，当前 `activeWorkPackage=null`。
- 本 authority 只回答 `SCENE-PACK-V1` 这一包能否按已批准 amendment 在指定 `origin/ext-dev` base 上施工。

## 命令

- `node scripts/execution-authority-scene-pack-v1.mjs --status`
- `node scripts/execution-authority-scene-pack-v1.mjs --check`
- `node scripts/execution-authority-scene-pack-v1.mjs --authorize --work-package SCENE-PACK-V1`

`--authorize` 返回 `decision:"GO"` 且退出 0 时，才允许修改本 amendment 范围内的 frontend/backend 产品代码。任何 digest 漂移、approval 漂移、包名不匹配或 active package 为空都必须 `STOP`。

## 边界

本 authority 不授权 push、merge、deploy，也不授权自动签约、自动付款、自动报价发送、自动群发或自动对外发布。
