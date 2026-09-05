// ========================================
// DevBatista - Landing page do e-book
// Captura de e-mail e liberação do PDF.
// Vanilla JS, sem dependências. Mesmo padrão de js/main.js.
// ========================================

(function () {
  'use strict';

  // ========================================
  // Configuração
  // Ponto único de ajuste. Nenhum token, chave ou ID de conta aqui:
  // credenciais ficam no servidor (api/config.php) e os pixels são
  // instalados na página, não neste arquivo.
  // ========================================
  const CONFIG = {
    // Endpoint que recebe o lead. Trocar aqui para apontar para outro
    // backend, um proxy ou um serviço externo.
    endpoint: '/api/ebook.php',

    // Arquivo entregue após a conversão. Fica em /materiais/ e não em
    // /ebook/: um diretório com esse nome sequestraria a URL da página.
    ebookUrl: '/materiais/ebook-devbatista-sua-empresa-esta-perdendo-dinheir-com-a-ti.pdf',
    ebookFileName: 'ebook-devbatista-sua-empresa-esta-perdendo-dinheir-com-a-ti.pdf',

    // Identifica a origem do lead no CRM.
    source: 'ebook-gestao-estrategica-ti',

    requestTimeout: 15000,
    storageKey: 'devbatista:tracking'
  };

  // ========================================
  // Analytics
  // Os nomes ficam centralizados aqui. Nada é instalado por este script:
  // ele apenas alimenta o que já existir na página (GTM, GA4, Meta Pixel).
  // ========================================
  const EVENTS = {
    view: 'ebook_lp_view',
    formStarted: 'ebook_form_started',
    download: 'ebook_download',
    ctaClick: 'ebook_cta_click'
  };

  // Eventos padrão de conversão das plataformas de mídia. Disparados
  // apenas na conversão e somente se o respectivo script existir.
  const CONVERSION = {
    ga4: { event: 'generate_lead', currency: 'BRL', value: 0 },
    meta: { event: 'Lead' }
  };

  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const CLICK_ID_KEYS = ['gclid', 'fbclid', 'msclkid'];

  const state = {
    submitting: false,
    submitted: false,
    formStarted: false,
    startedAt: Date.now()
  };

  const dom = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    dom.form = document.querySelector('#ebook-form');
    dom.card = document.querySelector('#formulario');
    if (!dom.form || !dom.card) return;

    dom.email = dom.form.querySelector('#ebook-email');
    dom.honeypot = dom.form.querySelector('#ebook-website');
    dom.submit = dom.form.querySelector('[data-ebook-submit]');
    dom.submitLabel = dom.form.querySelector('[data-ebook-submit-label]');
    dom.submitIcon = dom.form.querySelector('[data-ebook-submit-icon]');
    dom.fieldError = dom.form.querySelector('#ebook-email-error');
    dom.fieldErrorText = dom.form.querySelector('[data-ebook-error-text]');
    dom.alert = dom.form.querySelector('[data-ebook-alert]');
    dom.alertText = dom.form.querySelector('[data-ebook-alert-text]');
    dom.panelForm = dom.card.querySelector('[data-ebook-panel="form"]');
    dom.panelSuccess = dom.card.querySelector('[data-ebook-panel="success"]');
    dom.successEmail = dom.card.querySelector('[data-ebook-success-email]');
    dom.download = dom.card.querySelector('[data-ebook-download]');
    dom.live = dom.card.querySelector('[data-ebook-live]');

    if (dom.download) {
      dom.download.href = CONFIG.ebookUrl;
      dom.download.setAttribute('download', CONFIG.ebookFileName);
    }

    initNavScroll();
    initCoverFallback();
    initSecondaryCtas();

    dom.form.addEventListener('submit', onSubmit);
    dom.email.addEventListener('input', onEmailInput);
    dom.email.addEventListener('blur', () => {
      if (dom.email.value.trim() !== '') validateField();
    });

    track(EVENTS.view, { page: window.location.pathname });
  }

  // ========================================
  // Navegação: estado ao rolar
  // Mesmo comportamento de js/main.js, replicado aqui para a landing
  // page não precisar carregar o bundle inteiro do site.
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
  // Mockup: capa real x capa desenhada
  // Enquanto /images/ebook-capa.png não existir, a capa em CSS assume.
  // ========================================
  function initCoverFallback() {
    const mockup = document.querySelector('[data-ebook-mockup]');
    const cover = document.querySelector('[data-ebook-cover]');
    if (!mockup || !cover) return;

    const useFallback = () => mockup.classList.add('is-fallback');

    if (cover.complete) {
      if (!cover.naturalWidth) useFallback();
      return;
    }
    cover.addEventListener('error', useFallback);
  }

  // ========================================
  // CTAs secundários: rolam até o formulário
  // ========================================
  function initSecondaryCtas() {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('[data-ebook-cta]').forEach((cta) => {
      cta.addEventListener('click', (event) => {
        event.preventDefault();
        track(EVENTS.ctaClick, { location: cta.dataset.ebookCta || '' });

        dom.card.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center'
        });

        // Só foca o campo quando ele ainda está lá para ser preenchido.
        if (!state.submitted) {
          window.setTimeout(() => dom.email.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
        }
      });
    });
  }

  // ========================================
  // Validação
  // ========================================
  // Deliberadamente permissiva: barra erro de digitação, não endereços
  // válidos incomuns. A validação que vale é a do servidor.
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

  function validateEmail(value) {
    const email = String(value || '').trim();

    if (email === '') return 'Informe seu e-mail para receber o material.';
    if (email.length > 160) return 'E-mail muito longo.';
    if (!EMAIL_PATTERN.test(email)) return 'Confira o e-mail: parece estar incompleto.';

    return '';
  }

  function validateField() {
    const message = validateEmail(dom.email.value);
    showFieldError(message);
    return message === '';
  }

  function showFieldError(message) {
    const hasError = message !== '';

    dom.email.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    dom.fieldError.hidden = !hasError;
    dom.fieldErrorText.textContent = message;
  }

  function showAlert(message) {
    dom.alert.hidden = message === '';
    dom.alertText.textContent = message;
  }

  function onEmailInput() {
    if (!state.formStarted) {
      state.formStarted = true;
      track(EVENTS.formStarted, { page: window.location.pathname });
    }
    // Corrigir o campo limpa o erro na hora: nada de erro fantasma.
    if (dom.email.getAttribute('aria-invalid') === 'true') showFieldError('');
    showAlert('');
  }

  // ========================================
  // Envio
  // ========================================
  function onSubmit(event) {
    event.preventDefault();

    if (state.submitting || state.submitted) return;

    showAlert('');
    if (!validateField()) {
      dom.email.focus();
      return;
    }

    const email = dom.email.value.trim();

    setLoading(true);

    submitLead(email)
      .then(() => showSuccess(email))
      .catch((error) => {
        setLoading(false);
        showAlert(errorMessage(error));
        dom.email.focus();
      });
  }

  /**
   * Envia o lead ao endpoint configurado.
   *
   * Isolada de propósito: para trocar o destino (backend próprio, HubSpot
   * Forms API via proxy, outro CRM) basta mudar esta função e CONFIG.endpoint.
   *
   * @param {string} email
   * @returns {Promise<object>} corpo da resposta em caso de sucesso
   */
  function submitLead(email) {
    const payload = {
      email: email,
      source: CONFIG.source,
      tracking: resolveTracking(),
      website: dom.honeypot ? dom.honeypot.value : '',
      meta: {
        elapsed_ms: Date.now() - state.startedAt,
        page_url: window.location.href
      }
    };

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller
      ? window.setTimeout(() => controller.abort(), CONFIG.requestTimeout)
      : null;

    state.submitting = true;

    return fetch(CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    })
      .then((response) => response.json().catch(() => null).then((body) => ({ response, body })))
      .then(({ response, body }) => {
        if (!response.ok || !body || body.ok !== true) {
          // Só mensagem vinda da API chega ao visitante; o resto vira
          // texto genérico em errorMessage().
          const apiMessage = body && body.error && body.error.message;
          const failure = new Error(apiMessage || 'request_failed');
          failure.fromApi = !!apiMessage;
          throw failure;
        }
        return body.data || {};
      })
      .then((data) => {
        state.submitting = false;
        if (timer) window.clearTimeout(timer);
        return data;
      })
      .catch((error) => {
        state.submitting = false;
        if (timer) window.clearTimeout(timer);
        throw error;
      });
  }

  function errorMessage(error) {
    if (error && error.name === 'AbortError') {
      return 'A conexão demorou demais para responder. Tente novamente.';
    }
    if (error && error.fromApi) {
      return error.message;
    }
    if (window.console && window.console.error) window.console.error('[ebook]', error);
    return 'Não conseguimos enviar agora. Verifique sua conexão e tente novamente.';
  }

  function setLoading(loading) {
    dom.submit.disabled = loading;
    dom.submitLabel.textContent = loading ? 'ENVIANDO…' : 'QUERO RECEBER O E-BOOK';
    dom.submit.setAttribute('aria-busy', loading ? 'true' : 'false');

    if (dom.submitIcon) dom.submitIcon.hidden = loading;

    let spinner = dom.submit.querySelector('.ebook-spinner');
    if (loading && !spinner) {
      spinner = document.createElement('span');
      spinner.className = 'ebook-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      dom.submit.appendChild(spinner);
    } else if (!loading && spinner) {
      spinner.remove();
    }

    if (loading) dom.live.textContent = 'Enviando seu e-mail…';
  }

  // ========================================
  // Conversão
  // ========================================
  function showSuccess(email) {
    state.submitted = true;
    state.submitting = false;

    dom.panelForm.hidden = true;
    dom.panelSuccess.hidden = false;

    if (dom.successEmail) dom.successEmail.textContent = email;

    dom.live.textContent = 'E-book liberado. O download vai começar automaticamente.';
    dom.panelSuccess.focus({ preventScroll: true });

    trackConversion();
    startDownload();
  }

  /**
   * Dispara o download sem tirar o visitante da página.
   * O botão do card de sucesso continua disponível: alguns navegadores
   * bloqueiam downloads automáticos fora de um clique direto.
   */
  function startDownload() {
    try {
      const link = document.createElement('a');
      link.href = CONFIG.ebookUrl;
      link.download = CONFIG.ebookFileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      /* o botão visível cobre este caso */
    }
  }

  // ========================================
  // Camada de analytics
  // Não instala nada: alimenta o que já existir na página
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

  /**
   * Conversão: evento próprio + eventos padrão de GA4 e Meta.
   * Os padrão são o que as plataformas otimizam em campanha.
   */
  function trackConversion() {
    const detail = {
      page: window.location.pathname,
      content_name: CONFIG.source,
      method: 'ebook_form'
    };

    track(EVENTS.download, detail);

    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', CONVERSION.ga4.event, Object.assign({
          currency: CONVERSION.ga4.currency,
          value: CONVERSION.ga4.value
        }, detail));
      }
      if (typeof window.fbq === 'function') {
        window.fbq('track', CONVERSION.meta.event, {
          content_name: CONFIG.source,
          content_category: 'ebook'
        });
      }
    } catch (error) {
      /* idem: conversão registrada é bônus, não pode quebrar a entrega */
    }
  }

  // ========================================
  // Origem do tráfego
  // Capturada uma vez e mantida na sessão, mesmo que o visitante
  // navegue antes de converter.
  // ========================================
  function readStoredTracking() {
    try {
      const raw = window.sessionStorage.getItem(CONFIG.storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : null;
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
      tracking.landing_page = window.location.pathname + window.location.search;
      tracking.referrer = (document.referrer || '').slice(0, 500);
      persistTracking(tracking);
    } else {
      tracking.landing_page = stored.landing_page || '';
      tracking.referrer = stored.referrer || '';
    }

    tracking.page = window.location.pathname;
    return tracking;
  }
})();
