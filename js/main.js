// ========================================
// DevBatista - Main JavaScript
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  // Navigation scroll effect
  const nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  // Mobile menu toggle
  const mobileBtn = document.querySelector('.nav-mobile-btn');
  const mobileMenu = document.querySelector('.nav-mobile-menu');
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.contains('open');
      mobileMenu.classList.toggle('open');
      mobileBtn.innerHTML = isOpen
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    });

    // Close mobile menu on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
      });
    });
  }

  // Contact form
  const form = document.querySelector('#contact-form');
  if (form) {
    const whatsappNumber = '5511991308008';
    const subjectLabels = {
      website: 'Desenvolvimento de Website',
      webapp: 'Aplicacao Web',
      api: 'API / Backend',
      maintenance: 'Manutencao',
      consultation: 'Consultoria',
      other: 'Outro'
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const subjectValue = (formData.get('subject') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      const subject = subjectLabels[subjectValue] || 'Nao informado';

      const whatsappText = [
        'Ola, DevBatista! Gostaria de solicitar um orcamento.',
        '',
        `Nome: ${name}`,
        `Email: ${email}`,
        `Assunto: ${subject}`,
        `Mensagem: ${message}`
      ].join('\n');

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      alert('Redirecionando para o WhatsApp em uma nova aba.');
      form.reset();
    });
  }

  // Scroll animations (Intersection Observer)
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };

  // FAQ accordion behavior (only one item open at a time)
  const faqItems = document.querySelectorAll('.faq-list .faq-item');
  if (faqItems.length > 0) {
    faqItems.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;

        faqItems.forEach((otherItem) => {
          if (otherItem !== item) {
            otherItem.open = false;
          }
        });
      });
    });
  }

  // Home scrollytelling process
  const scrollySteps = document.querySelectorAll('.scrolly-step');
  const scrollyTitle = document.querySelector('#scrolly-title');
  const scrollyStatus = document.querySelector('#scrolly-status');
  const scrollyMetric = document.querySelector('#scrolly-metric');
  const scrollyStepLabel = document.querySelector('#scrolly-step-label');
  const scrollyProgressText = document.querySelector('#scrolly-progress-text');
  const scrollyProgressBar = document.querySelector('#scrolly-progress-bar');
  const scrollyFlowItems = document.querySelectorAll('.scrolly-flow span');

  if (scrollySteps.length > 0 && scrollyTitle && scrollyStatus && scrollyMetric && scrollyStepLabel && scrollyProgressText && scrollyProgressBar) {
    const setActiveScrollyStep = (step) => {
      const stepIndex = Array.from(scrollySteps).indexOf(step);
      const progress = step.dataset.progress || '20';

      scrollySteps.forEach((item) => item.classList.toggle('active', item === step));
      scrollyTitle.textContent = step.dataset.title || '';
      scrollyStatus.textContent = step.dataset.status || '';
      scrollyMetric.textContent = step.dataset.metric || '';
      scrollyStepLabel.textContent = `Etapa ${step.dataset.step || ''}`;
      scrollyProgressText.textContent = `${progress}%`;
      scrollyProgressBar.style.width = `${progress}%`;

      scrollyFlowItems.forEach((item, index) => {
        item.classList.toggle('active', index <= stepIndex);
      });
    };

    const scrollyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveScrollyStep(entry.target);
        }
      });
    }, {
      threshold: 0.55,
      rootMargin: '-15% 0px -25% 0px'
    });

    scrollySteps.forEach((step) => scrollyObserver.observe(step));
    setActiveScrollyStep(scrollySteps[0]);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
});
