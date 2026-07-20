window.Logit = window.Logit || {};

Logit.Storage = {
  _SCHEMA_VERSION: 2,
  _MOVIES_KEY: 'movies',
  _SCHEMA_KEY: 'logit_schema_version',

  /** @returns {Array} Array of movie objects from localStorage */
  loadMovies() {
    try {
      var raw = localStorage.getItem(this._MOVIES_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch (e) {
      console.warn('Corrupted localStorage movies data, resetting:', e);
      localStorage.removeItem(this._MOVIES_KEY);
      return [];
    }
  },

  /** Run any pending schema migrations */
  migrate() {
    var currentVersion = parseInt(localStorage.getItem(this._SCHEMA_KEY)) || 1;
    if (currentVersion >= this._SCHEMA_VERSION) return;

    var list = this.loadMovies();
    var changed = false;

    // V1 -> V2: strip legacy poster arrays
    if (currentVersion < 2) {
      list.forEach(function(m) {
        if (m.p) { delete m.p; changed = true; }
      });
    }

    if (changed) this.saveMoviesRaw(list);
    localStorage.setItem(this._SCHEMA_KEY, this._SCHEMA_VERSION);
  },

  /**
   * Save movies array directly to localStorage (no side effects).
   * Use this for bulk writes like sync/merge. Does NOT set updated_at or trigger sync.
   */
  saveMoviesRaw(movies) {
    try {
      localStorage.setItem(this._MOVIES_KEY, JSON.stringify(movies));
    } catch (e) {
      console.error('Failed to save movies to localStorage:', e);
    }
  },

  /**
   * Save movies array to localStorage and queue for sync if authenticated.
   * Does NOT stamp updated_at on every movie — only the caller knows what changed.
   */
  saveMovies(movies) {
    this.saveMoviesRaw(movies);

    if (!Logit.Auth.isOfflineMode() && Logit.Sync && Logit.Sync.sync) {
      Logit.Sync.sync().catch(function() {});
    }
  },

  /** @returns {{ total: number, keys: Array<{key: string, size: number}> }} */
  getStorageSize() {
    var total = 0;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      var val = localStorage.getItem(key);
      var size = (key.length + val.length) * 2;
      total += size;
      keys.push({ key: key, size: size });
    }
    return { total: total, keys: keys };
  },

  /** @param {number} bytes @returns {{ val: string, unit: string }} */
  formatBytes(bytes) {
    if (bytes < 1024) return { val: bytes, unit: 'B' };
    if (bytes < 1048576) return { val: (bytes / 1024).toFixed(1), unit: 'KB' };
    return { val: (bytes / 1048576).toFixed(2), unit: 'MB' };
  },

  /**
   * Save a single movie and queue for sync.
   * Only stamps updated_at on the specific movie being saved.
   */
  saveMovie(movie, action) {
    action = action || 'create';
    var movies = this.loadMovies();
    var existingIndex = movies.findIndex(function(m) { return m.id === movie.id; });

    if (action === 'create' && existingIndex === -1) {
      if (!movie.id) movie.id = 'movie_' + Date.now();
      if (!movie.created_at) movie.created_at = new Date().toISOString();
      movie.updated_at = new Date().toISOString();
      movies.unshift(movie);
    } else if (action === 'update' && existingIndex !== -1) {
      movie.updated_at = new Date().toISOString();
      movies[existingIndex] = movie;
    }

    this.saveMovies(movies);

    if (!Logit.Auth.isOfflineMode() && Logit.Offline) {
      Logit.Offline.enqueue(action, 'movie', movie.id, movie);
    }

    return movie;
  },

  /**
   * Delete movie locally and queue for sync.
   */
  deleteMovie(movieId) {
    var movies = this.loadMovies();
    this.saveMovies(movies.filter(function(m) { return m.id !== movieId; }));
    if (!Logit.Auth.isOfflineMode() && Logit.Offline) {
      Logit.Offline.enqueue('delete', 'movie', movieId, { id: movieId });
    }
  }
};

