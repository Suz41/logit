window.Logit = window.Logit || {};

/**
 * Offline Queue Manager
 * Queues changes when offline and syncs when online.
 * Handles deduplication, compaction, and retry limits.
 */
Logit.Offline = {
  _QUEUE_KEY: 'logit_sync_queue',
  _MAX_RETRIES: 5,

  getQueue() {
    try {
      var raw = localStorage.getItem(this._QUEUE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Corrupted sync queue, resetting');
      localStorage.removeItem(this._QUEUE_KEY);
      return [];
    }
  },

  saveQueue(queue) {
    try {
      localStorage.setItem(this._QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  },

  /**
   * Add item to queue. Deduplicates: if an update for the same entity
   * is already pending, replaces it with the newer data.
   */
  enqueue(action, entity, entityId, data) {
    var queue = this.getQueue();
    var item = {
      id: this._generateId(),
      action: action,
      entity: entity,
      entityId: entityId,
      data: data,
      timestamp: new Date().toISOString(),
      synced: false,
      error: null,
      retries: 0
    };

    // Deduplicate: remove older pending items for the same entity
    if (action === 'update' || action === 'delete') {
      queue = queue.filter(function(q) {
        return !(q.entity === entity && q.entityId === entityId && !q.synced);
      });
    }

    queue.push(item);
    this.saveQueue(queue);
    return item;
  },

  markSynced(queueItemId) {
    var queue = this.getQueue();
    var item = queue.find(function(q) { return q.id === queueItemId; });
    if (item) {
      item.synced = true;
      item.error = null;
      this.saveQueue(queue);
    }
  },

  markError(queueItemId, error) {
    var queue = this.getQueue();
    var item = queue.find(function(q) { return q.id === queueItemId; });
    if (item) {
      item.error = error;
      item.retries = (item.retries || 0) + 1;
      this.saveQueue(queue);
    }
  },

  getPending() {
    return this.getQueue().filter(function(q) {
      return !q.synced && (q.retries || 0) < Logit.Offline._MAX_RETRIES;
    });
  },

  getFailed() {
    return this.getQueue().filter(function(q) {
      return q.error !== null && (q.retries || 0) >= Logit.Offline._MAX_RETRIES;
    });
  },

  clearSynced() {
    var queue = this.getQueue();
    var remaining = queue.filter(function(q) {
      // Keep unsynced items and items that haven't exceeded retry limit
      return !q.synced;
    });
    this.saveQueue(remaining);
  },

  clearAll() {
    localStorage.removeItem(this._QUEUE_KEY);
  },

  /**
   * Compact the queue: remove permanently failed items and
   * collapse multiple updates for the same entity into one.
   */
  compact() {
    var queue = this.getQueue();

    // Remove permanently failed items (exceeded retry limit)
    queue = queue.filter(function(q) {
      return !q.error || (q.retries || 0) < Logit.Offline._MAX_RETRIES;
    });

    // Collapse: for each entity, keep only the latest pending item
    var collapsed = {};
    var result = [];
    queue.forEach(function(item) {
      var key = item.entity + ':' + item.entityId;
      if (item.synced) {
        result.push(item);
      } else if (!collapsed[key]) {
        collapsed[key] = item;
        result.push(item);
      } else {
        // Replace older item with newer one
        var idx = result.indexOf(collapsed[key]);
        if (idx !== -1) {
          result[idx] = item;
          collapsed[key] = item;
        }
      }
    });

    this.saveQueue(result);
    return result;
  },

  _generateId() {
    return 'sync_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },

  getStats() {
    var queue = this.getQueue();
    var pending = 0, failed = 0, synced = 0;
    queue.forEach(function(q) {
      if (q.synced && !q.error) synced++;
      else if (q.error && (q.retries || 0) >= Logit.Offline._MAX_RETRIES) failed++;
      else pending++;
    });
    return { total: queue.length, pending: pending, failed: failed, synced: synced };
  }
};
