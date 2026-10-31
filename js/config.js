window.Logit = window.Logit || {};

Logit.Config = {
  /** @returns {string} */
  getApiKey() {
    return localStorage.getItem('tmdb_key') || '';
  },

  /** @param {string} key */
  setApiKey(key) {
    if (key === null) return;
    key = key.trim();
    if (key) {
      localStorage.setItem('tmdb_key', key);
    } else {
      localStorage.removeItem('tmdb_key');
    }
  },

  /**
   * Modes:
   * - 'auto': Direct TMDB first; automatically falls back to Cloudflare/wsrv proxy on error
   * - 'always': Always route posters through proxy (wsrv.nl / Cloudflare edge)
   * - 'local': Use built-in Node server proxy (/api/proxy)
   * - 'custom': Use custom FlareSolverr or custom proxy URL
   * - 'direct': Direct TMDB only (no proxy)
   * @returns {string}
   */
  getProxyMode() {
    return localStorage.getItem('tmdb_proxy_mode') || 'auto';
  },

  /** @param {string} mode */
  setProxyMode(mode) {
    if (mode) {
      localStorage.setItem('tmdb_proxy_mode', mode.trim());
    } else {
      localStorage.removeItem('tmdb_proxy_mode');
    }
  },

  /** @returns {string} */
  getCustomProxy() {
    return localStorage.getItem('tmdb_custom_proxy') || '';
  },

  /** @param {string} url */
  setCustomProxy(url) {
    if (url && url.trim()) {
      localStorage.setItem('tmdb_custom_proxy', url.trim());
    } else {
      localStorage.removeItem('tmdb_custom_proxy');
    }
  }
};
