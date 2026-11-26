// Testes do formulário de /contato em js/main.js: validação, o que vai para
// o /api/contato.php e, principalmente, que o WhatsApp abre em qualquer
// desfecho do envio (sucesso, erro, Admin mudo por 4 s, pop-up bloqueado).
//
// Roda o arquivo de verdade num contexto vm com um DOM mínimo simulado: só o
// formulário existe na página; as outras inicializações não acham seus
// elementos e saem sem fazer nada.
//
//   node --test 'tests/*.test.mjs'

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCRIPT = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');

const VALID = {
  name: 'Maria Teste',
  phone: '(11) 98765-4321',
  email: '',
  company: 'Escritório Exemplo',
  segment: 'contabilidade',
  need: 'whatsapp_ia',
  volume: '',
  engagement: 'pontual',
  message: 'Muitas perguntas repetidas.',
  consent: 'sim',
  website: '',
};

function element(extra = {}) {
  const attrs = {};
  return {
    hidden: true,
    textContent: '',
    appended: [],
    setAttribute(name, value) { attrs[name] = String(value); },
    getAttribute(name) { return attrs[name] ?? null; },
    removeAttribute(name) { delete attrs[name]; },
    append(...parts) { this.appended.push(...parts); },
    focus() { this.focused = true; },
    attrs,
    ...extra,
  };
}

function setup({ values = VALID, fetchImpl, popupBlocked = false } = {}) {
  const fields = {};
  Object.keys(VALID).forEach((name) => { fields[name] = element({ name }); });
  const errors = {};
  Object.keys(VALID).forEach((name) => { errors[`#erro-${name}`] = element(); });
  const feedback = element();
  const button = element();
  let submit = null;
  let resets = 0;

  const form = {
    values: { ...values },
    elements: { namedItem: (name) => fields[name] || null },
    addEventListener(type, fn) { if (type === 'submit') submit = fn; },
    querySelector(sel) {
      if (sel === '#form-feedback') return feedback;
      if (sel === 'button[type="submit"]') return button;
      return errors[sel] || null;
    },
    querySelectorAll(sel) {
      if (sel === '.form-error') return Object.values(errors);
      if (sel === '[aria-invalid="true"]') return Object.values(fields).filter((f) => f.attrs['aria-invalid'] === 'true');
      return [];
    },
    reset() { resets += 1; },
  };

  const opened = [];
  const posts = [];
  const timers = [];
  const listeners = {};

  const tab = { closed: false, opener: 'pai', location: {}, document: { title: '', body: { textContent: '' } } };

  const context = {
    document: {
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      querySelector: (sel) => (sel === '#contact-form' ? form : null),
      querySelectorAll: () => [],
      createElement: () => element(),
      getElementById: () => null,
    },
    FormData: class {
      constructor(f) { this.f = f; }
      get(key) { return key in this.f.values ? this.f.values[key] : null; }
    },
    sessionStorage: { getItem: () => JSON.stringify({ utm_source: 'instagram', landing_page: '/?utm_source=instagram' }) },
    location: { pathname: '/contato', href: 'https://www.devbatista.com/contato' },
    open(url, target) { opened.push({ url, target }); return popupBlocked ? null : tab; },
    fetch(url, opts) {
      posts.push({ url, opts, body: JSON.parse(opts.body) });
      return fetchImpl ? fetchImpl() : Promise.resolve({ status: 201 });
    },
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    innerWidth: 1280,
    scrollY: 0,
    requestAnimationFrame: (fn) => fn(),
    AbortController,
    IntersectionObserver: class { observe() {} disconnect() {} },
  };
  context.window = context;

  vm.runInNewContext(SCRIPT, context);
  (listeners.DOMContentLoaded || []).forEach((fn) => fn());
  assert.ok(submit, 'o formulário deveria ter o listener de submit');

  const settle = () => new Promise((r) => setImmediate(r));
  return {
    submit: async () => { submit({ preventDefault() {} }); await settle(); await settle(); },
    fireTimers: async () => { timers.splice(0).forEach((t) => t.fn()); await settle(); await settle(); },
    timers, opened, posts, tab, context, feedback, fields, errors, button,
    get resets() { return resets; },
  };
}

const whatsappText = (url) => decodeURIComponent(new URL(url).searchParams.get('text'));

// --- Envio com sucesso ------------------------------------------------------

test('envio válido: posta JSON no /api/contato.php e abre o WhatsApp na aba aberta no clique', async () => {
  const env = setup();
  await env.submit();

  assert.equal(env.opened.length, 1, 'a aba abre no clique, antes do servidor responder');
  assert.equal(env.tab.opener, null, 'a aba aberta não pode controlar o site');

  assert.equal(env.posts.length, 1);
  const { url, opts, body } = env.posts[0];
  assert.equal(url, '/api/contato.php');
  assert.equal(opts.method, 'POST');
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.equal(body.phone, '11987654321');
  assert.equal(body.consent, true);
  assert.equal(body.website, '');
  assert.equal(body.need, 'whatsapp_ia');
  assert.equal(body.tracking.utm_source, 'instagram');
  assert.equal(body.tracking.page, '/contato');
  assert.equal(typeof body.meta.elapsed_ms, 'number');

  assert.match(env.tab.location.href, /^https:\/\/wa\.me\/5511991308008\?text=/);
  assert.equal(env.resets, 1);
  assert.equal(env.feedback.hidden, false);
});

test('mensagem do WhatsApp traz os campos novos e omite os vazios', async () => {
  const env = setup();
  await env.submit();
  const text = whatsappText(env.tab.location.href);
  assert.equal(text, [
    'Olá, DevBatista! Vim pelo site e quero conversar sobre IA para a minha empresa.',
    '',
    'Nome: Maria Teste',
    'WhatsApp: (11) 98765-4321',
    'Empresa: Escritório Exemplo',
    'Segmento: Contabilidade',
    'Preciso de: Atendimento com IA no WhatsApp',
    'Contínuo ou pontual: Pontual',
    '',
    'Meu caso: Muitas perguntas repetidas.',
  ].join('\n'));
});

// --- Admin com problema: o WhatsApp abre do mesmo jeito ----------------------

test('erro de rede no envio: o WhatsApp abre mesmo assim', async () => {
  const env = setup({ fetchImpl: () => Promise.reject(new TypeError('Failed to fetch')) });
  await env.submit();
  assert.match(env.tab.location.href || '', /^https:\/\/wa\.me\//);
});

test('servidor responde 500: o WhatsApp abre mesmo assim', async () => {
  const env = setup({ fetchImpl: () => Promise.resolve({ status: 500 }) });
  await env.submit();
  assert.match(env.tab.location.href || '', /^https:\/\/wa\.me\//);
});

test('servidor mudo: depois de 4 s o WhatsApp abre', async () => {
  const env = setup({ fetchImpl: () => new Promise(() => {}) });
  await env.submit();
  assert.equal(env.tab.location.href, undefined, 'ainda esperando o servidor');
  const timer = env.timers.find((t) => t.ms === 4000);
  assert.ok(timer, 'deveria haver um timeout de 4 s');
  await env.fireTimers();
  assert.match(env.tab.location.href || '', /^https:\/\/wa\.me\//);
});

test('pop-up bloqueado: segue para o WhatsApp na própria aba', async () => {
  const env = setup({ popupBlocked: true, fetchImpl: () => Promise.reject(new Error('fora do ar')) });
  await env.submit();
  assert.match(env.context.location.href, /^https:\/\/wa\.me\//);
});

// --- Validação --------------------------------------------------------------

test('campos obrigatórios faltando: não envia, não abre nada e marca os erros', async () => {
  const env = setup({ values: { ...VALID, name: '', phone: '1234', segment: '', need: '', consent: null } });
  await env.submit();
  assert.equal(env.posts.length, 0);
  assert.equal(env.opened.length, 0);
  for (const name of ['name', 'phone', 'segment', 'need', 'consent']) {
    assert.equal(env.fields[name].attrs['aria-invalid'], 'true', name);
    assert.equal(env.errors[`#erro-${name}`].hidden, false, name);
  }
  assert.equal(env.fields.name.focused, true, 'o foco vai para o primeiro campo com erro');
});

test('e-mail é opcional, mas se vier precisa ser válido', async () => {
  const ok = setup({ values: { ...VALID, email: '' } });
  await ok.submit();
  assert.equal(ok.posts.length, 1);

  const bad = setup({ values: { ...VALID, email: 'maria@' } });
  await bad.submit();
  assert.equal(bad.posts.length, 0);
  assert.equal(bad.fields.email.attrs['aria-invalid'], 'true');
});

test('WhatsApp com 55 na frente é aceito; celular sem o 9 não', async () => {
  const with55 = setup({ values: { ...VALID, phone: '+55 11 98765-4321' } });
  await with55.submit();
  assert.equal(with55.posts[0].body.phone, '11987654321');

  const no9 = setup({ values: { ...VALID, phone: '11 88765-4321' } });
  await no9.submit();
  assert.equal(no9.posts.length, 0);
});
