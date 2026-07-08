# 动作契约 — court_doc 按钮的统一后端(前后端唯一真相源)

> 后端源:`src/court_action.dispatch` + `web/routers/court.py`。前端在 chaotang-web-lyt 据此接所有按钮。
> 钦天监 2026-07-02 签字:**统一端点 + 全闸(auth+C2+二次确认)+ 状态机**。
> 新增部门按钮先改这里 + `src/court_action._ACTIONS`,别再散到各 router(避免漂移成 11 套)。

## 一、统一端点

```
POST /api/court/action        (需登录)
body: { "doc": <court_doc>, "action": "apply_fixes", "confirm": false, "idempotency_key": "uuid?" }
```

前端**直接把手里的 court_doc 传回** + 要执行的 `action` 动词(就是 court_doc.actions 里的那个)。
不用记 11 部门×N 按钮的 URL——一个端点认所有动词。

### 响应(统一信封 {success,data,error})
| data.status | 含义 | 前端 |
|---|---|---|
| `ok` | 执行成功 | 用 `data.new_state` 刷新按钮状态机 |
| `needs_confirm` | 不可逆动作待二次确认 | 弹确认框,用户确认后带 `confirm:true` 重发 |
| (success=false) | 被闸拒 | 看 `data.code`(见下)+ `error` 文案 |

### 拒绝码 data.code
- `unknown_action` — 动词不认识
- `not_allowed_here` — 该动词不在这份 court_doc 的按钮白名单(越权)
- `forbidden_gatekeeper` — 放行类动作(release/block_escalate)需御史/harness,当前身份无权(C2)
- `idempotent_in_flight` — 同一个 `idempotency_key` 的上一次请求还没跑完(极短暂,通常是网络重试/用户手抖双击撞上了正在处理的那一下)。
  **前端别当报错弹窗**,按钮继续转圈或提示"处理中,请稍候",几百毫秒后用同一个 `idempotency_key` 重发即可拿到 `idempotent_replay:true` 的最终结果——不要换新 key 重发,换 key 等于绕开幂等,可能真的双跑。

## 二、四道全闸(后端强制,前端别自己判)
1. **合法性**:action 必须在 `doc.actions` 里。
2. **C2 权限**:`release`/`block_escalate` 只有把关人(yushi/harness…)能发;**actor_role 取自登录身份,前端传 role 无效**(schneier 红线)。
3. **不可逆二次确认**:`escalate_court`/`archive_amulet`/`export_amulet`/`release`/`confirm_appointment` 等,首次返回 `needs_confirm`。
4. **幂等**:带 `idempotency_key`,同 key 重发返回上次结果(`idempotent_replay:true`),防误点/重试双发。

## 三、状态机(建议③,前端据 new_state 灰化/高亮)
`草拟 → 待审 → {已准奏 | 已驳回 | 已升阶 | 已归档}`
读类动作(`trace_evidence`/`feed_flywheel`/`verify_source`/`reorder`)不改状态。

## 四、动作全表(与 src/court_action._ACTIONS 同步)
| action | 标签 | 不可逆 | 把关人限 | 转移到 |
|---|---|---|---|---|
| apply_fixes | 采纳修改 | | | 待审 |
| approve_preview / adopt_copy / take_next_action / confirm_start | 准奏类 | | | 已准奏 |
| confirm_appointment | 确认任命 | ✓ | | 已准奏 |
| run_release_gate | 跑发布门禁 | | | 待审 |
| escalate_court | 呈丞相/皇帝 | ✓ | | 已升阶 |
| archive_amulet / export_amulet | 归档/导出 | ✓ | | 已归档 |
| release | 放行 | ✓ | ✓ | 已准奏 |
| block_escalate | 拦截升阶 | ✓ | ✓ | 已升阶 |
| trace_evidence / feed_flywheel / verify_source / reorder | 读/侧动作 | | | 不变 |

## 五、司级二级页(洞②)
- `GET /api/court/si/{dept}` → 司列表(导航)
- `GET /api/court/si/{dept}/{si}` → 司档案(履历/能力/贡献),字段语义见 `si_profile_contract.md`

## 六、进来第一眼(pending action,张小龙:用户不用猜"我该干嘛")
```
GET /api/court/pending?dept=&si=     (需登录,dept/si 可选,缩到该部门/司)
```
响应 `data`:
| 字段 | 含义 | 前端 |
|---|---|---|
| `has_pending` | 有没有待决事项 | false → 显示"此刻无待决事项 ✅",别放空白 |
| `count` | 待决总数 | 角标数字 |
| `top` | 最该决的一件(严重度降序、同级最久未动优先) | 首屏卡片 |
| `top.waiting_since` | 进入待决的原始时间戳(ISO) | 需要精确时间才用 |
| `top.waiting_hint` | 人话版"已等待 X 分钟/小时/天" | **直接展示这个,别自己拿 waiting_since 算**——后端已经算好格式,前端重复解析容易和后端口径不一致。**只做"已等待多久",没有"预计还要多久"**:没有历史处置时长数据支撑预测,后端故意不编这个数字(和判决"未接地不冒充权威"同一个原则),前端也别自己脑补一个 ETA 顶上去 |
| `message` | 一句话文案,可直接展示 | 首屏一句话 |
