window.Logit = window.Logit || {};

Logit.MovieFactory = {
  generateUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /** @param {Object} d TMDB movie detail @param {string} rating @param {string} watchType @param {string} watchDate @returns {Object} */
  fromTMDB(d, rating, watchType, watchDate) {
    var cast = (d.credits && d.credits.cast) ? d.credits.cast : [];
    var mainCast = cast.filter(function(x) { return x.order < 5; })
      .slice(0, 5).map(function(x) { return x.name; });
    var supportCast = cast.filter(function(x) { return x.order >= 5; })
      .slice(0, 10).map(function(x) { return x.name; });
    var prods = (d.production_companies || []).map(function(x) { return x.name; });
    var mainProd = prods.length > 0 ? prods[0] : '';
    var coProds = prods.slice(1);

    return {
      id: this.generateUUID(),
      tmdb_id: String(d.id || ''),
      imdb_id: d.imdb_id || '',
      t: d.title || '',
      yr: (d.release_date || '').slice(0, 4),
      rt: d.runtime || 0,
      g: (d.genres || []).map(function(x) { return x.name; }).join(', '),
      dr: ((d.credits && d.credits.crew ? d.credits.crew.find(function(x) { return x.job === 'Director'; }) : null) || {}).name || '',
      c: mainCast.join(', '),
      sc: supportCast.join(', '),
      pc: mainProd,
      co: coProds.join(', '),
      lg: d.original_language || '',
      ct: (d.production_countries && d.production_countries[0] ? d.production_countries[0].name : ''),
      r: rating,
      w: watchType,
      d: watchDate,
      sp: d.poster_path || ''
    };
  }
};
