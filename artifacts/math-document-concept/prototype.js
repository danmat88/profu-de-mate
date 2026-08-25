(() => {
  const revealDocument = () => document.documentElement.classList.add('math-ready');
  window.addEventListener('load', () => window.setTimeout(revealDocument, 450));
  window.setTimeout(revealDocument, 1800);

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('screen');
  const artifacts = [...document.querySelectorAll('[data-artifact]')];

  if (requested) {
    const selected = artifacts.find((artifact) => artifact.dataset.artifact === requested);
    if (selected) {
      document.body.classList.add('focus-mode');
      selected.classList.add('is-focused');
      document.title = `Profu’ de mate — ${requested}`;
    }
  }

  document.querySelectorAll('[data-screen]').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelector(`[data-artifact="${button.dataset.screen}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
})();
