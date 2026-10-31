window.Logit = window.Logit || {};

Logit.Search = {
  cache: {},
  _queue: [],
  _processing: false,
  _lastRequest: 0,
  _MIN_INTERVAL: 300,

  /** @param {string} url @param {number} retries @returns {Promise<Object|null>} */
  async tmdb(url, retries = 2) {
    if (this.cache[url]) return this.cache[url];

    return new Promise((resolve) => {
      this._queue.push({ url, retries, resolve });
      this._processQueue();
    });
  },

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const { url, retries, resolve } = this._queue.shift();

      // Rate limit
      const now = Date.now();
      const wait = this._MIN_INTERVAL - (now - this._lastRequest);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this._lastRequest = Date.now();

      const result = await this._fetchWithRetry(url, retries);
      resolve(result);
    }

    this._processing = false;
  },

  async _fetchWithRetry(url, retries) {
    // Automatically rewrite blocked api.themoviedb.org to working api.tmdb.org
    if (url && typeof url === 'string') {
      url = url.replace(/api\.themoviedb\.org/g, 'api.tmdb.org');
    }

    const isLocalhost =
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    const mode =
      typeof Logit.Config !== 'undefined' && Logit.Config.getProxyMode
        ? Logit.Config.getProxyMode()
        : 'auto';

    for (let i = 0; i <= retries; i++) {
      try {
        let fetchUrl = url;
        // On localhost, if mode is local or if previous attempt failed, use the built-in server proxy
        if (isLocalhost && (mode === 'local' || i > 0)) {
          fetchUrl = '/api/proxy?url=' + encodeURIComponent(url);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const r = await fetch(fetchUrl, { signal: controller.signal });
        clearTimeout(timeout);

        // Handle 429 rate limit
        if (r.status === 429) {
          const retryAfter = r.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
          console.warn(`TMDB rate limited. Waiting ${waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        if (!r.ok) {
          // If direct returned 403 on localhost, retry via local proxy immediately
          if (r.status === 403 && isLocalhost && fetchUrl === url) {
            continue;
          }
          return null;
        }

        const data = await r.json();
        this.cache[url] = data;
        return data;
      } catch (e) {
        console.error('TMDB fetch attempt ' + (i + 1) + ' failed:', e);
        if (i < retries)
          await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return null;
  },

  /** @param {Array} moviesList @param {string} query @returns {Array|null} */
  filterLibrary(moviesList, query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return moviesList.filter(function (m) {
      return (m.t || '').toLowerCase().indexOf(q) !== -1;
    });
  }
};
