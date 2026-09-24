if (typeof window !== 'undefined') {
  window.Logit = window.Logit || {};
}
var Logit = typeof window !== 'undefined' ? window.Logit : {};

/**
 * Natural language movie parser for Log!t Companion.
 * Extracts movie title, optional rating, optional watch date, and rewatch status.
 */
Logit.Parser = {
  /**
   * Parse full input text (can be multi-line or single line).
   * @param {string} text
   * @returns {Array<{ raw: string, title: string, rating: string|null, watchDate: string, isRewatch: boolean, year: string|null }>}
   */
  parse(text) {
    if (!text || typeof text !== 'string') return [];

    // Split by newlines, or semicolons if no newlines
    let lines = text.split(/\r?\n/);
    if (lines.length === 1 && text.includes(';')) {
      lines = text.split(';');
    }

    const results = [];
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      const parsed = this.parseLine(trimmed);
      if (parsed && parsed.title) {
        results.push(parsed);
      }
    }
    return results;
  },

  /**
   * Parse a single line of natural language input.
   * @param {string} line
   * @returns {{ raw: string, title: string, rating: string|null, watchDate: string, isRewatch: boolean, year: string|null }}
   */
  parseLine(line) {
    const raw = line;
    let working = line.trim();

    // 1. Detect rewatch flag
    let isRewatch = false;
    const rewatchRegex = /\b(re-?watch(?:ed)?|seen before|2nd time|3rd time|\b2x\b|\b3x\b)\b/i;
    if (rewatchRegex.test(working)) {
      isRewatch = true;
      working = working.replace(rewatchRegex, ' ').trim();
    }

    // 2. Detect & extract explicit rating formats (/5, /10, stars, symbols)
    let rating = null;

    // Pattern 2a: Star symbols e.g. ★★★★☆ or ★★★★★ or 4★
    const starSymbolMatch = working.match(/([★☆]{1,5})/);
    if (starSymbolMatch) {
      const stars = starSymbolMatch[1];
      const filled = (stars.match(/★/g) || []).length;
      if (filled > 0) {
        rating = String(Math.min(5, Math.max(0.5, filled)));
        working = working.replace(starSymbolMatch[0], ' ').trim();
      }
    }

    // Pattern 2b: X/5 or X/10 or X/5.0 e.g. 4.5/5, 5/5, 9/10, 8.5/10
    if (!rating) {
      const slashMatch = working.match(/\b([0-9](?:\.[0-9])?)\s*\/\s*(5|10)\b/i);
      if (slashMatch) {
        let val = parseFloat(slashMatch[1]);
        const scale = parseFloat(slashMatch[2]);
        if (scale === 10) val = val / 2;
        val = this._normalizeRating(val);
        if (val !== null) {
          rating = String(val);
          working = working.replace(slashMatch[0], ' ').trim();
        }
      }
    }

    // Pattern 2c: Explicit star notation e.g. 4.5* or 4.5 stars or 5 stars
    if (!rating) {
      const starsMatch = working.match(/\b([0-5](?:\.[0-9])?)\s*(?:\*|stars?)\b/i);
      if (starsMatch) {
        const val = this._normalizeRating(parseFloat(starsMatch[1]));
        if (val !== null) {
          rating = String(val);
          working = working.replace(starsMatch[0], ' ').trim();
        }
      }
    }

    // 3. Detect & extract watch date
    const dateExtraction = this._extractDate(working);
    const watchDate = dateExtraction.dateStr;
    working = dateExtraction.remainingText.trim();

    // Clean up "watched on", "watched at", "watched", "viewed", "saw" before checking rating
    working = working.replace(/\b(watched(?:\s+(?:on|at))?|saw|viewed)\b/gi, ' ').trim();

    // 4. Standalone decimal or integer rating at end of string
    // e.g. "Interstellar 4.5" or "The Prestige 5" (must be 0.5 - 5.0)
    if (!rating) {
      const trailingMatch = working.match(/(?:\s|^)([0-5](?:\.[05])?)\s*$/);
      if (trailingMatch) {
        const val = this._normalizeRating(parseFloat(trailingMatch[1]));
        if (val !== null && val >= 0.5 && val <= 5.0) {
          rating = String(val);
          working = working.slice(0, trailingMatch.index).trim();
        }
      }
    }

    // 5. Detect year in parentheses e.g. "Dune: Part Two (2024)"
    let year = null;
    const yearMatch = working.match(/\((\d{4})\)/);
    if (yearMatch) {
      const yr = parseInt(yearMatch[1], 10);
      if (yr >= 1888 && yr <= 2040) {
        year = String(yr);
        working = working.replace(yearMatch[0], ' ').trim();
      }
    }

    // Clean up trailing dashes, commas, colons
    working = working.replace(/^[\s\-–—,;:]+|[\s\-–—,;:]+$/g, '').trim();

    return {
      raw,
      title: working,
      rating,
      watchDate,
      isRewatch,
      year
    };
  },

  /**
   * Helper to normalize rating to 0.5-5.0 in 0.5 increments.
   * @param {number} num
   * @returns {number|null}
   */
  _normalizeRating(num) {
    if (isNaN(num)) return null;
    if (num < 0.5 || num > 5) return null;
    // Round to nearest 0.5
    return Math.round(num * 2) / 2;
  },

  /**
   * Format a Date object to YYYY-MM-DD
   * @param {Date} d
   * @returns {string}
   */
  _formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  /**
   * Extract relative or explicit date expressions and return date string + remainder text.
   * @param {string} text
   * @returns {{ dateStr: string, remainingText: string }}
   */
  _extractDate(text) {
    const now = new Date();
    let working = text;

    // Pattern 1: ISO date YYYY-MM-DD
    const isoMatch = working.match(/(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(\d{4})-(\d{1,2})-(\d{1,2})\b/i);
    if (isoMatch) {
      const d = new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
      if (!isNaN(d.getTime())) {
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(isoMatch[0], ' ').trim()
        };
      }
    }

    // Pattern 2: DD/MM/YYYY or DD-MM-YYYY
    const slashDateMatch = working.match(/(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/i);
    if (slashDateMatch) {
      const d = new Date(parseInt(slashDateMatch[3], 10), parseInt(slashDateMatch[2], 10) - 1, parseInt(slashDateMatch[1], 10));
      if (!isNaN(d.getTime())) {
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(slashDateMatch[0], ' ').trim()
        };
      }
    }

    // Pattern 3: Relative keywords: yesterday, day before yesterday, today, tomorrow, last night
    const relPatterns = [
      { regex: /(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(?:day before yesterday)\b/i, daysOffset: -2 },
      { regex: /(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(?:yesterday|last night)\b/i, daysOffset: -1 },
      { regex: /(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(?:today|this morning|tonight)\b/i, daysOffset: 0 },
      { regex: /(?:(?:watched|viewed|saw)\s+)?(?:on\s+)?\b(?:tomorrow)\b/i, daysOffset: 1 }
    ];

    for (const p of relPatterns) {
      const m = working.match(p.regex);
      if (m) {
        const d = new Date(now);
        d.setDate(d.getDate() + p.daysOffset);
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(m[0], ' ').trim()
        };
      }
    }

    // Pattern 4: "X days ago"
    const daysAgoMatch = working.match(/(?:(?:watched|viewed|saw)\s+)?\b(\d+)\s+days?\s+ago\b/i);
    if (daysAgoMatch) {
      const offset = parseInt(daysAgoMatch[1], 10);
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      return {
        dateStr: this._formatDate(d),
        remainingText: working.replace(daysAgoMatch[0], ' ').trim()
      };
    }

    // Pattern 5: Month name + day, e.g. "sep 20", "20 sep", "september 24th", "oct 5 2025"
    const months = [
      'jan(?:uary)?', 'feb(?:ruary)?', 'mar(?:ch)?', 'apr(?:il)?', 'may', 'jun(?:e)?',
      'jul(?:y)?', 'aug(?:ust)?', 'sep(?:t(?:ember)?)?', 'oct(?:ober)?', 'nov(?:ember)?', 'dec(?:ember)?'
    ];
    const monthRegexStr = months.join('|');

    // "Sep 20" or "Sep 20 2026" or "September 24th", optionally preceded by "on " or "watched on "
    const monthDayRegex = new RegExp(`(?:(?:watched|viewed|saw)\\s+)?(?:on\\s+)?\\b(${monthRegexStr})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{4}))?\\b`, 'i');
    const mdMatch = working.match(monthDayRegex);
    if (mdMatch) {
      const monthIdx = this._monthNameToIndex(mdMatch[1]);
      const day = parseInt(mdMatch[2], 10);
      const year = mdMatch[3] ? parseInt(mdMatch[3], 10) : now.getFullYear();
      if (monthIdx !== -1 && day >= 1 && day <= 31) {
        const d = new Date(year, monthIdx, day);
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(mdMatch[0], ' ').trim()
        };
      }
    }

    // "20 Sep" or "24th September" or "20 Sep 2026"
    const dayMonthRegex = new RegExp(`(?:(?:watched|viewed|saw)\\s+)?(?:on\\s+)?\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegexStr})(?:\\s+(\\d{4}))?\\b`, 'i');
    const dmMatch = working.match(dayMonthRegex);
    if (dmMatch) {
      const day = parseInt(dmMatch[1], 10);
      const monthIdx = this._monthNameToIndex(dmMatch[2]);
      const year = dmMatch[3] ? parseInt(dmMatch[3], 10) : now.getFullYear();
      if (monthIdx !== -1 && day >= 1 && day <= 31) {
        const d = new Date(year, monthIdx, day);
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(dmMatch[0], ' ').trim()
        };
      }
    }

    // Pattern 6: "last Friday", "last Monday", etc.
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const lastDayMatch = working.match(/\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (lastDayMatch) {
      const targetDay = daysOfWeek.indexOf(lastDayMatch[1].toLowerCase());
      if (targetDay !== -1) {
        const currentDay = now.getDay();
        let diff = currentDay - targetDay;
        if (diff <= 0) diff += 7;
        const d = new Date(now);
        d.setDate(d.getDate() - diff);
        return {
          dateStr: this._formatDate(d),
          remainingText: working.replace(lastDayMatch[0], ' ').trim()
        };
      }
    }

    // Default to today's date if no date was explicitly stated
    return {
      dateStr: this._formatDate(now),
      remainingText: working
    };
  },

  _monthNameToIndex(name) {
    const n = name.toLowerCase().slice(0, 3);
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    return months.indexOf(n);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logit.Parser;
}
