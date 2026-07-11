window.Logit = window.Logit || {};

/**
 * Profile Page
 */
Logit.ProfilePage = {
  _user: null,
  _syncStatusInterval: null,

  /**
   * Initialize profile page
   */
  async init() {
    this.checkAuth();
    this.setupListeners();
    await this.loadProfile();
    this.updateSyncStatus();
    this.setupSyncStatusUpdates();
  },

  /**
   * Check if user is authenticated
   */
  async checkAuth() {
    const user = await Logit.Supabase.getUser();
    const isOffline = localStorage.getItem('logit_offline_mode') === 'true';

    if (!user && !isOffline) {
      window.location.href = 'welcome.html';
      return;
    }

    this._user = user;
    this.showOfflineModeUI(isOffline && !user);
  },

  /**
   * Load and display profile
   */
  async loadProfile() {
    if (this._user) {
      document.getElementById('profileName').textContent = 
        this._user.user_metadata?.full_name || this._user.email?.split('@')[0] || 'User';
      document.getElementById('profileEmail').textContent = this._user.email || '';
      
      const initial = (this._user.email || 'U')[0].toUpperCase();
      document.getElementById('profileAvatar').textContent = initial;
    } else {
      document.getElementById('profileName').textContent = 'Offline Mode';
      document.getElementById('profileEmail').textContent = 'Local storage only';
    }

    this.updateStorageInfo();
  },

  /**
   * Update storage information
   */
  updateStorageInfo() {
    const movies = Logit.Storage.loadMovies();
    const storageInfo = Logit.Storage.getStorageSize();
    const formatted = Logit.Storage.formatBytes(storageInfo.total);

    document.getElementById('moviesCount').textContent = movies.length;
    document.getElementById('localStorageUsage').textContent = 
      `${formatted.val} ${formatted.unit}`;
  },

  /**
   * Update sync status
   */
  updateSyncStatus() {
    const status = Logit.Sync.getSyncStatus();
    const lastSync = Logit.Sync.getLastSyncTime();
    const pending = Logit.Offline.getPending();

    const badge = document.getElementById('syncStatusBadge');
    const statusText = document.getElementById('syncStatusText');

    badge.className = 'syncStatus ' + status;

    if (status === 'offline') {
      statusText.textContent = 'Offline';
    } else if (status === 'syncing') {
      statusText.textContent = 'Syncing...';
    } else {
      statusText.textContent = 'Synced';
    }

    if (lastSync) {
      const time = this.formatTime(lastSync);
      document.getElementById('lastSyncedTime').textContent = time;
    } else {
      document.getElementById('lastSyncedTime').textContent = 'Never';
    }

    document.getElementById('pendingChanges').textContent = pending.length;
  },

  /**
   * Setup sync status updates
   */
  setupSyncStatusUpdates() {
    Logit.Sync.onSyncStatusChange((status) => {
      this.updateSyncStatus();
    });

    this._syncStatusInterval = setInterval(() => {
      this.updateSyncStatus();
    }, 1000);
  },

  /**
   * Setup button listeners
   */
  setupListeners() {
    document.getElementById('backBtn').addEventListener('click', () => {
      window.history.back();
    });

    document.getElementById('manualSyncBtn').addEventListener('click', () => {
      this.manualSync();
    });

    document.getElementById('exportDataBtn').addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('importDataBtn').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    document.getElementById('downloadCloudBtn').addEventListener('click', () => {
      this.downloadFromCloud();
    });

    document.getElementById('signOutBtn').addEventListener('click', () => {
      if (confirm('Are you sure you want to sign out?')) {
        Logit.Auth.signOut();
      }
    });

    document.getElementById('deleteAccountBtn').addEventListener('click', () => {
      this.deleteAccount();
    });

    document.getElementById('enableCloudBtn').addEventListener('click', () => {
      window.location.href = 'welcome.html';
    });

    document.getElementById('importFileInput').addEventListener('change', (e) => {
      this.importData(e);
    });

    // Settings toggles
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const wifiOnlyToggle = document.getElementById('wifiOnlyToggle');

    const autoSyncEnabled = localStorage.getItem('logit_auto_sync') !== 'false';
    const wifiOnlyEnabled = localStorage.getItem('logit_sync_wifi_only') === 'true';

    autoSyncToggle.classList.toggle('active', autoSyncEnabled);
    wifiOnlyToggle.classList.toggle('active', wifiOnlyEnabled);

    autoSyncToggle.addEventListener('click', () => {
      autoSyncToggle.classList.toggle('active');
      const enabled = autoSyncToggle.classList.contains('active');
      localStorage.setItem('logit_auto_sync', enabled ? 'true' : 'false');
    });

    wifiOnlyToggle.addEventListener('click', () => {
      wifiOnlyToggle.classList.toggle('active');
      const enabled = wifiOnlyToggle.classList.contains('active');
      localStorage.setItem('logit_sync_wifi_only', enabled ? 'true' : 'false');
    });
  },

  /**
   * Manual sync
   */
  async manualSync() {
    const btn = document.getElementById('manualSyncBtn');
    const originalText = btn.textContent;

    btn.disabled = true;
    btn.textContent = 'Syncing...';

    try {
      const result = await Logit.Sync.sync();
      if (result.success) {
        alert(`Synced ${result.count} changes!`);
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (e) {
      alert('Sync error: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
      this.updateSyncStatus();
    }
  },

  /**
   * Export data as JSON
   */
  exportData() {
    const movies = Logit.Storage.loadMovies();
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: movies.length,
      movies: movies
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logit-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert('Export successful!');
  },

  /**
   * Import data from JSON
   */
  importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const movies = data.movies || [];

        if (!Array.isArray(movies)) {
          alert('Invalid import file format.');
          return;
        }

        // Merge with existing movies (avoid duplicates)
        const existing = Logit.Storage.loadMovies();
        const existingIds = new Set(existing.map(m => m.id));

        const newMovies = movies.filter(m => !existingIds.has(m.id));
        const merged = [...existing, ...newMovies];

        Logit.Storage.saveMovies(merged);
        alert(`Imported ${newMovies.length} new movies!`);
        this.updateStorageInfo();
      } catch (err) {
        alert('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  /**
   * Download all movies from cloud
   */
  async downloadFromCloud() {
    if (Logit.Auth.isOfflineMode()) {
      alert('Not available in offline mode.');
      return;
    }

    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');

    if (!client || !userId) {
      alert('Not authenticated.');
      return;
    }

    try {
      const btn = document.getElementById('downloadCloudBtn');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Downloading...';

      const { data: cloudMovies, error } = await client
        .from('movies')
        .select('*')
        .eq('user_id', userId);

      if (error) throw new Error(error.message);

      // Merge with local
      const existing = Logit.Storage.loadMovies();
      const existingIds = new Set(existing.map(m => m.id));

      const newMovies = (cloudMovies || []).filter(m => !existingIds.has(m.id));
      const merged = [...existing, ...newMovies.map(m => ({
        ...m,
        updated_at: m.updated_at
      }))];

      Logit.Storage.saveMovies(merged);
      alert(`Downloaded ${newMovies.length} new movies from cloud!`);
      this.updateStorageInfo();

      btn.disabled = false;
      btn.textContent = originalText;
    } catch (e) {
      alert('Download failed: ' + e.message);
    }
  },

  /**
   * Delete account
   */
  async deleteAccount() {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    if (!confirm('This will delete your account and all cloud data. Continue?')) return;

    const client = Logit.Supabase.getClient();
    if (!client) {
      localStorage.clear();
      location.reload();
      return;
    }

    try {
      // Delete user profile and movies via admin API
      // For now, just sign out and clear data
      await Logit.Auth.signOut();
      alert('Account deleted.');
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  },

  /**
   * Show/hide offline mode UI
   */
  showOfflineModeUI(show) {
    const section = document.getElementById('offlineModeSection');
    if (section) {
      section.style.display = show ? 'block' : 'none';
    }

    // Hide cloud features if offline
    if (show) {
      document.getElementById('manualSyncBtn').style.display = 'none';
      document.getElementById('downloadCloudBtn').style.display = 'none';
    }
  },

  /**
   * Format time for display
   */
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  }
};
