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

    var apiKeyBtn = document.querySelector('[data-action="setApiKey"]');
    if (apiKeyBtn) {
      apiKeyBtn.addEventListener('click', function() {
        var key = prompt('Enter your TMDB API Key:', Logit.Config.getApiKey());
        if (key !== null) {
          Logit.Config.setApiKey(key);
          location.reload();
        }
      });
    }

    var clearBtn = document.querySelector('[data-action="clearAllData"]');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function() {
        if (!confirm('Clear all movie data from cloud? This cannot be undone.')) return;
        var client = Logit.Supabase.getClient();
        var userId = localStorage.getItem('logit_user_id');
        if (client && userId) {
          await client.from('movies').delete().eq('user_id', userId);
        }
        await renderStorage();
        alert('All movie data cleared.');
      });
    }
  }
};
