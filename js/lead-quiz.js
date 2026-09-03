// ========================================
// DevBatista - Diagnóstico Tecnológico
// Modal de captação e qualificação de leads.
// Vanilla JS, sem dependências. Mesmo padrão de js/main.js.
// ========================================

(function () {
  'use strict';

  // ========================================
  // Configuração
  // ========================================
  const CONFIG = {
    endpoint: '/api/leads.php',
    whatsappNumber: '5511991308008',
    requestTimeout: 15000,
    autoAdvanceDelay: 260,
    // Envios abaixo deste tempo são tratados como bot pelo servidor.
    storageKey: 'devbatista:tracking'
  };

  // ========================================
  // Scoring do diagnóstico
  // Ponto único de verdade do front. O servidor recalcula e valida.
  // Para ajustar o diagnóstico, altere apenas este objeto.
  // ========================================
  const QUIZ_SCORING = {
    employees: {
      solo: 0,
      '2_5': 1,
      '6_10': 2,
      '11_25': 3,
      '26_mais': 4
    },
    it_responsible: {
      interno: 0,
      terceirizado: 1,
      acumula: 3,
      ninguem: 4
    },
    process_management: {
      sistemas: 0,
      sistemas_planilhas: 2,
      planilhas: 3,
      manual: 4
    },
    manual_tasks: {
      quase_nenhum: 0,
      algumas: 1,
      muitas: 3,
      maioria: 4
    },
    systems_integration: {
      sim: 0,
      parcialmente: 2,
      nao: 3,
      nao_sabemos: 4
    },
    automation_interest: {
      nao_prioridade: 0,
      avaliando: 1,
      precisamos: 3,
      prioridade: 4
    },
    development_need: {
      nao: 0,
      futuramente: 1,
      sim: 3,
      definida: 4
    },
    technology_impact: {
      nao: 0,
      pouco: 1,
      as_vezes: 2,
      bastante: 4
    }
  };

  // Faixas de classificação exibidas ao visitante.
  // O commercial_score (uso interno) é calculado apenas no servidor e
  // nunca trafega nem é exibido aqui — ver api/leads.php.
  const RESULT_LEVELS = [
    {
      id: 'simples',
      max: 8,
      title: 'Estrutura tecnológica simples',
      badge: 'Estrutura tecnológica simples',
      copy: 'Sua operação já está relativamente organizada. O ganho agora vem de ajustes pontuais: proteger o que funciona, eliminar as poucas tarefas manuais que sobraram e planejar a tecnologia antes que o crescimento cobre a conta.',
      points: [
        'Base organizada — o foco passa a ser evolução, não correção',
        'Ajustes pontuais de automação com retorno rápido',
        'Planejamento de tecnologia para sustentar o crescimento'
      ]
    },
    {
      id: 'melhoria',
      max: 18,
      title: 'Oportunidades de melhoria',
      badge: 'Oportunidades de melhoria',
      copy: 'Existem pontos claros em que processos, sistemas e integrações podem ser melhorados. Não é um caso de recomeçar do zero: é organizar o que já existe, conectar o que está separado e automatizar o que hoje consome tempo da equipe.',
      points: [
        'Processos que ainda dependem de controle manual',
        'Sistemas que podem ser integrados entre si',
        'Tarefas repetitivas com potencial de automação'
      ]
    },
    {
      id: 'alto',
      max: Infinity,
      title: 'Alto potencial de otimização',
      badge: 'Alto potencial de otimização',
      copy: 'Identificamos diversos pontos em que tecnologia, automação e sistemas podem ajudar sua empresa a reduzir trabalho manual e melhorar a produtividade.',
      points: [
        'Trabalho manual que pode ser automatizado desde já',
        'Informação espalhada entre planilhas, sistemas e WhatsApp',
        'Ganho de produtividade sem aumentar o time'
      ]
    }
  ];

  // ========================================
  // Perguntas
  // ========================================
  const QUESTIONS = [
    {
      key: 'employees',
      label: 'Quantas pessoas trabalham na empresa?',
      scored: true,
      options: [
        { value: 'solo', label: 'Somente eu' },
        { value: '2_5', label: '2 a 5 pessoas' },
        { value: '6_10', label: '6 a 10 pessoas' },
        { value: '11_25', label: '11 a 25 pessoas' },
        { value: '26_mais', label: '26 ou mais' }
      ]
    },
    {
      key: 'it_responsible',
      label: 'Hoje existe alguém responsável pela tecnologia da empresa?',
      scored: true,
      options: [
        { value: 'interno', label: 'Sim, temos equipe ou profissional interno' },
        { value: 'terceirizado', label: 'Utilizamos um prestador terceirizado' },
        { value: 'acumula', label: 'Alguém da própria empresa acumula essa função' },
        { value: 'ninguem', label: 'Não temos ninguém responsável' }
      ]
    },
    {
      key: 'process_management',
      label: 'Como os processos da empresa são controlados hoje?',
      scored: true,
      options: [
        { value: 'sistemas', label: 'Principalmente por sistemas integrados' },
        { value: 'sistemas_planilhas', label: 'Sistemas + planilhas' },
        { value: 'planilhas', label: 'Principalmente por planilhas' },
        { value: 'manual', label: 'WhatsApp, planilhas e processos manuais' }
      ]
    },
    {
      key: 'manual_tasks',
      label: 'Quanto trabalho repetitivo é feito manualmente?',
      scored: true,
      options: [
        { value: 'quase_nenhum', label: 'Quase nenhum' },
        { value: 'algumas', label: 'Algumas tarefas' },
        { value: 'muitas', label: 'Muitas tarefas' },
        { value: 'maioria', label: 'Grande parte da operação' }
      ]
    },
    {
      key: 'systems_integration',
      label: 'Os sistemas utilizados pela empresa conversam entre si?',
      scored: true,
      options: [
        { value: 'sim', label: 'Sim' },
        { value: 'parcialmente', label: 'Parcialmente' },
        { value: 'nao', label: 'Não' },
        { value: 'nao_sabemos', label: 'Não sabemos como integrar' }
      ]
    },
    {
      key: 'automation_interest',
      label: 'A empresa pretende automatizar processos?',
      scored: true,
      options: [
        { value: 'nao_prioridade', label: 'Não é prioridade atualmente' },
        { value: 'avaliando', label: 'Estamos avaliando' },
        { value: 'precisamos', label: 'Sim, precisamos automatizar' },
        { value: 'prioridade', label: 'É uma prioridade agora' }
      ]
    },
    {
      key: 'development_need',
      label: 'Existe necessidade de desenvolver ou melhorar algum sistema?',
      scored: true,
      options: [
        { value: 'nao', label: 'Não' },
        { value: 'futuramente', label: 'Talvez futuramente' },
        { value: 'sim', label: 'Sim' },
        { value: 'definida', label: 'Já temos uma necessidade definida' }
      ]
    },
    {
      key: 'technology_impact',
      label: 'Hoje a tecnologia limita ou atrasa o crescimento da empresa?',
      scored: true,
      options: [
        { value: 'nao', label: 'Não' },
        { value: 'pouco', label: 'Pouco' },
        { value: 'as_vezes', label: 'Às vezes' },
        { value: 'bastante', label: 'Sim, bastante' }
      ]
    },
    {
      key: 'main_problem',
      label: 'Qual é o principal desafio tecnológico da sua empresa hoje?',
      // Não entra no cálculo do diagnóstico, mas segue junto com o lead.
      scored: false,
      other: {
        value: 'outro',
        name: 'main_problem_other',
        label: 'Conte rapidamente qual é o desafio (opcional)',
        placeholder: 'Ex.: precisamos conectar o ERP ao e-commerce'
      },
      options: [
        { value: 'suporte_ti', label: 'Suporte e gestão de TI' },
        { value: 'processos', label: 'Organização dos processos' },
        { value: 'automacao', label: 'Automatização de tarefas' },
        { value: 'ia', label: 'Inteligência Artificial' },
        { value: 'desenvolvimento', label: 'Desenvolvimento de sistema' },
        { value: 'integracao', label: 'Integração entre sistemas' },
        { value: 'infraestrutura', label: 'Infraestrutura / segurança' },
        { value: 'outro', label: 'Outro' }
      ]
    }
  ];

  const MAX_SCORE = QUESTIONS.reduce((total, question) => {
    if (!question.scored) return total;
    const table = QUIZ_SCORING[question.key] || {};
    const values = Object.keys(table).map((key) => table[key]);
    return total + (values.length ? Math.max.apply(null, values) : 0);
  }, 0);

  // ========================================
  // Ícones (mesmo traço Lucide usado no site)
  // ========================================
  const ICONS = {
    close: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    arrowRight: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    arrowLeft: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
    check: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
    alert: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    whatsapp: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z"/><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.25 8.24a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.39c0-4.54 3.7-8.24 8.26-8.24"/></svg>'
  };

  // ========================================
  // Tracking (UTM / identificadores de campanha)
  // ========================================
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const CLICK_ID_KEYS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid', 'ttclid', 'twclid', 'li_fat_id'];

  function readStoredTracking() {
    try {
      const raw = window.sessionStorage.getItem(CONFIG.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function persistTracking(data) {
    try {
      window.sessionStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
    } catch (error) {
      /* modo privado / storage indisponível: segue sem persistir */
    }
  }

  // Captura os parâmetros da URL uma vez e mantém durante toda a sessão,
  // mesmo que o visitante navegue entre páginas antes de abrir o modal.
  function resolveTracking() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = {};
    let hasCampaignData = false;

    UTM_KEYS.concat(CLICK_ID_KEYS).forEach((key) => {
      const value = (params.get(key) || '').trim();
      if (value) {
        fromUrl[key] = value.slice(0, 255);
        hasCampaignData = true;
      }
    });

    const stored = readStoredTracking();
    // Uma nova visita com parâmetros de campanha sobrescreve a anterior.
    const base = hasCampaignData ? fromUrl : (stored || {});

    const tracking = {};
    UTM_KEYS.forEach((key) => { tracking[key] = base[key] || ''; });
    CLICK_ID_KEYS.forEach((key) => { if (base[key]) tracking[key] = base[key]; });

    if (!stored || hasCampaignData) {
      tracking.landing_page = hasCampaignData || !stored
        ? window.location.pathname + window.location.search
        : stored.landing_page || '';
      tracking.referrer = (document.referrer || '').slice(0, 500);
      persistTracking(tracking);
    } else {
      tracking.landing_page = stored.landing_page || '';
      tracking.referrer = stored.referrer || '';
    }

    tracking.page = window.location.pathname;
    return tracking;
  }

  // ========================================
  // Analytics
  // Não instala nada: apenas alimenta o que já existir na página
  // (dataLayer/GTM, gtag/GA4, fbq/Meta) e emite um evento no document.
  // ========================================
  function track(eventName, params) {
    const detail = params || {};

    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push(Object.assign({ event: eventName }, detail));

      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, detail);
      }
      if (typeof window.fbq === 'function') {
        window.fbq('trackCustom', eventName, detail);
      }

      document.dispatchEvent(new CustomEvent('devbatista:' + eventName, { detail: detail }));
    } catch (error) {
      /* analytics nunca pode quebrar o fluxo do lead */
    }
  }

  // ========================================
  // Validação e máscara
  // ========================================
  function maskPhone(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    if (digits.length <= 2) return '(' + digits;
    if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
    if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
    return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
  }

  const VALIDATORS = {
    name: (value) => {
      if (!value) return 'Informe seu nome.';
      if (value.length < 2) return 'Nome muito curto.';
      if (value.length > 120) return 'Nome muito longo.';
      return '';
    },
    company: (value) => {
      if (!value) return 'Informe o nome da empresa.';
      if (value.length < 2) return 'Nome da empresa muito curto.';
      if (value.length > 120) return 'Nome da empresa muito longo.';
      return '';
    },
    phone: (value) => {
      const digits = value.replace(/\D/g, '');
      if (!digits) return 'Informe seu WhatsApp com DDD.';
      if (digits.length < 10 || digits.length > 11) return 'Informe o número com DDD (10 ou 11 dígitos).';
      if (Number(digits.slice(0, 2)) < 11) return 'DDD inválido.';
      if (digits.length === 11 && digits[2] !== '9') return 'Número de celular inválido.';
      return '';
    },
    email: (value) => {
      if (!value) return 'Informe seu e-mail.';
      if (value.length > 160) return 'E-mail muito longo.';
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(value)) return 'E-mail inválido.';
      return '';
    }
  };

  const IDENTITY_FIELDS = [
    { key: 'name', label: 'Nome', type: 'text', autocomplete: 'name', placeholder: 'Como podemos te chamar?' },
    { key: 'company', label: 'Empresa', type: 'text', autocomplete: 'organization', placeholder: 'Nome da sua empresa' },
    { key: 'phone', label: 'WhatsApp', type: 'tel', autocomplete: 'tel', placeholder: '(11) 99999-9999', inputmode: 'numeric' },
    { key: 'email', label: 'E-mail', type: 'email', autocomplete: 'email', placeholder: 'voce@empresa.com.br' }
  ];

  // ========================================
  // Cálculo do diagnóstico (espelhado no servidor)
  // ========================================
  function calculateDiagnosticScore(answers) {
    let score = 0;
    QUESTIONS.forEach((question) => {
      if (!question.scored) return;
      const table = QUIZ_SCORING[question.key];
      const answer = answers[question.key];
      if (table && Object.prototype.hasOwnProperty.call(table, answer)) {
        score += table[answer];
      }
    });
    return score;
  }

  function levelForScore(score) {
    return RESULT_LEVELS.find((level) => score <= level.max) || RESULT_LEVELS[RESULT_LEVELS.length - 1];
  }

  // ========================================
  // Estado
  // ========================================
  const state = {
    stepIndex: 0,
    answers: {},
    identity: { name: '', company: '', phone: '', email: '' },
    mainProblemOther: '',
    honeypot: '',
    startedAt: 0,
    submitting: false,
    submitted: false,
    result: null,
    opener: null,
    trigger: ''
  };

  // Passos: intro, identificação, uma tela por pergunta, resultado.
  const STEPS = ['intro', 'identify']
    .concat(QUESTIONS.map((question) => 'question:' + question.key))
    .concat(['result']);

  const QUESTION_TOTAL = QUESTIONS.length;

  // ========================================
  // Construção do modal
  // ========================================
  let dom = null;

  function buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'lq-overlay';
    overlay.hidden = true;
    overlay.setAttribute('data-lead-quiz', '');

    overlay.innerHTML =
      '<div class="lq-modal" role="dialog" aria-modal="true" aria-labelledby="lq-title" aria-describedby="lq-subtitle">' +
        '<button type="button" class="lq-close" aria-label="Fechar diagnóstico">' + ICONS.close + '</button>' +
        '<header class="lq-head">' +
          '<p class="lq-eyebrow">Diagnóstico Tecnológico</p>' +
          '<h2 class="lq-title" id="lq-title"></h2>' +
          '<p class="lq-subtitle" id="lq-subtitle"></p>' +
          '<div class="lq-progress" hidden>' +
            '<div class="lq-progress-info"><span class="lq-progress-label"></span><strong class="lq-progress-pct"></strong></div>' +
            '<div class="lq-progress-track"><span></span></div>' +
          '</div>' +
        '</header>' +
        '<div class="lq-body"></div>' +
        '<footer class="lq-foot">' +
          '<button type="button" class="lq-btn-back" hidden>' + ICONS.arrowLeft + '<span>Voltar</span></button>' +
          '<button type="button" id="lq-primary" class="lq-btn-next"><span>Continuar</span>' + ICONS.arrowRight + '</button>' +
        '</footer>' +
        '<p class="lq-live" role="status" aria-live="polite"></p>' +
      '</div>';

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      modal: overlay.querySelector('.lq-modal'),
      close: overlay.querySelector('.lq-close'),
      title: overlay.querySelector('.lq-title'),
      subtitle: overlay.querySelector('.lq-subtitle'),
      progress: overlay.querySelector('.lq-progress'),
      progressLabel: overlay.querySelector('.lq-progress-label'),
      progressPct: overlay.querySelector('.lq-progress-pct'),
      progressBar: overlay.querySelector('.lq-progress-track span'),
      body: overlay.querySelector('.lq-body'),
      foot: overlay.querySelector('.lq-foot'),
      back: overlay.querySelector('.lq-btn-back'),
      next: overlay.querySelector('#lq-primary'),
      live: overlay.querySelector('.lq-live'),
      steps: {}
    };

    buildSteps();
    bindModalEvents();
    return dom;
  }

  function buildSteps() {
    dom.steps.intro = buildIntroStep();
    dom.steps.identify = buildIdentifyStep();
    QUESTIONS.forEach((question) => {
      dom.steps['question:' + question.key] = buildQuestionStep(question);
    });
    dom.steps.result = buildResultStep();

    Object.keys(dom.steps).forEach((key) => {
      dom.steps[key].hidden = true;
      dom.body.appendChild(dom.steps[key]);
    });
  }

  function buildIntroStep() {
    const step = document.createElement('div');
    step.className = 'lq-step';
    step.innerHTML =
      '<div class="lq-intro-list">' +
        introItem('9 perguntas rápidas sobre a sua operação') +
        introItem('Leva cerca de 2 minutos, sem compromisso') +
        introItem('Você recebe uma leitura do cenário tecnológico da empresa') +
      '</div>' +
      '<p class="lq-note">' + ICONS.shield +
        '<span>Seus dados são usados apenas para o contato comercial da DevBatista. Nada é compartilhado com terceiros.</span>' +
      '</p>';
    return step;
  }

  function introItem(text) {
    return '<div class="lq-intro-item">' + ICONS.check + '<span>' + text + '</span></div>';
  }

  function buildIdentifyStep() {
    const step = document.createElement('div');
    step.className = 'lq-step';

    const form = document.createElement('form');
    form.className = 'lq-fields';
    form.setAttribute('novalidate', '');
    form.autocomplete = 'on';

    IDENTITY_FIELDS.forEach((field) => {
      const wrap = document.createElement('div');
      wrap.className = 'lq-field';

      const inputId = 'lq-field-' + field.key;
      const errorId = inputId + '-error';

      const label = document.createElement('label');
      label.setAttribute('for', inputId);
      label.textContent = field.label;

      const input = document.createElement('input');
      input.type = field.type;
      input.id = inputId;
      input.name = field.key;
      input.placeholder = field.placeholder;
      input.autocomplete = field.autocomplete;
      input.required = true;
      input.setAttribute('aria-describedby', errorId);
      if (field.inputmode) input.setAttribute('inputmode', field.inputmode);
      if (field.key === 'phone') input.maxLength = 16;

      const error = document.createElement('span');
      error.className = 'lq-error';
      error.id = errorId;

      input.addEventListener('input', () => {
        if (field.key === 'phone') {
          const masked = maskPhone(input.value);
          if (masked !== input.value) input.value = masked;
        }
        state.identity[field.key] = input.value;
        if (input.getAttribute('aria-invalid') === 'true') {
          const message = VALIDATORS[field.key](input.value.trim());
          if (!message) {
            input.removeAttribute('aria-invalid');
            error.textContent = '';
          }
        }
      });

      input.addEventListener('blur', () => {
        const message = VALIDATORS[field.key](input.value.trim());
        error.textContent = message;
        if (message) {
          input.setAttribute('aria-invalid', 'true');
        } else {
          input.removeAttribute('aria-invalid');
        }
      });

      wrap.appendChild(label);
      wrap.appendChild(input);
      wrap.appendChild(error);
      form.appendChild(wrap);

      field.input = input;
      field.errorEl = error;
    });

    // Honeypot: escondido de pessoas, atraente para bots.
    const honeypot = document.createElement('div');
    honeypot.className = 'lq-hp';
    honeypot.setAttribute('aria-hidden', 'true');
    honeypot.innerHTML =
      '<label for="lq-website">Não preencha este campo</label>' +
      '<input type="text" id="lq-website" name="website" tabindex="-1" autocomplete="off">';
    form.appendChild(honeypot);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      goNext();
    });

    step.appendChild(form);
    step.identityForm = form;
    step.honeypotInput = honeypot.querySelector('input');
    return step;
  }

  function buildQuestionStep(question) {
    const step = document.createElement('div');
    step.className = 'lq-step';

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'lq-question';

    const legend = document.createElement('legend');
    legend.textContent = question.label;
    fieldset.appendChild(legend);

    const list = document.createElement('div');
    list.className = 'lq-options';

    let pointerSelection = false;

    question.options.forEach((option) => {
      const label = document.createElement('label');
      label.className = 'lq-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'lq-' + question.key;
      input.value = option.value;

      const mark = document.createElement('span');
      mark.className = 'lq-option-mark';
      mark.setAttribute('aria-hidden', 'true');

      const text = document.createElement('span');
      text.className = 'lq-option-text';
      text.textContent = option.label;

      label.appendChild(input);
      label.appendChild(mark);
      label.appendChild(text);
      list.appendChild(label);

      // Avanço automático só em seleção por toque/clique. Com o teclado,
      // as setas percorrem o grupo e avançar sozinho impediria a escolha.
      label.addEventListener('pointerdown', () => {
        pointerSelection = true;
        window.setTimeout(() => { pointerSelection = false; }, 500);
      });

      // :focus-visible dentro do label depende de :has(); mantemos um
      // espelho em classe para navegadores que não suportam.
      input.addEventListener('focus', () => {
        let visible = true;
        try { visible = input.matches(':focus-visible'); } catch (error) { visible = true; }
        label.classList.toggle('is-focused', visible);
      });
      input.addEventListener('blur', () => label.classList.remove('is-focused'));

      input.addEventListener('change', () => {
        if (!input.checked) return;
        state.answers[question.key] = option.value;
        syncOptionStyles(list);
        updateConditional(step, question);
        updateFooter();

        if (pointerSelection && shouldAutoAdvance(question, option)) {
          pointerSelection = false;
          window.setTimeout(() => {
            if (state.answers[question.key] === option.value && currentStepId() === 'question:' + question.key) {
              goNext();
            }
          }, CONFIG.autoAdvanceDelay);
        }
      });
    });

    fieldset.appendChild(list);
    step.appendChild(fieldset);

    if (question.other) {
      const conditional = document.createElement('div');
      conditional.className = 'lq-conditional lq-field';
      conditional.hidden = true;

      const id = 'lq-' + question.other.name;
      const label = document.createElement('label');
      label.setAttribute('for', id);
      label.textContent = question.other.label;

      const textarea = document.createElement('textarea');
      textarea.id = id;
      textarea.name = question.other.name;
      textarea.rows = 3;
      textarea.maxLength = 500;
      textarea.placeholder = question.other.placeholder;
      textarea.addEventListener('input', () => {
        state.mainProblemOther = textarea.value;
      });

      conditional.appendChild(label);
      conditional.appendChild(textarea);
      step.appendChild(conditional);
      step.conditional = conditional;
      step.conditionalInput = textarea;
    }

    step.optionsList = list;
    return step;
  }

  function shouldAutoAdvance(question, option) {
    if (question.other && option.value === question.other.value) return false;
    return true;
  }

  function syncOptionStyles(list) {
    list.querySelectorAll('.lq-option').forEach((label) => {
      const input = label.querySelector('input');
      label.classList.toggle('is-checked', !!(input && input.checked));
    });
  }

  function updateConditional(step, question) {
    if (!question.other || !step.conditional) return;
    const show = state.answers[question.key] === question.other.value;
    step.conditional.hidden = !show;
    if (show) {
      window.setTimeout(() => step.conditionalInput.focus(), 80);
    }
  }

  function buildResultStep() {
    const step = document.createElement('div');
    step.className = 'lq-step';

    const loading = document.createElement('div');
    loading.className = 'lq-state';
    loading.innerHTML =
      '<div class="lq-spinner"></div>' +
      '<h3>Analisando suas respostas</h3>' +
      '<p>Estamos montando a leitura do cenário tecnológico da sua empresa.</p>';

    const error = document.createElement('div');
    error.className = 'lq-state';
    error.hidden = true;
    error.innerHTML =
      '<div class="lq-state-icon">' + ICONS.alert + '</div>' +
      '<h3>Não conseguimos enviar agora</h3>' +
      '<p class="lq-error-message">Houve uma falha de conexão. Suas respostas foram mantidas — é só tentar novamente.</p>';

    const success = document.createElement('div');
    success.hidden = true;
    success.innerHTML =
      '<div class="lq-result-card">' +
        '<span class="lq-result-badge"></span>' +
        '<div class="lq-gauge"><span></span></div>' +
        '<div class="lq-gauge-scale"><span>Estrutura simples</span><span>Alto potencial</span></div>' +
        '<h3 class="lq-result-title"></h3>' +
        '<p class="lq-result-copy"></p>' +
      '</div>' +
      '<div class="lq-result-points"></div>' +
      '<p class="lq-result-next">O próximo passo é uma conversa de 20 minutos para transformar esse diagnóstico em um plano com prioridades e prazos.</p>';

    step.appendChild(loading);
    step.appendChild(error);
    step.appendChild(success);

    step.loading = loading;
    step.error = error;
    step.errorMessage = error.querySelector('.lq-error-message');
    step.success = success;
    step.badge = success.querySelector('.lq-result-badge');
    step.gauge = success.querySelector('.lq-gauge span');
    step.resultTitle = success.querySelector('.lq-result-title');
    step.resultCopy = success.querySelector('.lq-result-copy');
    step.resultPoints = success.querySelector('.lq-result-points');
    return step;
  }

  // ========================================
  // Eventos do modal
  // ========================================
  function bindModalEvents() {
    dom.close.addEventListener('click', () => closeModal());

    dom.overlay.addEventListener('mousedown', (event) => {
      if (event.target === dom.overlay) closeModal();
    });

    dom.back.addEventListener('click', () => goBack());
    dom.next.addEventListener('click', () => goNext());

    document.addEventListener('keydown', (event) => {
      if (dom.overlay.hidden) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }

      if (event.key === 'Tab') {
        trapFocus(event);
      }
    });
  }

  function focusableElements() {
    const selector = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const nodes = Array.prototype.slice.call(dom.modal.querySelectorAll(selector));
    const seenRadioGroups = {};

    return nodes.filter((node) => {
      if (node.hidden || node.closest('[hidden]')) return false;
      if (!node.offsetParent && node.type !== 'hidden' && getComputedStyle(node).position !== 'fixed') return false;

      // Grupo de rádio é um único ponto de tabulação.
      if (node.type === 'radio') {
        const group = node.name;
        if (seenRadioGroups[group]) return false;
        const checked = dom.modal.querySelector('input[name="' + group + '"]:checked');
        if (checked && checked !== node) return false;
        seenRadioGroups[group] = true;
      }
      return true;
    });
  }

  function trapFocus(event) {
    const items = focusableElements();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !dom.modal.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ========================================
  // Abertura / fechamento
  // ========================================
  function openModal(opener, triggerLabel) {
    if (!dom) buildModal();

    state.opener = opener || null;
    state.trigger = triggerLabel || '';
    if (!state.startedAt) state.startedAt = Date.now();

    dom.overlay.hidden = false;
    document.body.classList.add('lq-open');

    // Se já enviou, volta direto para o resultado — evita lead duplicado.
    renderStep(state.submitted ? STEPS.indexOf('result') : state.stepIndex);

    track('lead_quiz_opened', {
      trigger: state.trigger,
      page: window.location.pathname
    });
  }

  function closeModal() {
    if (!dom || dom.overlay.hidden) return;

    dom.overlay.hidden = true;
    document.body.classList.remove('lq-open');

    if (state.opener && typeof state.opener.focus === 'function') {
      state.opener.focus();
    }
  }

  // ========================================
  // Navegação entre etapas
  // ========================================
  function currentStepId() {
    return STEPS[state.stepIndex];
  }

  function questionForStep(stepId) {
    if (stepId.indexOf('question:') !== 0) return null;
    const key = stepId.slice('question:'.length);
    return QUESTIONS.find((question) => question.key === key) || null;
  }

  function questionNumber(stepId) {
    const question = questionForStep(stepId);
    if (!question) return 0;
    return QUESTIONS.indexOf(question) + 1;
  }

  function renderStep(index) {
    state.stepIndex = Math.max(0, Math.min(index, STEPS.length - 1));
    const stepId = currentStepId();

    Object.keys(dom.steps).forEach((key) => {
      const isActive = key === stepId;
      dom.steps[key].hidden = !isActive;
      if (isActive) {
        // Reinicia a animação de entrada da etapa.
        dom.steps[key].style.animation = 'none';
        void dom.steps[key].offsetWidth;
        dom.steps[key].style.animation = '';
      }
    });

    updateHeader(stepId);
    updateFooter();
    dom.body.scrollTop = 0;
    focusStep(stepId);
  }

  function updateHeader(stepId) {
    const question = questionForStep(stepId);

    if (stepId === 'intro') {
      dom.title.textContent = 'Diagnóstico Tecnológico';
      dom.subtitle.textContent = 'Descubra em poucos minutos onde a tecnologia pode ajudar sua empresa a ganhar produtividade, reduzir tarefas manuais e melhorar seus processos.';
      dom.progress.hidden = true;
      return;
    }

    if (stepId === 'identify') {
      dom.title.textContent = 'Antes de começar';
      dom.subtitle.textContent = 'Precisamos apenas do básico para enviar o resultado e dar continuidade.';
      dom.progress.hidden = true;
      return;
    }

    if (stepId === 'result') {
      dom.progress.hidden = true;
      if (state.result) {
        dom.title.textContent = 'Seu diagnóstico está pronto';
        dom.subtitle.textContent = 'Veja o que identificamos a partir das suas respostas.';
      } else {
        dom.title.textContent = 'Finalizando seu diagnóstico';
        dom.subtitle.textContent = '';
      }
      return;
    }

    if (question) {
      const number = questionNumber(stepId);
      const pct = Math.round((number / QUESTION_TOTAL) * 100);

      // A pergunta é o <legend> do corpo; o título fica estável no topo
      // para não repetir o mesmo texto duas vezes na mesma tela.
      dom.title.textContent = 'Diagnóstico Tecnológico';
      dom.subtitle.textContent = question.scored
        ? ''
        : 'Última pergunta — ela não entra na pontuação, serve para direcionar a conversa.';
      dom.progress.hidden = false;
      dom.progressLabel.textContent = 'Pergunta ' + number + ' de ' + QUESTION_TOTAL;
      dom.progressPct.textContent = pct + '%';
      dom.progressBar.style.width = pct + '%';
      dom.live.textContent = 'Pergunta ' + number + ' de ' + QUESTION_TOTAL + ': ' + question.label;
    }
  }

  function updateFooter() {
    const stepId = currentStepId();
    const question = questionForStep(stepId);

    dom.back.hidden = stepId === 'intro' || stepId === 'result';
    dom.next.disabled = false;
    dom.next.className = 'lq-btn-next';
    dom.foot.hidden = false;
    dom.foot.classList.remove('lq-foot-wide');

    if (stepId === 'intro') {
      setNextLabel('Começar diagnóstico', ICONS.arrowRight);
      return;
    }

    if (stepId === 'identify') {
      setNextLabel('Continuar', ICONS.arrowRight);
      return;
    }

    if (question) {
      const answered = !!state.answers[question.key];
      const isLast = QUESTIONS.indexOf(question) === QUESTIONS.length - 1;
      dom.next.disabled = !answered;
      setNextLabel(isLast ? 'Ver meu diagnóstico' : 'Continuar', ICONS.arrowRight);
      return;
    }

    // Resultado
    renderResultFooter();
  }

  function setNextLabel(text, icon) {
    dom.next.innerHTML = '<span>' + text + '</span>' + (icon || '');
    dom.nextLabel = dom.next.querySelector('span');
  }

  function renderResultFooter() {
    dom.back.hidden = true;
    dom.foot.hidden = false;
    dom.foot.classList.add('lq-foot-wide');

    if (state.submitting) {
      dom.next.disabled = true;
      dom.next.className = 'lq-btn-next lq-grow';
      setNextLabel('Enviando…', '');
      return;
    }

    if (!state.result) {
      // Estado de erro: permite tentar de novo sem perder as respostas.
      dom.back.hidden = false;
      dom.next.disabled = false;
      dom.next.className = 'lq-btn-next lq-grow';
      setNextLabel('Tentar novamente', ICONS.arrowRight);
      return;
    }

    dom.next.disabled = false;
    dom.next.className = 'lq-btn-wa lq-grow';
    dom.next.innerHTML = ICONS.whatsapp + '<span>Falar com um especialista</span>';
  }

  function focusStep(stepId) {
    window.setTimeout(() => {
      if (dom.overlay.hidden) return;

      if (stepId === 'identify') {
        const first = dom.steps.identify.querySelector('input[name="name"]');
        if (first) { first.focus(); return; }
      }

      const question = questionForStep(stepId);
      if (question) {
        const step = dom.steps[stepId];
        const checked = step.querySelector('input:checked');
        const target = checked || step.querySelector('input');
        if (target) { target.focus(); return; }
      }

      // O foco nunca pode escapar do modal: se o botão principal estiver
      // desabilitado (envio em andamento), cai no X.
      if (!dom.next.disabled) dom.next.focus();
      else dom.close.focus();
    }, 60);
  }

  function goBack() {
    const stepId = currentStepId();

    if (stepId === 'result' && !state.result) {
      // Erro no envio: volta para a última pergunta preservando tudo.
      renderStep(STEPS.length - 2);
      return;
    }

    renderStep(state.stepIndex - 1);
  }

  function goNext() {
    const stepId = currentStepId();

    if (stepId === 'intro') {
      track('lead_quiz_started', { page: window.location.pathname });
      renderStep(state.stepIndex + 1);
      return;
    }

    if (stepId === 'identify') {
      if (!validateIdentity()) return;
      track('lead_quiz_identification_completed', { page: window.location.pathname });
      renderStep(state.stepIndex + 1);
      return;
    }

    if (stepId === 'result') {
      if (state.result) {
        openWhatsApp();
      } else if (!state.submitting) {
        submitLead();
      }
      return;
    }

    const question = questionForStep(stepId);
    if (question && !state.answers[question.key]) return;

    const isLastQuestion = question && QUESTIONS.indexOf(question) === QUESTIONS.length - 1;
    if (isLastQuestion) {
      track('lead_quiz_completed', {
        diagnostic_score: calculateDiagnosticScore(state.answers),
        main_problem: state.answers.main_problem || ''
      });
      submitLead();
      return;
    }

    renderStep(state.stepIndex + 1);
  }

  function validateIdentity() {
    let firstInvalid = null;

    IDENTITY_FIELDS.forEach((field) => {
      const value = field.input.value.trim();
      const message = VALIDATORS[field.key](value);
      field.errorEl.textContent = message;

      if (message) {
        field.input.setAttribute('aria-invalid', 'true');
        if (!firstInvalid) firstInvalid = field.input;
      } else {
        field.input.removeAttribute('aria-invalid');
        state.identity[field.key] = value;
      }
    });

    if (firstInvalid) {
      firstInvalid.focus();
      dom.live.textContent = 'Verifique os campos destacados.';
      return false;
    }

    state.honeypot = dom.steps.identify.honeypotInput.value;
    return true;
  }

  // ========================================
  // Envio do lead
  // ========================================
  function buildPayload() {
    const answers = {};
    QUESTIONS.forEach((question) => {
      if (question.scored) answers[question.key] = state.answers[question.key] || '';
    });

    const mainProblem = state.answers.main_problem || '';

    return {
      name: state.identity.name,
      company: state.identity.company,
      email: state.identity.email,
      phone: state.identity.phone,
      answers: answers,
      main_problem: mainProblem,
      main_problem_other: mainProblem === 'outro' ? state.mainProblemOther.trim() : '',
      diagnostic_score: calculateDiagnosticScore(answers),
      tracking: resolveTracking(),
      website: state.honeypot,
      meta: {
        elapsed_ms: state.startedAt ? Date.now() - state.startedAt : 0,
        page_url: window.location.href,
        trigger: state.trigger
      }
    };
  }

  function submitLead() {
    // Trava contra duplo clique / múltiplos leads.
    if (state.submitting || state.submitted) return;

    state.submitting = true;
    state.result = null;

    const step = dom.steps.result;
    step.loading.hidden = false;
    step.error.hidden = true;
    step.success.hidden = true;

    if (currentStepId() !== 'result') {
      renderStep(STEPS.indexOf('result'));
    } else {
      updateHeader('result');
      renderResultFooter();
    }

    const payload = buildPayload();
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? window.setTimeout(() => controller.abort(), CONFIG.requestTimeout) : null;

    fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then((response) => response.json().catch(() => null).then((body) => ({ response: response, body: body })))
      .then(({ response, body }) => {
        if (!response.ok || !body || body.ok !== true) {
          // Só a mensagem vinda da API é mostrada ao visitante; erros de
          // rede/runtime viram um texto genérico em showError().
          const apiMessage = body && body.error && body.error.message;
          const failure = new Error(apiMessage || '');
          failure.fromApi = !!apiMessage;
          throw failure;
        }
        // O servidor é a fonte de verdade do score; o cálculo local é só
        // para exibição imediata caso a resposta não traga os campos.
        showResult(body.data || {}, payload.diagnostic_score);
        track('lead_submitted', {
          diagnostic_score: (body.data && body.data.diagnostic_score) || payload.diagnostic_score,
          diagnostic_level: (body.data && body.data.diagnostic_level) || '',
          main_problem: payload.main_problem
        });
      })
      .catch((error) => {
        if (error && error.name === 'AbortError') {
          showError('A conexão demorou demais para responder. Suas respostas foram mantidas — é só tentar novamente.');
        } else if (error && error.fromApi) {
          showError(error.message);
        } else {
          if (window.console && window.console.error) window.console.error('[lead-quiz]', error);
          showError('Não conseguimos enviar agora. Suas respostas foram mantidas — verifique sua conexão e tente novamente.');
        }
      })
      .then(() => {
        if (timer) window.clearTimeout(timer);
        state.submitting = false;
        renderResultFooter();
      });
  }

  function showResult(data, fallbackScore) {
    const step = dom.steps.result;
    const score = typeof data.diagnostic_score === 'number' ? data.diagnostic_score : fallbackScore;
    const level = RESULT_LEVELS.find((item) => item.id === data.diagnostic_level) || levelForScore(score);

    state.submitted = true;
    state.result = { score: score, level: level };

    step.badge.textContent = level.badge;
    step.resultTitle.textContent = data.diagnostic_title || level.title;
    step.resultCopy.textContent = level.copy;
    step.resultPoints.innerHTML = level.points
      .map((point) => '<div class="lq-result-point">' + ICONS.check + '<span>' + point + '</span></div>')
      .join('');

    step.loading.hidden = true;
    step.error.hidden = true;
    step.success.hidden = false;

    updateHeader('result');
    dom.live.textContent = 'Diagnóstico concluído: ' + level.title;

    // Anima o medidor depois da troca de tela.
    const pct = MAX_SCORE ? Math.min(100, Math.round((score / MAX_SCORE) * 100)) : 0;
    window.setTimeout(() => { step.gauge.style.width = Math.max(pct, 6) + '%'; }, 120);
  }

  function showError(message) {
    const step = dom.steps.result;
    state.result = null;
    step.errorMessage.textContent = message;
    step.loading.hidden = true;
    step.success.hidden = true;
    step.error.hidden = false;
    updateHeader('result');
    dom.live.textContent = message;
  }

  function openWhatsApp() {
    const level = state.result ? state.result.level : null;
    const lines = [
      'Olá! Acabei de realizar o Diagnóstico Tecnológico no site da DevBatista e gostaria de conversar sobre os resultados.',
      '',
      'Nome: ' + (state.identity.name || 'Não informado'),
      'Empresa: ' + (state.identity.company || 'Não informado')
    ];

    if (level) lines.push('Resultado: ' + level.title);

    const url = 'https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(lines.join('\n'));

    track('lead_whatsapp_clicked', {
      diagnostic_level: level ? level.id : '',
      page: window.location.pathname
    });

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ========================================
  // Gatilhos: um único listener delegado
  // ========================================
  function initTriggers() {
    document.addEventListener('click', (event) => {
      // Cmd/Ctrl/middle click continuam abrindo o link original.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!event.target || typeof event.target.closest !== 'function') return;

      const trigger = event.target.closest('[data-lead-modal]');
      if (!trigger) return;

      event.preventDefault();
      openModal(trigger, trigger.getAttribute('data-lead-modal') || (trigger.textContent || '').trim().slice(0, 60));
    });
  }

  // ========================================
  // Boot
  // ========================================
  document.addEventListener('DOMContentLoaded', () => {
    initTriggers();
    resolveTracking();

    // Abertura programática: ?diagnostico=1 ou #diagnostico (usável em anúncios).
    const params = new URLSearchParams(window.location.search);
    if (params.get('diagnostico') === '1' || window.location.hash === '#diagnostico') {
      openModal(null, 'url');
    }
  });

  // API mínima para integrações futuras.
  window.DevBatistaLeadQuiz = {
    open: (trigger) => openModal(null, trigger || 'api'),
    close: closeModal,
    scoring: QUIZ_SCORING
  };
})();
