window.Logit = window.Logit || {};

/**
 * Log!t Companion - Quick Capture Controller
 */
Logit.Companion = {
  parsedItems: [],

  init() {
    this.setupDOMElements();
    this.setupListeners();
    this.checkShareTarget();
    this.updateSyncStatus();
    Logit.Pending.updateBadges();

    // Check auth session
    if (Logit.Supabase) {
      Logit.Supabase.init();
      Logit.Supabase.getSession().then((session) => {
        if (session && session.user) {
          localStorage.setItem('logit_user_id', session.user.id);
        }
        this.updateSyncStatus();
      });
    }
  },

  setupDOMElements() {
    this.textarea = document.getElementById('captureInput');
    this.previewList = document.getElementById('previewList');
    this.previewCount = document.getElementById('previewCount');
    this.sendBtn = document.getElementById('sendBtn');
    this.pasteBtn = document.getElementById('pasteBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.syncStatusDot = document.getElementById('syncDot');
    this.syncStatusText = document.getElementById('syncText');
    this.successToast = document.getElementById('successToast');
    this.toastCount = document.getElementById('toastCount');
    this.toastPendingBtn = document.getElementById('toastPendingBtn');
    this.toastMoreBtn = document.getElementById('toastMoreBtn');
  },

  setupListeners() {
    const self = this;

    // Real-time parsing with debounce
    const debouncedParse = Logit.Utils.debounce(() => {
      self.handleInputChange();
    }, 150);

    if (this.textarea) {
      this.textarea.addEventListener('input', debouncedParse);
      // Auto-focus on desktop / tablets
      if (window.innerWidth >= 768) {
        this.textarea.focus();
      }
    }

    // 1-Tap Paste from Clipboard
    if (this.pasteBtn) {
      this.pasteBtn.addEventListener('click', async () => {
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) {
            alert('Clipboard access not supported in this browser. Please paste manually.');
            return;
          }
          const text = await navigator.clipboard.readText();
          if (text) {
            if (self.textarea.value.trim()) {
              self.textarea.value += '\n' + text.trim();
            } else {
              self.textarea.value = text.trim();
            }
            self.handleInputChange();
            self.textarea.focus();
          }
        } catch (err) {
          console.warn('Clipboard read failed:', err);
          alert('Could not read clipboard. Please paste manually into the text box.');
        }
      });
    }

    // Clear input
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        self.textarea.value = '';
        self.handleInputChange();
        self.textarea.focus();
      });
    }

    // Quick tag pills (e.g. "Yesterday", "5★", etc.)
    document.querySelectorAll('.quickPill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const insertText = pill.dataset.insert || pill.textContent;
        self.insertAtCursor(insertText);
      });
    });

    // Send to Pending Button
    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => {
        self.submitPending();
      });
    }

    // Toast action buttons
    if (this.toastPendingBtn) {
      this.toastPendingBtn.addEventListener('click', () => {
        Logit.Utils.navTo('pending.html');
      });
    }

    if (this.toastMoreBtn) {
      this.toastMoreBtn.addEventListener('click', () => {
        self.successToast.classList.remove('active');
        self.textarea.value = '';
        self.handleInputChange();
        self.textarea.focus();
      });
    }

    // Network status listener
    window.addEventListener('online', () => self.updateSyncStatus());
    window.addEventListener('offline', () => self.updateSyncStatus());
  },

  /**
   * Helper to insert text snippet at cursor position.
   * @param {string} text
   */
  insertAtCursor(text) {
    if (!this.textarea) return;
    const start = this.textarea.selectionStart || 0;
    const end = this.textarea.selectionEnd || 0;
    const val = this.textarea.value;
    const needsSpace = start > 0 && val[start - 1] !== ' ' && val[start - 1] !== '\n';
    const toInsert = (needsSpace ? ' ' : '') + text + ' ';
    this.textarea.value = val.substring(0, start) + toInsert + val.substring(end);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + toInsert.length;
    this.handleInputChange();
    this.textarea.focus();
  },

  /**
   * Check if page was opened via Web Share Target (Android share sheet).
   */
  checkShareTarget() {
    const params = new URLSearchParams(window.location.search);
    const title = params.get('title') || '';
    const text = params.get('text') || '';
    const url = params.get('url') || '';

    let sharedContent = [title, text, url].filter(Boolean).join(' ').trim();
    if (sharedContent) {
      // Clean typical share prefixes like "Check out this movie:"
      sharedContent = sharedContent.replace(/^(check out|watching|watched|i'm watching|link:)\s+/i, '');
      this.textarea.value = sharedContent;
      this.handleInputChange();

      // Clean query string from browser bar without reloading
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  },

  /**
   * Handle changes in the text input and regenerate live preview cards.
   */
  handleInputChange() {
    const text = this.textarea.value;
    this.parsedItems = Logit.Parser.parse(text);
    this.renderPreviews();
  },

  /**
   * Render the interactive preview cards.
   */
  renderPreviews() {
    this.previewList.innerHTML = '';
    const count = this.parsedItems.length;
    this.previewCount.textContent = count;
    this.sendBtn.disabled = count === 0;

    if (count === 0) {
      this.previewList.innerHTML = `
        <div class="previewEmpty">
          <svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <p>Live preview will appear here as you type or paste movie titles.</p>
        </div>
      `;
      return;
    }

    const ratings = ['', '0.5', '1.0', '1.5', '2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];

    this.parsedItems.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'previewCard';
      card.dataset.index = index;

      // Rating options
      let ratingOptions = '<option value="">No Rating</option>';
      ratings.slice(1).forEach((r) => {
        const isSelected = item.rating && String(parseFloat(item.rating).toFixed(1)) === r;
        ratingOptions += `<option value="${r}" ${isSelected ? 'selected' : ''}>★ ${r}</option>`;
      });

      card.innerHTML = `
        <div class="previewCardTop">
          <input type="text" class="previewTitleInput" value="${Logit.Utils.esc(item.title)}" placeholder="Movie title" aria-label="Edit title" />
          <button class="removeCardBtn" aria-label="Remove item">&times;</button>
        </div>
        <div class="previewCardMeta">
          <div class="ratingSelector" title="Rating">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
            <select class="ratingSelect" aria-label="Rating">${ratingOptions}</select>
          </div>
          <div class="dateChip" title="Watch date">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <input type="date" class="dateInput" value="${item.watchDate || ''}" aria-label="Watch date" />
          </div>
          <button class="rewatchChip ${item.isRewatch ? 'active' : ''}" type="button" title="Toggle rewatch">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Rewatch</span>
          </button>
        </div>
      `;

      // Live title edit
      const titleInput = card.querySelector('.previewTitleInput');
      titleInput.addEventListener('input', (e) => {
        item.title = e.target.value;
      });

      // Rating change
      const ratingSelect = card.querySelector('.ratingSelect');
      ratingSelect.addEventListener('change', (e) => {
        item.rating = e.target.value || null;
      });

      // Date change
      const dateInput = card.querySelector('.dateInput');
      dateInput.addEventListener('change', (e) => {
        item.watchDate = e.target.value;
      });

      // Rewatch toggle
      const rewatchBtn = card.querySelector('.rewatchChip');
      rewatchBtn.addEventListener('click', () => {
        item.isRewatch = !item.isRewatch;
        rewatchBtn.classList.toggle('active', item.isRewatch);
      });

      // Remove single item
      const removeBtn = card.querySelector('.removeCardBtn');
      removeBtn.addEventListener('click', () => {
        this.parsedItems.splice(index, 1);
        this.renderPreviews();
      });

      this.previewList.appendChild(card);
    });
  },

  /**
   * Submit parsed items to the Log!t pending system.
   */
  async submitPending() {
    if (this.parsedItems.length === 0) return;

    this.sendBtn.disabled = true;
    this.sendBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      Sending...
    `;

    try {
      const itemsToSave = this.parsedItems.map((item) => ({
        title: item.title,
        rating: item.rating,
        watch_date: item.watchDate,
        raw_input: item.raw || item.title,
        year: item.year,
        is_rewatch: item.isRewatch
      }));

      await Logit.Pending.savePendingBulk(itemsToSave);

      // Show success modal
      this.toastCount.textContent = itemsToSave.length;
      this.successToast.classList.add('active');

      // Vibrate if mobile device supports it
      if (navigator.vibrate) {
        navigator.vibrate([40, 60, 40]);
      }
    } catch (err) {
      console.error('Failed to submit pending movies:', err);
      alert('Could not submit movies: ' + err.message);
    } finally {
      this.sendBtn.disabled = false;
      this.sendBtn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        Send to Log!t Pending (${this.parsedItems.length})
      `;
    }
  },

  /**
   * Update online/offline synchronization status indicator.
   */
  updateSyncStatus() {
    const isOnline = navigator.onLine;
    const userId = Logit.Auth ? Logit.Auth.getUserId() : null;

    if (!isOnline) {
      this.syncStatusDot.className = 'syncDot offline';
      this.syncStatusText.textContent = 'Offline (saves locally to device)';
    } else if (userId) {
      this.syncStatusDot.className = 'syncDot';
      this.syncStatusText.textContent = 'Cloud sync connected';
    } else {
      this.syncStatusDot.className = 'syncDot offline';
      this.syncStatusText.textContent = 'Not signed in (saves locally)';
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Logit.Companion.init();
});
