window.Logit = window.Logit || {};

Logit.Auth = {
  _currentUser: null,

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

    if (signInBtn) signInBtn.addEventListener('click', () => this.handleSignIn());
    if (createBtn) createBtn.addEventListener('click', () => this.handleCreateAccount());
    if (offlineBtn) offlineBtn.addEventListener('click', () => this.continueOffline());
  },

  getCredentials() {
    const email = document.getElementById('authEmail')?.value.trim();
    const password = document.getElementById('authPassword')?.value.trim();
    return { email, password };
  },

  setMessage(msg) {
    const el = document.getElementById('authMessage');
    if (el) el.textContent = msg;
  },

  async handleSignIn() {
    const { email, password } = this.getCredentials();
    if (!email || !password) { this.setMessage('Enter email and password'); return; }
    await this.signInWithEmail(email, password);
  },

  async handleCreateAccount() {
    const { email, password } = this.getCredentials();
    if (!email || !password) { this.setMessage('Enter email and password'); return; }
    if (password.length < 6) { this.setMessage('Password must be 6+ characters'); return; }
    await this.signUpWithEmail(email, password);
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

  async signUpWithEmail(email, password) {
    const client = Logit.Supabase.getClient();
    if (!client) { this.setMessage('Cloud not configured'); return; }
    try {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/index.html' }
      });
      if (error) { this.setMessage(error.message); return; }
      this._currentUser = data.user;
      localStorage.setItem('logit_offline_mode', 'false');
      this.setMessage('Account created!');
      await this.initializeCloudUser();
      this.redirectToLibrary();
    } catch (e) {
      this.setMessage('Sign-up failed');
    }
  },

  async signOut() {
    const client = Logit.Supabase.getClient();
    if (client) await client.auth.signOut();
    localStorage.clear();
    location.href = 'welcome.html';
  },

  async initializeCloudUser() {
    if (!this._currentUser) return;
    const client = Logit.Supabase.getClient();
    if (!client) return;
    try {
      await client.from('users').upsert({
        id: this._currentUser.id,
        email: this._currentUser.email,
        username: this._currentUser.email?.split('@')[0] || 'User',
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
