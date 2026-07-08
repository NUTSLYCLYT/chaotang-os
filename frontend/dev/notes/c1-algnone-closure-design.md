# C1 闭合设计 ·「拒 alg:none 是擦门把手不是上锁」（5 大神一致）

> 2026-06-25 由 C1 闭合会审（Schneier/Karpathy/Munger/Bezos 完全一致）沉淀。连体 C3（已修 1aacd09），目标一个 PR + 一次渗透复验闭合。

## 0. 一句话（致命陷阱）
**拒 alg:none 只关红队 spec 那一扇门，没关 C1 那道门。** decode-only（auth-server.ts:33 / session-claims.ts 都只 `split('.')[1]` 取 payload、从不验第三段签名）的真漏洞是**"身份本身可伪造"**——攻击者把 header 换成 `alg:HS256` + 任意 user_id + 垃圾签名照样穿。**真闭合的唯一承重墙 = 所有写本地库的 court 特权端点在写库前统一接 `backendVerifyOrReject`（转 jiqun:8081 真验签）**；拒 alg:none + 结构校验只作便宜纵深卫生，绝不当闸。

## 1. 关键认知（4 大神戳破的）
- **拒 alg:none = 输入校验，不是验签**（读 header.alg + 断言三段结构，不取密钥不算签名不 import jose）→ **不违硬约束#1**（约束禁的是 Next 层密码学验签/JWKS，不禁读 header）。但**它是卫生不是锁**。
- **拒 alg:none 不真闭合**：现有红队 spec 只测 alg:none → 单加 decode 硬化就让它转绿 → **CI 亮绿但 CRITICAL 仍在洞里**（Deming：你测错了东西，绿灯买来假安心）。攻击者换 `alg:HS256`+垃圾签名+任意 user_id，decode-only 照样接受。
- **CSRF 挡不住 curl 伪造 cookie**：CSRF 只防浏览器跨站；攻击者 curl 自带伪造 token，SameSite/CSRF 一概不触发。路径 b（CSRF+幂等+租户）只能当纵深，**不能当替身，承重必须是路径 a（后端验签）**。

## 2. 真闭合（铁律1 路径 a：转后端真验签）
复用已存在已验证的 `src/lib/auth/backend-verify.ts:22 backendVerifyOrReject`（strict=FENGQUN_AUTH 转 token 给 jiqun:8081 真验签，401/403→拒，不可达→fail-closed 503）。
- **Next 层不持钥、不算签名、不 import jwtVerify，只发一次 authed 往返** → 满足硬约束#1；**守门人就在写库那道门**（铁律1：验签未过则一行写库都不发生）；后端真验签让 HS256 垃圾签名 token 被拒 → **真闭 C1**。
- **已接**：orchestrate（route/sign-off/all）+ study/outcome（4 个）。
- **缺口（系统性，grep 实证）**：`junjichu/review`（红队 spec 命中点）、`decision`、`draft-edict`、`tasks/[taskId]/decision`、`confirm-edict`、`edict-return`、`shiguan/archive`、`swarm-deepen` 等**凡 getUserIdFromSession 后直写 primary-store/court_archives 的本地路由都没接**。
- **接线姿势**（照 orchestrate）：route 第一行 `const reject = await backendVerifyOrReject(req); if (reject) return reject;` 放在 getUserIdFromSession 之后、写库/扇出之前。

## 3. 最易漏的真缝（Munger/2nd 评）—— 验一样信另一样
探针目前只证"持票人有张对 /study/briefing 有效的 token"，但**写库 + C3 owner 用的 user_id 仍取自 decode-only payload** → 攻击者可拿自己合法低权 token 过探针、却在 payload 冒 victim 的 user_id。
→ **让探针回传权威 user_id，强制写入与 C3 隔离消费权威 id，而非 decode-only id**。

## 4. C1+C3 连体（必须一个 PR）
C3 的 court_archives user_id+租户隔离全程读 decode-only userId；C1 一开，攻击者伪造 `user_id=victim`+`tenant_slug=victim-tenant`，C3 的 owner/tenant 过滤就乖乖把作用域锁到受害者身上=**零隔离**。
顺序：**先后端验签证明 token 真 → 其 payload userId（理想：探针回传的权威 id）才可信 → 在可信 userId 上做 C3 隔离=真隔离**。

## 5. 渗透复验（先写最强形态再修，Schneier）
- **红队A**（已有，升 strict）：伪造 alg:none + 任意 user_id 打 junjichu/review → 必 401。
- **红队B**（新增·更强）：伪造 `alg:HS256` + 垃圾第三段签名 + 任意 user_id 打 junjichu/review（及 decision/draft-edict/tasks-decision 各一）→ **必 401——只有后端真验签能让它绿**。**先让它现在就红**（漏洞最强形态钉成判据）。
- **C3 连体闭环**：后端验签通过后写入的 archive 带权威 user_id；以另一租户读同一 archive → 读不到。
- 两条 spec 须 **strict 模式**跑（FENGQUN_AUTH=true 指真验签后端，否则 dev 旁路假绿）。
- 全部 wire 进 **gate:daily 阻断门**。

## 6. grep 守卫（反孤儿安全门，Schneier 天才建议）
钉进 gate:daily：**任何 import primary-store / 写 court_archives 的 court route.ts 若未 import backendVerifyOrReject → CI 红**。把"忘记装锁"变成物理上无法合并——靠机器拦，非靠人记得。

## 7. dev 兜底（不开后门）
**不新开任何 skip-auth 开关**（那是后门）。沿用单闸 FENGQUN_AUTH：strict（生产）→后端验签是门，dev alg:none 自然进不来；非 strict（dev）→后端本就放行，跳探针、沿用 decode-only。fail-closed 已对（NODE_ENV=production 未设 FENGQUN_AUTH→503 CRITICAL；仅 CHAOTANG_ALLOW_INSECURE_AUTH=1 留痕逃生阀旁路）。decode 硬化同样按 NODE_ENV 仅生产恒拒，dev 不无条件硬拒（免误杀本地 token），**绝不为此加 alg:none 例外**。部署红线：CHAOTANG_ALLOW_INSECURE_AUTH 不得泄进生产。

## 8. 同事状态（连体前必读，避免对撞）
- `7aea0b4`（同事）给 court/junjichu/review + court/backend/command/dispatch 加了 **`requireSession`/`requireSessionUserId` own-auth**（decode-only 第二道门，挡无 cookie）。
- **但 own-auth 是 decode-only——挡得住无 cookie，挡不住伪造 cookie。** C1 的 backendVerifyOrReject 必须**叠在 own-auth 之上**（不是替代）。我做 C3 时已把 junjichu/review 升到 requireSessionUserId；C1 在此基础上加 backendVerifyOrReject。
- 接线顺序：`backendVerifyOrReject(req)`（验真）→ `requireSessionUserId()`（取身份）→ 写库（C3 隔离）。

## 9. Rollout
1. 先写红队B（HS256 垃圾签名）spec 确认现在就红（最强形态钉判据）。
2. decode 硬化（auth-server + session-claims 加 alg!=='none'+三段校验，按 NODE_ENV 仅生产恒拒）。
3. backendVerifyOrReject 接进全部未接的本地特权写门（getUserId 后、写库前）。
4. 探针回传权威 user_id；C3 隔离消费权威 id。
5. 两条红队 spec（strict）+ C3 闭环断言 + grep 守卫，全转绿 + wire gate:daily。
6. 独立会审（铁律4）：不在上下文的 reviewer 读真 diff，核端点覆盖穷尽（漏任一门=整个突破口）+ 探针 authz 强度≥写操作。
7. tsc + build 双门；dev（FENGQUN_AUTH≠true）冒烟确认本地登录未误杀。
8. 部署核对 FENGQUN_AUTH=true 已设、CHAOTANG_ALLOW_INSECURE_AUTH 未泄入生产。
