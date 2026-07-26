window.Logit = window.Logit || {};

Logit.ListPage = {
  pendingMovies: [],
  currentResults: [],
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

    this.bindEvents();
    this.checkUrlHash();
  },

  bindEvents: function() {
    var self = this;

    if (this.navList) {
      this.navList.addEventListener('click', function() {
        self.showList();
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
    var apiKey = localStorage.getItem('google_api_key');
    if (apiKey) {
      var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&key=' + apiKey;
      var res = await fetch(url);
      return await res.text();
    }
    throw new Error('No API key available');
  },

  async fetchFromFolder(folderId) {
    var apiKey = localStorage.getItem('google_api_key');
    if (!apiKey) {
      throw new Error('Set your Google API key in About → API Keys first.');
    }

    var q = encodeURIComponent("'" + folderId + "' in parents and mimeType = 'text/markdown' and trashed = false");
    var url = 'https://www.googleapis.com/drive/v3/files?q=' + q + '&fields=files(id,name)&key=' + apiKey;
    var res = await fetch(url);
    var data = await res.json();

    if (data.error) {
      localStorage.removeItem('google_api_key');
      throw new Error(data.error.message || 'API error - check your key');
    }

    if (!data.files || data.files.length === 0) {
      throw new Error('No .md files found in folder. Make sure folder is shared "Anyone with the link".');
    }

    this.currentFileId = data.files[0].id;
    return await this.fetchDriveFile(data.files[0].id);
  },

  parseMarkdown(content) {
    var lines = content.split('\n').filter(function(l) { return l.trim(); });
    var movies = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('✅') || line.startsWith('[x]')) continue;
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
        + '<div class="listItemMeta">' + year + ' &middot; ' + r.rating + '/5</div>'
        + '</div>'
        + '</div>';

      this.listItems.insertAdjacentHTML('beforeend', html);
    }

    var self = this;
    this.listItems.querySelectorAll('.listItem').forEach(function(item) {
      item.addEventListener('click', function() {
        var index = parseInt(item.dataset.index);
        self.openMetaForImport(index);
      });
    });
  },

  openMetaForImport: function(index) {
    var r = this.currentResults[index];
    if (!r) return;

    var t = r.tmdb;
    var movie = {
      id: 'import_' + t.id,
      t: t.title,
      sp: t.poster_path || '',
      yr: t.release_date ? t.release_date.substring(0, 4) : '',
      r: r.rating,
      g: t.genre_ids ? this.getGenres(t.genre_ids) : '',
      rt: t.runtime || 0,
      dr: '',
      lg: t.original_language || '',
      ct: '',
      w: r.watch,
      d: r.date || new Date().toISOString().split('T')[0],
      c: '',
      sc: '',
      pc: '',
      tmdb_id: String(t.id),
      _importIndex: index,
      _originalLine: r.originalLine
    };

    Logit.Modals.openMeta(movie);

    var self = this;
    setTimeout(function() {
      var saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        saveBtn.onclick = function() {
          self.acceptImportedMovie(movie);
        };
      }
    }, 100);
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

  async acceptImportedMovie(movie) {
    var API = Logit.Config.getApiKey();
    if (!API) return;

    var tmdbId = movie.tmdb_id;
    var url = 'https://api.themoviedb.org/3/movie/' + tmdbId + '?api_key=' + API + '&append_to_response=credits,images';
    var detail = await Logit.Search.tmdb(url);
    if (!detail) { alert('Failed to get movie details'); return;

    }

    var title = (document.getElementById('mTitle') || {}).textContent || movie.t;
    var rating = movie.r;
    var logged = (document.getElementById('eLogged') || {}).value || movie.d;
    var watch = document.getElementById('eWatch') ? (document.getElementById('eWatch').checked ? 'Rewatch' : '1st Watch') : movie.w;

    var newMovie = Logit.MovieFactory.fromTMDB(detail, rating, watch, logged);
    var state = Logit.Storage.load();
    state.movies.unshift(newMovie);
    Logit.Storage.save(state);

    var originalLine = movie._originalLine;
    var newLine = title + ' ' + logged + ' ' + rating;
    await this.updateObsidianFile(originalLine, '✅ ' + newLine);

    this.currentResults.splice(movie._importIndex, 1);
    Logit.Modals.closeMeta();
    this.renderList(this.currentResults);
    this.updateBadge();
  },

  async updateObsidianFile(oldLine, newLine) {
    if (!this.rawFileContent || !this.currentFileId) return;

    var apiKey = localStorage.getItem('google_api_key');
    if (!apiKey) return;

    var newContent = this.rawFileContent.replace(oldLine, newLine);
    this.rawFileContent = newContent;

    try {
      var url = 'https://www.googleapis.com/upload/drive/v3/files/' + this.currentFileId + '?uploadType=media&key=' + apiKey;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'text/markdown' },
        body: newContent
      });
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
