window.Logit = window.Logit || {};

Logit.Import = {
  /** @param {string} line @returns {Object|null} */
  parseLine(line) {
    line = line.trim();
    if (!line) return null;

    // Pipe-delimited format: Movie Name | Rating | IMDb/TMDb_ID | Date | RewatchStatus
    if (line.includes('|')) {
      const parts = line.split('|').map(function(p) { return p.trim(); });
      if (parts.length >= 3) {
        const title = parts[0] || '';
        const rating = parts[1] ? parseFloat(parts[1]) : null;
        const idField = parts[2] || '';
        const date = parts[3] || null;
        const rewatch = parts[4] || null;

        let tmdbId = null;
        let imdbId = null;

        const tmdbMatch = idField.match(/tmdb[:\s]*(\d+)/i);
        if (tmdbMatch) tmdbId = tmdbMatch[1];
        const imdbMatch = idField.match(/\b(tt\d{7,8})\b/i);
        if (imdbMatch) imdbId = imdbMatch[1];
        if (!tmdbId && !imdbId && /^\d+$/.test(idField)) tmdbId = idField;

        let year = null;
        if (date) { const dp = date.match(/\d{4}/); if (dp) year = dp[0]; }

        if (!title && !tmdbId && !imdbId) return null;

        let isRewatch = false;
        if (rewatch) {
          const rw = rewatch.toLowerCase();
          if (rw === 'rewatch' || rw === 're' || rw === 'rw' || rw === 'yes' || rw === 'y') isRewatch = true;
        }

        return { title: title, rating: rating, date: date, year: year, tmdbId: tmdbId, imdbId: imdbId, rewatch: isRewatch };
      }
    }

    let date = null;
    let rating = null;
    let year = null;
    let tmdbId = null;
    let imdbId = null;
    let title = line;

    const imdbMatch = title.match(/\b(tt\d{7,8})\b/i);
    if (imdbMatch) { imdbId = imdbMatch[1]; title = title.replace(imdbMatch[0], ''); }

    const tmdbMatch = title.match(/\b(?:tmdb[:\s]*|#)(\d{2,})\b/i);
    if (tmdbMatch) { tmdbId = tmdbMatch[1]; title = title.replace(tmdbMatch[0], ''); }

    let dateMatch = line.match(/\b(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/);
    if (!dateMatch) dateMatch = line.match(/\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/);
    if (!dateMatch) dateMatch = line.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}[,\s]*\d{4})\b/i);
    if (!dateMatch) dateMatch = line.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\b/i);
    if (!dateMatch) dateMatch = line.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2})\b/i);
    if (dateMatch) { date = dateMatch[1]; title = title.replace(dateMatch[0], ''); }

    let ratingMatch = line.match(/(?:★\s*)?(\d(?:\.\d)?)\s*\/\s*5/);
    if (!ratingMatch) ratingMatch = line.match(/(?:rating[:\s]*)?(\d(?:\.\d)?)(?!\s*[\/\d])/i);
    if (ratingMatch) {
      const r = parseFloat(ratingMatch[1]);
      if (r >= 0.5 && r <= 5) { rating = r; title = title.replace(ratingMatch[0], ''); }
    }

    const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch && !date) {
      year = yearMatch[1];
      title = title.replace(yearMatch[0], '');
    } else if (date) {
      const dp = date.match(/\d{4}/);
      if (dp) year = dp[0];
    }

    title = title.replace(/^[\s,;:\-–—|]+|[\s,;:\-–—|]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!title && !tmdbId && !imdbId) return null;

    return { title: title, rating: rating, date: date, year: year, tmdbId: tmdbId, imdbId: imdbId, rewatch: false };
  },

  /** @param {string|null} d @returns {string} YYYY-MM-DD */
  normalizeDate(d) {
    if (!d) {
      const t = new Date();
      return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    }
    if (d.match(/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/)) return d.replace(/\//g, '-');
    if (d.match(/^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/)) {
      const p = d.split(/[-\/]/);
      return p[2] + '-' + p[0].padStart(2, '0') + '-' + p[1].padStart(2, '0');
    }
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) {
      return parsed.getFullYear() + '-' + String(parsed.getMonth() + 1).padStart(2, '0') + '-' + String(parsed.getDate()).padStart(2, '0');
    }
    const t2 = new Date();
    return t2.getFullYear() + '-' + String(t2.getMonth() + 1).padStart(2, '0') + '-' + String(t2.getDate()).padStart(2, '0');
  },

  /** @param {Array} parsed @returns {boolean} */
  isSlimExport(parsed) {
    return parsed.length > 0 && parsed[0].tmdb_id !== undefined && !parsed[0].p && !parsed[0].g;
  }
};
