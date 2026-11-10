// API simulada do preview do RubyRose Eventos. SÓ EXISTE NO PREVIEW: não faz parte do app.
//
// Carregada antes do script de cada página, intercepta o window.fetch nos três endpoints que a
// página do evento e a portaria usam e responde no mesmo formato JSON e com os mesmos status HTTP
// da API real. As regras foram transcritas do servidor, sem inventar:
//
//   GET  /events/:id                  EventsController#show
//   POST /events/:id/accreditations   AccreditationsController#create + Accreditation + Event
//   POST /gate/check-in               Gate::CheckInsController#create
//
// As páginas apontam para https://api.demonstracao.invalid. O domínio .invalid é reservado
// (RFC 2606) e nunca resolve: se este arquivo falhar ao carregar, a requisição morre no navegador
// em vez de sair para algum servidor. O domínio de produção do Railway é bloqueado com erro no
// console, caso alguma coisa ainda tente chamá-lo. O resto passa direto.
//
// O "hoje" da demonstração é fixo (RR_DEMO_DATA.today, 06/09/2026, segundo dia da Beauty Fair 2026):
// é contra ele que a portaria confere expiração e dia errado. O horário do check-in é o do relógio.
//
// O estado (credenciamentos e check-ins feitos aqui) fica no localStorage deste navegador. Nenhum
// e-mail é enviado.
(function () {
  "use strict"

  var DATA = window.RR_DEMO_DATA
  var API = "https://api.demonstracao.invalid"
  var STORE = "rubyrose.preview.demo"
  var GATE_PIN_KEY = "rubyrose.gate.pin" // o mesmo nome que o gate.html usa
  var BLOCKED_HOST = /(^|\.)up\.railway\.app$|rubyroseeventos/i
  var LATENCY = 350
  var DAILY_CAPACITY = 1000 // Event::DAILY_CAPACITY

  var nativeFetch = window.fetch ? window.fetch.bind(window) : null
  var memory = null // usado quando o navegador bloqueia o localStorage

  // ------------------------------------------------------------------ estado
  function blank() { return { v: 1, accreditations: [], checkins: {}, learned: {} } }

  function load() {
    try {
      var raw = localStorage.getItem(STORE)
      var state = raw ? JSON.parse(raw) : null
      if (state && state.v === 1) return state
      return blank()
    } catch (e) {
      return memory || (memory = blank())
    }
  }

  function save(state) {
    memory = state
    try { localStorage.setItem(STORE, JSON.stringify(state)) } catch (e) { /* segue em memória */ }
    emit()
  }

  function emit() {
    try { window.dispatchEvent(new CustomEvent("rrdemo:change")) } catch (e) { /* navegador antigo */ }
  }

  window.addEventListener("storage", function (e) { if (e.key === STORE || e.key === null) emit() })

  // ------------------------------------------------------------------ consultas
  var EVENTS = {}
  DATA.events.forEach(function (e) { EVENTS[e.id] = e })
  var SEEDED = {}
  DATA.accreditations.forEach(function (a) { SEEDED[a.token] = a })

  function findEvent(id) {
    // Event.find(params[:id]): "1" acha o 1; "abc" ou "1abc" não acham nada aqui.
    return /^\d+$/.test(String(id)) ? EVENTS[Number(id)] || null : null
  }

  function findByToken(token) {
    token = String(token == null ? "" : token)
    if (SEEDED[token]) return SEEDED[token]
    var state = load()
    for (var i = 0; i < state.accreditations.length; i++) if (state.accreditations[i].token === token) return state.accreditations[i]
    return state.learned[token] || null
  }

  function countOn(eventId, day) {
    var n = DATA.accreditations.filter(function (a) { return a.event_id === eventId && a.attends_on === day }).length
    return n + load().accreditations.filter(function (a) { return a.event_id === eventId && a.attends_on === day }).length
  }

  function covers(event, day) { return !!day && day >= event.starts_on && day <= event.ends_on }
  function openDays(event) { return event.days.filter(function (d) { return countOn(event.id, d) < DAILY_CAPACITY }) }

  function checkedInAt(acc) {
    return acc.checked_in_at || load().checkins[acc.token] || null
  }

  // ------------------------------------------------------------------ utilidades
  function squish(v) { return v == null ? null : String(v).replace(/\s+/g, " ").trim() }
  function presence(v) { return v == null || v === "" ? null : v }
  function digits(v) { return v == null ? null : presence(String(v).replace(/\D/g, "")) }

  // O cast de data do Rails: data inválida vira nil e cai no "não pode ficar em branco".
  function isoDate(v) {
    var s = squish(v)
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
    var d = new Date(s + "T00:00:00Z")
    return isNaN(d) || d.toISOString().slice(0, 10) !== s ? null : s
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID()
    var b = new Uint8Array(16)
    crypto.getRandomValues(b)
    b[6] = (b[6] & 0x0f) | 0x40
    b[8] = (b[8] & 0x3f) | 0x80
    var h = Array.prototype.map.call(b, function (x) { return (x + 0x100).toString(16).slice(1) }).join("")
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20)
  }

  // Data simulada + hora do relógio, no fuso da aplicação (Brasília, sem horário de verão).
  function nowIso() {
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).format(new Date())
    return DATA.today + "T" + parts + "-03:00"
  }

  function dmy(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0] }

  function b64url(text) {
    var bytes = new TextEncoder().encode(text)
    var bin = ""
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  }

  function fromB64url(text) {
    var bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"))
    var bytes = new Uint8Array(bin.length)
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  }

  // ------------------------------------------------------------------ QR Code
  // Mesmo formato do app: { id, token, validation_url }, e a validation_url aponta para a
  // gate.html do próprio preview, calculada a partir do endereço desta página.
  //
  // SÓ NA DEMONSTRAÇÃO: o estado é por navegador, então a credencial criada aqui não existe no
  // celular que lê o QR na tela do computador. Para a portaria do outro aparelho reconhecê-la, a
  // validation_url leva no fragmento (#demo=..., que nunca vai a servidor nenhum) o nome, o evento,
  // o dia e o id, em base64. No app real o QR Code não carrega dado pessoal nenhum; aqui o nome vai
  // junto só porque é inventado por quem testa. O "já utilizada" vale por aparelho.
  function demoFragment(acc) {
    return acc.fragment || b64url(JSON.stringify([acc.name, acc.event_id, acc.attends_on, acc.id]))
  }

  function gateUrl(token, fragment) {
    var url = new URL("gate.html", location.href)
    url.search = "?token=" + encodeURIComponent(token)
    url.hash = fragment ? "demo=" + fragment : ""
    return url.href
  }

  function qrPayload(acc) {
    var seeded = !!SEEDED[acc.token]
    return { id: acc.id, token: acc.token, validation_url: gateUrl(acc.token, seeded ? null : demoFragment(acc)) }
  }

  // Credencial criada em outro aparelho: chega pelo fragmento da validation_url (link aberto
  // pelo app de câmera) ou pelo conteúdo lido do QR (câmera da portaria, "Ler de uma imagem").
  function remember(token, fragment) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) || findByToken(token)) return false
    var fields
    try { fields = JSON.parse(fromB64url(fragment)) } catch (e) { return false }
    if (!Array.isArray(fields) || fields.length < 4) return false
    var name = squish(fields[0]), event = findEvent(fields[1]), day = isoDate(fields[2]), id = String(fields[3] || "")
    if (!name || name.length > 120 || !event || !day || !/^[0-9a-f-]{36}$/i.test(id)) return false
    var state = load()
    state.learned[token] = { id: id, token: token, event_id: event.id, name: name, attends_on: day, fragment: fragment, remote: true }
    save(state)
    return true
  }

  function learn(raw) {
    var text = String(raw == null ? "" : raw)
    var payload = null
    try { payload = JSON.parse(text) } catch (e) { /* não era JSON */ }
    var url = payload && typeof payload.validation_url === "string" ? payload.validation_url : text
    var m = /[?&]token=([0-9a-f-]{36})[^#\s"]*#demo=([A-Za-z0-9_-]+)/i.exec(url)
    return m ? remember(m[1], m[2]) : false
  }

  // Aberta pelo link do QR Code (app de câmera do celular): aprende antes de a portaria validar.
  ;(function () {
    var token = new URLSearchParams(location.search).get("token")
    var m = /(?:^#|&)demo=([A-Za-z0-9_-]+)/.exec(location.hash)
    var t = token && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(token)
    if (t && m) remember(t[0], m[1])
  })()

  // ------------------------------------------------------------------ endpoints
  function json(status, body) { return { status: status, body: body } }
  var NOT_FOUND = { message: "Recurso não encontrado." } // ApplicationController#render_not_found

  // EventsController#show
  function showEvent(id) {
    var e = findEvent(id)
    if (!e) return json(404, NOT_FOUND)
    return json(200, { id: e.id, name: e.name, starts_on: e.starts_on, ends_on: e.ends_on, days: e.days.slice(), open_days: openDays(e) })
  }

  // AccreditationsController#create, com as validações e a normalização do modelo Accreditation.
  function createAccreditation(eventId, params) {
    var event = findEvent(eventId)
    if (!event) return json(404, NOT_FOUND)
    var input = params && params.accreditation
    if (!input || typeof input !== "object") return json(400, { status: 400, error: "Bad Request" }) // params.expect

    var acc = {
      name: presence(squish(input.name)),
      email: presence(squish(input.email) && squish(input.email).toLowerCase()),
      cpf: digits(input.cpf),
      whatsapp: digits(input.whatsapp),
      instagram: presence(squish(input.instagram)),
      attends_on: isoDate(input.attends_on)
    }

    var errors = {}
    var add = function (field, message) { (errors[field] = errors[field] || []).push(message) }
    ;["name", "email", "cpf", "whatsapp", "attends_on"].forEach(function (f) { if (!acc[f]) add(f, "não pode ficar em branco") })
    // Único dentro do evento. Os CPFs inventados do painel não vêm para o preview, então a
    // repetição é conferida contra os cadastros feitos nesta demonstração.
    if (acc.cpf && load().accreditations.some(function (a) { return a.event_id === event.id && a.cpf === acc.cpf })) {
      add("cpf", "Já houve cadastro em outra data")
    }
    if (acc.attends_on && !covers(event, acc.attends_on)) add("attends_on", "não está dentro do período do evento")
    else if (acc.attends_on && countOn(event.id, acc.attends_on) >= DAILY_CAPACITY) add("attends_on", "Este dia já atingiu a lotação máxima. Escolha outra data.")

    if (Object.keys(errors).length) return json(422, { errors: errors })

    acc.id = uuid()
    acc.token = uuid()
    acc.event_id = event.id
    acc.created_at = nowIso()
    var state = load()
    state.accreditations.push(acc)
    save(state)
    // Sem e-mail: no app a confirmação seria enfileirada aqui. A página avisa que não sai.

    var qr = qrPayload(acc)
    return json(201, {
      message: "Credenciamento realizado com sucesso.",
      accreditation: {
        id: acc.id, event_id: acc.event_id, name: acc.name, email: acc.email, cpf: acc.cpf,
        whatsapp: acc.whatsapp, instagram: acc.instagram, attends_on: acc.attends_on,
        qr_code: qr, qr_code_content: JSON.stringify(qr)
      }
    })
  }

  // Gate::CheckInsController#create
  function checkIn(params) {
    params = params || {}
    var acc = findByToken(params.token)
    if (!acc) return json(404, { message: "credenciamento inválido" })
    var event = findEvent(acc.event_id)
    // O PIN é conferido antes de qualquer resposta sobre o estado da credencial.
    if (String(params.pin == null ? "" : params.pin) !== DATA.pin) return json(401, { message: "PIN inválido." })

    if (!event.testing) {
      if (acc.attends_on < DATA.today) return json(410, { message: "credenciamento inválido" }) // expired?
      if (acc.attends_on !== DATA.today) {
        return json(403, { status: "wrong_day", message: "Credencial válida somente em " + dmy(acc.attends_on) + ".", attends_on: acc.attends_on })
      }
    }

    if (checkedInAt(acc)) return json(403, { status: "blocked", message: "Credencial já utilizada." })

    var at = nowIso()
    var state = load()
    state.checkins[acc.token] = at
    save(state)
    return json(200, {
      status: "checked_in",
      message: "Check-in realizado com sucesso.",
      testing: !!event.testing,
      accreditation: { id: acc.id, name: acc.name, checked_in_at: at }
    })
  }

  function route(url, init) {
    var method = String((init && init.method) || "GET").toUpperCase()
    var params = null
    if (method !== "GET" && init && init.body != null) {
      try { params = JSON.parse(String(init.body)) } catch (e) { return json(400, { status: 400, error: "Bad Request" }) }
    }
    var m
    if (method === "GET" && (m = /^\/events\/([^/]+)$/.exec(url.pathname))) return showEvent(m[1])
    if (method === "POST" && (m = /^\/events\/([^/]+)\/accreditations$/.exec(url.pathname))) return createAccreditation(m[1], params)
    if (method === "POST" && url.pathname === "/gate/check-in") return checkIn(params)
    return json(404, NOT_FOUND)
  }

  if (nativeFetch) {
    window.fetch = function (input, init) {
      var url
      try { url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url, location.href) } catch (e) { return nativeFetch(input, init) }

      if (BLOCKED_HOST.test(url.hostname)) {
        console.error("[demonstração] Requisição bloqueada para " + url.origin + ": o preview nunca fala com a API de produção.")
        return Promise.reject(new TypeError("Requisição bloqueada pela demonstração"))
      }
      if (url.origin !== API) return nativeFetch(input, init)

      var result = route(url, init)
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(new Response(JSON.stringify(result.body), { status: result.status, headers: { "Content-Type": "application/json; charset=utf-8" } }))
        }, LATENCY)
      })
    }
  }

  // ------------------------------------------------------------------ para o painel e o "Como testar"
  window.RRDemo = {
    API: API,
    data: DATA,
    today: DATA.today,
    pin: DATA.pin,
    event: findEvent,
    find: findByToken,
    seeded: function (token) { return SEEDED[token] || null },
    created: function (eventId) {
      return load().accreditations.filter(function (a) { return eventId == null || a.event_id === eventId })
    },
    checkins: function () { return load().checkins },
    checkedInAt: checkedInAt,
    qrPayload: qrPayload,
    qrContent: function (acc) { return JSON.stringify(qrPayload(acc)) },
    gateUrl: gateUrl,
    learn: learn,
    reset: function () {
      memory = blank()
      try { localStorage.removeItem(STORE); localStorage.removeItem(GATE_PIN_KEY) } catch (e) { /* nada a fazer */ }
      emit()
    },
    onChange: function (fn) { window.addEventListener("rrdemo:change", fn) }
  }
})()
