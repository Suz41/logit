if (typeof window !== 'undefined') {
  window.Logit = window.Logit || {};
}
var Logit = typeof window !== 'undefined' ? window.Logit : {};

/**
 * Log!t Pending System
 * Handles capture, TMDB matching, serialization, account-isolated queues, and library integration.
 */
Logit.Pending = {
  /**
   * Helper to get active user ID or null.
   * @returns {string|null}
   */
  _getUserId() {
    return Logit.Auth && typeof Logit.Auth.getUserId === 'function'
      ? Logit.Auth.getUserId()
      : localStorage.getItem('logit_user_id');
  },

  /**
   * Get storage key isolated by account.
   * @param {string|null} [userId]
   * @returns {string}
   */
  _getOfflineKey(userId) {
    const uid = userId !== undefined ? userId : this._getUserId();
    return uid ? 'logit_offline_pending_' + uid : 'logit_offline_pending_anon';
  },

  /**
   * Get pending items stored locally for offline resilience.
   * Isolated per account to prevent cross-account contamination.
   * @param {string|null} [userId]
   * @returns {Array}
   */
  getOfflinePending(userId) {
    try {
      const key = this._getOfflineKey(userId);
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.map((item) => this.deserializeFromCloud(item)) : [];
      }

      // One-time seamless migration from legacy global key if present
      const legacy = localStorage.getItem('logit_offline_pending');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.removeItem('logit_offline_pending');
          localStorage.setItem(key, JSON.stringify(parsed));
          return parsed.map((item) => this.deserializeFromCloud(item));
        }
      }
      return [];
    } catch (e) {
      console.warn('Failed reading offline pending items:', e);
      return [];
    }
  },

  /**
   * Save pending items to offline storage.
   * @param {Array} items
   * @param {string|null} [userId]
   */
  setOfflinePending(items, userId) {
    try {
      const key = this._getOfflineKey(userId);
      localStorage.setItem(key, JSON.stringify(items || []));
    } catch (e) {
      console.warn('Failed writing offline pending items:', e);
    }
  },

  /**
   * Check if anonymous offline items exist from before signing in.
   * @returns {number}
   */
  getAnonOfflineCount() {
    try {
      const stored = localStorage.getItem('logit_offline_pending_anon');
      if (!stored) return 0;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Explicitly import anonymous offline items into the current authenticated account upon user confirmation.
   * @param {string} userId
   * @returns {Promise<number>} count of imported items
   */
  async importAnonOfflineItems(userId) {
    if (!userId) return 0;
    const anonItems = this.getOfflinePending(null);
    if (anonItems.length === 0) return 0;

    const userQueue = this.getOfflinePending(userId);
    const existingIds = new Set(userQueue.map((x) => x.id));
    let imported = 0;

    for (const item of anonItems) {
      if (!existingIds.has(item.id)) {
        item.user_id = userId;
        userQueue.unshift(item);
        imported++;
      }
    }

    this.setOfflinePending(userQueue, userId);
    this.setOfflinePending([], null); // Clear anon queue
    this.updateBadges();

    // Trigger sync for the authenticated queue
    await this.syncOfflineQueue(userId);
    return imported;
  },

  /**
   * Explicitly discard anonymous offline items.
   */
  discardAnonOfflineItems() {
    this.setOfflinePending([], null);
  },

  /**
   * Serialization: Map application item to strict PostgreSQL pending_movies table schema.
   * Only includes valid database columns to avoid PostgREST schema errors.
   * @param {Object} item
   * @param {string|null} userId
   * @returns {Object} Database-safe row payload
   */
  serializeForCloud(item, userId) {
    if (!item) throw new Error('Cannot serialize empty pending item');

    const rawTitle = item.movie_title || item.title || item.raw_input || item.raw || '';
    const movieTitle = String(rawTitle).trim();
    if (!movieTitle) {
      throw new Error('Movie title is required for pending item');
    }

    const id = item.id || (Logit.MovieFactory && Logit.MovieFactory.generateUUID ? Logit.MovieFactory.generateUUID() : ('p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9)));
    const now = new Date().toISOString();

    const isRewatch = Boolean(
      item.is_rewatch !== undefined
        ? item.is_rewatch
        : item.isRewatch !== undefined
          ? item.isRewatch
          : (item.metadata && item.metadata.is_rewatch)
    );

    const year = item.year || (item.metadata && item.metadata.year) || null;

    const metadata = Object.assign({}, item.metadata || {}, {
      year: year,
      is_rewatch: isRewatch
    });

    const status = item.status || (item.tmdb_id ? 'matched' : 'pending');

    return {
      id: id,
      user_id: userId || item.user_id || null,
      raw_input: item.raw_input || item.raw || movieTitle,
      movie_title: movieTitle,
      tmdb_id: item.tmdb_id ? String(item.tmdb_id) : null,
      rating: item.rating !== undefined && item.rating !== null && item.rating !== '' ? String(item.rating) : null,
      watch_date: item.watch_date || item.watchDate || null,
      status: status,
      metadata: metadata,
      created_at: item.created_at || now,
      updated_at: now
    };
  },

  /**
   * Deserialization: Transform a database row into an application pending item with normalized properties.
   * Ensures backward compatibility and convenience getters for title, year, and rewatch.
   * @param {Object} row
   * @returns {Object}
   */
  deserializeFromCloud(row) {
    if (!row) return null;

    const meta = row.metadata || {};
    const title = row.movie_title || row.title || meta.title || row.raw_input || '';
    const year = meta.year || row.year || (meta.release_date ? meta.release_date.slice(0, 4) : null);
    const isRewatch = Boolean(meta.is_rewatch !== undefined ? meta.is_rewatch : (row.is_rewatch !== undefined ? row.is_rewatch : row.isRewatch));

    return {
      id: row.id,
      user_id: row.user_id,
      movie_title: title,
      title: title,
      raw_input: row.raw_input || title,
      raw: row.raw_input || title,
      tmdb_id: row.tmdb_id ? String(row.tmdb_id) : null,
      rating: row.rating !== undefined && row.rating !== null ? String(row.rating) : null,
      watch_date: row.watch_date || null,
      watchDate: row.watch_date || null,
      status: row.status || 'pending',
      metadata: meta,
      year: year,
      is_rewatch: isRewatch,
      isRewatch: isRewatch,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  },

  /**
   * Load pending movies for the current user.
   * @param {string} [status='pending'] - 'pending', 'matched', 'completed', or 'all'
   * @returns {Promise<{ pending: Array, error: string|null, isOffline: boolean }>}
   */
  async loadPending(status = 'pending') {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = this._getUserId();

    if (!client || !userId) {
      const offline = this.getOfflinePending(userId);
      const filtered = status === 'all'
        ? offline
        : offline.filter((item) => (status === 'pending' ? item.status === 'pending' || item.status === 'matched' : item.status === status));
      return { pending: filtered, error: null, isOffline: true };
    }

    try {
      // Sync offline queue before loading
      await this.syncOfflineQueue(userId);

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

      const deserializedCloud = (data || []).map((row) => this.deserializeFromCloud(row));

      // Merge any pending items still in local queue that haven't synced yet
      const offline = this.getOfflinePending(userId);
      const cloudIds = new Set(deserializedCloud.map((x) => x.id));
      const remainingOffline = offline.filter((x) => !cloudIds.has(x.id));

      const merged = remainingOffline.concat(deserializedCloud);
      const filtered = status === 'all'
        ? merged
        : merged.filter((item) => (status === 'pending' ? item.status === 'pending' || item.status === 'matched' : item.status === status));

      return { pending: filtered, error: null, isOffline: false };
    } catch (e) {
      console.warn('Failed to load pending from cloud, falling back to local queue:', e);
      const offline = this.getOfflinePending(userId);
      const filtered = status === 'all'
        ? offline
        : offline.filter((item) => (status === 'pending' ? item.status === 'pending' || item.status === 'matched' : item.status === status));
      return { pending: filtered, error: e.message, isOffline: true };
    }
  },

  /**
   * Save a single pending item with explicit schema mapping and error handling.
   * @param {Object} item
   * @returns {Promise<Object>}
   */
  async savePending(item) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = this._getUserId();

    // 1. Serialize item safely
    let record;
    try {
      record = this.serializeForCloud(item, userId);
    } catch (e) {
      console.error('Invalid pending payload:', e);
      throw e;
    }

    // 2. If TMDB match not populated yet, attempt background search
    if (!record.tmdb_id && Logit.Config) {
      const apiKey = Logit.Config.getApiKey();
      if (apiKey) {
        try {
          const match = await this.searchBestMatch(record.movie_title, record.metadata.year, apiKey);
          if (match) {
            record.tmdb_id = String(match.id);
            record.status = 'matched';
            record.metadata = Object.assign({}, record.metadata, {
              title: match.title,
              release_date: match.release_date || '',
              poster_path: match.poster_path || '',
              backdrop_path: match.backdrop_path || '',
              overview: match.overview || '',
              vote_average: match.vote_average || 0,
              genre_ids: match.genre_ids || [],
              year: record.metadata.year || (match.release_date ? match.release_date.slice(0, 4) : null)
            });
          }
        } catch (matchErr) {
          console.warn('Auto TMDB match failed:', matchErr);
        }
      }
    }

    // 3. Offline / Unauthenticated: Queue locally to account-specific storage
    if (!client || !userId || !navigator.onLine) {
      const offline = this.getOfflinePending(userId);
      const appItem = this.deserializeFromCloud(record);
      appItem._syncStatus = 'local';
      offline.unshift(appItem);
      this.setOfflinePending(offline, userId);
      this.updateBadges();
      return appItem;
    }

    // 4. Authenticated & Online: Insert strictly conforming payload to Supabase
    try {
      const { data, error } = await client.from('pending_movies').insert([record]).select();
      if (error) {
        throw new Error(error.message);
      }
      const saved = (data && data[0]) ? this.deserializeFromCloud(data[0]) : this.deserializeFromCloud(record);
      saved._syncStatus = 'cloud';
      this.updateBadges();
      return saved;
    } catch (err) {
      console.warn('Cloud pending insert failed, queuing locally to device:', err.message);
      const offline = this.getOfflinePending(userId);
      const appItem = this.deserializeFromCloud(record);
      appItem._syncStatus = 'local';
      appItem._syncError = err.message;
      offline.unshift(appItem);
      this.setOfflinePending(offline, userId);
      this.updateBadges();
      return appItem;
    }
  },

  /**
   * Save multiple pending items in bulk.
   * @param {Array} items
   * @returns {Promise<Array>} Array of saved records with _syncStatus indicator
   */
  async savePendingBulk(items) {
    if (!Array.isArray(items) || items.length === 0) return [];

    const saved = [];
    for (const item of items) {
      try {
        const res = await this.savePending(item);
        saved.push(res);
      } catch (e) {
        console.error('Error saving pending movie item:', item, e);
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
    const userId = this._getUserId();
    const now = new Date().toISOString();

    // Clean updates payload
    const safeUpdates = { updated_at: now };
    if (updates.status !== undefined) safeUpdates.status = updates.status;
    if (updates.tmdb_id !== undefined) safeUpdates.tmdb_id = updates.tmdb_id ? String(updates.tmdb_id) : null;
    if (updates.movie_title !== undefined) safeUpdates.movie_title = updates.movie_title;
    else if (updates.title !== undefined) safeUpdates.movie_title = updates.title;
    if (updates.rating !== undefined) safeUpdates.rating = updates.rating !== null ? String(updates.rating) : null;
    if (updates.watch_date !== undefined) safeUpdates.watch_date = updates.watch_date;
    else if (updates.watchDate !== undefined) safeUpdates.watch_date = updates.watchDate;

    // Metadata updates
    if (updates.metadata || updates.year !== undefined || updates.is_rewatch !== undefined || updates.isRewatch !== undefined) {
      safeUpdates.metadata = Object.assign({}, updates.metadata || {});
      if (updates.year !== undefined) safeUpdates.metadata.year = updates.year;
      if (updates.is_rewatch !== undefined) safeUpdates.metadata.is_rewatch = Boolean(updates.is_rewatch);
      else if (updates.isRewatch !== undefined) safeUpdates.metadata.is_rewatch = Boolean(updates.isRewatch);
    }

    if (!client || !userId || !navigator.onLine) {
      const offline = this.getOfflinePending(userId);
      const idx = offline.findIndex((x) => x.id === id);
      if (idx !== -1) {
        offline[idx] = Object.assign({}, offline[idx], safeUpdates, {
          title: safeUpdates.movie_title || offline[idx].title,
          year: safeUpdates.metadata?.year || offline[idx].year,
          is_rewatch: safeUpdates.metadata?.is_rewatch !== undefined ? safeUpdates.metadata.is_rewatch : offline[idx].is_rewatch
        });
        this.setOfflinePending(offline, userId);
      }
      this.updateBadges();
      return safeUpdates;
    }

    const { data, error } = await client
      .from('pending_movies')
      .update(safeUpdates)
      .eq('id', id)
      .eq('user_id', userId)
      .select();

    if (error) throw new Error(error.message);
    this.updateBadges();
    return (data && data[0]) ? this.deserializeFromCloud(data[0]) : safeUpdates;
  },

  /**
   * Delete or mark removed a pending movie.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deletePending(id) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const userId = this._getUserId();

    // Remove from offline storage if present
    const offline = this.getOfflinePending(userId).filter((x) => x.id !== id);
    this.setOfflinePending(offline, userId);

    if (client && userId && navigator.onLine) {
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

    // Update pending record status to completed
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
      'https://api.tmdb.org/3/search/movie?api_key=' +
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
   * Awaited and reliable — avoids fire-and-forget state issues.
   * @param {string|null} [userId]
   * @returns {Promise<{ success: boolean, synced: number, remaining: number, error: string|null }>}
   */
  async syncOfflineQueue(userId) {
    const client = Logit.Supabase ? Logit.Supabase.getClient() : null;
    const uid = userId || this._getUserId();
    if (!client || !uid || !navigator.onLine) {
      return { success: false, synced: 0, remaining: this.getOfflinePending(uid).length, error: 'Offline or not signed in' };
    }

    const offline = this.getOfflinePending(uid);
    if (offline.length === 0) {
      return { success: true, synced: 0, remaining: 0, error: null };
    }

    const payloads = [];
    for (const item of offline) {
      try {
        payloads.push(this.serializeForCloud(item, uid));
      } catch (err) {
        console.warn('Skipping un-serializable offline item:', item, err);
      }
    }

    if (payloads.length === 0) {
      this.setOfflinePending([], uid);
      return { success: true, synced: 0, remaining: 0, error: null };
    }

    try {
      const { error } = await client.from('pending_movies').upsert(payloads, { onConflict: 'id' });
      if (error) throw new Error(error.message);

      // Successfully synchronized all
      this.setOfflinePending([], uid);
      this.updateBadges();
      return { success: true, synced: payloads.length, remaining: 0, error: null };
    } catch (e) {
      console.warn('Offline pending queue sync failed, will retry later:', e);
      return { success: false, synced: 0, remaining: offline.length, error: e.message };
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logit.Pending;
}
