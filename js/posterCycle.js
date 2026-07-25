window.Logit = window.Logit || {};

Logit.PosterCycle = {
  start(movies) {
    var posterBg = document.getElementById('posterBg');
    if (!posterBg || !movies || movies.length === 0) return;

    var withPoster = movies.filter(function(m) { return m.sp; });
    if (withPoster.length === 0) return;

    // Create movie name label
    var nameLabel = document.createElement('div');
    nameLabel.className = 'posterBgName';
    posterBg.parentNode.insertBefore(nameLabel, posterBg.nextSibling);

    function cycle() {
      var random = withPoster[Math.floor(Math.random() * withPoster.length)];
      posterBg.style.backgroundImage = 'url(' + Logit.Utils.img(random.sp) + ')';
      posterBg.classList.add('active');
      nameLabel.querySelector('.posterBgTitle').textContent = random.t || '';
      var meta = [random.yr, random.dr, random.r ? random.r + '/5' : '', random.d].filter(Boolean).join(' · ');
      nameLabel.querySelector('.posterBgMeta').textContent = meta;
      nameLabel.classList.add('active');
    }

    nameLabel.innerHTML = '<span class="posterBgTitle"></span><span class="posterBgMeta"></span>';
    cycle();
    setInterval(cycle, 10000);
  }
};
