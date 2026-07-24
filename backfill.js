/**
 * Backfill Script: Add supporting cast (sc) and production companies (pc)
 * to old movies that don't have these fields.
 *
 * HOW TO USE:
 * 1. Open your logit app in the browser (must be logged in)
 * 2. Open browser console (F12 → Console)
 * 3. Paste this entire script and press Enter
 * 4. Wait for it to complete (rate-limited to 300ms between TMDB calls)
 */

(async function backfill() {
  var API = Logit.Config.getApiKey();
  if (!API) { console.error('No TMDB API key found. Set it from About page.'); return; }

  var client = Logit.Supabase.getClient();
  var userId = localStorage.getItem('logit_user_id');
  if (!client || !userId) { console.error('Not signed in.'); return; }

  console.log('Loading movies from Supabase...');
  var { data: movies, error } = await client.from('movies').select('*').eq('user_id', userId);
  if (error) { console.error('Failed to load movies:', error); return; }

  var toUpdate = movies.filter(function(m) { return !m.sc && !m.pc && m.tmdb_id; });
  console.log('Found ' + movies.length + ' total movies, ' + toUpdate.length + ' need backfill.');

  if (toUpdate.length === 0) {
    console.log('Nothing to backfill — all movies already have sc/pc fields.');
    return;
  }

  var updated = 0;
  var failed = 0;

  for (var i = 0; i < toUpdate.length; i++) {
    var movie = toUpdate[i];
    console.log('[' + (i + 1) + '/' + toUpdate.length + '] ' + movie.t);

    try {
      var res = await fetch('https://api.themoviedb.org/3/movie/' + movie.tmdb_id + '?api_key=' + API + '&append_to_response=credits');
      if (!res.ok) { failed++; console.log('  → TMDB error ' + res.status); await sleep(300); continue; }
      var d = await res.json();

      var cast = (d.credits && d.credits.cast) ? d.credits.cast : [];
      var supportCast = cast.filter(function(x) { return x.order >= 5; })
        .slice(0, 10).map(function(x) { return x.name; });
      var prods = (d.production_companies || []).map(function(x) { return x.name; });

      var sc = supportCast.join(', ');
      var pc = prods.join(', ');

      var { error: updateErr } = await client.from('movies').update({ sc: sc, pc: pc }).eq('id', movie.id);
      if (updateErr) { failed++; console.log('  → Update error:', updateErr.message); }
      else { updated++; console.log('  → sc: ' + (sc || '(none)') + ' | pc: ' + (pc || '(none)')); }
    } catch (e) {
      failed++;
      console.log('  → Error:', e.message);
    }

    await sleep(300); // rate limit: ~3 req/sec
  }

  console.log('═══════════════════════════════');
  console.log('Backfill complete! ' + updated + ' updated, ' + failed + ' failed out of ' + toUpdate.length);
  console.log('Refresh the page to see changes.');

  function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
})();
