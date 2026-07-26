window.Logit = window.Logit || {};

Logit.ListPage = {
  pendingMovies: [],
  currentResults: [],
  currentModalIndex: -1,
  rawFileContent: '',
  currentFileId: '',

  init: function() {
    this.libraryEl = document.getElementById('library');
    this.listSection = document.getElementById('listSection');
    this.navLibrary = document.getElementById('navLibrary');
    this.navList = document.getElementById('navList');
    this.pcListBtn = document.getElementById('pcListBtn');
    this.posterBg = document.getElementById('posterBg');
    this.driveConnectBtn = document.getElementById('driveConnectBtn');
    this.listEmpty = document.getElementById('listEmpty');
    this.listItems = document.getElementById('listItems');
    this.pcListBadge = document.getElementById('pcListBadge');
    this.navListBadge = document.getElementById('navListBadge');

    // Modal elements
    this.listModal = document.getElementById('listModal');
    this.listModalClose = document.getElementById('listModalClose');
    this.listModalImg = document.getElementById('listModalImg');
    this.listModalTitle = document.getElementById('listModalTitle');
    this.listModalMeta = document.getElementById('listModalMeta');
    this.listModalDesc = document.getElementById('listModalDesc');
    this.listModalRatingInput = document.getElementById('listModalRatingInput');
    this.listModalDateInput = document.getElementById('listModalDateInput');
    this.listModalOriginalLine = document.getElementById('listModalOriginalLine');
    this.listModalSearchInput = document.getElementById('listModalSearchInput');
    this.listModalResults = document.getElementById('listModalResults');
    this.listModalAccept = document.getElementById('listModalAccept');
    this.listModalReject = document.getElementById('listModalReject');

    this.bindEvents();
    this.checkUrlHash();
  },

  bindEvents: function() {
    var self = this;

    if (this.navList) {
      this.navList.addEventListener('click', function() {
        if (self.listSection.style.display === 'block') {
          self.showLibrary();
        } else {
          self.showList();
        }
      });
    }

    if (this.pcListBtn) {
      this.pcListBtn.addEventListener('click', function() {
        self.showList();
      });
    }

    if (this.navLibrary) {
      this.navLibrary.addEventListener('click', function(e) {
        e.preventDefault();
        self.showLibrary();
      });
    }

    if (this.driveConnectBtn) {
      this.driveConnectBtn.addEventListener('click', function() {
        self.connectDrive();
      });
    }

    if (this.listModalClose) {
      this.listModalClose.addEventListener('click', function() {
        self.closeModal();
      });
    }

    if (this.listModal) {
      this.listModal.addEventListener('click', function(e) {
        if (e.target === self.listModal) self.closeModal();
      });
    }

    if (this.listModalAccept) {
      this.listModalAccept.addEventListener('click', function() {
        self.acceptCurrentMovie();
      });
    }

    if (this.listModalReject) {
      this.listModalReject.addEventListener('click', function() {
        self.rejectCurrentMovie();
      });
    }

    if (this.listModalSearchInput) {
      var debounce;
      this.listModalSearchInput.addEventListener('input', function() {
        clearTimeout(debounce);
        debounce = setTimeout(function() {
          self.searchAlternative();
        }, 400);
      });
    }
  },

  checkUrlHash: function() {
    if (window.location.hash === '#list') {
      this.showList();
    }
  },

  showList: function() {
    this.libraryEl.style.display = 'none';
    this.listSection.style.display = 'block';
    if (this.posterBg) this.posterBg.classList.remove('active');

    this.navLibrary.classList.remove('on');
    this.navList.classList.add('on');

    var pcBtns = document.querySelectorAll('.pcNavBtn');
    pcBtns.forEach(function(btn) { btn.classList.remove('active'); });
    if (this.pcListBtn) this.pcListBtn.classList.add('active');

    window.location.hash = 'list';
  },

  showLibrary: function() {
    this.libraryEl.style.display = '';
    this.listSection.style.display = 'none';

    this.navLibrary.classList.add('on');
    this.navList.classList.remove('on');

    var pcBtns = document.querySelectorAll('.pcNavBtn');
    pcBtns.forEach(function(btn) { btn.classList.remove('active'); });
    pcBtns[0].classList.add('active');

    window.location.hash = '';
  },

  extractId: function(url) {
    var folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) return { type: 'folder', id: folderMatch[1] };

    var patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]+)/,
      /\/open\?id=([a-zA-Z0-9_-]+)/,
      /\/uc\?.*id=([a-zA-Z0-9_-]+)/,
      /^([a-zA-Z0-9_-]{20,})$/
    ];
    for (var i = 0; i < patterns.length; i++) {
      var match = url.match(patterns[i]);
      if (match) return { type: 'file', id: match[1] };
    }
    return null;
  },

  async connectDrive() {
    var url = localStorage.getItem('logit_drive_link');
    if (!url) {
      alert('Set your Drive folder link in About → Obsidian Sync first.');
      return;
    }

    var extracted = this.extractId(url);
    if (!extracted) { alert('Invalid Google Drive link. Check your link in About.'); return; }

    this.driveConnectBtn.textContent = 'Syncing...';
    this.driveConnectBtn.disabled = true;

    try {
      var content;
      if (extracted.type === 'folder') {
        content = await this.fetchFromFolder(extracted.id);
      } else {
        content = await this.fetchDriveFile(extracted.id);
      }
      if (!content) throw new Error('Could not fetch file');
      this.rawFileContent = content;
      this.parseMarkdown(content);
    } catch (e) {
      alert('Failed to load: ' + e.message);
    } finally {
      this.driveConnectBtn.textContent = 'Sync from Drive';
      this.driveConnectBtn.disabled = false;
    }
  },

  async fetchDriveFile(fileId) {
    var token = localStorage.getItem('logit_drive_token');
    var headers = {};
    var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';
    
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    } else {
      var apiKey = localStorage.getItem('google_api_key');
      if (apiKey) {
        url += '&key=' + apiKey;
      } else {
        throw new Error('No API key or Google account connected');
      }
    }
    
    var res = await fetch(url, { headers: headers });
    if (!res.ok) {
      if (res.status === 401 && token) {
        localStorage.removeItem('logit_drive_token');
        throw new Error('Google Drive session expired. Please reconnect in Profile settings.');
      }
      throw new Error('Drive API returned ' + res.status);
    }
    return await res.text();
  },

  async fetchFromFolder(folderId) {
    var token = localStorage.getItem('logit_drive_token');
    var headers = {};
    var q = encodeURIComponent("'" + folderId + "' in parents and mimeType = 'text/markdown' and trashed = false");
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)';
    
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    } else {
      var apiKey = localStorage.getItem('google_api_key');
      if (apiKey) {
        url += '&key=' + apiKey;
      } else {
        throw new Error('Set your Google API key or connect Google Drive in Settings first.');
      }
    }

    var res = await fetch(url, { headers: headers });
    if (!res.ok) throw new Error('Drive API returned ' + res.status);
    var data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }

    if (!data.files || data.files.length === 0) {
      throw new Error('No .md files found in folder.');
    }

    this.currentFileId = data.files[0].id;
    return await this.fetchDriveFile(data.files[0].id);
  },

  parseMarkdown(content) {
    var lines = content.split('\n').filter(function(l) { return l.trim(); });
    var movies = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('✅') || line.startsWith('[x]') || line.startsWith('{')) continue;
      var parsed = Logit.Import.parseLine(line);
      if (parsed && parsed.title) {
        parsed.originalLine = line;
        movies.push(parsed);
      }
    }

    if (movies.length === 0) {
      this.listItems.innerHTML = '<p class="listMessage">All movies imported or no movies found</p>';
      this.listEmpty.style.display = 'none';
      return;
    }

    this.listEmpty.style.display = 'none';
    this.pendingMovies = movies;
    this.updateBadge();
    this.searchTMDB(movies);
  },

  async searchTMDB(movies) {
    var API = Logit.Config.getApiKey();
    if (!API) {
      this.listItems.innerHTML = '<p class="listMessage">TMDB API key not set. Go to About → API Keys.</p>';
      return;
    }

    this.listItems.innerHTML = '<p class="listMessage">Searching ' + movies.length + ' movies...</p>';

    var results = [];
    for (var i = 0; i < movies.length; i++) {
      var m = movies[i];
      try {
        var url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(m.title);
        if (m.year) url += '&year=' + m.year;
        var data = await Logit.Search.tmdb(url);
        if (data && data.results && data.results.length > 0) {
          var tmdb = data.results[0];
          for (var j = 0; j < data.results.length; j++) {
            var rTitle = data.results[j].title.toLowerCase();
            var sTitle = m.title.toLowerCase();
            if (rTitle === sTitle || rTitle.startsWith(sTitle) || sTitle.startsWith(rTitle)) {
              tmdb = data.results[j];
              break;
            }
          }
          results.push({
            tmdb: tmdb,
            rating: m.rating || 3,
            date: m.date || '',
            watch: m.rewatch ? 'Rewatch' : '1st Watch',
            originalLine: m.originalLine
          });
        }
      } catch (e) {
        console.warn('[List] Search failed for:', m.title, e);
      }
    }

    this.currentResults = results;
    this.renderList(results);
  },

  renderList(results) {
    this.listItems.innerHTML = '';
    this.listEmpty.style.display = 'none';

    if (results.length === 0) {
      this.listItems.innerHTML = '<p class="listMessage">No matches found</p>';
      return;
    }

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var t = r.tmdb;
      var poster = t.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + t.poster_path
        : 'https://placehold.co/342x513/1a1a1a/333?text=No+Poster';

      var year = t.release_date ? t.release_date.substring(0, 4) : '';
      var html = '<div class="listItem" data-index="' + i + '">'
        + '<img class="listItemPoster" src="' + poster + '" alt="">'
        + '<div class="listItemOverlay">'
        + '<div class="listItemTitle">' + Logit.Utils.esc(t.title) + '</div>'
        + '<div class="listItemMeta">' + (year ? year + ' &middot; ' : '') + r.rating + '/5</div>'
        + '</div>'
        + '</div>';

      this.listItems.insertAdjacentHTML('beforeend', html);
    }

    var self = this;
    this.listItems.querySelectorAll('.listItem').forEach(function(item) {
      item.addEventListener('click', function() {
        var index = parseInt(item.dataset.index);
        self.openModal(index);
      });
    });
  },

  openModal: function(index) {
    var r = this.currentResults[index];
    if (!r) return;

    this.currentModalIndex = index;
    var t = r.tmdb;

    var backdrop = t.backdrop_path
      ? 'https://image.tmdb.org/t/p/w780' + t.backdrop_path
      : (t.poster_path ? 'https://image.tmdb.org/t/p/w500' + t.poster_path : '');

    this.listModalImg.src = backdrop;
    this.listModalTitle.textContent = t.title;

    var year = t.release_date ? t.release_date.substring(0, 4) : '';
    var genres = t.genre_ids ? this.getGenres(t.genre_ids) : (t.genres ? t.genres.slice(0, 2).map(function(g) { return g.name; }).join(', ') : '');
    this.listModalMeta.textContent = [year, genres].filter(Boolean).join(' · ');

    this.listModalDesc.textContent = t.overview || '';
    if (this.listModalRatingInput) {
      this.listModalRatingInput.value = String(r.rating || 3);
    }
    if (this.listModalDateInput) {
      this.listModalDateInput.value = Logit.Import.normalizeDate(r.date);
    }
    this.listModalOriginalLine.textContent = 'Obsidian: ' + r.originalLine;

    this.listModalSearchInput.value = '';
    this.listModalResults.innerHTML = '';

    this.listModal.style.display = 'flex';
  },

  closeModal: function() {
    this.listModal.style.display = 'none';
    this.currentModalIndex = -1;
  },

  getGenres: function(ids) {
    var genreMap = {28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',
      18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',
      9648:'Mystery',10749:'Romance',878:'Sci-Fi',10770:'TV Movie',53:'Thriller',10752:'War',37:'Western'};
    var names = [];
    for (var i = 0; i < ids.length; i++) {
      if (genreMap[ids[i]]) names.push(genreMap[ids[i]]);
    }
    return names.slice(0, 2).join(', ');
  },

  async searchAlternative() {
    var query = this.listModalSearchInput.value.trim();
    if (!query || query.length < 2) {
      this.listModalResults.innerHTML = '';
      return;
    }

    var API = Logit.Config.getApiKey();
    if (!API) return;

    try {
      var url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(query);
      var data = await Logit.Search.tmdb(url);
      if (!data || !data.results) return;

      this.listModalResults.innerHTML = '';
      for (var i = 0; i < Math.min(data.results.length, 5); i++) {
        var m = data.results[i];
        var poster = m.poster_path ? 'https://image.tmdb.org/t/p/w92' + m.poster_path : '';
        var year = m.release_date ? m.release_date.substring(0, 4) : '';
        var html = '<div class="listModalResultItem" data-tmdbid="' + m.id + '">'
          + (poster ? '<img src="' + poster + '" alt="">' : '')
          + '<div><span>' + Logit.Utils.esc(m.title) + '</span><br><small>' + year + '</small></div>'
          + '</div>';
        this.listModalResults.insertAdjacentHTML('beforeend', html);
      }

      var self = this;
      this.listModalResults.querySelectorAll('.listModalResultItem').forEach(function(item) {
        item.addEventListener('click', function() {
          var tmdbId = item.dataset.tmdbid;
          self.selectAlternative(tmdbId);
        });
      });
    } catch (e) {
      console.warn('[List] Search failed:', e);
    }
  },

  async selectAlternative(tmdbId) {
    var API = Logit.Config.getApiKey();
    try {
      var url = 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + API;
      var detail = await Logit.Search.tmdb(url);
      if (!detail) return;

      var r = this.currentResults[this.currentModalIndex];
      this.currentResults[this.currentModalIndex] = {
        tmdb: detail,
        rating: r.rating,
        date: r.date,
        watch: r.watch,
        originalLine: r.originalLine
      };

      var backdrop = detail.backdrop_path
        ? 'https://image.tmdb.org/t/p/w780' + detail.backdrop_path
        : (detail.poster_path ? 'https://image.tmdb.org/t/p/w500' + detail.poster_path : '');

      this.listModalImg.src = backdrop;
      this.listModalTitle.textContent = detail.title;
      var year = detail.release_date ? detail.release_date.substring(0, 4) : '';
      var genres = detail.genres ? detail.genres.slice(0, 2).map(function(g) { return g.name; }).join(', ') : '';
      this.listModalMeta.textContent = [year, genres].filter(Boolean).join(' · ');
      this.listModalDesc.textContent = detail.overview || '';

      this.listModalSearchInput.value = '';
      this.listModalResults.innerHTML = '';
    } catch (e) {
      console.warn('[List] Failed to fetch alternative:', e);
    }
  },

  async acceptCurrentMovie() {
    var r = this.currentResults[this.currentModalIndex];
    if (!r) return;

    var API = Logit.Config.getApiKey();
    if (!API) { alert('TMDB API key not set'); return; }
    var t = r.tmdb;
    var url = 'https://api.themoviedb.org/3/movie/' + t.id + '?api_key=' + API + '&append_to_response=credits,images';
    var detail = await Logit.Search.tmdb(url);
    if (!detail) { alert('Failed to get movie details'); return; }

    var rating = this.listModalRatingInput ? parseFloat(this.listModalRatingInput.value) : (r.rating || 3);
    var date = this.listModalDateInput ? this.listModalDateInput.value : Logit.Import.normalizeDate(r.date);

    var movie = Logit.MovieFactory.fromTMDB(detail, rating, r.watch, date);
    await Logit.Storage.saveMovie(movie, 'create');

    var newLine = '{' + t.title + '} ' + (date || '') + ' ' + rating;
    await this.updateObsidianFile(r.originalLine, newLine);

    this.currentResults.splice(this.currentModalIndex, 1);
    this.closeModal();
    this.renderList(this.currentResults);
    this.updateBadge();
  },

  rejectCurrentMovie() {
    this.currentResults.splice(this.currentModalIndex, 1);
    this.closeModal();
    this.renderList(this.currentResults);
    this.updateBadge();
  },

  async updateObsidianFile(oldLine, newLine) {
    if (!this.rawFileContent || !this.currentFileId) return;

    var token = localStorage.getItem('logit_drive_token');
    var headers = { 'Content-Type': 'text/markdown' };
    var url = 'https://www.googleapis.com/upload/drive/v3/files/' + this.currentFileId + '?uploadType=media';

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    } else {
      var apiKey = localStorage.getItem('google_api_key');
      if (apiKey) {
        url += '&key=' + apiKey;
      } else {
        console.warn('[List] Cannot write to Drive: No access token or API key');
        return;
      }
    }

    var newContent = this.rawFileContent.replace(oldLine, newLine);
    this.rawFileContent = newContent;

    try {
      var res = await fetch(url, {
        method: 'PATCH',
        headers: headers,
        body: newContent
      });
      if (!res.ok) {
        console.warn('[List] Drive PATCH failed with status:', res.status);
      }
    } catch (e) {
      console.warn('[List] Failed to update Obsidian file:', e);
    }
  },

  updateBadge: function() {
    var count = this.currentResults ? this.currentResults.length : 0;
    if (count > 0) {
      this.pcListBadge.textContent = count;
      this.pcListBadge.style.display = '';
      this.navListBadge.textContent = count;
      this.navListBadge.style.display = '';
    } else {
      this.pcListBadge.style.display = 'none';
      this.navListBadge.style.display = 'none';
    }
  }
};
