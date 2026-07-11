window.Logit = window.Logit || {};

Logit.Export = {
  /** @param {Array} movies @param {'json'|'csv'|'txt'} format @param {Function} [closeCallback] */
  doExport(movies, format, closeCallback) {
    let data, ext, mime;
    if (format === 'json') {
      const slim = movies.map(function(m) {
        return { id: m.id, t: m.t, tmdb_id: m.tmdb_id || '', imdb_id: m.imdb_id || '', yr: m.yr, r: m.r, d: m.d, w: m.w, sp: m.sp };
      });
      data = JSON.stringify(slim, null, 2);
      mime = 'application/json';
      ext = 'json';
    } else if (format === 'csv') {
      const header = 'Title,Rating,Date,Rewatched,Year,TMDB ID,IMDB ID';
      const rows = movies.map(function(m) {
        return '"' + (m.t || '').replace(/"/g, '""') + '",' + (m.r || '') + ',' + (m.d || '') + ',' + (m.w ? 'Yes' : 'No') + ',' + (m.yr || '') + ',' + (m.tmdb_id || '') + ',' + (m.imdb_id || '');
      });
      data = header + '\n' + rows.join('\n');
      mime = 'text/csv';
      ext = 'csv';
    } else {
      const lines = movies.map(function(m) {
        const rating = (m.r || '').toString().replace('/5', '');
        let idField = '';
        if (m.tmdb_id) idField = 'tmdb:' + m.tmdb_id;
        else if (m.imdb_id) idField = m.imdb_id;
        return m.t + ' | ' + rating + ' | ' + idField + ' | ' + (m.d || '') + ' | ' + (m.w ? 'rewatch' : '');
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
