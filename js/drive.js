window.Logit = window.Logit || {};

/**
 * Google Drive Integration
 */
Logit.Drive = {
  _tokenClient: null,
  _accessToken: null,
  _FOLDER_NAME: 'Logit',
  _FOLDER_KEY: 'logit_drive_folder_id',
  _TOKEN_KEY: 'logit_drive_token',

  init() {
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

  requestAuth(onSuccess) {
    this._onAuthSuccess = onSuccess || function() {};
    this._accessToken = null;
    localStorage.removeItem(this._TOKEN_KEY);
    this._tokenClient.requestAccessToken();
  },

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

      var now = new Date();
      var dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      var fileName = 'logit-' + movies.length + '-movies-' + dateStr + '.json';

      var folderId = await this._getOrCreateFolder();
      var existingFileId = await this._findFile(fileName, folderId);

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

  async restore() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      var folderId = await this._getOrCreateFolder();
      var files = await this._listFiles(folderId);

      if (files.length === 0) {
        return { success: false, message: 'No backup found in Logit folder' };
      }

      // Sort by name (includes date) to get latest
      files.sort(function(a, b) { return b.name.localeCompare(a.name); });
      var latestFile = files[0];

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

  async _apiCall(method, url, body) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + Logit.Drive._accessToken);
      if (body) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status === 401) {
          Logit.Drive._accessToken = null;
          localStorage.removeItem('logit_drive_token');
          reject(new Error('Token expired. Click Backup to Drive again.'));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } else {
          reject(new Error('API error ' + xhr.status));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(body ? JSON.stringify(body) : null);
    });
  },

  async _getOrCreateFolder() {
    var cached = localStorage.getItem(this._FOLDER_KEY);
    if (cached) {
      console.log('Using cached folder ID:', cached);
      return cached;
    }

    console.log('Listing all files to find Logit folder...');
    var data = await this._apiCall('GET', 'https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name,mimeType)');
    console.log('All files:', data.files);

    if (data.files) {
      var folder = data.files.find(function(f) {
        return f.name === 'Logit' && f.mimeType === 'application/vnd.google-apps.folder';
      });
      if (folder) {
        console.log('Found existing Logit folder:', folder.id);
        localStorage.setItem(this._FOLDER_KEY, folder.id);
        return folder.id;
      }
    }

    console.log('Creating new Logit folder...');
    var newFolder = await this._apiCall('POST', 'https://www.googleapis.com/drive/v3/files', {
      name: 'Logit',
      mimeType: 'application/vnd.google-apps.folder'
    });
    console.log('Created folder:', newFolder);

    localStorage.setItem(this._FOLDER_KEY, newFolder.id);
    return newFolder.id;
  },

  async _findFile(name, folderId) {
    var data = await this._apiCall('GET', 'https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)');
    if (!data.files) return null;

    var file = data.files.find(function(f) {
      return f.name === name;
    });
    return file ? file.id : null;
  },

  async _listFiles(folderId) {
    var data = await this._apiCall('GET', 'https://www.googleapis.com/drive/v3/files?spaces=drive&fields=files(id,name)');
    if (!data.files) return [];

    return data.files.filter(function(f) {
      return f.name && f.name.indexOf('logit-') === 0 && f.name.indexOf('-movies-') > 0;
    });
  },

  async _uploadFile(name, blob, folderId) {
    return new Promise(function(resolve, reject) {
      var metadata = { name: name, parents: [folderId] };
      var boundary = '----FormBoundary' + Math.random().toString(36).substr(2);

      var body = '--' + boundary + '\r\n'
        + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
        + JSON.stringify(metadata) + '\r\n'
        + '--' + boundary + '\r\n'
        + 'Content-Type: application/json\r\n\r\n'
        + blob.text() + '\r\n'
        + '--' + boundary + '--';

      blob.text().then(function(content) {
        var fullBody = '--' + boundary + '\r\n'
          + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
          + JSON.stringify(metadata) + '\r\n'
          + '--' + boundary + '\r\n'
          + 'Content-Type: application/json\r\n\r\n'
          + content + '\r\n'
          + '--' + boundary + '--';

        var xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', true);
        xhr.setRequestHeader('Authorization', 'Bearer ' + Logit.Drive._accessToken);
        xhr.setRequestHeader('Content-Type', 'multipart/related; boundary=' + boundary);
        xhr.onload = function() {
          if (xhr.status === 401) {
            Logit.Drive._accessToken = null;
            localStorage.removeItem('logit_drive_token');
            reject(new Error('Token expired. Click Backup to Drive again.'));
            return;
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            console.error('Upload error:', xhr.status, xhr.responseText);
            reject(new Error('Upload failed: ' + xhr.status));
          }
        };
        xhr.onerror = function() { reject(new Error('Network error')); };
        xhr.send(fullBody);
      });
    });
  },

  async _updateFile(fileId, blob) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('PATCH', 'https://www.googleapis.com/upload/drive/v3/files/' + fileId + '?uploadType=media', true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + Logit.Drive._accessToken);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
        } else {
          reject(new Error('Update failed: ' + xhr.status));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(blob);
    });
  },

  async _downloadFile(fileId) {
    return new Promise(function(resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', true);
      xhr.setRequestHeader('Authorization', 'Bearer ' + Logit.Drive._accessToken);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          reject(new Error('Download failed: ' + xhr.status));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send();
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
