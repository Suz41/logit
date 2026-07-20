window.Logit = window.Logit || {};

/**
 * Sync Engine
 * Queue-based offline-first sync with conflict resolution
 *
 * Strategy:
 * 1. All changes saved locally first (optimistic)
 * 2. Changes queued via Logit.Offline
 * 3. When online, sync drains the queue
 * 4. Conflicts resolved by "last write wins" (latest updated_at)
 * 5. Always preserve local data on errors
 */
Logit.Sync = {
  _syncInProgress: false,
  _lastSyncTime: null,
  _autoSyncInterval: null,
  _syncStatusCallbacks: [],

  init() {
    this._lastSyncTime = parseInt(localStorage.getItem('logit_last_sync')) || 0;
    this.setupAutoSync();
    this.setupOnlineDetection();
  },

  setupAutoSync() {
    var self = this;
    var syncInterval = 5 * 60 * 1000;
    this._autoSyncInterval = setInterval(function() {
      if (!self._syncInProgress) self.sync();
    }, syncInterval);
  },

  setupOnlineDetection() {
    var self = this;
    window.addEventListener('online', function() {
      self.notifySyncStatus('online');
      self.sync();
    });
    window.addEventListener('offline', function() {
      self.notifySyncStatus('offline');
    });
  },

  /**
   * Main sync: upload pending queue items, then download remote changes.
   */
  async sync() {
    if (this._syncInProgress) return { success: false, message: 'Sync already in progress' };
    if (Logit.Auth.isOfflineMode()) return { success: false, message: 'Offline mode' };

    var client = Logit.Supabase.getClient();
    if (!client) return { success: false, message: 'Not configured' };

    var isOnline = await Logit.Supabase.isOnline();
    if (!isOnline) {
      this.notifySyncStatus('offline');
      return { success: false, message: 'No internet connection' };
    }

    this._syncInProgress = true;
    this.notifySyncStatus('syncing');

    try {
      var pending = Logit.Offline.getPending();
      var failedCount = 0;

      for (var i = 0; i < pending.length; i++) {
        var ok = await this.syncItem(pending[i]);
        if (!ok) failedCount++;
      }

      await this.downloadRemoteChanges();

      Logit.Offline.clearSynced();

      this._lastSyncTime = Date.now();
      localStorage.setItem('logit_last_sync', this._lastSyncTime.toString());

      if (failedCount > 0) {
        this.notifySyncStatus('error');
        return { success: false, message: failedCount + ' item(s) failed to sync' };
      }

      this.notifySyncStatus('synced');
      return { success: true, count: pending.length - failedCount };
    } catch (e) {
      console.error('Sync error:', e);
      this.notifySyncStatus('error');
      return { success: false, message: e.message };
    } finally {
      this._syncInProgress = false;
    }
  },

  /**
   * Sync a single queue item. Returns true on success.
   */
  async syncItem(item) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!userId) { Logit.Offline.markError(item.id, 'No user ID'); return false; }

    try {
      if (item.entity === 'movie') {
        await this._syncMovie(item, client, userId);
      } else if (item.entity === 'settings') {
        await this._syncSettings(item, client, userId);
      }
      Logit.Offline.markSynced(item.id);
      return true;
    } catch (e) {
      Logit.Offline.markError(item.id, e.message);
      console.error('Failed to sync ' + item.entity + ':', e);
      return false;
    }
  },

  async _syncMovie(item, client, userId) {
    var movieData = Object.assign({}, item.data, {
      user_id: userId,
      updated_at: item.data.updated_at || new Date().toISOString()
    });

    if (item.action === 'delete') {
      var { error } = await client.from('movies').delete()
        .eq('id', item.entityId).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }

    if (item.action === 'create') {
      var { error: insErr } = await client.from('movies').insert([movieData]);
      if (insErr) {
        // 23505 = unique_violation — already exists, treat as update
        if (insErr.code === '23505') {
          var { error: updErr } = await client.from('movies').update(movieData)
            .eq('id', item.entityId).eq('user_id', userId);
          if (updErr) throw new Error(updErr.message);
          return;
        }
        throw new Error(insErr.message);
      }
      return;
    }

    // item.action === 'update'
    // Fetch remote version first to compare timestamps
    var { data: remote } = await client.from('movies').select('updated_at')
      .eq('id', item.entityId).eq('user_id', userId).single();

    if (remote && remote.updated_at) {
      var remoteTime = new Date(remote.updated_at).getTime();
      var localTime = new Date(movieData.updated_at).getTime();
      if (remoteTime > localTime) {
        // Remote is newer — merge: keep remote base, overlay local user fields
        var { data: remoteFull } = await client.from('movies').select('*')
          .eq('id', item.entityId).eq('user_id', userId).single();
        if (remoteFull) {
          movieData = Object.assign({}, remoteFull, {
            r: movieData.r, w: movieData.w, d: movieData.d,
            updated_at: new Date().toISOString()
          });
        }
      }
    }

    var { error: updErr2 } = await client.from('movies').update(movieData)
      .eq('id', item.entityId).eq('user_id', userId);
    if (updErr2) throw new Error(updErr2.message);
  },

  async _syncSettings(item, client, userId) {
    if (item.action === 'update') {
      var { error } = await client.from('settings').upsert(
        Object.assign({}, item.data, { user_id: userId, updated_at: new Date().toISOString() }),
        { onConflict: 'user_id' }
      );
      if (error) throw new Error(error.message);
    }
  },

  /**
   * Download remote changes and merge with local data.
   * Compares timestamps — remote wins only if strictly newer.
   */
  async downloadRemoteChanges() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!userId) return;

    try {
      var { data: remoteMovies, error } = await client
        .from('movies').select('*').eq('user_id', userId);

      if (error) throw new Error(error.message);

      var localMovies = Logit.Storage.loadMovies();
      var localMap = new Map(localMovies.map(function(m) { return [m.id, m]; }));
      var remoteIds = new Set();

      (remoteMovies || []).forEach(function(remoteMovie) {
        remoteIds.add(remoteMovie.id);
        var sanitized = Logit.Sync._sanitizeRemote(remoteMovie);
        var localMovie = localMap.get(remoteMovie.id);

        if (!localMovie) {
          localMovies.push(sanitized);
        } else {
          var remoteTime = new Date(remoteMovie.updated_at || 0).getTime();
          var localTime = new Date(localMovie.updated_at || 0).getTime();
          if (remoteTime > localTime) {
            Object.assign(localMovie, sanitized);
          }
        }
      });

      Logit.Storage.saveMoviesRaw(localMovies);
    } catch (e) {
      console.error('Failed to download remote changes:', e);
      throw e;
    }
  },

  _sanitizeRemote(movie) {
    var copy = Object.assign({}, movie);
    delete copy.user_id;
    delete copy.created_at;
    delete copy.updated_at;
    return copy;
  },

  /**
   * Delete a movie from cloud and track the deletion.
   */
  async deleteFromCloud(movieId) {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return;

    try {
      await client.from('movies').delete().eq('id', movieId).eq('user_id', userId);
    } catch (e) {
      console.error('Cloud delete failed:', e);
    }

    var deleted = JSON.parse(localStorage.getItem('logit_deleted_ids') || '[]');
    if (deleted.indexOf(movieId) === -1) {
      deleted.push(movieId);
      localStorage.setItem('logit_deleted_ids', JSON.stringify(deleted));
    }
  },

  /**
   * Upload existing local movies to cloud on first login.
   * Skips if cloud already has data.
   */
  async uploadExistingMovies() {
    if (Logit.Auth.isOfflineMode()) return { success: false };

    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return { success: false };

    try {
      var { data: existing } = await client
        .from('movies').select('id').eq('user_id', userId).limit(1);

      if (existing && existing.length > 0) {
        return { success: true, count: 0, skipped: true };
      }

      var localMovies = Logit.Storage.loadMovies();
      if (localMovies.length === 0) return { success: true, count: 0 };

      var now = new Date().toISOString();
      var moviesToInsert = localMovies.map(function(m) {
        return Object.assign({}, m, { user_id: userId, created_at: now, updated_at: now });
      });

      var { error } = await client.from('movies').upsert(moviesToInsert, { onConflict: 'id' });
      if (error) throw new Error(error.message);

      return { success: true, count: localMovies.length };
    } catch (e) {
      console.error('Upload error:', e);
      return { success: false, message: e.message };
    }
  },

  manualSync() { return this.sync(); },

  onSyncStatusChange(callback) { this._syncStatusCallbacks.push(callback); },

  notifySyncStatus(status) {
    this._syncStatusCallbacks.forEach(function(cb) { cb(status); });
  },

  getSyncStatus() {
    if (!navigator.onLine) return 'offline';
    if (this._syncInProgress) return 'syncing';
    return 'synced';
  },

  getLastSyncTime() {
    return this._lastSyncTime ? new Date(this._lastSyncTime) : null;
  }
};
