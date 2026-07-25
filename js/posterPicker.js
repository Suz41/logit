window.Logit = window.Logit || {};

Logit.PosterPicker = {
  /** @param {Object} movie @param {string} apiKey @param {Function} onSelect */
  async open(movie, apiKey, onSelect) {
    var old = document.querySelector('.posterPicker');
    if (old) old.remove();

    var picker = document.createElement('div');
    picker.className = 'posterPicker';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', 'Choose poster');
    picker.innerHTML = '<div class="posterBg" aria-hidden="true"></div>'
      + '<div class="posterSheet">'
      + '<button class="posterCloseBtn" aria-label="Close modal">&times;</button>'
      + '<div class="posterSheetHandle"></div>'
      + '<div class="posterGrid" style="text-align:center;padding:20px;color:var(--muted);">Loading posters...</div>'
      + '</div>';

    document.body.append(picker);
    requestAnimationFrame(function() { picker.classList.add('active'); });
    Logit.Overlays.push(function() { picker.remove(); });

    picker.querySelector('.posterCloseBtn').onclick = function() { Logit.Overlays.closeTop(); };

    var tmdbId = movie.tmdb_id;
    var posters = [];
    if (tmdbId) {
      var d = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + tmdbId + '/images?api_key=' + apiKey);
      if (d && d.posters) {
        posters = d.posters.map(function(p) { return { u: p.file_path, l: p.iso_639_1 || 'N/A' }; });
      }
    }

    if (!picker.isConnected) return;

    var grid = picker.querySelector('.posterGrid');
    if (posters.length === 0) {
      grid.textContent = 'No alternative posters found.';
      return;
    }

    var fragment = document.createDocumentFragment();
    posters.forEach(function(p, i) {
      var card = document.createElement('div');
      card.className = 'posterItem' + (movie.sp === p.u ? ' active' : '');
      card.dataset.i = i;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Select poster in ' + p.l);

      var imgEl = document.createElement('img');
      imgEl.src = Logit.Utils.esc(Logit.Utils.img(p.u, 'w780'));
      imgEl.loading = 'lazy';
      imgEl.onerror = function() { this.onerror = null; this.src = Logit.POSTER_FALLBACK; };

      var langEl = document.createElement('div');
      langEl.className = 'posterLang';
      langEl.textContent = p.l;

      card.append(imgEl, langEl);

      function select() {
        onSelect(posters[Number(card.dataset.i)].u);
        Logit.Overlays.closeTop();
      }
      card.addEventListener('click', select);
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
      });

      fragment.append(card);
    });

    grid.textContent = '';
    grid.append(fragment);

    picker.querySelector('.posterBg').onclick = function() { Logit.Overlays.closeTop(); };
  }
};
