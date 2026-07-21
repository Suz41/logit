window.Logit = window.Logit || {};

/**
 * Google Drive Integration
 * Uses Google API Client Library (gapi) to avoid CORS issues
 */
Logit.Drive = {
  _tokenClient: null,
  _accessToken: null,
  _FOLDER_NAME: 'Logit',
  _FOLDER_KEY: 'logit_drive_folder_id',
  _TOKEN_KEY: 'logit_drive_token',
  _API_KEY: 'AIzaSyD-ExampleKey', // Not needed with OAuth, but gapi requires it

  /**
   * Initialize Google Identity Services + gapi
   */
  init() {
    // Restore saved token
    var saved = localStorage.getItem(this._TOKEN_KEY);
    if (saved) this._accessToken = saved;

    this._tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: '526761149863-6hd6eg1mqjnj41ajtesr2k8g7ch70ail.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (response) => {
        if (response.error) {
          console.error('Auth error:', response);
          return;
        }
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
   * Make authenticated request to Google Drive API using gapi
   */
  async _gapiRequest(method, url, body) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this._accessToken);
      if (body) {
        xhr.setRequestHeader('Content-Type', 'application/json');
      }
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } else {
          reject(new Error('API error: ' + xhr.status + ' ' + xhr.responseText));
        }
      };
      xhr.onerror = function() {
        reject(new Error('Network error'));
      };
      xhr.send(body ? JSON.stringify(body) : null);
    });
  },

  /**
   * Upload file using XMLHttpRequest (avoids CORS multipart issues)
   */
  async _uploadFile(name, blob, folderId) {
    return new Promise((resolve, reject) => {
      var metadata = {
        name: name,
        mimeType: 'application/json'
      };
      if (folderId) metadata.parents = [folderId];

      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this._accessToken);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('Upload failed: ' + xhr.status + ' ' + xhr.responseText));
        }
      };
      xhr.onerror = function() {
        reject(new Error('Network error during upload'));
      };
      xhr.send(form);
    });
  },

  /**
   * Download file content
   */
  async _downloadFile(fileId) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this._accessToken);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('Download failed: ' + xhr.status));
        }
      };
      xhr.onerror = function() {
        reject(new Error('Network error during download'));
      };
      xhr.send();
    });
  },

  /**
   * Backup movies to Google Drive
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

      // Generate dynamic filename
      var now = new Date();
      var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      var fileName = 'logit-' + movies.length + '-movies-' + dateStr + '.json';

      // Ensure Logit folder exists
      var folderId = await this._getOrCreateFolder();

      // Check if backup file already exists in folder
      var existingFileId = await this._findFileInFolder(fileName, folderId);

      if (existingFileId) {
        await this._updateFile(existingFileId, blob);
      } else {
        await this._uploadFile(fileName, blob, folderId);
      }

      return { success: true, message: 'Backup saved: ' + fileName };
    } catch (e) {
      console.error('Backup failed:', e);
      return { success: false, message: 'Backup failed: ' + e.message };
    }
  },

  /**
   * Restore movies from Google Drive
   */
  async restore() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      var folderId = await this._getOrCreateFolder();

      // Find latest backup file
      var query = encodeURIComponent("'" + folderId + "' in parents and name contains 'logit-' and name contains '-movies-' and trashed=false");
      var data = await this._gapiRequest('GET', 'https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc');

      if (!data.files || data.files.length === 0) {
        return { success: false, message: 'No backup found in Logit folder' };
      }

      var latestFile = data.files[0];
      var content = await this._downloadFile(latestFile.id);
      var backupData = JSON.parse(content);

      if (!backupData.movies || !Array.isArray(backupData.movies)) {
        return { success: false, message: 'Invalid backup file format' };
      }

      var count = 0;
      for (var i = 0; i < backupData.movies.length; i++) {
        var movie = backupData.movies[i];
        if (movie.id && movie.t) {
          await Logit.Storage.saveMovie(movie, 'create');
          count++;
        }
      }

      return { success: true, count: count, message: count + ' movies restored from ' + latestFile.name };
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
   * Get or create Logit folder
   */
  async _getOrCreateFolder() {
    var cached = localStorage.getItem(this._FOLDER_KEY);
    if (cached) return cached;

    var query = encodeURIComponent("name='" + this._FOLDER_NAME + "' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    var data = await this._gapiRequest('GET', 'https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=files(id)');

    if (data.files && data.files.length > 0) {
      localStorage.setItem(this._FOLDER_KEY, data.files[0].id);
      return data.files[0].id;
    }

    // Create folder
    var folder = await this._gapiRequest('POST', 'https://www.googleapis.com/drive/v3/files', {
      name: this._FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    });

    localStorage.setItem(this._FOLDER_KEY, folder.id);
    return folder.id;
  },

  async _findFileInFolder(name, folderId) {
    var query = encodeURIComponent("name='" + name + "' and '" + folderId + "' in parents and trashed=false");
    var data = await this._gapiRequest('GET', 'https://www.googleapis.com/drive/v3/files?q=' + query + '&fields=files(id)');
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  async _updateFile(fileId, blob) {
    return new Promise((resolve, reject) => {
      var xhr = new XMLHttpRequest();
      xhr.open('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + this._accessToken);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText || '{}'));
        } else {
          reject(new Error('Update failed: ' + xhr.status));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(blob);
    });
  },

  signOut() {
    if (this._accessToken) {
      google.accounts.oauth2.revoke(this._accessToken);
      this._accessToken = null;
      localStorage.removeItem(this._TOKEN_KEY);
    }
  }
};
