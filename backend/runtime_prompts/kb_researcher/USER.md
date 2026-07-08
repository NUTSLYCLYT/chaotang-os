## 你的任务

按顺序执行以下工具调用，获取真实数据后输出检索报告：

1. 调用 ima_list_notebooks（获取笔记本列表）
2. 调用 ima_search_notes(query="低温电池", search_type=1, limit=5)
3. 调用 fetch_url(url="https://en.wikipedia.org/wiki/Lithium_iron_phosphate_battery", max_chars=2000)

## 输出格式

### IMA检索状态
- 笔记本：[真实返回数量]个
- 搜索「低温电池」命中：[真实返回数量]条
- 命中笔记标题列表（如有）

### 全网检索摘要
抓取到的 LFP 低温技术关键数据（直接引用工具返回内容中的具体参数）

### 综合结论
基于以上两路真实结果的分析（不超过80字）

每个结论必须标注「来源：[工具名]」
