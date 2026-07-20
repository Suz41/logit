window.Logit = window.Logit || {};

Logit.Auth = {
  _currentUser: null,
  _mode: 'signin',

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
      btn.innerHTML = '&#128064;';
    } else {
      input.type = 'password';
      btn.innerHTML = '&#128065;';
    }
  },

  setMessage(msg) {
    var el = document.getElementById('authMessage');
    if (el) el.textContent = msg;
  },

  async handleSignIn() {
    var email = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!email || !password) { this.setMessage('Enter email and password'); return; }
    await this.signInWithEmail(email.trim(), password.trim());
  },

  async handleCreateAccount() {
    var username = (document.getElementById('authUsername') || {}).value;
    var email = (document.getElementById('authEmail') || {}).value;
    var password = (document.getElementById('authPassword') || {}).value;
    if (!username || !email || !password) { this.setMessage('Fill all fields'); return; }
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

  getCurrentUser() { return this._currentUser; },
  isAuthenticated() { return !!this._currentUser; },
  isOfflineMode() { return false; },

  redirectToLibrary() {
    setTimeout(function() { window.location.href = 'index.html'; }, 300);
  }
};
