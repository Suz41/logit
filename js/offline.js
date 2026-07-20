window.Logit = window.Logit || {};

/**
 * Offline Queue Manager
 * Queues changes when offline and syncs when online
 * 
 * Queue format:
 * {
 *   id: uuid,
 *   action: 'create' | 'update' | 'delete',
 *   entity: 'movie' | 'settings',
 *   entityId: movie.id,
 *   data: { ...entity data },
 *   timestamp: ISO string,
 *   synced: false,
 *   error: null
 * }
 */
Logit.Offline = {
  _QUEUE_KEY: 'logit_sync_queue',
  _syncLockHolder: null,
  _syncLockTimeoutId: null,
  _DEFAULT_LOCK_TIMEOUT_MS: 30000,

  /**
   * Acquire the sync lock (mutex).
   * Returns true if lock acquired, false if already held.
   * @param {Object} [opts]
   * @param {number} [opts.timeout] - Auto-release after this many ms (default 30s)
   * @param {string} [opts.holder] - Identifier for who holds the lock
   * @returns {boolean}
   */
  acquireSyncLock(opts) {
    if (this._syncLockHolder !== null) {
      return false;
    }
    const timeout = (opts && opts.timeout) || this._DEFAULT_LOCK_TIMEOUT_MS;
    const holder = (opts && opts.holder) || 'sync';
    this._syncLockHolder = holder;

    if (this._syncLockTimeoutId !== null) {
      clearTimeout(this._syncLockTimeoutId);
      this._syncLockTimeoutId = null;
    }

    this._syncLockTimeoutId = setTimeout(() => {
      this.releaseSyncLock();
    }, timeout);

    return true;
  },

  /**
   * Release the sync lock.
   */
  releaseSyncLock() {
    this._syncLockHolder = null;
    if (this._syncLockTimeoutId !== null) {
      clearTimeout(this._syncLockTimeoutId);
      this._syncLockTimeoutId = null;
    }
  },

  /**
   * Check if sync lock is currently held.
   * @returns {boolean}
   */
  isSyncLocked() {
    return this._syncLockHolder !== null;
  },

  /**
   * Get the identifier of the current lock holder.
   * @returns {string|null}
   */
  getLockHolder() {
    return this._syncLockHolder;
  },

  /**
   * Get sync queue from localStorage
   * @returns {Array}
   */
  getQueue() {
    try {
      const cached = localStorage.getItem(this._QUEUE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error('Failed to load sync queue:', e);
      return [];
    }
  },

  /**
   * Save queue to localStorage
   * @param {Array} queue
   */
  saveQueue(queue) {
    try {
      localStorage.setItem(this._QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  },

  /**
   * Add item to queue
   * @param {string} action - 'create', 'update', or 'delete'
   * @param {string} entity - 'movie', 'settings', etc.
   * @param {string} entityId - ID of the entity
   * @param {Object} data - Entity data
   * @returns {Object} Queue item
   */
  enqueue(action, entity, entityId, data) {
    if (this.isSyncLocked()) {
      return null;
    }

    const queue = this.getQueue();
    
    const item = {
      id: this.generateId(),
      action: action,
      entity: entity,
      entityId: entityId,
      data: data,
      timestamp: new Date().toISOString(),
      synced: false,
      error: null
    };

    queue.push(item);
    this.saveQueue(queue);

    console.log(`Queued ${action} for ${entity} #${entityId}`);
    return item;
  },

  /**
   * Mark item as synced (public — blocked when sync lock held)
   * @param {string} queueItemId
   */
  markSynced(queueItemId) {
    if (this.isSyncLocked()) return;
    this._markSyncedInternal(queueItemId);
  },

  /**
   * Mark item as synced (internal — used by sync engine which holds the lock)
   * @param {string} queueItemId
   */
  _markSyncedInternal(queueItemId) {
    const queue = this.getQueue();
    const item = queue.find(q => q.id === queueItemId);
    if (item) {
      item.synced = true;
      item.error = null;
      this.saveQueue(queue);
    }
  },

  /**
   * Mark item with error (public — blocked when sync lock held)
   * @param {string} queueItemId
   * @param {string} error
   */
  markError(queueItemId, error) {
    if (this.isSyncLocked()) return;
    this._markErrorInternal(queueItemId, error);
  },

  /**
   * Mark item with error (internal — used by sync engine which holds the lock)
   * @param {string} queueItemId
   * @param {string} error
   */
  _markErrorInternal(queueItemId, error) {
    const queue = this.getQueue();
    const item = queue.find(q => q.id === queueItemId);
    if (item) {
      item.error = error;
      this.saveQueue(queue);
    }
  },

  /**
   * Get pending (unsynced) items
   * @returns {Array}
   */
  getPending() {
    return this.getQueue().filter(q => !q.synced);
  },

  /**
   * Get failed items (synced items with errors)
   * @returns {Array}
   */
  getFailed() {
    return this.getQueue().filter(q => q.error !== null);
  },

  /**
   * Clear synced items (public — blocked when sync lock held)
   */
  clearSynced() {
    if (this.isSyncLocked()) return;
    this._clearSyncedInternal();
  },

  /**
   * Clear synced items (internal — used by sync engine which holds the lock)
   */
  _clearSyncedInternal() {
    const queue = this.getQueue();
    const pending = queue.filter(q => !q.synced);
    this.saveQueue(pending);
  },

  /**
   * Clear all queue (public — blocked when sync lock held)
   */
  clearAll() {
    if (this.isSyncLocked()) return;
    localStorage.removeItem(this._QUEUE_KEY);
  },

  /**
   * Generate unique ID
   * @returns {string}
   */
  generateId() {
    return 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Get queue stats
   * @returns {Object}
   */
  getStats() {
    const queue = this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(q => !q.synced).length,
      failed: queue.filter(q => q.error !== null).length,
      synced: queue.filter(q => q.synced && !q.error).length
    };
  },

  /**
   * Format queue for display
   * @returns {Array}
   */
  getFormattedQueue() {
    return this.getQueue().map(item => ({
      ...item,
      statusLabel: item.synced ? (item.error ? 'Failed' : 'Synced') : 'Pending',
      statusClass: item.synced ? (item.error ? 'error' : 'synced') : 'pending'
    }));
  }
};
