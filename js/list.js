window.Logit = window.Logit || {};

Logit.ListPage = {
  pendingMovies: [],

  init: function() {
    this.libraryEl = document.getElementById('library');
    this.listSection = document.getElementById('listSection');
    this.navLibrary = document.getElementById('navLibrary');
    this.navList = document.getElementById('navList');
    this.pcListBtn = document.getElementById('pcListBtn');
    this.posterBg = document.getElementById('posterBg');
    this.driveLinkInput = document.getElementById('driveLinkInput');
    this.driveConnectBtn = document.getElementById('driveConnectBtn');
    this.listEmpty = document.getElementById('listEmpty');
    this.listItems = document.getElementById('listItems');
    this.pcListBadge = document.getElementById('pcListBadge');
    this.navListBadge = document.getElementById('navListBadge');

    this.bindEvents();
    this.checkUrlHash();
    this.loadSavedLink();
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

    if (this.driveLinkInput) {
      this.driveLinkInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') self.connectDrive();
      });
    }
  },

  checkUrlHash: function() {
    if (window.location.hash === '#list') {
      this.showList();
    }
  },

  loadSavedLink: function() {
    var saved = localStorage.getItem('logit_drive_link');
    if (saved && this.driveLinkInput) {
      this.driveLinkInput.value = saved;
      this.connectDrive();
    }
  },

  showList: function() {
    this.libraryEl.style.display = 'none';
    this.listSection.style.display = 'block';
    if (this.posterBg) this.posterBg.classList.remove('active');

    this.navLibrary.classList.remove('on');
    this.navList.classList.add('on');

    window.location.hash = 'list';
  },

  showLibrary: function() {
    this.libraryEl.style.display = '';
    this.listSection.style.display = 'none';

    this.navLibrary.classList.add('on');
    this.navList.classList.remove('on');

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
    var url = this.driveLinkInput.value.trim();
    if (!url) { alert('Paste a Google Drive share link'); return; }

    var extracted = this.extractId(url);
    if (!extracted) { alert('Invalid Google Drive link'); return; }

    localStorage.setItem('logit_drive_link', url);

    this.driveConnectBtn.textContent = 'Loading...';
    this.driveConnectBtn.disabled = true;

    try {
      var content;
      if (extracted.type === 'folder') {
        content = await this.fetchFromFolder(extracted.id);
      } else {
        content = await this.fetchDriveFile(extracted.id);
      }
      if (!content) throw new Error('Could not fetch file');
      this.parseMarkdown(content);
    } catch (e) {
      alert('Failed to load: ' + e.message);
    } finally {
      this.driveConnectBtn.textContent = 'Connect';
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

    var mdFile = data.files[0];
    return await this.fetchDriveFile(mdFile.id);
  },

  parseMarkdown(content) {
    var lines = content.split('\n').filter(function(l) { return l.trim(); });
    var movies = [];

    for (var i = 0; i < lines.length; i++) {
      var parsed = Logit.Import.parseLine(lines[i]);
      if (parsed && parsed.title) {
        movies.push(parsed);
      }
    }

    if (movies.length === 0) {
      this.listItems.innerHTML = '<p class="listMessage">No movies found in file</p>';
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

    this.listEmpty.style.display = 'none';
    this.listItems.innerHTML = '<p class="listMessage">Searching ' + movies.length + ' movies...</p>';

    console.log('[List] Parsing movies:', movies);

    var results = [];
    for (var i = 0; i < movies.length; i++) {
      var m = movies[i];
      try {
        var url = 'https://api.themoviedb.org/3/search/movie?api_key=' + API + '&query=' + encodeURIComponent(m.title);
        if (m.year) url += '&year=' + m.year;
        console.log('[List] Searching:', m.title, 'year:', m.year);
        var data = await Logit.Search.tmdb(url);
        console.log('[List] Result:', data);
        if (data && data.results && data.results.length > 0) {
          var tmdb = data.results[0];
          results.push({
            tmdb: tmdb,
            rating: m.rating || 3,
            date: m.date || '',
            watch: m.rewatch ? 'Rewatch' : '1st Watch'
          });
        }
      } catch (e) {
        console.warn('[List] Search failed for:', m.title, e);
      }
    }

    console.log('[List] Final results:', results);
    this.renderList(results);
  },

  renderList(results) {
    this.listItems.innerHTML = '';

    if (results.length === 0) {
      this.listItems.innerHTML = '<p class="listMessage">No matches found. Check your TMDB API key.</p>';
      return;
    }

    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var t = r.tmdb;
      var poster = t.poster_path
        ? 'https://image.tmdb.org/t/p/w92' + t.poster_path
        : 'https://placehold.co/92x138/1a1a1a/333?text=No+Poster';

      var year = t.release_date ? t.release_date.substring(0, 4) : '';
      var html = '<div class="listItem" data-index="' + i + '">'
        + '<img class="listItemPoster" src="' + poster + '" alt="">'
        + '<div class="listItemInfo">'
        + '<div class="listItemTitle">' + Logit.Utils.esc(t.title) + '</div>'
        + '<div class="listItemMeta">' + year + ' &middot; ' + r.rating + '/5 &middot; ' + r.watch + '</div>'
        + '</div>'
        + '<div class="listItemActions">'
        + '<button class="listAccept" data-action="accept" title="Add to library">&check;</button>'
        + '<button class="listReject" data-action="reject" title="Skip">&times;</button>'
        + '</div>'
        + '</div>';

      this.listItems.insertAdjacentHTML('beforeend', html);
    }

    this.bindItemEvents(results);
  },

  bindItemEvents: function(results) {
    var self = this;
    this.listItems.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var item = btn.closest('.listItem');
      var index = parseInt(item.dataset.index);
      var action = btn.dataset.action;

      if (action === 'accept') {
        self.acceptMovie(results[index]);
      }
      item.remove();
      self.updateBadge();
    });
  },

  async acceptMovie(result) {
    var API = Logit.Config.getApiKey();
    var t = result.tmdb;
    var url = 'https://api.themoviedb.org/3/movie/' + t.id + '?api_key=' + API + '&append_to_response=credits,images';
    var detail = await Logit.Search.tmdb(url);
    if (!detail) { alert('Failed to get movie details'); return; }

    var movie = Logit.MovieFactory.fromTMDB(detail, result.rating, result.watch, result.date || new Date().toISOString().split('T')[0]);
    var state = Logit.Storage.load();
    state.movies.unshift(movie);
    Logit.Storage.save(state);
  },

  updateBadge: function() {
    var count = this.listItems.querySelectorAll('.listItem').length;
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
