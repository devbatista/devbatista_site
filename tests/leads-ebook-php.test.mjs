// Testa o api/leads.php (diagnóstico) e o api/ebook.php (e-book) contra um
// Admin falso: o site só grava e repassa ao Admin — quem manda os e-mails é
// o Admin. No e-book o repasse É a entrega, então a resposta ao visitante
// depende do que o Admin responder.
//
// Sobe o "Admin", que grava cada lead recebido e responde conforme o e-mail
// (ver router.php abaixo), e três "sites" com cópia de api/leads.php,
// api/ebook.php e api/leads-config.php — só esses três: se algum voltar a
// depender do api/mailer.php, o require quebra e os testes acusam. Sem o
// api/config.php local, para nunca falar com o Admin real. Sem PHP na
// máquina, é pulado.
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

let dir, admin, sitePort, offlinePort, disabledPort;
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
  for (const f of ['leads.php', 'ebook.php', 'leads-config.php']) {
    copyFileSync(join(ROOT, 'api', f), join(root, 'api', f));
  }
  return root;
}

function startSite(root, port, storage, env) {
  php(['-d', 'log_errors=1', '-d', `error_log=${join(dir, 'php-error.log')}`, '-S', `127.0.0.1:${port}`, '-t', root], {
    DEVBATISTA_CRM_TOKEN: 'token-de-teste',
    DEVBATISTA_RATE_LIMIT_ENABLED: '0',
    DEVBATISTA_STORAGE_DIR: join(dir, storage),
    ...env,
  });
}

before(async () => {
  if (SKIP) return;
  dir = mkdtempSync(join(tmpdir(), 'devbatista-leads-ebook-'));
  admin = join(dir, 'admin');
  mkdirSync(admin);
  // O Admin falso decide a resposta pelo começo do e-mail.
  writeFileSync(join(admin, 'router.php'), `<?php
$lead = json_decode((string) file_get_contents('php://input'), true);
$line = json_encode(['auth' => $_SERVER['HTTP_AUTHORIZATION'] ?? '', 'lead' => $lead]);
file_put_contents(__DIR__ . '/recebidos.jsonl', $line . "\\n", FILE_APPEND | LOCK_EX);
$email = (string) ($lead['email'] ?? '');
if (strpos($email, 'recusado') === 0) { http_response_code(422); echo json_encode(['errors' => ['e-mail recusado pelo Admin']]); exit; }
if (strpos($email, 'quebrado') === 0) { http_response_code(500); echo json_encode(['message' => 'erro interno']); exit; }
if (strpos($email, 'aceito202') === 0) { http_response_code(202); echo json_encode(['id' => 7]); exit; }
if (strpos($email, 'lento') === 0) { sleep(10); }
if (strpos($email, 'completa') === 0) { http_response_code(200); echo json_encode(['id' => 41, 'created' => false]); exit; }
http_response_code(201);
echo json_encode(['id' => 42, 'created' => true]);
`);

  const adminPort = await freePort();
  const closedPort = await freePort(); // ninguém escuta aqui: o Admin "fora do ar"
  sitePort = await freePort();
  offlinePort = await freePort();
  disabledPort = await freePort();

  // Vários workers: o pedido "lento" não pode travar o Admin para os demais.
  php(['-S', `127.0.0.1:${adminPort}`, join(admin, 'router.php')], { PHP_CLI_SERVER_WORKERS: '4' });
  startSite(makeSite('site'), sitePort, 'storage', {
    DEVBATISTA_CRM_ENABLED: '1',
    DEVBATISTA_CRM_URL: `http://127.0.0.1:${adminPort}/webhooks/site-leads`,
  });
  startSite(makeSite('offline'), offlinePort, 'storage-offline', {
    DEVBATISTA_CRM_ENABLED: '1',
    DEVBATISTA_CRM_URL: `http://127.0.0.1:${closedPort}/webhooks/site-leads`,
  });
  startSite(makeSite('disabled'), disabledPort, 'storage-disabled', {
    DEVBATISTA_CRM_ENABLED: '0',
    DEVBATISTA_CRM_URL: `http://127.0.0.1:${adminPort}/webhooks/site-leads`,
  });
  await Promise.all([adminPort, sitePort, offlinePort, disabledPort].map((p) => waitForPort(p)));
});

after(() => {
  procs.forEach((p) => p.kill('SIGTERM'));
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function post(path, body, { port = sitePort, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const req = request({
      host: '127.0.0.1', port, path, method: 'POST',
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
const storedLeads = (storage = 'storage') => jsonl(join(dir, storage, 'leads', `${month()}.jsonl`));
const storedEbook = (storage = 'storage') => jsonl(join(dir, storage, 'ebook', `${month()}.jsonl`));
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

// ============================================================================
// Diagnóstico (api/leads.php)
// ============================================================================

const diagnosis = (extra = {}) => ({
  name: `Joana Teste ${++seq}`,
  company: 'Clínica Exemplo',
  email: `Joana${seq}@Clinica.com.br`,
  phone: '(11) 98765-4321',
  answers: {
    employees: '11_25',
    it_responsible: 'acumula',
    process_management: 'planilhas',
    manual_tasks: 'muitas',
    systems_integration: 'nao',
    automation_interest: 'prioridade',
    development_need: 'sim',
    technology_impact: 'bastante',
  },
  main_problem: 'automacao',
  website: '',
  tracking: { utm_source: 'google' },
  meta: { elapsed_ms: 60000, page_url: 'https://www.devbatista.com/' },
  ...extra,
});

test('diagnóstico: 201, grava no JSONL e repassa ao Admin como "diagnosis"', { skip: SKIP }, async () => {
  const input = diagnosis();
  const res = await post('/api/leads.php', input, { headers: { Origin: 'https://www.devbatista.com' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  const id = res.body.data.lead_id;
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal('commercial_tier' in res.body.data, false, 'o potencial comercial é interno');

  assert.ok(storedLeads().some((r) => r.id === id), 'o lead deveria estar no storage/leads');

  const hit = await waitFor(() => received().find((r) => r.lead.site_id === id));
  assert.ok(hit, 'o Admin deveria receber o lead');
  assert.equal(hit.auth, 'Bearer token-de-teste');
  assert.equal(hit.lead.source, 'diagnosis');
  assert.equal(hit.lead.name, input.name);
  assert.equal(hit.lead.email, input.email.toLowerCase());
  assert.equal(hit.lead.tier, 'quente');
  assert.deepEqual(Object.keys(hit.lead).sort(),
    ['company', 'details', 'email', 'name', 'phone', 'site_id', 'source', 'summary', 'tier'].sort());
});

test('diagnóstico: só o Admin aparece nas integrações, sem e-mail nem WhatsApp', { skip: SKIP }, async () => {
  const res = await post('/api/leads.php', diagnosis());
  assert.equal(res.status, 201);
  const log = await waitFor(() => integrations().find((r) => r.lead_id === res.body.data.lead_id));
  assert.ok(log, 'o resultado deveria ir para storage/integrations');
  assert.deepEqual(Object.keys(log.results), ['crm']);
  assert.equal(log.results.crm.status, 'ok');
});

test('diagnóstico: Admin fora do ar não segura o visitante e o lead fica gravado', { skip: SKIP }, async () => {
  const res = await post('/api/leads.php', diagnosis(), { port: offlinePort });
  assert.equal(res.status, 201);
  assert.ok(res.ms < 3000, `respondeu em ${res.ms} ms`);
  const id = res.body.data.lead_id;
  assert.ok(storedLeads('storage-offline').some((r) => r.id === id));
  const log = await waitFor(() => integrations('storage-offline').find((r) => r.lead_id === id), 12000);
  assert.equal(log.results.crm.status, 'error');
});

test('diagnóstico: validação continua recusando com 422', { skip: SKIP }, async () => {
  const res = await post('/api/leads.php', diagnosis({ email: 'nao-e-email' }));
  assert.equal(res.status, 422);
  assert.ok('email' in res.body.error.fields);
});

// ============================================================================
// E-book (api/ebook.php)
// ============================================================================

const ebook = (email, extra = {}) => ({
  email,
  source: 'ebook-gestao-estrategica-ti',
  website: '',
  tracking: { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'ebook-ti' },
  meta: { elapsed_ms: 5000, page_url: 'https://www.devbatista.com/sua-empresa-esta-perdendo-dinheiro-com-a-ti-sem-perceber' },
  ...extra,
});

const FAILURE_MESSAGE = 'Não conseguimos enviar o e-book para esse endereço agora. Confira o e-mail digitado e tente novamente.';

function assertDeliveryFailed(res) {
  assert.equal(res.status, 502);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'delivery_failed');
  assert.equal(res.body.error.message, FAILURE_MESSAGE);
}

test('e-book: 201 do Admin → 201 ao visitante, depois de o Admin já ter recebido', { skip: SKIP }, async () => {
  const email = `novo${++seq}@empresa.com.br`;
  const res = await post('/api/ebook.php', ebook(email.toUpperCase()), { headers: { Origin: 'https://www.devbatista.com' } });
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
  const id = res.body.data.lead_id;
  assert.match(id, /^[0-9a-f]{16}$/);

  // Síncrono: quando a resposta chega, o Admin já recebeu o pedido.
  const hit = received().find((r) => r.lead.site_id === id);
  assert.ok(hit, 'o Admin deveria ter recebido antes da resposta ao visitante');
  assert.equal(hit.auth, 'Bearer token-de-teste');
  assert.deepEqual(hit.lead, {
    source: 'ebook',
    site_id: id,
    email,
    summary: 'Baixou o e-book pelo site (ebook-gestao-estrategica-ti) · google / cpc / ebook-ti',
  });

  const record = storedEbook().find((r) => r.id === id);
  assert.ok(record, 'o pedido deveria estar no storage/ebook');
  assert.equal(record.email, email);

  const log = integrations().find((r) => r.lead_id === id);
  assert.ok(log, 'a entrega deveria ir para storage/integrations');
  assert.equal(log.source, 'ebook');
  assert.equal(log.results.crm.status, 'ok');
  assert.equal(log.results.crm.http_code, 201);
});

test('e-book: 200 do Admin (lead completado) também é sucesso', { skip: SKIP }, async () => {
  const res = await post('/api/ebook.php', ebook(`completa${++seq}@empresa.com.br`));
  assert.equal(res.status, 201);
  assert.equal(res.body.ok, true);
});

test('e-book: erro do Admin (422, 500, outro 2xx) → falha ao visitante, mas o pedido fica gravado', { skip: SKIP }, async (t) => {
  for (const [prefix, httpCode] of [['recusado', 422], ['quebrado', 500], ['aceito202', 202]]) {
    await t.test(prefix, async () => {
      const email = `${prefix}${++seq}@empresa.com.br`;
      const res = await post('/api/ebook.php', ebook(email));
      assertDeliveryFailed(res);

      const record = storedEbook().find((r) => r.email === email);
      assert.ok(record, 'o pedido deveria estar no storage/ebook mesmo com a falha');
      const log = integrations().find((r) => r.lead_id === record.id);
      assert.equal(log.results.crm.status, 'error');
      assert.equal(log.results.crm.http_code, httpCode);
    });
  }
});

test('e-book: Admin fora do ar → falha ao visitante, mas o pedido fica gravado', { skip: SKIP }, async () => {
  const email = `offline${++seq}@empresa.com.br`;
  const res = await post('/api/ebook.php', ebook(email), { port: offlinePort });
  assertDeliveryFailed(res);
  const record = storedEbook('storage-offline').find((r) => r.email === email);
  assert.ok(record);
  const log = integrations('storage-offline').find((r) => r.lead_id === record.id);
  assert.equal(log.results.crm.status, 'error');
  assert.equal(log.results.crm.http_code, 0);
});

test('e-book: Admin desligado na configuração → falha (ninguém mandaria o e-mail)', { skip: SKIP }, async () => {
  const email = `desligado${++seq}@empresa.com.br`;
  const res = await post('/api/ebook.php', ebook(email), { port: disabledPort });
  assertDeliveryFailed(res);
  assert.ok(storedEbook('storage-disabled').some((r) => r.email === email));
  assert.equal(received().some((r) => r.lead.email === email), false);
});

test('e-book: Admin sem resposta em 8 s → falha ao visitante, sem esperar o Admin', { skip: SKIP }, async () => {
  const email = `lento${++seq}@empresa.com.br`;
  const res = await post('/api/ebook.php', ebook(email));
  assertDeliveryFailed(res);
  assert.ok(res.ms >= 7500 && res.ms < 9900, `respondeu em ${res.ms} ms`);
  const record = storedEbook().find((r) => r.email === email);
  assert.ok(record, 'o pedido deveria estar no storage/ebook');
  assert.equal(integrations().find((r) => r.lead_id === record.id).results.crm.status, 'error');
});

test('e-book: robô (honeypot ou rápido demais) recebe 200 e nada vai ao Admin', { skip: SKIP }, async () => {
  for (const extra of [{ website: 'http://spam.example' }, { meta: { elapsed_ms: 300 } }]) {
    const email = `robo${++seq}@empresa.com.br`;
    const res = await post('/api/ebook.php', ebook(email, extra));
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(storedEbook().some((r) => r.email === email), false);
    assert.equal(received().some((r) => r.lead.email === email), false);
  }
});

test('e-book: e-mail inválido, tipo e origem errados são recusados antes do Admin', { skip: SKIP }, async () => {
  assert.equal((await post('/api/ebook.php', ebook('nao-e-email'))).status, 422);
  assert.equal((await post('/api/ebook.php', ebook('a@b.com'), { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post('/api/ebook.php', ebook('a@b.com'), { headers: { Origin: 'https://outro-site.com' } })).status, 403);
  assert.equal(received().some((r) => r.lead.email === 'nao-e-email'), false);
});
