window.Logit = window.Logit || {};

Logit.AboutPage = {
  async init() {
    var $ = Logit.Utils.byId;

    // Initialize Supabase and check auth
    Logit.Supabase.init();

    async function renderStorage() {
      var usage = await Logit.Storage.getCloudStorageUsage();
      var fmt = Logit.Storage.formatBytes(usage.bytes);

      $('storageTotal').innerText = fmt.val;
      $('storageUnit').innerText = fmt.unit;
      $('storageSub').innerText = usage.count + ' movies synced to cloud';

      var pct = Math.min((usage.bytes / 524288000) * 100, 100);
      $('storageFill').style.width = pct + '%';
    }

    await renderStorage();

    // Load existing API keys
    if ($('tmdbApiKey')) $('tmdbApiKey').value = Logit.Config.getApiKey() || '';

    // Save key
    if ($('saveAllKeys')) $('saveAllKeys').addEventListener('click', function() {
      var tmdb = ($('tmdbApiKey') || {}).value.trim();

      if (tmdb) Logit.Config.setApiKey(tmdb);

      alert('Key saved!');
      location.reload();
    });

    var clearBtn = document.querySelector('[data-action="clearAllData"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function() {
        if (!confirm('Clear all movie data from cloud? This cannot be undone.')) return;
        var client = Logit.Supabase.getClient();
        var userId = Logit.Auth.getUserId();
        if (client && userId) {
          await client.from('movies').delete().eq('user_id', userId);
        }
        await renderStorage();
        alert('All movie data cleared.');
      });
    }
  }
};
