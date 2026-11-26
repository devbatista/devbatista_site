// ========================================
// DevBatista - Main JavaScript
// Vanilla JS, sem dependências.
// ========================================

(function () {
  'use strict';

  const ICON_MENU = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>';
  const ICON_CLOSE = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  document.addEventListener('DOMContentLoaded', () => {
    initNavScroll();
    initMobileMenu();
    initContactForm();
    initDemoVideos();
    initFaqAccordion();
    initScrollyProcess();
    initServiceFinder();
    initProjectFilters();
    initRevealOnScroll();
  });

  // ========================================
  // Navegação: estado ao rolar
  // ========================================
  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    let ticking = false;
    const update = () => {
      nav.classList.toggle('scrolled', window.scrollY > 50);
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });

    update();
  }

  // ========================================
  // Menu mobile
  // ========================================
  function initMobileMenu() {
    const button = document.querySelector('.nav-mobile-btn');
    const menu = document.querySelector('.nav-mobile-menu');
    if (!button || !menu) return;

    if (!menu.id) menu.id = 'mobile-menu';
    button.setAttribute('aria-controls', menu.id);
    button.setAttribute('aria-expanded', 'false');

    const setOpen = (open) => {
      menu.classList.toggle('open', open);
      document.body.classList.toggle('nav-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
      button.innerHTML = open ? ICON_CLOSE : ICON_MENU;
    };

    button.addEventListener('click', () => {
      setOpen(!menu.classList.contains('open'));
    });

    menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setOpen(false));
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        button.focus();
      }
    });

    // Ao voltar para desktop, garante que o body não fique travado
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1180 && menu.classList.contains('open')) {
        setOpen(false);
      }
    });
  }

  // ========================================
  // Formulário de contato -> Admin (api/contato.php) -> WhatsApp
  //
  // O WhatsApp abre sempre: depois da resposta do PHP, de um erro ou de
  // CONTACT_TIMEOUT_MS sem resposta. Falha do Admin nunca trava o visitante.
  // ========================================
  const CONTACT_ENDPOINT = '/api/contato.php';
  const CONTACT_TIMEOUT_MS = 4000;
  const CONTACT_WHATSAPP = '5511991308008';
  const TRACKING_STORAGE_KEY = 'devbatista:tracking'; // gravado por js/lead-quiz.js

  // Espelham as listas de api/contato.php.
  const CONTACT_LABELS = {
    segment: {
      contabilidade: 'Contabilidade',
      saude_estetica: 'Saúde e estética',
      imobiliario: 'Imobiliário',
      servicos: 'Prestador de serviços',
      comercio: 'Comércio',
      outro: 'Outro'
    },
    need: {
      whatsapp_ia: 'Atendimento com IA no WhatsApp',
      automacao_ia: 'Automação de tarefas com IA',
      ia_sistemas: 'IA conectada aos meus sistemas',
      sob_medida: 'Sistema, site ou app sob medida',
      manutencao: 'Manutenção de sistema existente',
      agencia: 'Sou agência ou software house',
      nao_sei: 'Ainda não sei'
    },
    volume: {
      ate_300: 'Até 300',
      '300_1000': '300 a 1.000',
      mais_1000: 'Mais de 1.000',
      nao_sei: 'Não sei'
    },
    engagement: {
      continuo: 'Contínuo',
      pontual: 'Pontual',
      nao_sei: 'Ainda não sei'
    }
  };

  // DDD + número, sem o 55. Mesmas regras de api/contato.php.
  function normalizePhone(value) {
    let digits = String(value || '').replace(/\D+/g, '');
    if (digits.length > 11 && digits.indexOf('55') === 0) digits = digits.slice(2);
    return digits;
  }

  function phoneError(digits) {
    if (digits.length < 10 || digits.length > 11) return 'Informe o WhatsApp com DDD.';
    if (Number(digits.slice(0, 2)) < 11) return 'DDD inválido.';
    if (digits.length === 11 && digits[2] !== '9') return 'Número de celular inválido.';
    return '';
  }

  function formatPhone(digits) {
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  }

  function readContactFields(form) {
    const data = new FormData(form);
    const get = (key) => (data.get(key) || '').toString().trim();
    return {
      name: get('name'),
      phone: normalizePhone(get('phone')),
      email: get('email').toLowerCase(),
      company: get('company'),
      segment: get('segment'),
      need: get('need'),
      volume: get('volume'),
      engagement: get('engagement'),
      message: get('message'),
      consent: data.get('consent') === 'sim',
      website: get('website') // honeypot
    };
  }

  function validateContact(fields) {
    const errors = {};
    if (fields.name.length < 2) errors.name = 'Informe seu nome.';
    const phone = phoneError(fields.phone);
    if (phone) errors.phone = phone;
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.email = 'E-mail inválido.';
    if (!CONTACT_LABELS.segment[fields.segment]) errors.segment = 'Selecione o segmento.';
    if (!CONTACT_LABELS.need[fields.need]) errors.need = 'Selecione o que você precisa.';
    if (!fields.consent) errors.consent = 'Para enviar, é preciso concordar com a Política de Privacidade.';
    return errors;
  }

  function contactWhatsAppText(fields) {
    const label = (group, value) => CONTACT_LABELS[group][value] || '';
    const lines = [
      'Olá, DevBatista! Vim pelo site e quero conversar sobre IA para a minha empresa.',
      '',
      `Nome: ${fields.name}`,
      `WhatsApp: ${formatPhone(fields.phone)}`
    ];
    if (fields.email) lines.push(`E-mail: ${fields.email}`);
    if (fields.company) lines.push(`Empresa: ${fields.company}`);
    lines.push(`Segmento: ${label('segment', fields.segment)}`);
    lines.push(`Preciso de: ${label('need', fields.need)}`);
    if (fields.volume) lines.push(`Mensagens por mês no WhatsApp: ${label('volume', fields.volume)}`);
    if (fields.engagement) lines.push(`Contínuo ou pontual: ${label('engagement', fields.engagement)}`);
    if (fields.message) lines.push('', `Meu caso: ${fields.message}`);
    return lines.join('\n');
  }

  function readTracking() {
    let tracking = {};
    try {
      tracking = JSON.parse(window.sessionStorage.getItem(TRACKING_STORAGE_KEY) || '{}') || {};
    } catch (error) {
      tracking = {};
    }
    tracking.page = window.location.pathname;
    return tracking;
  }

  // POST com orçamento de tempo. Nunca rejeita: o resultado só vai para o log.
  function sendContact(payload) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const request = window.fetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      signal: controller ? controller.signal : undefined
    }).then((response) => response.status, () => 0);

    const timeout = new Promise((resolve) => {
      window.setTimeout(() => {
        if (controller) controller.abort();
        resolve('timeout');
      }, CONTACT_TIMEOUT_MS);
    });

    return Promise.race([request, timeout]);
  }

  function initContactForm() {
    const form = document.querySelector('#contact-form');
    if (!form) return;

    const feedback = form.querySelector('#form-feedback');
    const button = form.querySelector('button[type="submit"]');
    let startedAt = Date.now();

    // /contato?need=whatsapp_ia: as páginas de oferta já chegam com a
    // necessidade escolhida. Valor fora da lista é ignorado.
    const preset = typeof URLSearchParams === 'function'
      ? new URLSearchParams(window.location.search || '').get('need')
      : null;
    const needField = form.elements.namedItem('need');
    if (preset && CONTACT_LABELS.need[preset] && needField) needField.value = preset;
    let sending = false;

    const setFeedback = (text, url) => {
      if (!feedback) return;
      feedback.hidden = false;
      feedback.textContent = text;
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Abrir o WhatsApp';
        feedback.append(' ', link, '.');
      }
    };

    const clearErrors = () => {
      form.querySelectorAll('.form-error').forEach((el) => {
        el.hidden = true;
        el.textContent = '';
      });
      form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    };

    const showErrors = (errors) => {
      let first = null;
      Object.keys(errors).forEach((name) => {
        const field = form.elements.namedItem(name);
        const message = form.querySelector(`#erro-${name}`);
        if (field && field.setAttribute) {
          field.setAttribute('aria-invalid', 'true');
          if (!first) first = field;
        }
        if (message) {
          message.hidden = false;
          message.textContent = errors[name];
        }
      });
      if (first) first.focus();
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (sending) return;

      clearErrors();
      const fields = readContactFields(form);
      const errors = validateContact(fields);
      if (Object.keys(errors).length) {
        showErrors(errors);
        return;
      }

      const url = `https://wa.me/${CONTACT_WHATSAPP}?text=${encodeURIComponent(contactWhatsAppText(fields))}`;

      // A aba abre ainda no clique: depois de esperar o servidor, o navegador
      // (Safari principalmente) bloquearia o pop-up. Ela recebe o endereço
      // do WhatsApp quando o envio termina.
      let tab = null;
      try {
        tab = window.open('', '_blank');
        if (tab) {
          tab.opener = null;
          tab.document.title = 'Abrindo o WhatsApp…';
          tab.document.body.textContent = 'Abrindo o WhatsApp…';
        }
      } catch (error) {
        /* segue com o redirecionamento na própria aba */
      }

      sending = true;
      if (button) button.setAttribute('aria-busy', 'true');
      setFeedback('Enviando…');

      const payload = Object.assign({}, fields, {
        tracking: readTracking(),
        meta: { elapsed_ms: Date.now() - startedAt, page_url: window.location.href }
      });

      sendContact(payload).then(() => {
        sending = false;
        if (button) button.removeAttribute('aria-busy');

        if (tab && !tab.closed) {
          tab.location.href = url;
        } else {
          // Pop-up bloqueado: segue na própria aba.
          window.location.href = url;
        }

        setFeedback('Recebemos seus dados e abrimos o WhatsApp com a mensagem pronta. Se ele não abriu:', url);
        form.reset();
        startedAt = Date.now();
      });
    });
  }

  // ========================================
  // Home: vídeos da demonstração em abas
  // O vídeo só ganha o src quando a seção entra na tela. Sem o arquivo
  // (ainda não publicado), o painel mostra o aviso no lugar do player.
  // ========================================
  function initDemoVideos() {
    const root = document.querySelector('[data-demo]');
    if (!root) return;

    const tabs = Array.from(root.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
    if (!tabs.length || panels.some((panel) => !panel)) return;

    let current = 0;
    let visible = false;

    const load = (panel) => {
      const video = panel.querySelector('video[data-src]');
      if (!video) return;
      const placeholder = panel.querySelector('.demo-placeholder');
      video.addEventListener('error', () => {
        video.hidden = true;
        if (placeholder) placeholder.hidden = false;
      }, { once: true });
      video.preload = 'metadata';
      video.src = video.dataset.src;
      video.removeAttribute('data-src');
    };

    const select = (index, focus) => {
      current = index;
      tabs.forEach((tab, i) => {
        const active = i === index;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
        panels[i].hidden = !active;
        if (!active) {
          const video = panels[i].querySelector('video');
          if (video && !video.paused) video.pause();
        }
      });
      if (focus) tabs[index].focus();
      if (visible) load(panels[index]);
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, false));
      tab.addEventListener('keydown', (event) => {
        const last = tabs.length - 1;
        const next = {
          ArrowRight: i === last ? 0 : i + 1,
          ArrowLeft: i === 0 ? last : i - 1,
          Home: 0,
          End: last
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });

    select(0, false);

    const reveal = () => {
      visible = true;
      load(panels[current]);
    };

    if (!('IntersectionObserver' in window)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      reveal();
    }, { rootMargin: '200px 0px' });
    observer.observe(root);
  }

  // ========================================
  // FAQ: um item aberto por vez
  // ========================================
  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq-list .faq-item');
    if (!items.length) return;

    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  // ========================================
  // Home: processo em scrollytelling
  // ========================================
  function initScrollyProcess() {
    const steps = document.querySelectorAll('.scrolly-step');
    const title = document.querySelector('#scrolly-title');
    const status = document.querySelector('#scrolly-status');
    const metric = document.querySelector('#scrolly-metric');
    const stepLabel = document.querySelector('#scrolly-step-label');
    const progressText = document.querySelector('#scrolly-progress-text');
    const progressBar = document.querySelector('#scrolly-progress-bar');
    const flowItems = document.querySelectorAll('.scrolly-flow span');

    if (!steps.length || !title || !status || !metric || !stepLabel || !progressText || !progressBar) return;

    let current = -1;

    const setActive = (index) => {
      if (index === current) return;
      current = index;

      const step = steps[index];
      const progress = step.dataset.progress || '20';

      steps.forEach((item, i) => item.classList.toggle('active', i === index));
      title.textContent = step.dataset.title || '';
      status.textContent = step.dataset.status || '';
      metric.textContent = step.dataset.metric || '';
      stepLabel.textContent = `Etapa ${step.dataset.step || ''}`;
      progressText.textContent = `${progress}%`;
      progressBar.style.width = `${progress}%`;

      flowItems.forEach((item, i) => item.classList.toggle('active', i <= index));
    };

    // Linha de leitura fixa na viewport: ativa a etapa que a cruza.
    // Independe da altura da etapa — um threshold proporcional nunca era
    // atingido quando a etapa ficava mais alta que a janela.
    const update = () => {
      const line = window.innerHeight * 0.45;
      let best = 0;
      let bestDistance = Infinity;

      for (let i = 0; i < steps.length; i += 1) {
        const rect = steps[i].getBoundingClientRect();

        if (rect.top <= line && rect.bottom >= line) {
          best = i;
          break;
        }

        const distance = rect.top > line ? rect.top - line : line - rect.bottom;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      }

      setActive(best);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        update();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  // ========================================
  // Soluções: seletor de recomendação
  // ========================================
  function initServiceFinder() {
    const choices = document.querySelectorAll('.service-choice');
    const label = document.querySelector('#service-rec-label');
    const title = document.querySelector('#service-rec-title');
    const copy = document.querySelector('#service-rec-copy');
    const link = document.querySelector('#service-rec-link');

    if (!choices.length || !label || !title || !copy || !link) return;

    choices.forEach((choice) => {
      choice.addEventListener('click', () => {
        choices.forEach((item) => {
          const isActive = item === choice;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });

        label.textContent = choice.dataset.label || '';
        title.textContent = choice.dataset.title || '';
        copy.textContent = choice.dataset.copy || '';
        link.href = choice.dataset.href || `#${choice.dataset.target || ''}`;
      });
    });
  }

  // ========================================
  // Projetos: filtros da galeria
  // ========================================
  function initProjectFilters() {
    const filters = document.querySelectorAll('.project-filter');
    const cards = document.querySelectorAll('.project-card[data-project-category]');
    const counter = document.querySelector('#projects-count');

    if (!filters.length || !cards.length) return;

    const updateCount = (count) => {
      if (!counter) return;
      counter.textContent = `${count} ${count === 1 ? 'projeto encontrado' : 'projetos encontrados'}`;
    };

    filters.forEach((button) => {
      button.addEventListener('click', () => {
        const selected = button.dataset.filter || 'all';
        let visible = 0;

        filters.forEach((item) => {
          const isActive = item === button;
          item.classList.toggle('active', isActive);
          item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });

        cards.forEach((card) => {
          const show = selected === 'all' || card.dataset.projectCategory === selected;
          card.classList.toggle('is-hidden', !show);
          if (show) visible += 1;
        });

        updateCount(visible);
      });
    });

    updateCount(cards.length);
  }

  // ========================================
  // Revelação suave ao rolar
  // ========================================
  function initRevealOnScroll() {
    const elements = document.querySelectorAll('.animate-on-scroll');
    if (!elements.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => el.classList.add('fade-up'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.style.opacity = '';
        entry.target.classList.add('fade-up');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    elements.forEach((el) => {
      el.style.opacity = '0';
      observer.observe(el);
    });
  }
})();
