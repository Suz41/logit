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
    if ($('todoistApiKeyAbout')) $('todoistApiKeyAbout').value = localStorage.getItem('logit_todoist_key') || '';
    if ($('supabaseUrl')) $('supabaseUrl').value = localStorage.getItem('supabase_url') || '';
    if ($('supabaseKey')) $('supabaseKey').value = localStorage.getItem('supabase_anon_key') || '';

    // Save all keys
    if ($('saveAllKeys')) $('saveAllKeys').addEventListener('click', function() {
      var tmdb = ($('tmdbApiKey') || {}).value.trim();
      var todoist = ($('todoistApiKeyAbout') || {}).value.trim();
      var supaUrl = ($('supabaseUrl') || {}).value.trim();
      var supaKey = ($('supabaseKey') || {}).value.trim();

      if (tmdb) Logit.Config.setApiKey(tmdb);
      if (todoist) localStorage.setItem('logit_todoist_key', todoist);
      if (supaUrl) localStorage.setItem('supabase_url', supaUrl);
      if (supaKey) localStorage.setItem('supabase_anon_key', supaKey);

      alert('All keys saved!');
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
