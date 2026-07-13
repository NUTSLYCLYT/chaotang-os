# 单测计划

## 覆盖范围

- unit 均注册但 inactive、HTTP/端口全挂。
- unit inactive 但手动端点和端口健康。
- 两种场景均禁止 restart。

## 命令

- `node --test scripts/system-restore.nodetest.mjs`

## 未覆盖风险

- 不模拟正常模式的真实 systemd restart；该路径未改。
