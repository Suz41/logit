window.Logit = window.Logit || {};

/**
 * Google Drive Integration
 * Backup and restore movies to/from Google Drive
 */
Logit.Drive = {
  _tokenClient: null,
  _accessToken: null,
  _FILE_NAME: 'logit-movies-backup.json',
  _FOLDER_NAME: 'Logit',
  _FOLDER_KEY: 'logit_drive_folder_id',
  _TOKEN_KEY: 'logit_drive_token',

  /**
   * Initialize Google Identity Services
   */
  init() {
    // Restore saved token
    var saved = localStorage.getItem(this._TOKEN_KEY);
    if (saved) this._accessToken = saved;

    this._tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: '526761149863-6hd6eg1mqjnj41ajtesr2k8g7ch70ail.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        this._accessToken = response.access_token;
        localStorage.setItem(this._TOKEN_KEY, response.access_token);
        this._onAuthSuccess();
      },
    });
  },

  /**
   * Request Google Drive access
   */
  requestAuth(onSuccess) {
    this._onAuthSuccess = onSuccess || function() {};
    if (this._accessToken) {
      this._onAuthSuccess();
      return;
    }
    this._tokenClient.requestAccessToken();
  },

  /**
   * Backup movies to Google Drive
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async backup() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      var movies = await Logit.Storage.loadMovies();
      var settings = await this._loadSettings();
      var backupData = {
        version: 1,
        created: new Date().toISOString(),
        movies: movies,
        settings: settings
      };

      var content = JSON.stringify(backupData, null, 2);
      var blob = new Blob([content], { type: 'application/json' });

      // Ensure Logit folder exists
      var folderId = await this._getOrCreateFolder();

      // Check if backup file already exists in folder
      var existingFileId = await this._findFileInFolder(this._FILE_NAME, folderId);

      if (existingFileId) {
        // Update existing file
        await this._updateFile(existingFileId, blob);
      } else {
        // Create new file in Logit folder
        await this._createFileInFolder(this._FILE_NAME, blob, folderId);
      }

      return { success: true, message: 'Backup saved to Logit folder on Google Drive' };
    } catch (e) {
      console.error('Backup failed:', e);
      return { success: false, message: 'Backup failed: ' + e.message };
    }
  },

  /**
   * Restore movies from Google Drive
   * @returns {Promise<{success: boolean, count: number, message: string}>}
   */
  async restore() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      var folderId = await this._getOrCreateFolder();
      var fileId = await this._findFileInFolder(this._FILE_NAME, folderId);
      if (!fileId) {
        return { success: false, message: 'No backup found in Logit folder on Google Drive' };
      }

      var content = await this._downloadFile(fileId);
      var backupData = JSON.parse(content);

      if (!backupData.movies || !Array.isArray(backupData.movies)) {
        return { success: false, message: 'Invalid backup file format' };
      }

      // Restore movies
      var count = 0;
      for (var i = 0; i < backupData.movies.length; i++) {
        var movie = backupData.movies[i];
        if (movie.id && movie.t) {
          await Logit.Storage.saveMovie(movie, 'create');
          count++;
        }
      }

      return { success: true, count: count, message: count + ' movies restored from Google Drive' };
    } catch (e) {
      console.error('Restore failed:', e);
      return { success: false, message: 'Restore failed: ' + e.message };
    }
  },

  /**
   * Load current settings for backup
   */
  async _loadSettings() {
    var client = Logit.Supabase.getClient();
    var userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return {};

    try {
      var { data } = await client.from('settings').select('*').eq('user_id', userId).single();
      return data || {};
    } catch (e) {
      return {};
    }
  },

  /**
   * Get or create Logit folder in Google Drive
   */
  async _getOrCreateFolder() {
    // Check cache
    var cached = localStorage.getItem(this._FOLDER_KEY);
    if (cached) {
      // Verify it still exists
      var exists = await this._folderExists(cached);
      if (exists) return cached;
    }

    // Search for existing folder
    var response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("name='" + this._FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false") +
      '&fields=files(id)',
      {
        headers: { Authorization: 'Bearer ' + this._accessToken }
      }
    );

    var data = await response.json();
    if (data.files && data.files.length > 0) {
      localStorage.setItem(this._FOLDER_KEY, data.files[0].id);
      return data.files[0].id;
    }

    // Create folder
    var createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this._accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: this._FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });

    var folder = await createResponse.json();
    localStorage.setItem(this._FOLDER_KEY, folder.id);
    return folder.id;
  },

  async _folderExists(folderId) {
    try {
      var response = await fetch(
        'https://www.googleapis.com/drive/v3/files/' + folderId + '?fields=id',
        {
          headers: { Authorization: 'Bearer ' + this._accessToken }
        }
      );
      return response.ok;
    } catch (e) {
      return false;
    }
  },

  async _findFileInFolder(name, folderId) {
    var response = await fetch(
      'https://www.googleapis.com/drive/v3/files?q=' +
      encodeURIComponent("name='" + name + "' and '" + folderId + "' in parents and trashed=false") +
      '&fields=files(id)',
      {
        headers: { Authorization: 'Bearer ' + this._accessToken }
      }
    );

    var data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  /**
   * Create a new file in Google Drive
   */
  async _createFile(name, blob) {
    var metadata = { name: name, mimeType: 'application/json' };
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    var response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this._accessToken },
      body: form
    });

    if (!response.ok) throw new Error('Failed to create file');
    return await response.json();
  },

  /**
   * Create a new file in a specific folder
   */
  async _createFileInFolder(name, blob, folderId) {
    var metadata = { name: name, parents: [folderId], mimeType: 'application/json' };
    var form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    var response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + this._accessToken },
      body: form
    });

    if (!response.ok) throw new Error('Failed to create file');
    return await response.json();
  },

  /**
   * Update an existing file in Google Drive
   */
  async _updateFile(fileId, blob) {
    var response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + this._accessToken,
          'Content-Type': 'application/json'
        },
        body: blob
      }
    );

    if (!response.ok) throw new Error('Failed to update file');
    return await response.json();
  },

  /**
   * Download file content from Google Drive
   */
  async _downloadFile(fileId) {
    var response = await fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media',
      {
        headers: { Authorization: 'Bearer ' + this._accessToken }
      }
    );

    if (!response.ok) throw new Error('Failed to download file');
    return await response.text();
  },

  /**
   * Sign out of Google Drive
   */
  signOut() {
    if (this._accessToken) {
      google.accounts.oauth2.revoke(this._accessToken);
      this._accessToken = null;
      localStorage.removeItem(this._TOKEN_KEY);
    }
  }
};
