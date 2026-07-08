# 礼部常驻创意技能池

日期：2026-06-19

## 常驻 Skills

| Skill | 礼部岗位 | 触发场景 |
|---|---|---|
| `vam-character-master` | VaM 成人角色总监 | 成人角色 preset、形象资产、服化道、镜头姿态 |
| `ai-video-pro-system` | 短视频流水线导演 | 从选题到 Hero Frame、生成、剪辑、发布复盘 |
| `seedance-cinematic` | 电影感分镜提示词 | 4-15 秒电影感短视频 prompt |
| `imagegen` | 朝堂视觉主图工房 | hero 图、海报、关键帧、封面 |
| `frontend-design` | 页面重构设计师 | 页面结构、视觉层级、响应式体验重做 |
| `ui-ux-pro-max` | UI/UX 发布审查官 | P0/P1/P2 问题、可用性、无障碍、发布门禁 |

## VaM 成人角色 Preset 方案

名称：`LiBu_CinematicHost_Adult_01`

定位：成年东方电影感主持人/礼部传播官，用于品牌视频、朝堂系统导览、角色海报和 VaM 场景预演。年龄设定 25+，不做未成年、校园、幼态化表达。

外观方案：
- 体态：自然写实比例，中等身高，肩颈舒展，姿态偏专业主持。
- 面部：柔和颧骨、清晰下颌、自然唇色、轻微眼下阴影，避免过度磨皮。
- 皮肤：暖中性肤色，细腻但保留毛孔和微瑕疵。
- 发型：黑色低束发或半束发，适合中式礼仪与科技朝堂场景。
- 服装：深墨色现代礼服外套，帝金细边，青蓝内衬；不做暴露导向。
- 灯光：主光 35 度暖金，侧逆光青蓝，背景低亮度宫灯。
- Pose：站立迎宾、侧身看屏、手持卷轴、操作数据台四组。

验收清单：
- VaM GUI 中截图确认 morph、skin、hair、clothing、pose 都真实加载。
- preset 依赖插件和资源包列明版本。
- 不把未验证截图或生成图冒充 VaM 实机结果。

## 短视频生产流水线

目标：为朝堂系统生产 15-45 秒短视频，兼容官网 hero、抖音/B 站/小红书切片、销售演示。

1. Brief
   - Model：Seedance/Higgsfield 负责视频生成，imagegen 负责 Hero Frame。
   - Camera：先定 1 个主镜头语言，避免每条视频风格漂移。
   - Subject：朝堂 AI 决策台、六部数据屏、礼部主持人、用户下旨流程。
   - Look：帝金、墨黑、青蓝 HUD，中式宫殿和现代操作系统结合。
   - Action：2 秒内出现“用户问题进入朝堂系统”的强钩子。

2. Hero Frame Lock
   - 先生成 1 张 16:9 主视觉。
   - 通过后再拆视频镜头，禁止先批量生成视频再回头找风格。

3. 镜头生产
   - A 版：系统宏观展示，适合官网。
   - B 版：用户问题到决策结果，适合转化。
   - C 版：六部协同与证据链，适合产品讲解。

4. 后期
   - 字幕只写事实，不写夸张 ROI。
   - 音乐用低频鼓点 + 古琴/编钟颗粒，音效保持克制。
   - 结尾落到一个明确 CTA：进入上书房、查看军机处会审、打开礼部传播台。

5. 复盘指标
   - 2 秒留存、完播率、点击率、评论中的疑虑主题、是否引发误解。

## Seedance 电影感 Prompt

### Prompt 1：朝堂系统开场

```
@material: 朝堂系统 hero frame
Duration 8s, cinematic 16:9, 720p.
Hook in first 2 seconds: a business question appears as a glowing imperial decree and drops into a dark jade decision console.
Camera: slow dolly-in from the palace floor toward the central AI throne console, slight parallax across six ministry data screens.
Subject: Chinese imperial digital court operating system, no people, six ceremonial data tablets, central decision table.
Lighting: warm imperial gold beam from ceiling, cool teal data glow from screens, controlled haze.
Color: ink black, dark jade, imperial gold, restrained cyan.
Motion: data lines converge into one verdict seal, screens wake up one by one.
Audio: deep ceremonial drum, subtle UI pulse, low cinematic rise.
```

### Prompt 2：礼部传播台

```
@material: LiBu_CinematicHost_Adult_01 reference, 朝堂礼部页面 screenshot
Duration 10s, cinematic product demo style.
Hook in first 2 seconds: the phrase "品牌风险上升" appears as a red pulse on a ceremonial screen, then the LiBu host turns toward a glowing strategy board.
Camera: medium shot to over-the-shoulder move, ending on a three-column campaign board.
Subject: adult LiBu communications officer in modern dark ceremonial outfit, brand health dashboard, campaign cards, sentiment alerts.
Lighting: soft warm key light on face, teal rim light from data panels, red alert accent.
Color: dark court interior, gold details, teal UI, small red risk highlights.
Motion: host raises a hand, three campaign paths fan out, one path becomes highlighted.
Audio: quiet room tone, brush-on-paper transition, restrained notification hit.
```

### Prompt 3：六部协同裁决

```
@material: 朝堂系统 hero frame
Duration 12s, cinematic orchestration sequence.
Hook in first 2 seconds: six ministry seals ignite around a single user request, each seal sends a different colored evidence stream.
Camera: top-down orbit over the decision console, then rapid controlled push into the final verdict panel.
Subject: AI court decision operating system, six ministries represented by luminous seals and data streams, evidence chain visible as scroll-like UI.
Lighting: gold overhead seal light, teal analytical glow, amber warning glints.
Color: balanced imperial gold, ink black, muted blue-green, small warning amber.
Motion: evidence streams merge, risk gate closes, final decree stamp lands with a light shockwave.
Audio: layered ceremonial percussion, soft data chimes, final stamp impact.
```

## Hero 图 Prompt

```
Wide cinematic hero image for a Chinese imperial court AI operating system, grand digital throne hall with a central decision console, six ministry data screens arranged like ceremonial tablets, subtle golden imperial light beams, dark jade and ink-black architecture, refined cybernetic HUD lines, high-end product website background, no text, no logo, no people, elegant, realistic concept art, 16:9 composition, sharp foreground, atmospheric depth, imperial gold accents balanced with teal-blue data glow.
```

## UI/UX 审查结论

已修：展开 Dock 后同时出现展开面板输入框和底部折叠条输入框，用户会不确定该在哪个输入。现在展开态隐藏底部输入，保留展开面板唯一输入。

已修：礼部常驻技能 quick prompts 很长，移动端横向滚动会难扫。现在 UI 只显示短标签，完整 prompt 存在按钮 `title` 和点击 payload 中。

已修：常驻技能池当前只在无选中战役时展示。现在选中战役后保留窄版“礼部工房”入口，避免用户在战役上下文里找不到视频/视觉工具。

剩余 P2：页面右侧裁决台空态很稳定，但缺少“下一步动作”。可加一个低噪声按钮：`生成传播素材包`，直接调用常驻技能池。
