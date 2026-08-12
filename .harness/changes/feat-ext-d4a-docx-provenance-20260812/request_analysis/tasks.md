# 任务：feat-ext-d4a-docx-provenance-20260812

## 任务 1：规范 DOCX 文本面

- 目标：让上传安全扫描覆盖所有明确授权的 DOCX story。
- 前置条件：R0-W08 authority GO。
- 输入：已过 OOXML 结构检查的 DOCX bytes。
- 输出：稳定换行分隔的规范文本。
- 涉及文件：提取器、upload router、focused tests。
- 状态 / 数据变化：不新增持久化字段。
- 验证命令与证据：focused pytest + secure-ingest tests。
- 回滚边界：三个文件的本包 diff。
- 完成定义：正文、表格、页眉页脚、批注、删除修订均进入扫描面。
