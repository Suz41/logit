window.Logit = window.Logit || {};

/**
 * Google Drive Integration Module for Logit
 * Provides authentication, automated backup, restore, and profile info capabilities.
 * Hardened with least-privilege OAuth scope (drive.file), payload validation, and full settings restore.
 */
Logit.Drive = {
  _CLIENT_ID:
    '526761149863-6hd6eg1mqjnj41ajtesr2k8g7ch70ail.apps.googleusercontent.com',
  // Least-privilege scope: drive.file only accesses files created/opened by Log!t
  _SCOPE:
    'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  _FOLDER_NAME: 'Logit',
  _FOLDER_KEY: 'logit_drive_folder_id',
  _TOKEN_KEY: 'logit_drive_token',
  _CONNECTED_KEY: 'logit_drive_connected',
  _USER_EMAIL_KEY: 'logit_drive_user_email',
  _USER_NAME_KEY: 'logit_drive_user_name',

  _tokenClient: null,
  _accessToken: null,

  /**
   * Initialize Google Auth Token Client & load stored credentials.
   */
  init() {
    const savedToken = sessionStorage.getItem(this._TOKEN_KEY) || localStorage.getItem(this._TOKEN_KEY);
    if (savedToken) {
      this._accessToken = savedToken;
    }

    this._waitForSDK();
  },

  _waitForSDK(retries = 0) {
    if (window.google && google.accounts && google.accounts.oauth2) {
      this._tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: this._CLIENT_ID,
        scope: this._SCOPE,
        callback: (response) => {
          if (response.error) {
            console.error('[Drive] Auth error:', response);
            return;
          }
          this._accessToken = response.access_token;
          sessionStorage.setItem(this._TOKEN_KEY, response.access_token);
          localStorage.setItem(this._TOKEN_KEY, response.access_token);
          localStorage.setItem(this._CONNECTED_KEY, 'true');
        }
      });
    } else if (retries < 10) {
      setTimeout(() => this._waitForSDK(retries + 1), 500);
    } else {
      console.warn('[Drive] Google SDK not loaded.');
    }
  },

  /**
   * Request OAuth access token from user via Google popup.
   * @param {Function} [onSuccess]
   * @param {Function} [onError]
   * @param {boolean} [forcePrompt=false]
   */
  requestAuth(onSuccess, onError, forcePrompt = false) {
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

    this._tokenClient.callback = async (response) => {
      if (response.error) {
        console.error('[Drive] Auth error:', response);
        if (onError) onError(response);
        return;
      }

      this._accessToken = response.access_token;
      sessionStorage.setItem(this._TOKEN_KEY, response.access_token);
      localStorage.setItem(this._TOKEN_KEY, response.access_token);
      localStorage.setItem(this._CONNECTED_KEY, 'true');
      console.log('[Drive] Authentication successful');

      try {
        await this.getUserInfo();
      } catch (e) {
        console.warn('[Drive] Failed to fetch user info during auth:', e);
      }

      if (onSuccess) onSuccess(response);
    };

    this._tokenClient.requestAccessToken(
      forcePrompt ? { prompt: 'consent' } : {}
    );
  },

  /**
   * Check if client currently holds an access token.
   * @returns {boolean}
   */
  isAuthenticated() {
    return Boolean(this._accessToken);
  },

  /**
   * Fetch connected Google user profile info (email, name, picture).
   * @returns {Promise<{email: string, name: string, picture: string} | null>}
   */
  async getUserInfo() {
    if (!this._accessToken) return null;

    // 1. Try Google UserInfo API endpoint
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this._accessToken}` }
      });

      if (res.status === 401) {
        this.clearToken();
        return null;
      }

      if (res.ok) {
        const data = await res.json();
        if (data && (data.email || data.name)) {
          const info = {
            email: data.email || '',
            name: data.name || '',
            picture: data.picture || ''
          };
          if (info.email)
            localStorage.setItem(this._USER_EMAIL_KEY, info.email);
          if (info.name) localStorage.setItem(this._USER_NAME_KEY, info.name);
          return info;
        }
      }
    } catch (e) {
      console.warn('[Drive] OAuth2 userinfo fetch failed:', e);
    }

    // 2. Fallback to Drive API about endpoint
    try {
      const res = await this._apiFetch(
        'https://www.googleapis.com/drive/v3/about?fields=user'
      );
      const data = await res.json();
      if (data && data.user) {
        const info = {
          email: data.user.emailAddress || '',
          name: data.user.displayName || '',
          picture: data.user.photoLink || ''
        };
        if (info.email) localStorage.setItem(this._USER_EMAIL_KEY, info.email);
        if (info.name) localStorage.setItem(this._USER_NAME_KEY, info.name);
        return info;
      }
    } catch (e) {
      console.warn('[Drive] Drive about API fetch failed:', e);
    }

    return null;
  },

  /**
   * Clear access token and cached folder ID & user info.
   */
  clearToken() {
    this._accessToken = null;
    sessionStorage.removeItem(this._TOKEN_KEY);
    localStorage.removeItem(this._TOKEN_KEY);
    localStorage.removeItem(this._CONNECTED_KEY);
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
   * Safeguarded: Never overwrites a valid backup with empty or incomplete data on query error.
   * @returns {Promise<{success: boolean, message: string, backupTime?: number}>}
   */
  async backup() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      const result = await Logit.Storage.loadMovies();

      // Safeguard 1: Abort if load error occurred
      if (result.error) {
        throw new Error(`Database fetch failed (${result.error}). Backup aborted to protect existing data.`);
      }

      if (!result.movies || !Array.isArray(result.movies)) {
        throw new Error('Invalid movie data retrieved from storage. Backup aborted.');
      }

      const movies = result.movies;
      const settings = await this._loadSettings();

      const folderId = await this._getOrCreateFolder();
      const existingFile = await this._findAndCleanBackupFiles(folderId);

      // Safeguard 2: Never overwrite a populated backup with an empty library
      if (movies.length === 0 && existingFile) {
        try {
          const rawExisting = await this._downloadFileContent(existingFile.id);
          const parsedExisting = JSON.parse(rawExisting);
          if (parsedExisting && Array.isArray(parsedExisting.movies) && parsedExisting.movies.length > 0) {
            console.warn('[Drive] Attempted to overwrite populated backup with 0 movies. Aborted.');
            return {
              success: false,
              message: `Backup aborted: current library is empty but existing backup contains ${parsedExisting.movies.length} movies. Refusing to overwrite.`
            };
          }
        } catch (checkErr) {
          console.warn('[Drive] Could not check existing backup content:', checkErr);
        }
      }

      const backupData = {
        version: 2,
        app: 'Log!t',
        created: new Date().toISOString(),
        moviesCount: movies.length,
        movies: movies,
        settings: settings
      };

      const content = JSON.stringify(backupData, null, 2);
      const now = new Date();
      const dateStr =
        now.getFullYear() +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(now.getDate()).padStart(2, '0');
      const fileName = `logit-${movies.length}-movies-${dateStr}.json`;

      console.log('[Drive] Target backup filename:', fileName);
      if (existingFile) {
        console.log(
          '[Drive] Updating existing backup file:',
          existingFile.name,
          '->',
          fileName
        );
        await this._updateAndRenameFile(existingFile.id, fileName, content);
      } else {
        console.log('[Drive] Creating new backup file:', fileName);
        await this._createFile(fileName, content, folderId);
      }

      const backupTime = Date.now();
      return {
        success: true,
        message: `Backup saved: ${fileName}`,
        backupTime: backupTime
      };
    } catch (err) {
      console.error('[Drive] Backup failed:', err);
      return { success: false, message: `Backup failed: ${err.message}` };
    }
  },

  /**
   * Restore movies and settings from latest Google Drive backup.
   * @returns {Promise<{success: boolean, count?: number, restoredSettings?: boolean, message: string}>}
   */
  async restore() {
    if (!this._accessToken) {
      return { success: false, message: 'Not authenticated with Google Drive' };
    }

    try {
      const folderId = await this._getOrCreateFolder();
      const files = await this._listBackupFiles(folderId);

      if (!files || files.length === 0) {
        return {
          success: false,
          message: 'No backup files found in Logit folder'
        };
      }

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

      const validMovies = backupData.movies.filter(function (movie) {
        return movie && (movie.id || movie.t);
      });
      const restoredCount = await Logit.Storage.saveMoviesBulk(validMovies);

      // Restore user settings if present in backup (Finding 8)
      let restoredSettings = false;
      if (backupData.settings && typeof backupData.settings === 'object') {
        restoredSettings = await this._restoreSettings(backupData.settings);
      }

      return {
        success: true,
        count: restoredCount,
        restoredSettings: restoredSettings,
        message: `${restoredCount} movies ${restoredSettings ? 'and settings ' : ''}restored from ${latestFile.name}`
      };
    } catch (err) {
      console.error('[Drive] Restore failed:', err);
      return { success: false, message: `Restore failed: ${err.message}` };
    }
  },

  // ==========================================
  // Private Helper & API Methods
  // ==========================================

  async _apiFetch(url, options = {}) {
    if (!this._accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${this._accessToken}`;

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      this.clearToken();
      throw new Error(
        'Google Drive authorization expired. Please connect to Google Drive again.'
      );
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
    const userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId) return {};
    try {
      const { data } = await client
        .from('settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      return data || {};
    } catch (e) {
      return {};
    }
  },

  async _restoreSettings(settingsData) {
    if (!Logit.Supabase || !Logit.Supabase.getClient) return false;
    const client = Logit.Supabase.getClient();
    const userId = Logit.Auth ? Logit.Auth.getUserId() : localStorage.getItem('logit_user_id');
    if (!client || !userId || !settingsData) return false;

    try {
      const payload = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };
      if (Array.isArray(settingsData.favorites)) {
        payload.favorites = settingsData.favorites;
      }
      if (settingsData.avatar !== undefined) {
        payload.avatar = settingsData.avatar;
      }
      const { error } = await client.from('settings').upsert(payload, { onConflict: 'user_id' });
      return !error;
    } catch (e) {
      console.warn('[Drive] Failed restoring settings from backup:', e);
      return false;
    }
  },

  async _getOrCreateFolder() {
    const cachedId = localStorage.getItem(this._FOLDER_KEY);
    if (cachedId) {
      try {
        const res = await this._apiFetch(
          `https://www.googleapis.com/drive/v3/files/${cachedId}?fields=id,trashed`
        );
        const folder = await res.json();
        if (folder && !folder.trashed) {
          return cachedId;
        }
      } catch (e) {
        localStorage.removeItem(this._FOLDER_KEY);
      }
    }

    const q = encodeURIComponent(
      `mimeType = 'application/vnd.google-apps.folder' and name = '${this._FOLDER_NAME}' and trashed = false`
    );
    const res = await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`
    );
    const data = await res.json();

    if (data.files && data.files.length > 0) {
      const folderId = data.files[0].id;
      localStorage.setItem(this._FOLDER_KEY, folderId);
      return folderId;
    }

    const createRes = await this._apiFetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({
          name: this._FOLDER_NAME,
          mimeType: 'application/vnd.google-apps.folder'
        })
      }
    );
    const newFolder = await createRes.json();
    localStorage.setItem(this._FOLDER_KEY, newFolder.id);
    return newFolder.id;
  },

  async _listBackupFiles(folderId) {
    const q = encodeURIComponent(
      `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
    );
    const res = await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,modifiedTime)`
    );
    const data = await res.json();
    if (!data.files) return [];

    return data.files.filter(
      (f) => f.name && (f.name.startsWith('logit-') || f.name.endsWith('.json'))
    );
  },

  /**
   * Get the last backup time from Google Drive
   * @returns {Promise<number|null>} timestamp or null
   */
  async getLastBackupTime() {
    if (!this._accessToken) return null;
    try {
      const folderId = await this._getOrCreateFolder();
      const files = await this._listBackupFiles(folderId);
      if (!files || files.length === 0) return null;
      files.sort((a, b) =>
        (b.modifiedTime || '').localeCompare(a.modifiedTime || '')
      );
      return files[0].modifiedTime
        ? new Date(files[0].modifiedTime).getTime()
        : null;
    } catch (e) {
      return null;
    }
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

    const body =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      contentText +
      closeDelimiter;

    const res = await this._apiFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: body
      }
    );

    return await res.json();
  },

  async _downloadFileContent(fileId) {
    const res = await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
    );
    return await res.text();
  },

  async _findAndCleanBackupFiles(folderId) {
    const q = encodeURIComponent(
      `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`
    );
    const res = await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)`
    );
    const data = await res.json();
    if (!data.files) return null;

    const backups = data.files.filter(
      (f) => f.name && f.name.startsWith('logit-') && f.name.endsWith('.json')
    );
    if (backups.length === 0) return null;

    backups.sort((a, b) =>
      (b.createdTime || '').localeCompare(a.createdTime || '')
    );

    const targetFile = backups[0];

    // Clean up older duplicate backup files to keep folder orderly
    for (let i = 1; i < backups.length; i++) {
      try {
        await this._deleteFile(backups[i].id);
      } catch (e) {
        console.warn('[Drive] Failed to delete older backup file:', e);
      }
    }

    return targetFile;
  },

  async _updateAndRenameFile(fileId, newName, contentText) {
    // 1. Update metadata (rename)
    await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name: newName })
      }
    );

    // 2. Update media content
    await this._apiFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: contentText
      }
    );
  },

  async _deleteFile(fileId) {
    return await this._apiFetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE'
      }
    );
  }
};
