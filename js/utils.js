window.Logit = window.Logit || {};

Logit.Utils = {
  /** @param {string} id @returns {HTMLElement|null} */
  byId(id) {
    return document.getElementById(id);
  },

  /** @param {string} s @returns {string} */
  esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _directTmdbBlocked: false,

  /**
   * Transforms an image URL into a proxied URL
   * @param {string} url
   * @returns {string}
   */
  toProxyUrl(url) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;

    const mode =
      typeof Logit.Config !== 'undefined' && Logit.Config.getProxyMode
        ? Logit.Config.getProxyMode()
        : 'auto';
    const custom =
      typeof Logit.Config !== 'undefined' && Logit.Config.getCustomProxy
        ? Logit.Config.getCustomProxy()
        : '';

    if (mode === 'custom' && custom) {
      if (custom.includes('{url}')) {
        return custom.replace('{url}', encodeURIComponent(url));
      }
      return custom.replace(/\/+$/, '') + '/?url=' + encodeURIComponent(url);
    }

    const isLocalhost =
      typeof window !== 'undefined' &&
      window.location &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

    if (mode === 'local' || (isLocalhost && mode === 'auto')) {
      return '/api/proxy?url=' + encodeURIComponent(url);
    }

    // Default fast Cloudflare-backed proxy: wsrv.nl (supports HTTPS, CORS, caching, strips referer)
    return 'https://wsrv.nl/?url=' + encodeURIComponent(url);
  },

  /**
   * Generates poster/photo URLs with proxy and fallback intelligence
   * @param {string} path TMDB relative path or full URL
   * @param {string} [size] e.g. 'w185', 'w342', 'w500', 'w780', 'original'
   * @returns {string}
   */
  img(path, size) {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:')) return path;

    const targetSize = size || 'original';
    let fullUrl = '';

    if (/^https?:\/\//i.test(path)) {
      fullUrl = path;
    } else {
      const cleanPath = path.startsWith('/') ? path : '/' + path;
      fullUrl = 'https://image.tmdb.org/t/p/' + targetSize + cleanPath;
    }

    const mode =
      typeof Logit.Config !== 'undefined' && Logit.Config.getProxyMode
        ? Logit.Config.getProxyMode()
        : 'auto';

    if (
      mode === 'always' ||
      mode === 'custom' ||
      mode === 'local' ||
      this._directTmdbBlocked
    ) {
      return this.toProxyUrl(fullUrl);
    }

    return fullUrl;
  },

  /**
   * Resilient error handler for <img> elements displaying TMDB posters/photos.
   * Seamlessly falls back to Cloudflare/wsrv proxy or local proxy when direct TMDB is blocked.
   * @param {HTMLImageElement|Event} target
   */
  handleImgError(target) {
    const imgEl = target && target.target ? target.target : target;
    if (!imgEl || !(imgEl instanceof HTMLElement)) return;

    const currentSrc = imgEl.src || '';
    if (currentSrc.startsWith('data:image/svg')) return;

    const originalSrc =
      (imgEl.getAttribute && imgEl.getAttribute('data-original-src')) ||
      currentSrc;
    const attempt = parseInt(
      (imgEl.getAttribute && imgEl.getAttribute('data-proxy-attempt')) || '0',
      10
    );

    // If an image failed on direct image.tmdb.org, remember for future images in this session
    if (currentSrc.indexOf('image.tmdb.org') !== -1) {
      Logit.Utils._directTmdbBlocked = true;
    }

    if (attempt === 0) {
      if (imgEl.setAttribute) {
        imgEl.setAttribute('data-original-src', originalSrc);
        imgEl.setAttribute('data-proxy-attempt', '1');
      }
      const proxyUrl = Logit.Utils.toProxyUrl(originalSrc);
      if (proxyUrl && proxyUrl !== currentSrc) {
        imgEl.src = proxyUrl;
        return;
      }
    } else if (attempt === 1) {
      if (imgEl.setAttribute) {
        imgEl.setAttribute('data-proxy-attempt', '2');
      }
      // Secondary fallback proxy (images.weserv.nl)
      const secondaryUrl =
        'https://images.weserv.nl/?url=' + encodeURIComponent(originalSrc);
      if (secondaryUrl !== currentSrc) {
        imgEl.src = secondaryUrl;
        return;
      }
    }

    // All fallbacks exhausted, show standard SVG fallback
    imgEl.onerror = null;
    imgEl.src = Logit.POSTER_FALLBACK;
  },

  /** @param {Date} date @returns {{ day: number, month: string }} */
  formatDateShort(date) {
    return {
      day: date.getDate(),
      month: date.toLocaleString('default', { month: 'short' })
    };
  },

  /** @param {{ w: string }} movie @returns {boolean} */
  isRewatch(movie) {
    return /^Rewatch/i.test(movie.w || '');
  },

  /** @param {string[]} items @returns {string} */
  renderMetaMovies(items) {
    return items
      .map(function (m) {
        return '<span class="metaMovie">' + Logit.Utils.esc(m) + '</span>';
      })
      .join('');
  },

  /** @param {string[]} names @returns {string} */
  renderMovieChips(names) {
    return names
      .map(function (n) {
        return '<span class="movieChip">' + Logit.Utils.esc(n) + '</span>';
      })
      .join('');
  },

  /**
   * @param {string} name
   * @param {string} imgUrl
   * @param {number} count
   * @param {string} moviesHtml
   * @returns {HTMLElement}
   */
  createPersonCard(name, imgUrl, count, moviesHtml) {
    var card = document.createElement('div');
    card.className = 'person';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', name + ', ' + count + ' films');
    card.addEventListener('click', function () {
      card.classList.toggle('active');
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('active');
      }
    });

    var top = document.createElement('div');
    top.className = 'personTop';

    var imgEl = document.createElement('img');
    imgEl.src = imgUrl;
    imgEl.alt = name;
    imgEl.onerror = function () {
      Logit.Utils.handleImgError(this);
    };

    var info = document.createElement('div');
    info.className = 'personInfo';
    var nameEl = document.createElement('div');
    nameEl.className = 'personName';
    nameEl.textContent = name;
    var countEl = document.createElement('div');
    countEl.className = 'personCount';
    countEl.textContent = count + ' films';
    info.append(nameEl, countEl);

    top.append(imgEl, info);

    var moviesDiv = document.createElement('div');
    moviesDiv.className = 'personMovies';
    moviesDiv.innerHTML = moviesHtml;

    card.append(top, moviesDiv);
    return card;
  },

  /**
   * @param {string} name
   * @param {string|number} count
   * @param {string} moviesHtml
   * @returns {HTMLElement}
   */
  createMetaItem(name, count, moviesHtml) {
    var item = document.createElement('div');
    item.className = 'metaItem';
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', name + ', ' + count);
    item.addEventListener('click', function () {
      item.classList.toggle('active');
    });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.classList.toggle('active');
      }
    });

    var row = document.createElement('div');
    row.className = 'metaRow';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'metaName';
    nameSpan.textContent = name;
    var countSpan = document.createElement('span');
    countSpan.className = 'metaCount';
    countSpan.textContent = count;
    row.append(nameSpan, countSpan);

    var moviesDiv = document.createElement('div');
    moviesDiv.className = 'metaMovies';
    moviesDiv.innerHTML = moviesHtml;

    item.append(row, moviesDiv);
    return item;
  },

  /** @param {HTMLElement} el */
  openModal(el) {
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  },

  /** @param {HTMLElement} el */
  closeModal(el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  },

  /**
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, ms);
    };
  },

  /** @param {string} targetPage @returns {string} */
  getPageUrl(targetPage) {
    return targetPage
      .replace(/^pages\//, '')
      .replace(/^\.\.\/pages\//, '')
      .replace(/^\.\.\//, '');
  },

  /** @param {string} targetPage */
  navTo(targetPage) {
    window.location.href = this.getPageUrl(targetPage);
  }
};
