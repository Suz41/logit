if (typeof window !== 'undefined') {
  window.Logit = window.Logit || {};
}
var Logit = typeof window !== 'undefined' ? window.Logit : {};

/**
 * Log!t Import Module
 * Parses exported TXT / pipe-delimited files, unstructured text, and JSON exports.
 */
Logit.Import = {
  /**
   * Parse a single line from an imported file.
   * Supports canonical 7-field format, legacy 5-field format, and natural language.
   * @param {string} line
   * @returns {Object|null}
   */
  parseLine(line) {
    if (!line || typeof line !== 'string') return null;
    line = line.trim();
    if (!line) return null;

    // 1. Pipe-delimited format
    if (line.includes('|')) {
      const parts = line.split('|').map(function (p) {
        return p.trim();
      });

      // Format A: Canonical 7-part format:
      // Title | Rating | Watch Date | Watch Status | Year | TMDB ID | IMDb ID
      if (parts.length >= 6) {
        const title = parts[0] || '';
        let rating = null;
        if (parts[1]) {
          const rMatch = parts[1].match(/([0-9](?:\.[0-9])?)/);
          if (rMatch) rating = parseFloat(rMatch[1]);
        }
        const date = parts[2] || null;
        const watchStatus = parts[3] || '';
        const year = parts[4] || (date ? (date.match(/\b(19\d{2}|20\d{2})\b/) || [])[0] : null);
        const tmdbId = parts[5] ? String(parts[5]).replace(/^tmdb[:\s]*/i, '') : null;
        const imdbId = parts[6] || null;

        const isRewatch = Boolean(watchStatus && /rewatch|re|rw|yes|y/i.test(watchStatus));

        if (!title && !tmdbId && !imdbId) return null;

        return {
          title: title,
          rating: rating,
          date: date,
          year: year,
          tmdbId: tmdbId && /^\d+$/.test(tmdbId) ? tmdbId : null,
          imdbId: imdbId && /^tt\d+$/i.test(imdbId) ? imdbId : null,
          rewatch: isRewatch
        };
      }

      // Format B: 3-5 part lines (supports legacy and partial formats)
      if (parts.length >= 3) {
        const title = parts[0] || '';
        let rating = null;
        if (parts[1]) {
          const rMatch = parts[1].match(/([0-9](?:\.[0-9])?)/);
          if (rMatch) rating = parseFloat(rMatch[1]);
        }

        let date = null;
        let tmdbId = null;
        let imdbId = null;
        let year = null;
        let isRewatch = false;

        const p2 = parts[2] || '';
        const p3 = parts[3] || '';
        const p4 = parts[4] || '';

        // Check if parts[2] is a date (YYYY-MM-DD or MM/DD/YYYY)
        if (/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(p2) || /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/.test(p2)) {
          date = p2;
          isRewatch = Boolean(p3 && /rewatch|re|rw|yes|y/i.test(p3));
          if (p4 && /\b(19\d{2}|20\d{2})\b/.test(p4)) year = p4;
        } else {
          // Legacy format: Title | Rating | ID | Date | Rewatch
          const tmdbMatch = p2.match(/tmdb[:\s]*(\d+)/i);
          if (tmdbMatch) tmdbId = tmdbMatch[1];
          const imdbMatch = p2.match(/\b(tt\d{7,8})\b/i);
          if (imdbMatch) imdbId = imdbMatch[1];
          if (!tmdbId && !imdbId && /^\d+$/.test(p2)) tmdbId = p2;

          date = p3 || null;
          isRewatch = Boolean(p4 && /rewatch|re|rw|yes|y/i.test(p4));
        }

        if (date && !year) {
          const ym = date.match(/\b(19\d{2}|20\d{2})\b/);
          if (ym) year = ym[0];
        }

        if (!title && !tmdbId && !imdbId) return null;

        return {
          title: title,
          rating: rating,
          date: date,
          year: year,
          tmdbId: tmdbId,
          imdbId: imdbId,
          rewatch: isRewatch
        };
      }
    }

    // 2. Unstructured natural language line
    let date = null;
    let rating = null;
    let year = null;
    let tmdbId = null;
    let imdbId = null;
    let rewatch = false;
    let title = line;

    // Check for rewatch (capital R at the end of the original line)
    if (/\bR\s*$/.test(line)) {
      rewatch = true;
      title = title.replace(/\bR\s*$/, '');
    }

    const imdbMatch = title.match(/\b(tt\d{7,8})\b/i);
    if (imdbMatch) {
      imdbId = imdbMatch[1];
      title = title.replace(imdbMatch[0], '');
    }

    const tmdbMatch = title.match(/\b(?:tmdb[:\s]*|#)(\d{2,})\b/i);
    if (tmdbMatch) {
      tmdbId = tmdbMatch[1];
      title = title.replace(tmdbMatch[0], '');
    }

    let dateMatch = line.match(/\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/);
    if (!dateMatch)
      dateMatch = line.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/);
    if (!dateMatch)
      dateMatch = line.match(
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]*\d{4})\b/i
      );
    if (!dateMatch)
      dateMatch = line.match(
        /\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/i
      );
    if (!dateMatch)
      dateMatch = line.match(
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\b/i
      );
    if (dateMatch) {
      date = dateMatch[1];
      title = title.replace(dateMatch[0], '');
    }

    let ratingMatch = title.match(/(?:★\s*)?(\d(?:\.\d)?)\s*\/\s*5/);
    if (!ratingMatch)
      ratingMatch = title.match(
        /(?:rating[:\s]*)?\b(\d(?:\.\d)?)\b(?!\s*[\/\d])/i
      );
    if (ratingMatch) {
      const r = parseFloat(ratingMatch[1]);
      if (r >= 0.5 && r <= 5) {
        rating = r;
        title = title.replace(ratingMatch[0], '');
      }
    }

    const yearMatch = title.match(
      /(?:[\(\[]\s*)?\b(19\d{2}|20\d{2})\b(?:\s*[\)\]])?\s*$/
    );
    if (yearMatch) {
      const tempTitle = title.replace(yearMatch[0], '').trim();
      if (tempTitle.length > 0) {
        year = yearMatch[1];
        title = tempTitle;
      }
    }

    title = title
      .replace(/^[\s,;:\-–—|]+|[\s,;:\-–—|]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!title && !tmdbId && !imdbId) return null;

    return {
      title: title,
      rating: rating,
      date: date,
      year: year,
      tmdbId: tmdbId,
      imdbId: imdbId,
      rewatch: rewatch
    };
  },

  /** @param {string|null} d @returns {string} YYYY-MM-DD */
  normalizeDate(d) {
    if (!d) {
      const t = new Date();
      return (
        t.getFullYear() +
        '-' +
        String(t.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(t.getDate()).padStart(2, '0')
      );
    }
    if (d.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/))
      return d.replace(/\//g, '-');
    if (d.match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/)) {
      const p = d.split(/[-\/]/);
      return p[2] + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0');
    }
    let parseString = d;
    if (!/\b(19\d{2}|20\d{2})\b/.test(d)) {
      parseString = d + ' ' + new Date().getFullYear();
    }

    const parsed = new Date(parseString);
    if (!isNaN(parsed.getTime())) {
      return (
        parsed.getFullYear() +
        '-' +
        String(parsed.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(parsed.getDate()).padStart(2, '0')
      );
    }
    const t2 = new Date();
    return (
      t2.getFullYear() +
      '-' +
      String(t2.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(t2.getDate()).padStart(2, '0')
    );
  },

  /** @param {Array} parsed @returns {boolean} */
  isSlimExport(parsed) {
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed[0].tmdb_id !== undefined &&
      !parsed[0].p &&
      !parsed[0].g
    );
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logit.Import;
}
