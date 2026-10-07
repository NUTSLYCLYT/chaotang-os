# 回滚手册

## 原则

回滚是恢复到已核验的 Git tag 或提交，不是删除历史，也不在共享分支上强制改写历史。

## 本机恢复

```powershell
$repo = 'D:\CodexWorkspaces\chaotang-os'
git -C $repo fetch --tags origin
git -C $repo tag --verify v0.1.0
git -C $repo status --short
git -C $repo switch --detach v0.1.0
```

需要继续开发时，从恢复点创建短生命周期分支：

```powershell
git -C $repo switch -c fix/recover-v0.1.0
```

## 双端恢复

先在临时 clone 中验证目标提交，再通过 Pull Request 或 fast-forward 恢复。禁止：

- `git push --force` 或 `--force-with-lease` 到共享分支；
- 直接删除 Gitee/GitHub 的历史分支；
- 在资源仓或测试副本中执行恢复。

## 证据

恢复后必须核对：`git rev-parse HEAD`、前端构建、后端测试、工作区状态，以及 Gitee/GitHub 提交号。
