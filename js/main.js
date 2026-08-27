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
  // Formulário de contato -> WhatsApp
  // ========================================
  function initContactForm() {
    const form = document.querySelector('#contact-form');
    if (!form) return;

    const whatsappNumber = '5511991308008';

    const subjectLabels = {
      'tech-partner': 'Tech Partner (parceria contínua)',
      consultoria: 'Consultoria de tecnologia / CTO as a Service',
      software: 'Desenvolvimento de software sob medida',
      automacao: 'Automação de processos e Inteligência Artificial',
      integracao: 'Integrações e APIs',
      app: 'Aplicativo mobile',
      site: 'Site institucional ou landing page',
      agencia: 'Parceria para agência / software house',
      manutencao: 'Manutenção e evolução de sistema existente',
      outro: 'Outro'
    };

    const modelLabels = {
      recorrente: 'Parceria recorrente',
      projeto: 'Projeto pontual',
      indefinido: 'Ainda não definido'
    };

    const timelineLabels = {
      urgente: 'O quanto antes',
      '30dias': 'Até 30 dias',
      '90dias': '1 a 3 meses',
      planejamento: 'Em fase de planejamento'
    };

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const data = new FormData(form);
      const get = (key) => (data.get(key) || '').toString().trim();

      const lines = [
        'Olá, DevBatista! Encontrei o site e gostaria de conversar sobre tecnologia para minha empresa.',
        '',
        `Nome: ${get('name') || 'Não informado'}`,
        `Empresa: ${get('company') || 'Não informado'}`,
        `Email: ${get('email') || 'Não informado'}`,
        `Necessidade: ${subjectLabels[get('subject')] || 'Não informado'}`,
        `Modelo de trabalho: ${modelLabels[get('model')] || 'Não informado'}`,
        `Prazo: ${timelineLabels[get('timeline')] || 'Não informado'}`,
        '',
        `Contexto: ${get('message') || 'Não informado'}`
      ];

      const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(lines.join('\n'))}`;
      window.open(url, '_blank', 'noopener,noreferrer');

      const feedback = form.querySelector('#form-feedback');
      if (feedback) {
        feedback.hidden = false;
        feedback.textContent = 'Abrimos o WhatsApp em uma nova aba com seus dados preenchidos. Se não abrir, verifique o bloqueador de pop-ups.';
      }

      form.reset();
    });
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

    const setActive = (step) => {
      const index = Array.prototype.indexOf.call(steps, step);
      const progress = step.dataset.progress || '20';

      steps.forEach((item) => item.classList.toggle('active', item === step));
      title.textContent = step.dataset.title || '';
      status.textContent = step.dataset.status || '';
      metric.textContent = step.dataset.metric || '';
      stepLabel.textContent = `Etapa ${step.dataset.step || ''}`;
      progressText.textContent = `${progress}%`;
      progressBar.style.width = `${progress}%`;

      flowItems.forEach((item, i) => item.classList.toggle('active', i <= index));
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(entry.target);
      });
    }, { threshold: 0.55, rootMargin: '-15% 0px -25% 0px' });

    steps.forEach((step) => observer.observe(step));
    setActive(steps[0]);
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
