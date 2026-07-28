# 大殿人物卡片错误使用中心锚点

## Summary

用户要求大殿席位卡片位于背景人物头顶。首次调整仅将卡片中心移动到估算位置，截图显示卡片与人头仍未稳定对齐。

## Root Cause

热点数据的 `x`、`y` 被当作卡片中心坐标，CSS 也使用 `translate(-50%, -50%)`。卡片高度和指示箭头高度因此混入每个人工坐标估算，无法把箭头稳定地落到人物头顶。

## Prevention

视觉标注数据必须表达被标注对象的锚点，而不是标注卡片的中心。由 CSS 统一处理卡片相对锚点的位置与箭头偏移。

## Detection

`DadianScene.test.ts` 同时断言九个人物头顶锚点坐标，以及 `.hotspot` 使用向上展开的 transform；桌面截图验收时，确认每个箭头尖端落在对应人物头顶。

## Evidence

- `frontend/src/features/dadian-visual/DadianScene.tsx`
- `frontend/src/features/dadian-visual/DadianScene.module.css`
- `frontend/src/features/dadian-visual/DadianScene.test.ts`
