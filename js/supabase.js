window.Logit = window.Logit || {};

/**
 * Supabase Client Configuration
 * Initialize the Supabase client with environment variables
 * 
 * Required environment variables (set via config.html or environment):
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 */
Logit.Supabase = {
  _client: null,
  _initialized: false,

  /**
   * Initialize Supabase client
   * @returns {Object} Supabase client
   */
  _defaults: {
    url: 'https://rxhkexxpsfaxctmkrlyl.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4aGtleHhwc2ZheGN0bWtybHlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzE3MjgsImV4cCI6MjA5OTM0NzcyOH0.KohaWfHtwhsDA0FJ1kHCliWU1_2nZ5Ihany_2v3TkIE'
  },

  init() {
    if (this._initialized) return this._client;

    const url = localStorage.getItem('supabase_url') || this._defaults.url;
    const key = localStorage.getItem('supabase_anon_key') || this._defaults.key;

    if (!url || !key) {
      console.warn('Supabase credentials not configured. Cloud features disabled.');
      return null;
    }

    try {
      this._client = window.supabase.createClient(url, key);
      this._initialized = true;
      return this._client;
    } catch (e) {
      console.error('Failed to initialize Supabase:', e);
      return null;
    }
  },

  /**
   * Get Supabase client (must be initialized first)
   * @returns {Object} Supabase client
   */
  getClient() {
    if (!this._initialized) return this.init();
    return this._client;
  },

  /**
   * Configure Supabase credentials
   * @param {string} url - Supabase project URL
   * @param {string} key - Supabase anon key
   */
  configure(url, key) {
    localStorage.setItem('supabase_url', url.trim());
    localStorage.setItem('supabase_anon_key', key.trim());
    this._initialized = false;
    return this.init();
  },

  /**
   * Get authenticated user
   * @returns {Promise<Object|null>}
   */
  async getUser() {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data: { user } } = await client.auth.getUser();
      return user;
    } catch (e) {
      console.error('Failed to get user:', e);
      return null;
    }
  },

  /**
   * Get session
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data: { session } } = await client.auth.getSession();
      return session;
    } catch (e) {
      console.error('Failed to get session:', e);
      return null;
    }
  }
};
