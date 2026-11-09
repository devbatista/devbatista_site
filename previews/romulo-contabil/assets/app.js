(function () {
  var WA_NUMBER = '5511974952730';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  function waLink(msg) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg); }

  // WhatsApp com mensagem pronta
  document.querySelectorAll('.js-wa').forEach(function (el) {
    el.href = waLink(el.getAttribute('data-msg') || 'Olá Romulo! Gostaria de um orçamento.');
    el.target = '_blank';
    el.rel = 'noopener';
  });

  // Menu mobile
  var burger = document.getElementById('burger');
  var menu = document.getElementById('menu');
  if (burger && menu) {
    burger.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Chat do hero: mensagens chegando em sequência, com "digitando..."
  var seq = Array.prototype.slice.call(document.querySelectorAll('.hero .seq'));
  var typing = document.getElementById('typing');
  if (reduce) {
    seq.forEach(function (el) { el.classList.add('show'); });
  } else {
    var chat = typing ? typing.parentNode : null;
    var t = 400;
    seq.forEach(function (el, i) {
      var isOut = el.classList.contains('out') || el.classList.contains('doc-card');
      setTimeout(function () {
        if (!typing || !chat) return;
        typing.classList.toggle('out', isOut);
        chat.insertBefore(typing, el);
        typing.classList.add('show');
      }, t);
      t += 900;
      setTimeout(function () {
        if (typing) typing.classList.remove('show');
        el.classList.add('show');
      }, t);
      t += 500;
    });
  }

  // Abas do passo a passo
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      tab.classList.add('active');
      var panel = document.getElementById('p-' + tab.getAttribute('data-tab'));
      if (panel) panel.classList.add('active');
    });
  });

  // ---------- Scroll: progresso, header, menu ativo, jornada, CTA mobile ----------
  var progress = document.getElementById('progress');
  var header = document.querySelector('.header');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.menu a[href^="#"]:not(.btn)'));
  var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  var steps = Array.prototype.slice.call(document.querySelectorAll('.jstep'));
  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.rail-dot'));
  var railFill = document.getElementById('railFill');
  var jStatus = document.getElementById('jStatus');
  var stepsBox = document.querySelector('.journey-steps');
  var mobileCta = document.getElementById('mobileCta');
  var hero = document.querySelector('.hero');
  var final = document.querySelector('.final');
  var current = -1;
  var statusText = ['digitando...', 'online', 'recebendo arquivos...', 'online'];

  function setStep(i) {
    if (i === current) return;
    current = i;
    steps.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    screens.forEach(function (s, k) { s.classList.toggle('active', k === i); });
    dots.forEach(function (d, k) { d.classList.toggle('on', k <= i); });
    if (jStatus) jStatus.textContent = statusText[i] || 'online';
  }

  function onScroll() {
    var y = window.scrollY, vh = window.innerHeight;
    var max = document.documentElement.scrollHeight - vh;
    if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
    if (header) header.classList.toggle('scrolled', y > 8);

    // menu ativo
    var active = -1;
    sections.forEach(function (s, k) {
      if (s && s.getBoundingClientRect().top < vh * 0.4) active = k;
    });
    navLinks.forEach(function (a, k) { a.classList.toggle('active', k === active); });

    // jornada: passo mais próximo do meio da tela
    if (steps.length) {
      var best = 0, bestD = Infinity;
      steps.forEach(function (s, k) {
        var r = s.getBoundingClientRect();
        var target = window.innerWidth < 1000 ? 0.72 : 0.55;
        var d = Math.abs(r.top + r.height / 2 - vh * target);
        if (d < bestD) { bestD = d; best = k; }
      });
      setStep(best);
      if (railFill && stepsBox) {
        var r = stepsBox.getBoundingClientRect();
        var p = (vh * 0.55 - r.top - steps[0].offsetHeight / 2) / (r.height - steps[0].offsetHeight - vh * 0.2);
        railFill.style.height = Math.max(0, Math.min(1, p)) * 100 + '%';
      }
    }

    // CTA fixo no celular: aparece depois do hero e some no CTA final
    if (mobileCta && hero && final) {
      var past = hero.getBoundingClientRect().bottom < 0;
      var atEnd = final.getBoundingClientRect().top < vh;
      mobileCta.classList.toggle('show', past && !atEnd);
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); }
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
  if (current < 0) setStep(0);

  // ---------- Orçamento rápido ----------
  var choice = { perfil: null, servico: null };
  var quizMsg = document.getElementById('quizMsg');
  var quizSend = document.getElementById('quizSend');
  document.querySelectorAll('.chips').forEach(function (group) {
    var key = group.getAttribute('data-group');
    group.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        group.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        choice[key] = chip.getAttribute('data-value');
        updateQuiz();
      });
    });
  });
  function updateQuiz() {
    var msg;
    if (choice.perfil && choice.servico) {
      var quem = choice.perfil === 'ainda não tenho empresa' ? 'Ainda não tenho empresa' : 'Sou ' + choice.perfil;
      msg = 'Olá Romulo! ' + quem + ' e preciso ' + choice.servico + '. Pode me passar um orçamento?';
      quizSend.classList.remove('is-disabled');
      quizSend.href = waLink(msg);
    } else if (choice.perfil || choice.servico) {
      msg = choice.perfil ? 'Agora escolha do que você precisa 👆' : 'Agora escolha o seu perfil 👆';
    } else {
      msg = 'Escolha as opções acima 👆';
    }
    quizMsg.style.opacity = 0;
    setTimeout(function () { quizMsg.textContent = msg; quizMsg.style.opacity = 1; }, 150);
  }

  // Revelar ao rolar
  var items = document.querySelectorAll('.reveal');
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }

  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
})();
