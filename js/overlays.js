window.Logit = window.Logit || {};

Logit.Overlays = {
  stack: [],
  _closing: false,

  /** @param {Function} closeFn */
  push(closeFn) {
    this.stack.push(closeFn);
    history.pushState({ overlay: true }, '');
  },

  closeTop() {
    if (this.stack.length === 0) return;
    this._closing = true;
    const close = this.stack.pop();
    if (close) close();
    if (history.state && history.state.overlay) {
      history.back();
    }
    setTimeout(function () {
      Logit.Overlays._closing = false;
    }, 50);
  },

  popAndClose() {
    if (this._closing) return;
    if (this.stack.length > 0) {
      const close = this.stack.pop();
      if (close) close();
    }
  },

  clear() {
    this.stack = [];
  },

  setupListeners() {
    if (history.state && history.state.overlay) {
      history.replaceState(null, '');
    }

    window.addEventListener('popstate', function () {
      Logit.Overlays.popAndClose();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        Logit.Overlays.closeTop();
      }
    });
  }
};
