# 鸿胪寺外部能力国门 UI V1 successor 实施计划

任务 ID：`HONGLUSI-EXTERNAL-CAPABILITY-GATEWAY-UI-V1-READINESS-SUCCESSOR-20260901`

## 1. 目标与边界

基于 `origin/ext-dev@fb5d3f4af426f6140ef905ff015721692396d084`，在不修改后端、BFF、认证机制、Harness、ADR 或发布系统的前提下，增加完整的 `/honglusi` 受保护 UI 纵向切片。V1 只证明信息架构、视觉语言、交互模型和朝堂融合，不宣称外部能力已接入。

## 2. 信息架构

- 顶栏：朝堂品牌、七个一级入口、当前页、能力边界、用户和退出。
- 中央：鸿胪寺国门星轨；外部能力在门外，朝堂能力池在门内，准入闸门位于中间。
- 左栏：能力目录与准入状态。
- 中栏：能力护照、风险和影响链。
- 右栏：预警、待决策与下一步。
- 底栏：问丞相、鸿胪寺 DEMO 对话、问钦天监。
- 页内视图：`overview | capabilities | admission | routes`。

## 3. TDD 顺序

### A. 入口与导航 RED

先修改 `court-entry-pages.test.ts` 与 `ChaotangHeader.test.ts`：

- 冻结 `requireUser("/honglusi")`、`HonglusiScene` 委托和非占位页。
- 冻结导航 `/honglusi`、“鸿胪寺”和当前页语义。
- 运行 focused tests，确认因功能不存在而失败。

### B. Registry RED/GREEN

新增 `honglusiRegistry.test.ts`：

- 四类能力各至少一条，ID 唯一、顺序稳定。
- 状态只允许待审、沙箱、只读、阻断。
- 每条具备来源、数据等级、权限、风险、影响和下一步。
- 禁止 URL、Bearer、API key、secret、credential、token 和命令。
- 每条必须为 `mode: "DEMO"`。

随后实现只读数据与类型，不读取环境变量，不导出可变数组。

### C. Scene RED/GREEN

新增 `HonglusiScene.test.ts`：

- 必须使用 `ImmersiveCourtShell` 和 `scene="honglusi"`。
- 必须具有四个页内视图、三栏国门舞台、能力护照、预警和待决策。
- 必须将带标签的对话 form 注入 `quickDockCenter`。
- 只有一个 primary CTA，且包含“演示”。
- 必须显示 DEMO 与“待接入真实事实源”。
- 禁止 fetch、第三方 URL、浏览器存储、敏感输入和写方法。

随后实现本地视图切换、能力选择、演示评估和演示对话；不使用定时器、虚假百分比或持久化。

### D. 视觉 GREEN

- 色彩：墨黑 `#05080c`、深青 `#0b1719`、旧金 `#c8a35a`、米白 `#eee5d0`、朱砂 `#a34b3f`、青玉 `#6fa996`。
- 中央国门必须成为视觉记忆点；使用圆环、经纬刻度、外交文牒与印章，不做普通仪表盘。
- 层次依靠实体色、透明度、边框、纹理线和阴影；不新增渐变。
- 1920、1440、1024、768、390 五档均无水平溢出。
- 交互时长 160–240ms；`prefers-reduced-motion` 关闭位移和闪烁。

### E. 接线 GREEN

- 新增 server page 并在渲染前认证。
- 扩展 `ProtectedPath`、全局导航和沉浸场景联合类型。
- 顺序固定为：大殿、上书房、军机处、六部、专署、鸿胪寺、史馆。

## 4. 候选与验证

1. 产品 candidate 必须是 approval commit 的唯一直接子提交。
2. candidate 只包含 manifest 中 exact11。
3. 在 committed candidate 上执行 manifest 十项机器验证。
4. 浏览器验证 1920×1080、1440×900、1024×768、390×844。
5. 检查键盘顺序、焦点、减少动画、控制台和网络；外部网络与写请求必须为零。
6. 独立审查产品、前端、安全、无障碍和视觉；P0–P2 必须为零。
7. 运行 `node scripts/product-authority.mjs --verify-candidate --task HONGLUSI-EXTERNAL-CAPABILITY-GATEWAY-UI-V1-READINESS-SUCCESSOR-20260901`。

## 5. 回退与后续

- V1 是新增路由与有限导航扩展，可通过撤销唯一 candidate 回退，不涉及数据迁移。
- V2 才可规划只读能力护照 API、翰林院治理投影和锦衣卫风险证据。
- V3 才可在独立安全 Packet 下规划真实 MCP/模型 profile、沙箱执行和可撤销激活。
- 本 authority 不允许 V2/V3 功能。
