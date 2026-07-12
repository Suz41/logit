window.Logit = window.Logit || {};

Logit.ProfilePage = {
  _user: null,

  async init() {
    try {
      await this.checkAuth();
      this.setupListeners();
      this.loadProfile();
      this.updateSyncStatus();
      this.updateStorageInfo();
      this.updateSyncCounts();
    } catch (e) { console.error('Profile init error:', e); }
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
          if (user) this._user = user;
        }
      }
    } catch (e) { console.error('Auth check error:', e); }
    this.showOfflineModeUI(!this._user);
  },

  loadProfile() {
    const user = this._user;
    const nameEl = document.getElementById('profileName');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profileAvatar');

    if (user) {
      const savedAvatar = localStorage.getItem('logit_avatar');
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
      if (nameEl) nameEl.textContent = username;
      if (emailEl) emailEl.textContent = user.email || '';
      if (avatarEl) avatarEl.textContent = savedAvatar || username[0].toUpperCase();
      if (savedAvatar && savedAvatar.startsWith('data:')) {
        avatarEl.innerHTML = '<img src="' + savedAvatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        const removeBtn = document.getElementById('removeAvatarBtn');
        if (removeBtn) removeBtn.style.display = 'flex';
      }
    } else {
      if (nameEl) nameEl.textContent = 'Offline Mode';
      if (emailEl) emailEl.textContent = 'Local storage only';
    }
  },

  updateStorageInfo() {
    try {
      const movies = Logit.Storage.loadMovies();
      const storageInfo = Logit.Storage.getStorageSize();
      const formatted = Logit.Storage.formatBytes(storageInfo.total);
      const countEl = document.getElementById('moviesCount');
      const usageEl = document.getElementById('localStorageUsage');
      if (countEl) countEl.textContent = movies.length;
      if (usageEl) usageEl.textContent = formatted.val + ' ' + formatted.unit + ' / 5 MB';

      this.updateCloudStorage();
    } catch (e) {}
  },

  async updateCloudStorage() {
    const cloudCountEl = document.getElementById('cloudMoviesCount');
    const cloudUsageEl = document.getElementById('cloudStorageUsage');
    try {
      const client = Logit.Supabase.getClient();
      const userId = localStorage.getItem('logit_user_id');
      if (!client || !userId) {
        if (cloudCountEl) cloudCountEl.textContent = '-';
        if (cloudUsageEl) cloudUsageEl.textContent = '- / 500 MB';
        return;
      }
      const { data } = await client.from('movies').select('id, t, sp, g, c, dr').eq('user_id', userId);
      if (data) {
        const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
        const formatted = Logit.Storage.formatBytes(bytes);
        if (cloudCountEl) cloudCountEl.textContent = data.length;
        if (cloudUsageEl) cloudUsageEl.textContent = formatted.val + ' ' + formatted.unit + ' / 500 MB';
      }
    } catch (e) {
      if (cloudCountEl) cloudCountEl.textContent = '-';
      if (cloudUsageEl) cloudUsageEl.textContent = '- / 500 MB';
    }
  },

  async updateSyncCounts() {
    const syncedEl = document.getElementById('syncedCount');
    const unsyncedEl = document.getElementById('unsyncedCount');
    if (!syncedEl || !unsyncedEl) return;

    try {
      const client = Logit.Supabase.getClient();
      const userId = localStorage.getItem('logit_user_id');
      if (!client || !userId) {
        syncedEl.textContent = '-';
        unsyncedEl.textContent = '-';
        return;
      }
      const { data: cloudMovies } = await client.from('movies').select('id').eq('user_id', userId);
      const localMovies = Logit.Storage.loadMovies();
      const cloudIds = new Set((cloudMovies || []).map(m => m.id));
      const synced = localMovies.filter(m => cloudIds.has(m.id)).length;
      const unsynced = localMovies.length - synced;
      syncedEl.textContent = synced;
      unsyncedEl.textContent = unsynced;
      unsyncedEl.style.color = unsynced > 0 ? 'var(--red)' : 'var(--green)';
    } catch (e) {
      syncedEl.textContent = '-';
      unsyncedEl.textContent = '-';
    }
  },

  updateSyncStatus() {
    try {
      const status = Logit.Sync.getSyncStatus();
      const lastSync = Logit.Sync.getLastSyncTime();
      const badge = document.getElementById('syncStatusBadge');
      const statusText = document.getElementById('syncStatusText');
      if (badge) badge.className = 'syncStatus ' + status;
      if (statusText) {
        if (status === 'offline') statusText.textContent = 'Offline';
        else if (status === 'syncing') statusText.textContent = 'Syncing...';
        else statusText.textContent = 'Synced';
      }
      const lastSyncEl = document.getElementById('lastSyncedTime');
      if (lastSyncEl) lastSyncEl.textContent = lastSync ? this.formatTime(lastSync) : 'Never';
    } catch (e) {}
  },

  setupListeners() {
    const $ = (id) => document.getElementById(id);

    // Back
    if ($('backBtn')) $('backBtn').addEventListener('click', () => window.history.back());

    // Edit avatar
    if ($('editAvatarBtn')) $('editAvatarBtn').addEventListener('click', () => $('avatarInput')?.click());
    if ($('avatarInput')) $('avatarInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        localStorage.setItem('logit_avatar', dataUrl);
        const avatarEl = $('profileAvatar');
        if (avatarEl) avatarEl.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
        const removeBtn = $('removeAvatarBtn');
        if (removeBtn) removeBtn.style.display = 'flex';
      };
      reader.readAsDataURL(file);
    });

    // Remove avatar
    if ($('removeAvatarBtn')) $('removeAvatarBtn').addEventListener('click', () => {
      localStorage.removeItem('logit_avatar');
      const avatarEl = $('profileAvatar');
      const nameEl = $('profileName');
      if (avatarEl) avatarEl.textContent = (nameEl?.textContent || 'U')[0].toUpperCase();
      const removeBtn = $('removeAvatarBtn');
      if (removeBtn) removeBtn.style.display = 'none';
    });

    // Edit username
    if ($('editUsernameBtn')) $('editUsernameBtn').addEventListener('click', async () => {
      const current = $('profileName')?.textContent;
      const newName = prompt('Enter new username:', current);
      if (!newName || newName === current) return;
      const client = Logit.Supabase.getClient();
      if (client && this._user) {
        const { error } = await client.auth.updateUser({ data: { username: newName } });
        if (error) { alert(error.message); return; }
        await client.from('users').upsert({ id: this._user.id, email: this._user.email, username: newName }, { onConflict: 'id' });
      }
      if ($('profileName')) $('profileName').textContent = newName;
    });

    // Sync
    if ($('manualSyncBtn')) $('manualSyncBtn').addEventListener('click', () => this.manualSync());
    if ($('pullCloudBtn')) $('pullCloudBtn').addEventListener('click', () => this.pullFromCloud());

    // Import / Export
    if ($('exportBtn')) $('exportBtn').addEventListener('click', () => Logit.Utils.openModal($('exportModal')));
    if ($('exportJsonBtn')) $('exportJsonBtn').addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'json', () => Logit.Utils.closeModal($('exportModal')));
    });
    if ($('exportTxtBtn')) $('exportTxtBtn').addEventListener('click', () => {
      Logit.Export.doExport(Logit.Storage.loadMovies(), 'txt', () => Logit.Utils.closeModal($('exportModal')));
    });
    if ($('exportCancelBtn')) $('exportCancelBtn').addEventListener('click', () => Logit.Utils.closeModal($('exportModal')));

    if ($('importBtn')) $('importBtn').addEventListener('click', () => {
      Logit.Utils.openModal($('importModal'));
      const t = $('importText'); if (t) t.value = '';
      const s = $('importStatus'); if (s) s.textContent = '';
      if (t) t.focus();
    });
    if ($('importModalClose')) $('importModalClose').addEventListener('click', () => Logit.Utils.closeModal($('importModal')));
    if ($('fileInput')) $('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const t = $('importText'); const s = $('importStatus');
        if (t) t.value = ev.target.result;
        if (s) s.textContent = 'File loaded: ' + file.name;
      };
      reader.readAsText(file);
    });
    if ($('importStartBtn')) $('importStartBtn').onclick = async () => {
      const text = ($('importText') || {}).value;
      if (!text || !text.trim()) return;
      const API = Logit.Config.getApiKey();
      let movies = Logit.Storage.loadMovies();
      const statusEl = $('importStatus');
      const btn = $('importStartBtn');

      if (text.trim().charAt(0) === '[' || text.trim().charAt(0) === '{') {
        try {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : (parsed.movies || []);
          if (Logit.Import.isSlimExport(arr)) {
            if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required.'; return; }
            btn.disabled = true;
            const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
            let imported = 0, failed = 0;
            for (let i = 0; i < arr.length; i++) {
              const entry = arr[i];
              if ((!entry.t && !entry.id) || !entry.tmdb_id) { failed++; continue; }
              if (existingTmdbIds.has(entry.tmdb_id)) continue;
              if (statusEl) statusEl.textContent = 'Fetching ' + (i + 1) + '/' + arr.length;
              try {
                const detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdb_id + '?api_key=' + API + '&append_to_response=credits,images');
                if (!detail) { failed++; continue; }
                movies.unshift(Logit.MovieFactory.fromTMDB(detail, entry.r || 3, entry.w || '1st Watch', entry.d || Logit.Import.normalizeDate(null)));
                imported++;
              } catch (err) { failed++; }
            }
            Logit.Storage.saveMovies(movies);
            if (statusEl) statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
            btn.disabled = false;
            setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1500);
            return;
          }
          let count = 0;
          const existingIds = new Set(movies.map(m => m.id));
          const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
          arr.forEach(m => {
            if (!m.t && !m.id) return;
            if (existingIds.has(m.id)) return;
            if (m.tmdb_id && existingTmdbIds.has(m.tmdb_id)) return;
            movies.unshift(m); count++;
          });
          Logit.Storage.saveMovies(movies);
          if (statusEl) statusEl.textContent = count + ' imported';
          setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1500);
          return;
        } catch (err) { if (statusEl) statusEl.textContent = 'Invalid JSON'; return; }
      }

      if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required. Set it from the main page.'; return; }
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) { if (statusEl) statusEl.textContent = 'No valid lines found'; return; }
      btn.disabled = true;
      let imported = 0, failed = 0, skipped = 0;
      const existingTmdbIds = new Set(movies.filter(m => m.tmdb_id).map(m => String(m.tmdb_id)));
      for (let i = 0; i < lines.length; i++) {
        const entry = Logit.Import.parseLine(lines[i]);
        if (!entry) { failed++; continue; }
        if (statusEl) statusEl.textContent = 'Importing ' + (i + 1) + '/' + lines.length + ': ' + (entry.title || entry.tmdbId || entry.imdbId);
        try {
          let tmdbId = entry.tmdbId || '';
          if (!tmdbId && entry.imdbId) {
            const fd = await Logit.Search.tmdb('https://api.themoviedb.org/3/find/' + entry.imdbId + '?api_key=' + API + '&external_source=imdb_id');
            if (fd && fd.movie_results && fd.movie_results.length > 0) tmdbId = String(fd.movie_results[0].id);
          }
          if (!tmdbId && entry.title) {
            let url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(entry.title);
            if (entry.year) url += '&year=' + entry.year;
            const sd = await Logit.Search.tmdb(url);
            if (sd && sd.results && sd.results.length > 0) tmdbId = String(sd.results[0].id);
          }
          if (!tmdbId) { failed++; continue; }
          if (existingTmdbIds.has(tmdbId)) { skipped++; continue; }

          let detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + API + '&append_to_response=credits,images');
          if (!detail) { failed++; continue; }
          movies.unshift(Logit.MovieFactory.fromTMDB(detail, entry.rating || 3, entry.rewatch ? 'Rewatch' : Logit.Movies.watchType(movies, detail.title || ''), Logit.Import.normalizeDate(entry.date)));
          existingTmdbIds.add(tmdbId);
          imported++;
        } catch (err) { console.error('Import error:', err); failed++; }
      }
      Logit.Storage.saveMovies(movies);
      if (statusEl) statusEl.textContent = imported + ' imported' + (skipped > 0 ? ', ' + skipped + ' skipped' : '') + (failed > 0 ? ', ' + failed + ' failed' : '');
      btn.disabled = false;
      setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1500);
    };

    // Account
    if ($('changePasswordBtn')) $('changePasswordBtn').addEventListener('click', async () => {
      const currentPass = prompt('Enter current password:');
      if (!currentPass) return;
      const newPass = prompt('Enter new password (6+ characters):');
      if (!newPass || newPass.length < 6) { alert('Password must be 6+ characters'); return; }
      const client = Logit.Supabase.getClient();
      if (!client) { alert('Not connected'); return; }
      const user = await client.auth.getUser();
      const email = user.data?.user?.email;
      if (!email) { alert('Not logged in'); return; }
      const { error: loginError } = await client.auth.signInWithPassword({ email, password: currentPass });
      if (loginError) { alert('Current password is wrong'); return; }
      const { error } = await client.auth.updateUser({ password: newPass });
      if (error) { alert(error.message); return; }
      alert('Password updated!');
    });

    if ($('signOutBtn')) $('signOutBtn').addEventListener('click', () => {
      if (confirm('Sign out?')) Logit.Auth.signOut();
    });

    if ($('deleteAccountBtn')) $('deleteAccountBtn').addEventListener('click', () => this.deleteAccount());

    // Clear Data
    if ($('clearDataBtn')) $('clearDataBtn').addEventListener('click', () => {
      if (!confirm('Delete ALL local data?')) return;
      if (!confirm('This cannot be undone. Continue?')) return;
      localStorage.clear();
      alert('All data cleared.');
      location.reload();
    });

    // Offline
    if ($('enableCloudBtn')) $('enableCloudBtn').addEventListener('click', () => window.location.href = 'welcome.html');

    // Auto Sync toggle
    const autoSyncToggle = $('autoSyncToggle');
    if (autoSyncToggle) {
      autoSyncToggle.classList.toggle('active', localStorage.getItem('logit_auto_sync') !== 'false');
      autoSyncToggle.addEventListener('click', () => {
        autoSyncToggle.classList.toggle('active');
        localStorage.setItem('logit_auto_sync', autoSyncToggle.classList.contains('active') ? 'true' : 'false');
      });
    }
  },

  async manualSync() {
    const btn = document.getElementById('manualSyncBtn');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Pushing...';
    try {
      await Logit.Sync.pushToCloud();
      alert('Movies pushed to cloud!');
    } catch (e) { alert('Push error: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Push';
    this.updateSyncCounts();
  },

  async pullFromCloud() {
    const btn = document.getElementById('pullCloudBtn');
    if (!btn) return;
    btn.disabled = true; btn.textContent = 'Pulling...';
    try {
      await Logit.Sync.pullFromCloud();
      alert('Movies pulled from cloud!');
    } catch (e) { alert('Pull error: ' + e.message); }
    btn.disabled = false; btn.textContent = 'Pull';
    this.updateStorageInfo();
    this.updateSyncCounts();
  },

  async deleteAccount() {
    if (!confirm('Delete your account? Your data will be kept for 30 days for recovery.')) return;
    if (!confirm('After 30 days, all data will be permanently deleted. Continue?')) return;
    try {
      const client = Logit.Supabase.getClient();
      const userId = localStorage.getItem('logit_user_id');

      // Mark account for deletion with 30-day grace period
      if (client && userId) {
        await client.from('users').upsert({
          id: userId,
          deleted_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }

      // Clear local data
      localStorage.clear();

      // Sign out
      if (client) await client.auth.signOut();
      alert('Account marked for deletion. Data will be permanently deleted after 30 days.\n\nTo recover, sign in again within 30 days.');
      window.location.href = 'welcome.html';
    } catch (e) { alert('Delete failed: ' + e.message); }
  },

  showOfflineModeUI(show) {
    const section = document.getElementById('offlineModeSection');
    if (section) section.style.display = show ? 'block' : 'none';
    if (show) { const btn = document.getElementById('manualSyncBtn'); if (btn) btn.style.display = 'none'; }
  },

  formatTime(date) {
    const diff = Date.now() - date;
    const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    if (h < 24) return h + 'h ago';
    if (d < 7) return d + 'd ago';
    return date.toLocaleDateString();
  }
};
