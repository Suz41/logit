window.Logit = window.Logit || {};

Logit.Storage = {
  /** @returns {Array} Array of movie objects from localStorage */
  loadMovies() {
    try {
      const cached = localStorage.getItem('movies');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  },

  /** Strip legacy poster arrays from saved data */
  migrate() {
    const list = this.loadMovies();
    let stripped = false;
    list.forEach(function(m) {
      if (m.p) {
        delete m.p;
        stripped = true;
      }
    });
    if (stripped) this.saveMovies(list);
  },

  /** @param {Array} movies */
  saveMovies(movies) {
    try {
      const now = new Date().toISOString();
      movies.forEach(function(m) { m.updated_at = now; });
      localStorage.setItem('movies', JSON.stringify(movies));
      // Auto-push to cloud if logged in
      if (!Logit.Auth.isOfflineMode() && Logit.Sync && Logit.Sync.pushToCloud) {
        Logit.Sync.pushToCloud().catch(function() {});
      }
    } catch (e) {
      console.error('Failed to save movies to localStorage:', e);
    }
  },

  /** @returns {{ total: number, keys: Array<{key: string, size: number}> }} */
  getStorageSize() {
    let total = 0;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      const size = (key.length + val.length) * 2;
      total += size;
      keys.push({ key, size });
    }
    return { total, keys };
  },

  /** @param {number} bytes @returns {{ val: string, unit: string }} */
  formatBytes(bytes) {
    if (bytes < 1024) return { val: bytes, unit: 'B' };
    if (bytes < 1048576) return { val: (bytes / 1024).toFixed(1), unit: 'KB' };
    return { val: (bytes / 1048576).toFixed(2), unit: 'MB' };
  },

  /**
   * Save movie and queue for sync if authenticated
   * @param {Object} movie
   * @param {string} action - 'create' or 'update'
   */
  saveMovie(movie, action = 'create') {
    const movies = this.loadMovies();
    const existingIndex = movies.findIndex(m => m.id === movie.id);

    if (action === 'create' && existingIndex === -1) {
      if (!movie.id) movie.id = 'movie_' + Date.now();
      if (!movie.created_at) movie.created_at = new Date().toISOString();
      if (!movie.updated_at) movie.updated_at = new Date().toISOString();
      movies.push(movie);
    } else if (action === 'update' && existingIndex !== -1) {
      movie.updated_at = new Date().toISOString();
      movies[existingIndex] = movie;
    }

    this.saveMovies(movies);

    // Queue for sync if authenticated
    if (!Logit.Auth.isOfflineMode()) {
      Logit.Offline.enqueue(action, 'movie', movie.id, movie);
    }

    return movie;
  },

  /**
   * Delete movie locally
   * @param {string} movieId
   */
  deleteMovie(movieId) {
    const movies = this.loadMovies();
    this.saveMovies(movies.filter(m => m.id !== movieId));
  }
};

