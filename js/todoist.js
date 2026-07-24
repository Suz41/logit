window.Logit = window.Logit || {};

/**
 * Todoist Integration for Log!t
 * Fetches movies from Todoist tasks and searches TMDB
 */
Logit.Todoist = {
  _API_KEY: 'logit_todoist_key',
  _PENDING_KEY: 'logit_pending_movies',

  getApiKey() {
    return localStorage.getItem(this._API_KEY) || '';
  },

  setApiKey(key) {
    if (key) localStorage.setItem(this._API_KEY, key);
    else localStorage.removeItem(this._API_KEY);
  },

  isConfigured() {
    return !!this.getApiKey();
  },

  /**
   * Fetch tasks from Todoist API (only from "Movies" or "Log!t" project)
   * Uses Cloudflare Worker proxy for CORS support on deployed sites
   * @returns {Promise<Array>}
   */
  async fetchTasks() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];

    // Cloudflare Worker proxy URL - deployed separately
    const PROXY = 'https://logit-todoist-proxy.suz41.workers.dev/';
    const BASE = 'https://api.todoist.com/rest/v2';

    try {
      // Get projects
      const projRes = await fetch(PROXY + 'projects', {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });

      if (!projRes.ok) {
        if (projRes.status === 401) throw new Error('Invalid Todoist API key');
        throw new Error('Todoist API error: ' + projRes.status);
      }

      const projects = await projRes.json();
      const movieProject = projects.find(p =>
        p.name.toLowerCase() === 'movies' ||
        p.name.toLowerCase() === 'logit' ||
        p.name.toLowerCase() === 'log!t'
      );

      if (!movieProject) {
        throw new Error('No "Movies" or "Log!t" project found. Create one in Todoist first.');
      }

      // Fetch tasks from that project
      const res = await fetch(PROXY + 'tasks?project_id=' + movieProject.id, {
        headers: { 'Authorization': 'Bearer ' + apiKey }
      });

      if (!res.ok) throw new Error('Todoist API error: ' + res.status);

      return await res.json();
    } catch (e) {
      console.error('[Todoist] Fetch failed:', e);
      throw e;
    }
  },

  /**
   * Parse movie info from task content
   * Expected format: "Movie Name | 2024-07-23 | 4.5" or "Movie Name | 4.5"
   * @param {Object} task
   * @returns {Object|null}
   */
  parseTask(task) {
    const content = task.content || '';
    const parts = content.split('|').map(p => p.trim());

    if (parts.length === 0) return null;

    const movieName = parts[0];
    if (!movieName) return null;

    let date = null;
    let rating = null;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      // Check if date (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(part)) {
        date = part;
      }
      // Check if rating (0.5-5)
      else if (/^[0-9]+(\.[0-9])?$/.test(part)) {
        const r = parseFloat(part);
        if (r >= 0.5 && r <= 5) rating = r;
      }
    }

    // Use task due date if no date in content
    if (!date && task.due && task.due.date) {
      date = task.due.date;
    }

    return {
      id: task.id,
      name: movieName,
      date: date,
      rating: rating,
      raw: content
    };
  },

  /**
   * Search TMDB for a movie
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  async searchTMDB(name) {
    const apiKey = Logit.Config.getApiKey();
    if (!apiKey) return null;

    try {
      const url = 'https://api.themoviedb.org/3/search/movie?api_key=' + apiKey + '&query=' + encodeURIComponent(name);
      const data = await Logit.Search.tmdb(url);
      if (data && data.results && data.results.length > 0) {
        return data.results[0];
      }
    } catch (e) {
      console.error('[Todoist] TMDB search failed:', e);
    }
    return null;
  },

  /**
   * Get pending movies from localStorage
   * @returns {Array}
   */
  getPending() {
    try {
      return JSON.parse(localStorage.getItem(this._PENDING_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  /**
   * Save pending movies to localStorage
   * @param {Array} movies
   */
  savePending(movies) {
    localStorage.setItem(this._PENDING_KEY, JSON.stringify(movies));
  },

  /**
   * Add a movie to pending list
   * @param {Object} movie
   */
  addPending(movie) {
    const pending = this.getPending();
    // Don't add duplicates
    if (pending.some(p => p.todoistId === movie.todoistId)) return;
    pending.push(movie);
    this.savePending(pending);
  },

  /**
   * Remove a movie from pending list
   * @param {string} todoistId
   */
  removePending(todoistId) {
    const pending = this.getPending().filter(p => p.todoistId !== todoistId);
    this.savePending(pending);
  },

  /**
   * Fetch and process all Todoist tasks
   * @returns {Promise<{ added: number, pending: number }>}
   */
  async sync() {
    const tasks = await this.fetchTasks();
    let added = 0;

    for (const task of tasks) {
      const parsed = this.parseTask(task);
      if (!parsed) continue;

      // Search TMDB
      const tmdbResult = await this.searchTMDB(parsed.name);

      const pendingMovie = {
        todoistId: parsed.id,
        name: parsed.name,
        date: parsed.date,
        rating: parsed.rating,
        tmdb: tmdbResult ? {
          id: tmdbResult.id,
          title: tmdbResult.title,
          poster: tmdbResult.poster_path || '',
          year: (tmdbResult.release_date || '').slice(0, 4),
          overview: tmdbResult.overview || ''
        } : null,
        raw: parsed.raw,
        addedAt: Date.now()
      };

      this.addPending(pendingMovie);
      added++;
    }

    return { added: added, pending: this.getPending().length };
  }
};
