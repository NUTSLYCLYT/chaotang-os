# Chaotang Visual Asset Audit

## Design Decision

Do not bake Chinese labels or descriptions into generated images. Use image2 for clean no-text scene/portrait backgrounds, then render all names, roles, explanations, metrics, and captions in React overlays.

Reason: generated small Chinese text is unreliable, while UI text stays editable, responsive, accessible, and consistent across all departments.

## Actual Sizes In Use

| Asset Type | Current Size Pattern | Recommendation |
| --- | --- | --- |
| Department hero portraits | mixed: 1024x1024, 1536x1024, 1600x667, 1672x941 | standardize on 1672x941 |
| PRD full-page backgrounds | mostly 1672x941 | keep 1672x941 |
| Taiyi original PRD | 1448x1086 and 1672x941 variants | use 1672x941 for consistency |
| Scene strips | 1672x820 or 1672x861 | acceptable for embedded war-room/stage slots |
| Shiguan cards | 166x72 | keep as UI micro-assets or replace with CSS/icons later |
| Shangshufang portraits | 118-124px wide, 220-222px tall | keep only for current scene; future portraits should use hero system |

## Must Wire First

These images already exist and should be connected before generating more:

| Department | Person | File |
| --- | --- | --- |
| forecast | Zhang Heng | `forecast-zhang-heng.png` |
| study | Wang Yangming | `study-wang-yangming.png` |
| hanlin | Su Shi | `hanlin-su-shi.png` |
| bingbu | Sun Wu | `bingbu-sun-wu.png` |

## Newly Generated V5 Candidates

| Department | Person | File | Status |
| --- | --- | --- | --- |
| command-center | Zhuge Liang | `v5-command-center-zhuge-liang.png` | review candidate |
| manors | Su Qin | `v5-manors-su-qin.png` | review candidate |
| intel | Qi Jiguang | `v5-intel-qi-jiguang.png` | review candidate |
| reports | Ouyang Xiu | `v5-reports-ouyang-xiu.png` | review candidate |

Wei Zheng still needs a v5 regeneration attempt.

## Recommended Next image2 Batch

Priority 1:

- Wei Zheng for governance / 三省, 1672x941, no baked text.

Priority 2:

- Di Renjie for archive / 御巡台, 1672x941, no baked text.
- Li Shizhen for health / 太医院, 1672x941, no baked text.
- Ministers council scene for departments / 群臣, 1672x941, no baked text.

Priority 3:

- Unified full-page backgrounds for the 9 PRD spaces only after current page QA shows a visual mismatch.

## Text Overlay System

Every person should get the same overlay fields:

- `personaName`: large display name.
- `personaEra`: era/date line.
- `title`: department title.
- `meta`: one-line historical identity.
- `hookHtml`: current operational hook with one emphasized phrase.
- `roleSummary`: 1-2 sentence role explanation.
- `aiMandate`: how this historical persona maps to the AI/workflow department.
- `scores`: optional Romance-of-Three-Kingdoms-style stats.

Suggested stats:

- Strategy
- Execution
- Integrity
- Insight
- Risk Control
- Communication

## Animation Recommendation

Use code/CSS/motion for animation, not generated animated assets.

Keep:

- Slow image scale/parallax on hero hover or page entry.
- Gold seal pulse for live/attention states.
- Radar sweep for command/intel maps.
- Shimmer only for loading or active process states.
- Respect `prefers-reduced-motion`.

Avoid:

- Animated background videos for core pages.
- Constant particle effects behind dense dashboards.
- Text baked into images or animated image sprites.

## Visual Director Notes

The palace metaphor should organize authority and workflow: who sees, who judges, who signs, who executes, who archives. Decoration that does not clarify one of those jobs should be removed.

