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

function runScript({ hostname = 'www.devbatista.com', webdriver = false, cookie = '' } = {}) {
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
    location: { hostname, href: `https://${hostname}/sobre?utm_source=teste` },
    screen: { width: 1280 },
    crypto: { randomUUID: () => 'id-fixo' },
    performance: { now: () => 0 },
    fetch(url, opts) { sent.push({ via: 'fetch', url, data: JSON.parse(opts.body) }); return Promise.resolve(); },
    addEventListener: on(listeners.window),
  };
  context.window = context;

  vm.runInNewContext(SCRIPT, context);

  // Simula a saída da página: é quando o leave seria enviado.
  const leavePage = () => {
    document.visibilityState = 'hidden';
    (listeners.document.visibilitychange || []).forEach((fn) => fn());
    (listeners.window.pagehide || []).forEach((fn) => fn());
  };

  return { sent, leavePage, navigator };
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
    'devbatista.com.preview-123.vercel.app',
    'devbatista-site.netlify.app',
    'devbatista.com.br',
    '',
  ];
  for (const hostname of hosts) {
    await t.test(hostname || '(vazio)', () => assertNothingSent(runScript({ hostname })));
  }
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
