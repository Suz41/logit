window.Logit = window.Logit || {};

Logit.Utils = {
  /** @param {string} id @returns {HTMLElement|null} */
  byId(id) {
    return document.getElementById(id);
  },

  /** @param {string} s @returns {string} */
  esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
    return /^Rewatch/i.test(movie.w);
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
   * @returns {string}
   */
  renderPersonCard(name, imgUrl, count, moviesHtml) {
    return '<div class="person" onclick="this.classList.toggle(\'active\')">'
      + '<div class="personTop">'
      + '<img src="' + Logit.Utils.esc(imgUrl) + '">'
      + '<div class="personInfo">'
      + '<div class="personName">' + Logit.Utils.esc(name) + '</div>'
      + '<div class="personCount">' + count + ' films</div>'
      + '</div>'
      + '</div>'
      + '<div class="personMovies">' + moviesHtml + '</div>'
      + '</div>';
  },

  /**
   * @param {string} name
   * @param {string|number} count
   * @param {string} moviesHtml
   * @returns {string}
   */
  renderMetaItem(name, count, moviesHtml) {
    return '<div class="metaItem" onclick="this.classList.toggle(\'active\')">'
      + '<div class="metaRow"><span class="metaName">' + Logit.Utils.esc(name) + '</span><span class="metaCount">' + count + '</span></div>'
      + '<div class="metaMovies">' + moviesHtml + '</div>'
      + '</div>';
  },

  /** @param {HTMLElement} el */
  openModal(el) {
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
  },

  /** @param {HTMLElement} el */
  closeModal(el) {
    el.classList.remove('active');
    document.body.style.overflow = '';
  },

  /**
   * @param {Function} fn
   * @param {number} ms
   * @returns {Function}
   */
  debounce(fn, ms) {
    let timer;
    return function() {
      const context = this;
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(context, args);
      }, ms);
    };
  }
};
