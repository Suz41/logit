window.Logit = window.Logit || {};

Logit.StatUtils = {
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

    movies.forEach(movie => {
      /* COUNTRY */
      if (movie.ct) {
        let country = movie.ct;
        if (country === "United States of America") {
          country = "United States";
        }
        data.countryCount[country] = (data.countryCount[country] || 0) + 1;
        if (!data.regionMovies[country]) data.regionMovies[country] = [];
        data.regionMovies[country].push(movie.t);
      }

      /* GENRES */
      if (movie.g) {
        movie.g.split(',').forEach(g => {
          const genre = g.trim();
          if (!genre) return;
          data.genreCount[genre] = (data.genreCount[genre] || 0) + 1;
          if (!data.genreMovies[genre]) data.genreMovies[genre] = [];
          data.genreMovies[genre].push(movie.t);
        });
      }

      /* LANGUAGES */
      if (movie.lg) {
        movie.lg.split(',').forEach(l => {
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
        movie.c.split(',').forEach(actor => {
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
        movie.sc.split(',').forEach(actor => {
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
        movie.pc.split(',').forEach(prod => {
          const name = prod.trim();
          if (!name) return;
          if (!data.productionCount[name]) {
            data.productionCount[name] = { img: '', movies: new Set() };
          }
          data.productionCount[name].movies.add(movie.t);
          if (!data.productionMovies[name]) data.productionMovies[name] = [];
          data.productionMovies[name].push(movie.t);
        });
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
        if (!data.rewatchMap[title]) data.rewatchMap[title] = { count: 0, dates: [] };
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
        main: "0h",
        sub: "0 min · 0 days · 0 months"
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
