window.Logit = window.Logit || {};

/**
 * Storage layer — Supabase only. No localStorage.
 * All reads/writes go to the cloud. Requires authentication.
 */
Logit.Storage = {
  /** @param {number} bytes @returns {{ val: string, unit: string }} */
  formatBytes(bytes) {
    if (bytes < 1024) return { val: bytes, unit: 'B' };
    if (bytes < 1048576) return { val: (bytes / 1024).toFixed(1), unit: 'KB' };
    return { val: (bytes / 1048576).toFixed(2), unit: 'MB' };
  },

  /**
   * Load all movies from Supabase for the current user.
   * @returns {Promise<Array>}
   */
  async loadMovies() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return [];

    try {
      var { data, error } = await client
        .from('movies')
        .select('*')
        .eq('user_id', userId)
        .order('d', { ascending: false });

      if (error) throw new Error(error.message);
      return data || [];
    } catch (e) {
      console.error('Failed to load movies:', e);
      return [];
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
    var userId = localStorage.getItem('logit_user_id');
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

    return record;
  },

  /**
   * Save multiple movies (bulk upsert).
   * @param {Array} movies
   * @returns {Promise<void>}
   */
  async saveMovies(movies) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) throw new Error('Not authenticated');

    var now = new Date().toISOString();
    var records = movies.map(function(m) {
      return Object.assign({}, m, { user_id: userId, updated_at: now });
    });

    var { error } = await client.from('movies').upsert(records, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },

  /**
   * Delete a movie from Supabase.
   * @param {string} movieId
   * @returns {Promise<void>}
   */
  async deleteMovie(movieId) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) throw new Error('Not authenticated');

    var { error } = await client.from('movies').delete()
      .eq('id', movieId).eq('user_id', userId);
    if (error) throw new Error(error.message);
  },

  /**
   * Get cloud storage usage for the current user.
   * @returns {Promise<{ count: number, bytes: number, formatted: string }>}
   */
  async getCloudStorageUsage() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return { count: 0, bytes: 0, formatted: '0 B' };

    try {
      var { data } = await client.from('movies')
        .select('id, t, sp, g, c, dr, r, w, d, yr, rt, lg, ct, tmdb_id, imdb_id')
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
