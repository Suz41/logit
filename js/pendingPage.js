window.Logit = window.Logit || {};

/**
 * Log!t Pending Page Controller
 */
Logit.PendingPage = {
  state: {
    pending: [],
    libraryMovies: [],
    activeMatchItem: null,
    loading: true
  },

  async init() {
    this.container = document.getElementById('pendingGrid');
    this.countPill = document.getElementById('pendingCountPill');
    this.refreshBtn = document.getElementById('refreshPendingBtn');
    this.matchModal = document.getElementById('matchModal');
    this.matchInput = document.getElementById('matchSearchInput');
    this.matchResults = document.getElementById('matchResultsList');
    this.closeMatchBtn = document.getElementById('closeMatchBtn');

    this.setupListeners();

    if (Logit.Supabase) {
      Logit.Supabase.init();
      const session = await Logit.Supabase.getSession();
      if (session && session.user) {
        localStorage.setItem('logit_user_id', session.user.id);
      }
    }

    await this.loadData();
  },

  setupListeners() {
    const self = this;

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        self.loadData();
      });
    }

    // Match Search Modal
    if (this.closeMatchBtn) {
      this.closeMatchBtn.addEventListener('click', () => {
        self.closeMatchModal();
      });
    }

    if (this.matchModal) {
      this.matchModal.addEventListener('click', (e) => {
        if (e.target === self.matchModal) self.closeMatchModal();
      });
    }

    if (this.matchInput) {
      const debouncedSearch = Logit.Utils.debounce(() => {
        self.searchMatchTMDB(self.matchInput.value.trim());
      }, 250);
      this.matchInput.addEventListener('input', debouncedSearch);
    }
  },

  async loadData() {
    this.state.loading = true;
    Logit.UI.showLoading(this.container);

    try {
      // Load both pending movies and user's existing library
      const [pendingRes, libRes] = await Promise.all([
        Logit.Pending.loadPending('pending'),
        Logit.Storage.loadMovies().catch(() => ({ movies: [] }))
      ]);

      this.state.pending = pendingRes.pending || [];
      this.state.libraryMovies = libRes.movies || [];
    } catch (e) {
      console.error('Failed to load pending movies:', e);
      this.state.pending = Logit.Pending.getOfflinePending();
    } finally {
      this.state.loading = false;
      this.render();
      Logit.Pending.updateBadges();
      this.resolveUnmatchedInBg();
    }
  },

  render() {
    const esc = Logit.Utils.esc;
    const img = Logit.Utils.img;
    const items = this.state.pending;

    if (this.countPill) {
      this.countPill.textContent = items.length;
    }

    if (items.length === 0) {
      this.container.innerHTML = `
        <div class="pendingEmpty">
          <div class="pendingEmptyIcon">
            <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div class="pendingEmptyTitle">No Pending Movies</div>
          <p class="pendingEmptySubtitle">Quickly capture movies using Log!t Companion on mobile or desktop, then review and log them here.</p>
          <a href="companion.html" class="quickCaptureBtn" style="text-decoration:none; margin-top: 8px;">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Open Quick Capture
          </a>
        </div>
      `;
      return;
    }

    this.container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'pendingCard';
      card.dataset.id = item.id;

      const meta = item.metadata || {};
      const posterPath = meta.poster_path || '';
      const posterUrl = posterPath ? img(posterPath, 'w185') : Logit.POSTER_FALLBACK;
      const displayTitle = meta.title || item.movie_title || 'Untitled';
      const releaseYear = (meta.release_date || '').slice(0, 4) || item.year || '';
      const isMatched = item.status === 'matched' || !!item.tmdb_id;

      // Rating chip
      const ratingBadge = item.rating
        ? `<span class="metaItemChip ratingChip">★ ${parseFloat(item.rating).toFixed(1)}</span>`
        : '';

      // Date chip
      let dateText = item.watch_date || '';
      if (dateText) {
        try {
          const d = new Date(dateText);
          if (!isNaN(d.getTime())) {
            const short = Logit.Utils.formatDateShort(d);
            dateText = short.month + ' ' + short.day;
          }
        } catch (_) {}
      }
      const dateBadge = dateText
        ? `<span class="metaItemChip"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ${esc(dateText)}</span>`
        : '';

      // Rewatch chip
      const isRewatch = item.is_rewatch || Logit.Utils.isRewatch(item);
      const rewatchBadge = isRewatch
        ? `<span class="metaItemChip rewatchChip">Rewatch</span>`
        : '';

      card.innerHTML = `
        <div class="pendingPosterWrap">
          <img class="pendingPosterImg" src="${esc(posterUrl)}" alt="${esc(displayTitle)}" onerror="this.onerror=null;this.src='${Logit.POSTER_FALLBACK}'" loading="lazy" />
        </div>
        <div class="pendingInfo">
          <div class="pendingTitleRow">
            <div class="pendingMovieTitle">
              ${esc(displayTitle)}
              ${releaseYear ? `<span class="pendingYear">(${releaseYear})</span>` : ''}
            </div>
            <span class="statusBadge ${isMatched ? 'matched' : 'pending'}">
              ${isMatched ? 'Matched' : 'Needs Match'}
            </span>
          </div>

          <div class="pendingMetaRow">
            ${ratingBadge}
            ${dateBadge}
            ${rewatchBadge}
            ${item.raw_input && item.raw_input !== displayTitle ? `<span class="rawInputQuote" title="Captured: ${esc(item.raw_input)}">&ldquo;${esc(item.raw_input)}&rdquo;</span>` : ''}
          </div>

          <div class="pendingActionsRow">
            <button type="button" class="changeMatchBtn" data-action="match">Change Match</button>
            <button type="button" class="removePendingBtn" data-action="remove" title="Remove from Pending">&times;</button>
            <button type="button" class="logMovieBtn" data-action="log">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              Log Movie
            </button>
          </div>
        </div>
      `;

      // Event handlers
      card.querySelector('[data-action="log"]').onclick = () => this.handleLogMovie(item);
      card.querySelector('[data-action="match"]').onclick = () => this.openMatchModal(item);
      card.querySelector('[data-action="remove"]').onclick = () => this.handleRemove(item);

      fragment.appendChild(card);
    });

    this.container.appendChild(fragment);
  },

  /**
   * Log movie workflow from pending entry.
   * @param {Object} item
   */
  async handleLogMovie(item) {
    const API = Logit.Config.getApiKey();
    if (!API) {
      alert('TMDB API Key missing. Please set your TMDB API key in settings or profile.');
      return;
    }

    let tmdbId = item.tmdb_id;

    // If no TMDB ID yet, search now
    if (!tmdbId) {
      const match = await Logit.Pending.searchBestMatch(item.movie_title, item.year, API);
      if (!match) {
        alert('Could not find a TMDB match for "' + item.movie_title + '". Please use "Change Match" to search manually.');
        this.openMatchModal(item);
        return;
      }
      tmdbId = String(match.id);
      item.tmdb_id = tmdbId;
      item.metadata = {
        title: match.title,
        release_date: match.release_date,
        poster_path: match.poster_path
      };
    }

    // Fetch full TMDB movie detail
    let movieDetail;
    try {
      movieDetail = await Logit.Search.tmdb(
        'https://api.themoviedb.org/3/movie/' +
          tmdbId +
          '?api_key=' +
          API +
          '&append_to_response=credits,images'
      );
    } catch (err) {
      console.error('TMDB detail fetch failed:', err);
    }

    if (!movieDetail) {
      alert('Failed to fetch movie details from TMDB. Please check your connection.');
      return;
    }

    // Open logging sheet pre-filled with parsed values
    this.openPendingLogModal(item, movieDetail);
  },

  /**
   * Custom modal for completing pending movie with pre-filled rating and watch date.
   */
  openPendingLogModal(item, detail) {
    const self = this;
    const old = document.querySelector('.ratingSheet');
    if (old) old.remove();

    const sheet = document.createElement('div');
    sheet.className = 'ratingSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Confirm & Log Movie');

    let ratesHtml = '';
    const initialRating = item.rating ? String(parseFloat(item.rating).toFixed(1)) : '5.0';

    Logit.RATINGS.forEach((v) => {
      const isSelected = String(parseFloat(v).toFixed(1)) === initialRating;
      ratesHtml += `<button class="${isSelected ? 'active' : ''}" aria-label="Rate ${v} stars">${v}</button>`;
    });

    const isRewatch = item.is_rewatch || Logit.Utils.isRewatch(item);
    const watchDateVal = item.watch_date || new Date().toISOString().slice(0, 10);

    sheet.innerHTML = `
      <div class="sheetBg" aria-hidden="true"></div>
      <div class="sheet">
        <img src="${Logit.Utils.esc(Logit.Utils.img(detail.poster_path))}" onerror="this.onerror=null;this.src='${Logit.POSTER_FALLBACK}'" alt="${Logit.Utils.esc(detail.title)} poster">
        <h3>${Logit.Utils.esc(detail.title)} <span style="font-weight:400;color:#888;">(${(detail.release_date || '').slice(0, 4)})</span></h3>
        
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <label style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Rating</label>
        </div>
        <div class="rates">
          ${ratesHtml}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; padding:10px 0 6px; border-top:0.5px solid rgba(255,255,255,0.08); border-bottom:0.5px solid rgba(255,255,255,0.08); margin: 6px 0 10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <label style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:600;">Date</label>
            <input type="date" id="pendingWatchDateInput" value="${watchDateVal}" style="background:#222;border:0.5px solid rgba(255,255,255,0.15);border-radius:8px;color:#fff;padding:4px 8px;font-family:inherit;font-size:12px;" />
          </div>

          <label class="sheetToggle" style="margin:0;">
            <input type="checkbox" id="rewatchToggle" ${isRewatch ? 'checked' : ''}>
            <div class="toggle-track"></div>
            Rewatch
          </label>
        </div>

        <button class="sheetAdd enabled" id="confirmLogBtn" aria-label="Confirm and save to library">Log to Library</button>
      </div>
    `;

    document.body.append(sheet);

    let selectedRating = item.rating || '5';
    const confirmBtn = sheet.querySelector('#confirmLogBtn');

    sheet.querySelectorAll('.rates button').forEach((btn) => {
      btn.onclick = () => {
        sheet.querySelectorAll('.rates button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedRating = btn.textContent;
      };
    });

    sheet.querySelector('.sheetBg').onclick = () => sheet.remove();

    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Saving...';

      const rewatchVal = sheet.querySelector('#rewatchToggle').checked;
      const dateVal = sheet.querySelector('#pendingWatchDateInput').value;

      try {
        await Logit.Pending.completePending(
          item.id,
          detail,
          selectedRating,
          rewatchVal,
          dateVal,
          self.state.libraryMovies
        );

        // Remove from local pending list & re-render
        self.state.pending = self.state.pending.filter((x) => x.id !== item.id);
        sheet.remove();
        self.render();
      } catch (saveErr) {
        console.error('Failed to log pending movie:', saveErr);
        alert('Failed to log movie: ' + saveErr.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Log to Library';
      }
    };
  },

  /**
   * Delete pending item.
   * @param {Object} item
   */
  async handleRemove(item) {
    if (!confirm('Remove "' + (item.metadata?.title || item.movie_title) + '" from Pending?')) return;
    try {
      await Logit.Pending.deletePending(item.id);
      this.state.pending = this.state.pending.filter((x) => x.id !== item.id);
      this.render();
    } catch (e) {
      alert('Failed to remove: ' + e.message);
    }
  },

  /**
   * Open match selection modal.
   * @param {Object} item
   */
  openMatchModal(item) {
    this.state.activeMatchItem = item;
    this.matchInput.value = item.movie_title || '';
    this.matchModal.classList.add('active');
    this.matchInput.focus();
    this.searchMatchTMDB(this.matchInput.value.trim());
  },

  closeMatchModal() {
    this.matchModal.classList.remove('active');
    this.state.activeMatchItem = null;
    this.matchResults.innerHTML = '';
  },

  /**
   * Search TMDB to change match.
   * @param {string} q
   */
  async searchMatchTMDB(q) {
    const API = Logit.Config.getApiKey();
    if (!q || !API) {
      this.matchResults.innerHTML = '';
      return;
    }

    Logit.UI.showLoading(this.matchResults);

    try {
      const url =
        'https://api.themoviedb.org/3/search/movie?api_key=' +
        API +
        '&query=' +
        encodeURIComponent(q);
      const data = await Logit.Search.tmdb(url);

      if (!data || !data.results || data.results.length === 0) {
        this.matchResults.innerHTML = '<div style="text-align:center;padding:20px;color:#888;">No movies found</div>';
        return;
      }

      this.matchResults.innerHTML = '';
      data.results.slice(0, 15).forEach((m) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'matchResultItem';
        const posterUrl = m.poster_path ? Logit.Utils.img(m.poster_path, 'w92') : Logit.POSTER_FALLBACK;
        const year = (m.release_date || '').slice(0, 4);

        itemEl.innerHTML = `
          <img class="matchResultPoster" src="${Logit.Utils.esc(posterUrl)}" alt="" onerror="this.onerror=null;this.src='${Logit.POSTER_FALLBACK}'" />
          <div class="matchResultInfo">
            <div class="matchResultTitle">${Logit.Utils.esc(m.title)}</div>
            <div class="matchResultYear">${year ? year : 'Unknown year'}</div>
          </div>
        `;

        itemEl.onclick = async () => {
          await this.applyMatch(m);
        };

        this.matchResults.appendChild(itemEl);
      });
    } catch (e) {
      this.matchResults.innerHTML = '<div style="color:var(--red);padding:10px;">Search failed</div>';
    }
  },

  /**
   * Apply user-selected TMDB match to active pending item.
   * @param {Object} tmdbMovie
   */
  async applyMatch(tmdbMovie) {
    const item = this.state.activeMatchItem;
    if (!item) return;

    const updates = {
      tmdb_id: String(tmdbMovie.id),
      status: 'matched',
      metadata: {
        title: tmdbMovie.title,
        release_date: tmdbMovie.release_date || '',
        poster_path: tmdbMovie.poster_path || '',
        backdrop_path: tmdbMovie.backdrop_path || '',
        overview: tmdbMovie.overview || '',
        vote_average: tmdbMovie.vote_average || 0
      }
    };

    try {
      await Logit.Pending.updatePending(item.id, updates);
      Object.assign(item, updates);
      this.closeMatchModal();
      this.render();
    } catch (err) {
      alert('Failed to update match: ' + err.message);
    }
  },

  /**
   * Silently resolve missing TMDB matches in the background.
   */
  async resolveUnmatchedInBg() {
    const API = Logit.Config.getApiKey();
    if (!API) return;

    for (const item of this.state.pending) {
      if (!item.tmdb_id || !item.metadata?.poster_path) {
        try {
          const match = await Logit.Pending.searchBestMatch(item.movie_title, item.year, API);
          if (match) {
            const updates = {
              tmdb_id: String(match.id),
              status: 'matched',
              metadata: {
                title: match.title,
                release_date: match.release_date || '',
                poster_path: match.poster_path || '',
                backdrop_path: match.backdrop_path || '',
                overview: match.overview || ''
              }
            };
            await Logit.Pending.updatePending(item.id, updates);
            Object.assign(item, updates);
          }
        } catch (_) {}
      }
    }
    this.render();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Logit.PendingPage.init();
});
