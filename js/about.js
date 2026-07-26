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
    if ($('googleApiKey')) $('googleApiKey').value = localStorage.getItem('google_api_key') || '';
    if ($('driveFolderLink')) $('driveFolderLink').value = localStorage.getItem('logit_drive_link') || '';

    // Save keys
    if ($('saveAllKeys')) $('saveAllKeys').addEventListener('click', function() {
      var tmdb = ($('tmdbApiKey') || {}).value.trim();
      var google = ($('googleApiKey') || {}).value.trim();
      var drive = ($('driveFolderLink') || {}).value.trim();

      if (tmdb) Logit.Config.setApiKey(tmdb);
      if (google) localStorage.setItem('google_api_key', google);
      else localStorage.removeItem('google_api_key');
      if (drive) localStorage.setItem('logit_drive_link', drive);
      else localStorage.removeItem('logit_drive_link');

      alert('Settings saved!');
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
