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
    for (let i = 0; i <= retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        // Handle 429 rate limit
        if (r.status === 429) {
          const retryAfter = r.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
          console.warn(`TMDB rate limited. Waiting ${waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        if (!r.ok) return null;

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
