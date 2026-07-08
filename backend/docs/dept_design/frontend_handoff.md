# 前端交接:court_doc → 卷宗渲染(人类面)

> 给前端仓 `chaotang-web-lyt`。后端只产 **court_doc(机器面 JSON,`schemas/court_doc.json`)**;
> 把它画成**卷宗×现代**那张脸(人类面)是前端的活。本文是渲染契约,不在后端实现 UI。

## 一、数据来源(后端已就绪)

- 契约:`schemas/court_doc.json`(单一聚合标准,11 部门通用)。
- 已出真 court_doc 的部门(L1):刑部 `xingbu_verdict.build_verdict`、工部 `gongbu_review_verdict`、户部 `hubu_memorial_verdict`。
- 其余 8 部门 L0(设计就绪,接 `court_doc_builder.build_court_doc(<dept>, ...)` 即出)。

## 二、court_doc 字段 → 卷宗视觉映射

| 字段 | 渲染成 |
|---|---|
| `dept` + `seal.stamp`/`seal.color` | 右上**官印**(部门专属:天平印/算盘印/规矩印…)+ 主色调 |
| `light`(green/yellow/red/black) | 顶部**红黄绿黑灯**+ 整卡边框色 |
| `headline` | 一级**结论**(楷体大字,人话在前) |
| `shielded` | "本部门为你挡了/争取了"心意条(高亮小字) |
| `items[]`(level/title/odds/impact/fix) | **Top 列表**,渐进展开;红项置顶,impact/赔率右对齐,fix 折叠在二级 |
| `adversarial` | "红蓝对抗"小标签(谁攻、最弱口) |
| `provenance.grounding`(rag/deterministic/none) | 落款标"法条接地/重算接地/**未接地·需人工**"(none→灰条警示) |
| `provenance.gate`(pending) | gate=pending → 整卡盖"**需人工复核**"半透印,禁绿 |
| `actions[]` | 底部按钮(一键改/开庭/存证/确认开工) |
| `seal.sealed_archive` | **骑缝朱印**+ 史馆封存号(护身符具象) |
| `signed` | false → "未签字"水印;不可逆动作禁执行 |

## 三、印章品牌系统(11 部门视觉身份)

见 [README.md](README.md) 表:刑部 天平印·朱砂红 / 户部 算盘印·金 / 礼部 礼器印·青 /
兵部 令旗印·赤橙 / 工部 规矩印·钢蓝 / 吏部 印绶印·紫 / 钦天监 星盘印·靛蓝 /
史馆 史笔印·墨 / 锦衣卫 绣春刀印·玄黑暗红 / 御史 獬豸印·黑金 / 丞相 相印·朱紫。
**统一骨架,各部门换印换色** —— 一套卷宗组件 + 印章/主色配置驱动,别为每部门写一套。

## 四、必须守的渲染纪律(接后端宪法)

1. `gate=pending` / `grounding=none` → **绝不渲染成绿灯/通过**(对应宪法 C6 禁假 PASS),要显式"需人工"。
2. 丞相主线(doc_type=edict)里各部门灯**照搬不改**(对应 C8);前端不得自行"美化"成更乐观。
3. `signed=false` 的不可逆动作按钮置灰,必须人工签字态才可点。
4. 法条/数据细节默认折叠(二级),一屏先给结论 —— 决策不是知识。

## 五、建议交付顺序(前端)

先做一个**通用卷宗组件**(吃 court_doc → 渲染),用刑部判决跑通;再配 11 部门印章/主色;最后接各部门 API。
后端这边其余 8 部门按需补 `build_<dept>_*` 薄包装即可供数。
