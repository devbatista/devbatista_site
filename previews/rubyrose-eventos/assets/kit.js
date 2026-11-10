// Moldura do preview, igual nas três partes (painel, página do evento e portaria): a faixa de
// aviso, o painel "Como testar", o QR Code em tela cheia e o aviso das ações desativadas.
// SÓ EXISTE NO PREVIEW. Depende de demo-data.js, demo-api.js e qr.js.
(function () {
  "use strict"

  var demo = window.RRDemo
  var data = demo.data
  var part = document.documentElement.getAttribute("data-pv-part") || ""
  var PARTS = [
    ["admin", "index.html", "Painel admin"],
    ["evento", "evento.html", "Página do evento"],
    ["portaria", "gate.html", "Portaria"]
  ]

  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  var el = function (html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild }
  var day = function (iso, opts) { return new Intl.DateTimeFormat("pt-BR", Object.assign({ timeZone: "UTC" }, opts)).format(new Date(iso + "T00:00:00Z")) }
  var dm = function (iso) { return day(iso, { day: "2-digit", month: "2-digit" }) }
  var weekday = function (iso) { return day(iso, { weekday: "long" }) }
  var hm = function (iso) { return iso.slice(11, 16) }

  // ------------------------------------------------------------------ aviso
  var toastEl = el('<div class="pv-toast" role="status" aria-live="polite"></div>')
  var toastTimer
  function toast(msg) {
    toastEl.textContent = msg || "Isto é um preview: as ações que gravam dados estão desativadas."
    toastEl.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.classList.remove("show") }, 3200)
  }

  // ------------------------------------------------------------------ QR em tela cheia
  function qrSvg(content, px) {
    var svg = window.RRQR.svg(window.RRQR.encode(content), 8)
    return svg.replace("<svg ", '<svg style="width:' + px + ";height:" + px + '" ')
  }

  var viewer = el(
    '<div class="pv-viewer" role="dialog" aria-modal="true" aria-label="QR Code em tela cheia" hidden>' +
      '<div class="pv-viewer__box"><p class="pv-viewer__title"></p><div class="pv-viewer__qr"></div><p class="pv-viewer__sub"></p>' +
      '<button type="button" class="pv-btn" data-pv-viewer-close>Fechar</button></div></div>')

  function showQr(opts) {
    viewer.querySelector(".pv-viewer__title").textContent = opts.title || "QR Code"
    viewer.querySelector(".pv-viewer__sub").textContent = opts.subtitle || ""
    viewer.querySelector(".pv-viewer__qr").innerHTML = qrSvg(opts.content, "min(86vw, calc(100dvh - 190px), 720px)")
    viewer.hidden = false
    document.documentElement.classList.add("pv-lock")
    if (viewer.requestFullscreen) viewer.requestFullscreen().catch(function () { /* iPhone: fica a sobreposição */ })
    viewer.querySelector("[data-pv-viewer-close]").focus()
  }

  function closeViewer() {
    if (viewer.hidden) return
    viewer.hidden = true
    if (panel.hidden) document.documentElement.classList.remove("pv-lock")
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {})
  }

  // ------------------------------------------------------------------ faixa
  var banner = el(
    '<div class="pv-banner" role="note">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>' +
      '<span class="pv-long"><b>Ambiente de demonstração:</b> todos os dados são fictícios e servem apenas para apresentar o sistema.</span>' +
      '<span class="pv-short"><b>Demonstração:</b> dados fictícios</span>' +
      '<button type="button" class="pv-banner__link" data-pv-open aria-controls="pv-panel" aria-expanded="false">' +
        '<span class="pv-long">Como testar o credenciamento e o QR Code</span><span class="pv-short">Como testar</span></button>' +
    "</div>")

  // ------------------------------------------------------------------ painel "Como testar"
  var cards = data.cards
  var byToken = function (t) { return demo.seeded(t) }
  var event = function (acc) { return demo.event(acc.event_id) }
  var pin = '<span class="pv-pin">' + esc(data.pin) + "</span>"

  function cardInfo(kind) {
    var token = cards[kind]
    var acc = byToken(token)
    var who = acc ? "<b>" + esc(acc.name) + "</b> · " : ""
    var when = acc ? weekday(acc.attends_on) + ", " + dm(acc.attends_on) : ""
    switch (kind) {
      case "ok": return ["Entrada liberada", who + "credencial para hoje (" + when + "). PIN " + pin + ". Depois da primeira validação ela passa a dar <i>já utilizada</i> neste aparelho, que é o teste seguinte."]
      case "used": return ["Credencial já utilizada", who + "entrou hoje às " + esc(hm(acc.checked_in_at)) + ". PIN " + pin + "."]
      case "wrong_day": return ["Dia errado", who + "credencial para " + when + ": a portaria recusa e mostra a data certa. PIN " + pin + "."]
      case "expired": return ["Credenciamento inválido (expirada)", who + "credencial de " + when + ", que já passou. PIN " + pin + "."]
      case "unknown": return ["Credenciamento inválido (token inexistente)", "Um token que não existe no sistema. Qualquer PIN: o token é conferido antes dele."]
      case "bad_pin": return ["PIN inválido", who + "credencial válida para hoje. Toque em <i>Esquecer PIN</i>, digite <b>0000</b> e valide. A portaria descarta o PIN e pede de novo: volte com " + pin + "."]
      case "testing": return ["Entrada liberada com aviso de ensaio", who + esc(event(acc).name) + ", evento em período de testes: a data (" + dm(acc.attends_on) + ") não é conferida e a portaria avisa. PIN " + pin + "."]
    }
  }

  function cardContent(kind) {
    var acc = byToken(cards[kind])
    if (acc) return demo.qrContent(acc)
    // Mesmo formato, com id e token que nunca foram gravados.
    return JSON.stringify({ id: data.unknown_id, token: cards.unknown, validation_url: demo.gateUrl(cards.unknown) })
  }

  function cardsHtml() {
    return ["ok", "used", "wrong_day", "expired", "unknown", "bad_pin", "testing"].map(function (kind) {
      var info = cardInfo(kind)
      var token = cards[kind]
      return '<article class="pv-card" data-kind="' + kind + '">' +
        '<div class="pv-card__info"><h4>' + esc(info[0]) + "</h4><p>" + info[1] + "</p>" +
          '<code class="pv-token">' + esc(token) + "</code>" +
          '<div class="pv-card__actions">' +
            '<button type="button" class="pv-btn" data-pv-copy="' + esc(token) + '">Copiar token</button>' +
            '<button type="button" class="pv-btn" data-pv-full="' + kind + '">Tela cheia</button>' +
            '<a class="pv-btn" href="' + esc(demo.gateUrl(token)) + '">Abrir na portaria</a>' +
          "</div></div>" +
        '<div class="pv-card__qr">' + qrSvg(cardContent(kind), "260px") + "</div>" +
      "</article>"
    }).join("")
  }

  var panel = el('<aside class="pv-panel" id="pv-panel" role="dialog" aria-modal="true" aria-labelledby="pv-panel-title" hidden></aside>')
  var backdrop = el('<div class="pv-backdrop" data-pv-close hidden></div>')

  function renderPanel() {
    var today = weekday(data.today) + ", " + day(data.today, { day: "numeric", month: "long", year: "numeric" })
    var bf = demo.event(1)
    panel.innerHTML =
      '<header class="pv-panel__head"><h2 id="pv-panel-title">Como testar</h2>' +
        '<button type="button" class="pv-x" data-pv-close aria-label="Fechar">&times;</button></header>' +
      '<nav class="pv-parts" aria-label="Partes da demonstração">' + PARTS.map(function (p) {
        return '<a href="' + p[1] + '"' + (p[0] === part ? ' aria-current="page"' : "") + ">" + p[2] + "</a>"
      }).join("") + "</nav>" +
      '<div class="pv-panel__body">' +
        '<p class="pv-lead">A demonstração se passa no <b>' + esc(today) + "</b>, segundo dia da " + esc(bf.name) +
          ". É contra essa data que a portaria confere cada credencial. Nada sai daqui: não há servidor, e nenhum e-mail é enviado.</p>" +
        "<section><h3>O fluxo, em quatro passos</h3><ol class=\"pv-steps\">" +
          '<li><b>Cadastre-se</b> na <a href="evento.html#inscricao">página do evento</a>. Para entrar hoje, escolha <i>' + esc(weekday(data.today) + ", " + dm(data.today)) + "</i>; os outros dias dão <i>dia errado</i> ou <i>expirada</i>.</li>" +
          "<li><b>Veja ou baixe o QR Code</b> que aparece depois do envio (PDF, SVG ou PNG).</li>" +
          '<li><b>Abra a <a href="gate.html">portaria</a></b> e digite o PIN de demonstração: ' + pin + " (fictício).</li>" +
          "<li><b>Valide</b> de um destes jeitos: pela câmera (<i>Ler QR Code</i>), enviando a imagem baixada (<i>Ler de uma imagem</i>) ou colando o token no campo <i>Credencial</i>. Valide de novo para ver <i>já utilizada</i>.</li>" +
        "</ol></section>" +
        "<section><h3>Três jeitos de testar com câmera</h3><ol class=\"pv-steps\">" +
          "<li><b>No computador</b> (site publicado ou http://localhost): abra a portaria, toque em <i>Ler QR Code</i> e mostre para a webcam um QR aberto no celular, por exemplo este painel aberto lá.</li>" +
          "<li><b>No celular, pelo site publicado</b>: abra a portaria no celular, digite o PIN, toque em <i>Ler QR Code</i> e aponte para o QR na tela do computador.</li>" +
          "<li><b>Com o app de câmera do celular</b>: aponte para o QR. Ele abre o link de validação, que já chega na portaria com o token; aí é só o PIN.</li>" +
        "</ol>" +
        '<ul class="pv-small pv-notes">' +
          "<li>A câmera da página só abre em https:// ou em http://localhost. Do disco (file://) ou pelo IP da máquina, a portaria avisa e segue pela imagem ou pelo token.</li>" +
          "<li>QR gerado em localhost aponta para localhost, que o celular não alcança: no celular, use o site publicado.</li>" +
          "<li>Cada navegador guarda os próprios cadastros e check-ins. O <i>já utilizada</i> vale por aparelho.</li>" +
        "</ul>" +
        "</section>" +
        "<section><h3>Credenciais prontas</h3><p class=\"pv-small\">Uma por resultado esperado. Os mesmos credenciados aparecem no painel admin.</p>" +
          '<div class="pv-cards">' + cardsHtml() + "</div></section>" +
        '<section class="pv-reset"><h3>Recomeçar</h3><p class="pv-small">Apaga deste navegador os cadastros e check-ins feitos na demonstração e o PIN guardado na portaria.</p>' +
          '<button type="button" class="pv-btn pv-btn--solid" data-pv-reset>Recomeçar demonstração</button></section>' +
      "</div>"
  }

  function openPanel() {
    renderPanel()
    panel.hidden = false
    backdrop.hidden = false
    document.documentElement.classList.add("pv-lock")
    banner.querySelector("[data-pv-open]").setAttribute("aria-expanded", "true")
    panel.querySelector(".pv-x").focus()
  }

  function closePanel() {
    if (panel.hidden) return
    panel.hidden = true
    backdrop.hidden = true
    document.documentElement.classList.remove("pv-lock")
    var opener = banner.querySelector("[data-pv-open]")
    opener.setAttribute("aria-expanded", "false")
    opener.focus()
  }

  function copy(text) {
    var done = function () { toast("Token copiado: " + text) }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(done, fallback)
    fallback()
    function fallback() {
      var t = document.createElement("textarea")
      t.value = text
      t.setAttribute("readonly", "")
      t.style.position = "fixed"
      t.style.opacity = "0"
      document.body.appendChild(t)
      t.select()
      try { document.execCommand("copy"); done() } catch (e) { toast("Não deu para copiar. Selecione o token e copie à mão.") }
      t.remove()
    }
  }

  document.addEventListener("click", function (e) {
    var t = e.target
    if (t.closest("[data-pv-open]")) { panel.hidden ? openPanel() : closePanel(); return }
    if (t.closest("[data-pv-viewer-close]") || t === viewer) { closeViewer(); return }
    if (t.closest("[data-pv-close]")) { closePanel(); return }
    var c = t.closest("[data-pv-copy]")
    if (c) { copy(c.getAttribute("data-pv-copy")); return }
    var f = t.closest("[data-pv-full]")
    if (f) {
      var kind = f.getAttribute("data-pv-full")
      showQr({ title: cardInfo(kind)[0], subtitle: (byToken(cards[kind]) || { name: "Token inexistente" }).name, content: cardContent(kind) })
      return
    }
    if (t.closest("[data-pv-reset]")) {
      demo.reset()
      toast("Demonstração reiniciada.")
      setTimeout(function () { location.replace(location.pathname + (part === "admin" ? location.hash : "")) }, 700)
    }
  })

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return
    if (!viewer.hidden) closeViewer()
    else closePanel()
  })
  document.addEventListener("fullscreenchange", function () { if (!document.fullscreenElement && !viewer.hidden) closeViewer() })

  // ------------------------------------------------------------------ página do evento
  // Onde o app diria que mandou a confirmação, o preview avisa que o e-mail não sai, e oferece
  // o QR em tela cheia (o do formulário é pequeno para ler de longe) e a portaria.
  function augmentFeedback(box) {
    if (!box.classList.contains("is-success") || box.querySelector(".pv-note")) return
    var tokenEl = Array.prototype.find.call(box.querySelectorAll(".rr-details-term"), function (dt) { return dt.textContent === "Token" })
    var token = tokenEl && tokenEl.nextElementSibling && tokenEl.nextElementSibling.textContent
    var acc = token && demo.find(token)
    if (!acc) return
    var note = el('<div class="pv-note"><p><b>Demonstração:</b> o e-mail de confirmação não é enviado. No sistema real, ele sai para o endereço informado, com o QR Code em anexo.</p>' +
      '<div class="pv-note__actions"><button type="button" class="pv-btn" data-pv-own>QR em tela cheia</button>' +
      '<a class="pv-btn" href="' + esc(demo.qrPayload(acc).validation_url) + '">Validar na portaria</a></div></div>')
    note.querySelector("[data-pv-own]").addEventListener("click", function () {
      showQr({ title: acc.name, subtitle: weekday(acc.attends_on) + ", " + dm(acc.attends_on), content: demo.qrContent(acc) })
    })
    box.append(note)
  }

  // ------------------------------------------------------------------ montagem
  function mount() {
    document.body.prepend(banner)
    document.body.append(backdrop, panel, viewer, toastEl)
    var feedback = document.querySelector("#rr-accreditation .rr-feedback")
    if (feedback) new MutationObserver(function () { augmentFeedback(feedback) }).observe(feedback, { childList: true, attributes: true })
    if (/[?&]como-testar\b/.test(location.search) || location.hash === "#como-testar") openPanel()
  }

  window.RRKit = { toast: toast, showQr: showQr, qrSvg: qrSvg, openPanel: openPanel }
  if (document.body) mount()
  else document.addEventListener("DOMContentLoaded", mount)
})()
