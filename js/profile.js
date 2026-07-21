window.Logit = window.Logit || {};

Logit.ProfilePage = {
  _user: null,
  _movies: [],
  _favorites: [],

  _setAvatar(url) {
    var avatarEl = document.getElementById('profileAvatar');
    if (!avatarEl) return;
    avatarEl.textContent = '';
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;';
    avatarEl.appendChild(img);
  },

  async init() {
    try {
      await this.checkAuth();
      if (!this._user) { window.location.href = 'welcome.html'; return; }
    } catch (e) { window.location.href = 'welcome.html'; return; }

    try {
      this.setupListeners();
      this.setupTabs();
      this.loadProfile();
      await this.loadAvatarFromCloud();
      await this.loadMoviesFromCloud();
      this.loadStats();
      await this.loadFavoritesFromCloud();
      this.loadFavorites();
      this.updateStorageInfo();
    } catch (e) { console.error('Profile init error:', e); }
  },

  async checkAuth() {
    this._user = null;
    try {
      var client = Logit.Supabase.getClient();
      if (client) {
        var { data: { user } } = await client.auth.getUser();
        if (user) this._user = user;
      }
    } catch (e) { /* silent */ }
  },

  async loadMoviesFromCloud() {
    try { this._movies = await Logit.Storage.loadMovies(); } catch (e) { this._movies = []; }
  },

  loadProfile() {
    var user = this._user;
    var nameEl = document.getElementById('profileName');
    var avatarEl = document.getElementById('profileAvatar');

    if (user) {
      var username = user.user_metadata && user.user_metadata.username || (user.email || '').split('@')[0] || 'User';
      if (nameEl) nameEl.textContent = username;
      // Only set initial letter if no avatar loaded yet
      if (avatarEl && !avatarEl.querySelector('img')) {
        avatarEl.textContent = username[0].toUpperCase();
      }
    }
  },

  async updateStorageInfo() {
    try {
      var usage = await Logit.Storage.getCloudStorageUsage();
      var countEl = document.getElementById('moviesCount');
      var usageEl = document.getElementById('cloudStorageUsage');
      if (countEl) countEl.textContent = usage.count;
      if (usageEl) usageEl.textContent = usage.formatted + ' / 500 MB';
    } catch (e) {}
  },

  async loadStats() {
    var movies = this._movies;
    var stats = Logit.StatUtils.aggregate(movies);

    var filmsEl = document.getElementById('statFilms');
    if (filmsEl) filmsEl.textContent = movies.length;

    var ratedMovies = movies.filter(function(m) { return Number(m.r) > 0; });
    var avgRating = ratedMovies.length > 0
      ? (ratedMovies.reduce(function(a, b) { return a + Number(b.r); }, 0) / ratedMovies.length).toFixed(1)
      : '0.0';
    var ratingEl = document.getElementById('statRating');
    if (ratingEl) ratingEl.textContent = avgRating;

    var rewatchCount = movies.filter(function(m) { return Logit.Utils.isRewatch(m); }).length;
    var rewatchEl = document.getElementById('statRewatch');
    if (rewatchEl) rewatchEl.textContent = rewatchCount;

    var totalMins = movies.reduce(function(a, b) { return a + (Number(b.rt) || 0); }, 0);
    var hours = Math.round(totalMins / 60);
    var hoursEl = document.getElementById('statHours');
    if (hoursEl) hoursEl.textContent = hours;

    var statTotalFilms = document.getElementById('statTotalFilms');
    var statAvgRating = document.getElementById('statAvgRating');
    var statTotalRewatch = document.getElementById('statTotalRewatch');
    var statTotalHours = document.getElementById('statTotalHours');
    if (statTotalFilms) statTotalFilms.textContent = movies.length;
    if (statAvgRating) statAvgRating.textContent = avgRating;
    if (statTotalRewatch) statTotalRewatch.textContent = rewatchCount;
    if (statTotalHours) statTotalHours.textContent = hours;
  },

  setupTabs() {
    var tabs = document.querySelectorAll('.profileTab');
    var panels = document.querySelectorAll('.tabPanel');
    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        var target = tab.dataset.tab;
        tabs.forEach(function(t) { t.classList.remove('active'); });
        panels.forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panel = document.getElementById('panel-' + target);
        if (panel) panel.classList.add('active');
      });
    });
  },

  // ========= FAVORITES (stored in settings table) =========
  async loadFavoritesFromCloud() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      var { data } = await client.from('settings').select('favorites').eq('user_id', userId).single();
      if (data && data.favorites) {
        this._favorites = data.favorites;
      } else {
        this._favorites = [];
      }
    } catch (e) {
      this._favorites = [];
    }
  },

  loadFavorites() {
    var favs = this._favorites || [];
    var grid = document.getElementById('favFilmsGrid');
    if (!grid) return;
    var self = this;

    var fragment = document.createDocumentFragment();
    for (var i = 0; i < 4; i++) {
      if (favs[i]) {
        var card = document.createElement('div');
        card.className = 'favPoster';
        card.dataset.index = i;
        card.title = (favs[i].t || '') + ' - Click to change';
        card.innerHTML = '<img src="' + Logit.Utils.esc(favs[i].poster || '') + '" alt="' + Logit.Utils.esc(favs[i].t || '') + '">'
          + '<button class="favRemove" data-index="' + i + '">&times;</button>';
        card.addEventListener('click', (function(idx) {
          return function(e) {
            if (e.target.classList.contains('favRemove')) return;
            var fav = self._favorites[idx];
            if (fav && fav.id) self.changeFavPoster(idx, fav);
          };
        })(i));
        card.querySelector('.favRemove').addEventListener('click', (function(idx) {
          return function(e) { e.stopPropagation(); self.removeFavorite(idx); };
        })(i));
        fragment.append(card);
      } else {
        var placeholder = document.createElement('div');
        placeholder.className = 'favPosterPlaceholder';
        placeholder.dataset.slot = i;
        placeholder.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Add</span>';
        placeholder.addEventListener('click', function() { self._editingFavIndex = null; self.openFavModal(); });
        fragment.append(placeholder);
      }
    }
    grid.textContent = '';
    grid.append(fragment);
  },

  openFavModal() {
    var modal = document.getElementById('favModal');
    if (modal) {
      modal.classList.add('active');
      var input = document.getElementById('favSearchInput');
      if (input) { input.value = ''; input.focus(); }
      this._selectedFav = null;
      var selected = document.getElementById('favSelected');
      if (selected) selected.style.display = 'none';
      var results = document.getElementById('favSearchResults');
      if (results) results.innerHTML = '';
      var confirmBtn = document.getElementById('favConfirmBtn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = this._editingFavIndex !== null ? 'Change Poster' : 'Add to Favorites';
      }
    }
  },

  closeFavModal() {
    var modal = document.getElementById('favModal');
    if (modal) modal.classList.remove('active');
  },

  async searchFavMovies(query) {
    var API = Logit.Config.getApiKey();
    var results = document.getElementById('favSearchResults');
    if (!results || !API || !query) { if (results) results.innerHTML = ''; return; }

    try {
      var data = await Logit.Search.tmdb('https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(query));
      if (!data || !data.results) return;
      var self = this;
      var fragment = document.createDocumentFragment();
      data.results.slice(0, 6).forEach(function(m) {
        var item = document.createElement('div');
        item.className = 'favSearchItem';
        item.dataset.id = m.id;
        item.dataset.title = m.title;
        item.dataset.poster = m.poster_path || '';
        var poster = m.poster_path ? '<img src="https://image.tmdb.org/t/p/w185' + m.poster_path + '" alt="' + Logit.Utils.esc(m.title) + '">' : '';
        item.innerHTML = poster + '<span>' + Logit.Utils.esc(m.title) + ' (' + (m.release_date || '').slice(0, 4) + ')</span>';
        item.addEventListener('click', function() {
          self._selectedFav = {
            id: item.dataset.id,
            t: item.dataset.title,
            poster: item.dataset.poster ? 'https://image.tmdb.org/t/p/w342' + item.dataset.poster : ''
          };
          var sel = document.getElementById('favSelected');
          var posterImg = document.getElementById('favSelectedPoster');
          var titleEl = document.getElementById('favSelectedTitle');
          if (sel) sel.style.display = 'flex';
          if (posterImg) posterImg.src = self._selectedFav.poster;
          if (titleEl) titleEl.textContent = self._selectedFav.t;
          var confirmBtn = document.getElementById('favConfirmBtn');
          if (confirmBtn) confirmBtn.disabled = false;
          results.textContent = '';
        });
        fragment.append(item);
      });
      results.textContent = '';
      results.append(fragment);
    } catch (e) {}
  },

  async addFavorite() {
    if (!this._selectedFav) return;
    var favs = this._favorites || [];

    if (this._editingFavIndex !== null && this._editingFavIndex < favs.length) {
      favs[this._editingFavIndex] = this._selectedFav;
    } else {
      if (favs.length >= 4) return;
      favs.push(this._selectedFav);
    }

    this._favorites = favs;
    await this.syncFavoritesToCloud(favs);
    this._editingFavIndex = null;
    this.closeFavModal();
    this.loadFavorites();
  },

  async removeFavorite(index) {
    var favs = this._favorites || [];
    favs.splice(index, 1);
    this._favorites = favs;
    await this.syncFavoritesToCloud(favs);
    this.loadFavorites();
  },

  changeFavPoster(index, fav) {
    var API = Logit.Config.getApiKey();
    if (!API) { alert('TMDB API key not set'); return; }
    var posterPath = fav.poster ? fav.poster.replace(/.*\/t\/p\/\w+/, '') : '';
    var movie = { tmdb_id: fav.id, sp: posterPath };
    var self = this;
    Logit.PosterPicker.open(movie, API, async function(newPoster) {
      var favs = self._favorites || [];
      if (favs[index]) {
        favs[index].poster = 'https://image.tmdb.org/t/p/w342' + newPoster;
        self._favorites = favs;
        await self.syncFavoritesToCloud(favs);
        self.loadFavorites();
      }
    });
  },

  async syncFavoritesToCloud(favorites) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
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

  // ========= AVATAR =========
  async loadAvatarFromCloud() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      var { data, error } = await client.from('settings').select('avatar').eq('user_id', userId).single();
      if (error) { console.warn('Avatar load error:', error.message); return; }
      if (data && data.avatar) {
        this._setAvatar(data.avatar);
      }
    } catch (e) { console.warn('Avatar load failed:', e); }
  },

  async syncAvatarToCloud(avatarData) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) { console.warn('Avatar sync: no client or userId'); return; }
    try {
      var { error } = await client.from('settings').upsert({
        user_id: userId,
        avatar: avatarData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) console.warn('Avatar sync error:', error.message);
    } catch (e) { console.warn('Avatar sync failed:', e); }
  },

  async clearAvatarFromCloud() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;
    try {
      await client.from('settings').upsert({
        user_id: userId,
        avatar: null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {}
  },

  // ========= LISTENERS =========
  setupListeners() {
    var $ = function(id) { return document.getElementById(id); };
    var self = this;

    if ($('backBtn')) $('backBtn').addEventListener('click', function() { window.history.back(); });

    if ($('editAvatarBtn')) $('editAvatarBtn').addEventListener('click', function() { self.openDirectorModal(); });

    if ($('clearAvatarBtn')) $('clearAvatarBtn').addEventListener('click', function() {
      if (!confirm('Remove avatar?')) return;
      self.clearAvatarFromCloud();
      var user = self._user;
      var username = user && user.user_metadata && user.user_metadata.username || 'User';
      var avatarEl = $('profileAvatar');
      if (avatarEl) {
        avatarEl.textContent = '';
        avatarEl.textContent = username[0].toUpperCase();
      }
    });

    if ($('avatarInput')) $('avatarInput').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var size = 200;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          var scale = Math.max(size / img.width, size / img.height);
          var x = (size - img.width * scale) / 2;
          var y = (size - img.height * scale) / 2;
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
          var compressed = canvas.toDataURL('image/jpeg', 0.7);
          self._setAvatar(compressed);
          self.syncAvatarToCloud(compressed);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    if ($('editUsernameBtn')) $('editUsernameBtn').addEventListener('click', async function() {
      var current = ($('profileName') || {}).textContent;
      var newName = prompt('Enter new username:', current);
      if (!newName || newName === current) return;
      var client = Logit.Supabase.getClient();
      if (client && self._user) {
        var { error } = await client.auth.updateUser({ data: { username: newName } });
        if (error) { alert(error.message); return; }
        await client.from('users').upsert({ id: self._user.id, email: self._user.email, username: newName }, { onConflict: 'id' });
      }
      if ($('profileName')) $('profileName').textContent = newName;
    });

    // Import / Export
    if ($('exportBtn')) $('exportBtn').addEventListener('click', function() { Logit.Utils.openModal($('exportModal')); });
    if ($('exportJsonBtn')) $('exportJsonBtn').addEventListener('click', async function() {
      var movies = await Logit.Storage.loadMovies();
      Logit.Export.doExport(movies, 'json', function() { Logit.Utils.closeModal($('exportModal')); });
    });
    if ($('exportTxtBtn')) $('exportTxtBtn').addEventListener('click', async function() {
      var movies = await Logit.Storage.loadMovies();
      Logit.Export.doExport(movies, 'txt', function() { Logit.Utils.closeModal($('exportModal')); });
    });
    if ($('exportCancelBtn')) $('exportCancelBtn').addEventListener('click', function() { Logit.Utils.closeModal($('exportModal')); });

    if ($('importBtn')) $('importBtn').addEventListener('click', function() {
      Logit.Utils.openModal($('importModal'));
      var t = $('importText'); if (t) t.value = '';
      var s = $('importStatus'); if (s) s.textContent = '';
      if (t) t.focus();
    });
    if ($('importModalClose')) $('importModalClose').addEventListener('click', function() { Logit.Utils.closeModal($('importModal')); });
    if ($('fileInput')) $('fileInput').addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var t = $('importText'); var s = $('importStatus');
        if (t) t.value = ev.target.result;
        if (s) s.textContent = 'File loaded: ' + file.name;
      };
      reader.readAsText(file);
    });

    if ($('importStartBtn')) $('importStartBtn').onclick = async function() {
      var text = ($('importText') || {}).value;
      if (!text || !text.trim()) return;
      var API = Logit.Config.getApiKey();
      var movies = await Logit.Storage.loadMovies();
      var statusEl = $('importStatus');
      var btn = $('importStartBtn');

      if (text.trim().charAt(0) === '[' || text.trim().charAt(0) === '{') {
        try {
          var parsed = JSON.parse(text);
          var arr = Array.isArray(parsed) ? parsed : (parsed.movies || []);
          if (Logit.Import.isSlimExport(arr)) {
            if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required.'; return; }
            btn.disabled = true;
            var existingTmdbIds = new Set(movies.map(function(m) { return m.tmdb_id || ''; }));
            var imported = 0, failed = 0;
            for (var i = 0; i < arr.length; i++) {
              var entry = arr[i];
              if ((!entry.t && !entry.id) || !entry.tmdb_id) { failed++; continue; }
              if (existingTmdbIds.has(entry.tmdb_id)) continue;
              if (statusEl) statusEl.textContent = 'Fetching ' + (i + 1) + '/' + arr.length;
              try {
                var detail = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + entry.tmdb_id + '?api_key=' + API + '&append_to_response=credits,images');
                if (!detail) { failed++; continue; }
                var newMovie = Logit.MovieFactory.fromTMDB(detail, entry.r || 3, entry.w || '1st Watch', entry.d || Logit.Import.normalizeDate(null));
                await Logit.Storage.saveMovie(newMovie, 'create');
                movies.unshift(newMovie);
                imported++;
              } catch (err) { failed++; }
            }
            if (statusEl) statusEl.textContent = imported + ' imported' + (failed > 0 ? ', ' + failed + ' failed' : '');
            btn.disabled = false;
            setTimeout(function() { Logit.Utils.closeModal($('importModal')); self.updateStorageInfo(); }, 1000);
            return;
          }
          var count = 0;
          var existingIds = new Set(movies.map(function(m) { return m.id; }));
          var existingTmdbIds2 = new Set(movies.map(function(m) { return m.tmdb_id || ''; }));
          for (var j = 0; j < arr.length; j++) {
            var m = arr[j];
            if (!m.t && !m.id) continue;
            if (existingIds.has(m.id)) continue;
            if (m.tmdb_id && existingTmdbIds2.has(m.tmdb_id)) continue;
            await Logit.Storage.saveMovie(m, 'create');
            movies.unshift(m);
            count++;
          }
          if (statusEl) statusEl.textContent = count + ' imported from JSON';
          setTimeout(function() { Logit.Utils.closeModal($('importModal')); self.updateStorageInfo(); }, 1000);
          return;
        } catch (err) { if (statusEl) statusEl.textContent = 'Invalid JSON'; return; }
      }

      if (!API) { if (statusEl) statusEl.textContent = 'TMDB API key required.'; return; }
      var lines = text.split('\n').filter(function(l) { return l.trim(); });
      if (lines.length === 0) { if (statusEl) statusEl.textContent = 'No valid lines found'; return; }
      btn.disabled = true;
      var imported2 = 0, failed2 = 0, skipped = 0;
      var existingTmdbIds3 = new Set(movies.filter(function(m) { return m.tmdb_id; }).map(function(m) { return String(m.tmdb_id); }));
      for (var k = 0; k < lines.length; k++) {
        var entry2 = Logit.Import.parseLine(lines[k]);
        if (!entry2) { failed2++; continue; }
        if (statusEl) statusEl.textContent = 'Importing ' + (k + 1) + '/' + lines.length;
        try {
          var tmdbId = entry2.tmdbId || '';
          if (!tmdbId && entry2.imdbId) {
            var fd = await Logit.Search.tmdb('https://api.themoviedb.org/3/find/' + entry2.imdbId + '?api_key=' + API + '&external_source=imdb_id');
            if (fd && fd.movie_results && fd.movie_results.length > 0) tmdbId = String(fd.movie_results[0].id);
          }
          if (!tmdbId && entry2.title) {
            var sUrl = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(entry2.title);
            if (entry2.year) sUrl += '&year=' + entry2.year;
            var sd = await Logit.Search.tmdb(sUrl);
            if (sd && sd.results && sd.results.length > 0) tmdbId = String(sd.results[0].id);
          }
          if (!tmdbId) { failed2++; continue; }
          if (existingTmdbIds3.has(tmdbId)) { skipped++; continue; }
          var detail2 = await Logit.Search.tmdb('https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + API + '&append_to_response=credits,images');
          if (!detail2) { failed2++; continue; }
          var watch = entry2.rewatch ? 'Rewatch' : Logit.Movies.watchType(movies, detail2.title || '');
          var newMovie2 = Logit.MovieFactory.fromTMDB(detail2, entry2.rating || 3, watch, Logit.Import.normalizeDate(entry2.date));
          await Logit.Storage.saveMovie(newMovie2, 'create');
          movies.unshift(newMovie2);
          existingTmdbIds3.add(tmdbId);
          imported2++;
        } catch (err2) { failed2++; }
      }
      if (statusEl) statusEl.textContent = imported2 + ' imported' + (skipped > 0 ? ', ' + skipped + ' skipped' : '') + (failed2 > 0 ? ', ' + failed2 + ' failed' : '');
      btn.disabled = false;
      setTimeout(function() { Logit.Utils.closeModal($('importModal')); self.updateStorageInfo(); }, 1000);
    };

    // Account
    if ($('changePasswordBtn')) $('changePasswordBtn').addEventListener('click', async function() {
      var currentPass = prompt('Enter current password:');
      if (!currentPass) return;
      var newPass = prompt('Enter new password (6+ characters):');
      if (!newPass || newPass.length < 6) { alert('Password must be 6+ characters'); return; }
      var client = Logit.Supabase.getClient();
      if (!client) { alert('Not connected'); return; }
      var user = await client.auth.getUser();
      var email = user.data && user.data.user && user.data.user.email;
      if (!email) { alert('Not logged in'); return; }
      var { error: loginError } = await client.auth.signInWithPassword({ email: email, password: currentPass });
      if (loginError) { alert('Current password is wrong'); return; }
      var { error } = await client.auth.updateUser({ password: newPass });
      if (error) { alert(error.message); return; }
      alert('Password updated!');
    });

    if ($('signOutBtn')) $('signOutBtn').addEventListener('click', function() {
      if (confirm('Sign out?')) Logit.Auth.signOut();
    });

    if ($('deleteAccountBtn')) $('deleteAccountBtn').addEventListener('click', function() { self.deleteAccount(); });

    if ($('clearDataBtn')) $('clearDataBtn').addEventListener('click', async function() {
      if (!confirm('Delete ALL data from cloud?')) return;
      if (!confirm('This cannot be undone. Continue?')) return;
      var client = Logit.Supabase.getClient();
      var userId = localStorage.getItem('logit_user_id');
      if (client && userId) {
        await client.from('movies').delete().eq('user_id', userId);
      }
      alert('All movie data cleared.');
      location.reload();
    });

    // Favorite movies
    if ($('favModalClose')) $('favModalClose').addEventListener('click', function() { self.closeFavModal(); });
    if ($('favSearchInput')) $('favSearchInput').addEventListener('input', function(e) {
      clearTimeout(self._favSearchTimeout);
      self._favSearchTimeout = setTimeout(function() { self.searchFavMovies(e.target.value); }, 300);
    });
    if ($('favConfirmBtn')) $('favConfirmBtn').addEventListener('click', function() { self.addFavorite(); });
    if ($('favRemoveSelect')) $('favRemoveSelect').addEventListener('click', function() {
      self._selectedFav = null;
      var selected = $('favSelected');
      if (selected) selected.style.display = 'none';
      var confirmBtn = $('favConfirmBtn');
      if (confirmBtn) confirmBtn.disabled = true;
    });

    // Director avatar
    if ($('directorModalClose')) $('directorModalClose').addEventListener('click', function() { self.closeDirectorModal(); });
    if ($('directorSearchInput')) $('directorSearchInput').addEventListener('input', function(e) {
      clearTimeout(self._directorSearchTimeout);
      self._directorSearchTimeout = setTimeout(function() { self.searchDirectors(e.target.value); }, 300);
    });
    var directorResults = $('directorResults');
    if (directorResults) {
      directorResults.addEventListener('click', function(e) {
        var item = e.target.closest('.directorItem');
        if (item) {
          var url = item.getAttribute('data-url');
          if (url) self.setDirectorAvatar(url);
        }
      });
    }
  },

  openDirectorModal() {
    var modal = document.getElementById('directorModal');
    if (modal) {
      modal.classList.add('active');
      var input = document.getElementById('directorSearchInput');
      if (input) { input.value = ''; input.focus(); }
      var results = document.getElementById('directorResults');
      if (results) results.innerHTML = '';
    }
  },

  closeDirectorModal() {
    var modal = document.getElementById('directorModal');
    if (modal) modal.classList.remove('active');
  },

  async searchDirectors(query) {
    var API = Logit.Config.getApiKey();
    var results = document.getElementById('directorResults');
    if (!results || !API || !query || query.length < 2) { if (results) results.innerHTML = ''; return; }

    try {
      var data = await Logit.Search.tmdb('https://api.themoviedb.org/3/search/person?api_key=' + API + '&query=' + encodeURIComponent(query));
      if (!data || !data.results) return;
      var directors = data.results.filter(function(p) { return p.known_for_department === 'Directing' && p.profile_path; });
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < Math.min(directors.length, 8); i++) {
        var p = directors[i];
        var imgUrl = 'https://image.tmdb.org/t/p/w185' + p.profile_path;
        var item = document.createElement('div');
        item.className = 'directorItem';
        item.setAttribute('data-url', imgUrl);
        item.innerHTML = '<img src="' + imgUrl + '" alt="' + Logit.Utils.esc(p.name) + '"><div class="directorItemInfo"><div class="directorItemName">' + Logit.Utils.esc(p.name) + '</div><div class="directorItemKnown">Director</div></div>';
        fragment.append(item);
      }
      results.textContent = '';
      if (directors.length === 0) {
        var noRes = document.createElement('div');
        noRes.style.cssText = 'text-align:center;padding:20px;color:var(--muted);';
        noRes.textContent = 'No directors found';
        results.append(noRes);
      } else {
        results.append(fragment);
      }
    } catch (e) {}
  },

  async setDirectorAvatar(imgUrl) {
    this._setAvatar(imgUrl);
    await this.syncAvatarToCloud(imgUrl);
    this.closeDirectorModal();
  },

  async deleteAccount() {
    if (!confirm('Delete your account? Your data will be kept for 30 days for recovery.')) return;
    if (!confirm('After 30 days, all data will be permanently deleted. Continue?')) return;
    try {
      var client = Logit.Supabase.getClient();
      var userId = localStorage.getItem('logit_user_id');
      if (client && userId) {
        await client.from('users').upsert({
          id: userId,
          deleted_at: new Date().toISOString()
        }, { onConflict: 'id' });
      }
      localStorage.clear();
      if (client) await client.auth.signOut();
      alert('Account marked for deletion. Data will be permanently deleted after 30 days.');
      window.location.href = 'welcome.html';
    } catch (e) { alert('Delete failed: ' + e.message); }
  }
};
