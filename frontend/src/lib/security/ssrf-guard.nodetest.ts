import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedIp, assertPublicHost, SsrfBlockedError } from './ssrf-guard';

test('isBlockedIp: IPv4 private/reserved/metadata ranges are blocked', () => {
  const blocked = [
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254', // cloud metadata
    '100.64.0.1', // CGNAT
    '224.0.0.1', // multicast
    '240.0.0.1', // reserved
    '198.18.0.1', // benchmarking
  ];
  for (const ip of blocked) {
    assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
  }
});

test('isBlockedIp: IPv4 public addresses are allowed', () => {
  const allowed = ['8.8.8.8', '1.1.1.1', '93.184.216.34'];
  for (const ip of allowed) {
    assert.equal(isBlockedIp(ip), false, `${ip} should be allowed`);
  }
});

test('isBlockedIp: IPv6 loopback/ULA/link-local/multicast are blocked', () => {
  const blocked = ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1'];
  for (const ip of blocked) {
    assert.equal(isBlockedIp(ip), true, `${ip} should be blocked`);
  }
});

test('isBlockedIp: IPv4-mapped IPv6 addresses are checked against the embedded IPv4', () => {
  assert.equal(isBlockedIp('::ffff:169.254.169.254'), true);
  assert.equal(isBlockedIp('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIp('::ffff:8.8.8.8'), false);
});

test('isBlockedIp: public IPv6 address is allowed', () => {
  assert.equal(isBlockedIp('2001:4860:4860::8888'), false); // google public dns
});

test('isBlockedIp: unrecognized strings are blocked (fail closed)', () => {
  assert.equal(isBlockedIp('not-an-ip'), true);
  assert.equal(isBlockedIp(''), true);
});

test('assertPublicHost: rejects loopback/metadata/localhost without a DNS round-trip', async () => {
  await assert.rejects(() => assertPublicHost('127.0.0.1'), SsrfBlockedError);
  await assert.rejects(() => assertPublicHost('169.254.169.254'), SsrfBlockedError);
  await assert.rejects(() => assertPublicHost('localhost'), SsrfBlockedError);
  await assert.rejects(() => assertPublicHost(''), SsrfBlockedError);
});

test('assertPublicHost: accepts a public literal IP without throwing', async () => {
  await assert.doesNotReject(() => assertPublicHost('8.8.8.8'));
});
