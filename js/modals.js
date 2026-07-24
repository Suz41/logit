window.Logit = window.Logit || {};

Logit.Modals = {
  _handleImgError(e) {
    e.target.onerror = null;
    e.target.src = Logit.POSTER_FALLBACK;
  },

  _renderChips(el, text) {
    el.textContent = '';
    if (!text) return;
    text.split(',').forEach(function(name) {
      name = name.trim();
      if (!name) return;
      var chip = document.createElement('span');
      chip.className = 'nameChip';
      chip.textContent = name;
      el.appendChild(chip);
    });
  },

  openRating(movie, apiKey, onAdd) {
    var old = document.querySelector('.ratingSheet');
    if (old) old.remove();

    var sheet = document.createElement('div');
    sheet.className = 'ratingSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Rate movie');

    var ratesHtml = '';
    Logit.RATINGS.forEach(function(v) {
      ratesHtml += '<button aria-label="Rate ' + v + ' stars">' + v + '</button>';
    });

    sheet.innerHTML = '<div class="sheetBg" aria-hidden="true"></div>'
      + '<div class="sheet">'
      + '<img src="' + Logit.Utils.esc(Logit.Utils.img(movie.poster_path)) + '" onerror="this.onerror=null;this.src=\'' + Logit.POSTER_FALLBACK + '\'" alt="' + Logit.Utils.esc(movie.title) + ' poster">'
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
    sheet.addEventListener('keydown', function(e) { if (e.key === 'Escape') Logit.Overlays.closeTop(); });

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

    addBtn.focus();
  },

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
    this._renderChips($('mCast'), movie.c);
    this._renderChips($('mSupporting'), movie.sc);
    this._renderChips($('mProduction'), movie.pc);

    var prodWrap = document.querySelector('#mProduction').closest('.metaSection');
    if (prodWrap) prodWrap.style.display = movie.pc ? '' : 'none';

    var supWrap = $('supportingWrap');
    if (supWrap) supWrap.style.display = movie.sc ? '' : 'none';

    $('eDirector').value = movie.dr || '';
    $('eLang').value = movie.lg || '';
    $('eCountry').value = movie.ct || '';
    $('eRuntime').value = movie.rt || '';
    $('eWatch').checked = /^Rewatch/i.test(movie.w || '');
    $('eLogged').value = movie.d || '';
    $('eCast').value = movie.c || '';
    $('eSupporting').value = movie.sc || '';
  },

  closeMeta() {
    var metaModal = document.getElementById('metaModal');
    if (metaModal) {
      metaModal.classList.remove('active');
      metaModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('no-scroll');
    }
  },

  openAdd(modalElement, queryInput) {
    modalElement.classList.add('active');
    modalElement.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    queryInput.focus();
    Logit.Overlays.push(function() { Logit.Modals.closeAdd(modalElement, queryInput); });
  },

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
