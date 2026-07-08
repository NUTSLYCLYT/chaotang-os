# 演示主线剧本系统记分卡（4 大神读码 · 2026-06-25）

> 评的是 weblyt「演示主线」= /present + /demo 演示系统：nvidia-main「NVIDIA估值研判·90秒·核心Wow Moment」+ 9 个支撑剧本。演示专属 rubric（Wow25/诚实20/可跑20/视觉15/剧本深度10/不夸大10）。
> **综合 ≈ 61 分**：能跑通、主线最亮，但**最精彩的并行戏埋在观众看不到的工位、诚实披露弱、皇冠视觉熄灯**。

## 4 维度分
| 维度 | 分 | 判词 |
|---|---|---|
| D1 主线 nvidia / Wow | 66 | 主线本身 95% polish、90秒节奏在，但**Wow 没落到观众真正看的那块屏** |
| D3 播放器/可跑性/视觉 | 63 | 引擎扎实(分层并行实现正确)、不断链，但**皇冠视觉未激活 + 播放控制虚标** |
| D4 诚实源标 | 60 | DEMO 标识机制在、不夸大红线守住，但**披露弱 + 源文档缺失** |
| D2 其余9剧本 | 52 | 覆盖宽但**深度断崖**（除主线全是内容稀薄骨架），广度替代深度 |

## 今天能不能对外路演？
**能跑通，但只有 nvidia 主线扛得住提问**，且带三个硬伤：
1. 🔴 **最精彩的戏埋错屏**：`demo-agent-matrix`（5部门依次激活+流文本+依赖箭头）只在 `/command-center` 渲染，**路演投屏的 `/present` 是静态翻幻灯**——并行戏剧性被砍掉。「观众看到的不是你最好的 demo，是它的影子」（Jobs）。
2. 🔴 **诚实披露弱 + 被问穿风险**：「6真4虚」只在源码注释观众看不到；`docs/demo-scripts/01-nvidia-main.md` + `DEMO-BIBLE.md` **整个不存在**（死链），被问"哪条是真数据"presenter 指不出处；DEMO 标识跳 /overview 后**不跟随**。
3. ⚠️ **9剧本只主线能演**：finance(55)/hr劳务(48)/compliance(58) 今天上台就是被问穿风险。

## 最大两个风险
- **诚实风险（HIGH）**：自称"6真4虚"却拿不出账（源文档全缺）、观众看不到披露、跳页掉 DEMO 标识——"自称诚实但拿不出账"（Deming：拿数据不靠口头）。
- **Wow 落空风险（HIGH）**：皇冠视觉（多stream打字/依赖流动线/时间轴）定义了但 `/present` 未激活，showcase 级打磨只交付一半。

## 满分条件
1. `/present` 主舞台复用 `demo-agent-matrix` 同款 5部门并行激活+流文本+依赖箭头，90秒内有明确"分→合"高潮节拍。
2. 多stream打字、依赖流动线、时间轴可视化在 `/present` 全部激活，达 showcase 级动画密度。
3. DEMO/PRESENTATION badge 全程跟随（跳 /overview 也在）、sourceLabel 上桌面不在角落，一张观众可见的"哪几条真/哪几条脚本"图替代源码注释。
4. 补齐 `docs/demo-scripts/` + `DEMO-BIBLE.md`，6真4虚逐条可溯源，被问"数据从哪来"当场指得出。
5. 至少 forecast/intel/health 三本补到主线级密度 + 支持速度调节；finance/hr劳务/compliance 砍出路演入口。
6. 演示明示"咨询多部门协同 vs 真实在线 3/6 部"边界，不让观众误判已满编。

## 最高杠杆改进（按 66→满分）
1. **🔴 把 DemoAgentMatrix 搬进 /present**（66→80 最高杠杆单点）：抽成共享组件，`/present/[id]/page.tsx` 播放态渲染它取代静态 departmentConclusions 幻灯——皇冠视觉必须在路演现场亮。+ 给 nvidia 插一个 3秒静默+单点聚焦的高潮帧（5路 agent 收束成一个判断的瞬间放大）。
2. **🔴 补 docs/demo-scripts/*.md + DEMO-BIBLE.md，去死链**：把注释里的"6真4虚"落成可溯源文档，并做一张**观众可见**的数据来源卡叠在 /present 一角。
3. **DEMO 源标全程 sticky**：跳 /overview 时随路由常驻不掉，sourceLabel 上移出角落。
4. **砍优先于补（张小龙）**：finance/hr劳务/compliance 三条从路演入口下架（代码留、入口隐藏，零成本止血）；集中把 forecast/intel/health 补到主线密度。
5. **播放器补真控制**：pause/resume + 段间 seek + 1×/2× 变速（现 cancel/restart ≠ pause），timeline 改可视化进度条。
6. **激活已定义未用的高级视觉**：STREAM_SNIPPETS 打字流 + 依赖流动线 + 时间轴 viz 在 /present 接活。

## 一句话
演示主线 **≈61 分**：骨架完整、主线 95% polish、能跑不崩，但**最抓人的 5部门并行矩阵藏在 /command-center、路演投屏的 /present 在放静态幻灯**，且"6真4虚"诚实声明的源文档全缺（被问穿露馅）。**单点最高杠杆 = 把 DemoAgentMatrix 搬上 /present 主舞台 + 补回溯源文档**——一招把"能播放"升级成"能征服观众且经得起提问"。Demo 的分不看代码里有什么，看那块大屏上观众眼睛里有没有光。
