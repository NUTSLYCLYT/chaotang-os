# 朝堂 OS V9 场景化标杆页 Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Figma 文件中新增一组独立的 V9 标杆设计，以“场景主导、器物承载、HUD 退后”重绘上书房、司级案房和军机处，并用可体验的状态交互证明该方向可扩展。

**Architecture:** V9 不修改 V5–V8，而是在同一 Figma 页面新增独立 Section。三个页面共享克制的全局 HUD、纸张阅读层和状态标识，但每页拥有不同的空间结构与主器物：圣旨卷轴、证据案桌、会审舆图桌。场景背景先按实际槽位生成和验图，再写入 Figma；交互通过组件变体与 Prototype 连接表达，不制作生产代码。

**Tech Stack:** Figma Design、Figma Prototype、Figma Plugin API（`use_figma`）、Figma Screenshot、Image Generation、本地 PNG/WebP 资产、Markdown/JSON 验收记录。

## Global Constraints

- 目标文件固定为 Figma file key `bQAkFbJd9y0INu3m9H4dIu`，目标 page id `153:2`。
- 不修改 V5、V6、V7、V8；尤其不得修改节点 `377:367`、`387:376`、`403:370`、`414:412`、`437:601`、`463:666` 及其后代。
- 第一阶段只新增三个 1440×1024 标杆页：上书房、司级案房、军机处；不扩展欢迎页、登录、注册、六部总览、部级、独立锦衣卫、史馆、统一案卷和系统异常。
- 唯一人工用户是皇帝；丞相、六部、司级、锦衣卫、军机处和史馆全部由 Agent 自动办理。
- 锦衣卫只由司级 Agent 在关键事实不足时自动调用，不进入全局导航，不出现人工“调用、批准、提交”动作。
- 已归档案卷跳转史馆；进行中案卷进入当前责任工作区；完整八节点流程只允许出现在统一案卷详情。
- 画板固定 1440×1024；顶部导航 56px；场景区 `y=56…960`；Footer 64px。
- 主场景器物覆盖页面约 55%–70%；常驻 HUD 可见面积不超过约 20%；详情展开层覆盖不超过 45%。
- 每屏最多一个朱红主按钮；状态必须同时使用器物形态、文字和颜色表达。
- 视觉沿用 V5/V8 的写实黑金、乌木、暖金、米金纸张与克制朱红；禁止现代屏幕、仪表盘、ROI、AI 图标、后台表格、烘焙 UI 文本、占位框和 CSS/矢量假资产。
- 动效必须服务于状态变化，并提供 Reduced Motion 的淡入或即时切换替代。
- Figma 写操作前必须完整读取 `figma-use`；涉及动画写入时同时完整读取 `figma-use-motion`。
- 本计划不包含提交、推送、发布或部署；任何 Git 动作需用户另行明确授权。

## File and Figma Structure

**Local files created during execution:**

- Create: `tmp/v9-scene-native/assets/shangshufang-v9.png` — 适配上书房画板的无 UI 写实场景底图。
- Create: `tmp/v9-scene-native/assets/duzhisi-v9.png` — 适配司级证据案桌的无 UI 写实场景底图。
- Create: `tmp/v9-scene-native/assets/junjichu-v9.png` — 适配军机处舆图桌的无 UI 写实场景底图。
- Create: `tmp/v9-scene-native/asset-review.md` — 三张背景图的尺寸、构图、禁项和验图结论。
- Create: `tmp/v9-scene-native/state-ledger.json` — 新建节点 ID、组件 ID、状态名和原型连接的执行账本。
- Create: `tmp/v9-scene-native/screenshots/` — 三页各状态截图、V8/V9 对照图和最终 contact sheet。
- Create: `tmp/v9-scene-native/qa.md` — 逐页视觉、权限、交互与独立 review 结论。

**New Figma sections on page `153:2`:**

- `V9 / 00 Scene Grammar` — V9 色彩、材质、HUD、器物状态和交互语法；仅供设计维护，不进入原型。
- `V9 / 01 上书房 · 御案下旨` — 上书房三个状态及入口连线。
- `V9 / 02 司级案房 · 度支司` — 案房默认、证物阅读、密查中、密查完成四个状态。
- `V9 / 03 军机处 · 会审舆图` — 会审默认、案卷切换、结论形成三个状态。
- `V9 / 90 Review Board` — V8/V9 同视口对照与验收注释，不进入原型。

---

### Task 1: 锁定 V8 基线与 V9 节点安全边界

**Files:**
- Create: `tmp/v9-scene-native/state-ledger.json`
- Create: `tmp/v9-scene-native/screenshots/v8-shangshufang.png`
- Create: `tmp/v9-scene-native/screenshots/v8-division.png`
- Create: `tmp/v9-scene-native/screenshots/v8-junjichu.png`

**Interfaces:**
- Consumes: V8 nodes `414:600`、`441:630`、`463:667`。
- Produces: 一份只允许新增 V9 节点的安全账本，以及三张 1440×1024 基线图。

- [ ] **Step 1: 读取 Figma 写入规则和当前页面结构**

  完整读取 `figma-use/SKILL.md`，然后查询 page `153:2` 的顶层 Section 名称和节点 ID；确认六个受保护 V8 节点均存在。

- [ ] **Step 2: 导出三张 V8 基线截图**

  分别导出 `414:600`、`441:630`、`463:667`，长边至少 1440px，保存为上述三个文件。验收为图片自然尺寸比例 `1440:1024`，画面不缺边。

- [ ] **Step 3: 建立初始状态账本**

  写入以下 JSON 结构，并把 `createdSections`、`createdFrames`、`createdComponents` 保持为空数组：

  ```json
  {
    "fileKey": "bQAkFbJd9y0INu3m9H4dIu",
    "pageId": "153:2",
    "protectedNodeIds": ["377:367", "387:376", "403:370", "414:412", "437:601", "463:666"],
    "baselineNodeIds": {
      "shangshufang": "414:600",
      "division": "441:630",
      "junjichu": "463:667"
    },
    "createdSections": [],
    "createdFrames": [],
    "createdComponents": [],
    "prototypeConnections": []
  }
  ```

- [ ] **Step 4: 验证未改动 V8**

  再次读取六个受保护节点的 ID 和名称。预期：全部仍存在，名称与读取前一致；本任务没有任何 Figma 写操作。

### Task 2: 生成并验收三个场景底图资产

**Files:**
- Create: `tmp/v9-scene-native/assets/shangshufang-v9.png`
- Create: `tmp/v9-scene-native/assets/duzhisi-v9.png`
- Create: `tmp/v9-scene-native/assets/junjichu-v9.png`
- Create: `tmp/v9-scene-native/asset-review.md`
- Reference: `D:/workspace/chaotang-os/frontend/public/assets/shiguan/shiguan.webp`
- Reference: `D:/workspace/chaotang-os/frontend/public/assets/junjichu/junjichu.webp`
- Reference: `tmp/duzhisi-ai-v8.png`

**Interfaces:**
- Consumes: V5/V8 黑金视觉参考、三页 1440×1024 骨架与 `y=56…960` 场景槽位。
- Produces: 三张可直接铺入 1440×904 场景区的无 UI 背景图。

- [ ] **Step 1: 检查参考图和目标槽位**

  逐张查看三份参考图，记录其主光源、黑金比例、木材纹理、人物密度和可用留白。目标资产比例固定为 `1440:904`；不得通过拉伸填充。

- [ ] **Step 2: 生成上书房背景**

  使用 Image Generation 生成写实、厚重、低饱和黑金上书房：皇帝御案正面居中，中央卷轴区域获得暖光；左侧预留三份奏牍摆放空间，右侧预留笔架、砚台和回执匣；无人物正脸、无现代物件、无文字、无 UI、无按钮。

- [ ] **Step 3: 生成司级案房背景**

  生成度支司证据案房：俯视偏斜的乌木大案桌占据视觉中心，桌面为五类证物预留互不遮挡的真实摆放区；左侧是窄奏牍架，右侧留出黑色密函滑入位置；无现代屏幕、无文字、无 UI。

- [ ] **Step 4: 生成军机处背景**

  生成军机处会审空间：中央舆图桌占视觉中心，桌心留出共享事实区，户部/工部/刑部意见位环绕桌心，桌侧保留卷宗架；人物只作为低对比环境角色，不遮挡交互区；无文字、无 UI。

- [ ] **Step 5: 逐张验图并记录结论**

  对每张图检查：职责辨识、构图留白、主器物完整、视角一致、黑金材质、无烘焙文字、无现代元素、无异常手指/物体、无关键区域裁切。`asset-review.md` 对每张图写 `PASS` 或明确重生成原因；三张均为 `PASS` 才能进入 Task 3。

### Task 3: 建立 V9 场景语法与独立组件

**Files:**
- Modify: `tmp/v9-scene-native/state-ledger.json`

**Interfaces:**
- Consumes: Task 2 通过验收的三张背景图。
- Produces: 新 Section `V9 / 00 Scene Grammar`，以及仅供 V9 使用的 HUD、纸张阅读层、器物状态和动效组件。

- [ ] **Step 1: 新建五个 V9 Section**

  在 page `153:2` 空白区域依次创建 `V9 / 00 Scene Grammar`、`V9 / 01 上书房 · 御案下旨`、`V9 / 02 司级案房 · 度支司`、`V9 / 03 军机处 · 会审舆图`、`V9 / 90 Review Board`，Section 间距 240px。把每个新 ID 写入账本。

- [ ] **Step 2: 建立 V9 颜色与文字样式**

  在 `V9 / 00 Scene Grammar` 记录并应用：乌木 `#15100B`、深墨 `#0C0A08`、暖金 `#C89A4B`、亮金 `#E4C27A`、米金纸 `#E7D3A8`、朱红 `#8F251F`、确认绿 `#526E4F`、正文深褐 `#30251A`。标题使用中文宋/明体可用字体，界面辅助文字使用可读黑体；正文最小 14px，交互文字最小 16px。

- [ ] **Step 3: 创建 Slim HUD 组件**

  高度固定 56px，包含产品名、四个全局入口“上书房 / 六部 / 军机处 / 史馆”、当前身份“皇帝”和一个 Agent 状态；不放流程节点、指标卡或锦衣卫入口。默认态、当前入口态、悬停态做成组件变体。

- [ ] **Step 4: 创建 Footer 与场景位置标识**

  Footer 固定 64px，只含朝代/版本/Agent 运行说明。位置标识只作为场景左上角的标题与面包屑组合，不另占整行。

- [ ] **Step 5: 创建器物状态组件**

  分别创建：完整印记、绿签押、朱红缺页签、断裂封识、黑金密函、史馆藏印。每个组件内同时保留图形形态和可读状态文字，不用单独色块表达状态。

- [ ] **Step 6: 创建米金阅读层组件**

  最大宽度为 576px（画板 40%），带关闭动作和稳定长文排版；组件变体包含“证物正文”“部门意见”“案卷摘要”。关闭后不遗留遮罩，完整场景重新可见。

- [ ] **Step 7: 验证语法板**

  导出 `V9 / 00 Scene Grammar` 截图。预期：没有等宽后台卡片阵列，没有现代图标，没有大面积 HUD；状态在灰度下仍可通过文字和形态区分。

### Task 4: 制作上书房三状态标杆页

**Files:**
- Modify: `tmp/v9-scene-native/state-ledger.json`
- Create: `tmp/v9-scene-native/screenshots/v9-shangshufang-unissued.png`
- Create: `tmp/v9-scene-native/screenshots/v9-shangshufang-routing.png`
- Create: `tmp/v9-scene-native/screenshots/v9-shangshufang-processing.png`

**Interfaces:**
- Consumes: Task 3 的 Slim HUD、Footer、状态组件；Task 2 的上书房背景。
- Produces: 上书房未下旨、分流中、办理中三个可串联状态。

- [ ] **Step 1: 创建未下旨画板**

  新建 1440×1024 frame `V9 / 上书房 / 01 未下旨`。背景铺满 `y=56…960`；御案和卷轴为视觉中心。左侧三份叠放奏牍只显示案号、标题、状态签；右侧只保留笔架、砚台、回执匣。

- [ ] **Step 2: 在卷轴上放置唯一输入与主动作**

  中央仅放一行输入提示“朕意……”和一个朱红按钮“颁旨”。不得增加事项类型、部门、时限、优先级等输入；不得出现第二个朱红动作。

- [ ] **Step 3: 创建分流中状态**

  复制为 `V9 / 上书房 / 02 丞相分流中`。卷轴向下展开，按视觉顺序呈现“原旨正文 → 丞相 Agent 理解 → 御玺回执与案卷编号 → 朱批分流结果”；四段均附着在同一卷轴上，不拆成四张卡。

- [ ] **Step 4: 创建办理中状态**

  复制为 `V9 / 上书房 / 03 办理中`。卷轴底部出现责任签“户部 · 度支司 Agent 办理中”，作为进入司级案房的入口；页面不显示完整流程节点。

- [ ] **Step 5: 补齐奏牍跳转规则**

  三份最近旨意分别包含处理中与已归档示例。处理中奏牍连接到当前责任工作区；已归档奏牍只标注并连接既有史馆入口，不创建 V9 史馆页面。

- [ ] **Step 6: 添加状态动效**

  读取 `figma-use-motion` 后设置：卷轴展开 320ms Ease In Out；丞相理解与朱批按段淡入；奏牍抽取 220ms；Reduced Motion 变体改为 120ms 淡入，不做位移展开。

- [ ] **Step 7: 导出并检查三状态**

  分别导出三个 frame。预期：上书房无需标题也能通过御案和圣旨辨识；HUD ≤20%；只有“颁旨”一个朱红主动作；未出现人工分流或提交动作。

### Task 5: 制作司级案房四状态标杆页

**Files:**
- Modify: `tmp/v9-scene-native/state-ledger.json`
- Create: `tmp/v9-scene-native/screenshots/v9-division-default.png`
- Create: `tmp/v9-scene-native/screenshots/v9-division-evidence.png`
- Create: `tmp/v9-scene-native/screenshots/v9-division-investigating.png`
- Create: `tmp/v9-scene-native/screenshots/v9-division-complete.png`

**Interfaces:**
- Consumes: Task 3 的阅读层与器物状态；Task 2 的度支司案房背景。
- Produces: 默认案桌、证物阅读、锦衣卫密查中、密查完成四个状态。

- [ ] **Step 1: 创建默认证据案桌**

  新建 1440×1024 frame `V9 / 司级案房 / 01 默认`。桌面放置拨银批文、银库出库簿、河工收料簿、关防封识和缺页账簿；左侧奏牍架只作案卷切换入口，不常驻占据三分之一屏幕。

- [ ] **Step 2: 把事实状态附着到证物**

  已确认事实附绿签押；冲突的两件证物以细朱线相连；缺页账簿附朱红缺页签。所有状态旁均有短文字，避免仅靠颜色判断。

- [ ] **Step 3: 创建证物阅读状态**

  复制为 `V9 / 司级案房 / 02 证物阅读`。点击“银库出库簿”后从桌面边缘展开 576px 米金阅读层，显示真实样例字段和核验结论；背景证物不被裁掉，关闭动作返回默认状态。

- [ ] **Step 4: 创建自动密查状态**

  复制为 `V9 / 司级案房 / 03 锦衣卫密查中`。桌面右侧加入黑色封缄密函，文案固定为“度支司 Agent 已自动调用锦衣卫”，次级入口为“查看密查进展”。不得出现“调用锦衣卫”“批准调查”“提交意见”。

- [ ] **Step 5: 创建密查完成状态**

  复制为 `V9 / 司级案房 / 04 密查完成`。黑函变为已拆封回报，缺页账簿补入一页并盖完整印记；新增证据以轻微暖金边聚焦，文案说明证据由 Agent 自动回填。

- [ ] **Step 6: 添加状态动效**

  密函从案桌右侧滑入并落定 280ms；证物聚焦只做轻微景深和金线高亮；阅读层 220ms 展开；Reduced Motion 只做 120ms 淡入。

- [ ] **Step 7: 导出并检查四状态**

  预期：可从案桌和证物识别司级案房；没有人工办理按钮；锦衣卫只在事实不足状态出现；阅读层宽度 ≤40%；主任务不依赖后台卡片。

### Task 6: 制作军机处三状态标杆页

**Files:**
- Modify: `tmp/v9-scene-native/state-ledger.json`
- Create: `tmp/v9-scene-native/screenshots/v9-junjichu-review.png`
- Create: `tmp/v9-scene-native/screenshots/v9-junjichu-switch.png`
- Create: `tmp/v9-scene-native/screenshots/v9-junjichu-conclusion.png`

**Interfaces:**
- Consumes: Task 3 的阅读层与状态组件；Task 2 的军机处背景。
- Produces: 会审默认、卷宗切换、会审结论三个状态。

- [ ] **Step 1: 创建会审默认状态**

  新建 1440×1024 frame `V9 / 军机处 / 01 会审中`。舆图桌心放共享事实，三枚一致签押压住事实；户部、工部、刑部意见签牌环绕桌心；冲突意见以细朱线连接；待补事实以空签位呈现。

- [ ] **Step 2: 建立只读交互**

  皇帝可点击三部门签牌展开米金意见阅读层，可点击“查看统一案卷”；不得出现提交、修改、确认会审意见的动作。

- [ ] **Step 3: 创建卷宗切换状态**

  复制为 `V9 / 军机处 / 02 卷宗架展开`。卷宗架从桌侧打开，列出“待会审 / 会审中 / 已呈送”三组少量案卷；选择案卷后替换桌面内容。卷宗架关闭后不常驻占据左侧版面。

- [ ] **Step 4: 创建结论形成状态**

  复制为 `V9 / 军机处 / 03 形成结论`。三部门签牌向中央轻微归拢，桌心出现一张金边结论牌，显示军机 Agent 会审结论和“已呈送丞相”；不增加人工确认按钮。

- [ ] **Step 5: 添加状态动效**

  部门签牌归拢 260ms；金边结论牌 180ms 淡入；卷宗架 220ms 展开；Reduced Motion 使用即时位置切换与 120ms 淡入。

- [ ] **Step 6: 导出并检查三状态**

  预期：军机处通过舆图会审桌即可辨识；共享事实和分歧关系一眼可见；没有“左队列 + 右详情”的常驻结构；所有操作保持皇帝只读巡察权限。

### Task 7: 串联三页原型与跨模块去向

**Files:**
- Modify: `tmp/v9-scene-native/state-ledger.json`

**Interfaces:**
- Consumes: Tasks 4–6 的十个页面状态。
- Produces: 一条可从上书房体验到司级案房、再查看军机处的 V9 标杆原型路径。

- [ ] **Step 1: 设置原型起点**

  将 `V9 / 上书房 / 01 未下旨` 设为 V9 标杆原型起点，不改动 V8 原型起点。

- [ ] **Step 2: 串联上书房状态**

  “颁旨”连接到“丞相分流中”；分流完成连接到“办理中”；责任签连接到司级案房默认状态。把每条 source、trigger、destination、transition 写入账本。

- [ ] **Step 3: 串联司级状态**

  证物点击打开阅读状态；关闭返回默认；黑函入口打开密查中；查看密查进展到密查完成。所有流程均由 Agent 状态驱动，不新增皇帝执行按钮。

- [ ] **Step 4: 串联军机处状态**

  签牌打开对应部门意见；卷宗架切换案卷；“查看统一案卷”连接既有统一案卷页面；金边结论牌保持只读。

- [ ] **Step 5: 验证跨模块目的地**

  已归档奏牍连接既有史馆页面；处理中责任签连接司级案房；锦衣卫只从密函出现，不加入 Slim HUD。预期：没有死链，没有新增全局锦衣卫导航。

### Task 8: 视觉对照、交互验收与有限返工

**Files:**
- Create: `tmp/v9-scene-native/screenshots/v9-contact-sheet.png`
- Create: `tmp/v9-scene-native/qa.md`
- Modify: `tmp/v9-scene-native/state-ledger.json`

**Interfaces:**
- Consumes: Task 1 的 V8 基线、Tasks 4–6 的 V9 截图、Task 7 的原型连接。
- Produces: 同视口对照板、完整 QA 记录和 Critical=0 / Important=0 的放行结论。

- [ ] **Step 1: 创建 Figma Review Board**

  在 `V9 / 90 Review Board` 中按三行排列“V8 对应页 / V9 默认状态”，每张均为 1440×1024 同视口缩略图；只写设计结论，不放进最终交互页面。

- [ ] **Step 2: 制作本地 contact sheet**

  将 V8/V9 三组页面按相同比例并排，生成 `v9-contact-sheet.png`。检查背景裁切、文字边界、组件重叠、对齐、边距、圆角、边框和主器物完整性。

- [ ] **Step 3: 执行场景辨识验收**

  临时隐藏三个 V9 默认页的场景标题，仅凭御案卷轴、证据案桌、会审舆图桌判断页面职责；在 `qa.md` 逐页记录 `PASS/FAIL`，之后恢复标题。

- [ ] **Step 4: 执行结构与权限验收**

  逐页确认：HUD ≤20%；详情层 ≤45%；每屏最多一个朱红主动作；无重复左右栏/卡片阵列；皇帝权限未扩大；锦衣卫只由司级 Agent 条件触发；没有完整流程节点；没有现代后台元素。

- [ ] **Step 5: 执行动效与可达性验收**

  从 V9 起点完整点击一遍主路径，确认卷轴、奏牍、阅读层、密函、签牌和卷宗架状态可达且可返回；Reduced Motion 变体不依赖大幅位移；正文对比度和最小字号满足可读性。

- [ ] **Step 6: 独立 reviewer 门禁**

  由未参与制作的 reviewer 依据 spec 第 11 节检查三页，问题按 `Critical / Important / Minor` 记录。只有 `Critical=0` 且 `Important=0` 才允许通过；否则只返工对应页面并重新导出、重新对照、重新 review。

- [ ] **Step 7: 最终安全检查**

  再次确认六个受保护 V8 节点仍存在且未重命名；核对账本中的所有新增节点都位于五个 V9 Section 内；确认没有生产代码、真实视频、发布或部署改动。

## Completion Evidence

执行完成时必须同时提供：

1. V9 Figma 原型起点 URL。
2. 三个默认页和关键状态的节点 ID 清单。
3. `tmp/v9-scene-native/screenshots/v9-contact-sheet.png`。
4. `tmp/v9-scene-native/qa.md`，结论为 `Critical=0`、`Important=0`。
5. 受保护 V8 节点未改动的复核结果。
6. 明确说明第一阶段未扩展其他模块。
