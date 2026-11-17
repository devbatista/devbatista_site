/**
 * DevBatista — medição de visitas (Admin DevBatista → Marketing → Visitas do site).
 *
 * Manda ao /api/v.php a página vista (pageview) e, na saída, o tempo em que
 * ela ficou visível (leave). Não cria cookie nem guarda nada que identifique
 * o visitante: o Admin calcula um visitante anônimo que muda todo dia.
 *
 * Não envia nada (nem pageview, nem leave) quando:
 *   1. o host não é o de produção (localhost, IP, preview, staging);
 *   2. o navegador é automatizado (navigator.webdriver: Playwright,
 *      Puppeteer, Selenium);
 *   3. o navegador tem o cookie nao_contar=1. Quem grava o cookie é o
 *      servidor (.htaccess, ao abrir qualquer página com ?nao-contar=1;
 *      ?nao-contar=0 apaga), não este script: o Safari corta para 7 dias os
 *      cookies criados por JavaScript.
 *
 * Nunca trava nem quebra a página: qualquer erro é engolido.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/v.php';
  var PRODUCAO = ['devbatista.com', 'www.devbatista.com'];

  // 1. Só o site de produção conta. Comparação exata: staging.devbatista.com
  //    ou devbatista.com.algum-preview.app também ficam de fora.
  if (PRODUCAO.indexOf(window.location.hostname) === -1) return;

  // 2. Automação declarada não é visita.
  if (navigator.webdriver === true) return;

  // 3. Navegador marcado com ?nao-contar=1.
  try {
    if (/(?:^|;\s*)nao_contar=1(?:;|$)/.test(document.cookie)) return;
  } catch (e) { /* cookie inacessível: conta normalmente */ }

  var id, visibleMs, visibleSince, left;

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  // Todo evento leva o webdriver: se o corte lá em cima for contornado (o
  // navegador passa a se declarar automatizado depois de carregar, por
  // exemplo), o Admin ainda descarta a visita.
  function send(data) {
    data.webdriver = navigator.webdriver === true;
    var body = JSON.stringify(data);
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
    } catch (e) { /* cai no fetch */ }
    try {
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, credentials: 'omit', headers: { 'Content-Type': 'text/plain' } })
        .catch(function () {});
    } catch (e) { /* sem como enviar */ }
  }

  function pageview() {
    id = newId();
    visibleMs = 0;
    visibleSince = document.visibilityState === 'visible' ? now() : null;
    left = false;
    send({
      type: 'pageview',
      id: id,
      url: window.location.href,
      referrer: document.referrer,
      screen_width: window.screen ? window.screen.width : null
    });
  }

  function pause() {
    if (visibleSince !== null) {
      visibleMs += now() - visibleSince;
      visibleSince = null;
    }
  }

  // Um leave por página, na primeira vez que ela some da tela.
  function leave() {
    pause();
    if (left || !id) return;
    left = true;
    send({ type: 'leave', id: id, duration_ms: Math.round(visibleMs) });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      leave();
    } else if (visibleSince === null) {
      visibleSince = now();
    }
  });
  window.addEventListener('pagehide', leave);

  // Voltar pelo botão do navegador (bfcache) é uma página vista nova.
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) pageview();
  });

  // Página pré-renderizada só conta quando a pessoa de fato a abre.
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', pageview, { once: true });
  } else {
    pageview();
  }
})();
