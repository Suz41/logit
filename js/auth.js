window.Logit = window.Logit || {};

/**
 * Authentication Module
 * Handles login, signup, logout, and session management
 */
Logit.Auth = {
  _currentUser: null,
  _authStateCheckInterval: null,

  /**
   * Initialize welcome page
   */
  initWelcomePage() {
    this.checkExistingSession();
    this.setupWelcomeButtons();
    this.setupEmailAuthModal();
  },

  /**
   * Check if user already has a session
   * @returns {Promise<void>}
   */
  async checkExistingSession() {
    try {
      const session = await Logit.Supabase.getSession();
      const user = await Logit.Supabase.getUser();

      if (session && user) {
        this._currentUser = user;
        localStorage.setItem('logit_offline_mode', 'false');
        return; // Don't redirect yet - let app initialize
      }

      // Check for offline mode preference (or new user)
      if (localStorage.getItem('logit_offline_mode') !== 'false') {
        localStorage.setItem('logit_offline_mode', 'true');
      }
    } catch (e) {
      console.error('Session check error:', e);
      // Continue anyway - might just be offline
      localStorage.setItem('logit_offline_mode', 'true');
    }
  },

  /**
   * Setup welcome page buttons
   */
  setupWelcomeButtons() {
    const continueBtn = document.getElementById('continueOfflineBtn');
    const googleBtn = document.getElementById('googleSignInBtn');
    const githubBtn = document.getElementById('githubSignInBtn');
    const emailBtn = document.getElementById('emailSignInBtn');

    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.continueOffline());
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', () => this.signInWithOAuth('google'));
    }

    if (githubBtn) {
      githubBtn.addEventListener('click', () => this.signInWithOAuth('github'));
    }

    if (emailBtn) {
      emailBtn.addEventListener('click', () => this.showEmailAuthModal());
    }
  },

  /**
   * Setup email auth modal
   */
  setupEmailAuthModal() {
    const modal = document.getElementById('emailAuthModal');
    const closeBtn = document.getElementById('closeEmailModal');
    const emailInput = document.getElementById('authEmail');
    const magicLinkBtn = document.getElementById('sendMagicLinkBtn');
    const emailSignInBtn = document.getElementById('emailSignInBtn2');
    const emailSignUpBtn = document.getElementById('emailSignUpBtn');
    const passwordInput = document.getElementById('authPassword');

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }

    if (magicLinkBtn) {
      magicLinkBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        if (this.isValidEmail(email)) {
          this.sendMagicLink(email);
        } else {
          alert('Please enter a valid email.');
        }
      });
    }

    // Show/hide password field on double-tap or when user types password
    emailInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && passwordInput.style.display === 'block') {
        const password = passwordInput.value.trim();
        const email = emailInput.value.trim();
        if (this._emailAuthMode === 'signup') {
          this.signUpWithEmail(email, password);
        } else {
          this.signInWithEmail(email, password);
        }
      }
    });

    if (emailSignInBtn) {
      emailSignInBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (this.isValidEmail(email) && password) {
          this.signInWithEmail(email, password);
        } else {
          alert('Please enter email and password.');
        }
      });
    }

    if (emailSignUpBtn) {
      emailSignUpBtn.addEventListener('click', () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        if (this.isValidEmail(email) && password) {
          this.signUpWithEmail(email, password);
        } else {
          alert('Please enter email and password.');
        }
      });
    }

    // Close modal on outside click
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  },

  /**
   * Continue using app offline
   */
  continueOffline() {
    localStorage.setItem('logit_offline_mode', 'true');
    localStorage.removeItem('logit_auth_token');
    this.redirectToLibrary();
  },

  /**
   * Sign in with OAuth provider
   * @param {string} provider - 'google' or 'github'
   */
  async signInWithOAuth(provider) {
    const client = Logit.Supabase.getClient();
    if (!client) {
      alert('Cloud features not configured. Continuing offline.');
      this.continueOffline();
      return;
    }

    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/index.html'
        }
      });

      if (error) {
        console.error(`${provider} sign-in error:`, error);
        alert(`Failed to sign in with ${provider}`);
      }
    } catch (e) {
      console.error('OAuth sign-in error:', e);
      alert('Sign-in failed. Please try again.');
    }
  },

  /**
   * Send magic link
   * @param {string} email
   */
  async sendMagicLink(email) {
    const client = Logit.Supabase.getClient();
    if (!client) {
      alert('Cloud features not configured.');
      return;
    }

    try {
      const { error } = await client.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.href.substring(0, window.location.href.lastIndexOf('/')) + '/index.html'
        }
      });

      if (error) {
        alert('Failed to send magic link: ' + error.message);
      } else {
        alert('Magic link sent! Check your email.');
      }
    } catch (e) {
      console.error('Magic link error:', e);
      alert('Failed to send magic link.');
    }
  },

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   */
  async signInWithEmail(email, password) {
    const client = Logit.Supabase.getClient();
    if (!client) {
      alert('Cloud features not configured.');
      return;
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        alert('Sign-in failed: ' + error.message);
      } else {
        this._currentUser = data.user;
        localStorage.setItem('logit_offline_mode', 'false');
        await this.initializeCloudUser();
        this.redirectToLibrary();
      }
    } catch (e) {
      console.error('Email sign-in error:', e);
      alert('Sign-in failed. Please try again.');
    }
  },

  /**
   * Sign up with email and password
   * @param {string} email
   * @param {string} password
   */
  async signUpWithEmail(email, password) {
    const client = Logit.Supabase.getClient();
    if (!client) {
      alert('Cloud features not configured.');
      return;
    }

    if (password.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }

    try {
      const { data, error } = await client.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin + '/index.html'
        }
      });

      if (error) {
        alert('Sign-up failed: ' + error.message);
      } else {
        this._currentUser = data.user;
        localStorage.setItem('logit_offline_mode', 'false');
        alert('Account created! Check your email to confirm.');
        await this.initializeCloudUser();
      }
    } catch (e) {
      console.error('Sign-up error:', e);
      alert('Sign-up failed. Please try again.');
    }
  },

  /**
   * Sign out
   */
  async signOut() {
    const client = Logit.Supabase.getClient();
    if (!client) {
      localStorage.clear();
      location.reload();
      return;
    }

    try {
      await client.auth.signOut();
      localStorage.setItem('logit_offline_mode', 'true');
      localStorage.removeItem('logit_auth_token');
      localStorage.removeItem('logit_user_id');
      this._currentUser = null;
      location.href = 'welcome.html';
    } catch (e) {
      console.error('Sign-out error:', e);
      alert('Failed to sign out.');
    }
  },

  /**
   * Initialize cloud user on first login
   */
  async initializeCloudUser() {
    if (!this._currentUser) return;

    const client = Logit.Supabase.getClient();
    if (!client) return;

    try {
      // Create user profile if it doesn't exist
      const { data, error } = await client
        .from('users')
        .upsert({
          id: this._currentUser.id,
          email: this._currentUser.email,
          username: this._currentUser.email?.split('@')[0] || 'User',
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

      if (error) {
        console.error('Failed to create user profile:', error);
      } else {
        localStorage.setItem('logit_user_id', this._currentUser.id);
        // Trigger data migration from local to cloud
        await Logit.Sync.uploadExistingMovies();
      }
    } catch (e) {
      console.error('Cloud initialization error:', e);
    }
  },

  /**
   * Get current user
   * @returns {Object|null}
   */
  getCurrentUser() {
    return this._currentUser;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    return !!this._currentUser;
  },

  /**
   * Check if in offline mode
   * @returns {boolean}
   */
  isOfflineMode() {
    return localStorage.getItem('logit_offline_mode') === 'true';
  },

  /**
   * Show email auth modal
   */
  showEmailAuthModal() {
    const modal = document.getElementById('emailAuthModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  },

  /**
   * Validate email format
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  /**
   * Redirect to library
   */
  redirectToLibrary() {
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 300);
  }
};
