window.Logit = window.Logit || {};

/**
 * Sync Engine
 * Implements offline-first sync with conflict resolution
 * 
 * Strategy:
 * 1. All changes saved locally first (optimistic)
 * 2. Changes queued for sync
 * 3. When online, sync automatically
 * 4. Conflicts resolved by "last write wins" (latest updated_at)
 * 5. Always preserve local data on errors
 */
Logit.Sync = {
  _syncInProgress: false,
  _lastSyncTime: null,
  _autoSyncInterval: null,
  _syncStatusCallbacks: [],

  /**
   * Initialize sync engine
   */
  init() {
    this._lastSyncTime = parseInt(localStorage.getItem('logit_last_sync')) || 0;
    this.setupAutoSync();
    this.setupOnlineDetection();
  },

  /**
   * Setup automatic sync
   */
  setupAutoSync() {
    const syncInterval = 5 * 60 * 1000; // 5 minutes

    this._autoSyncInterval = setInterval(() => {
      if (!this._syncInProgress) {
        this.sync();
      }
    }, syncInterval);
  },

  /**
   * Setup online/offline detection
   */
  setupOnlineDetection() {
    window.addEventListener('online', () => {
      this.notifySyncStatus('online');
      this.sync();
    });

    window.addEventListener('offline', () => {
      this.notifySyncStatus('offline');
    });
  },

  /**
   * Main sync function
   * @returns {Promise<Object>} Sync result
   */
  async sync() {
    if (this._syncInProgress) return { success: false, message: 'Sync already in progress' };
    if (Logit.Auth.isOfflineMode()) return { success: false, message: 'Offline mode' };

    const client = Logit.Supabase.getClient();
    if (!client) return { success: false, message: 'Not configured' };

    const isOnline = await Logit.Supabase.isOnline();
    if (!isOnline) {
      this.notifySyncStatus('offline');
      return { success: false, message: 'No internet connection' };
    }

    if (!Logit.Offline.acquireSyncLock({ holder: 'sync' })) {
      return { success: false, message: 'Sync already in progress (lock held)' };
    }

    this._syncInProgress = true;
    this.notifySyncStatus('syncing');

    try {
      // Get pending changes
      const pending = Logit.Offline.getPending();

      // Upload pending changes
      for (const item of pending) {
        await this.syncItem(item);
      }

      // Download remote changes
      await this.downloadRemoteChanges();

      // Clear synced items
      Logit.Offline.clearSynced();

      this._lastSyncTime = Date.now();
      localStorage.setItem('logit_last_sync', this._lastSyncTime.toString());

      const failedItems = Logit.Offline.getFailed();
      if (failedItems.length > 0) {
        this.notifySyncStatus('error');
        return { success: false, message: 'Some items failed to sync: ' + failedItems[0].error };
      }

      this.notifySyncStatus('synced');
      return { success: true, count: pending.length - failedItems.length };
    } catch (e) {
      console.error('Sync error:', e);
      this.notifySyncStatus('error');
      return { success: false, message: e.message };
    } finally {
      this._syncInProgress = false;
      Logit.Offline.releaseSyncLock();
    }
  },

  /**
   * Sync individual queue item
   * @param {Object} item - Queue item
   * @returns {Promise<void>}
   */
  async syncItem(item) {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');

    if (!userId) {
      Logit.Offline.markError(item.id, 'No user ID');
      return;
    }

    try {
      if (item.entity === 'movie') {
        await this.syncMovie(item, client, userId);
      } else if (item.entity === 'settings') {
        await this.syncSettings(item, client, userId);
      }

      Logit.Offline.markSynced(item.id);
    } catch (e) {
      Logit.Offline.markError(item.id, e.message);
      console.error(`Failed to sync ${item.entity}:`, e);
    }
  },

  /**
   * Sync movie
   * @param {Object} item
   * @param {Object} client
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async syncMovie(item, client, userId) {
    const movieData = {
      ...item.data,
      user_id: userId,
      updated_at: item.data.updated_at || new Date().toISOString()
    };

    if (item.action === 'create') {
      const { error } = await client
        .from('movies')
        .insert([movieData]);

      if (error) throw new Error(error.message);
    } else if (item.action === 'update') {
      // Check remote version BEFORE updating to prevent overwriting newer data
      const { data: remote } = await client
        .from('movies')
        .select('*')
        .eq('id', item.entityId)
        .single();

      // If remote exists and is newer, resolve conflict instead of blindly overwriting
      if (remote && remote.updated_at && movieData.updated_at &&
          new Date(remote.updated_at).getTime() > new Date(movieData.updated_at).getTime()) {
        // Remote is newer - resolve conflict (preserve local user fields if local has them)
        await this.resolveConflict(item.entityId, remote, movieData);
      } else {
        // Local is newer or equal, or no remote version exists - safe to update
        const { error } = await client
          .from('movies')
          .update(movieData)
          .eq('id', item.entityId)
          .eq('user_id', userId);

        if (error) throw new Error(error.message);
      }
    } else if (item.action === 'delete') {
      const { error } = await client
        .from('movies')
        .delete()
        .eq('id', item.entityId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    }
  },

  /**
   * Sync settings
   * @param {Object} item
   * @param {Object} client
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async syncSettings(item, client, userId) {
    if (item.action === 'update') {
      const { error } = await client
        .from('settings')
        .upsert({
          ...item.data,
          user_id: userId,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw new Error(error.message);
    }
  },

  /**
   * Resolve sync conflict
   * Remote is newer, but preserve user's local preferences
   * @param {string} movieId
   * @param {Object} remote
   * @param {Object} local
   * @returns {Promise<void>}
   */
  async resolveConflict(movieId, remote, local) {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');

    // Compare timestamps before deciding what to merge
    const remoteTime = new Date(remote.updated_at || 0).getTime();
    const localTime = new Date(local.updated_at || 0).getTime();

    // If local is newer or equal, keep local data (don't overwrite with remote)
    if (localTime >= remoteTime) {
      return;
    }

    // Remote is newer - merge with local preference for user-specific fields
    const merged = {
      ...remote,
      r: local.r !== remote.r ? local.r : remote.r,
      w: local.w !== remote.w ? local.w : remote.w,
      d: local.d !== remote.d ? local.d : remote.d,
      updated_at: remote.updated_at
    };

    const { error } = await client
      .from('movies')
      .update(merged)
      .eq('id', movieId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to resolve conflict:', error);
    }
  },

  /**
   * Download remote changes
   * Fetch movies modified since last sync
   * @returns {Promise<void>}
   */
  async downloadRemoteChanges() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!userId) return;

    try {
      // Fetch ALL movies from cloud
      const { data: remoteMovies, error } = await client
        .from('movies')
        .select('*')
        .eq('user_id', userId);

      if (error) throw new Error(error.message);

      const localMovies = Logit.Storage.loadMovies();
      const localMap = new Map(localMovies.map(m => [m.id, m]));

      for (const remoteMovie of remoteMovies || []) {
        const sanitized = this.sanitizeRemoteMovie(remoteMovie);
        const localMovie = localMap.get(remoteMovie.id);

        if (!localMovie) {
          // New movie from another device
          localMovies.push(sanitized);
        } else {
          // Compare timestamps - remote always wins (last write wins)
          const remoteTime = new Date(remoteMovie.updated_at || 0).getTime();
          const localTime = new Date(localMovie.updated_at || 0).getTime();

          if (remoteTime > localTime) {
            // Remote is newer - overwrite local
            Object.assign(localMovie, sanitized);
          }
        }
      }

      Logit.Storage.saveMovies(localMovies);
    } catch (e) {
      console.error('Failed to download remote changes:', e);
      throw e;
    }
  },

  /**
   * Sanitize remote movie for local storage
   * Remove cloud-only fields
   * @param {Object} movie
   * @returns {Object}
   */
  sanitizeRemoteMovie(movie) {
    const { user_id, created_at, updated_at, ...localMovie } = movie;
    return localMovie;
  },

  /** Pull all movies from cloud and merge with local */
  async pullFromCloud() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;

    const { data: remoteMovies } = await client
      .from('movies').select('*').eq('user_id', userId);

    if (!remoteMovies) return;

    const localMovies = Logit.Storage.loadMovies();
    const localMap = new Map(localMovies.map(m => [m.id, m]));
    const remoteIds = new Set(remoteMovies.map(m => m.id));
    const deletedIds = new Set(JSON.parse(localStorage.getItem('logit_deleted_ids') || '[]'));

    for (const rm of remoteMovies) {
      if (deletedIds.has(rm.id)) continue;
      const clean = this.sanitizeRemoteMovie(rm);
      const local = localMap.get(rm.id);
      if (!local) {
        localMovies.push(clean);
      } else if (new Date(rm.updated_at || 0) > new Date(local.updated_at || 0)) {
        Object.assign(local, clean);
      }
    }

    const synced = localMovies.filter(m => remoteIds.has(m.id) && !deletedIds.has(m.id));
    Logit.Storage.saveMovies(synced);
  },

  /** Push all local movies to cloud */
  async pushToCloud() {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;

    const movies = Logit.Storage.loadMovies();
    if (movies.length === 0) return;

    const now = new Date().toISOString();
    const toInsert = movies.map(m => ({ ...m, user_id: userId, updated_at: m.updated_at || now }));
    await client.from('movies').upsert(toInsert, { onConflict: 'id' });
  },

  /** Delete a movie from cloud */
  async deleteFromCloud(movieId) {
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;

    await client.from('movies').delete().eq('id', movieId).eq('user_id', userId);

    const deleted = JSON.parse(localStorage.getItem('logit_deleted_ids') || '[]');
    deleted.push(movieId);
    localStorage.setItem('logit_deleted_ids', JSON.stringify(deleted));
  },

  /**
   * Upload existing local movies to cloud
   * Called on first login — skips if cloud already has data (prevents duplicates)
   * @returns {Promise<Object>}
   */
  async uploadExistingMovies() {
    if (Logit.Auth.isOfflineMode()) return { success: false };

    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return { success: false };

    try {
      // Check if user already has movies in cloud
      const { data: existing } = await client
        .from('movies')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      // Cloud already has data — don't auto-upload local movies
      if (existing && existing.length > 0) {
        return { success: true, count: 0, skipped: true };
      }

      const localMovies = Logit.Storage.loadMovies();
      if (localMovies.length === 0) return { success: true, count: 0 };

      const moviesToInsert = localMovies.map(m => ({
        ...m,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await client
        .from('movies')
        .upsert(moviesToInsert, { onConflict: 'id' });

      if (error) {
        console.error('Failed to upload movies:', error);
        return { success: false, message: error.message };
      }

      return { success: true, count: localMovies.length };
    } catch (e) {
      console.error('Upload error:', e);
      return { success: false, message: e.message };
    }
  },

  /**
   * Manual sync trigger
   * @returns {Promise<Object>}
   */
  async manualSync() {
    return this.sync();
  },

  /**
   * Register callback for sync status changes
   * @param {Function} callback
   */
  onSyncStatusChange(callback) {
    this._syncStatusCallbacks.push(callback);
  },

  /**
   * Notify sync status change
   * @param {string} status - 'offline', 'syncing', 'synced', 'error'
   */
  notifySyncStatus(status) {
    this._syncStatusCallbacks.forEach(cb => cb(status));
  },

  /**
   * Get sync status
   * @returns {string}
   */
  getSyncStatus() {
    if (!navigator.onLine) return 'offline';
    if (this._syncInProgress) return 'syncing';
    return 'synced';
  },

  /**
   * Get last sync time
   * @returns {Date|null}
   */
  getLastSyncTime() {
    return this._lastSyncTime ? new Date(this._lastSyncTime) : null;
  }
};
