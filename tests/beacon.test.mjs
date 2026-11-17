// Testa o api/v.php (beacon das visitas) contra um Admin falso: o que é
// repassado (campo webdriver, header Origin) e o que vai para o log de erro.
//
// Sobe dois servidores embutidos do PHP: o "site", com uma cópia de api/v.php,
// api/visitas.php e api/leads-config.php (sem o api/config.php local, para
// nunca falar com o Admin real), e o "Admin", que grava cada evento recebido e
// responde com o status pedido pelo teste. Sem PHP na máquina, é pulado.
//
//   node --test 'tests/*.test.mjs'

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = spawnSync('php', ['-v']).status === 0 ? false : 'precisa do PHP na máquina';
const ORIGIN = 'https://www.devbatista.com';

let dir, site, admin, sitePort;
const procs = [];

function freePort() {
  return new Promise((resolve) => {
    const srv = createServer().listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForPort(port, ms = 5000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await new Promise((resolve) => {
      const s = connect(port, '127.0.0.1', () => { s.end(); resolve(true); });
      s.on('error', () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`servidor não subiu na porta ${port}`);
}

function php(args, env = {}) {
  const p = spawn('php', args, { stdio: 'ignore', env: { ...process.env, ...env } });
  procs.push(p);
  return p;
}

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(join(tmpdir(), 'devbatista-beacon-'));
  site = join(dir, 'site');
  admin = join(dir, 'admin');
  mkdirSync(join(site, 'api'), { recursive: true });
  mkdirSync(admin);
  for (const f of ['v.php', 'visitas.php', 'leads-config.php']) {
    copyFileSync(join(ROOT, 'api', f), join(site, 'api', f));
  }

  writeFileSync(join(admin, 'status.txt'), '202');
  writeFileSync(join(admin, 'router.php'), `<?php
$event = json_decode((string) file_get_contents('php://input'), true);
$line = json_encode(['auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? '', 'event' => $event]);
file_put_contents(__DIR__ . '/recebidos.jsonl', $line . "\\n", FILE_APPEND | LOCK_EX);
http_response_code((int) trim((string) file_get_contents(__DIR__ . '/status.txt')));
`);

  const adminPort = await freePort();
  sitePort = await freePort();
  php(['-S', `127.0.0.1:${adminPort}`, join(admin, 'router.php')]);
  php(['-d', `error_log=${join(dir, 'php-error.log')}`, '-d', 'log_errors=1',
    '-S', `127.0.0.1:${sitePort}`, '-t', site], {
    DEVBATISTA_VISITS_ENABLED: '1',
    DEVBATISTA_VISITS_URL: `http://127.0.0.1:${adminPort}/webhooks/site-visits`,
    DEVBATISTA_VISITS_TOKEN: 'token-de-teste',
  });
  await Promise.all([waitForPort(adminPort), waitForPort(sitePort)]);
});

after(() => {
  procs.forEach((p) => p.kill('SIGTERM'));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

let seq = 0;
const newId = () => `teste-${process.pid}-${++seq}`;

function beacon(body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port: sitePort, path: '/api/v.php', method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'Mozilla/5.0 (teste)', ...headers },
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
}

const received = () => {
  const file = join(admin, 'recebidos.jsonl');
  return existsSync(file)
    ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
};

// O repasse roda depois do 204: espera o Admin falso receber o evento do id.
async function receivedFor(id, ms = 3000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = received().find((r) => r.event && r.event.id === id);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

const errorLog = () => {
  const file = join(dir, 'php-error.log');
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
};

const pageview = (extra = {}) => ({
  type: 'pageview', id: newId(), url: 'https://www.devbatista.com/sobre',
  referrer: '', screen_width: 1280, ...extra,
});

// --- Campo webdriver --------------------------------------------------------

test('webdriver: true é repassado ao Admin', { skip: SKIP }, async () => {
  const ev = pageview({ webdriver: true });
  assert.equal(await beacon(ev, { Origin: ORIGIN }), 204);
  const hit = await receivedFor(ev.id);
  assert.ok(hit, 'o Admin deveria receber o evento');
  assert.equal(hit.event.webdriver, true);
  assert.equal(hit.auth, 'Bearer token-de-teste');
});

test('webdriver: false é repassado; o leave também leva o campo', { skip: SKIP }, async () => {
  const ev = pageview({ webdriver: false });
  await beacon(ev, { Origin: ORIGIN });
  assert.equal((await receivedFor(ev.id)).event.webdriver, false);

  await beacon({ type: 'leave', id: ev.id + '-leave', duration_ms: 1200, webdriver: true });
  const leave = await receivedFor(ev.id + '-leave');
  assert.deepEqual(
    { type: leave.event.type, duration_ms: leave.event.duration_ms, webdriver: leave.event.webdriver },
    { type: 'leave', duration_ms: 1200, webdriver: true },
  );
});

test('webdriver que não é booleano é descartado (o evento segue sem o campo)', { skip: SKIP }, async (t) => {
  for (const value of ['true', 1, 0, null, 'false', [true], { a: 1 }]) {
    await t.test(JSON.stringify(value), async () => {
      const ev = pageview({ webdriver: value });
      await beacon(ev, { Origin: ORIGIN });
      const hit = await receivedFor(ev.id);
      assert.ok(hit);
      assert.equal('webdriver' in hit.event, false);
    });
  }
});

test('campos fora da lista continuam barrados', { skip: SKIP }, async () => {
  const ev = pageview({ webdriver: false, ip: '1.2.3.4', headers: { 'user-agent': 'falso' }, extra: 'x' });
  await beacon(ev, { Origin: ORIGIN });
  const hit = await receivedFor(ev.id);
  assert.deepEqual(Object.keys(hit.event).sort(),
    ['headers', 'id', 'ip', 'referrer', 'screen_width', 'type', 'url', 'webdriver']);
  assert.equal(hit.event.ip, '127.0.0.1', 'IP vem do servidor');
  assert.equal(hit.event.headers['user-agent'], 'Mozilla/5.0 (teste)', 'headers vêm do servidor');
});

// --- Header Origin ----------------------------------------------------------

test('Origin é repassado ao Admin nos headers', { skip: SKIP }, async () => {
  const ev = pageview();
  await beacon(ev, { Origin: ORIGIN, Referer: 'https://www.devbatista.com/sobre' });
  const hit = await receivedFor(ev.id);
  assert.equal(hit.event.headers.origin, ORIGIN);
  assert.equal(hit.event.headers.referer, 'https://www.devbatista.com/sobre');
});

test('sem Origin (sendBeacon de mesma origem pode não mandar), segue sem o header', { skip: SKIP }, async () => {
  const ev = pageview();
  assert.equal(await beacon(ev), 204);
  const hit = await receivedFor(ev.id);
  assert.ok(hit);
  assert.equal('origin' in hit.event.headers, false);
});

test('Origin de fora continua levando 403 no próprio site, sem repasse', { skip: SKIP }, async () => {
  const ev = pageview();
  assert.equal(await beacon(ev, { Origin: 'http://localhost:8000' }), 403);
  assert.equal(await receivedFor(ev.id, 500), null);
});

// --- Resposta do Admin ------------------------------------------------------

test('Admin respondendo 202 ou 204 não vai para o log; 500 vai', { skip: SKIP }, async (t) => {
  const status = (s) => writeFileSync(join(admin, 'status.txt'), String(s));
  for (const [code, logs] of [[202, false], [204, false], [500, true]]) {
    await t.test(`HTTP ${code}`, async () => {
      status(code);
      const before = errorLog();
      const ev = pageview();
      await beacon(ev, { Origin: ORIGIN });
      assert.ok(await receivedFor(ev.id));
      await new Promise((r) => setTimeout(r, 200)); // o log sai depois da resposta do Admin
      const novo = errorLog().slice(before.length);
      assert.equal(novo.includes('[visitas]'), logs, `log: ${novo || '(vazio)'}`);
      if (logs) assert.match(novo, new RegExp(`HTTP ${code}`));
    });
  }
  status(202);
});
