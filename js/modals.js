window.Logit = window.Logit || {};

Logit.Modals = {
  _posterFallback: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%231a1a1a"><rect width="200" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="sans-serif" font-size="14">No Poster</text></svg>'),

  _handleImgError(e) {
    e.target.onerror = null;
    e.target.src = Logit.Modals._posterFallback;
  },

  /** @param {Object} movie @param {string} apiKey @param {Function} onAdd */
  openRating(movie, apiKey, onAdd) {
    var old = document.querySelector('.ratingSheet');
    if (old) old.remove();

    var sheet = document.createElement('div');
    sheet.className = 'ratingSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Rate movie');

    var ratesHtml = '';
    [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].forEach(function(v) {
      ratesHtml += '<button aria-label="Rate ' + v + ' stars">' + v + '</button>';
    });

    sheet.innerHTML = '<div class="sheetBg" aria-hidden="true"></div>'
      + '<div class="sheet">'
      + '<img src="' + Logit.Utils.esc(Logit.Utils.img(movie.poster_path)) + '" onerror="this.onerror=null;this.src=\'' + Logit.Modals._posterFallback + '\'" alt="' + Logit.Utils.esc(movie.title) + ' poster">'
      + '<h3>' + Logit.Utils.esc(movie.title) + '</h3>'
      + '<div class="rates">' + ratesHtml + '</div>'
      + '<label class="sheetToggle">'
      + '<input type="checkbox" id="rewatchToggle">'
      + '<div class="toggle-track"></div>'
      + 'Rewatch</label>'
      + '<button class="sheetAdd" aria-label="Add movie to library">Add Movie</button>'
      + '</div>';

    document.body.append(sheet);

    var rating = null;
    var addBtn = sheet.querySelector('.sheetAdd');

    Logit.Overlays.push(function() { sheet.remove(); });

    sheet.querySelectorAll('.rates button').forEach(function(btn) {
      btn.onclick = function() {
        sheet.querySelectorAll('.rates button').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        rating = btn.textContent;
        addBtn.classList.add('enabled');
      };
    });

    sheet.querySelector('.sheetBg').onclick = function() { Logit.Overlays.closeTop(); };

    // Escape key closes
    sheet.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') Logit.Overlays.closeTop();
    });

    addBtn.onclick = async function() {
      if (!rating) return;

      addBtn.textContent = 'Adding...';
      addBtn.disabled = true;

      try {
        var d = await Logit.Search.tmdb(
          'https://api.themoviedb.org/3/movie/' + movie.id + '?api_key=' + apiKey + '&append_to_response=credits,images'
        );

        if (!d) {
          alert('Failed to fetch movie details from TMDB. Please check your connection.');
          addBtn.textContent = 'Add Movie';
          addBtn.disabled = false;
          return;
        }

        var isRewatch = sheet.querySelector('#rewatchToggle').checked;
        onAdd(d, rating, isRewatch);
      } catch (e) {
        console.error('Failed to add movie:', e);
        alert('Failed to add movie. Please try again.');
        addBtn.textContent = 'Add Movie';
        addBtn.disabled = false;
      }
    };

    // Focus trap
    addBtn.focus();
  },

  /** @param {Object} movie */
  openMeta(movie) {
    var $ = Logit.Utils.byId;
    var metaModal = $('metaModal');
    if (!metaModal) return;

    metaModal.classList.add('active');
    metaModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    document.querySelector('.meta').classList.remove('editing');
    Logit.Overlays.push(function() { Logit.Modals.closeMeta(); });

    var posterEl = $('mPoster');
    posterEl.src = Logit.Utils.esc(Logit.Utils.img(movie.sp));
    posterEl.onerror = Logit.Modals._handleImgError;
    $('mTitle').textContent = movie.t || 'Unknown Title';
    $('mRating').textContent = (movie.r || '0') + '/5';
    $('mYear').textContent = movie.yr || '';
    $('mRun').textContent = movie.rt ? movie.rt + 'm' : '';
    $('mGenre').textContent = movie.g || '';
    $('mDirector').textContent = movie.dr || '';
    $('mLang').textContent = movie.lg || '';
    $('mCountry').textContent = movie.ct || '';
    $('mWatch').textContent = movie.w || '';
    $('mLogged').textContent = movie.d || '';
    $('mCast').textContent = movie.c || '';

    $('eDirector').value = movie.dr || '';
    $('eLang').value = movie.lg || '';
    $('eCountry').value = movie.ct || '';
    $('eWatch').checked = /^Rewatch/i.test(movie.w || '');
    $('eLogged').value = movie.d || '';
    $('eCast').value = movie.c || '';
  },

  closeMeta() {
    var metaModal = document.getElementById('metaModal');
    if (metaModal) {
      metaModal.classList.remove('active');
      metaModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    }
  },

  /** @param {HTMLElement} modalElement @param {HTMLInputElement} queryInput */
  openAdd(modalElement, queryInput) {
    modalElement.classList.add('active');
    modalElement.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    queryInput.focus();
    Logit.Overlays.push(function() { Logit.Modals.closeAdd(modalElement, queryInput); });
  },

  /** @param {HTMLElement} modalElement @param {HTMLInputElement} queryInput */
  closeAdd(modalElement, queryInput) {
    modalElement.classList.remove('active');
    modalElement.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    queryInput.value = '';
    var yearInput = document.getElementById('year');
    if (yearInput) yearInput.value = '';
    var results = document.getElementById('results');
    if (results) results.innerHTML = '';
    var clearQuery = document.getElementById('clearQuery');
    if (clearQuery) clearQuery.classList.remove('visible');
    queryInput.blur();
  }
};
