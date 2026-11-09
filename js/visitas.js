/**
 * DevBatista — medição de visitas (Admin DevBatista → Marketing → Visitas do site).
 *
 * Manda ao /api/v.php a página vista (pageview) e, na saída, o tempo em que
 * ela ficou visível (leave). Sem cookie e sem guardar nada que identifique o
 * visitante: o Admin calcula um visitante anônimo que muda todo dia.
 *
 * Para não contar as próprias visitas, abra qualquer página com ?nao-contar=1
 * (vale para este navegador; ?nao-contar=0 volta a contar).
 *
 * Nunca trava nem quebra a página: qualquer erro é engolido.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/v.php';

  try {
    var flag = new URLSearchParams(window.location.search).get('nao-contar');
    if (flag === '1') window.localStorage.setItem('devbatista_nao_contar', '1');
    if (flag === '0') window.localStorage.removeItem('devbatista_nao_contar');
    if (window.localStorage.getItem('devbatista_nao_contar') === '1') return;
  } catch (e) { /* localStorage bloqueado: conta normalmente */ }

  // Automação declarada (Selenium, Puppeteer, Playwright) não é visita.
  if (navigator.webdriver) return;

  var id, visibleMs, visibleSince, left;

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function now() {
    return window.performance && performance.now ? performance.now() : Date.now();
  }

  function send(data) {
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
