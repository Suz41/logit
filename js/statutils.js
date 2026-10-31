if (typeof window !== 'undefined') {
  window.Logit = window.Logit || {};
}
var Logit = typeof window !== 'undefined' ? window.Logit : {};

Logit.StatUtils = {
  /**
   * Calculate average rating considering only rated movies (r > 0).
   * Excludes unrated records so empty ratings do not falsely penalize average.
   * @param {Array} movies
   * @returns {string} Average formatted to 1 decimal place, e.g. "4.2" or "0.0"
   */
  getAverageRating(movies) {
    if (!Array.isArray(movies) || movies.length === 0) return '0.0';
    const rated = movies.filter(function (m) {
      if (!m || m.r === null || m.r === undefined || m.r === '') return false;
      const val = Number(m.r);
      return !isNaN(val) && val > 0;
    });
    if (rated.length === 0) return '0.0';
    const sum = rated.reduce(function (acc, m) {
      return acc + Number(m.r);
    }, 0);
    return (sum / rated.length).toFixed(1);
  },

  /** @param {Array} movies @returns {Object} Aggregated statistics */
  aggregate(movies) {
    const data = {
      countryCount: {},
      directorCount: {},
      mainActorCount: {},
      supportActorCount: {},
      actorCount: {},
      productionCount: {},
      productionMovies: {},
      genreCount: {},
      genreMovies: {},
      langCount: {},
      langMovies: {},
      regionMovies: {},
      decadeCount: {},
      decadeMovies: {},
      rewatchMap: {}
    };

    if (!Array.isArray(movies)) return data;

    movies.forEach((movie) => {
      /* COUNTRY */
      if (movie.ct) {
        let country = movie.ct;
        if (country === 'United States of America') {
          country = 'United States';
        }
        data.countryCount[country] = (data.countryCount[country] || 0) + 1;
        if (!data.regionMovies[country]) data.regionMovies[country] = [];
        data.regionMovies[country].push(movie.t);
      }

      /* GENRES */
      if (movie.g) {
        movie.g.split(',').forEach((g) => {
          const genre = g.trim();
          if (!genre) return;
          data.genreCount[genre] = (data.genreCount[genre] || 0) + 1;
          if (!data.genreMovies[genre]) data.genreMovies[genre] = [];
          data.genreMovies[genre].push(movie.t);
        });
      }

      /* LANGUAGES */
      if (movie.lg) {
        movie.lg.split(',').forEach((l) => {
          const lang = l.trim();
          if (!lang) return;
          data.langCount[lang] = (data.langCount[lang] || 0) + 1;
          if (!data.langMovies[lang]) data.langMovies[lang] = [];
          data.langMovies[lang].push(movie.t);
        });
      }

      /* DIRECTORS */
      if (movie.dr) {
        const name = movie.dr;
        if (!data.directorCount[name]) {
          data.directorCount[name] = { img: '', movies: new Set() };
        }
        data.directorCount[name].movies.add(movie.t);
      }

      /* ACTORS — split main vs supporting */
      if (movie.c) {
        movie.c.split(',').forEach((actor) => {
          const name = actor.trim();
          if (!name) return;
          if (!data.mainActorCount[name]) {
            data.mainActorCount[name] = { img: '', movies: new Set() };
          }
          data.mainActorCount[name].movies.add(movie.t);
          if (!data.actorCount[name]) {
            data.actorCount[name] = { img: '', movies: new Set() };
          }
          data.actorCount[name].movies.add(movie.t);
        });
      }
      if (movie.sc) {
        movie.sc.split(',').forEach((actor) => {
          const name = actor.trim();
          if (!name) return;
          if (!data.supportActorCount[name]) {
            data.supportActorCount[name] = { img: '', movies: new Set() };
          }
          data.supportActorCount[name].movies.add(movie.t);
        });
      }

      /* PRODUCTION COMPANIES */
      if (movie.pc) {
        const name = movie.pc.trim();
        if (name) {
          if (!data.productionCount[name]) {
            data.productionCount[name] = { img: '', movies: new Set() };
          }
          data.productionCount[name].movies.add(movie.t);
          if (!data.productionMovies[name]) data.productionMovies[name] = [];
          data.productionMovies[name].push(movie.t);
        }
      }

      /* DECADES */
      const yr = parseInt(movie.yr, 10);
      if (yr && !isNaN(yr)) {
        const decade = Math.floor(yr / 10) * 10 + 's';
        data.decadeCount[decade] = (data.decadeCount[decade] || 0) + 1;
        if (!data.decadeMovies[decade]) data.decadeMovies[decade] = [];
        data.decadeMovies[decade].push(movie.t);
      }

      /* REWATCHES */
      const title = movie.t || '';
      if (title) {
        if (!data.rewatchMap[title])
          data.rewatchMap[title] = { count: 0, dates: [] };
        data.rewatchMap[title].count++;
        if (movie.d) data.rewatchMap[title].dates.push(movie.d);
      }
    });

    return data;
  },

  /** @param {number} mins @returns {{ main: string, sub: string }} */
  formatTime(mins) {
    if (!mins) {
      return {
        main: '0h',
        sub: '0 min · 0 days · 0 months'
      };
    }
    const hours = Math.floor(mins / 60);
    const days = Math.floor(mins / 1440);
    const months = (mins / 43800).toFixed(1);
    return {
      main: `${hours}h`,
      sub: `${mins.toLocaleString()} min · ${days} days · ${months} months`
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Logit.StatUtils;
}
