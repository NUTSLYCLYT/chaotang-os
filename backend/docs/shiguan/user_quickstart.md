# 下载用户快速上手

这份手册给第一次下载朝堂项目的人。你不用先理解全部架构，先按下面的方式使用。

## 你可以怎样发任务

### 小修小改

```text
按朝堂协议处理：修复这个报错，补测试，最后收口。
```

系统应进入：直接做。

### 问题很乱

```text
按朝堂协议处理：现在开发效率低，先审查最该修哪里。
```

系统应进入：先审查。

### 重大决策

```text
开钦天监：我们要上线自动执行客户报价流程，先帮我定关键问题。
```

系统应进入：开钦天监。

### 学习概念

```text
只解释：小白给我讲一下 git 回滚、分支、脏码是什么意思。
```

系统应进入：只解释。

## 每次任务的默认闭环

```text
目标
→ 读现状
→ 定边界
→ 实现
→ 测试
→ 收口检查
→ 精确提交
→ 按需推送
→ 把新教训写回规则/测试/脚本
```

## 最常用命令

```bash
git status --short --branch
python scripts/chaotang_task_protocol.py "你的任务"
python scripts/commit_closeout_check.py
python scripts/commit_closeout_check.py --staged-only
python scripts/validate_flows.py --skip-quality
```

## 什么不要随便提交

- `config/providers.yaml`：本机模型/provider 选择。
- `data/`：运行数据库和运行产物。
- `memory/`、`events/`、`swarm_sessions/`：运行状态。
- `scripts/golden_cases/quality_baseline.json`：质量基线，必须单独评估后提交。
- `.env`：密钥和本机环境。

## 用户最省力的发令方式

```text
按朝堂协议处理，最后收口推送。
```

如果任务涉及上线、生产、客户承诺、报价、合同、自动执行、花钱 API 或架构分叉，系统应自动建议先开钦天监。

## 登录后资源怎么选

默认模式是 `chaotang_default`：直接使用朝堂协议、史馆、钦天监、默认蜂群和收口护栏。

如果你有自己的 provider、知识库或私有材料，推荐切到 `hybrid`：

```bash
POST /api/resources/profile
{"mode": "hybrid"}
```

如果你只想使用自己的资源，选择：

```bash
POST /api/resources/profile
{"mode": "user_own"}
```

朝堂不会静默替换你的资源。切换模式只保存偏好，不删除、不覆盖、不迁移你的文件。
