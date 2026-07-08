/**
 * SSRF 防护 —— 校验 fetch 目标不落在内网/回环/链路本地/云元数据/保留地址段。
 *
 * 2026-07-03 对抗复审抓到 `/api/libu/ingest` 零 IP 校验(能读回 127.0.0.1、
 * 169.254.169.254 等内网/元数据内容并回传给调用者)。本模块在 DNS 解析后按
 * 解析出的真实 IP 校验(而非仅校验 hostname 字符串),并对重定向逐跳重新校验,
 * 避免"首跳放行、重定向到内网"绕过。
 */

import { promises as dns } from 'node:dns';
import net from 'node:net';

const IPV4_BLOCKED_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const target = ipv4ToInt(ip);
  return IPV4_BLOCKED_RANGES.some(([base, bits]) => {
    const baseInt = ipv4ToInt(base);
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (target & mask) === (baseInt & mask);
  });
}

function firstHextet(ip: string): number {
  const first = ip.split(':')[0];
  return first === '' ? 0 : parseInt(first, 16);
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (lower === '::1' || lower === '::') return true;
  const first = firstHextet(lower);
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 ULA
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 link-local
  if (first >= 0xff00 && first <= 0xffff) return true; // ff00::/8 multicast
  return false;
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedIPv4(ip);
  if (family === 6) return isBlockedIPv6(ip);
  return true; // 不认识的格式一律当危险处理
}

export class SsrfBlockedError extends Error {}

/** 解析 hostname 到全部 IP 并逐个校验;命中内网/保留段抛 SsrfBlockedError。 */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (!hostname || hostname.toLowerCase() === 'localhost') {
    throw new SsrfBlockedError(`blocked host: ${hostname || '(empty)'}`);
  }

  const ipFamily = net.isIP(hostname);
  const addresses =
    ipFamily > 0
      ? [hostname]
      : (await dns.lookup(hostname, { all: true, verbatim: true })).map((r) => r.address);

  if (addresses.length === 0) {
    throw new SsrfBlockedError(`DNS resolution failed for ${hostname}`);
  }

  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new SsrfBlockedError(`blocked internal/reserved address: ${hostname} -> ${addr}`);
    }
  }
}

/**
 * 校验 + fetch 的合体:每一跳重定向都重新解析校验目标 host,不信任首跳通过后
 * 就自动跟随 fetch 默认的 redirect 行为(那样会跳过后续校验)。
 */
export async function safeFetch(
  urlStr: string,
  init: RequestInit = {},
  maxRedirects = 3,
): Promise<Response> {
  let current = new URL(urlStr);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!['http:', 'https:'].includes(current.protocol)) {
      throw new SsrfBlockedError(`only http(s) allowed, got ${current.protocol}`);
    }
    await assertPublicHost(current.hostname);

    const res = await fetch(current, { ...init, redirect: 'manual' });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (!location) {
        throw new SsrfBlockedError('redirect response without Location header');
      }
      current = new URL(location, current);
      continue;
    }

    return res;
  }

  throw new SsrfBlockedError(`too many redirects (> ${maxRedirects})`);
}
