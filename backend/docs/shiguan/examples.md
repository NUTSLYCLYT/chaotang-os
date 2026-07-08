# 5 个真实任务示例

这些示例展示“发令 → 路由 → 实现 → 收口 → 推送”的工作方式。下载用户可以照抄。

## 1. 小修 bug

发令：

```text
按朝堂协议处理：修复 OPC 评分脚本标准号误判问题，补测试，最后收口。
```

推荐模式：

```bash
python scripts/chaotang_task_protocol.py "修复 OPC 评分脚本标准号误判问题，补测试"
```

期望流程：

1. 读相关脚本和测试。
2. 精确改动。
3. 补 pytest。
4. 跑 `python scripts/commit_closeout_check.py`。
5. 只提交相关文件。

## 2. 问题很乱，先审查

发令：

```text
按朝堂协议处理：现在工作区很乱，帮我判断哪些该提交、哪些不该提交。
```

推荐模式：先审查。

期望流程：

```bash
git status --short --branch
python scripts/commit_closeout_check.py
```

输出应区分：

- 应提交候选。
- 运行产物。
- 环境漂移。
- 质量基线。

## 3. 重大上线决策

发令：

```text
开钦天监：我们要上线自动执行客户报价流程，先帮我定关键问题。
```

推荐模式：开钦天监。

必须先定：

1. 哪些报价能自动出，哪些必须人工签字？
2. 客户资源使用朝堂默认、用户自有还是混合？
3. 如果模型输出没有来源，是否熔断？

## 4. 登录后资源选择

发令：

```text
按朝堂协议处理：用户登录后默认可用朝堂资源，但允许选择自己的资源。
```

推荐模式：先审查 → 直接做。

第一版实现：

```bash
GET /api/resources/profile
POST /api/resources/profile {"mode": "hybrid"}
```

红线：

- 不静默替换用户 provider。
- 不删除用户知识库。
- 不把用户私有资料写入公共史馆。

## 5. 沉淀一次新能力

发令：

```text
按朝堂协议处理：把这次经验写入史馆，方便下载用户复用。
```

推荐模式：直接做。

期望改动：

- 更新 `docs/shiguan/capability_manifest.md`
- 必要时新增 `docs/shiguan/*.md`
- 更新 README 或 AGENTS 入口
- 跑收口检查
