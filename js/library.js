window.Logit = window.Logit || {};

Logit.LibraryPage = {
  init() {
    const API = Logit.Config.getApiKey();
    const esc = Logit.Utils.esc;
    const img = Logit.Utils.img;
    const $ = Logit.Utils.byId;

    if (!API) {
      document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:20px;background:#0d0d0d;color:#fff;font-family:Inter,sans-serif;text-align:center;">'
        + '<h2 style="font-family:Poppins,sans-serif;margin-bottom:10px;">Welcome to Log!t</h2>'
        + '<p style="color:#888;font-size:13px;margin-bottom:20px;">Enter your TMDB API key to get started.<br><a href="https://www.themoviedb.org/settings/api" target="_blank" style="color:#e94560;">Get one free at themoviedb.org</a></p>'
        + '<input id="keyInput" type="text" placeholder="TMDB API Key" style="width:100%;max-width:320px;height:46px;background:#1a1a1a;border:none;border-radius:12px;padding:0 14px;color:#fff;font-size:14px;outline:none;margin-bottom:10px;">'
        + '<button id="keySave" style="width:100%;max-width:320px;height:44px;border:none;border-radius:12px;background:#fff;color:#000;font-size:14px;font-weight:700;cursor:pointer;">Save Key</button>'
        + '</div>';

      $('keySave').onclick = function() {
        const v = $('keyInput').value.trim();
        Logit.Config.setApiKey(v);
        location.reload();
      };
      return;
    }

    const state = {
      movies: [],
      current: null,
      openMonths: new Set()
    };

    const library = $('library');
    const modal = $('modal');
    const results = $('results');
    const metaModal = $('metaModal');
    const queryInput = $('query');
    const yearInput = $('year');
    const watchDate = $('watchDate');

    watchDate.valueAsDate = new Date();
    Logit.Overlays.setupListeners();

    function buildMovieCard(movie, withDataId) {
      const date = new Date(movie.d);
      const formatted = Logit.Utils.formatDateShort(date);
      const rewatchBadge = Logit.Utils.isRewatch(movie) ? ' <span class="rewatch">R</span>' : '';
      const dataIdAttr = withDataId ? ' data-id="' + esc(movie.id) + '"' : '';
      return '<div class="movie"' + dataIdAttr + '>'
        + '<img src="' + esc(img(movie.sp)) + '" loading="lazy" decoding="async">'
        + '<div class="movieDate"><span class="day">' + formatted.day + '</span> ' + formatted.month + rewatchBadge + '</div>'
        + '</div>';
    }

    function renderMovies() {
      library.innerHTML = '';

      if (state.movies.length === 0) {
        library.innerHTML = '<div class="empty"><div class="emptyIcon"><svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 2v20M16 2v20M2 8h20M2 16h20"/></svg></div><div class="emptyTitle">No movies yet</div><div class="emptyHint">Tap + to log your first film</div></div>';
        return;
      }

      const sorted = state.movies.slice().sort(function(a, b) {
        return new Date(b.d) - new Date(a.d);
      });

      const grouped = {};
      sorted.forEach(function(movie) {
        const date = new Date(movie.d);
        const monthKey = date.getFullYear() + '-' + date.getMonth();
        if (!grouped[monthKey]) {
          grouped[monthKey] = {
            label: date.toLocaleString('default', { month: 'long' }),
            movies: []
          };
        }
        grouped[monthKey].movies.push(movie);
      });

      const keys = Object.keys(grouped).sort(function(a, b) {
        return new Date(b) - new Date(a);
      });

      const fragment = document.createDocumentFragment();

      keys.forEach(function(key) {
        const group = grouped[key];
        const section = document.createElement('div');
        const isOpen = state.openMonths.has(key);
        section.className = 'monthSection' + (isOpen ? ' active' : '');

        const moviesHtml = group.movies.map(function(movie) {
          return buildMovieCard(movie, true);
        }).join('');

        section.innerHTML = '<div class="monthHead">'
          + '<div class="monthLeft"><div class="monthArrow">&rsaquo;</div>'
          + '<h2>' + esc(group.label) + '</h2></div>'
          + '<span class="count">' + group.movies.length + '</span></div>'
          + '<div class="monthMovies"><div class="moviesGridWrap"><div class="moviesGrid">' + moviesHtml + '</div></div></div>';

        section.querySelectorAll('.movie').forEach(function(card) {
          card.onclick = function() {
            const movie = state.movies.find(function(m) { return m.id === card.dataset.id; });
            if (movie) {
              state.current = movie;
              Logit.Modals.openMeta(movie);
            }
          };
        });

        section.querySelector('.monthHead').onclick = function(e) {
          if (e.target.closest('.movie')) return;
          const isActive = section.classList.toggle('active');
          if (isActive) {
            state.openMonths.add(key);
          } else {
            state.openMonths.delete(key);
          }
        };

        fragment.append(section);
      });

      library.append(fragment);
    }

    // Load movies — pull from cloud first if logged in
    async function loadAndRender() {
      if (!Logit.Auth.isOfflineMode()) {
        try { await Logit.Sync.pullFromCloud(); } catch (e) { console.error('Cloud pull failed:', e); }
      }
      state.movies = Logit.Storage.loadMovies();
      renderMovies();
    }
    loadAndRender();

    // ========= SETTINGS PANEL =========
    const settingsBtn = $('settingsBtn');
    const settingsPanel = $('settingsPanel');

    settingsBtn.onclick = function(e) {
      e.stopPropagation();
      const isOpen = settingsPanel.classList.toggle('open');
      settingsBtn.classList.toggle('active', isOpen);
    };

    document.addEventListener('click', function(e) {
      if (!e.target.closest('.header')) {
        settingsPanel.classList.remove('open');
        settingsBtn.classList.remove('active');
      }
    });

    // ========= GRID COLS =========
    const isPC = window.innerWidth >= 1024;
    const gridMin = isPC ? 10 : 4;
    const gridMax = isPC ? 16 : 10;
    const gridDefault = isPC ? 10 : 4;
    let gridCount = Number(localStorage.getItem('grid')) || gridDefault;
    gridCount = Math.max(gridMin, Math.min(gridMax, gridCount));

    const gridSlider = $('gridSlider');
    const sidebarGridSlider = $('sidebarGridSlider');
    const gridValue = $('gridValue');
    const sidebarGridValue = $('sidebarGridValue');

    if (gridSlider) {
      gridSlider.min = gridMin;
      gridSlider.max = gridMax;
      gridSlider.value = gridCount;
    }

    function setGridValue(val) {
      gridCount = Math.round(Number(val));
      if (gridSlider) gridSlider.value = gridCount;
      if (sidebarGridSlider) sidebarGridSlider.value = gridCount;
      if (gridValue) gridValue.textContent = gridCount;
      if (sidebarGridValue) sidebarGridValue.textContent = gridCount;
      localStorage.setItem('grid', gridCount);
      document.documentElement.style.setProperty('--grid', gridCount);
    }

    if (gridSlider) {
      gridSlider.oninput = function() { setGridValue(this.value); };
    }
    if (sidebarGridSlider) {
      sidebarGridSlider.oninput = function() { setGridValue(this.value); };
    }
    setGridValue(gridCount);

    // ========= DATE TOGGLE =========
    let showDates = localStorage.getItem('dates') !== '0';
    const dateToggle = $('dateToggle');
    const sidebarDateToggle = $('sidebarDateToggle');

    function updateDateBtn() {
      document.body.classList.toggle('hide-dates', !showDates);
      if (dateToggle) dateToggle.classList.toggle('on', showDates);
      if (sidebarDateToggle) sidebarDateToggle.classList.toggle('on', showDates);
    }

    function toggleDates() {
      showDates = !showDates;
      localStorage.setItem('dates', showDates ? '1' : '0');
      updateDateBtn();
    }

    if (dateToggle) dateToggle.onclick = toggleDates;
    if (sidebarDateToggle) sidebarDateToggle.onclick = toggleDates;
    updateDateBtn();

    // ========= SEARCH =========
    const libSearchInput = $('libSearch');
    const pcLibSearchInput = $('pcLibSearch');
    const clearSearchBtn = $('clearSearch');
    const pcClearSearchBtn = $('pcClearSearch');

    function handleSearchInput(val) {
      if (libSearchInput) libSearchInput.value = val;
      if (pcLibSearchInput) pcLibSearchInput.value = val;

      if (clearSearchBtn) clearSearchBtn.classList.toggle('visible', val.length > 0);
      if (pcClearSearchBtn) pcClearSearchBtn.classList.toggle('visible', val.length > 0);

      filterLibrary();
    }

    const debouncedFilter = Logit.Utils.debounce(handleSearchInput, 150);

    function handleSearchClear() {
      if (libSearchInput) libSearchInput.value = '';
      if (pcLibSearchInput) pcLibSearchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.remove('visible');
      if (pcClearSearchBtn) pcClearSearchBtn.classList.remove('visible');
      renderMovies();
    }

    if (libSearchInput) {
      libSearchInput.addEventListener('input', function() { debouncedFilter(this.value); });
    }
    if (pcLibSearchInput) {
      pcLibSearchInput.addEventListener('input', function() { debouncedFilter(this.value); });
    }
    if (clearSearchBtn) clearSearchBtn.onclick = handleSearchClear;
    if (pcClearSearchBtn) pcClearSearchBtn.onclick = handleSearchClear;

    function filterLibrary() {
      const q = (pcLibSearchInput && pcLibSearchInput.offsetParent !== null ? pcLibSearchInput.value : libSearchInput.value).trim().toLowerCase();
      const matches = Logit.Search.filterLibrary(state.movies, q);

      if (matches === null) {
        renderMovies();
        return;
      }

      library.innerHTML = '';

      if (matches.length === 0) {
        library.innerHTML = '<div class="noResults">No movies found</div>';
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'searchResults';

      const fragment = document.createDocumentFragment();

      matches.forEach(function(movie) {
        const card = document.createElement('div');
        card.className = 'movie';
        card.innerHTML = buildMovieCard(movie, false);
        card.onclick = function() {
          state.current = movie;
          Logit.Modals.openMeta(movie);
        };
        fragment.append(card);
      });

      grid.append(fragment);
      library.append(grid);
    }

    // ========= ADD MODAL TRIGGER =========
    $('navAdd').onclick = function() {
      Logit.Modals.openAdd(modal, queryInput);
    };

    const pcAddBtn = $('pcAddMovieBtn');
    if (pcAddBtn) {
      pcAddBtn.onclick = function() {
        Logit.Modals.openAdd(modal, queryInput);
      };
    }

    if (new URLSearchParams(window.location.search).get('add') === 'true') {
      Logit.Modals.openAdd(modal, queryInput);
      history.replaceState(null, '', window.location.pathname);
    }

    $('closeBtn').onclick = function() {
      Logit.Overlays.closeTop();
    };

    metaModal.onclick = function(e) {
      if (e.target === metaModal) Logit.Overlays.closeTop();
    };

    modal.onclick = function(e) {
      if (e.target === modal) Logit.Overlays.closeTop();
    };

    // ========= ADD SEARCH TMDB =========
    const clearQuery = $('clearQuery');

    const debouncedSearch = Logit.Utils.debounce(function() {
      searchMovies();
    }, 180);

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
      const q = queryInput.value.trim();
      if (q.length < 2) {
        results.innerHTML = '';
        return;
      }

      Logit.UI.showLoading(results);

      const imdbMatch = q.match(/(tt\d{7,})/i);
      if (imdbMatch) {
        const findData = await Logit.Search.tmdb('https://api.themoviedb.org/3/find/' + imdbMatch[1] + '?api_key=' + API + '&external_source=imdb_id');
        if (findData && findData.movie_results && findData.movie_results.length > 0) {
          const movie = findData.movie_results[0];
          Logit.Modals.openRating(movie, API, addMovieToDB);
          results.innerHTML = '';
          return;
        } else {
          Logit.UI.showError(results, 'No movie found for that IMDB ID.', esc);
          return;
        }
      }

      let url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(q);
      if (yearInput.value) url += '&year=' + yearInput.value;

      const data = await Logit.Search.tmdb(url);

      if (!data) {
        Logit.UI.showError(results, 'Could not reach TMDB. Check your connection.', esc);
        return;
      }

      const items = (data.results || []).filter(function(m) { return m.poster_path; }).slice(0, 20);

      if (items.length === 0) {
        results.innerHTML = '<div class="errorMsg" style="grid-column:1/-1;color:#777;">No results found</div>';
        return;
      }

      results.innerHTML = '';
      const fragment = document.createDocumentFragment();

      items.forEach(function(movie) {
        const card = document.createElement('div');
        card.className = 'result';

        const image = document.createElement('img');
        image.src = esc(img(movie.poster_path, 'w342'));
        image.loading = 'lazy';
        card.append(image);

        card.onclick = function() {
          Logit.Modals.openRating(movie, API, addMovieToDB);
        };
        fragment.append(card);
      });

      results.append(fragment);
    }

    async function addMovieToDB(d, rating, isRewatch) {
      let watch;
      if (isRewatch) {
        const prevCount = state.movies.filter(function(m) { return m.t === (d.title || ''); }).length;
        watch = 'Rewatch · ' + (prevCount + 1) + 'x';
      } else {
        watch = Logit.Movies.watchType(state.movies, d.title || '');
      }

      state.movies.unshift(Logit.MovieFactory.fromTMDB(d, rating, watch, watchDate.value));

      Logit.Storage.saveMovies(state.movies);
      renderMovies();

      const ratingSheet = document.querySelector('.ratingSheet');
      if (ratingSheet) ratingSheet.remove();

      Logit.Modals.closeAdd(modal, queryInput);
      Logit.Overlays.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // ========= EDIT & META ACTIONS =========
    function buildRatingEdit(currentRating) {
      const container = $('eRating');
      container.innerHTML = '';
      [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].forEach(function(v) {
        const btn = document.createElement('button');
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
      const m = state.current;
      const activeRating = $('eRating').querySelector('button.active');
      if (activeRating) m.r = activeRating.textContent;
      m.dr = $('eDirector').value;
      m.lg = $('eLang').value;
      m.ct = $('eCountry').value;
      if ($('eWatch').checked) {
        const prevCount = state.movies.filter(function(x) { return x.t === m.t && x.id !== m.id; }).length;
        m.w = 'Rewatch · ' + (prevCount + 1) + 'x';
      } else {
        m.w = '1st Watch';
      }
      m.d = $('eLogged').value;
      m.c = $('eCast').value;

      Logit.Storage.saveMovies(state.movies);
      renderMovies();
      Logit.Modals.openMeta(m);
    };

    $('deleteBtn').onclick = function() {
      if (!confirm('Delete "' + state.current.t + '" ?')) return;
      const delId = state.current.id;
      state.movies = state.movies.filter(function(m) { return m.id !== delId; });
      localStorage.setItem('movies', JSON.stringify(state.movies));
      Logit.Sync.deleteFromCloud(delId).catch(function(e) { console.error('Cloud delete:', e); });
      state.current = null;
      Logit.Overlays.closeTop();
      renderMovies();
    };

    $('changePoster').onclick = function() {
      Logit.PosterPicker.open(state.current, API, function(newPoster) {
        state.current.sp = newPoster;
        Logit.Storage.saveMovies(state.movies);
        renderMovies();
        $('mPoster').src = esc(img(newPoster));
      });
    };

    // ========= SCROLL HUD NAV =========
    Logit.UI.setupAutoHideNav(document.querySelector('.bottomNav'));
    $('navLibrary').onclick = function() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    $('navStats').onclick = function() {
      window.location.href = 'PS.html';
    };

    // Sidebar collapses
    const sidebarToggle = $('sidebarToggle');
    if (sidebarToggle) {
      let isCollapsed = localStorage.getItem('sidebarCollapsed') === '1';
      if (isCollapsed) {
        document.body.classList.add('collapsed');
      }
      sidebarToggle.onclick = function() {
        const collapsed = document.body.classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
      };
    }
  }
};
