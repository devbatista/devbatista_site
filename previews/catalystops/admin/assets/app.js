// Preview estático do CatalystOps: cada tela vem de assets/pages.js e a navegação é por hash
// (#/order_services). Reproduz sem servidor o que o layout faz no navegador (menu, modais e abas do
// Bootstrap, gráficos, calendário, select2, máscaras); o que gravaria algo mostra um aviso.
(function () {
  "use strict"

  var CFG = window.PREVIEW_CONFIG || {}
  var PAGES = window.PREVIEW_PAGES || {}
  var DATA = window.PREVIEW_DATA || {}
  var $ = window.jQuery
  var root = document.getElementById("pv-content")
  var wrapper = document.querySelector(".wrapper")
  var toastEl = document.querySelector("[data-toast]")
  var menuItems = Array.prototype.slice.call(document.querySelectorAll("#menu li"))
  var charts = []
  var calendar = null
  var toastTimer

  var MSG = {
    action: "Isto é um preview: as ações que gravam dados estão desativadas.",
    file: "O download do arquivo fica só no sistema real.",
    area: "Esta área (login, cadastro ou portal do cliente) não faz parte do preview.",
    missing: "Esta tela não faz parte do preview.",
    filter: "No sistema real, a tela recarrega com o filtro escolhido.",
    search: "Na demonstração, a busca filtra só os registros desta página."
  }

  // ---------- Utilidades ----------
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)) }
  var keyFrom = function (hash) { return hash && hash.charAt(0) === "#" && hash.charAt(1) === "/" ? hash.slice(1) : null }
  var currentKey = function () { return keyFrom(location.hash) || "/" }
  var plain = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim() }

  function toast(msg) {
    toastEl.textContent = msg || MSG.action
    toastEl.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.classList.remove("show") }, 3000)
  }

  // Mesma regra do build: só os parâmetros que mudam a visão, em ordem alfabética, sem page=1.
  function keyFor(path, params) {
    var allowed = CFG.allowed || []
    var pairs = []
    params.forEach(function (v, k) {
      if (allowed.indexOf(k) < 0 || !v || (k === "page" && v === "1")) return
      if (pairs.some(function (p) { return p[0] === k })) return
      pairs.push([k, v])
    })
    pairs.sort(function (a, b) { return a[0] < b[0] ? -1 : 1 })
    var q = pairs.map(function (p) { return encodeURIComponent(p[0]) + "=" + encodeURIComponent(p[1]).replace(/%20/g, "+") }).join("&")
    return q ? path + "?" + q : path
  }

  // ---------- Bibliotecas sob demanda (calendário) ----------
  var loaded = {}
  function load(name, done) {
    var files = (CFG.lazy || {})[name] || []
    if (loaded[name] === true) return done()
    if (loaded[name]) return loaded[name].push(done)
    loaded[name] = [done]
    var next = function (i) {
      if (i >= files.length) { var cbs = loaded[name]; loaded[name] = true; cbs.forEach(function (cb) { cb() }); return }
      var s = document.createElement("script")
      s.src = files[i]
      s.onload = function () { next(i + 1) }
      s.onerror = function () { console.warn("Falha ao carregar " + files[i]) }
      document.body.appendChild(s)
    }
    next(0)
  }

  // ---------- Gráficos (os mesmos do app/javascript/application.js) ----------
  var COLORS = { primary: "#0d6efd", secondary: "#6c757d", success: "#198754", danger: "#dc3545", warning: "#ffc107", info: "#0dcaf0", dark: "#343a40", light: "#f8f9fa" }

  function dashboardChart(el) {
    var canvas = el.querySelector("#chart2")
    if (!canvas || !window.Chart) return
    var labels = [], data = [], colors = []
    $$("#os-status-list li", el).forEach(function (li) {
      labels.push(li.dataset.status)
      data.push(parseInt(li.dataset.count, 10))
      colors.push(COLORS[(li.dataset.colorKey || "").replace("bg-", "")] || "#6c757d")
    })
    charts.push(new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: { labels: labels, datasets: [{ backgroundColor: colors, data: data, borderWidth: 0 }] },
      options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, cutout: "70%" }
    }))
  }

  function reportsCharts(el) {
    var d = el.querySelector("#reports-charts-data")
    var volume = el.querySelector("#reports-volume-chart")
    var status = el.querySelector("#reports-status-chart")
    if (!d || !volume || !status || !window.Chart) return
    var j = function (v) { try { return JSON.parse(v || "[]") } catch (e) { return [] } }
    var ds = d.dataset
    var sets = [
      { label: ds.trendPrimaryLabel || "Total", data: j(ds.trendPrimaryValues), backgroundColor: "rgba(13, 110, 253, 0.35)", borderColor: "#0d6efd", borderWidth: 1, borderRadius: 6, yAxisID: "yCount" },
      { label: ds.trendSecondaryLabel || "Sucesso", data: j(ds.trendSecondaryValues), backgroundColor: "rgba(25, 135, 84, 0.45)", borderColor: "#198754", borderWidth: 1, borderRadius: 6, yAxisID: "yCount" }
    ]
    var third = j(ds.trendTertiaryValues)
    if (ds.trendTertiaryLabel && third.some(function (v) { return Number(v) > 0 })) {
      sets.push({ label: ds.trendTertiaryLabel, data: third, backgroundColor: "rgba(220, 53, 69, 0.45)", borderColor: "#dc3545", borderWidth: 1, borderRadius: 6, yAxisID: "yCount" })
    }
    charts.push(new Chart(volume.getContext("2d"), {
      type: "bar",
      data: { labels: j(ds.trendLabels), datasets: sets },
      options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: true } }, scales: { yCount: { type: "linear", position: "left", beginAtZero: true, ticks: { precision: 0 } } } }
    }))
    charts.push(new Chart(status.getContext("2d"), {
      type: "bar",
      data: { labels: j(ds.statusLabels), datasets: [{ label: "Registros por status", data: j(ds.statusValues), backgroundColor: j(ds.statusColors), borderRadius: 8 }] },
      options: { maintainAspectRatio: false, responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    }))
  }

  // ---------- Calendário (o mesmo do calendar_controller.js, com os eventos capturados) ----------
  var TECH_COLORS = ["#0D6EFD", "#198754", "#FD7E14", "#6F42C1", "#D63384", "#20C997", "#DC3545", "#0DCAF0"]
  var FINISHED = { backgroundColor: "#0D6EFD", borderColor: "#084298", textColor: "#FFFFFF" }

  function techColor(id) {
    var s = String(id || ""), h = 0
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0 }
    return TECH_COLORS[Math.abs(h) % TECH_COLORS.length]
  }

  function calendarEvents(selected) {
    var source = DATA["/calendar/events"] || []
    var title = function (ev, fallback) { return ev.status === "finalizada" ? "[Finalizada] " + fallback : fallback }
    var colors = function (ev) { return ev.status === "finalizada" ? FINISHED : {} }
    if (!selected.length) {
      return source.map(function (ev) {
        return Object.assign({ id: ev.id, title: title(ev, ev.default_title), start: ev.start, end: ev.end, url: ev.url || undefined }, colors(ev))
      })
    }
    var out = []
    source.forEach(function (ev) {
      (ev.technicians || []).forEach(function (t) {
        if (selected.indexOf(String(t.id)) < 0) return
        var c = techColor(t.id)
        out.push({ id: ev.id + "-" + t.id, title: title(ev, ev.base_title), start: ev.start, end: ev.end, url: ev.url || undefined,
          backgroundColor: colors(ev).backgroundColor || c, borderColor: colors(ev).borderColor || c, textColor: "#FFFFFF" })
      })
    })
    return out
  }

  function setupCalendar(el) {
    var box = el.querySelector('[data-controller~="calendar"]')
    if (!box) return
    load("calendar", function () {
      if (!box.isConnected || typeof FullCalendar === "undefined") return
      var target = box.querySelector('[data-calendar-target="calendar"]') || box
      var filter = box.querySelector('[data-calendar-target="technicianFilter"]')
      var selected = []
      calendar = new FullCalendar.Calendar(target, {
        locale: "pt-br",
        initialDate: CFG.now,
        now: CFG.now,
        headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" },
        initialView: "dayGridMonth",
        // dayMaxEvents: true quebra o FullCalendar 5.3.2 em telas estreitas (células baixas demais);
        // no celular o limite fica fixo em 2, o que mantém o "+N mais" sem o erro.
        navLinks: true, selectable: true, nowIndicator: true, dayMaxEvents: window.innerWidth < 600 ? 2 : true, editable: true, businessHours: true,
        events: function (info, ok) { ok(calendarEvents(selected)) },
        eventClick: function (info) {
          info.jsEvent.preventDefault()
          if (info.event.url) location.hash = info.event.url
          else toast(MSG.missing)
        },
        eventDrop: function () { toast("Evento movido só nesta demonstração.") }
      })
      calendar.render()
      box.classList.remove("invisible")
      calendar.updateSize()
      if (filter) {
        filter.innerHTML = ""
        ;(DATA["/calendar/technicians"] || []).forEach(function (t) {
          var o = document.createElement("option")
          o.value = String(t.id)
          o.textContent = t.name
          filter.appendChild(o)
        })
        var reload = function () {
          selected = ([]).concat($ ? $(filter).val() || [] : $$("option:checked", filter).map(function (o) { return o.value })).map(String).filter(Boolean)
          calendar.refetchEvents()
        }
        if ($ && $.fn.select2) {
          $(filter).select2({ theme: "bootstrap-5", placeholder: filter.dataset.placeholder || "Escolha os técnicos", width: "100%", closeOnSelect: false })
          $(filter).on("change.preview", reload)
        } else filter.addEventListener("change", reload)
      }
    })
  }

  // ---------- Máscaras e formulários (do application.js e dos JS das telas) ----------
  function moneyBR(raw) {
    var digits = String(raw || "").replace(/\D/g, "")
    return digits ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
  }
  function parseMoney(raw) {
    var s = String(raw || "").trim().replace(/[^\d,.\-]/g, "")
    if (!s) return null
    if (s.indexOf(",") >= 0 && s.indexOf(".") >= 0) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
    else if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".")
    var n = Number(s)
    return isFinite(n) ? n : null
  }
  function phoneBR(v) {
    var d = String(v || "").replace(/\D/g, "").slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return "(" + d.slice(0, 2) + ") " + d.slice(2)
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7)
  }
  function budgetTotal() {
    var total = document.querySelector('input[name="budget[total_value]"]')
    if (!total) return
    var sum = 0
    $$("#service-items-list .input-group, #service-items-list .service-item-row").forEach(function (row) {
      if (row.style.display === "none") return
      var flag = row.querySelector(".service-item-destroy-flag")
      if (flag && flag.value === "1") return
      var q = row.querySelector('input[name$="[quantity]"]')
      var u = row.querySelector('input[name$="[unit_price]"]')
      if (!q || !u) return
      var qty = Number(String(q.value || "").replace(/[^\d,.\-]/g, "").replace(/\./g, "").replace(",", ".")) || 0
      sum += qty * (Number(String(u.value || "").replace(/\D/g, "")) / 100 || 0)
    })
    total.value = sum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // ---------- Render ----------
  function cleanup() {
    $$(".modal.show").forEach(function (m) { var i = window.bootstrap && bootstrap.Modal.getInstance(m); if (i) i.hide() })
    $$(".modal-backdrop").forEach(function (b) { b.remove() })
    document.body.classList.remove("modal-open")
    document.body.style.removeProperty("overflow")
    document.body.style.removeProperty("padding-right")
    charts.forEach(function (c) { c.destroy() })
    charts = []
    if (calendar) { calendar.destroy(); calendar = null }
    if ($ && $.fn.select2) $(root).find("select.select2-hidden-accessible").select2("destroy")
    wrapper.classList.remove("toggled")
    toastEl.classList.remove("show")
  }

  function hydrate(el) {
    $$(".js-wait", el).forEach(function (w) { w.style.display = "block" }) // o application.js faz $(".js-wait").show()
    $$('input[data-money-mask="brl"]', el).forEach(function (i) { var n = parseMoney(i.value); if (n !== null) i.value = n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })
    $$('input[data-mask="phone"]', el).forEach(function (i) { i.value = phoneBR(i.value) })
    if ($ && $.fn.select2) {
      $(el).find("#multiple-select-field").each(function () {
        $(this).select2({ theme: "bootstrap-5", placeholder: $(this).data("placeholder"), width: "100%" })
      })
    }
    dashboardChart(el)
    reportsCharts(el)
    setupCalendar(el)
    budgetTotal()
  }

  function setNav(list) {
    menuItems.forEach(function (li) { li.classList.remove("active", "mm-active") })
    $$("#menu ul").forEach(function (ul) { ul.classList.remove("mm-show") })
    ;(list || []).forEach(function (i) {
      var li = menuItems[i]
      if (!li) return
      li.classList.add("active")
      var ul = li.parentElement
      while (ul && ul.id !== "menu") {
        if (ul.tagName === "UL") { ul.classList.add("mm-show"); if (ul.parentElement) ul.parentElement.classList.add("mm-active") }
        ul = ul.parentElement
      }
    })
  }

  function render(key) {
    var page = PAGES[key] || PAGES[key.split("?")[0]]
    if (!page) { page = PAGES["/"]; if (key !== "/") setTimeout(function () { toast(MSG.missing) }, 50) }
    cleanup()
    root.innerHTML = page.h
    setNav(page.n)
    document.title = (page.t ? page.t + " · " : "") + CFG.title + " · Preview"
    hydrate(root)
    window.scrollTo(0, 0)
  }

  window.addEventListener("hashchange", function () {
    if (keyFrom(location.hash) || !location.hash) render(currentKey())
  })

  // ---------- Cliques ----------
  document.addEventListener("click", function (e) {
    var t = e.target

    var off = t.closest("[data-off]")
    if (off) {
      e.preventDefault()
      var kind = off.getAttribute("data-off")
      toast(MSG[kind] || MSG.missing)
      return
    }

    if (t.closest(".mobile-toggle-menu")) { wrapper.classList.toggle("toggled"); return }
    if (wrapper.classList.contains("toggled") && window.innerWidth <= 1024 && !t.closest(".sidebar-wrapper")) wrapper.classList.remove("toggled")

    // Item de serviço/recebido: adicionar e remover linhas (só no navegador).
    if (t.matches("#add-service-item, #add-received-item")) {
      e.preventDefault()
      var list = document.getElementById(t.id === "add-service-item" ? "service-items-list" : "received-items-list")
      var tpl = document.getElementById(t.id === "add-service-item" ? "service-item-template" : "received-item-template")
      if (list && tpl) list.insertAdjacentHTML("beforeend", tpl.innerHTML.replace(/NEW_INDEX/g, String(Date.now())))
      budgetTotal()
      return
    }
    var remove = t.closest(".remove-item, .remove-received-item")
    if (remove) {
      e.preventDefault()
      var row = remove.closest(".input-group, .service-item-row, .received-item-row")
      var flag = row && row.querySelector(".service-item-destroy-flag, .received-item-destroy-flag")
      if (flag) { flag.value = "1"; row.style.display = "none" } else if (row) row.remove()
      budgetTotal()
      return
    }

    // Base de conhecimento: o artigo abre no modal (knowledge_base_modal.js).
    var article = t.closest(".js-knowledge-base-article")
    if (article && window.bootstrap) {
      e.preventDefault()
      var modal = document.getElementById("knowledgeBaseModal")
      if (!modal) return
      document.getElementById("knowledgeBaseModalLabel").textContent = article.dataset.articleTitle || ""
      document.getElementById("knowledgeBaseModalBody").innerHTML = article.dataset.articleContent || ""
      bootstrap.Modal.getOrCreateInstance(modal).show()
      return
    }

    var link = t.closest("a[href]")
    if (!link) return
    var href = link.getAttribute("href")
    var key = keyFrom(href)
    if (key) {
      if (key === currentKey()) { e.preventDefault(); render(key) }
      return
    }
    // Âncoras da própria tela e "#" soltos não podem trocar o hash da navegação.
    if (href.charAt(0) === "#" && !link.hasAttribute("data-bs-toggle")) {
      e.preventDefault()
      var anchor = href.length > 1 && document.getElementById(href.slice(1))
      if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  })

  // ---------- Formulários ----------
  function filterRows(form) {
    var terms = $$('input[type="text"], input[type="search"], input:not([type])', form).map(function (i) { return plain(i.value) }).filter(Boolean)
    if (!terms.length) return false
    var rows = $$("table tbody tr", root)
    if (!rows.length) rows = $$(".card .list-group-item, .card-body > .row > [class*=col]", root)
    rows.forEach(function (r) {
      var text = plain(r.textContent)
      r.hidden = !terms.every(function (term) { return text.indexOf(term) >= 0 })
    })
    return true
  }

  function handleSubmit(form, submitter) {
    var path = form.getAttribute("data-get")
    if (!path) { toast(MSG.action); return }
    var params = new FormData(form)
    if (submitter && submitter.name) params.append(submitter.name, submitter.value)
    var key = keyFor(path, params)
    if (PAGES[key]) { location.hash = key; if (key === currentKey()) render(key); return }
    if (filterRows(form)) { toast(MSG.search); return }
    toast(MSG.filter)
  }

  document.addEventListener("submit", function (e) {
    e.preventDefault()
    handleSubmit(e.target, e.submitter)
  })
  // onchange="this.form.submit()" e requestSubmit() não disparam o evento submit: passam por aqui.
  HTMLFormElement.prototype.submit = function () { handleSubmit(this) }
  HTMLFormElement.prototype.requestSubmit = function (s) { handleSubmit(this, s) }

  document.addEventListener("input", function (e) {
    var t = e.target
    if (t.matches('input[data-money-mask="brl"]')) { t.value = moneyBR(t.value); t.setSelectionRange(t.value.length, t.value.length) }
    if (t.matches('input[data-mask="phone"]')) t.value = phoneBR(t.value)
    if (t.matches('input[name$="[quantity]"], input[name$="[unit_price]"]')) budgetTotal()
  })

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") wrapper.classList.remove("toggled")
  })

  // ---------- Moldura ----------
  if ($ && $.fn.metisMenu) $("#menu").metisMenu()
  var sidebar = document.getElementById("sidebar")
  if (sidebar && window.PerfectScrollbar) new PerfectScrollbar(sidebar)

  render(currentKey())
})()
