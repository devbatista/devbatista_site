// Testa o cookie de exclusão gravado pelo .htaccess (?nao-contar=1 / =0).
// Sobe um Apache temporário em HTTPS (a regra 1 do .htaccess exige HTTPS e
// www) com o .htaccess real do repositório. Sem Apache, mod_ssl ou openssl
// na máquina, o teste é pulado.
//
//   node --test 'tests/*.test.mjs'

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const HOST = 'www.devbatista.com';

const COOKIE_LIGA = 'nao_contar=1; Max-Age=34560000; Path=/; Domain=devbatista.com; SameSite=Lax; Secure';
// Apaga o de todo o domínio e o antigo, gravado sem Domain, só para o www.
const COOKIES_DESLIGA = [
  'nao_contar=; Max-Age=0; Path=/; Domain=devbatista.com; SameSite=Lax; Secure',
  'nao_contar=; Max-Age=0; Path=/; SameSite=Lax; Secure',
];

const HTTPD = ['/usr/sbin/httpd', '/usr/sbin/apache2', '/opt/homebrew/bin/httpd', '/usr/local/bin/httpd']
  .find(existsSync);
const MODULES = ['/usr/libexec/apache2', '/usr/lib/apache2/modules', '/usr/lib64/httpd/modules',
  '/opt/homebrew/lib/httpd/modules', '/usr/local/lib/httpd/modules']
  .find((dir) => existsSync(join(dir, 'mod_ssl.so')) && existsSync(join(dir, 'mod_headers.so')));
const OPENSSL = spawnSync('openssl', ['version']).status === 0;
const SKIP = !HTTPD || !MODULES || !OPENSSL
  ? 'precisa de Apache 2.4 com mod_ssl e mod_headers, e de openssl'
  : false;

let dir, port, httpd;

function freePort() {
  return new Promise((resolve) => {
    const srv = createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForPort(p, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await new Promise((resolve) => {
      const s = connect(p, '127.0.0.1', () => { s.end(); resolve(true); });
      s.on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Apache não subiu na porta ${p}`);
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port, path, servername: HOST, rejectUnauthorized: false,
      headers: { Host: HOST, 'User-Agent': 'Mozilla/5.0 (teste nao-contar)' },
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(join(tmpdir(), 'devbatista-htaccess-'));
  port = await freePort();

  const cert = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', `/CN=${HOST}`, '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')]);
  assert.equal(cert.status, 0, String(cert.stderr));

  const mod = (name, file) => `LoadModule ${name}_module ${join(MODULES, file)}`;
  const optional = [['expires', 'mod_expires.so'], ['deflate', 'mod_deflate.so'], ['filter', 'mod_filter.so']]
    .filter(([, file]) => existsSync(join(MODULES, file)))
    .map(([name, file]) => mod(name, file));
  const mpm = existsSync(join(MODULES, 'mod_mpm_prefork.so')) ? [mod('mpm_prefork', 'mod_mpm_prefork.so')] : [];

  writeFileSync(join(dir, 'httpd.conf'), [
    `ServerRoot "${dir}"`,
    `Listen 127.0.0.1:${port}`,
    ...mpm,
    mod('authz_core', 'mod_authz_core.so'),
    mod('unixd', 'mod_unixd.so'),
    mod('log_config', 'mod_log_config.so'),
    mod('mime', 'mod_mime.so'),
    mod('dir', 'mod_dir.so'),
    mod('rewrite', 'mod_rewrite.so'),
    mod('headers', 'mod_headers.so'),
    mod('socache_shmcb', 'mod_socache_shmcb.so'),
    mod('ssl', 'mod_ssl.so'),
    ...optional,
    `PidFile "${join(dir, 'httpd.pid')}"`,
    `ErrorLog "${join(dir, 'error.log')}"`,
    'TypesConfig /dev/null',
    `ServerName ${HOST}`,
    'SSLEngine on',
    `SSLCertificateFile "${join(dir, 'cert.pem')}"`,
    `SSLCertificateKeyFile "${join(dir, 'key.pem')}"`,
    `DocumentRoot "${ROOT}"`,
    `<Directory "${ROOT}">`,
    '  AllowOverride All',
    '  Require all granted',
    '</Directory>',
    '',
  ].join('\n'));

  httpd = spawn(HTTPD, ['-X', '-f', join(dir, 'httpd.conf')], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  httpd.stderr.on('data', (d) => { stderr += d; });
  httpd.on('exit', (code) => { if (code) console.error(`httpd saiu com ${code}: ${stderr}`); });
  await waitForPort(port);
});

after(() => {
  if (httpd) httpd.kill('SIGTERM');
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const cookies = (res) => res.headers['set-cookie'] || [];

test('?nao-contar=1 grava o cookie por 400 dias, em qualquer página', { skip: SKIP }, async (t) => {
  for (const path of ['/sobre?nao-contar=1', '/?utm_source=instagram&nao-contar=1', '/bio/whatsapp?nao-contar=1', '/blog/?nao-contar=1']) {
    await t.test(path, async () => {
      const res = await get(path);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(cookies(res), [COOKIE_LIGA]);
      assert.equal(res.headers['cache-control'], 'no-store');
    });
  }
});

test('?nao-contar=0 apaga o cookie', { skip: SKIP }, async () => {
  const res = await get('/sobre?nao-contar=0');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(cookies(res), COOKIES_DESLIGA);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('sem o parâmetro (ou com outro valor), nenhum cookie e cache normal', { skip: SKIP }, async (t) => {
  for (const path of ['/sobre', '/sobre?utm_source=x', '/sobre?nao-contar=10', '/sobre?xnao-contar=1', '/sobre?nao-contar=']) {
    await t.test(path, async () => {
      const res = await get(path);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(cookies(res), []);
      assert.equal(res.headers['cache-control'], 'public, max-age=0, must-revalidate');
    });
  }
});
