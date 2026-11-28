import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  checkLoginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit
} from '../api/_auth.js';

test('verifyPassword validates configured APP_PASSWORD with constant-time comparison', () => {
  const prevPass = process.env.APP_PASSWORD;
  const prevBackend = process.env.BACKEND_PASSWORD;
  try {
    delete process.env.APP_PASSWORD;
    delete process.env.BACKEND_PASSWORD;
    assert.deepEqual(verifyPassword('anything'), { ok: false, misconfigured: true });

    process.env.APP_PASSWORD = 'super-secret-test-pass';
    assert.deepEqual(verifyPassword('super-secret-test-pass'), { ok: true, misconfigured: false });
    assert.deepEqual(verifyPassword('wrong-pass'), { ok: false, misconfigured: false });
    assert.deepEqual(verifyPassword(''), { ok: false, misconfigured: false });
  } finally {
    if (prevPass === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = prevPass;
    if (prevBackend === undefined) delete process.env.BACKEND_PASSWORD;
    else process.env.BACKEND_PASSWORD = prevBackend;
  }
});

test('createSessionToken and verifySessionToken reject tampered tokens', () => {
  const prevSecret = process.env.SESSION_SECRET;
  const prevPass = process.env.APP_PASSWORD;
  try {
    process.env.APP_PASSWORD = 'test-pass';
    process.env.SESSION_SECRET = '0123456789abcdef0123456789abcdef';

    const token = createSessionToken();
    const decoded = verifySessionToken(token);
    assert.ok(decoded);
    assert.equal(decoded.v, 1);

    // Tamper signature
    const [payload, sig] = token.split('.');
    const badSig = (sig[0] === 'a' ? 'b' : 'a') + sig.slice(1);
    assert.equal(verifySessionToken(`${payload}.${badSig}`), null);

    // Malformed token
    assert.equal(verifySessionToken('invalid-token'), null);
    assert.equal(verifySessionToken(null), null);
  } finally {
    if (prevSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = prevSecret;
    if (prevPass === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = prevPass;
  }
});

test('parseCookies parses encoded cookies safely', () => {
  const cookies = parseCookies('foo=bar; mb_session=abc%2Edef; theme=dark');
  assert.equal(cookies.foo, 'bar');
  assert.equal(cookies.mb_session, 'abc.def');
  assert.equal(cookies.theme, 'dark');
  assert.deepEqual(parseCookies(''), {});
});

test('login rate limiter blocks after 10 failures and resets on success', () => {
  const fakeReq = { headers: { 'x-forwarded-for': '198.51.100.77' } };
  resetLoginRateLimit('198.51.100.77');

  for (let i = 0; i < 10; i++) {
    const check = checkLoginRateLimit(fakeReq);
    assert.equal(check.allowed, true);
    recordFailedLogin(check.ip);
  }

  const blocked = checkLoginRateLimit(fakeReq);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSeconds > 0);

  resetLoginRateLimit('198.51.100.77');
  assert.equal(checkLoginRateLimit(fakeReq).allowed, true);
});
