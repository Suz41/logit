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
      const session = await Logit.Supabase.getSession();
      const user = await Logit.Supabase.getUser();
      if (session && user) {
        this._currentUser = user;
        localStorage.setItem('logit_offline_mode', 'false');
        this.redirectToLibrary();
        return;
      }
      if (localStorage.getItem('logit_offline_mode') !== 'false') {
        localStorage.setItem('logit_offline_mode', 'true');
      }
    } catch (e) {
      localStorage.setItem('logit_offline_mode', 'true');
    }
  },

  setupButtons() {
    const signInBtn = document.getElementById('signInBtn');
    const createBtn = document.getElementById('createAccountBtn');
    const offlineBtn = document.getElementById('continueOfflineBtn');
    const toggleBtn = document.getElementById('togglePassword');
    const forgotBtn = document.getElementById('forgotPasswordBtn');

    if (signInBtn) signInBtn.addEventListener('click', () => this.handleSignIn());
    if (createBtn) createBtn.addEventListener('click', () => {
      if (this._mode === 'signin') this.toggleMode();
      else this.handleCreateAccount();
    });
    if (offlineBtn) offlineBtn.addEventListener('click', () => this.continueOffline());
    if (toggleBtn) toggleBtn.addEventListener('click', () => this.togglePassword());
    if (forgotBtn) forgotBtn.addEventListener('click', () => this.handleForgotPassword());

    // Enter key on password field
    const passwordInput = document.getElementById('authPassword');
    if (passwordInput) {
      passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (this._mode === 'signin') this.handleSignIn();
          else this.handleCreateAccount();
        }
      });
    }
  },

  toggleMode() {
    const usernameField = document.getElementById('authUsername');
    const signInBtn = document.getElementById('signInBtn');
    const createBtn = document.getElementById('createAccountBtn');
    const forgotBtn = document.getElementById('forgotPasswordBtn');

    if (this._mode === 'signin') {
      this._mode = 'signup';
      if (usernameField) usernameField.style.display = 'block';
      if (signInBtn) signInBtn.style.display = 'none';
      if (createBtn) { createBtn.textContent = 'Create Account'; }
      if (forgotBtn) forgotBtn.style.display = 'none';
    } else {
      this._mode = 'signin';
      if (usernameField) usernameField.style.display = 'none';
      if (signInBtn) signInBtn.style.display = 'block';
      if (createBtn) { createBtn.textContent = 'Create Account'; }
      if (forgotBtn) forgotBtn.style.display = 'block';
    }
    this.setMessage('');
  },

  togglePassword() {
    const input = document.getElementById('authPassword');
    const btn = document.getElementById('togglePassword');
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
    const el = document.getElementById('authMessage');
    if (el) el.textContent = msg;
  },

  async handleSignIn() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    if (!email || !password) { this.setMessage('Enter email and password'); return; }
    await this.signInWithEmail(email, password);
  },

  async handleCreateAccount() {
    const username = document.getElementById('authUsername')?.value.trim();
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    if (!username || !email || !password) { this.setMessage('Fill all fields'); return; }
    if (password.length < 6) { this.setMessage('Password must be 6+ characters'); return; }
    await this.signUpWithEmail(email, password, username);
  },

  async handleForgotPassword() {
    const email = document.getElementById('authEmail')?.value.trim();
    if (!email) { this.setMessage('Enter your email first'); return; }
    const client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/welcome.html'
      });
      if (error) { this.setMessage(error.message); return; }
      this.setMessage('Reset link sent! Check your email.');
    } catch (e) {
      this.setMessage('Failed to send reset link');
    }
  },

  continueOffline() {
    localStorage.setItem('logit_offline_mode', 'true');
    this.redirectToLibrary();
  },

  async signInWithEmail(email, password) {
    const client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }
    try {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) { this.setMessage(error.message); return; }
      this._currentUser = data.user;
      localStorage.setItem('logit_offline_mode', 'false');
      await this.initializeCloudUser();
      this.redirectToLibrary();
    } catch (e) {
      this.setMessage('Sign-in failed');
    }
  },

  async signUpWithEmail(email, password, username) {
    const client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }

    // Check if username is taken
    try {
      const { data: existing } = await client
        .from('users')
        .select('id')
        .eq('username', username)
        .limit(1);
      if (existing && existing.length > 0) {
        this.setMessage('Username already taken');
        return;
      }
    } catch (e) { /* table might not exist yet, continue */ }

    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin + '/index.html',
          data: { username }
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
    const client = Logit.Supabase.getClient();
    if (client) await client.auth.signOut();
    localStorage.removeItem('logit_auth_token');
    localStorage.removeItem('logit_user_id');
    localStorage.removeItem('logit_offline_mode');
    location.href = 'welcome.html';
  },

  async initializeCloudUser() {
    if (!this._currentUser) return;
    const client = Logit.Supabase.getClient();
    if (!client) return;
    try {
      const username = this._currentUser.user_metadata?.username || this._currentUser.email?.split('@')[0] || 'User';
      await client.from('users').upsert({
        id: this._currentUser.id,
        email: this._currentUser.email,
        username: username,
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
      localStorage.setItem('logit_user_id', this._currentUser.id);
      await Logit.Sync.uploadExistingMovies();
    } catch (e) {
      console.error('Cloud init error:', e);
    }
  },

  getCurrentUser() { return this._currentUser; },
  isAuthenticated() { return !!this._currentUser; },
  isOfflineMode() { return localStorage.getItem('logit_offline_mode') === 'true'; },

  redirectToLibrary() {
    setTimeout(() => { window.location.href = 'index.html'; }, 300);
  }
};
