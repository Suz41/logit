window.Logit = window.Logit || {};

Logit.LibraryPage = {
  init() {
    var API = Logit.Config.getApiKey();
    var esc = Logit.Utils.esc;
    var img = Logit.Utils.img;
    var $ = Logit.Utils.byId;

    if (!API) {
      document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;background:#0d0d0d;color:#fff;font-family:Inter,sans-serif;text-align:center;">'
        + '<h2 style="font-family:Poppins,sans-serif;margin-bottom:10px;">Welcome to Log!t</h2>'
        + '<p style="color:#888;font-size:13px;margin-bottom:20px;">Enter your TMDB API key to get started.<br><a href="https://www.themoviedb.org/settings/api" target="_blank" style="color:#e94560;">Get one free at themoviedb.org</a></p>'
        + '<input id="keyInput" type="text" placeholder="TMDB API Key" style="width:100%;max-width:320px;height:46px;background:#1a1a1a;border:none;border-radius:12px;padding:0 14px;color:#fff;font-size:14px;outline:none;margin-bottom:10px;">'
        + '<button id="keySave" style="width:100%;max-width:320px;height:44px;border:none;border-radius:12px;background:#fff;color:#000;font-size:14px;font-weight:700;cursor:pointer;">Save Key</button>'
        + '</div>';

      $('keySave').onclick = function() {
        var v = $('keyInput').value.trim();
        Logit.Config.setApiKey(v);
        location.reload();
      };
      return;
    }

    var state = {
      movies: [],
      current: null,
      openMonths: new Set(),
      _addDebounce: false
    };

    var library = $('library');
    var modal = $('modal');
    var results = $('results');
    var metaModal = $('metaModal');
    var queryInput = $('query');
    var yearInput = $('year');
    var watchDate = $('watchDate');

    watchDate.valueAsDate = new Date();
    Logit.Overlays.setupListeners();

    // === Image fallback handler ===
    function handleImgError(e) {
      var el = e.target;
      el.onerror = null;
      el.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%231a1a1a"><rect width="200" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="sans-serif" font-size="14">No Poster</text></svg>');
    }

    function buildMovieCard(movie, withDataId) {
      var date = new Date(movie.d);
      var formatted = Logit.Utils.formatDateShort(date);
      var rewatchBadge = Logit.Utils.isRewatch(movie) ? ' <span class="rewatch">R</span>' : '';
      var dataIdAttr = withDataId ? ' data-id="' + esc(movie.id) + '"' : '';
      var posterSrc = esc(img(movie.sp));
      return '<div class="movie"' + dataIdAttr + '>'
        + '<img src="' + posterSrc + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%231a1a1a"><rect width="200" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="sans-serif" font-size="14">No Poster</text></svg>') + '\'">'
        + '<div class="movieDate"><span class="day">' + formatted.day + '</span> ' + formatted.month + rewatchBadge + '</div>'
        + '</div>';
    }

    function renderMovies() {
      library.innerHTML = '';

      if (state.movies.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty';
        var emptyIcon = document.createElement('div');
        emptyIcon.className = 'emptyIcon';
        emptyIcon.innerHTML = '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 2v20M16 2v20M2 8h20M2 16h20"/></svg>';
        var emptyTitle = document.createElement('div');
        emptyTitle.className = 'emptyTitle';
        emptyTitle.textContent = 'No movies yet';
        var emptyHint = document.createElement('div');
        emptyHint.className = 'emptyHint';
        emptyHint.textContent = 'Tap + to log your first film';
        emptyDiv.append(emptyIcon, emptyTitle, emptyHint);
        library.append(emptyDiv);
        return;
      }

      var sorted = state.movies.slice().sort(function(a, b) {
        return new Date(b.d) - new Date(a.d);
      });

      var grouped = {};
      sorted.forEach(function(movie) {
        var date = new Date(movie.d);
        var monthKey = date.getFullYear() + '-' + date.getMonth();
        if (!grouped[monthKey]) {
          grouped[monthKey] = { label: date.toLocaleString('default', { month: 'long' }), movies: [] };
        }
        grouped[monthKey].movies.push(movie);
      });

      var keys = Object.keys(grouped).sort(function(a, b) {
        return new Date(b) - new Date(a);
      });

      if (state.openMonths.size === 0 && keys.length > 0) {
        state.openMonths.add(keys[0]);
      }

      var fragment = document.createDocumentFragment();

      keys.forEach(function(key) {
        var group = grouped[key];
        var section = document.createElement('div');
        var isOpen = state.openMonths.has(key);
        section.className = 'monthSection' + (isOpen ? ' active' : '');

        // Build month section header
        var head = document.createElement('div');
        head.className = 'monthHead';
        var left = document.createElement('div');
        left.className = 'monthLeft';
        var arrow = document.createElement('div');
        arrow.className = 'monthArrow';
        arrow.textContent = '\u203A';
        var h2 = document.createElement('h2');
        h2.textContent = group.label;
        left.append(arrow, h2);
        var count = document.createElement('span');
        count.className = 'count';
        count.textContent = group.movies.length;
        head.append(left, count);

        // Build movies grid
        var moviesWrap = document.createElement('div');
        moviesWrap.className = 'monthMovies';
        var moviesGridWrap = document.createElement('div');
        moviesGridWrap.className = 'moviesGridWrap';
        var moviesGrid = document.createElement('div');
        moviesGrid.className = 'moviesGrid';

        group.movies.forEach(function(movie) {
          var card = document.createElement('div');
          card.className = 'movie';
          card.dataset.id = movie.id;
          var dateFormatted = Logit.Utils.formatDateShort(new Date(movie.d));
          var rewatchBadge = Logit.Utils.isRewatch(movie) ? ' <span class="rewatch">R</span>' : '';
          card.innerHTML = '<img src="' + esc(img(movie.sp)) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%231a1a1a"><rect width="200" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="sans-serif" font-size="14">No Poster</text></svg>') + '\'">'
            + '<div class="movieDate"><span class="day">' + dateFormatted.day + '</span> ' + dateFormatted.month + rewatchBadge + '</div>';
          moviesGrid.append(card);
        });

        moviesGridWrap.append(moviesGrid);
        moviesWrap.append(moviesGridWrap);
        section.append(head, moviesWrap);

        // Event delegation for movie clicks
        moviesGrid.addEventListener('click', function(e) {
          var card = e.target.closest('.movie');
          if (!card) return;
          var movie = state.movies.find(function(m) { return m.id === card.dataset.id; });
          if (movie) {
            state.current = movie;
            Logit.Modals.openMeta(movie);
          }
        });

        head.addEventListener('click', function(e) {
          if (e.target.closest('.movie')) return;
          section.classList.toggle('active');
        });

        fragment.append(section);
      });

      library.append(fragment);
    }

    // Load movies
    async function loadAndRender() {
      if (!Logit.Auth.isOfflineMode()) {
        try { await Logit.Sync.sync(); } catch (e) { console.error('Sync failed:', e); }
      }
      state.movies = Logit.Storage.loadMovies();
      renderMovies();
    }
    loadAndRender();

    // ========= SETTINGS PANEL =========
    var settingsBtn = $('settingsBtn');
    var settingsPanel = $('settingsPanel');

    settingsBtn.onclick = function(e) {
      e.stopPropagation();
      var isOpen = settingsPanel.classList.toggle('open');
      settingsBtn.classList.toggle('active', isOpen);
    };

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.header')) {
        settingsPanel.classList.remove('open');
        settingsBtn.classList.remove('active');
      }
    });

    // ========= GRID COLS =========
    var isPC = window.innerWidth >= 1024;
    var gridMin = isPC ? 10 : 4;
    var gridMax = isPC ? 20 : 10;
    var gridDefault = isPC ? 10 : 4;
    var gridCount = parseInt(localStorage.getItem('logit_grid_count')) || gridDefault;

    var gridSlider = $('gridSlider');
    var sidebarGridSlider = $('sidebarGridSlider');
    var gridValue = $('gridValue');
    var sidebarGridValue = $('sidebarGridValue');

    if (gridSlider) { gridSlider.min = gridMin; gridSlider.max = gridMax; gridSlider.value = gridCount; }

    function setGridValue(val) {
      gridCount = Math.round(Number(val));
      if (gridSlider) gridSlider.value = gridCount;
      if (sidebarGridSlider) sidebarGridSlider.value = gridCount;
      if (gridValue) gridValue.textContent = gridCount;
      if (sidebarGridValue) sidebarGridValue.textContent = gridCount;
      document.documentElement.style.setProperty('--grid', gridCount);
      localStorage.setItem('logit_grid_count', gridCount);
    }

    if (gridSlider) gridSlider.oninput = function() { setGridValue(this.value); };
    if (sidebarGridSlider) sidebarGridSlider.oninput = function() { setGridValue(this.value); };
    setGridValue(gridCount);

    // ========= DATE TOGGLE =========
    var showDates = localStorage.getItem('logit_show_dates') !== 'false';
    var dateToggle = $('dateToggle');
    var sidebarDateToggle = $('sidebarDateToggle');

    function updateDateBtn() {
      document.body.classList.toggle('hide-dates', !showDates);
      if (dateToggle) dateToggle.classList.toggle('on', showDates);
      if (sidebarDateToggle) sidebarDateToggle.classList.toggle('on', showDates);
    }

    function toggleDates() {
      showDates = !showDates;
      localStorage.setItem('logit_show_dates', showDates);
      updateDateBtn();
    }

    if (dateToggle) dateToggle.onclick = toggleDates;
    if (sidebarDateToggle) sidebarDateToggle.onclick = toggleDates;
    updateDateBtn();

    // ========= SEARCH =========
    var libSearchInput = $('libSearch');
    var pcLibSearchInput = $('pcLibSearch');
    var clearSearchBtn = $('clearSearch');
    var pcClearSearchBtn = $('pcClearSearch');

    function handleSearchInput(val) {
      if (libSearchInput) libSearchInput.value = val;
      if (pcLibSearchInput) pcLibSearchInput.value = val;
      if (clearSearchBtn) clearSearchBtn.classList.toggle('visible', val.length > 0);
      if (pcClearSearchBtn) pcClearSearchBtn.classList.toggle('visible', val.length > 0);
      filterLibrary();
    }

    var debouncedFilter = Logit.Utils.debounce(handleSearchInput, 150);

    function handleSearchClear() {
      if (libSearchInput) libSearchInput.value = '';
      if (pcLibSearchInput) pcLibSearchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
      if (pcClearSearchBtn) pcClearSearchBtn.classList.remove('visible');
      renderMovies();
    }

    if (libSearchInput) libSearchInput.addEventListener('input', function() { debouncedFilter(this.value); });
    if (pcLibSearchInput) pcLibSearchInput.addEventListener('input', function() { debouncedFilter(this.value); });
    if (clearSearchBtn) clearSearchBtn.onclick = handleSearchClear;
    if (pcClearSearchBtn) pcClearSearchBtn.onclick = handleSearchClear;

    function filterLibrary() {
      var q = (pcLibSearchInput && pcLibSearchInput.offsetParent !== null ? pcLibSearchInput.value : libSearchInput.value).trim().toLowerCase();
      var matches = Logit.Search.filterLibrary(state.movies, q);

      if (matches === null) { renderMovies(); return; }

      library.innerHTML = '';

      if (matches.length === 0) {
        var noResults = document.createElement('div');
        noResults.className = 'noResults';
        noResults.textContent = 'No movies found';
        library.append(noResults);
        return;
      }

      var grid = document.createElement('div');
      grid.className = 'searchResults';

      matches.forEach(function(movie) {
        var card = document.createElement('div');
        card.className = 'movie';
        card.dataset.id = movie.id;
        var dateFormatted = Logit.Utils.formatDateShort(new Date(movie.d));
        var rewatchBadge = Logit.Utils.isRewatch(movie) ? ' <span class="rewatch">R</span>' : '';
        card.innerHTML = '<img src="' + esc(img(movie.sp)) + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" fill="%231a1a1a"><rect width="200" height="300"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23555" font-family="sans-serif" font-size="14">No Poster</text></svg>') + '\'">'
          + '<div class="movieDate"><span class="day">' + dateFormatted.day + '</span> ' + dateFormatted.month + rewatchBadge + '</div>';
        card.onclick = function() {
          state.current = movie;
          Logit.Modals.openMeta(movie);
        };
        grid.append(card);
      });

      library.append(grid);
    }

    // ========= ADD MODAL TRIGGER =========
    $('navAdd').onclick = function() { Logit.Modals.openAdd(modal, queryInput); };

    var pcAddBtn = $('pcAddMovieBtn');
    if (pcAddBtn) pcAddBtn.onclick = function() { Logit.Modals.openAdd(modal, queryInput); };

    if (new URLSearchParams(window.location.search).get('add') === 'true') {
      Logit.Modals.openAdd(modal, queryInput);
      history.replaceState(null, '', window.location.pathname);
    }

    $('closeBtn').onclick = function() { Logit.Overlays.closeTop(); };
    metaModal.onclick = function(e) { if (e.target === metaModal) Logit.Overlays.closeTop(); };
    modal.onclick = function(e) { if (e.target === modal) Logit.Overlays.closeTop(); };

    // ========= ADD SEARCH TMDB =========
    var clearQuery = $('clearQuery');

    var debouncedSearch = Logit.Utils.debounce(function() { searchMovies(); }, 180);

    queryInput.addEventListener('input', function() {
      clearQuery.classList.toggle('visible', queryInput.value.length > 0);
      debouncedSearch();
    });

    clearQuery.onclick = function() {
      queryInput.value = '';
      clearQuery.classList.remove('visible');
      results.innerHTML = '';
      queryInput.focus();
    };

    async function searchMovies() {
      var q = queryInput.value.trim();
      if (q.length < 2) { results.innerHTML = ''; return; }

      Logit.UI.showLoading(results);

      var imdbMatch = q.match(/(tt\d{7,})/i);
      if (imdbMatch) {
        var findData = await Logit.Search.tmdb('https://api.themoviedb.org/3/find/' + imdbMatch[1] + '?api_key=' + API + '&external_source=imdb_id');
        if (findData && findData.movie_results && findData.movie_results.length > 0) {
          Logit.Modals.openRating(findData.movie_results[0], API, addMovieToDB);
          results.innerHTML = '';
          return;
        } else {
          Logit.UI.showError(results, 'No movie found for that IMDB ID.', esc);
          return;
        }
      }

      var url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(q);
      if (yearInput.value) url += '&year=' + yearInput.value;

      var data = await Logit.Search.tmdb(url);

      if (!data) {
        Logit.UI.showError(results, 'Could not reach TMDB. Check your connection.', esc);
        return;
      }

      var items = (data.results || []).filter(function(m) { return m.poster_path; }).slice(0, 20);

      if (items.length === 0) {
        var errorMsg = document.createElement('div');
        errorMsg.className = 'errorMsg';
        errorMsg.style.gridColumn = '1/-1';
        errorMsg.style.color = '#777';
        errorMsg.textContent = 'No results found';
        results.append(errorMsg);
        return;
      }

      results.innerHTML = '';
      var fragment = document.createDocumentFragment();

      items.forEach(function(movie) {
        var card = document.createElement('div');
        card.className = 'result';
        var image = document.createElement('img');
        image.src = esc(img(movie.poster_path, 'w342'));
        image.loading = 'lazy';
        image.onerror = handleImgError;
        card.append(image);
        card.onclick = function() { Logit.Modals.openRating(movie, API, addMovieToDB); };
        fragment.append(card);
      });

      results.append(fragment);
    }

    async function addMovieToDB(d, rating, isRewatch) {
      if (state._addDebounce) return;
      state._addDebounce = true;
      setTimeout(function() { state._addDebounce = false; }, 2000);

      // Check for duplicates
      var movieId = 'movie_' + (d.id || Date.now());
      var existing = state.movies.find(function(m) { return m.tmdb_id === String(d.id); });
      if (existing && !isRewatch) {
        alert('This movie is already in your library.');
        state._addDebounce = false;
        return;
      }

      var watch;
      if (isRewatch) {
        var prevCount = state.movies.filter(function(m) { return m.t === (d.title || ''); }).length;
        watch = 'Rewatch \u00B7 ' + (prevCount + 1) + 'x';
      } else {
        watch = Logit.Movies.watchType(state.movies, d.title || '');
      }

      var movie = Logit.MovieFactory.fromTMDB(d, rating, watch, watchDate.value);
      state.movies.unshift(movie);
      Logit.Storage.saveMovies(state.movies);
      renderMovies();

      var ratingSheet = document.querySelector('.ratingSheet');
      if (ratingSheet) ratingSheet.remove();

      Logit.Modals.closeAdd(modal, queryInput);
      Logit.Overlays.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ========= EDIT & META ACTIONS =========
    function buildRatingEdit(currentRating) {
      var container = $('eRating');
      container.innerHTML = '';
      [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].forEach(function(v) {
        var btn = document.createElement('button');
        btn.textContent = v;
        if (String(v) === String(currentRating)) btn.classList.add('active');
        btn.onclick = function() {
          container.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
        };
        container.append(btn);
      });
    }

    $('editBtn').onclick = function() {
      document.querySelector('.meta').classList.add('editing');
      buildRatingEdit(state.current.r);
    };

    $('saveBtn').onclick = function() {
      var m = state.current;
      var activeRating = $('eRating').querySelector('button.active');
      if (activeRating) m.r = activeRating.textContent;
      m.dr = $('eDirector').value;
      m.lg = $('eLang').value;
      m.ct = $('eCountry').value;
      if ($('eWatch').checked) {
        var prevCount = state.movies.filter(function(x) { return x.t === m.t && x.id !== m.id; }).length;
        m.w = 'Rewatch \u00B7 ' + (prevCount + 1) + 'x';
      } else {
        m.w = '1st Watch';
      }
      m.d = $('eLogged').value;
      m.c = $('eCast').value;
      m.updated_at = new Date().toISOString();

      Logit.Storage.saveMovies(state.movies);
      Logit.Offline.enqueue('update', 'movie', m.id, m);
      renderMovies();
      Logit.Modals.openMeta(m);
    };

    $('deleteBtn').onclick = function() {
      if (!confirm('Delete "' + state.current.t + '" ?')) return;
      var delId = state.current.id;
      state.movies = state.movies.filter(function(m) { return m.id !== delId; });
      Logit.Storage.saveMovies(state.movies);
      Logit.Sync.deleteFromCloud(delId).catch(function(e) { console.error('Cloud delete:', e); });
      state.current = null;
      Logit.Overlays.closeTop();
      renderMovies();
    };

    $('changePoster').onclick = function() {
      Logit.PosterPicker.open(state.current, API, function(newPoster) {
        state.current.sp = newPoster;
        state.current.updated_at = new Date().toISOString();
        Logit.Storage.saveMovies(state.movies);
        Logit.Offline.enqueue('update', 'movie', state.current.id, state.current);
        renderMovies();
        $('mPoster').src = esc(img(newPoster));
      });
    };

    // ========= SCROLL HUD NAV =========
    Logit.UI.setupAutoHideNav(document.querySelector('.bottomNav'));
    $('navLibrary').onclick = function() { window.scrollTo({ top: 0, behavior: 'smooth' }); };
    $('navStats').onclick = function() { window.location.href = 'PS.html'; };

    var sidebarToggle = $('sidebarToggle');
    if (sidebarToggle) {
      sidebarToggle.onclick = function() { document.body.classList.toggle('collapsed'); };
    }
  }
};
