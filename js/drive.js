window.Logit = window.Logit || {};

/**
 * Google Drive Integration Module for Logit
 * Provides authentication, automated backup, restore, and profile info capabilities.
 */
Logit.Drive = {
  _CLIENT_ID: '526761149863-6hd6eg1mqjnj41ajtesr2k8g7ch70ail.apps.googleusercontent.com',
  _SCOPE: 'https://www.googleapis.com/auth/drive.file',
  _FOLDER_NAME: 'Logit',
  _FOLDER_KEY: 'logit_drive_folder_id',
  _TOKEN_KEY: 'logit_drive_token',
  _USER_EMAIL_KEY: 'logit_drive_user_email',
  _USER_NAME_KEY: 'logit_drive_user_name',

  _tokenClient: null,
  _accessToken: null,
  _onAuthSuccess: null,
  _onAuthError: null,

  /**
   * Initialize Google Auth Token Client & load stored credentials.
   */
  init() {
    const savedToken = localStorage.getItem(this._TOKEN_KEY);
    if (savedToken) {
      this._accessToken = savedToken;
    }

    if (window.google && google.accounts && google.accounts.oauth2) {
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this._CLIENT_ID,
        scope: this._SCOPE,
        callback: (response) => {
          if (response.error) {
            console.error('[Drive] Auth error:', response);
            if (this._onAuthError) this._onAuthError(response);
            return;
          }
          this._accessToken = response.access_token;
          localStorage.setItem(this._TOKEN_KEY, response.access_token);
          console.log('[Drive] Authentication successful');
          
          // Fetch user info right after auth
          this.getUserInfo().catch(e => console.warn(e));

          if (this._onAuthSuccess) this._onAuthSuccess(response);
        },
      });
    } else {
      console.warn('[Drive] Google Accounts OAuth2 library (gsi/client) is not loaded.');
    }
  },

  /**
   * Request OAuth access token from user via Google popup if needed.
   * @param {Function} [onSuccess]
   * @param {Function} [onError]
   * @param {boolean} [forcePrompt=false]
   */
  requestAuth(onSuccess, onError, forcePrompt = false) {
    this._onAuthSuccess = onSuccess || null;
    this._onAuthError = onError || null;

    if (!this._tokenClient) {
      this.init();
    }

    if (!this._tokenClient) {
      const err = new Error('Google Identity Services SDK not loaded.');
      console.error('[Drive]', err.message);
      if (onError) onError(err);
      return;
    }

    if (!forcePrompt && this._accessToken) {
      if (onSuccess) onSuccess({ access_token: this._accessToken });
      return;
    }

    this._tokenClient.requestAccessToken(forcePrompt ? { prompt: 'consent' } : {});
  },

  /**
   * Check if client currently holds an access token.
   * @returns {boolean}
   */
  isAuthenticated() {
    return Boolean(this._accessToken);
  },

  /**
   * Fetch connected Google user profile info.
   * @returns {Promise<{email: string, name: string, photo: string} | null>}
   */
  async getUserInfo() {
    if (!this._accessToken) return null;
    try {
      const res = await this._apiFetch('https://www.googleapis.com/drive/v3/about?fields=user');
      const data = await res.json();
      if (data && data.user) {
        const info = {
          email: data.user.emailAddress || '',
          name: data.user.displayName || '',
          photo: data.user.photoLink || ''
        };
        if (info.email) localStorage.setItem(this._USER_EMAIL_KEY, info.email);
        if (info.name) localStorage.setItem(this._USER_NAME_KEY, info.name);
        return info;
      }
      return null;
    } catch (e) {
      console.warn('[Drive] Failed to fetch user info:', e);
      return null;
    }
  },

  /**
   * Clear access token and cached folder ID & user info from local storage.
   */
  clearToken() {
    this._accessToken = null;
    localStorage.removeItem(this._TOKEN_KEY);
    localStorage.removeItem(this._FOLDER_KEY);
    localStorage.removeItem(this._USER_EMAIL_KEY);
    localStorage.removeItem(this._USER_NAME_KEY);
  },

  /**
   * Sign out and revoke Google token.
   */
  signOut() {
    if (this._accessToken && window.google?.accounts?.oauth2) {
      try {
        google.accounts.oauth2.revoke(this._accessToken, () => {
          console.log('[Drive] Access token revoked.');
        });
      } catch (e) {
        console.warn('[Drive] Error revoking token:', e);
      }
    }
    this.clearToken();
  },

  /**
   * Perform backup to Google Drive.
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async backup() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      // 1. Gather local data
      const movies = (await Logit.Storage.loadMovies()) || [];
      const settings = await this._loadSettings();
      const backupData = {
        version: 1,
        created: new Date().toISOString(),
        moviesCount: movies.length,
        movies: movies,
        settings: settings
      };

      const content = JSON.stringify(backupData, null, 2);
      const now = new Date();
      const dateStr = now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
      const fileName = `logit-${movies.length}-movies-${dateStr}.json`;

      // 2. Ensure destination folder exists
      const folderId = await this._getOrCreateFolder();

      // 3. Check for existing backup file with same name
      const existingFileId = await this._findFileByName(fileName, folderId);

      // 4. Save file
      if (existingFileId) {
        await this._updateFileContent(existingFileId, content);
      } else {
        await this._createFile(fileName, content, folderId);
      }

      return { success: true, message: `Backup saved: ${fileName}` };
    } catch (err) {
      console.error('[Drive] Backup failed:', err);
      return { success: false, message: `Backup failed: ${err.message}` };
    }
  },

  /**
   * Restore movies and settings from latest Google Drive backup.
   * @returns {Promise<{success: boolean, count?: number, message: string}>}
   */
  async restore() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      const folderId = await this._getOrCreateFolder();
      const files = await this._listBackupFiles(folderId);

      if (!files || files.length === 0) {
        return { success: false, message: 'No backup files found in Logit folder' };
      }

      // Sort files by modifiedTime descending or name descending
      files.sort((a, b) => {
        const timeA = a.createdTime || a.modifiedTime || a.name;
        const timeB = b.createdTime || b.modifiedTime || b.name;
        return timeB.localeCompare(timeA);
      });

      const latestFile = files[0];
      const rawContent = await this._downloadFileContent(latestFile.id);
      const backupData = JSON.parse(rawContent);

      if (!backupData || !Array.isArray(backupData.movies)) {
        return { success: false, message: 'Invalid backup file format' };
      }

      let restoredCount = 0;
      for (const movie of backupData.movies) {
        if (movie && (movie.id || movie.t)) {
          await Logit.Storage.saveMovie(movie, 'create');
          restoredCount++;
        }
      }

      return {
        success: true,
        count: restoredCount,
        message: `${restoredCount} movies restored from ${latestFile.name}`
      };
    } catch (err) {
      console.error('[Drive] Restore failed:', err);
      return { success: false, message: `Restore failed: ${err.message}` };
    }
  },

  // ==========================================
  // Private Helper & API Methods
  // ==========================================

  /**
   * Universal HTTP fetch helper for Google Drive API.
   */
  async _apiFetch(url, options = {}) {
    if (!this._accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${this._accessToken}`;

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      this.clearToken();
      throw new Error('Google Drive authorization expired. Please connect to Google Drive again.');
    }

    if (!response.ok) {
      let errText = '';
      try {
        const errJson = await response.json();
        errText = errJson.error?.message || response.statusText;
      } catch (e) {
        errText = (await response.text()) || response.statusText;
      }
      throw new Error(`Drive API Error (${response.status}): ${errText}`);
    }

    return response;
  },

  async _loadSettings() {
    if (!Logit.Supabase || !Logit.Supabase.getClient) return {};
    const client = Logit.Supabase.getClient();
    const userId = localStorage.getItem('logit_user_id');
    if (!client || !userId) return {};
    try {
      const { data } = await client.from('settings').select('*').eq('user_id', userId).single();
      return data || {};
    } catch (e) {
      return {};
    }
  },

  async _getOrCreateFolder() {
    const cachedId = localStorage.getItem(this._FOLDER_KEY);
    if (cachedId) {
      try {
        const res = await this._apiFetch(`https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`);
        const folder = await res.json();
        if (folder && !folder.trashed) {
          return cachedId;
        }
      } catch (e) {
        console.warn('[Drive] Cached folder invalid or deleted, searching again...');
        localStorage.removeItem(this._FOLDER_KEY);
      }
    }

    const q = encodeURIComponent(`mimeType = 'application/vnd.google-apps.folder' and name = '${this._FOLDER_NAME}' and trashed = false`);
    const res = await this._apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      const folderId = data.files[0].id;
      localStorage.setItem(this._FOLDER_KEY, folderId);
      return folderId;
    }

    const createRes = await this._apiFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        name: this._FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder'
      })
    });
    const newFolder = await createRes.json();
    localStorage.setItem(this._FOLDER_KEY, newFolder.id);
    return newFolder.id;
  },

  async _findFileByName(fileName, folderId) {
    const q = encodeURIComponent(`'${folderId}' in parents and name = '${fileName}' and trashed = false`);
    const res = await this._apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`);
    const data = await res.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  },

  async _listBackupFiles(folderId) {
    const q = encodeURIComponent(`'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`);
    const res = await this._apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,modifiedTime)`);
    const data = await res.json();
    if (!data.files) return [];

    return data.files.filter(f => f.name && (f.name.startsWith('logit-') || f.name.endsWith('.json')));
  },

  async _createFile(fileName, contentText, folderId) {
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json'
    };

    const boundary = 'logit_drive_boundary_' + Date.now().toString(36);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body = delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      contentText +
      closeDelimiter;

    const res = await this._apiFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: body
    });

    return await res.json();
  },

  async _updateFileContent(fileId, contentText) {
    const res = await this._apiFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: contentText
    });

    return await res.json();
  },

  async _downloadFileContent(fileId) {
    const res = await this._apiFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    return await res.text();
  }
};
