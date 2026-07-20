window.Logit = window.Logit || {};

Logit.Utils = {
  /** @param {string} id @returns {HTMLElement|null} */
  byId(id) {
    return document.getElementById(id);
  },

  /** @param {string} s @returns {string} */
  esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  /** @param {string} path @param {string} [size] @returns {string} */
  img(path, size) {
    if (!path) return '';
    return 'https://image.tmdb.org/t/p/' + (size || 'w500') + path;
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
    return items.map(function(m) { return '<span class="metaMovie">' + Logit.Utils.esc(m) + '</span>'; }).join('');
  },

  /** @param {string[]} names @returns {string} */
  renderMovieChips(names) {
    return names.map(function(n) { return '<span class="movieChip">' + Logit.Utils.esc(n) + '</span>'; }).join('');
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
    card.addEventListener('click', function() { card.classList.toggle('active'); });
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.classList.toggle('active'); }
    });

    var top = document.createElement('div');
    top.className = 'personTop';

    var imgEl = document.createElement('img');
    imgEl.src = imgUrl;
    imgEl.alt = name;
    imgEl.onerror = function() { this.onerror = null; this.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" fill="%23111"><rect width="80" height="80"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-size="12">?</text></svg>'); };

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
    item.addEventListener('click', function() { item.classList.toggle('active'); });
    item.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.classList.toggle('active'); }
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
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, ms);
    };
  }
};
