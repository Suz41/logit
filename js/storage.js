window.Logit = window.Logit || {};

/**
 * Storage layer — Supabase only. No localStorage.
 * All reads/writes go to the cloud. Requires authentication.
 */
Logit.Storage = {
  _autoBackupTimer: null,

  /** @param {number} bytes @returns {{ val: string, unit: string }} */
  formatBytes(bytes) {
    if (bytes < 1024) return { val: bytes, unit: 'B' };
    if (bytes < 1048576) return { val: (bytes / 1024).toFixed(1), unit: 'KB' };
    return { val: (bytes / 1048576).toFixed(2), unit: 'MB' };
  },

  /**
   * Load all movies from Supabase for the current user.
   * @returns {Promise<{ movies: Array, error: string|null }>}
   */
  async loadMovies() {
    var client = Logit.Supabase.getClient();
    var userId = Logit.Auth.getUserId();
    if (!client || !userId) return { movies: [], error: 'Not signed in' };

    try {
      var { data, error } = await client
        .from('movies')
        .select('*')
        .eq('user_id', userId)
        .order('d', { ascending: false });

      if (error) throw new Error(error.message);
      return { movies: data || [], error: null };
    } catch (e) {
      console.error('Failed to load movies:', e);
      var msg = 'Failed to load movies';
      if (!navigator.onLine) msg = 'You are offline';
      else if (e.message.includes('Failed to fetch')) msg = 'Unable to connect to cloud';
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
    var client = Logit.Supabase.getClient();
    var userId = Logit.Auth.getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    var now = new Date().toISOString();
    var record = Object.assign({}, movie, {
      user_id: userId,
      updated_at: now
    });

    if (action === 'create') {
      if (!record.id) record.id = Logit.MovieFactory.generateUUID();
      if (!record.created_at) record.created_at = now;
      var { error } = await client.from('movies').insert([record]);
      if (error) throw new Error(error.message);
    } else {
      var { error: updErr } = await client.from('movies').update(record)
        .eq('id', movie.id).eq('user_id', userId);
      if (updErr) throw new Error(updErr.message);
    }

    this._scheduleAutoBackup();
    return record;
  },

  /**
   * Delete a movie from Supabase.
   * @param {string} movieId
   * @returns {Promise<void>}
   */
  async deleteMovie(movieId) {
    var client = Logit.Supabase.getClient();
    var userId = Logit.Auth.getUserId();
    if (!client || !userId) throw new Error('Not authenticated');

    var { error } = await client.from('movies').delete()
      .eq('id', movieId).eq('user_id', userId);
    if (error) throw new Error(error.message);

    this._scheduleAutoBackup();
  },

  /**
   * Schedule auto-backup to Google Drive (debounced)
   */
  _scheduleAutoBackup() {
    if (this._autoBackupTimer) clearTimeout(this._autoBackupTimer);
    this._autoBackupTimer = setTimeout(async function() {
      if (Logit.Drive && Logit.Drive._accessToken) {
        await Logit.Drive.backup();
      }
    }, 5000);
  },

  /**
   * Get cloud storage usage for the current user.
   * @returns {Promise<{ count: number, bytes: number, formatted: string }>}
   */
  async getCloudStorageUsage() {
    var client = Logit.Supabase.getClient();
    var userId = Logit.Auth.getUserId();
    if (!client || !userId) return { count: 0, bytes: 0, formatted: '0 B' };

    try {
      var { data } = await client.from('movies')
        .select('id, t, sp, g, c, sc, pc, dr, r, w, d, yr, rt, lg, ct, tmdb_id, imdb_id')
        .eq('user_id', userId);
      if (!data) return { count: 0, bytes: 0, formatted: '0 B' };
      var bytes = new TextEncoder().encode(JSON.stringify(data)).length;
      var fmt = this.formatBytes(bytes);
      return { count: data.length, bytes: bytes, formatted: fmt.val + ' ' + fmt.unit };
    } catch (e) {
      return { count: 0, bytes: 0, formatted: '0 B' };
    }
  }
};
