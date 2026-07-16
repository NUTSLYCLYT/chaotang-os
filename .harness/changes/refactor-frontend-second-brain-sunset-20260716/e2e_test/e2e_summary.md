# E2E summary

PASS。fixture 案号 `task_p4_browser_smoke_001` 在军机处显示 `LIVE_SWARM`、户部/工部两条明确意见、
1 项缺证、质量门阻断与不可采纳；点击“补证”后页面显示“补证已提交”。未使用旧本地裁决引擎。

本项是 frontend canonical projection 冒烟，不是 backend 蜂群质量证明。已提交的可复核证据位于
`artifacts/`：canonical/decision fixture、阻断态与提交态截图、干净 Playwright `trace.zip`、运行命令、
请求状态、SHA-256 和 Gongbu/Xingbu SHADOW 条款结果见 `artifacts/runtime.md`。trace 中保留未 mock
接口的 401；它们没有被用来生成正式投影。
