window.Logit = window.Logit || {};

Logit.ProfilePage = {
  _user: null,
  _syncStatusInterval: null,

  async init() {
    this.checkAuth();
    this.setupListeners();
    await this.loadProfile();
    this.updateSyncStatus();
    this.setupSyncStatusUpdates();
  },

  async checkAuth() {
    const user = await Logit.Supabase.getUser();
    const isOffline = localStorage.getItem('logit_offline_mode') === 'true';
    if (!user && !isOffline) {
      window.location.href = 'welcome.html';
      return;
    }
    this._user = user;
    this.showOfflineModeUI(isOffline && !user);
  },

  async loadProfile() {
    if (this._user) {
      document.getElementById('profileName').textContent =
        this._user.user_metadata?.username || this._user.email?.split('@')[0] || 'User';
      document.getElementById('profileEmail').textContent = this._user.email || '';
      const initial = (this._user.email || 'U')[0].toUpperCase();
      document.getElementById('profileAvatar').textContent = initial;
    } else {
      document.getElementById('profileName').textContent = 'Offline Mode';
      document.getElementById('profileEmail').textContent = 'Local storage only';
    }
    this.updateStorageInfo();
  },

  updateStorageInfo() {
    const movies = Logit.Storage.loadMovies();
    const storageInfo = Logit.Storage.getStorageSize();
    const formatted = Logit.Storage.formatBytes(storageInfo.total);
    document.getElementById('moviesCount').textContent = movies.length;
    document.getElementById('localStorageUsage').textContent =
      formatted.val + ' ' + formatted.unit;
  },

  updateSyncStatus() {
    const status = Logit.Sync.getSyncStatus();
    const lastSync = Logit.Sync.getLastSyncTime();
    const pending = Logit.Offline.getPending();
    const badge = document.getElementById('syncStatusBadge');
    const statusText = document.getElementById('syncStatusText');
    badge.className = 'syncStatus ' + status;
    if (status === 'offline') statusText.textContent = 'Offline';
    else if (status === 'syncing') statusText.textContent = 'Syncing...';
    else statusText.textContent = 'Synced';
    document.getElementById('lastSyncedTime').textContent = lastSync ? this.formatTime(lastSync) : 'Never';
    document.getElementById('pendingChanges').textContent = pending.length;
  },

  setupSyncStatusUpdates() {
    Logit.Sync.onSyncStatusChange(() => { this.updateSyncStatus(); });
    this._syncStatusInterval = setInterval(() => { this.updateSyncStatus(); }, 1000);
  },

  setupListeners() {
    const $ = (id) => document.getElementById(id);

    // Back
    $('backBtn').addEventListener('click', () => { window.history.back(); });

    // Manual sync
    $('manualSyncBtn').addEventListener('click', () => { this.manualSync(); });

    // Export button -> open modal
    $('exportBtn').addEventListener('click', () => {
      Logit.Utils.openModal($('exportModal'));
    });

    // Export modal buttons
    $('exportJsonBtn').addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'json', () => {
        Logit.Utils.closeModal($('exportModal'));
      });
    });
    $('exportTxtBtn').addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'txt', () => {
        Logit.Utils.closeModal($('exportModal'));
      });
    });
    $('exportCancelBtn').addEventListener('click', () => {
      Logit.Utils.closeModal($('exportModal'));
    });

    // Import button -> open modal
    $('importBtn').addEventListener('click', () => {
      Logit.Utils.openModal($('importModal'));
      $('importText').value = '';
      $('importStatus').textContent = '';
      $('importText').focus();
    });

    // Import modal close
    $('importModalClose').addEventListener('click', () => {
      Logit.Utils.closeModal($('importModal'));
      $('importText').value = '';
      $('importStatus').textContent = '';
    });

    // File input loads file into textarea
    $('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        $('importText').value = ev.target.result;
        $('importStatus').textContent = 'File loaded: ' + file.name;
      };
      reader.readAsText(file);
    });

    // Import start button — same logic as stats page
    $('importStartBtn').onclick = async () => {
      const text = $('importText').value.trim();
      if (!text) return;

      const API = Logit.Config.getApiKey();
      let movies = Logit.Storage.loadMovies();
      const statusEl = $('importStatus');
      const importStartBtn = $('importStartBtn');

      /* ======== JSON Import ======== */
      if (text.charAt(0) === '[' || text.charAt(0) === '{') {
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : (parsed.movies || []);

          if (Logit.Import.isSlimExport(arr)) {
            if (!API) { statusEl.textContent = 'TMDB API key required. Set it from main page.'; return; }
            importStartBtn.disabled = true;
            const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
            const existingIds = new Set(movies.map(m => m.id));
            let imported = 0, failed = 0;

            for (let i = 0; i < arr.length; i++) {
              const entry = arr[i];
              if ((!entry.t && !entry.id) || !entry.tmdb_id) { failed++; continue; }
              if (existingIds.has(entry.id) || existingTmdbIds.has(entry.tmdb_id)) { continue; }

              statusEl.textContent = 'Fetching ' + (i + 1) + '/' + arr.length + ': ' + entry.t;

              try {
                const detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdb_id + '?api_key=' + API + '&append_to_response=credits,images');
                if (!detail) { failed++; continue; }
                movies.unshift(Logit.MovieFactory.fromTMDB(detail, entry.r || 3, entry.w || '1st Watch', entry.d || Logit.Import.normalizeDate(null)));
                imported++;
              } catch (err) { failed++; }
            }
            Logit.Storage.saveMovies(movies);
            statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
            importStartBtn.disabled = false;
            setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); }, 1500);
            return;
          }

          // Full JSON
          let count = 0;
          const existingIds = new Set(movies.map(m => m.id));
          const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
          arr.forEach(m => {
            if (!m.t && !m.id) return;
            if (existingIds.has(m.id)) return;
            if (m.tmdb_id && existingTmdbIds.has(m.tmdb_id)) return;
            movies.unshift(m);
            count++;
          });
          Logit.Storage.saveMovies(movies);
          statusEl.textContent = count + ' imported from JSON';
          setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); }, 1500);
          return;
        } catch (err) { statusEl.textContent = 'Invalid JSON format'; return; }
      }

      /* ======== Text / TXT Import ======== */
      if (!API) { statusEl.textContent = 'TMDB API key required. Set it from main page.'; return; }

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      importStartBtn.disabled = true;
      let imported = 0, failed = 0;
      const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));

      for (let i = 0; i < lines.length; i++) {
        const entry = Logit.Import.parseLine(lines[i]);
        if (!entry) { failed++; continue; }

        statusEl.textContent = 'Importing ' + (i + 1) + '/' + lines.length + ': ' + (entry.title || entry.tmdbId || entry.imdbId);

        try {
          let detail = null;

          if (entry.tmdbId) {
            detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdbId + '?api_key=' + API + '&append_to_response=credits,images');
          } else if (entry.imdbId) {
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
            let candidates = searchData.results.filter(m => m.poster_path);
            if (candidates.length === 0) candidates = searchData.results;
            let result = candidates[0];
            for (let ci = 1; ci < candidates.length; ci++) {
              const c = candidates[ci];
              if ((c.title || '').toLowerCase() === titleLow && (result.title || '').toLowerCase() !== titleLow) { result = c; continue; }
              if (entry.year && c.release_date && result.release_date) {
                if (c.release_date.slice(0, 4) === entry.year && result.release_date.slice(0, 4) !== entry.year) { result = c; }
              }
            }
            detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + result.id + '?api_key=' + API + '&append_to_response=credits,images');
          }

          if (!detail) { failed++; continue; }
          if (existingTmdbIds.has(String(detail.id))) { continue; }

          const watch = entry.rewatch ? 'Rewatch' : Logit.Movies.watchType(movies, detail.title || '');
          movies.unshift(Logit.MovieFactory.fromTMDB(detail, entry.rating || 3, watch, Logit.Import.normalizeDate(entry.date)));
          existingTmdbIds.add(String(detail.id));
          imported++;
        } catch (err) { failed++; }
      }

      Logit.Storage.saveMovies(movies);
      statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
      importStartBtn.disabled = false;
      setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); }, 1500);
    };

    // Account
    $('signOutBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to sign out?')) Logit.Auth.signOut();
    });
    $('deleteAccountBtn').addEventListener('click', () => { this.deleteAccount(); });
    $('enableCloudBtn').addEventListener('click', () => { window.location.href = 'welcome.html'; });

    // Settings toggles
    const autoSyncToggle = $('autoSyncToggle');
    const autoSyncEnabled = localStorage.getItem('logit_auto_sync') !== 'false';
    autoSyncToggle.classList.toggle('active', autoSyncEnabled);
    autoSyncToggle.addEventListener('click', () => {
      autoSyncToggle.classList.toggle('active');
      localStorage.setItem('logit_auto_sync', autoSyncToggle.classList.contains('active') ? 'true' : 'false');
    });
  },

  async manualSync() {
    const btn = document.getElementById('manualSyncBtn');
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    try {
      const result = await Logit.Sync.sync();
      alert(result.success ? 'Synced ' + result.count + ' changes!' : 'Sync failed: ' + result.message);
    } catch (e) { alert('Sync error: ' + e.message); }
    btn.disabled = false;
    btn.textContent = 'Manual Sync';
    this.updateSyncStatus();
  },

  async deleteAccount() {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    if (!confirm('This will delete your account and all cloud data. Continue?')) return;
    try { await Logit.Auth.signOut(); alert('Account deleted.'); }
    catch (e) { alert('Delete failed: ' + e.message); }
  },

  showOfflineModeUI(show) {
    const section = document.getElementById('offlineModeSection');
    if (section) section.style.display = show ? 'block' : 'none';
    if (show) document.getElementById('manualSyncBtn').style.display = 'none';
  },

  formatTime(date) {
    const diff = Date.now() - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + 'm ago';
    if (hours < 24) return hours + 'h ago';
    if (days < 7) return days + 'd ago';
    return date.toLocaleDateString();
  }
};
