# 朝堂上线 + 监控 · 运维一页纸（照着跑，~10 分钟）

> 2026-06-24。目标:把已建好、全绿的 feat 分支推上公网 + 挂上御史监控。**这是"当前最优"的唯一动作。**
> 当前态(御史实测):prod `:3050` 与 jiqun `:8081` 现都 DOWN;LiteLLM `:4444` 活。feat 领先 master ~36 提交,全绿待发。

## ① 合 master（你来 · gh 开不了 gitee）
- 点链接建 PR → 合并:
  `https://gitee.com/msxn/chaotang-web-lyt/pull/new/msxn:feat/court-surfaces-real-business...msxn:master`
- 标题/正文见此前 PR 草稿(含交接清单)。或给 Claude 一把**有效 gitee token**(勾 `pull_requests`)代建,建完**立刻 revoke**。

## ② 设 prod env（运维 · 不设=安全墙在图纸上）
```bash
FENGQUN_AUTH=true                 # 不设→特权写入(下旨/sign-off/jiqun)在 prod 全 503 fail-closed
JIQUN_VERIFY_PATH=<后端 authed 端点>   # 验签门探针目标
NEXT_PUBLIC_API_MODE=real         # 不设→构建门拦 build(故意的)
```

## ③ 复活后端 + 前端（运维）
```bash
# jiqun 后端(现 down):按你的启动方式起(serve-dev.sh 等),确认 :8081 活
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8081/   # 期望非 000
# 朝堂 prod:合 master 后(prod-rebuild 已 master 守门)
cd /home/ubuntu/workspace/frontend/chaotang-web-lyt && pnpm prod:rebuild
# 配 Restart=always + http 存活告警(防"死了 30 小时没人知道")
```

## ④ 安全实测（你/运维 · 亲眼看见再宣布安全 · charity-majors）
```bash
# 伪造 alg:none admin token 打 /api/jiqun,必须看到 401/503(不是 200)
TOK=$(node -e "const b=s=>Buffer.from(JSON.stringify(s)).toString('base64url');console.log(b({alg:'none',typ:'JWT'})+'.'+b({sub:'admin',role:'admin',exp:9999999999})+'.')")
curl -s -o /dev/null -w '伪造token /api/jiqun -> %{http_code}\n' \
  -H "Cookie: courtos.access_token=$TOK" \
  http://127.0.0.1:3050/chaotang/api/jiqun/api/swarm/run   # 期望 401 或 503,绝不能 200
```

## ⑤ 挂御史监控（你 · 让"没人监控"那个洞闭上）
Hermes `/cron`(或 crontab)挂两条:
```cron
0 9 * * *   cd /home/ubuntu/workspace/frontend/chaotang-web-lyt && pnpm censor        # 每日朝报(退出码1=有恙→吵你)
0 */6 * * * bash /home/ubuntu/workspace/frontend/chaotang-web-lyt/scripts/chaotang-censor-watchdog.sh   # 看门狗(御史死了它喊)
```
> 上线后置 `CENSOR_PROD_EXPECTED=1`,prod 未起从🟡升🔴。深度审计随手跑 `pnpm censor:depts`(部门诚实矩阵)。

## ✅ 验收（全绿才算上线）
- [ ] PR 合入 master,CI 绿
- [ ] `pnpm censor` → prod `:3050` 🟢、jiqun `:8081` 🟢、诚实纠察全 🟢
- [ ] 伪造 token 打 `/api/jiqun` 实测 **401/503**(④)
- [ ] `app.mingshuoxny.com/chaotang` 真实用户能打开
- [ ] Hermes cron 两条已挂,收到第一条御史朝报

## ⏪ 紧急回滚
```bash
PROD_ALLOW_DETACHED=1 pnpm prod:rebuild   # 显式跳过 master 守门(留告警痕迹),回滚旧版
```

---
**做完这一页 = 朝堂从 NO-GO 跨到 GO-WITH-FIXES,产品安全活在公网 + 御史每天替你盯着。** 其余(记忆飞轮/skill 工具化/碰 mock 补真源/OpenClaw)按 ROADMAP 上线后渐进,需求拉动再接。
