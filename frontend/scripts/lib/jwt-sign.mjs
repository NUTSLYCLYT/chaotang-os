import crypto from 'node:crypto';

/**
 * 生成后端 src/tenant.verify_token 可验过的真 HS256 token,
 * 替代旧的 alg:none dev token(FENGQUN_AUTH=true 上膛后 alg:none 会被拒)。
 *
 * 与后端 _jwt_decode 校验一致:sig = HMAC-SHA256(FENGQUN_JWT_SECRET, `${header}.${body}`),
 * base64url 无填充。gate 运行环境须与后端共用同一 FENGQUN_JWT_SECRET(同 .env)。
 *
 * 故意不带 exp:后端 `datetime.fromisoformat(exp) < datetime.now()` 比的是 naive 本地时间,
 * 传 unix int 或 tz-aware 'Z' 字符串都会抛错→token 被判无效。CI 临时 token 无需过期,
 * 省掉这个格式陷阱(无 exp 时后端跳过过期校验)。
 */
const JWT_SECRET = process.env.FENGQUN_JWT_SECRET ?? 'fengqun-dev-secret-change-me';

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

export function signGateToken(payload) {
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const body = b64urlJson(payload);
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
