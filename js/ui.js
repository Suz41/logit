window.Logit = window.Logit || {};

Logit.UI = {
  /** @param {HTMLElement} container */
  showLoading(container) {
    container.innerHTML =
      '<div class="loading"><div class="loadingDot"></div><div class="loadingDot"></div><div class="loadingDot"></div></div>';
  },

  /** @param {HTMLElement} container @param {string} msg @param {Function} escHelper */
  showError(container, msg, escHelper) {
    container.innerHTML = '<div class="errorMsg">' + escHelper(msg) + '</div>';
  },

  /** @param {HTMLElement} navBar */
  setupAutoHideNav(navBar) {
    if (!navBar) return;
    if (window.innerWidth >= 1024) return;

    let lastScroll = 0;
    let ticking = false;

    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          const st = window.scrollY;
          if (st > lastScroll && st > 100) {
            navBar.classList.add('hidden');
          } else {
            navBar.classList.remove('hidden');
          }
          lastScroll = st;
          ticking = false;
        });
      },
      { passive: true }
    );
  }
};
