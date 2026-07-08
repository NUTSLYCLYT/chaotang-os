# 史馆：朝堂能力建设档案

这里收录朝堂项目最近沉淀的 Claude/Codex 协作能力、开发协议、收口护栏和提效飞轮。目标是让每个下载用户不只是拿到代码，还能拿到一套可复用的开发方法。

## 下载用户先读顺序

1. `docs/shiguan/user_quickstart.md`
   先看怎么用：如何发任务、何时开钦天监、何时直接做、提交前怎么收口。

2. `docs/codex_capability_map.md`
   看能力边界：Codex 能做什么、不能做什么、什么必须人工签字。

3. `docs/chaotang_execution_protocol.md`
   看朝堂开发协议：直接做、先审查、开钦天监、只解释四种模式。

4. `docs/qintianjian.md`
   看重大决策前置机制：最多 3 个关键问题、两位大神给选项、用户可说“按推荐来”。

5. `docs/commit_closeout_template.md`
   看提交收口模板：目标、应提交、不应提交、验证、回滚。

6. `docs/shiguan/resource_profile_policy.md`
   看登录后资源如何装载：默认朝堂资源、混合模式、只用用户资源。

7. `docs/shiguan/examples.md`
   看 5 个可照抄的真实任务闭环。

## 可执行工具

```bash
# 判断一句任务该走什么模式
python scripts/chaotang_task_protocol.py "上线自动执行客户报价流程"

# 提交前分拣脏码
python scripts/commit_closeout_check.py

# 已 git add 后检查暂存区有没有混入运行产物
python scripts/commit_closeout_check.py --staged-only

# flow 静态结构校验
python scripts/validate_flows.py --skip-quality
```

登录后资源配置 API：

```bash
GET /api/resources/profile
POST /api/resources/profile {"mode": "hybrid"}
```

## 已归档能力

见 `docs/shiguan/capability_manifest.md`。

## 史馆原则

- 能力要能复用，不只服务一次会话。
- 规则要写进仓库，不靠人记忆。
- 高频错误要变成测试或脚本。
- 不可逆动作要有人类签字点。
- 下载用户看到的第一屏，应该告诉他“下一步怎么做”。
