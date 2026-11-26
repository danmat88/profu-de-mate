(() => {
  const root = document.documentElement;
  root.classList.add('js');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Interactive Hero Phone Showcase Tabs (with gentle auto-demo until user clicks)
  const phoneTabs = Array.from(document.querySelectorAll('[data-phone-tab]'));
  const phonePanels = Array.from(document.querySelectorAll('[data-phone-panel]'));
  const phonePill = document.querySelector('[data-phone-pill]');
  let userInteractedPhone = false;
  let activePhoneIndex = 0;

  function selectPhoneTab(index) {
    const safeIdx = ((index % phoneTabs.length) + phoneTabs.length) % phoneTabs.length;
    activePhoneIndex = safeIdx;
    const targetTab = phoneTabs[safeIdx];
    const targetKey = targetTab.getAttribute('data-phone-tab');
    const pillLabel = targetTab.getAttribute('data-phone-badge') || '';

    phoneTabs.forEach((btn, i) => {
      btn.setAttribute('aria-selected', i === safeIdx ? 'true' : 'false');
    });
    phonePanels.forEach((panel) => {
      const match = panel.getAttribute('data-phone-panel') === targetKey;
      panel.classList.toggle('is-active', match);
    });
    if (phonePill && pillLabel) {
      phonePill.textContent = pillLabel;
    }
  }

  if (phoneTabs.length > 0 && phonePanels.length > 0) {
    phoneTabs.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        userInteractedPhone = true;
        selectPhoneTab(idx);
      });
    });

    if (!prefersReduced) {
      window.setInterval(() => {
        if (!userInteractedPhone && !document.hidden) {
          selectPhoneTab(activePhoneIndex + 1);
        }
      }, 5500);
    }
  }

  // 2. Interactive Curriculum Track Explorer (V-VII, EN, Liceu, BAC M1/M2/M3)
  const trackBtns = Array.from(document.querySelectorAll('[data-track-btn]'));
  const trackPanels = Array.from(document.querySelectorAll('[data-track-panel]'));

  trackBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-track-btn');
      trackBtns.forEach((item) => {
        item.setAttribute('aria-selected', item === btn ? 'true' : 'false');
      });
      trackPanels.forEach((panel) => {
        panel.classList.toggle('is-active', panel.getAttribute('data-track-panel') === key);
      });
    });
  });

  // 3. Smooth Scroll Reveal for Sections
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  if (prefersReduced || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -36px 0px' },
    );
    revealEls.forEach((el) => observer.observe(el));
  }
})();
