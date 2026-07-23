+# /study 下旨栏：dev slot 视觉保真实施报告
+
+## 实施文件
+
+- `frontend/src/app/study/StudyClient.tsx`
+  - 移除近似 Dock 的外壳、顶部金线和“御前下旨 / 旨·预览”标签。
+  - 保留同一受控 textarea、`id`、测试标识、长度限制、禁用条件、`onChange` 与 `handleSubmitDecree`。
+  - 使用本地内联 SVG 卷轴图标；保留按钮的 `type`、测试标识、点击处理和禁用条件。
+- `frontend/src/app/study/study.module.css`
+  - 改为与 dev `placement="slot"` 一致的透明全宽 `flex` 行。
+  - 复用 slot 输入与按钮 token：32px 高、6px 间距、方角输入、金色焦点光晕、圆角金色按钮及禁用/hover 状态。
+- `frontend/src/app/study/StudyClient.test.ts`
+  - 先增加 slot token 与无 Dock 外壳的断言，确认 RED 后完成实现并转 GREEN。
+
+## 已运行验证
+
+在 `frontend/` 下执行，均通过：
+
+```text
+npm test -- --test-name-pattern="Study decree composer matches the dev slot input visual contract"
+npm run lint
+npm run typecheck
git diff --check -- frontend/src/app/study/StudyClient.tsx frontend/src/app/study/study.module.css frontend/src/app/study/StudyClient.test.ts
+```
+
+## 未解决问题
+
+无。未改动 BFF 下旨调用、认证、响应渲染、费用提示或任何 dev 中不属于 slot 视觉的功能。
