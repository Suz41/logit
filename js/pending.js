window.Logit = window.Logit || {};

/**
 * Log!t Pending System
 * Handles capture, TMDB matching, and completing pending movies into library.
 */
Logit.Pending = {
  _OFFLINE_KEY: 'logit_offline_pending',

  /**
   * Get pending items stored locally for offline resilience.
   * @returns {Array}
   */
  getOfflinePending() {
    try {
      const stored = localStorage.getItem(this._OFFLINE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Save pending items to offline storage.
   * @param {Array} items
   */
  setOfflinePending(items) {
    try {
      localStorage.setItem(this._OFFLINE_KEY, JSON.stringify(items || []));
    } catch (e) {
      /* silent */
    }
  },

  /**
   * Load pending movies for the current user.
   * @param {string} [status='pending'] - 'pending', 'matched', 'completed', or 'all'
   * @returns {Promise<{ pending: Array, error: string|null }>}
   */
  async loadPending(status = 'pending') {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;

    if (!client || !userId) {
      const offline = this.getOfflinePending();
      const filtered = status === 'all' 
        ? offline 
        : offline.filter((item) => (status === 'pending' ? item.status === 'pending' || item.status === 'matched' : item.status === status));
      return { pending: filtered, error: null, isOffline: true };
    }

    try {
      let query = client
        .from('pending_movies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        if (status === 'pending') {
          query = query.in('status', ['pending', 'matched']);
        } else {
          query = query.eq('status', status);
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Merge any unsynced offline items
      const offline = this.getOfflinePending();
      if (offline.length > 0) {
        this.syncOfflineQueue();
      }

      return { pending: data || [], error: null, isOffline: false };
    } catch (e) {
      console.warn('Failed to load pending from cloud, falling back to local:', e);
      const offline = this.getOfflinePending();
      return { pending: offline, error: e.message, isOffline: true };
    }
  },

  /**
   * Save a single pending item.
   * @param {Object} item
   * @returns {Promise<Object>}
   */
  async savePending(item) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;
    const now = new Date().toISOString();

    const record = Object.assign(
      {
        id: item.id || Logit.MovieFactory.generateUUID(),
        raw_input: item.raw || item.raw_input || item.title || '',
        movie_title: item.title || item.movie_title || '',
        tmdb_id: item.tmdb_id ? String(item.tmdb_id) : null,
        rating: item.rating ? String(item.rating) : null,
        watch_date: item.watchDate || item.watch_date || null,
        status: item.tmdb_id ? 'matched' : 'pending',
        metadata: item.metadata || {},
        created_at: item.created_at || now,
        updated_at: now
      },
      item
    );

    // If TMDB match not populated yet, attempt fast background match
    if (!record.tmdb_id && Logit.Config) {
      const apiKey = Logit.Config.getApiKey();
      if (apiKey) {
        try {
          const match = await this.searchBestMatch(record.movie_title, item.year, apiKey);
          if (match) {
            record.tmdb_id = String(match.id);
            record.status = 'matched';
            record.metadata = {
              title: match.title,
              release_date: match.release_date || '',
              poster_path: match.poster_path || '',
              backdrop_path: match.backdrop_path || '',
              overview: match.overview || '',
              vote_average: match.vote_average || 0,
              genre_ids: match.genre_ids || []
            };
          }
        } catch (matchErr) {
          console.warn('Auto TMDB match failed:', matchErr);
        }
      }
    }

    if (!client || !userId) {
      const offline = this.getOfflinePending();
      record.user_id = userId || 'local_user';
      offline.unshift(record);
      this.setOfflinePending(offline);
      this.updateBadges();
      return record;
    }

    record.user_id = userId;
    const { data, error } = await client.from('pending_movies').insert([record]).select();
    if (error) {
      // Save locally if cloud insert fails
      const offline = this.getOfflinePending();
      offline.unshift(record);
      this.setOfflinePending(offline);
      console.warn('Cloud pending insert failed, queued locally:', error);
    }

    this.updateBadges();
    return (data && data[0]) || record;
  },

  /**
   * Save multiple pending items in bulk.
   * @param {Array} items
   * @returns {Promise<Array>}
   */
  async savePendingBulk(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const saved = [];
    for (const item of items) {
      try {
        const res = await this.savePending(item);
        saved.push(res);
      } catch (e) {
        console.error('Error saving pending movie:', item, e);
      }
    }
    this.updateBadges();
    return saved;
  },

  /**
   * Update an existing pending movie.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updatePending(id, updates) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;
    updates.updated_at = new Date().toISOString();

    if (!client || !userId) {
      const offline = this.getOfflinePending();
      const idx = offline.findIndex((x) => x.id === id);
      if (idx !== -1) {
        offline[idx] = Object.assign({}, offline[idx], updates);
        this.setOfflinePending(offline);
      }
      this.updateBadges();
      return updates;
    }

    const { data, error } = await client
      .from('pending_movies')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw new Error(error.message);
    this.updateBadges();
    return (data && data[0]) || updates;
  },

  /**
   * Delete or mark removed a pending movie.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deletePending(id) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;

    // Remove from offline storage if present
    const offline = this.getOfflinePending().filter((x) => x.id !== id);
    this.setOfflinePending(offline);

    if (client && userId) {
      const { error } = await client
        .from('pending_movies')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (error) throw new Error(error.message);
    }

    this.updateBadges();
  },

  /**
   * Complete a pending movie into the library.
   * Saves to `movies` and marks pending status as 'completed'.
   * @param {string} pendingId
   * @param {Object} tmdbDetail - Full movie detail from TMDB
   * @param {string} rating
   * @param {boolean} isRewatch
   * @param {string} watchDate
   * @param {Array} currentMoviesList
   * @returns {Promise<Object>}
   */
  async completePending(pendingId, tmdbDetail, rating, isRewatch, watchDate, currentMoviesList = []) {
    let watch;
    if (isRewatch) {
      const prevCount = currentMoviesList.filter((m) => m.t === (tmdbDetail.title || '')).length;
      watch = 'Rewatch \u00B7 ' + (prevCount + 1) + 'x';
    } else {
      watch = Logit.Movies ? Logit.Movies.watchType(currentMoviesList, tmdbDetail.title || '') : '1st Watch';
    }

    const movie = Logit.MovieFactory.fromTMDB(
      tmdbDetail,
      rating || '5',
      watch,
      watchDate || new Date().toISOString().slice(0, 10)
    );

    // Save to user library
    await Logit.Storage.saveMovie(movie, 'create');

    // Update pending record status
    try {
      await this.updatePending(pendingId, {
        status: 'completed',
        tmdb_id: String(tmdbDetail.id),
        metadata: {
          title: tmdbDetail.title,
          release_date: tmdbDetail.release_date || '',
          poster_path: tmdbDetail.poster_path || ''
        }
      });
    } catch (e) {
      console.warn('Failed to update pending status to completed:', e);
    }

    this.updateBadges();
    return movie;
  },

  /**
   * Fast TMDB search helper to find the most likely match.
   * @param {string} title
   * @param {string|null} year
   * @param {string} apiKey
   * @returns {Promise<Object|null>}
   */
  async searchBestMatch(title, year, apiKey) {
    if (!title || !apiKey) return null;
    let url =
      'https://api.themoviedb.org/3/search/movie?api_key=' +
      apiKey +
      '&query=' +
      encodeURIComponent(title.trim());
    if (year) url += '&year=' + year;

    const data = await Logit.Search.tmdb(url);
    if (!data || !data.results || data.results.length === 0) return null;

    // Prioritize results with a poster
    const withPoster = data.results.filter((r) => r.poster_path);
    return withPoster.length > 0 ? withPoster[0] : data.results[0];
  },

  /**
   * Sync offline pending items to cloud when online & authenticated.
   */
  async syncOfflineQueue() {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;
    if (!client || !userId || !navigator.onLine) return;

    const offline = this.getOfflinePending();
    if (offline.length === 0) return;

    const toSync = offline.map((item) => {
      const copy = Object.assign({}, item, { user_id: userId });
      return copy;
    });

    try {
      const { error } = await client.from('pending_movies').upsert(toSync);
      if (!error) {
        this.setOfflinePending([]);
      }
    } catch (e) {
      console.warn('Offline sync failed, will retry later:', e);
    }
  },

  /**
   * Get the active pending count for badge rendering.
   * @returns {Promise<number>}
   */
  async getPendingCount() {
    const res = await this.loadPending('pending');
    return res.pending ? res.pending.length : 0;
  },

  /**
   * Update badge elements across the page.
   */
  async updateBadges() {
    try {
      const count = await this.getPendingCount();
      const badges = document.querySelectorAll('.pendingBadge, .listBadge[data-badge="pending"]');
      badges.forEach((el) => {
        if (count > 0) {
          el.textContent = count > 99 ? '99+' : count;
          el.style.display = 'flex';
        } else {
          el.textContent = '';
          el.style.display = 'none';
        }
      });
    } catch (e) {
      /* silent */
    }
  }
};
