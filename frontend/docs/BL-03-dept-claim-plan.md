# BL-03 / BL-04 实施方案：JWT 下发 `department` claim（跨仓 · 待后端落地）

> 解锁三省/六部**精确**身份隔离（AUTHZ-LANE-03 / GOV-FSM-01 完整版）。
> 现状：后端 JWT 只有 `role: user|admin`，前端只能用"admin 可担任任一三省"的过渡期地板（accountType/role 闸门）。
> 本方案给出**后端可直接 apply 的补丁** + 前端消费侧（前端侧可独立、向后兼容地先就绪）。
>
> ⚠️ 后端 `jiqun_ai` 是运行中的系统，本环境无法测试它 → 后端补丁需后端团队 apply + 迁移 + 测试，故以方案形式给出，不擅自改运行后端。

## 1. 产品决策（先定）
- **dept 取值词表**：建议复用后端既有部门 slug（`finance/hr/legal/product/market/ops/intel/astronomer/physician/...` + 三省 `secretariat(中书)/chancellery(门下)/department(尚书)` + `throne(御座)`）。
- **user→dept 映射**：一个用户属于哪个省/部？是否多部门（`departments_json` 已存在，支持多值）。
- **admin 是否=御座**：admin 是否自动可担任 ruler，还是需 `department:'throne'`。

## 2. 后端补丁（jiqun_ai · 待后端 apply）

**(a) 迁移**：`alembic/versions/00X_user_department.py`
```python
def upgrade():
    op.add_column("users", sa.Column("department", sa.Text, nullable=False, server_default=""))
def downgrade():
    op.drop_column("users", "department")
```

**(b) `src/tenant.py · create_user`**：加 `department` 形参并写入
```python
def create_user(username, password, tenant_id, role="user", display_name="", department=""):
    ...
    "INSERT INTO users (username, password_hash, tenant_id, role, display_name, department) "
    "VALUES (?, ?, ?, ?, ?, ?)",
    (username, pw_hash, tenant_id, role, display_name, department),
```

**(c) `src/tenant.py · authenticate`**：SELECT 带 `u.department`，写进 JWT payload
```python
"SELECT u.id, u.username, u.password_hash, u.role, u.display_name, u.department, "
"t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug ..."
payload = {
    "user_id": row["id"], "username": row["username"],
    "tenant_slug": row["tenant_slug"], "role": row["role"],
    "department": row["department"],          # ← 新增
    "exp": exp,
}
```
（`exp` 仍是 ISO 字符串——前端 session-claims.isExpired 已兼容。）

## 3. 前端消费（chaotang-web-lyt · 可独立先就绪 · 向后兼容）

**(a) `src/lib/auth/session-claims.ts`**：`RawClaims`/`NormalizedSession` 加 `department?: string`；normalizeSession 透出 `department = c.department ?? null`。

**(b) `src/features/governance/lib/actor-context.ts`**：`SessionPayload` 加 `department?`；新增映射并在 `resolveActor` 优先用 dept claim：
```ts
const DEPT_TO_ACTORS: Record<string, Actor[]> = {
  secretariat: ['zhongshu'], chancellery: ['menxia'], department: ['shangshu'],
  throne: ['ruler', 'zhongshu', 'menxia', 'shangshu', 'liubu'],
  // 六部 → liubu
  finance: ['liubu'], hr: ['liubu'], legal: ['liubu'], product: ['liubu'],
  market: ['liubu'], ops: ['liubu'], /* ... */
};
// resolveActor 内：若 session.department 有值 → claimed 必须 ∈ DEPT_TO_ACTORS[dept]，否则降级 liubu。
//               无 department claim → 回退现有 role/accountType 地板（向后兼容，旧 token 不受影响）。
```
→ 这样**精确**判定"此会话属于哪一省"，替代"admin 可担任任一三省"的粗放地板。

## 4. 验收标准（AC）
- [ ] 至少一种登录路径产出含 `department` 的 token（CI 断言）。
- [ ] `department:'secretariat'` 的会话只能担任 `zhongshu`，声称 `menxia` → 降级 `liubu`（E2E，扩 `authz-downgrade.spec.ts`）。
- [ ] 无 `department` claim 的旧 token → 行为与今天完全一致（向后兼容回归）。
- [ ] `department:'throne'`（或 admin 按决策）→ 可担任 ruler 终审。
- [ ] tenant_slug 隔离（BL-07）不受影响。

## 5. 落地顺序
1. 产品定 dept 词表 + user→dept 映射。
2. 后端 apply §2（迁移 + 签发）→ 给若干账号设 department。
3. 前端 apply §3（已向后兼容，可先合，dept 到位即自动生效）。
4. 跑 §4 E2E。BL-04（accountType 死锁）随之彻底退场——授权全用 role+department claim。
