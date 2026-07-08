# 司档案 + 能力块契约(前端渲染真相源)

> 后端源:`src/si_profile.build_si_profile` + `src/capability_scoring`。前端在 chaotang-web-lyt 据此渲染司级二级页。
> 锁字段语义(api-and-interface-design):**空态/小样本由后端标记,前端只按标记渲染,不自行判断。**

## 一、司档案结构(GET /api/dept/{code}/si/{si}/profile)

```jsonc
{
  "identity":   { "dept": "hubu", "si": "accounting", "name": "会计司", "duty": "账务核算…" },
  "resume":     { "since": null, "case_count": 0, "recent": [], "highlight": {...}, "note": "…" },
  "capability": { "scored": false, "sample": 0, "confidence": {...}, "metrics": {}, "radar": [] },
  "contribution": { "memorials": 0, "escalations_resolved": 0, "value_note": "…" }
}
```

## 二、capability 能力块 —— 前端必须按 `scored` 分支渲染

| 字段 | 语义 | 前端规则 |
|---|---|---|
| `scored` | 是否有足够样本打分 | **false → 不渲染雷达图**,显示 `confidence.note` 的空态文案 |
| `sample` | 参与打分的案例数 | 始终显示"基于 N 例" |
| `confidence.level` | `无`/`不足`/`参考`/`足` | 徽章:无/不足=灰,参考=黄"仅供参考",足=正常 |
| `confidence.note` | 人话说明 | scored=false 或 level=参考 时展示 |
| `metrics` | 接地率/结论通过/少返工(0-1) | scored=false 时为 `{}`,不渲染 |
| `radar` | `[{axis,score0-10}]` | scored=false 时为 `[]`,不渲染雷达 |

**红线(禁假)**:`scored=false` 时 `radar`/`metrics` 恒空——**前端不得用 0 分或占位数据画雷达**,
否则把"没数据"渲染成"能力为0",是造假。`level=参考`(样本<5)时**必须显示"仅供参考"徽章**,
别让 3 个案例的满分雷达冒充权威(deming 小样本护栏)。

## 三、resume.highlight 故事卡(张小龙)

```jsonc
"highlight": {
  "win":     { "case_id": "c1", "title": "…", "verdict": "PASS", "date": "…" } | null,
  "stumble": { "case_id": "c2", "title": "…", "verdict": "驳回", "date": "…" } | null
}
```

**一好一坏两张卡**:最近一次立功 + 最近一次翻车。比六个百分比更让部门负责人记住这个司是谁。
任一为 `null` → 该卡不渲染(如新司只有立功没翻车)。

## 四、司列表(GET /api/dept/{code}/si)

返回 `[{code,name,duty}]`,供司级导航。数据源 `config/si_registry.yaml`,登记即生效。

## 五、同一把尺(大神 eval 也用)

`capability` 的 `scored/sample/confidence` 语义与大神 `promotion_gate.confidence` **同源**
(都调 `src/capability_scoring.sample_confidence`)。前端若同时渲染大神档案与司档案,**同一套徽章逻辑复用**,不必两套。
