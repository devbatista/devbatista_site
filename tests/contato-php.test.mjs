// Testa o api/contato.php (formulário de /contato) contra um Admin falso: o
// que vai para o webhook de leads, o que fica gravado no JSONL e o que
// acontece com o Admin fora do ar.
//
// Sobe três servidores embutidos do PHP: o "Admin", que grava cada lead
// recebido, e dois "sites" com uma cópia de api/contato.php e
// api/leads-config.php (sem o api/config.php local, para nunca falar com o
// Admin real): um aponta para o Admin falso, o outro para uma porta fechada.
// Sem PHP na máquina, é pulado.
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

let dir, admin, sitePort, offlinePort;
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

function makeSite(name) {
  const root = join(dir, name);
  mkdirSync(join(root, 'api'), { recursive: true });
  for (const f of ['contato.php', 'leads-config.php']) {
    copyFileSync(join(ROOT, 'api', f), join(root, 'api', f));
  }
  return root;
}

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(join(tmpdir(), 'devbatista-contato-'));
  admin = join(dir, 'admin');
  mkdirSync(admin);
  writeFileSync(join(admin, 'router.php'), `<?php
$lead = json_decode((string) file_get_contents('php://input'), true);
$line = json_encode(['auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? '', 'lead' => $lead]);
file_put_contents(__DIR__ . '/recebidos.jsonl', $line . "\\n", FILE_APPEND | LOCK_EX);
http_response_code(201);
echo json_encode(['id' => 42, 'created' => true]);
`);

  const site = makeSite('site');
  const offline = makeSite('offline');
  const adminPort = await freePort();
  const closedPort = await freePort(); // ninguém escuta aqui: o Admin "fora do ar"
  sitePort = await freePort();
  offlinePort = await freePort();

  const common = { DEVBATISTA_CRM_ENABLED: '1', DEVBATISTA_CRM_TOKEN: 'token-de-teste', DEVBATISTA_RATE_LIMIT_ENABLED: '0' };
  php(['-S', `127.0.0.1:${adminPort}`, join(admin, 'router.php')]);
  php(['-d', 'log_errors=1', '-d', `error_log=${join(dir, 'php-error.log')}`, '-S', `127.0.0.1:${sitePort}`, '-t', site], {
    ...common,
    DEVBATISTA_CRM_URL: `http://127.0.0.1:${adminPort}/webhooks/site-leads`,
    DEVBATISTA_STORAGE_DIR: join(dir, 'storage'),
  });
  php(['-d', 'log_errors=1', '-d', `error_log=${join(dir, 'php-error.log')}`, '-S', `127.0.0.1:${offlinePort}`, '-t', offline], {
    ...common,
    DEVBATISTA_CRM_URL: `http://127.0.0.1:${closedPort}/webhooks/site-leads`,
    DEVBATISTA_STORAGE_DIR: join(dir, 'storage-offline'),
  });
  await Promise.all([waitForPort(adminPort), waitForPort(sitePort), waitForPort(offlinePort)]);
});

after(() => {
  procs.forEach((p) => p.kill('SIGTERM'));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function post(body, { port = sitePort, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = request({
      host: '127.0.0.1', port, path: '/api/contato.php', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (teste)', ...headers },
    }, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null, ms: Date.now() - started }));
    });
    req.on('error', reject);
    req.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
}

const jsonl = (file) => (existsSync(file)
  ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  : []);
const month = () => new Date().toISOString().slice(0, 7);
const stored = (storage = 'storage') => jsonl(join(dir, storage, 'leads', `${month()}.jsonl`));
const integrations = (storage = 'storage') => jsonl(join(dir, storage, 'integrations', `${month()}.jsonl`));
const received = () => jsonl(join(admin, 'recebidos.jsonl'));

async function waitFor(fn, ms = 4000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = fn();
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

let seq = 0;
const valid = (extra = {}) => ({
  name: `Maria Teste ${++seq}`,
  phone: '+55 (11) 98765-4321',
  email: 'Maria@Escritorio.com.br',
  company: 'Escritório Exemplo',
  segment: 'contabilidade',
  need: 'whatsapp_ia',
  volume: '300_1000',
  engagement: 'continuo',
  message: 'Recebemos muitas perguntas repetidas.\nQueremos cobrar documentos.',
  consent: true,
  website: '',
  tracking: { utm_source: 'instagram', page: '/contato' },
  meta: { elapsed_ms: 15000, page_url: 'https://www.devbatista.com/contato' },
  ...extra,
});

// --- Envio válido -----------------------------------------------------------

test('envio válido: 201, grava no JSONL dos leads e manda ao Admin no formato combinado', { skip: SKIP }, async () => {
  const input = valid();
  const res = await post(input, { headers: { Origin: 'https://www.devbatista.com' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  const id = res.body.data.lead_id;
  assert.match(id, /^[0-9a-f]{16}$/);

  const record = stored().find((r) => r.id === id);
  assert.ok(record, 'o envio deveria estar no storage/leads');
  assert.equal(record.source, 'contact');
  assert.equal(record.phone, '11987654321');
  assert.equal('honeypot' in record, false);

  const hit = await waitFor(() => received().find((r) => r.lead.site_id === id));
  assert.ok(hit, 'o Admin deveria receber o lead');
  assert.equal(hit.auth, 'Bearer token-de-teste');
  assert.deepEqual(Object.keys(hit.lead).sort(),
    ['company', 'consent', 'details', 'email', 'name', 'need', 'phone', 'site_id', 'source', 'summary'].sort());
  assert.equal(hit.lead.source, 'contact');
  assert.equal(hit.lead.consent, true, 'booleano, não "sim" nem 1');
  assert.equal(hit.lead.name, input.name);
  assert.equal(hit.lead.email, 'maria@escritorio.com.br');
  assert.equal(hit.lead.phone, '11987654321', 'DDD + número, sem o 55');
  assert.equal(hit.lead.need, 'whatsapp_ia');
  assert.equal(hit.lead.summary, 'Contato pelo site: Atendimento com IA no WhatsApp · Contabilidade');
  assert.equal(hit.lead.details, [
    `Nome: ${input.name}`,
    'WhatsApp: 11987654321',
    'E-mail: maria@escritorio.com.br',
    'Empresa: Escritório Exemplo',
    'Segmento: Contabilidade',
    'O que precisa: Atendimento com IA no WhatsApp',
    'Mensagens por mês no WhatsApp: 300 a 1.000',
    'Contínuo ou pontual: Contínuo',
    'Caso: Recebemos muitas perguntas repetidas.\nQueremos cobrar documentos.',
    '',
    'utm_source: instagram',
    'page: /contato',
  ].join('\n'));

  const log = await waitFor(() => integrations().find((r) => r.lead_id === id));
  assert.equal(log.results.crm.status, 'ok');
});

test('campos opcionais vazios ficam fora do details', { skip: SKIP }, async () => {
  const res = await post(valid({ email: '', company: '', volume: '', engagement: '', message: '', tracking: {} }));
  assert.equal(res.status, 201);
  const hit = await waitFor(() => received().find((r) => r.lead.site_id === res.body.data.lead_id));
  assert.equal(hit.lead.email, '');
  assert.equal(hit.lead.details.split('\n').length, 4, hit.lead.details);
  assert.doesNotMatch(hit.lead.details, /E-mail|Empresa|Mensagens|Contínuo|Caso/);
});

// --- Robôs ------------------------------------------------------------------

test('honeypot preenchido: 200 e nada é gravado nem enviado', { skip: SKIP }, async () => {
  const name = 'Robô Honeypot';
  const res = await post(valid({ name, website: 'https://spam.example' }));
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(stored().some((r) => r.name === name), false);
  assert.equal(received().some((r) => r.lead.name === name), false);
});

test('honeypot preenchido com dados inválidos também recebe 200', { skip: SKIP }, async () => {
  const res = await post({ website: 'x', name: '', phone: '1' });
  assert.equal(res.status, 200);
});

test('enviado rápido demais (menos de 2 s) é tratado como robô', { skip: SKIP }, async () => {
  const name = 'Robô Apressado';
  const res = await post(valid({ name, meta: { elapsed_ms: 400 } }));
  assert.equal(res.status, 200);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(stored().some((r) => r.name === name), false);
});

// --- Validação --------------------------------------------------------------

test('validação: 422 com o erro de cada campo', { skip: SKIP }, async (t) => {
  const cases = {
    name: { name: 'A' },
    phone: { phone: '9876-5432' },
    email: { email: 'nao-e-email' },
    segment: { segment: 'padaria' },
    need: { need: '' },
    volume: { volume: 'muitas' },
    engagement: { engagement: 'sempre' },
    consent: { consent: false },
  };
  for (const [field, extra] of Object.entries(cases)) {
    await t.test(field, async () => {
      const res = await post(valid(extra));
      assert.equal(res.status, 422);
      assert.deepEqual(Object.keys(res.body.error.fields), [field]);
    });
  }
});

test('consentimento precisa ser true de verdade, não "sim" nem 1', { skip: SKIP }, async () => {
  for (const consent of ['sim', 1, 'true']) {
    const res = await post(valid({ consent }));
    assert.equal(res.status, 422, JSON.stringify(consent));
  }
});

test('método, tipo e origem errados são recusados', { skip: SKIP }, async () => {
  assert.equal((await post(valid(), { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post(valid(), { headers: { Origin: 'https://outro-site.com' } })).status, 403);
  assert.equal((await post('{nao e json')).status, 400);
});

// --- Admin fora do ar -------------------------------------------------------

test('Admin fora do ar: o visitante recebe 201 na hora e o erro vai para o log', { skip: SKIP }, async () => {
  const res = await post(valid(), { port: offlinePort });
  assert.equal(res.status, 201);
  assert.ok(res.ms < 3000, `respondeu em ${res.ms} ms`);
  const id = res.body.data.lead_id;
  assert.ok(stored('storage-offline').some((r) => r.id === id), 'o envio fica gravado mesmo assim');
  const log = await waitFor(() => integrations('storage-offline').find((r) => r.lead_id === id), 12000);
  assert.ok(log, 'a falha do Admin deveria ir para storage/integrations');
  assert.equal(log.results.crm.status, 'error');
});
