window.Logit = window.Logit || {};

Logit.ProfilePage = {
  _user: null,

  async init() {
    try {
      if (typeof Logit.Sync !== 'undefined') Logit.Sync.init();
      await this.checkAuth();
    } catch (e) { console.error('Auth init error:', e); }

    try {
      this.setupListeners();
      this.setupTabs();
      // Load avatar from cloud first
      if (!Logit.Auth.isOfflineMode()) {
        try { await this.loadAvatarFromCloud(); } catch (e) {}
      }
      this.loadProfile();
      // Pull movies from cloud first for accurate stats
      if (!Logit.Auth.isOfflineMode()) {
        try { await Logit.Sync.pullFromCloud(); } catch (e) {}
      }
      this.loadStats();
      await this.loadFavoritesFromCloud();
      this.loadFavorites();
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
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'User';
      if (nameEl) nameEl.textContent = username;
      if (emailEl) emailEl.textContent = user.email || '';
      // Load saved avatar
      const savedAvatar = localStorage.getItem('logit_avatar');
      if (savedAvatar && avatarEl) {
        avatarEl.innerHTML = '<img src="' + savedAvatar + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
      } else if (avatarEl) {
        avatarEl.textContent = username[0].toUpperCase();
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
      if (badge) badge.className = 'syncBadge ' + status;
      if (statusText) {
        if (status === 'offline') statusText.textContent = 'Offline';
        else if (status === 'syncing') statusText.textContent = 'Syncing...';
        else if (localStorage.getItem('logit_cloud_existed') === 'true') {
          statusText.textContent = 'Cloud data loaded';
        } else {
          statusText.textContent = 'Synced';
        }
      }
      const lastSyncEl = document.getElementById('lastSyncedTime');
      if (lastSyncEl) lastSyncEl.textContent = lastSync ? this.formatTime(lastSync) : 'Never';
    } catch (e) {}
  },

  loadStats() {
    try {
      const movies = Logit.Storage.loadMovies();
      const stats = Logit.StatUtils.aggregate(movies);

      // Films count
      const filmsEl = document.getElementById('statFilms');
      if (filmsEl) filmsEl.textContent = movies.length;

      // Average rating (only count rated movies)
      const ratedMovies = movies.filter(m => Number(m.r) > 0);
      const avgRating = ratedMovies.length > 0
        ? (ratedMovies.reduce((a, b) => a + Number(b.r), 0) / ratedMovies.length).toFixed(1)
        : '0.0';
      const ratingEl = document.getElementById('statRating');
      if (ratingEl) ratingEl.textContent = avgRating;

      // Rewatches (movies marked as rewatch in library)
      const rewatchCount = movies.filter(m => Logit.Utils.isRewatch(m)).length;
      const rewatchEl = document.getElementById('statRewatch');
      if (rewatchEl) rewatchEl.textContent = rewatchCount;

      // Hours
      const totalMins = movies.reduce((a, b) => a + (Number(b.rt) || 0), 0);
      const hours = Math.round(totalMins / 60);
      const hoursEl = document.getElementById('statHours');
      if (hoursEl) hoursEl.textContent = hours;

      // Stats tab
      const statTotalFilms = document.getElementById('statTotalFilms');
      const statAvgRating = document.getElementById('statAvgRating');
      const statTotalRewatch = document.getElementById('statTotalRewatch');
      const statTotalHours = document.getElementById('statTotalHours');
      if (statTotalFilms) statTotalFilms.textContent = movies.length;
      if (statAvgRating) statAvgRating.textContent = avgRating;
      if (statTotalRewatch) statTotalRewatch.textContent = rewatchCount;
      if (statTotalHours) statTotalHours.textContent = hours;
    } catch (e) {}
  },

  setupTabs() {
    const tabs = document.querySelectorAll('.profileTab');
    const panels = document.querySelectorAll('.tabPanel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const panel = document.getElementById('panel-' + target);
        if (panel) panel.classList.add('active');
      });
    });
  },

  loadAllFilms() {
    try {
      const movies = Logit.Storage.loadMovies();
      const grid = document.getElementById('allFilmsGrid');
      if (!grid) return;

      if (movies.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted);font-size:13px;">No films logged yet</div>';
        return;
      }

      const sorted = [...movies].sort((a, b) => (b.d || '').localeCompare(a.d || ''));

      grid.innerHTML = sorted.map(m => {
        const poster = m.sp
          ? `<img src="https://image.tmdb.org/t/p/w342${m.sp}" alt="${m.t}" loading="lazy">`
          : `<div class="filmPosterPlaceholder">${m.t ? m.t.substring(0, 20) : '?'}</div>`;
        const rating = m.r ? `<div class="filmRating">${m.r}★</div>` : '';
        return `<div class="filmPoster" title="${m.t}">${poster}${rating}</div>`;
      }).join('');
    } catch (e) {}
  },

  loadFavorites() {
    try {
      const favs = JSON.parse(localStorage.getItem('logit_favorites') || '[]');
      const grid = document.getElementById('favFilmsGrid');
      if (!grid) return;

      let html = '';
      for (let i = 0; i < 4; i++) {
        if (favs[i]) {
          html += `<div class="favPoster" data-index="${i}" title="${favs[i].t} - Click to change">
            <img src="${favs[i].poster}" alt="${favs[i].t}">
            <button class="favRemove" data-index="${i}">&times;</button>
          </div>`;
        } else {
          html += `<div class="favPosterPlaceholder" data-slot="${i}">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Add</span>
          </div>`;
        }
      }
      grid.innerHTML = html;

      // Click on poster to change poster (like library)
      grid.querySelectorAll('.favPoster').forEach(poster => {
        poster.addEventListener('click', (e) => {
          if (e.target.classList.contains('favRemove')) return;
          const idx = parseInt(poster.dataset.index);
          const fav = favs[idx];
          if (fav && fav.id) {
            this.changeFavPoster(idx, fav);
          }
        });
      });

      // Click handlers for remove
      grid.querySelectorAll('.favRemove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.index);
          this.removeFavorite(idx);
        });
      });

      // Click handlers for empty slots
      grid.querySelectorAll('.favPosterPlaceholder').forEach(slot => {
        slot.addEventListener('click', () => {
          this._editingFavIndex = null;
          this.openFavModal();
        });
      });
    } catch (e) {
      console.error('loadFavorites error:', e);
    }
  },

  openFavModal() {
    const modal = document.getElementById('favModal');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('favSearchInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      this._selectedFav = null;
      const selected = document.getElementById('favSelected');
      if (selected) selected.style.display = 'none';
      const results = document.getElementById('favSearchResults');
      if (results) results.innerHTML = '';
      const confirmBtn = document.getElementById('favConfirmBtn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = this._editingFavIndex !== null ? 'Change Poster' : 'Add to Favorites';
      }
    }
  },

  closeFavModal() {
    const modal = document.getElementById('favModal');
    if (modal) modal.classList.remove('active');
  },

  openDirectorModal() {
    const modal = document.getElementById('directorModal');
    if (modal) {
      modal.classList.add('active');
      const input = document.getElementById('directorSearchInput');
      if (input) {
        input.value = '';
        input.focus();
      }
      const results = document.getElementById('directorResults');
      if (results) results.innerHTML = '';
    }
  },

  closeDirectorModal() {
    const modal = document.getElementById('directorModal');
    if (modal) modal.classList.remove('active');
  },

  async searchDirectors(query) {
    const API = Logit.Config.getApiKey();
    const results = document.getElementById('directorResults');
    if (!results || !API || !query || query.length < 2) {
      if (results) results.innerHTML = '';
      return;
    }

    try {
      const data = await Logit.Search.tmdb('https://api.themoviedb.org/3/search/person?api_key=' + API + '&query=' + encodeURIComponent(query));
      if (!data || !data.results) return;

      // Filter to directors only
      const directors = data.results.filter(p => p.known_for_department === 'Directing' && p.profile_path);
      const self = this;
      results.innerHTML = directors.slice(0, 8).map(p => {
        const imgUrl = 'https://image.tmdb.org/t/p/w185' + p.profile_path;
        return '<div class="directorItem" onclick="Logit.ProfilePage.setDirectorAvatar(\'' + imgUrl + '\')">'
          + '<img src="' + imgUrl + '" alt="' + Logit.Utils.esc(p.name) + '">'
          + '<div class="directorItemInfo">'
          + '<div class="directorItemName">' + Logit.Utils.esc(p.name) + '</div>'
          + '<div class="directorItemKnown">Director</div>'
          + '</div>'
          + '</div>';
      }).join('');

      if (directors.length === 0) {
        results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--muted);">No directors found</div>';
      }
    } catch (e) {
      console.error('Director search failed:', e);
    }
  },

  setDirectorAvatar(imgUrl) {
    // Fetch image via proxy to avoid CORS issues
    const proxyUrl = 'https://image.tmdb.org/t/p/w185' + imgUrl.replace('https://image.tmdb.org/t/p/w185', '');
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      const compressed = canvas.toDataURL('image/jpeg', 0.8);
      localStorage.setItem('logit_avatar', compressed);
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) avatarEl.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
      this.syncAvatarToCloud(compressed);
      this.closeDirectorModal();
    };
    img.onerror = () => {
      // Fallback: just use the URL directly
      localStorage.setItem('logit_avatar', imgUrl);
      const avatarEl = document.getElementById('profileAvatar');
      if (avatarEl) avatarEl.innerHTML = '<img src="' + imgUrl + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
      this.syncAvatarToCloud(imgUrl);
      this.closeDirectorModal();
    };
    img.src = imgUrl;
  },

  async searchFavMovies(query) {
    console.log('Searching:', query);
    const API = Logit.Config.getApiKey();
    console.log('API key:', API ? 'exists' : 'missing');
    const results = document.getElementById('favSearchResults');
    if (!results || !API || !query) {
      console.log('Search aborted:', { results: !!results, API: !!API, query });
      if (results) results.innerHTML = '';
      return;
    }

    try {
      const data = await Logit.Search.tmdb('https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(query));
      if (!data || !data.results) return;

      results.innerHTML = data.results.slice(0, 6).map(m => {
        const poster = m.poster_path
          ? `<img src="https://image.tmdb.org/t/p/w185${m.poster_path}" alt="${m.title}">`
          : '';
        return `<div class="favSearchItem" data-id="${m.id}" data-title="${m.title}" data-poster="${m.poster_path || ''}">
          ${poster}
          <span>${m.title} (${(m.release_date || '').slice(0, 4)})</span>
        </div>`;
      }).join('');

      results.querySelectorAll('.favSearchItem').forEach(item => {
        item.addEventListener('click', () => {
          this._selectedFav = {
            id: item.dataset.id,
            t: item.dataset.title,
            poster: item.dataset.poster ? 'https://image.tmdb.org/t/p/w342' + item.dataset.poster : ''
          };
          const selected = document.getElementById('favSelected');
          const posterImg = document.getElementById('favSelectedPoster');
          const titleEl = document.getElementById('favSelectedTitle');
          if (selected) selected.style.display = 'flex';
          if (posterImg) posterImg.src = this._selectedFav.poster;
          if (titleEl) titleEl.textContent = this._selectedFav.t;
          const confirmBtn = document.getElementById('favConfirmBtn');
          if (confirmBtn) confirmBtn.disabled = false;
          results.innerHTML = '';
        });
      });
    } catch (e) {}
  },

  addFavorite() {
    if (!this._selectedFav) return;
    const favs = JSON.parse(localStorage.getItem('logit_favorites') || '[]');

    if (this._editingFavIndex !== null && this._editingFavIndex < favs.length) {
      // Edit existing
      favs[this._editingFavIndex] = this._selectedFav;
    } else {
      // Add new
      if (favs.length >= 4) return;
      favs.push(this._selectedFav);
    }

    localStorage.setItem('logit_favorites', JSON.stringify(favs));
    this.syncFavoritesToCloud(favs);
    this._editingFavIndex = null;
    this.closeFavModal();
    this.loadFavorites();
  },

  removeFavorite(index) {
    const favs = JSON.parse(localStorage.getItem('logit_favorites') || '[]');
    favs.splice(index, 1);
    localStorage.setItem('logit_favorites', JSON.stringify(favs));
    this.syncFavoritesToCloud(favs);
    this.loadFavorites();
  },

  changeFavPoster(index, fav) {
    const API = Logit.Config.getApiKey();
    if (!API) { alert('TMDB API key not set'); return; }
    // Extract poster path from URL
    const posterPath = fav.poster ? fav.poster.replace(/.*\/t\/p\/\w+/, '') : '';
    const movie = { tmdb_id: fav.id, sp: posterPath };
    Logit.PosterPicker.open(movie, API, (newPoster) => {
      const favs = JSON.parse(localStorage.getItem('logit_favorites') || '[]');
      if (favs[index]) {
        favs[index].poster = 'https://image.tmdb.org/t/p/w342' + newPoster;
        localStorage.setItem('logit_favorites', JSON.stringify(favs));
        this.syncFavoritesToCloud(favs);
        this.loadFavorites();
      }
    });
  },

  async syncFavoritesToCloud(favorites) {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      await client.from('settings').upsert({
        user_id: userId,
        favorites: favorites,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to sync favorites:', e);
    }
  },

  async loadFavoritesFromCloud() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      const { data } = await client.from('settings').select('favorites').eq('user_id', userId).single();
      if (data && data.favorites) {
        localStorage.setItem('logit_favorites', JSON.stringify(data.favorites));
      }
    } catch (e) {
      console.error('Failed to load favorites from cloud:', e);
    }
  },

  async syncAvatarToCloud(avatarData) {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      await client.from('settings').upsert({
        user_id: userId,
        avatar: avatarData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to sync avatar:', e);
    }
  },

  async clearAvatarFromCloud() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      await client.from('settings').upsert({
        user_id: userId,
        avatar: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to clear avatar:', e);
    }
  },

  async loadAvatarFromCloud() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      const { data } = await client.from('settings').select('avatar').eq('user_id', userId).single();
      if (data && data.avatar) {
        localStorage.setItem('logit_avatar', data.avatar);
      }
    } catch (e) {
      console.error('Failed to load avatar from cloud:', e);
    }
  },

  setupListeners() {
    const $ = (id) => document.getElementById(id);

    // Back
    if ($('backBtn')) $('backBtn').addEventListener('click', () => window.history.back());

    // Edit avatar - open director search
    if ($('editAvatarBtn')) $('editAvatarBtn').addEventListener('click', () => this.openDirectorModal());
    // Clear avatar
    if ($('clearAvatarBtn')) $('clearAvatarBtn').addEventListener('click', () => {
      if (!confirm('Remove avatar?')) return;
      localStorage.removeItem('logit_avatar');
      this.clearAvatarFromCloud();
      const avatarEl = $('profileAvatar');
      const user = this._user;
      const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
      if (avatarEl) avatarEl.innerHTML = username[0].toUpperCase();
    });
    if ($('avatarInput')) $('avatarInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Compress avatar to reduce localStorage usage
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 200; // max 200px
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          // Center crop
          const scale = Math.max(size / img.width, size / img.height);
          const x = (size - img.width * scale) / 2;
          const y = (size - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          const compressed = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
          localStorage.setItem('logit_avatar', compressed);
          const avatarEl = $('profileAvatar');
          if (avatarEl) avatarEl.innerHTML = '<img src="' + compressed + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">';
          // Sync to cloud
          this.syncAvatarToCloud(compressed);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
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
                const newMovie = Logit.MovieFactory.fromTMDB(detail, entry.r || 3, entry.w || '1st Watch', entry.d || Logit.Import.normalizeDate(null));
                movies.unshift(newMovie);
                imported++;
                if (typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
                  Logit.Offline.enqueue('create', 'movie', newMovie.id, newMovie);
                }
              } catch (err) { console.error('JSON slim import item error:', err); failed++; }
            }
            Logit.Storage.saveMovies(movies);
            if (statusEl) statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
            btn.disabled = false;
            if (typeof Logit.Sync !== 'undefined' && typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
              if (statusEl) statusEl.textContent = 'Syncing...';
              try { await Logit.Sync.pushToCloud(); } catch (e) { console.error('Cloud push failed:', e); }
            }
            setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1000);
            return;
          }
          let count = 0;
          const existingIds = new Set(movies.map(m => m.id));
          const existingTmdbIds = new Set(movies.map(m => m.tmdb_id || ''));
          arr.forEach(m => {
            if (!m.t && !m.id) return;
            if (existingIds.has(m.id)) return;
            if (m.tmdb_id && existingTmdbIds.has(m.tmdb_id)) return;
            movies.unshift(m);
            count++;
            if (typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
              Logit.Offline.enqueue('create', 'movie', m.id, m);
            }
          });
          Logit.Storage.saveMovies(movies);
          if (statusEl) statusEl.textContent = count + ' imported from JSON';
          if (typeof Logit.Sync !== 'undefined' && typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
            if (statusEl) statusEl.textContent = 'Syncing...';
            try { await Logit.Sync.pushToCloud(); } catch (e) { console.error('Cloud push failed:', e); }
          }
          setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1000);
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
          const watch = entry.rewatch ? 'Rewatch' : Logit.Movies.watchType(movies, detail.title || '');
          const newMovie = Logit.MovieFactory.fromTMDB(detail, entry.rating || 3, watch, Logit.Import.normalizeDate(entry.date));
          movies.unshift(newMovie);
          existingTmdbIds.add(tmdbId);
          imported++;
          if (typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
            Logit.Offline.enqueue('create', 'movie', newMovie.id, newMovie);
          }
        } catch (err) { console.error('Text import item error:', err); failed++; }
      }
      Logit.Storage.saveMovies(movies);
      if (statusEl) statusEl.textContent = imported + ' imported' + (skipped > 0 ? ', ' + skipped + ' skipped' : '') + (failed > 0 ? ', ' + failed + ' failed' : '');
      btn.disabled = false;
      if (typeof Logit.Sync !== 'undefined' && typeof Logit.Auth !== 'undefined' && !Logit.Auth.isOfflineMode()) {
        if (statusEl) statusEl.textContent = 'Syncing...';
        try { await Logit.Sync.pushToCloud(); } catch (e) { console.error('Cloud push failed:', e); }
      }
      setTimeout(() => { Logit.Utils.closeModal($('importModal')); this.updateStorageInfo(); this.updateSyncCounts(); }, 1000);
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

    // Auto Sync toggle (always enabled, no persistence)
    const autoSyncToggle = $('autoSyncToggle');
    if (autoSyncToggle) {
      autoSyncToggle.classList.add('active');
    }

    // Favorite movies
    if ($('addFavBtn')) $('addFavBtn').addEventListener('click', () => this.openFavModal());
    if ($('favModalClose')) $('favModalClose').addEventListener('click', () => this.closeFavModal());
    if ($('favSearchInput')) $('favSearchInput').addEventListener('input', (e) => {
      clearTimeout(this._favSearchTimeout);
      this._favSearchTimeout = setTimeout(() => this.searchFavMovies(e.target.value), 300);
    });
    if ($('favConfirmBtn')) $('favConfirmBtn').addEventListener('click', () => this.addFavorite());
    if ($('favRemoveSelect')) $('favRemoveSelect').addEventListener('click', () => {
      this._selectedFav = null;
      const selected = $('favSelected');
      if (selected) selected.style.display = 'none';
      const confirmBtn = $('favConfirmBtn');
      if (confirmBtn) confirmBtn.disabled = true;
    });

    // Director avatar
    if ($('directorModalClose')) $('directorModalClose').addEventListener('click', () => this.closeDirectorModal());
    if ($('directorSearchInput')) $('directorSearchInput').addEventListener('input', (e) => {
      clearTimeout(this._directorSearchTimeout);
      this._directorSearchTimeout = setTimeout(() => this.searchDirectors(e.target.value), 300);
    });

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
