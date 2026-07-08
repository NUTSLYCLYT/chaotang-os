# Commit Closeout Template

每次提交前或任务收尾时，按这 5 项检查。不要追求长，追求可判断、可回滚。

提交前先跑：

```bash
python scripts/commit_closeout_check.py
```

如果已经 `git add` 了文件，再跑：

```bash
python scripts/commit_closeout_check.py --staged-only
```

红灯时先把高风险文件从暂存区移出，不要继续 commit。

## 1. 目标

本轮要解决的问题：

-

不做的事：

-

## 2. 应提交文件

这些文件属于本轮目标，建议进入 commit：

-

建议提交信息：

```text

```

## 3. 不应提交文件

这些 dirty files 暂不进入本轮 commit：

-

原因：

- 运行产物 / 环境漂移 / 无关用户改动 / 临时实验

## 4. 验证命令

已执行：

```bash

```

未执行及原因：

-

## 5. 回滚方式

如果本轮改动要撤销：

- 未提交前：只 restore 本轮文件，不动无关 dirty files。
- 已提交后：优先 `git revert <commit>`，不要直接改历史。

本轮关键回滚文件：

-
