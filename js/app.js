window.Logit = window.Logit || {};

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('library')) {
    Logit.LibraryPage.init();
  } else if (document.getElementById('directorList')) {
    Logit.StatsPage.init();
  } else if (document.getElementById('storageTotal')) {
    Logit.AboutPage.init();
  }
});
