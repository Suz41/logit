window.Logit = window.Logit || {};

Logit.Export = {
  /** @param {Array} movies @param {'json'|'txt'} format @param {Function} [closeCallback] */
  doExport(movies, format, closeCallback) {
    let data, ext, mime;
    if (format === 'json') {
      const slim = movies.map(function(m) {
        return { id: m.id, t: m.t, tmdb_id: m.tmdb_id || '', imdb_id: m.imdb_id || '', yr: m.yr, r: m.r, d: m.d, w: m.w, sp: m.sp, sc: m.sc || '', pc: m.pc || '', co: m.co || '' };
      });
      data = JSON.stringify(slim, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else {
      const lines = movies.map(function(m) {
        return m.t + ' | ' + (m.r || '') + '/5 | ' + (m.d || '') + ' | ' + (m.w || '') + ' | ' + (m.yr || '') + ' | ' + (m.tmdb_id || '') + ' | ' + (m.imdb_id || '');
      });
      data = lines.join('\n');
      mime = 'text/plain';
      ext = 'txt';
    }
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'logit-movies-' + new Date().toISOString().slice(0, 10) + '.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    if (closeCallback) {
      closeCallback();
    }
  }
};
