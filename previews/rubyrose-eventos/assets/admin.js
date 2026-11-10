// Preview estático do painel do RubyRose Eventos. Cada tela vem de assets/pages.js e a navegação é
// por hash (#/events/1/accreditations). Os filtros do relatório trocam para a tela capturada com o
// mesmo filtro; o que gravaria algo mostra um aviso. Os cadastros e check-ins feitos na página do
// evento e na portaria deste navegador aparecem nas listas, marcados como criados na demonstração.
(function () {
  "use strict"

  var PAGES = window.PREVIEW_PAGES || {}
  var SIDEBARS = window.PREVIEW_SIDEBARS || []
  var demo = window.RRDemo
  var kit = window.RRKit
  var app = document.getElementById("app")
  var ENTRY = "/login"
  var ALLOWED = ["page", "per_page", "status", "attends_on"]
  var DEFAULTS = { page: "1", per_page: "10" }
  var BY_ID = {}
  demo.data.accreditations.forEach(function (a) { BY_ID[a.id] = a })

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)) }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] }) }
  var keyFrom = function (hash) { return hash && hash.charAt(0) === "#" && hash.charAt(1) === "/" ? decodeURI(hash.slice(1)) : null }
  var currentKey = function () { return keyFrom(location.hash) || ENTRY }

  // Mesma normalização da captura: só os filtros conhecidos, sem os valores padrão, em ordem.
  function normalize(path, params) {
    var q = ALLOWED.filter(function (k) { return params[k] && params[k] !== DEFAULTS[k] }).sort()
      .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]) })
    return q.length ? path + "?" + q.join("&") : path
  }

  function parseKey(key) {
    var parts = key.split("?")
    var params = {}
    new URLSearchParams(parts[1] || "").forEach(function (v, k) { params[k] = v })
    return { path: parts[0], params: params }
  }

  // ---------------------------------------------------------------- formatos do painel
  var dmy = function (iso) { var p = iso.slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0] }
  var stamp = function (iso) { return dmy(iso) + " às " + iso.slice(11, 16) } // time.formats.default
  var weekday = function (iso) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z")) }
  var parameterize = function (s) { return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }

  // AccreditationsHelper#whatsapp_masked e #instagram_handle
  function whatsappMasked(v) {
    var d = String(v || "").replace(/\D/g, "")
    if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2)
    if (d.length === 11) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7)
    if (d.length === 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6)
    return v
  }
  function instagramHandle(v) { var h = String(v || "").trim().replace(/^@+/, ""); return h ? "@" + h : null }
  var contact = function (text, icon) { return '<span class="link-body-emphasis"><i class="bi ' + icon + ' me-1"></i>' + esc(text) + "</span>" }

  var BADGE_CREATED = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle pv-demo-badge ms-1">criado nesta demonstração</span>'
  var BADGE_CHECKIN = '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle pv-demo-badge">check-in nesta demonstração</span>'

  function checkInCell(at, demoCheckIn) {
    if (!at) return '<span class="badge text-bg-light border">Pendente</span>'
    return '<span class="badge text-bg-success">Entrou</span><div class="text-body-secondary small">' + esc(stamp(at)) + "</div>" + (demoCheckIn ? BADGE_CHECKIN : "")
  }

  // Cadastro feito na página do evento deste navegador.
  function demoRow(acc) {
    var insta = instagramHandle(acc.instagram)
    return '<tr class="pv-demo-row"><td class="fw-semibold">' + esc(acc.name) + BADGE_CREATED + "</td>" +
      "<td><div>" + contact(acc.email, "bi-envelope") + '</div><div class="small">' + contact(whatsappMasked(acc.whatsapp), "bi-whatsapp") + "</div></td>" +
      "<td>" + (insta ? contact(insta, "bi-instagram") : "—") + "</td>" +
      "<td>" + esc(dmy(acc.attends_on)) + '<div class="text-body-secondary small text-capitalize">' + esc(weekday(acc.attends_on)) + "</div></td>" +
      "<td>" + checkInCell(demo.checkedInAt(acc), false) + "</td>" +
      '<td class="text-end"><button type="button" class="btn btn-sm btn-outline-secondary" data-pv-qr="' + esc(acc.token) + '"><i class="bi bi-qr-code"></i> Reexibir</button></td></tr>'
  }

  // Credenciado do painel que fez check-in na portaria desta demonstração: a mesma linha que o
  // relatório já mostra em outra tela capturada, com a situação atualizada.
  function seededRow(acc) {
    var keys = Object.keys(PAGES).filter(function (k) { return k.indexOf("/events/" + acc.event_id + "/accreditations") === 0 })
    for (var i = 0; i < keys.length; i++) {
      var t = document.createElement("template")
      t.innerHTML = PAGES[keys[i]].h
      var a = t.content.querySelector('tbody a[href="#/accreditations/' + acc.id + '"]')
      if (!a) continue
      var tr = a.closest("tr")
      tr.children[4].innerHTML = checkInCell(demo.checkedInAt(acc), true)
      return tr.outerHTML
    }
    return ""
  }

  var TABLE = '<div class="card shadow-sm"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr>' +
    '<th scope="col">Nome</th><th scope="col">Contato</th><th scope="col">Instagram</th><th scope="col">Data escolhida</th>' +
    '<th scope="col">Check-in</th><th scope="col" class="text-end">QR Code</th></tr></thead><tbody></tbody></table></div></div>'

  // ---------------------------------------------------------------- o que foi feito nesta demonstração
  function demoCheckins(eventId) {
    var map = demo.checkins()
    return Object.keys(map).map(function (token) { return { acc: demo.find(token), at: map[token] } })
      .filter(function (c) { return c.acc && !c.acc.remote && c.acc.event_id === eventId })
  }

  // Relatório de credenciados: novos cadastros no topo da primeira página e check-ins refletidos.
  function overlayList(eventId, params) {
    var status = params.status, day = params.attends_on
    var map = demo.checkins()
    var matches = function (acc) {
      var at = demo.checkedInAt(acc)
      return (!day || acc.attends_on === day) && (!status || (status === "checked_in") === !!at)
    }

    $$("tbody tr", app).forEach(function (tr) {
      var link = tr.querySelector('a[href^="#/accreditations/"]')
      var acc = link && BY_ID[link.getAttribute("href").split("/").pop()]
      if (!acc || !map[acc.token]) return
      if (status === "pending") { tr.hidden = true; return }
      tr.children[4].innerHTML = checkInCell(map[acc.token], true)
    })

    if (params.page && params.page !== "1") return
    var rows = demo.created(eventId).filter(matches).reverse().map(demoRow)
    if (status === "checked_in") {
      rows = rows.concat(demoCheckins(eventId).filter(function (c) { return demo.seeded(c.acc.token) && matches(c.acc) })
        .map(function (c) { return seededRow(c.acc) }))
    }
    rows = rows.filter(Boolean)
    if (!rows.length) return

    var tbody = app.querySelector("table tbody")
    if (!tbody) {
      var empty = $$(".card", app).filter(function (c) { return c.querySelector(".card-body.text-center.py-5") }).pop()
      if (!empty) return
      empty.outerHTML = TABLE
      tbody = app.querySelector("table tbody")
    }
    tbody.insertAdjacentHTML("afterbegin", rows.join(""))
  }

  // Painel do evento: contagens e últimos check-ins.
  function overlayDashboard(eventId) {
    var created = demo.created(eventId)
    var checks = demoCheckins(eventId)
    if (!created.length && !checks.length) return
    var nums = $$(".display-6", app)
    if (nums.length === 3) {
      var total = Number(nums[0].textContent) + created.length
      var checked = Number(nums[1].textContent) + checks.length
      nums[0].textContent = total
      nums[1].textContent = checked
      nums[2].textContent = total - checked
    }
    if (!checks.length) return
    var items = checks.sort(function (a, b) { return a.at < b.at ? 1 : -1 }).map(function (c) {
      var name = demo.seeded(c.acc.token)
        ? '<a class="link-body-emphasis text-decoration-none" href="#/accreditations/' + esc(c.acc.id) + '">' + esc(c.acc.name) + "</a>"
        : '<span>' + esc(c.acc.name) + "</span>"
      return '<li class="list-group-item d-flex justify-content-between align-items-center px-0"><span>' + name + " " + BADGE_CHECKIN + '</span><span class="text-body-secondary small">' + esc(stamp(c.at)) + "</span></li>"
    })
    var list = app.querySelector("ul.list-group")
    if (!list) {
      var none = $$("p.text-body-secondary.mb-0", app).filter(function (p) { return /Nenhum check-in/.test(p.textContent) })[0]
      if (!none) return
      none.outerHTML = '<ul class="list-group list-group-flush"></ul>'
      list = app.querySelector("ul.list-group")
    }
    list.insertAdjacentHTML("afterbegin", items.join(""))
    $$("li", list).slice(5).forEach(function (li) { li.remove() })
  }

  // Tela do credenciado: situação depois de um check-in feito na portaria.
  function overlayShow(id) {
    var acc = BY_ID[id]
    var at = acc && demo.checkins()[acc.token]
    var dd = at && app.querySelector("dl dd")
    if (dd) dd.innerHTML = '<span class="badge text-bg-success">Entrou</span> <span class="text-body-secondary small">em ' + esc(stamp(at)) + "</span> " + BADGE_CHECKIN
  }

  // ---------------------------------------------------------------- render
  function qrMatrix(acc) { return window.RRQR.encode(demo.qrContent(acc)) }

  function hydrate(key) {
    $$("img[data-qr-id]", app).forEach(function (img) {
      var acc = BY_ID[img.getAttribute("data-qr-id")]
      if (acc) img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(window.RRQR.svg(qrMatrix(acc), 6))
    })
    var k = parseKey(key)
    var m
    if ((m = /^\/events\/(\d+)\/accreditations$/.exec(k.path))) overlayList(Number(m[1]), k.params)
    else if ((m = /^\/events\/(\d+)$/.exec(k.path))) overlayDashboard(Number(m[1]))
    else if ((m = /^\/accreditations\/([0-9a-f-]+)$/.exec(k.path))) overlayShow(m[1])
  }

  function render(key) {
    var shown = document.querySelector(".pv-toast.show")
    if (shown) shown.classList.remove("show")
    var page = PAGES[key]
    if (!page) {
      page = PAGES[key.split("?")[0]] || PAGES[ENTRY]
      if (keyFrom(location.hash)) kit.toast("Esta tela não faz parte do preview.")
    }
    app.innerHTML = page.s == null
      ? '<main class="container d-flex flex-column justify-content-center min-vh-100 py-5">' + page.h + "</main>"
      : '<div class="d-flex flex-column flex-md-row min-vh-100">' + SIDEBARS[page.s] + '<main class="flex-grow-1 p-4">' + page.h + "</main></div>"
    document.title = (page.t ? page.t + " · " : "") + "Credenciamento - Ruby Rose · Preview"
    hydrate(key)
    window.scrollTo(0, 0)
  }

  function go(key) {
    if (currentKey() === key) render(key)
    else location.hash = key
  }

  window.addEventListener("hashchange", function () { render(currentKey()) })
  demo.onChange(function () { if (/^\/(events|accreditations)\//.test(currentKey())) render(currentKey()) })

  // ---------------------------------------------------------------- cliques
  var OFF = {
    action: null,
    file: "O download do arquivo fica só no sistema real.",
    contact: "Contato fictício: na demonstração, o link não abre.",
    "": "Esta tela não faz parte do preview."
  }

  function downloadPng(acc) {
    var matrix = qrMatrix(acc)
    var scale = Math.max(4, Math.round(600 / (matrix.length + 2 * window.RRQR.quietZone)))
    window.RRQR.png(matrix, scale).then(function (blob) {
      var url = URL.createObjectURL(blob)
      var a = document.createElement("a")
      a.href = url
      a.download = "credencial-" + parameterize(acc.name) + ".png"
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
    })
  }

  document.addEventListener("click", function (e) {
    var t = e.target
    var off = t.closest("[data-off]")
    if (off) { e.preventDefault(); kit.toast(OFF[off.getAttribute("data-off")]); return }

    var png = t.closest("[data-pv-png]")
    if (png) { e.preventDefault(); var acc = BY_ID[png.getAttribute("data-pv-png")]; if (acc) downloadPng(acc); return }

    var qr = t.closest("[data-pv-qr]")
    if (qr) {
      var created = demo.find(qr.getAttribute("data-pv-qr"))
      if (created) kit.showQr({ title: created.name, subtitle: dmy(created.attends_on) + " · " + weekday(created.attends_on), content: demo.qrContent(created) })
      return
    }

    var link = t.closest("a[href]")
    var key = link && keyFrom(link.getAttribute("href"))
    if (key && key === currentKey()) { e.preventDefault(); render(key) }
  })

  // ---------------------------------------------------------------- formulários
  document.addEventListener("submit", function (e) {
    var form = e.target
    if (!app.contains(form)) return
    e.preventDefault()
    var kind = form.getAttribute("data-pv")
    if (kind === "login") { go("/"); return }
    if (kind === "logout") { go(ENTRY); return }

    var base = form.getAttribute("data-get")
    if (!base) { kit.toast(); return }

    var params = {}
    new FormData(form).forEach(function (v, k) { params[k] = String(v).trim() })
    params.page = ""
    var tries = [normalize(base, params)]
    if (params.per_page) tries.push(normalize(base, Object.assign({}, params, { per_page: "" })))
    tries.push(base)
    var found = tries.filter(function (k) { return PAGES[k] })[0]
    go(found || base) // antes do aviso: trocar de tela apaga o aviso da tela anterior
    if (params.q) kit.toast("Na demonstração a busca por nome, e-mail ou CPF fica desligada; os filtros de dia e de situação funcionam.")
    else if (found !== tries[0]) kit.toast("Essa combinação não foi capturada para o preview; mostrando a mais próxima.")
  })

  render(currentKey())
})()
