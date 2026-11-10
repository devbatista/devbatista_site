// Preview estático do Admin DevBatista: cada tela vem de assets/pages.js e a navegação é por hash
// (#/commercial/leads). Reproduz as interações do app (menu, gaveta, abas, filtros, busca, frames)
// sem servidor; o que gravaria algo mostra um aviso.
(function () {
  "use strict"

  var PAGES = window.PREVIEW_PAGES || {}
  var main = document.getElementById("conteudo")
  var crumb = document.querySelector(".top .crumb")
  var overlay = document.querySelector("[data-overlay]")
  var drawer = document.getElementById("drawer")
  var drawerFrame = document.getElementById("drawer-frame")
  var palette = document.querySelector("[data-palette]")
  var toastEl = document.querySelector("[data-toast]")
  var LOADING = '<div class="drawer-body caption">Carregando…</div>'
  var skipRender = false
  var toastTimer

  // ---------- Utilidades ----------
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)) }
  var fragment = function (html) { var t = document.createElement("template"); t.innerHTML = html; return t.content }
  var keyFrom = function (href) { return href && href.charAt(0) === "#" && href.charAt(1) === "/" ? href.slice(1) : null }
  var currentKey = function () { return keyFrom(location.hash) || "/" }

  function toast(msg) {
    toastEl.textContent = msg || "Isto é um preview: as ações que gravam dados estão desativadas."
    toastEl.classList.add("show")
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.classList.remove("show") }, 2800)
  }

  // Frame de mesmo id na tela de destino (o que o Turbo faria numa navegação de frame).
  function frameFrom(key, id) {
    var page = PAGES[key]
    if (!page) return null
    var frame = fragment(page.h).querySelector('turbo-frame[id="' + id + '"]')
    return frame
  }

  // ---------- Render ----------
  function hydrate(root) {
    // Frames preguiçosos (src): preenche com a tela capturada.
    $$("turbo-frame[data-src]", root).forEach(function (frame) {
      var src = frame.getAttribute("data-src")
      frame.removeAttribute("data-src")
      var found = frameFrom(src, frame.id)
      if (found) frame.innerHTML = found.innerHTML
      else if (PAGES[src]) frame.innerHTML = PAGES[src].h
      hydrate(frame)
    })
    // Conversa do WhatsApp rolada até a última mensagem.
    $$('[data-whatsapp-thread-target="scroller"]', root).forEach(function (s) { s.scrollTop = s.scrollHeight })
    // Conversa aberta marcada na lista.
    var open = document.querySelector("#whatsapp_conversation [data-conversation-id]")
    $$(".cv[data-conversation-id]").forEach(function (cv) {
      cv.classList.toggle("on", !!open && cv.getAttribute("data-conversation-id") === open.getAttribute("data-conversation-id"))
    })
    // Sala do agente selecionado no escritório.
    $$('[data-controller~="escritorio"]', root).forEach(function (office) {
      var sel = office.getAttribute("data-escritorio-selected-value")
      $$("[data-agent-key]", office).forEach(function (desk) {
        if (!desk.matches('[data-escritorio-target="desk"]')) return
        desk.classList.toggle("on", desk.getAttribute("data-agent-key") === sel)
      })
    })
    filterCounts()
  }

  function setNav(page) {
    var groups = $$(".side nav > .grp")
    groups.forEach(function (g, i) {
      var on = page.g === i
      g.classList.toggle("on", on)
      if (g.hasAttribute("data-nav-group")) {
        g.classList.toggle("open", on)
        g.setAttribute("aria-expanded", on ? "true" : "false")
      }
    })
    $$(".side .it").forEach(function (it) {
      var on = !!page.i && keyFrom(it.getAttribute("href")) === page.i
      it.classList.toggle("on", on)
      on ? it.setAttribute("aria-current", "page") : it.removeAttribute("aria-current")
    })
  }

  function render(key) {
    var page = PAGES[key] || PAGES[key.split("?")[0]] || PAGES["/"]
    closeAll()
    palette.classList.remove("open")
    document.body.classList.remove("nav-open")
    toastEl.classList.remove("show")
    main.innerHTML = page.h
    crumb.innerHTML = page.c || ""
    setNav(page)
    hydrate(main)
    document.title = (page.t ? page.t + " · " : "") + "DevBatista - Admin · Preview"
    window.scrollTo(0, 0)
    main.scrollTop = 0
  }

  function go(key, opts) {
    if (opts && opts.silent) skipRender = true
    if (currentKey() === key && !(opts && opts.silent)) render(key)
    else location.hash = key
  }

  window.addEventListener("hashchange", function () {
    if (skipRender) { skipRender = false; return }
    render(currentKey())
  })

  // ---------- Gaveta, modais e popovers ----------
  function closeAll() {
    $$(".drawer.open, .modal.open, .popover.open").forEach(function (el) { el.classList.remove("open") })
    drawerFrame.innerHTML = LOADING
    $$("[data-popover-toggle]").forEach(function (b) { b.setAttribute("aria-expanded", "false") })
    overlay.classList.remove("open")
  }

  function openPanel(el) {
    el.classList.add("open")
    overlay.classList.add("open")
  }

  function openDrawer(key) {
    var page = PAGES[key]
    if (!page) return toast("Esta tela não faz parte do preview.")
    var frame = frameFrom(key, "drawer-frame")
    closeAll()
    drawerFrame.innerHTML = frame ? frame.innerHTML : page.h
    hydrate(drawerFrame)
    openPanel(drawer)
    var field = drawerFrame.querySelector("input:not([type=hidden]), select, textarea")
    if (field) setTimeout(function () { field.focus({ preventScroll: true }) }, 60)
  }

  // ---------- Filtros por status (no próprio navegador) ----------
  function filterCounts() {
    $$("[data-filter-group]").forEach(function (group) {
      var target = document.querySelector('[data-filter-target="' + group.getAttribute("data-filter-group") + '"]')
      if (!target) return
      var rows = $$("[data-status]", target)
      $$("button[data-filter]", group).forEach(function (b) {
        var c = b.querySelector(".c")
        if (c) c.textContent = b.getAttribute("data-filter") === "todos" ? rows.length : rows.filter(function (r) { return r.getAttribute("data-status") === b.getAttribute("data-filter") }).length
      })
    })
  }

  // ---------- Busca global (⌘K): procura entre as telas do preview ----------
  var normalize = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() }
  var escapeHtml = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] }) }
  var crumbText = function (html) { return fragment(html || "").textContent.replace(/\s+/g, " ").replace(/\s*\/\s*/g, " / ").trim() }
  var INDEX = Object.keys(PAGES).filter(function (k) { return PAGES[k].t && !/\/(new|edit)$|\/(lose|payment|renewal|status|approve|reject|deliver)$/.test(k.split("?")[0]) })
    .map(function (k) { var c = crumbText(PAGES[k].c); return { key: k, title: PAGES[k].t, sub: c, text: normalize(PAGES[k].t + " " + c) } })

  function openPalette() {
    openPanel(palette)
    setTimeout(function () { palette.querySelector("[data-palette-input]").focus() }, 10)
  }

  function renderResults(q) {
    var box = palette.querySelector("[data-palette-results]")
    if (q.length < 2) { box.innerHTML = '<div class="palette-group">Digite pelo menos 2 letras</div>'; return }
    var term = normalize(q)
    var seen = {}
    var items = INDEX.filter(function (i) {
      if (i.text.indexOf(term) < 0 || seen[i.title + i.sub]) return false
      seen[i.title + i.sub] = true
      return true
    }).slice(0, 12)
    if (!items.length) { box.innerHTML = '<div class="empty">Nada encontrado para essa busca.</div>'; return }
    box.innerHTML = '<div class="palette-group">Telas</div>' + items.map(function (i) {
      return '<a class="palette-item" href="#' + escapeHtml(i.key) + '"><span class="strong">' + escapeHtml(i.title) + '</span><span class="muted">' + escapeHtml(i.sub) + "</span></a>"
    }).join("")
  }

  // ---------- WhatsApp: enviar mostra a mensagem na conversa ----------
  function sendWhatsapp(form) {
    var body = form.querySelector('[data-whatsapp-composer-target="body"]')
    var thread = document.querySelector('[data-whatsapp-thread-target="thread"]')
    var text = body && body.value.trim()
    if (!text || !thread) return toast()
    var model = $$(".msg-row", thread).filter(function (r) { return r.querySelector(".msg.out") }).pop()
    if (!model) return toast()
    var row = model.cloneNode(true)
    row.id = "preview_" + Date.now()
    var day = row.querySelector(".day"); if (day) day.remove()
    var bubble = row.querySelector(".bubble")
    $$("p", bubble).forEach(function (p, i) { i ? p.remove() : (p.textContent = text) })
    var who = row.querySelector(".who b")
    if (who && who.nextSibling) who.nextSibling.textContent = " · agora · pelo Admin"
    thread.appendChild(row)
    body.value = ""
    var scroller = document.querySelector('[data-whatsapp-thread-target="scroller"]')
    if (scroller) scroller.scrollTop = scroller.scrollHeight
    toast("Mensagem adicionada só nesta demonstração, nada foi enviado.")
  }

  // ---------- Cliques ----------
  document.addEventListener("click", function (e) {
    var t = e.target

    var off = t.closest("[data-off]")
    if (off) {
      e.preventDefault()
      var kind = off.getAttribute("data-off")
      toast(kind === "action" ? null : kind === "file" ? "O download do arquivo fica só no sistema real." : "Esta tela não faz parte do preview.")
      return
    }

    var open = t.closest("[data-open]")
    if (open && !open.getAttribute("data-turbo-frame")) {
      var el = document.getElementById(open.getAttribute("data-open"))
      if (el) { e.preventDefault(); openPanel(el); return }
    }

    if (t.closest("[data-search-open]")) { openPalette(); return }

    var close = t.closest("[data-close]")
    if (close || t.closest("[data-overlay]")) {
      if (!close || close.closest(".drawer.open, .modal.open")) { e.preventDefault(); closeAll(); palette.classList.remove("open"); return }
    }

    var pop = t.closest("[data-popover-toggle]")
    if (pop) {
      var popEl = document.getElementById(pop.getAttribute("data-popover-toggle"))
      var willOpen = !popEl.classList.contains("open")
      closeAll()
      if (willOpen) { popEl.classList.add("open"); pop.setAttribute("aria-expanded", "true") }
      return
    }
    if (!t.closest(".popover")) $$(".popover.open").forEach(function (el) { el.classList.remove("open") })

    if (t.closest("[data-nav-toggle]")) { document.body.classList.toggle("nav-open"); return }
    if (document.body.classList.contains("nav-open") && !t.closest(".side")) document.body.classList.remove("nav-open")

    var grp = t.closest("[data-nav-group]")
    if (grp) {
      grp.classList.toggle("open")
      grp.setAttribute("aria-expanded", grp.classList.contains("open"))
      return
    }

    var tab = t.closest("[data-tab]")
    if (tab && tab.closest("[data-tabs]")) {
      var tabs = tab.closest("[data-tabs]")
      var scope = tabs.closest("[data-tabs-scope]") || document
      $$("[data-tab]", tabs).forEach(function (x) { x.classList.toggle("on", x === tab); x.setAttribute("aria-selected", x === tab) })
      $$("[data-panel]", scope).forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== tab.getAttribute("data-tab") })
      if (tab.tagName !== "A") return
    }

    var filter = t.closest("button[data-filter]")
    if (filter && filter.closest("[data-filter-group]")) {
      var group = filter.closest("[data-filter-group]")
      var target = document.querySelector('[data-filter-target="' + group.getAttribute("data-filter-group") + '"]')
      var v = filter.getAttribute("data-filter")
      $$("button[data-filter]", group).forEach(function (x) { x.classList.toggle("on", x === filter); x.setAttribute("aria-pressed", x === filter) })
      if (target) $$("[data-status]", target).forEach(function (r) { r.hidden = v !== "todos" && r.getAttribute("data-status") !== v })
      return
    }

    var pw = t.closest("[data-password-toggle]")
    if (pw) {
      var input = pw.parentElement.querySelector("input")
      var show = input.type === "password"
      input.type = show ? "text" : "password"
      pw.setAttribute("aria-pressed", show)
      return
    }

    if (t.closest("[data-flash-close]")) { t.closest("[data-flash]").remove(); return }

    // Stimulus do WhatsApp e do escritório, no essencial.
    var action = t.closest("[data-action]")
    if (action) {
      var a = action.getAttribute("data-action")
      var wa = action.closest('[data-controller~="whatsapp-screen"]')
      if (wa && /whatsapp-screen#back/.test(a)) { wa.classList.remove("show-conv"); return }
      if (wa && /whatsapp-screen#togglePanel/.test(a)) { wa.classList.toggle("panel-open"); return }
      if (wa && /whatsapp-screen#closePanel/.test(a)) { wa.classList.remove("panel-open"); return }
      if (/whatsapp-screen#filterBy/.test(a)) {
        $$("[data-filter]", action.parentElement).forEach(function (c) { c.setAttribute("aria-pressed", c === action) })
        return
      }
      if (/whatsapp-sound-toggle#toggle/.test(a)) {
        var state = action.querySelector('[data-whatsapp-sound-toggle-target="state"]')
        if (state) state.textContent = state.textContent === "ligado" ? "desligado" : "ligado"
        return
      }
      if (/whatsapp-notify-banner#(enable|dismiss)/.test(a)) { var bar = action.closest(".notify-wrap"); if (bar) bar.hidden = true; return }
      if (/whatsapp-thread#reply/.test(a)) {
        var composer = document.querySelector('[data-whatsapp-composer-target="body"]')
        if (composer) composer.focus()
        return
      }
      if (/escritorio#select/.test(a)) {
        var office = action.closest('[data-controller~="escritorio"]')
        if (office) office.setAttribute("data-escritorio-selected-value", action.getAttribute("data-agent-key"))
      }
      if (/whatsapp-signup#launch/.test(a)) { toast("No sistema real, aqui abre o cadastro do número na Meta."); return }
    }

    // Linhas de tabela clicáveis.
    var row = t.closest("tr[data-href]")
    if (row && !t.closest("a, button, input, select, label")) { go(row.getAttribute("data-href")); return }

    // Links internos: gaveta, frame ou tela inteira.
    var link = t.closest("a[href]")
    if (!link) return
    var key = keyFrom(link.getAttribute("href"))
    if (!key) return
    var frameId = link.getAttribute("data-turbo-frame")
    if (frameId === "drawer-frame") { e.preventDefault(); openDrawer(key); return }

    var frame = frameId && frameId !== "_top" ? document.getElementById(frameId) : null
    if (!frame && !frameId) {
      var inside = link.closest("turbo-frame")
      if (inside && inside.id !== "drawer-frame" && inside.getAttribute("target") !== "_top") frame = inside
    }
    if (frame) {
      var next = frameFrom(key, frame.id)
      if (next) {
        e.preventDefault()
        frame.innerHTML = next.innerHTML
        hydrate(frame)
        var screen = frame.closest('[data-controller~="whatsapp-screen"]')
        if (screen && frame.id === "whatsapp_conversation") { screen.classList.add("show-conv"); screen.classList.remove("panel-open"); hydrate(document) }
        if (link.getAttribute("data-turbo-action") === "advance" || frame.id === "whatsapp_conversation" || frame.id === "agent_panel") go(key, { silent: true })
        return
      }
    }
    // Link para a própria tela (ou dentro da gaveta): navega normalmente pelo hash.
    if (link.closest(".drawer")) closeAll()
    if (key === currentKey()) { e.preventDefault(); render(key) }
  })

  // ---------- Formulários ----------
  document.addEventListener("submit", function (e) {
    var form = e.target
    e.preventDefault()
    if (form.matches(".palette-input")) {
      var first = palette.querySelector(".palette-item")
      if (first) location.hash = first.getAttribute("href")
      return
    }
    if (form.querySelector('[data-whatsapp-composer-target="body"]')) { sendWhatsapp(form); return }
    var get = form.getAttribute("data-get")
    if (get) { go(get); return }
    toast()
  })

  // Busca da paleta e busca local por texto.
  document.addEventListener("input", function (e) {
    if (e.target.matches("[data-palette-input]")) { renderResults(e.target.value.trim()); return }
    var input = e.target.closest("input[data-search]")
    if (!input) return
    var term = normalize(input.value.trim())
    var scope = document.querySelector('[data-search-scope="' + input.getAttribute("data-search") + '"]') || document
    $$("[data-search-item]", scope).forEach(function (el) { el.hidden = term !== "" && normalize(el.textContent).indexOf(term) < 0 })
    $$("[data-search-section]", scope).forEach(function (sec) { sec.hidden = !sec.querySelector("[data-search-item]:not([hidden])") })
  })

  // Selects que no app recarregam a tela (período, ordenação): mantêm a tela atual.
  document.addEventListener("change", function (e) {
    var select = e.target.closest("form[data-get] select")
    if (select) toast("No sistema real, a tela recarrega com o filtro escolhido.")
  })

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return }
    if (e.key === "Escape") { closeAll(); palette.classList.remove("open"); document.body.classList.remove("nav-open"); return }
    if (palette.classList.contains("open") && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      var items = $$(".palette-item", palette)
      if (!items.length) return
      e.preventDefault()
      var i = items.indexOf(document.activeElement)
      var n = e.key === "ArrowDown" ? Math.min(i + 1, items.length - 1) : Math.max(i - 1, -1)
      n < 0 ? palette.querySelector("[data-palette-input]").focus() : items[n].focus()
    }
  })
  palette.addEventListener("click", function (e) {
    if (e.target.closest(".palette-item")) { palette.classList.remove("open"); overlay.classList.remove("open") }
  })

  // ---------- Pipeline: arrastar cartões entre as etapas (só na tela) ----------
  var dragged = null
  document.addEventListener("dragstart", function (e) {
    var card = e.target.closest && e.target.closest(".kcard[draggable=true]")
    if (!card) return
    dragged = card
    card.classList.add("dragging")
    e.dataTransfer.effectAllowed = "move"
  })
  document.addEventListener("dragend", function () {
    if (dragged) dragged.classList.remove("dragging")
    dragged = null
    $$(".lane.over").forEach(function (l) { l.classList.remove("over") })
  })
  document.addEventListener("dragover", function (e) {
    var lane = e.target.closest && e.target.closest("[data-lane]")
    if (!lane || !dragged) return
    e.preventDefault()
    $$(".lane.over").forEach(function (l) { if (l !== lane) l.classList.remove("over") })
    lane.classList.add("over")
  })
  document.addEventListener("drop", function (e) {
    var lane = e.target.closest && e.target.closest("[data-lane]")
    if (!lane || !dragged) return
    e.preventDefault()
    var card = dragged
    if (card.closest("[data-lane]") === lane) return
    var kind = lane.getAttribute("data-lane-kind")
    if (kind === "lost" && card.getAttribute("data-lose-url")) return openDrawer(card.getAttribute("data-lose-url"))
    if (card.getAttribute("data-card-kind") === "lead" && kind === "opportunity" && card.getAttribute("data-convert-url")) return openDrawer(card.getAttribute("data-convert-url"))
    var more = lane.querySelector(":scope > .more")
    lane.insertBefore(card, more)
    toast("Cartão movido só nesta demonstração.")
  })

  render(currentKey())
})()
