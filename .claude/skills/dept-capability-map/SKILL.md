---
name: dept-capability-map
description: 一条命令盘点朝堂OS六部+专署的真实实现状态——哪些部门有真实后端引擎(real_department_engines.py)、哪些会退化到LLM人设兜底、路由关键词表(departments.yaml vs shangshufang_loop.py DEPARTMENT_RULES)是否同步、agent_design设计文档里有没有显式边界声明。直接读代码而不是读census文档的"声称状态"，census文档人工维护必然滞后于代码。当用户要"查部门现状"、"六部盘点"、"哪个部门是mock"、"更新census"、"部门能力图谱"、"路由关键词同不同步"时用这个技能，不要凭记忆或读旧文档回答，先跑脚本拿实时数据。
---

# 部门能力图谱

`census.md`、`mainline-absorption-review.md`这类文档是某次人工盘点的快照，写完当天就开始过时。这个技能不读文档，直接读代码，每次都是当前仓库的真实状态。

## 用法

```bash
python3 .claude/skills/dept-capability-map/scripts/audit.py
```

默认从脚本自身路径反推仓库根目录；如果不在标准位置运行，用 `--repo-root <path>` 指定。

## 输出解读

| 列 | 含义 |
| --- | --- |
| canonical状态 | `departments.yaml`里的`status`字段（active/pending）——pending说明这个部门在注册表里还没真正启用 |
| 真实引擎 | `real_department_engines.py::REAL_ENGINE_ADAPTERS`里挂的函数名；"无(None兜底)"说明这个部门的请求命中不了真实业务逻辑，会退化到LLM顶人设瞎答 |
| 路由关键词(yaml/rules) | `departments.yaml routing_keywords`条数 / `shangshufang_loop.py DEPARTMENT_RULES`条数——两边独立维护，不是同一份 |
| 关键词同步 | 两份关键词表的重叠程度："完全一致"最好；"部分重叠(n/m)"说明两表在漂移；"完全不重叠"说明两表在描述完全不同的匹配逻辑，是活跃的重复实现问题，不是历史遗留 |
| 边界声明 | 在`backend/agent_design/buildAgent/`里找该部门同名目录下`SOUL.md`/`IDENTITY.md`是否有"只做X不做Y"这类边界句（启发式正则，不是语义理解）。"缺"不代表这个部门真没有边界，只代表没在预期位置找到——比如吏部的边界句实际写在`搜索简历/IDENTITY.md`里（目录名不叫吏部），脚本会漏报，人工确认一下 |

## 已知局限（别把它当权威真理，当起点）

- 边界声明检测是正则启发式，目录名对不上就漏报（如上面吏部的例子）；`fasle negative`需要人工复核，不代表"缺"就一定真的没写边界。
- 只查了`agent_design/buildAgent/`一处设计文档源；如果部门边界写在别的地方（比如`SKILL.md`），脚本看不到。
- "真实引擎"只判断`REAL_ENGINE_ADAPTERS`里有没有注册函数，不判断这个函数实现质量好不好、有没有反幻觉门（比如`adapt_lipu`背后配了`lipu_vet`反幻觉门，`adapt_hubu`目前没有同等质量门，脚本不区分这层差异）。
- 不检测前端`real_department_engines`之外的mock（比如锦衣卫的`lead-radar`/`tender-radar`是前端本地假实现，这份脚本只看后端`REAL_ENGINE_ADAPTERS`，不扫`frontend/`，锦衣卫在这份报告里显示"有真实引擎"是准确的——但那是后端`adapt_jinyiwei`，跟前端雷达是两回事，别混为一谈）。

## 什么时候该重新跑

- 改了任何部门的路由关键词、真实引擎注册、或`departments.yaml`状态之后
- 写新的census文档之前——先跑这个，把实时结果当草稿，不要凭记忆写
- 怀疑某个部门"其实是mock"但不确定的时候
