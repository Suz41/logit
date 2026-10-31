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
    picker.innerHTML =
      '<div class="posterBg" aria-hidden="true"></div>' +
      '<div class="posterSheet">' +
      '<button class="posterCloseBtn" aria-label="Close modal">&times;</button>' +
      '<div class="posterSheetHandle"></div>' +
      '<div class="posterGrid" style="text-align:center;padding:24px 16px;color:var(--muted);">Loading posters...</div>' +
      '</div>';

    document.body.append(picker);
    requestAnimationFrame(function () {
      picker.classList.add('active');
    });
    Logit.Overlays.push(function () {
      picker.remove();
    });

    picker.querySelector('.posterCloseBtn').onclick = function () {
      Logit.Overlays.closeTop();
    };

    var tmdbId = movie ? movie.tmdb_id : null;
    var posters = [];
    var fetchError = null;

    if (tmdbId) {
      try {
        var d = await Logit.Search.tmdb(
          'https://api.themoviedb.org/3/movie/' +
            tmdbId +
            '/images?api_key=' +
            (apiKey || Logit.Config.getApiKey())
        );
        if (d && d.posters && d.posters.length > 0) {
          posters = d.posters.map(function (p) {
            return { u: p.file_path, l: p.iso_639_1 || 'N/A' };
          });
        }
      } catch (err) {
        console.warn('PosterPicker error:', err);
        fetchError = err;
      }
    }

    if (!picker.isConnected) return;

    var grid = picker.querySelector('.posterGrid');
    if (!tmdbId) {
      grid.innerHTML =
        '<div style="text-align:center;padding:24px 16px;color:var(--muted);">No TMDB ID linked to this movie.</div>';
      return;
    }

    if (posters.length === 0) {
      grid.innerHTML =
        '<div style="text-align:center;padding:24px 16px;color:var(--muted);">' +
        '<div style="font-weight:600;color:var(--text);margin-bottom:8px;">No Alternative Posters Found</div>' +
        '<div style="font-size:12px;line-height:1.5;color:var(--muted);max-width:320px;margin:0 auto;">' +
        'If TMDB is blocked by your ISP (Jio/Airtel), turn on <strong>Secure DNS (Cloudflare 1.1.1.1)</strong> in Brave settings (<code>brave://settings/security</code>) or launch <code>node scripts/serve.js</code>.' +
        '</div>' +
        '</div>';
      return;
    }

    var cleanCurrentPoster = movie.sp ? movie.sp.replace(/.*\/t\/p\/\w+/, '') : '';
    var fragment = document.createDocumentFragment();
    posters.forEach(function (p, i) {
      var card = document.createElement('div');
      card.className =
        'posterItem' + (cleanCurrentPoster === p.u ? ' active' : '');
      card.dataset.i = i;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'Select poster in ' + p.l);

      var imgEl = document.createElement('img');
      imgEl.src = Logit.Utils.esc(Logit.Utils.img(p.u, 'w780'));
      imgEl.loading = 'lazy';
      imgEl.onerror = function () {
        Logit.Utils.handleImgError(this);
      };

      var langEl = document.createElement('div');
      langEl.className = 'posterLang';
      langEl.textContent = p.l;

      card.append(imgEl, langEl);

      function select() {
        onSelect(posters[Number(card.dataset.i)].u);
        Logit.Overlays.closeTop();
      }
      card.addEventListener('click', select);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      });

      fragment.append(card);
    });

    grid.textContent = '';
    grid.append(fragment);

    picker.querySelector('.posterBg').onclick = function () {
      Logit.Overlays.closeTop();
    };
  }
};
