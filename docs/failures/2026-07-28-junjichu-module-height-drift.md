## Summary

军机处桌面端三栏主模块的高度低于部级页面，且中央卷轴额外下移，导致案卷、卷轴与情报栏无法在同一基线对齐。

## Root Cause

军机处自行以 `clamp(400px, 45dvh, 540px)` 限制首行高度，并为中央模块设置了 `top: 26px`。部级页面的同类布局则为左右模块和中央卷轴统一设置 `580px` 最小高度。

## Prevention

军机处沿用部级三栏的桌面最小模块高度：首行、左右栏和统一卷轴均以 `580px` 为下限；窄屏布局显式取消该下限，保留内容自适应。

## Detection

`frontend/src/features/junjichu-visual/JunjichuScene.test.ts` 断言三栏和卷轴的 580px 约束及窄屏复位。每次修改军机处布局后运行 `node --test src/features/junjichu-visual/JunjichuScene.test.ts`；`node scripts/check_harness.mjs` 同时检查本记录的固定章节。

## Evidence

- [部级三栏高度规则](../../frontend/src/features/ministries-visual/ministries.module.css)
- [军机处三栏高度规则](../../frontend/src/features/junjichu-visual/JunjichuScene.module.css)
- [军机处回归测试](../../frontend/src/features/junjichu-visual/JunjichuScene.test.ts)
