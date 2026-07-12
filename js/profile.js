window.Logit = window.Logit || {};

Logit.ProfilePage = {
  _user: null,

  async init() {
    try {
      await this.checkAuth();
      this.setupListeners();
      this.loadProfile();
      this.updateSyncStatus();
    } catch (e) {
      console.error('Profile init error:', e);
    }
  },

  async checkAuth() {
    this._user = null;
    try {
      const userId = localStorage.getItem('logit_user_id');
      const isOffline = localStorage.getItem('logit_offline_mode') === 'true';
      if (userId && !isOffline) {
        const client = Logit.Supabase.getClient();
        if (client) {
          const { data: { user } } = await client.auth.getUser();
          if (user) {
            this._user = user;
          }
        }
      }
    } catch (e) { console.error('Auth check error:', e); }
    this.showOfflineModeUI(!this._user);
  },

  loadProfile() {
    const user = this._user;
    if (user) {
      const nameEl = document.getElementById('profileName');
      const emailEl = document.getElementById('profileEmail');
      const avatarEl = document.getElementById('profileAvatar');
      if (nameEl) nameEl.textContent = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
      if (emailEl) emailEl.textContent = user.email || '';
      if (avatarEl) avatarEl.textContent = (user.email || 'U')[0].toUpperCase();
    } else {
      const nameEl = document.getElementById('profileName');
      const emailEl = document.getElementById('profileEmail');
      if (nameEl) nameEl.textContent = 'Offline Mode';
      if (emailEl) emailEl.textContent = 'Local storage only';
    }
    this.updateStorageInfo();
  },

  updateStorageInfo() {
    try {
      const movies = Logit.Storage.loadMovies();
      const storageInfo = Logit.Storage.getStorageSize();
      const formatted = Logit.Storage.formatBytes(storageInfo.total);
      const countEl = document.getElementById('moviesCount');
      const usageEl = document.getElementById('localStorageUsage');
      if (countEl) countEl.textContent = movies.length;
      if (usageEl) usageEl.textContent = formatted.val + ' ' + formatted.unit;
    } catch (e) { console.error('Storage info error:', e); }
  },

  updateSyncStatus() {
    try {
      const status = Logit.Sync.getSyncStatus();
      const lastSync = Logit.Sync.getLastSyncTime();
      const pending = Logit.Offline.getPending();
      const badge = document.getElementById('syncStatusBadge');
      const statusText = document.getElementById('syncStatusText');
      if (badge) badge.className = 'syncStatus ' + status;
      if (statusText) {
        if (status === 'offline') statusText.textContent = 'Offline';
        else if (status === 'syncing') statusText.textContent = 'Syncing...';
        else statusText.textContent = 'Synced';
      }
      const lastSyncEl = document.getElementById('lastSyncedTime');
      const pendingEl = document.getElementById('pendingChanges');
      if (lastSyncEl) lastSyncEl.textContent = lastSync ? this.formatTime(lastSync) : 'Never';
      if (pendingEl) pendingEl.textContent = pending.length;
    } catch (e) { console.error('Sync status error:', e); }
  },

  setupListeners() {
    const $ = (id) => document.getElementById(id);

    const backBtn = $('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => { window.history.back(); });

    const manualSyncBtn = $('manualSyncBtn');
    if (manualSyncBtn) manualSyncBtn.addEventListener('click', () => { this.manualSync(); });

    const pullCloudBtn = $('pullCloudBtn');
    if (pullCloudBtn) pullCloudBtn.addEventListener('click', () => { this.pullFromCloud(); });

    // Export
    const exportBtn = $('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', () => {
      Logit.Utils.openModal($('exportModal'));
    });

    const exportJsonBtn = $('exportJsonBtn');
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'json', () => {
        Logit.Utils.closeModal($('exportModal'));
      });
    });

    const exportTxtBtn = $('exportTxtBtn');
    if (exportTxtBtn) exportTxtBtn.addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'txt', () => {
        Logit.Utils.closeModal($('exportModal'));
      });
    });

    const exportCancelBtn = $('exportCancelBtn');
    if (exportCancelBtn) exportCancelBtn.addEventListener('click', () => {
      Logit.Utils.closeModal($('exportModal'));
    });

    // Import
    const importBtn = $('importBtn');
    if (importBtn) importBtn.addEventListener('click', () => {
      Logit.Utils.openModal($('importModal'));
      const t = $('importText');
      const s = $('importStatus');
      if (t) t.value = '';
      if (s) s.textContent = '';
      if (t) t.focus();
    });

    const importModalClose = $('importModalClose');
    if (importModalClose) importModalClose.addEventListener('click', () => {
      Logit.Utils.closeModal($('importModal'));
      const t = $('importText');
      const s = $('importStatus');
      if (t) t.value = '';
      if (s) s.textContent = '';
    });

    const fileInput = $('fileInput');
    if (fileInput) fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const t = $('importText');
        const s = $('importStatus');
        if (t) t.value = ev.target.result;
        if (s) s.textContent = 'File loaded: ' + file.name;
      };
      reader.readAsText(file);
    });

    const importStartBtn = $('importStartBtn');
    if (importStartBtn) importStartBtn.onclick = async () => {
      const text = ($('importText') || {}).value;
      if (!text || !text.trim()) return;

      const API = Logit.Config.getApiKey();
      let movies = Logit.Storage.loadMovies();
      const statusEl = $('importStatus');

      /* ======== JSON Import ======== */
      if (text.trim().charAt(0) === '[' || text.trim().charAt(0) === '{') {
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : (parsed.movies || []);

          if (Logit.Import.isSlimExport(arr)) {
            if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required.'; return; }
            importStartBtn.disabled = true;
            const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
            const existingIds = new Set(movies.map(m => m.id));
            let imported = 0, failed = 0;

            for (let i = 0; i < arr.length; i++) {
              const entry = arr[i];
              if ((!entry.t && !entry.id) || !entry.tmdb_id) { failed++; continue; }
              if (existingIds.has(entry.id) || existingTmdbIds.has(entry.tmdb_id)) { continue; }
              if (statusEl) statusEl.textContent = 'Fetching ' + (i + 1) + '/' + arr.length + ': ' + entry.t;

              try {
                const detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdb_id + '?api_key=' + API + '&append_to_response=credits,images');
                if (!detail) { failed++; continue; }
                movies.unshift(Logit.MovieFactory.fromTMDB(detail, entry.r || 3, entry.w || '1st Watch', entry.d || Logit.Import.normalizeDate(null)));
                imported++;
              } catch (err) { failed++; }
            }
            Logit.Storage.saveMovies(movies);
            if (statusEl) statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
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
          if (statusEl) statusEl.textContent = count + ' imported from JSON';
          setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); }, 1500);
          return;
        } catch (err) { if (statusEl) statusEl.textContent = 'Invalid JSON format'; return; }
      }

      /* ======== Text / TXT Import ======== */
      if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required.'; return; }

      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;

      importStartBtn.disabled = true;
      let imported = 0, failed = 0;
      const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));

      for (let i = 0; i < lines.length; i++) {
        const entry = Logit.Import.parseLine(lines[i]);
        if (!entry) { failed++; continue; }
        if (statusEl) statusEl.textContent = 'Importing ' + (i + 1) + '/' + lines.length + ': ' + (entry.title || entry.tmdbId || entry.imdbId);

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
      if (statusEl) statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
      importStartBtn.disabled = false;
      setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); }, 1500);
    };

    // Account
    const signOutBtn = $('signOutBtn');
    if (signOutBtn) signOutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to sign out?')) Logit.Auth.signOut();
    });

    const deleteAccountBtn = $('deleteAccountBtn');
    if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', () => { this.deleteAccount(); });

    const enableCloudBtn = $('enableCloudBtn');
    if (enableCloudBtn) enableCloudBtn.addEventListener('click', () => { window.location.href = 'welcome.html'; });

    // Change Password
    const changePasswordBtn = $('changePasswordBtn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', async () => {
      const currentPass = prompt('Enter current password:');
      if (!currentPass) return;
      const newPass = prompt('Enter new password (6+ characters):');
      if (!newPass || newPass.length < 6) { alert('Password must be 6+ characters'); return; }
      const client = Logit.Supabase.getClient();
      if (!client) { alert('Not connected'); return; }

      // Re-login with current password to verify
      const user = await client.auth.getUser();
      const email = user.data?.user?.email;
      if (!email) { alert('Not logged in'); return; }

      const { error: loginError } = await client.auth.signInWithPassword({ email, password: currentPass });
      if (loginError) { alert('Current password is wrong'); return; }

      // Update to new password
      const { error } = await client.auth.updateUser({ password: newPass });
      if (error) { alert(error.message); return; }
      alert('Password updated!');
    });

    // Clear All Data
    const clearDataBtn = $('clearDataBtn');
    if (clearDataBtn) clearDataBtn.addEventListener('click', () => {
      if (!confirm('Delete ALL local data? This cannot be undone.')) return;
      if (!confirm('Are you really sure?')) return;
      localStorage.clear();
      alert('All data cleared.');
      location.reload();
    });

    // Settings toggles
    const autoSyncToggle = $('autoSyncToggle');
    if (autoSyncToggle) {
      const autoSyncEnabled = localStorage.getItem('logit_auto_sync') !== 'false';
      autoSyncToggle.classList.toggle('active', autoSyncEnabled);
      autoSyncToggle.addEventListener('click', () => {
        autoSyncToggle.classList.toggle('active');
        localStorage.setItem('logit_auto_sync', autoSyncToggle.classList.contains('active') ? 'true' : 'false');
      });
    }
  },

  async pullFromCloud() {
    const btn = document.getElementById('pullCloudBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Pulling...';
    try {
      const client = Logit.Supabase.getClient();
      const userId = localStorage.getItem('logit_user_id');
      if (!client || !userId) { alert('Not connected to cloud'); btn.disabled = false; btn.textContent = 'Pull from Cloud'; return; }

      const { data: remoteMovies, error } = await client
        .from('movies')
        .select('*')
        .eq('user_id', userId);

      if (error) throw new Error(error.message);

      const localMovies = Logit.Storage.loadMovies();
      const localMap = new Map(localMovies.map(m => [m.id, m]));
      let updated = 0, added = 0;

      for (const remoteMovie of remoteMovies || []) {
        const sanitized = Logit.Sync.sanitizeRemoteMovie(remoteMovie);
        const localMovie = localMap.get(remoteMovie.id);

        if (!localMovie) {
          localMovies.push(sanitized);
          added++;
        } else {
          const remoteTime = new Date(remoteMovie.updated_at || 0).getTime();
          const localTime = new Date(localMovie.updated_at || 0).getTime();
          if (remoteTime > localTime) {
            Object.assign(localMovie, sanitized);
            updated++;
          }
        }
      }

      Logit.Storage.saveMovies(localMovies);
      alert('Done! ' + added + ' new, ' + updated + ' updated');
      this.updateStorageInfo();
    } catch (e) { alert('Pull error: ' + e.message); }
    btn.disabled = false;
    btn.textContent = 'Pull from Cloud';
  },

  async manualSync() {
    const btn = document.getElementById('manualSyncBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Syncing...';
    try {
      const client = Logit.Supabase.getClient();
      const userId = localStorage.getItem('logit_user_id');
      if (!client || !userId) { alert('Not connected to cloud'); btn.disabled = false; btn.textContent = 'Manual Sync'; return; }

      const localMovies = Logit.Storage.loadMovies();
      if (localMovies.length > 0) {
        const moviesToInsert = localMovies.map(m => ({
          ...m,
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        const { error } = await client.from('movies').upsert(moviesToInsert, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      alert(localMovies.length + ' movies synced to cloud!');
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
    if (show) {
      const btn = document.getElementById('manualSyncBtn');
      if (btn) btn.style.display = 'none';
    }
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
