window.Logit = window.Logit || {};

Logit.Movies = {
  /** @param {Array} moviesList @param {string} title @returns {string} */
  watchType(moviesList, title) {
    const count = moviesList.filter(function (m) {
      return m.t === title;
    }).length;
    if (count === 0) return '1st Watch';
    return 'Rewatch \u00b7 ' + (count + 1) + 'x';
  }
};
