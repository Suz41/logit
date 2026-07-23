window.Logit = window.Logit || {};

Logit.StatsPage = {
  async init() {
    if (typeof Logit.Supabase !== 'undefined') {
      Logit.Supabase.init();
      try {
        var session = await Logit.Supabase.getSession();
        if (!session) { window.location.href = 'welcome.html'; return; }
      } catch (e) { window.location.href = 'welcome.html'; return; }
    }

    var API = Logit.Config.getApiKey();
    var $ = Logit.Utils.byId;

    var movies = await Logit.Storage.loadMovies();
    var stats = Logit.StatUtils.aggregate(movies);

    // ========= HERO BOX =========
    $('movieCount').innerText = movies.length;
    $('ratingAvg').innerText = movies.length ? (movies.reduce((a, b) => a + (Number(b.r) || 0), 0) / movies.length).toFixed(1) : "0.0";

    const totalRuntime = movies.reduce((a, b) => a + (Number(b.rt) || 0), 0);
    const timeData = Logit.StatUtils.formatTime(totalRuntime);
    var timeEl = $('timeCount');
    timeEl.textContent = '';
    var timeMain = document.createElement('div');
    timeMain.style.cssText = 'font-size:22px;font-weight:700;line-height:1;color:#fff;';
    timeMain.textContent = timeData.main;
    var timeSub = document.createElement('div');
    timeSub.className = 'timeSub';
    timeSub.textContent = timeData.sub;
    timeEl.append(timeMain, timeSub);

    // ========= PEOPLE =========
    const topDirectors = Object.entries(stats.directorCount)
      .sort((a, b) => b[1].movies.size - a[1].movies.size)
      .slice(0, 5);

    const topActors = Object.entries(stats.actorCount)
      .sort((a, b) => b[1].movies.size - a[1].movies.size)
      .slice(0, 5);

    async function fetchPersonImage(name) {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${API}&query=${encodeURIComponent(name)}`);
        const data = await res.json();
        const path = data.results?.[0]?.profile_path;
        return path ? `https://image.tmdb.org/t/p/w185${path}` : 'https://placehold.co/80x80/111/666?text=%20';
      } catch (e) {
        return 'https://placehold.co/80x80/111/666?text=%20';
      }
    }

    async function renderPeople() {
      var dList = $('directorList');
      var aList = $('actorList');

      var directorImagePromises = topDirectors.map(function(entry) {
        return entry[1].img ? Promise.resolve(entry[1].img) : fetchPersonImage(entry[0]);
      });
      var actorImagePromises = topActors.map(function(entry) {
        return entry[1].img ? Promise.resolve(entry[1].img) : fetchPersonImage(entry[0]);
      });

      var results = await Promise.all([
        Promise.all(directorImagePromises),
        Promise.all(actorImagePromises)
      ]);
      var directorImages = results[0];
      var actorImages = results[1];

      dList.textContent = '';
      topDirectors.forEach(function(entry, index) {
        var moviesHtml = Logit.Utils.renderMovieChips(Array.from(entry[1].movies));
        dList.append(Logit.Utils.createPersonCard(entry[0], directorImages[index], entry[1].movies.size, moviesHtml));
      });

      aList.textContent = '';
      topActors.forEach(function(entry, index) {
        var moviesHtml = Logit.Utils.renderMovieChips(Array.from(entry[1].movies));
        aList.append(Logit.Utils.createPersonCard(entry[0], actorImages[index], entry[1].movies.size, moviesHtml));
      });
    }

    renderPeople();

    // ========= META SECTIONS =========
    function renderMetaSection(wrapEl, totalEl, entries, moviesMap, labelFn) {
      totalEl.textContent = entries.length;
      wrapEl.textContent = '';
      if (entries.length === 0) {
        var emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty';
        emptyDiv.textContent = 'No data yet';
        wrapEl.append(emptyDiv);
        return;
      }
      entries.forEach(function(entry) {
        var name = labelFn(entry);
        var count = entry[1];
        var moviesHtml = Logit.Utils.renderMetaMovies(moviesMap[entry[0]] || []);
        wrapEl.append(Logit.Utils.createMetaItem(name, count, moviesHtml));
      });
    }

    // Genres
    const genreEntries = Object.entries(stats.genreCount).sort((a, b) => b[1] - a[1]);
    renderMetaSection($('genreWrap'), $('genreTotal'), genreEntries, stats.genreMovies, function(e) { return e[0]; });

    // Languages
    const langEntries = Object.entries(stats.langCount).sort((a, b) => b[1] - a[1]);
    renderMetaSection($('langWrap'), $('langTotal'), langEntries, stats.langMovies, function(e) {
      return Logit.LANG_MAP[e[0].toLowerCase()] || e[0].toUpperCase();
    });

    // Regions
    const regionEntries = Object.entries(stats.countryCount).sort((a, b) => b[1] - a[1]);
    renderMetaSection($('regionWrap'), $('regionTotal'), regionEntries, stats.regionMovies, function(e) { return e[0]; });

    // Rewatched
    const rewatched = Object.entries(stats.rewatchMap)
      .filter(function(e) { return e[1].count > 1; })
      .sort(function(a, b) { return b[1].count - a[1].count; })
      .slice(0, 10);

    $('rewatchTotal').textContent = rewatched.length;
    var rewatchWrap = $('rewatchWrap');
    rewatchWrap.textContent = '';
    if (rewatched.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty';
      emptyDiv.textContent = 'No rewatches yet';
      rewatchWrap.append(emptyDiv);
    } else {
      rewatched.forEach(function(entry) {
        var moviesHtml = Logit.Utils.renderMetaMovies(entry[1].dates || []);
        rewatchWrap.append(Logit.Utils.createMetaItem(entry[0], entry[1].count + 'x', moviesHtml));
      });
    }

    // Decades
    const decades = Object.entries(stats.decadeCount).sort(function(a, b) {
      return parseInt(b[0]) - parseInt(a[0]);
    });
    renderMetaSection($('yearWrap'), $('yearTotal'), decades, stats.decadeMovies, function(e) { return e[0]; });

    // ========= COLLAPSIBLE TOGGLES =========
    document.querySelectorAll('.metaCard.toggleable').forEach(function(card) {
      const head = card.querySelector('.metaHead');
      if (head) {
        head.onclick = function() {
          card.classList.toggle('active');
        };
      }
    });

    // ========= LOCAL FUNCTIONS =========
    function toggleRuntime() {
      const box = $('runtimeBox');
      if (box) {
        box.classList.toggle('expanded');
      }
    }

    function openImportModal() {
      Logit.Utils.openModal($('importModal'));
      $('importText').value = '';
      $('importStatus').textContent = '';
      $('importText').focus();
    }

    function closeImportModal() {
      Logit.Utils.closeModal($('importModal'));
      $('importText').value = '';
      $('importStatus').textContent = '';
    }

    function exportMovies() {
      Logit.Utils.openModal($('exportModal'));
    }

    function closeExportModal() {
      Logit.Utils.closeModal($('exportModal'));
    }

    function doExport(format) {
      Logit.Export.doExport(movies, format, closeExportModal);
    }

    // ========= EVENT LISTENERS =========
    const runtimeBox = $('runtimeBox');
    if (runtimeBox) runtimeBox.addEventListener('click', toggleRuntime);

    const exportBtn = document.querySelector('[data-action="export"]');
    if (exportBtn) exportBtn.addEventListener('click', exportMovies);

    const importBtn = document.querySelector('[data-action="import"]');
    if (importBtn) importBtn.addEventListener('click', openImportModal);

    const importCloseBtn = $('importModalClose');
    if (importCloseBtn) importCloseBtn.addEventListener('click', closeImportModal);

    const exportCloseBtn = $('exportCancelBtn');
    if (exportCloseBtn) exportCloseBtn.addEventListener('click', closeExportModal);

    const exportJsonBtn = $('exportJsonBtn');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', function() { doExport('json'); });

    const exportTxtBtn = $('exportTxtBtn');
    if (exportTxtBtn) exportTxtBtn.addEventListener('click', function() { doExport('txt'); });

    const aboutBtn = document.querySelector('[data-action="about"]');
    if (aboutBtn) aboutBtn.addEventListener('click', function() { window.location.href = 'about.html'; });

    // ========= IMPORT LOGIC =========
    const fileInput = $('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
          $('importText').value = ev.target.result;
          $('importStatus').textContent = 'File loaded: ' + file.name;
        };
        reader.readAsText(file);
      });
    }

    const importStartBtn = $('importStartBtn');
    if (importStartBtn) {
      importStartBtn.onclick = async function() {
        const text = $('importText').value.trim();
        if (!text) return;

        /* JSON Import */
        if (text.charAt(0) === '[') {
          try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error();

            if (Logit.Import.isSlimExport(parsed)) {
              if (!API) {
                $('importStatus').textContent = 'TMDB API key required to import slim export. Set it from main page.';
                return;
              }
              importStartBtn.disabled = true;
              const statusEl = $('importStatus');
              const existingTmdbIds = new Set(movies.map(function(m) { return m.tmdb_id || ''; }));
              const existingIds = new Set(movies.map(function(m) { return m.id; }));
              let imported = 0;
              let failed = 0;
              const total = parsed.length;

              for (let i = 0; i < parsed.length; i++) {
                const entry = parsed[i];
                if ((!entry.t && !entry.id) || !entry.tmdb_id) { failed++; continue; }
                if (existingIds.has(entry.id) || existingTmdbIds.has(entry.tmdb_id)) { continue; }

                statusEl.textContent = 'Fetching ' + (i + 1) + '/' + total + ': ' + entry.t;

                try {
                  const detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdb_id + '?api_key=' + API + '&append_to_response=credits,images');
                  if (!detail) { failed++; continue; }

                  const watch = entry.w || '1st Watch';
                  const newMovie = Logit.MovieFactory.fromTMDB(detail, entry.r || 3, watch, entry.d || Logit.Import.normalizeDate(null));
                  movies.unshift(newMovie);
                  imported++;
                } catch (e) { console.error('JSON slim import item error:', e); failed++; }
              }

              statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
              importStartBtn.disabled = false;
              setTimeout(function() { closeImportModal(); location.reload(); }, 1500);
              return;
            }

            var count = 0;
            const existingIds = new Set(movies.map(function(m) { return m.id; }));
            const existingTmdbFull = new Set(movies.map(function(m) { return m.tmdb_id || ''; }));
            parsed.forEach(function(m) {
              if (!m.t && !m.id) return;
              if (existingIds.has(m.id)) return;
              if (m.tmdb_id && existingTmdbFull.has(m.tmdb_id)) return;
              movies.unshift(m);
              count++;
            });
            $('importStatus').textContent = count + ' imported from JSON';
            setTimeout(function() { closeImportModal(); location.reload(); }, 1500);
            return;
          } catch (e) {
            $('importStatus').textContent = 'Invalid JSON format';
            return;
          }
        }

        const lines = text.split('\n').filter(function(l) { return l.trim().length > 0; });
        if (lines.length === 0) return;

        if (!API) {
          $('importStatus').textContent = 'TMDB import requires an API key. Set it from the main page.';
          return;
        }

        importStartBtn.disabled = true;
        const statusEl = $('importStatus');
        let imported = 0;
        let failed = 0;
        const total = lines.length;
        const existingIds = new Set(movies.map(function(m) { return m.id; }));
        const existingTmdbIds = new Set(movies.map(function(m) { return m.tmdb_id || ''; }));
        const existingImdbIds = new Set(movies.map(function(m) { return m.imdb_id || ''; }));

        for (let i = 0; i < lines.length; i++) {
          const entry = Logit.Import.parseLine(lines[i]);
          if (!entry) { failed++; continue; }

          statusEl.textContent = 'Importing ' + (i + 1) + '/' + total + ': ' + (entry.title || entry.tmdbId || entry.imdbId);

          try {
            let detail = null;

            if (entry.tmdbId) {
              if (existingTmdbIds.has(entry.tmdbId)) { continue; }
              detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdbId + '?api_key=' + API + '&append_to_response=credits,images');
            } else if (entry.imdbId) {
              if (existingImdbIds.has(entry.imdbId)) { continue; }
              const findData = await Logit.Search.tmdb('https://api.themoviedb.org/3/find/' + entry.imdbId + '?api_key=' + API + '&external_source=imdb_id');
              if (findData && findData.movie_results && findData.movie_results.length > 0) {
                const foundId = findData.movie_results[0].id;
                detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + foundId + '?api_key=' + API + '&append_to_response=credits,images');
              }
            } else {
              let searchUrl = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(entry.title);
              if (entry.year) searchUrl += '&year=' + entry.year;
              const searchData = await Logit.Search.tmdb(searchUrl);
              if (!searchData || !searchData.results || searchData.results.length === 0) { failed++; continue; }

              const titleLow = entry.title.toLowerCase();
              let candidates = searchData.results.filter(function(m) { return m.poster_path; });
              if (candidates.length === 0) candidates = searchData.results;

              let result = candidates[0];
              for (let ci = 1; ci < candidates.length; ci++) {
                const c = candidates[ci];
                const cTitle = (c.title || '').toLowerCase();
                if (cTitle === titleLow && (result.title || '').toLowerCase() !== titleLow) { result = c; continue; }
                if (entry.year && c.release_date && result.release_date) {
                  const cYear = c.release_date.slice(0, 4);
                  const rYear = result.release_date.slice(0, 4);
                  if (cYear === entry.year && rYear !== entry.year) { result = c; }
                }
              }
              detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + result.id + '?api_key=' + API + '&append_to_response=credits,images');
            }
            if (!detail) { failed++; continue; }

            const newTmdbId = String(detail.id || '');
            const newImdbId = detail.imdb_id || '';
            if (existingTmdbIds.has(newTmdbId) || (newImdbId && existingImdbIds.has(newImdbId))) { continue; }

            const watch = entry.rewatch ? 'Rewatch' : Logit.Movies.watchType(movies, detail.title || '');

            const newMovie = Logit.MovieFactory.fromTMDB(detail, entry.rating || 3, watch, Logit.Import.normalizeDate(entry.date));
            movies.unshift(newMovie);
            existingIds.add(newMovie.id);
            existingTmdbIds.add(newTmdbId);
            if (newImdbId) existingImdbIds.add(newImdbId);

            imported++;
          } catch (e) { console.error('Text import item error:', e); failed++; }
        }

        statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
        importStartBtn.disabled = false;
        setTimeout(function() { closeImportModal(); location.reload(); }, 1500);
      };
    }
  }
};
