window.Logit = window.Logit || {};

Logit.Auth = {
  _currentUser: null,
  _mode: 'signin',
  _EYE_OPEN_SVG: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`,
  _EYE_CLOSED_SVG: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.388 4.178 5.325 7.178 9.963 7.178.932 0 1.838-.12 2.7-.348M21.934 12c-1.388-4.178-5.325-7.178-9.963-7.178a10.478 10.478 0 0 0-2.7.348m8.05 13.05L19 19m-4.5-4.5a3 3 0 0 1-4.5-4.5m0 0L8 8m-4 4 1.5 1.5M20 12l-1.5 1.5" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 3l18 18" /></svg>`,

  initWelcomePage() {
    this.checkExistingSession();
    this.setupButtons();
  },

  async checkExistingSession() {
    try {
      var session = await Logit.Supabase.getSession();
      var user = await Logit.Supabase.getUser();
      if (session && user) {
        this._currentUser = user;
        localStorage.removeItem('logit_offline_mode');
        this.redirectToLibrary();
        return;
      }
    } catch (e) { /* silent */ }
  },

  setupButtons() {
    var self = this;
    var signInBtn = document.getElementById('signInBtn');
    var createBtn = document.getElementById('createAccountBtn');
    var offlineBtn = document.getElementById('continueOfflineBtn');
    var toggleBtn = document.getElementById('togglePassword');
    var forgotBtn = document.getElementById('forgotPasswordBtn');

    if (signInBtn) signInBtn.addEventListener('click', function() { self.handleSignIn(); });
    if (createBtn) createBtn.addEventListener('click', function() {
      if (self._mode === 'signin') self.toggleMode();
      else self.handleCreateAccount();
    });
    if (offlineBtn) offlineBtn.style.display = 'none';
    if (toggleBtn) toggleBtn.addEventListener('click', function() { self.togglePassword(); });
    if (forgotBtn) forgotBtn.addEventListener('click', function() { self.handleForgotPassword(); });

    var passwordInput = document.getElementById('authPassword');
    if (passwordInput) {
      passwordInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          if (self._mode === 'signin') self.handleSignIn();
          else self.handleCreateAccount();
        }
      });
    }
  },

  toggleMode() {
    var usernameField = document.getElementById('authUsername');
    var signInBtn = document.getElementById('signInBtn');
    var createBtn = document.getElementById('createAccountBtn');
    var forgotBtn = document.getElementById('forgotPasswordBtn');

    if (this._mode === 'signin') {
      this._mode = 'signup';
      if (usernameField) usernameField.style.display = 'block';
      if (signInBtn) signInBtn.style.display = 'none';
      if (createBtn) createBtn.textContent = 'Create Account';
      if (forgotBtn) forgotBtn.style.display = 'none';
    } else {
      this._mode = 'signin';
      if (usernameField) usernameField.style.display = 'none';
      if (signInBtn) signInBtn.style.display = 'block';
      if (createBtn) createBtn.textContent = 'Create Account';
      if (forgotBtn) forgotBtn.style.display = 'block';
    }
    this.setMessage('');
  },

  togglePassword() {
    var input = document.getElementById('authPassword');
    var btn = document.getElementById('togglePassword');
    if (!input || !btn) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = this._EYE_OPEN_SVG;
    } else {
      input.type = 'password';
      btn.innerHTML = this._EYE_CLOSED_SVG;
    }
  },

  setMessage(msg) {
    var el = document.getElementById('authMessage');
    if (el) el.textContent = msg;
  },

  async handleSignIn() {
    var input = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!input || !password) { this.setMessage('Enter email/username and password'); return; }

    var email = input.trim();
    // If input doesn't look like an email, look up by username
    if (!email.includes('@')) {
      var client = Logit.Supabase.getClient();
      if (client) {
        try {
          var { data } = await client.from('users').select('email').eq('username', email).maybeSingle();
          if (data && data.email) {
            email = data.email;
          } else {
            this.setMessage('Username not found');
            return;
          }
        } catch (e) {
          console.warn('Username lookup error:', e);
          this.setMessage('Username not found');
          return;
        }
      }
    }
    await this.signInWithEmail(email, password.trim());
  },

  async handleCreateAccount() {
    var username = (document.getElementById('authUsername') || {}).value;
    var email = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!username || !email || !password) { this.setMessage('Fill all fields'); return; }
    if (!email.includes('@')) { this.setMessage('Enter a valid email'); return; }
    if (password.length < 6) { this.setMessage('Password must be 6+ characters'); return; }
    await this.signUpWithEmail(email.trim(), password.trim(), username.trim());
  },

  async handleForgotPassword() {
    var email = (document.getElementById('authEmail') || {}).value;
    if (!email) { this.setMessage('Enter your email first'); return; }
    var client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }
    try {
      var { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset.html'
      });
      if (error) { this.setMessage(error.message); return; }
      this.setMessage('Reset link sent! Check your email.');
    } catch (e) {
      this.setMessage('Failed to send reset link');
    }
  },

  async signInWithEmail(email, password) {
    var client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }
    try {
      var { data, error } = await client.auth.signInWithPassword({ email: email, password: password });
      if (error) { this.setMessage(error.message); return; }
      this._currentUser = data.user;
      localStorage.removeItem('logit_offline_mode');
      localStorage.setItem('logit_user_id', data.user.id);
      await this.initializeCloudUser();
      this.redirectToLibrary();
    } catch (e) {
      this.setMessage('Sign-in failed');
    }
  },

  async signUpWithEmail(email, password, username) {
    var client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }

    try {
      var { data: existing } = await client
        .from('users')
        .select('id')
        .eq('username', username)
        .limit(1);
      if (existing && existing.length > 0) {
        this.setMessage('Username already taken');
        return;
      }
    } catch (e) { /* table might not exist yet */ }

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

  async signOut() {
    var client = Logit.Supabase.getClient();
    if (client) await client.auth.signOut();
    localStorage.removeItem('logit_user_id');
    localStorage.removeItem('logit_offline_mode');
    location.href = 'welcome.html';
  },

  async initializeCloudUser() {
    if (!this._currentUser) return;
    var client = Logit.Supabase.getClient();
    if (!client) return;
    try {
      var username = this._currentUser.user_metadata && this._currentUser.user_metadata.username || (this._currentUser.email || '').split('@')[0] || 'User';
      await client.from('users').upsert({
        id: this._currentUser.id,
        email: this._currentUser.email,
        username: username,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      localStorage.setItem('logit_user_id', this._currentUser.id);
    } catch (e) { /* silent */ }
  },

  redirectToLibrary() {
    setTimeout(function() { window.location.href = 'index.html'; }, 300);
  }
};
