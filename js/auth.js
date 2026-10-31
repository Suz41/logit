window.Logit = window.Logit || {};

Logit.Auth = {
  _currentUser: null,
  _mode: 'signin',
  _SESSION_TIMEOUT_KEY: 'logit_session_timeout',
  _SESSION_TIMEOUT: 60 * 60 * 1000, // 60 minutes
  _activityTimer: null,
  _lastActivityUpdate: 0,

  initWelcomePage() {
    this.checkExistingSession();
    this.setupButtons();
  },

  async checkExistingSession() {
    try {
      // Check session timeout
      var lastActivity = localStorage.getItem(this._SESSION_TIMEOUT_KEY);
      if (
        lastActivity &&
        Date.now() - parseInt(lastActivity, 10) > this._SESSION_TIMEOUT
      ) {
        localStorage.removeItem(this._SESSION_TIMEOUT_KEY);
        localStorage.removeItem('logit_user_id');
        return; // Session expired
      }

      var session = await Logit.Supabase.getSession();
      var user = await Logit.Supabase.getUser();
      if (session && user) {
        this._currentUser = user;
        localStorage.setItem(this._SESSION_TIMEOUT_KEY, String(Date.now()));
        this.redirectToLibrary();
        return;
      }
    } catch (e) {
      /* silent */
    }
  },

  /**
   * Update the user activity timestamp. Debounced to avoid excessive localStorage writes.
   */
  updateActivity() {
    var now = Date.now();
    if (now - this._lastActivityUpdate > 15000) { // at most once every 15s
      this._lastActivityUpdate = now;
      localStorage.setItem(this._SESSION_TIMEOUT_KEY, String(now));
    }
  },

  /**
   * Check if the client session has exceeded the inactivity limit.
   * @returns {boolean}
   */
  isSessionExpired() {
    var lastActivity = localStorage.getItem(this._SESSION_TIMEOUT_KEY);
    if (!lastActivity) return false;
    return Date.now() - parseInt(lastActivity, 10) > this._SESSION_TIMEOUT;
  },

  /**
   * Initialize inactivity tracking on authenticated pages.
   */
  initActivityTracker() {
    var self = this;
    var uid = this.getUserId();
    if (!uid) return;

    // Check if session is already expired
    if (this.isSessionExpired()) {
      console.warn('Session expired due to inactivity');
      this.signOut('timeout');
      return;
    }

    // Set initial activity
    this.updateActivity();

    // Attach user activity listeners
    var events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    var onUserActivity = function () {
      self.updateActivity();
    };

    events.forEach(function (evt) {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Periodic heartbeat check for expiration
    if (this._activityTimer) clearInterval(this._activityTimer);
    this._activityTimer = setInterval(function () {
      if (self.isSessionExpired()) {
        console.warn('Session expired during inactivity check');
        self.signOut('timeout');
      }
    }, 60000);
  },

  /**
   * Get current user ID (single source of truth)
   * @returns {string|null}
   */
  getUserId() {
    return localStorage.getItem('logit_user_id');
  },

  setupButtons() {
    var self = this;
    var signInBtn = document.getElementById('signInBtn');
    var createBtn = document.getElementById('createAccountBtn');
    var toggleBtn = document.getElementById('togglePassword');
    var forgotBtn = document.getElementById('forgotPasswordBtn');
    var backBtn = document.getElementById('backToSignIn');

    if (signInBtn)
      signInBtn.addEventListener('click', function () {
        self.handleSignIn();
      });
    if (createBtn)
      createBtn.addEventListener('click', function () {
        if (self._mode === 'signin') self.toggleMode();
        else self.handleCreateAccount();
      });
    if (backBtn)
      backBtn.addEventListener('click', function () {
        self.toggleMode();
      });
    if (toggleBtn)
      toggleBtn.addEventListener('click', function () {
        self.togglePassword();
      });
    if (forgotBtn)
      forgotBtn.addEventListener('click', function () {
        self.handleForgotPassword();
      });

    var passwordInput = document.getElementById('authPassword');
    if (passwordInput) {
      passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (self._mode === 'signin') self.handleSignIn();
          else self.handleCreateAccount();
        }
      });
    }

    // Check query params for timeout message
    if (window.location.search.includes('reason=timeout')) {
      this.setMessage('Your session timed out due to inactivity. Please sign in again.');
    }
  },

  toggleMode() {
    var usernameField = document.getElementById('authUsername');
    var signInBtn = document.getElementById('signInBtn');
    var createBtn = document.getElementById('createAccountBtn');
    var forgotBtn = document.getElementById('forgotPasswordBtn');
    var backBtn = document.getElementById('backToSignIn');
    var divider = document.querySelector('.authDivider');

    if (this._mode === 'signin') {
      this._mode = 'signup';
      if (usernameField) usernameField.style.display = 'block';
      if (signInBtn) signInBtn.style.display = 'none';
      if (createBtn) createBtn.textContent = 'Create Account';
      if (forgotBtn) forgotBtn.style.display = 'none';
      if (backBtn) backBtn.style.display = 'flex';
      if (divider) divider.style.display = 'none';
    } else {
      this._mode = 'signin';
      if (usernameField) usernameField.style.display = 'none';
      if (signInBtn) signInBtn.style.display = 'block';
      if (createBtn) createBtn.textContent = 'Create Account';
      if (forgotBtn) forgotBtn.style.display = 'block';
      if (backBtn) backBtn.style.display = 'none';
      if (divider) divider.style.display = 'flex';
    }
    this.setMessage('');
  },

  togglePassword() {
    var input = document.getElementById('authPassword');
    var btn = document.getElementById('togglePassword');
    if (!input || !btn) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = Logit.EYE_OPEN_SVG;
    } else {
      input.type = 'password';
      btn.innerHTML = Logit.EYE_CLOSED_SVG;
    }
  },

  setMessage(msg) {
    var el = document.getElementById('authMessage');
    if (el) el.textContent = msg;
  },

  isGmail(email) {
    return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test((email || '').trim());
  },

  async handleSignIn() {
    var input = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!input || !password) {
      this.setMessage('Enter email/username and password');
      return;
    }

    var email = input.trim();
    // If input doesn't look like an email, look up by username using secure RPC
    if (!email.includes('@')) {
      var client = Logit.Supabase.getClient();
      if (client) {
        try {
          var { data: rpcEmail, error: rpcErr } = await client.rpc('get_email_for_username', {
            lookup_username: email
          });

          if (!rpcErr && rpcEmail) {
            email = rpcEmail;
          } else {
            // Graceful fallback for legacy database deployments before migration
            var { data: row } = await client
              .from('users')
              .select('email')
              .eq('username', email)
              .maybeSingle();
            if (row && row.email) {
              email = row.email;
            } else {
              this.setMessage('Username not found');
              return;
            }
          }
        } catch (e) {
          console.warn('Username lookup error:', e);
          this.setMessage('Username not found');
          return;
        }
      }
    } else if (!this.isGmail(email)) {
      this.setMessage('Only @gmail.com addresses are accepted');
      return;
    }
    await this.signInWithEmail(email, password.trim());
  },

  async handleCreateAccount() {
    var username = (document.getElementById('authUsername') || {}).value;
    var email = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!username || !email || !password) {
      this.setMessage('Fill all fields');
      return;
    }
    email = email.trim();
    if (!this.isGmail(email)) {
      this.setMessage('Only @gmail.com addresses are accepted');
      return;
    }
    if (password.length < 6) {
      this.setMessage('Password must be 6+ characters');
      return;
    }
    await this.signUpWithEmail(email, password.trim(), username.trim());
  },

  async handleForgotPassword() {
    var email = (document.getElementById('authEmail') || {}).value;
    if (!email) {
      this.setMessage('Enter your email first');
      return;
    }
    email = email.trim();
    if (!this.isGmail(email)) {
      this.setMessage('Only @gmail.com addresses are accepted');
      return;
    }
    var client = Logit.Supabase.getClient();
    if (!client) {
      this.setMessage('Cloud not configured');
      return;
    }
    try {
      var { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset.html'
      });
      if (error) {
        this.setMessage(error.message);
        return;
      }
      this.setMessage('Reset link sent! Check your email.');
    } catch (e) {
      this.setMessage('Failed to send reset link');
    }
  },

  async signInWithEmail(email, password) {
    var client = Logit.Supabase.getClient();
    if (!client) {
      this.setMessage('Cloud not configured');
      return;
    }
    try {
      var { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });
      if (error) {
        this.setMessage(error.message);
        return;
      }
      this._currentUser = data.user;
      localStorage.setItem('logit_user_id', data.user.id);
      localStorage.setItem(this._SESSION_TIMEOUT_KEY, String(Date.now()));
      await this.initializeCloudUser();
      this.redirectToLibrary();
    } catch (e) {
      this.setMessage('Sign-in failed');
    }
  },

  async signUpWithEmail(email, password, username) {
    var client = Logit.Supabase.getClient();
    if (!client) {
      this.setMessage('Cloud not configured');
      return;
    }

    try {
      // Secure check via RPC first to avoid reading other users' rows
      var { data: isAvailable, error: rpcErr } = await client.rpc('check_username_available', {
        check_username: username
      });
      if (!rpcErr && isAvailable === false) {
        this.setMessage('Username already taken');
        return;
      }
      if (rpcErr) {
        // Fallback for pre-migration databases
        var { data: existing } = await client
          .from('users')
          .select('id')
          .eq('username', username)
          .limit(1);
        if (existing && existing.length > 0) {
          this.setMessage('Username already taken');
          return;
        }
      }
    } catch (e) {
      /* table might not exist yet */
    }

    try {
      var { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + '/index.html',
          data: { username: username }
        }
      });
      if (error) {
        if (error.message.includes('already')) {
          this.setMessage('Email already registered');
        } else {
          this.setMessage(error.message);
        }
        return;
      }
      this.setMessage('Check your email to confirm your account.');
    } catch (e) {
      this.setMessage('Sign-up failed');
    }
  },

  async signOut(reason) {
    if (this._activityTimer) clearInterval(this._activityTimer);
    var client = Logit.Supabase.getClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (e) {
        /* silent */
      }
    }
    localStorage.removeItem('logit_user_id');
    localStorage.removeItem(this._SESSION_TIMEOUT_KEY);

    // Clear Drive tokens on sign-out to prevent account mix-ups
    if (Logit.Drive && typeof Logit.Drive.clearToken === 'function') {
      Logit.Drive.clearToken();
    }

    var target = 'welcome.html';
    if (reason === 'timeout') target += '?reason=timeout';

    if (window.Logit && window.Logit.Utils && typeof window.Logit.Utils.navTo === 'function') {
      Logit.Utils.navTo(target);
    } else {
      window.location.href = target;
    }
  },

  async initializeCloudUser() {
    if (!this._currentUser) return;
    var client = Logit.Supabase.getClient();
    if (!client) return;
    try {
      var username =
        (this._currentUser.user_metadata &&
          this._currentUser.user_metadata.username) ||
        (this._currentUser.email || '').split('@')[0] ||
        'User';
      await client.from('users').upsert(
        {
          id: this._currentUser.id,
          email: this._currentUser.email,
          username: username,
          created_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
      localStorage.setItem('logit_user_id', this._currentUser.id);
    } catch (e) {
      /* silent */
    }
  },

  redirectToLibrary() {
    setTimeout(function () {
      if (window.Logit && window.Logit.Utils && typeof window.Logit.Utils.navTo === 'function') {
        Logit.Utils.navTo('index.html');
      } else {
        window.location.href = 'index.html';
      }
    }, 300);
  }
};

// Initialize activity tracking when DOM is ready on authenticated pages
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    if (!window.location.pathname.endsWith('welcome.html') && !window.location.pathname.endsWith('reset.html')) {
      Logit.Auth.initActivityTracker();
    }
  });
}
