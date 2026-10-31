if (typeof window !== 'undefined') {
  window.Logit = window.Logit || {};
}
var Logit = typeof window !== 'undefined' ? window.Logit : {};

/**
 * Log!t Export Module
 * Supports complete JSON export (with all metadata) and canonical versioned TXT export.
 */
Logit.Export = {
  /**
   * Export movie list as JSON or TXT file download.
   * @param {Array} movies
   * @param {'json'|'txt'} format
   * @param {Function} [closeCallback]
   */
  doExport(movies, format, closeCallback) {
    let data, ext, mime;

    if (format === 'json') {
      // Complete export retaining all rich metadata fields
      const full = movies.map(function (m) {
        return {
          id: m.id,
          t: m.t || '',
          yr: m.yr || '',
          rt: m.rt !== undefined && m.rt !== null ? Number(m.rt) : 0,
          g: m.g || '',
          dr: m.dr || '',
          c: m.c || '',
          lg: m.lg || '',
          ct: m.ct || '',
          r: m.r !== undefined && m.r !== null ? String(m.r) : '',
          d: m.d || '',
          w: m.w || '1st Watch',
          sp: m.sp || '',
          sc: m.sc || '',
          pc: m.pc || '',
          tmdb_id: m.tmdb_id ? String(m.tmdb_id) : '',
          imdb_id: m.imdb_id || '',
          overview: m.overview || '',
          created_at: m.created_at || '',
          updated_at: m.updated_at || ''
        };
      });
      data = JSON.stringify(full, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else {
      // Canonical TXT export:
      // Title | Rating | Watch Date | Watch Status | Year | TMDB ID | IMDb ID
      const lines = movies.map(function (m) {
        const ratingStr = m.r ? m.r + '/5' : '';
        return (
          (m.t || '').trim() +
          ' | ' +
          ratingStr +
          ' | ' +
          (m.d || '').trim() +
          ' | ' +
          (m.w || '1st Watch').trim() +
          ' | ' +
          (m.yr || '').trim() +
          ' | ' +
          (m.tmdb_id ? String(m.tmdb_id).trim() : '') +
          ' | ' +
          (m.imdb_id || '').trim()
        );
      });
      data = lines.join('\n');
      mime = 'text/plain';
      ext = 'txt';
    }

    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      'logit-movies-' + new Date().toISOString().slice(0, 10) + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (closeCallback) {
      closeCallback();
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logit.Export;
}
