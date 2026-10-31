window.Logit = window.Logit || {};

/**
 * Storage layer — Supabase with robust range-based pagination and automated backup integration.
 * All reads/writes go to the cloud. Requires authentication.
 */
Logit.Storage = {
  _autoBackupTimer: null,
  _PAGE_SIZE: 1000,

  /** @param {number} bytes @returns {{ val: string, unit: string }} */
  formatBytes(bytes) {
    if (bytes < 1024) return { val: bytes, unit: 'B' };
    if (bytes < 1048576) return { val: (bytes / 1024).toFixed(1), unit: 'KB' };
    return { val: (bytes / 1048576).toFixed(2), unit: 'MB' };
  },

  /**
   * Load all movies from Supabase for the current user using stable pagination.
   * Handles libraries exceeding PostgREST's default 1,000 row query limit.
   * @returns {Promise<{ movies: Array, error: string|null }>}
   */
  async loadMovies() {
    var client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    var userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) return { movies: [], error: 'Not signed in' };

    try {
      var allMovies = [];
      var from = 0;
      var pageSize = this._PAGE_SIZE;

      while (true) {
        var { data, error } = await client
          .from('movies')
          .select('*')
          .eq('user_id', userId)
          .order('d', { ascending: false })
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;

        allMovies = allMovies.concat(data);

        // If returned rows are fewer than the page size, we have retrieved all records
        if (data.length < pageSize) break;

        from += pageSize;
      }

      return { movies: allMovies, error: null };
    } catch (e) {
      console.error('Failed to load movies:', e);
      var msg = 'Failed to load movies';
      if (!navigator.onLine) msg = 'You are offline';
      else if (e.message && e.message.includes('Failed to fetch'))
        msg = 'Unable to connect to cloud';
      return { movies: [], error: msg };
    }
  },

  /**
   * Save a single movie (create or update).
   * @param {Object} movie
   * @param {string} action - 'create' or 'update'
   * @returns {Promise<Object>} the saved movie
   */
  async saveMovie(movie, action) {
    action = action || 'create';
    var client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    var userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) throw new Error('Not authenticated');

    var now = new Date().toISOString();
    var record = Object.assign({}, movie, {
      user_id: userId,
      updated_at: now
    });

    if (action === 'create') {
      if (!record.id) record.id = Logit.MovieFactory ? Logit.MovieFactory.generateUUID() : ('m_' + Date.now());
      if (!record.created_at) record.created_at = now;
      var { error } = await client.from('movies').insert([record]);
      if (error) throw new Error(error.message);
    } else {
      var { error: updErr } = await client
        .from('movies')
        .update(record)
        .eq('id', movie.id)
        .eq('user_id', userId);
      if (updErr) throw new Error(updErr.message);
    }

    this._scheduleAutoBackup();
    return record;
  },

  /**
   * Save multiple movies in bulk (insert/upsert).
   * @param {Array} movies
   * @returns {Promise<number>} the number of saved movies
   */
  async saveMoviesBulk(movies) {
    var client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    var userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) throw new Error('Not authenticated');

    var now = new Date().toISOString();
    var records = movies.map(function (movie) {
      var record = Object.assign({}, movie, {
        user_id: userId,
        updated_at: now
      });
      if (!record.id) record.id = Logit.MovieFactory ? Logit.MovieFactory.generateUUID() : ('m_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7));
      if (!record.created_at) record.created_at = now;
      return record;
    });

    var chunkSize = 100;
    for (var i = 0; i < records.length; i += chunkSize) {
      var chunk = records.slice(i, i + chunkSize);
      var { error } = await client.from('movies').upsert(chunk);
      if (error) throw new Error(error.message);
    }

    this._scheduleAutoBackup();
    return records.length;
  },

  /**
   * Delete a movie from Supabase.
   * @param {string} movieId
   * @returns {Promise<void>}
   */
  async deleteMovie(movieId) {
    var client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    var userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) throw new Error('Not authenticated');

    var { error } = await client
      .from('movies')
      .delete()
      .eq('id', movieId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);

    this._scheduleAutoBackup();
  },

  /**
   * Schedule auto-backup to Google Drive (debounced)
   */
  _scheduleAutoBackup() {
    if (this._autoBackupTimer) clearTimeout(this._autoBackupTimer);
    this._autoBackupTimer = setTimeout(async function () {
      if (Logit.Drive) {
        if (!Logit.Drive.isAuthenticated() && localStorage.getItem('logit_drive_connected') === 'true') {
          Logit.Drive.init();
        }
        if (Logit.Drive.isAuthenticated()) {
          try {
            await Logit.Drive.backup();
          } catch (e) {
            console.warn('[Drive] Background auto-backup failed:', e);
          }
        }
      }
    }, 5000);
  },

  /**
   * Get cloud storage usage for the current user across paginated library.
   * @returns {Promise<{ count: number, bytes: number, formatted: string }>}
   */
  async getCloudStorageUsage() {
    var client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    var userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) return { count: 0, bytes: 0, formatted: '0 B' };

    try {
      var res = await this.loadMovies();
      var data = res.movies || [];
      var bytes = new TextEncoder().encode(JSON.stringify(data)).length;
      var fmt = this.formatBytes(bytes);
      return {
        count: data.length,
        bytes: bytes,
        formatted: fmt.val + ' ' + fmt.unit
      };
    } catch (e) {
      return { count: 0, bytes: 0, formatted: '0 B' };
    }
  }
};
