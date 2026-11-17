// Testes do js/visitas.js: quando envia e quando não envia nada ao /api/v.php.
// Roda o arquivo de verdade num contexto vm com window/document/navigator
// simulados e registra toda tentativa de envio (sendBeacon e fetch).
//
//   node --test tests/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCRIPT = readFileSync(new URL('../js/visitas.js', import.meta.url), 'utf8');

function runScript({ hostname = 'www.devbatista.com', webdriver = false, cookie = '', pathname = '/sobre', hash = '' } = {}) {
  const sent = [];
  const listeners = { window: {}, document: {} };
  const on = (bag) => (type, fn) => { (bag[type] ||= []).push(fn); };

  const document = {
    visibilityState: 'visible',
    referrer: 'https://www.google.com/',
    prerendering: false,
    cookie,
    addEventListener: on(listeners.document),
  };
  const navigator = {
    webdriver,
    sendBeacon(url, body) { sent.push({ via: 'beacon', url, data: JSON.parse(body) }); return true; },
  };
  const context = {
    document,
    navigator,
    location: { hostname, pathname, hash, get href() { return `https://${hostname}${pathname}${pathname === '/sobre' ? '?utm_source=teste' : ''}${this.hash}`; } },
    screen: { width: 1280 },
    crypto: { randomUUID: () => 'id-fixo' },
    performance: { now: () => 0 },
    fetch(url, opts) { sent.push({ via: 'fetch', url, data: JSON.parse(opts.body) }); return Promise.resolve(); },
    addEventListener: on(listeners.window),
  };
  context.window = context;

  // setTimeout guardado: o teste decide quando ele dispara.
  const timers = [];
  context.setTimeout = (fn) => timers.push(fn);
  const runTimers = () => timers.splice(0).forEach((fn) => fn());

  vm.runInNewContext(SCRIPT, context);

  // Muda o fragmento, como um protótipo das prévias ao trocar de tela.
  const goTo = (hash) => {
    context.location.hash = hash;
    (listeners.window.hashchange || []).forEach((fn) => fn());
  };

  // Simula a saída da página: é quando o leave seria enviado.
  const leavePage = () => {
    document.visibilityState = 'hidden';
    (listeners.document.visibilitychange || []).forEach((fn) => fn());
    (listeners.window.pagehide || []).forEach((fn) => fn());
  };

  return { sent, leavePage, navigator, goTo, runTimers };
}

// Nada enviado nem ao abrir nem ao sair da página.
function assertNothingSent(env) {
  assert.deepEqual(env.sent, [], 'não deveria enviar ao abrir a página');
  env.leavePage();
  assert.deepEqual(env.sent, [], 'não deveria enviar ao sair da página');
}

// --- Caso normal ------------------------------------------------------------

test('produção, sem webdriver, sem cookie: envia pageview e depois leave', () => {
  const env = runScript();

  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0].url, '/api/v.php');
  assert.deepEqual(env.sent[0].data, {
    type: 'pageview',
    id: 'id-fixo',
    url: 'https://www.devbatista.com/sobre?utm_source=teste',
    referrer: 'https://www.google.com/',
    screen_width: 1280,
    webdriver: false,
  });

  env.leavePage();
  assert.equal(env.sent.length, 2, 'um leave só, mesmo com visibilitychange + pagehide');
  assert.deepEqual(env.sent[1].data, { type: 'leave', id: 'id-fixo', duration_ms: 0, webdriver: false });
});

test('corte contornado: webdriver que vira true depois de carregar vai no evento', () => {
  const env = runScript();
  assert.equal(env.sent[0].data.webdriver, false);

  env.navigator.webdriver = true;
  env.leavePage();
  assert.equal(env.sent[1].data.type, 'leave');
  assert.equal(env.sent[1].data.webdriver, true, 'o Admin descarta pelo campo');
});

test('domínio sem www também é produção e envia', () => {
  const env = runScript({ hostname: 'devbatista.com' });
  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0].data.type, 'pageview');
});

test('outros cookies não impedem o envio', () => {
  for (const cookie of ['_ga=GA1.1.123', 'nao_contar=0', 'xnao_contar=1', 'nao_contar=10']) {
    const env = runScript({ cookie });
    assert.equal(env.sent.length, 1, `cookie "${cookie}" deveria enviar`);
  }
});

// --- 1. Host fora de produção -----------------------------------------------

test('host fora de produção: não envia nada', async (t) => {
  const hosts = [
    'localhost',
    '127.0.0.1',
    '192.168.0.10',
    '[::1]',
    'staging.devbatista.com',
    'preview.devbatista.com',
    'previews.devbatista.com.br',
    'devbatista.com.preview-123.vercel.app',
    'devbatista-site.netlify.app',
    'devbatista.com.br',
    '',
  ];
  for (const hostname of hosts) {
    await t.test(hostname || '(vazio)', () => assertNothingSent(runScript({ hostname })));
  }
});

// --- Prévias de clientes (previews.devbatista.com) ------------------------

test('prévia de site: envia ao beacon do site, e o fragmento não é tela nova', () => {
  const env = runScript({ hostname: 'previews.devbatista.com', pathname: '/sites/romulo-contabil/' });
  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0].url, 'https://www.devbatista.com/api/v.php');
  assert.equal(env.sent[0].data.url, 'https://previews.devbatista.com/sites/romulo-contabil/');

  env.goTo('#orcamento');
  assert.equal(env.sent.length, 1);
});

test('protótipo de sistema: a primeira página leva a tela inicial, e cada tela nova fecha a anterior', () => {
  const env = runScript({ hostname: 'previews.devbatista.com', pathname: '/sys/aguas-cristalinas/' });
  assert.equal(env.sent.length, 0, 'espera o protótipo pôr a tela inicial no fragmento');

  env.goTo('#resumo');
  assert.equal(env.sent.length, 0, 'a troca antes da primeira página vista não conta à parte');
  env.runTimers();
  assert.equal(env.sent.length, 1);
  assert.equal(env.sent[0].data.url, 'https://previews.devbatista.com/sys/aguas-cristalinas/#resumo');

  env.goTo('#clientes');
  assert.deepEqual(env.sent.slice(1).map((s) => [s.data.type, s.data.url]), [
    ['leave', undefined],
    ['pageview', 'https://previews.devbatista.com/sys/aguas-cristalinas/#clientes'],
  ]);
});

test('prévia com o cookie nao_contar=1 (gravado para todo o domínio): não envia nada', () => {
  const env = runScript({ hostname: 'previews.devbatista.com', pathname: '/sys/aguas-cristalinas/', cookie: 'nao_contar=1' });
  env.runTimers();
  assertNothingSent(env);
});

// --- 2. Navegador automatizado ----------------------------------------------

test('navigator.webdriver === true (Playwright, Puppeteer, Selenium): não envia nada', () => {
  assertNothingSent(runScript({ webdriver: true }));
});

// --- 3. Cookie de exclusão --------------------------------------------------

test('cookie nao_contar=1: não envia nada', async (t) => {
  const cookies = [
    'nao_contar=1',
    '_ga=GA1.1.123; nao_contar=1',
    'nao_contar=1; _ga=GA1.1.123',
    '_ga=GA1.1.123;nao_contar=1;outro=x',
  ];
  for (const cookie of cookies) {
    await t.test(cookie, () => assertNothingSent(runScript({ cookie })));
  }
});
