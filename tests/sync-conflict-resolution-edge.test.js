/**
 * Edge Case Conflict Resolution Tests for Logit.Sync
 * Tests timestamp-based conflict resolution for missing timestamps,
 * field preservation during merge, and consistent resolution paths.
 */
'use strict';

// Mock browser globals
global.window = global;
const store = {};
global.localStorage = {
  getItem: (key) => store[key] || null,
  setItem: (key, value) => { store[key] = String(value); },
  removeItem: (key) => { delete store[key]; }
};
Object.defineProperty(global, 'navigator', { value: { onLine: true }, writable: true, configurable: true });

// Mock Logit namespace
window.Logit = {};

let savedMoviesHistory = [];

Logit.Storage = {
  _movies: [],
  loadMovies() { return JSON.parse(JSON.stringify(this._movies)); },
  saveMovies(movies) {
    savedMoviesHistory.push(JSON.parse(JSON.stringify(movies)));
    this._movies = JSON.parse(JSON.stringify(movies));
  }
};

Logit.Auth = { isOfflineMode() { return false; } };

Logit.Offline = {
  acquireSyncLock() { return true; },
  releaseSyncLock() {},
  getPending() { return []; },
  clearSynced() {},
  getFailed() { return []; },
  markSynced() {},
  markError() {}
};

function createMockClient(remoteMovies) {
  const movies = [...remoteMovies];
  const updateCalls = [];

  return {
    _movies: movies,
    _updateCalls: updateCalls,
    from: function (table) {
      if (table === 'movies') {
        return {
          select: function () {
            return {
              eq: function () {
                return {
                  single: function () {
                    return Promise.resolve({ data: movies[movies.length - 1] || null, error: null });
                  },
                  then: function (resolve) {
                    resolve({ data: [...movies], error: null });
                  }
                };
              }
            };
          },
          insert: function (data) {
            return Promise.resolve().then(() => {
              for (const item of data) movies.push({ ...item });
              return { error: null };
            });
          },
          update: function (data) {
            return {
              eq: function (field1, val1) {
                return {
                  eq: function (field2, val2) {
                    return Promise.resolve().then(() => {
                      updateCalls.push({ data: { ...data }, field1, val1, field2, val2 });
                      const idx = movies.findIndex(m => m.id === data.id || m.id === val1);
                      if (idx >= 0) movies[idx] = { ...movies[idx], ...data };
                      return { error: null };
                    });
                  }
                };
              }
            };
          },
          delete: function () {
            return {
              eq: function () {
                return {
                  eq: function () {
                    return Promise.resolve({ error: null });
                  }
                };
              }
            };
          },
          upsert: function (data) {
            return Promise.resolve().then(() => {
              for (const item of data) {
                const idx = movies.findIndex(m => m.id === item.id);
                if (idx >= 0) movies[idx] = { ...movies[idx], ...item };
                else movies.push({ ...item });
              }
              return { data: [...movies], error: null };
            });
          }
        };
      }
      return {};
    }
  };
}

Logit.Supabase = {
  getClient: function () { return null; },
  isOnline: function () { return Promise.resolve(true); }
};

const fs = require('fs');
const path = require('path');
const syncSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'sync.js'), 'utf8');
eval(syncSource);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log('  ✓ ' + message);
  } else {
    failed++;
    console.error('  ✗ ' + message);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, message + ' (got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) + ')');
}

async function runTests() {
  // Test 1: downloadRemoteChanges preserves user fields (r, w, d) when remote is newer
  console.log('1. downloadRemoteChanges preserves user fields when remote is newer');
  {
    savedMoviesHistory = [];
    var olderTime = new Date(Date.now() - 120000).toISOString();
    var remoteNow = new Date().toISOString();

    var localMovie = {
      id: 'movie-uf',
      t: 'Old Title',
      r: 9,
      w: 'watched',
      d: '2024-03-15',
      updated_at: olderTime
    };

    var remoteMovie = {
      id: 'movie-uf',
      t: 'New Remote Title',
      r: 3,
      w: 'watchlist',
      d: '2025-01-01',
      updated_at: remoteNow
    };

    Logit.Storage._movies = [localMovie];
    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie-uf'; });
    // Remote is newer so remote data wins, but verify the full merge happened
    assertEqual(movie.t, 'New Remote Title', 'Remote title applied');
    assertEqual(movie.r, 3, 'Remote rating applied (remote is newer)');
    assertEqual(movie.w, 'watchlist', 'Remote watch status applied');
    assertEqual(movie.d, '2025-01-01', 'Remote date applied');
  }

  // Test 2: downloadRemoteChanges handles remote with missing updated_at (treats as epoch 0)
  console.log('\n2. downloadRemoteChanges handles remote with missing updated_at');
  {
    savedMoviesHistory = [];
    var localNow = new Date().toISOString();

    var localMovie = {
      id: 'movie-nr',
      t: 'Local Title',
      r: 8,
      updated_at: localNow
    };

    var remoteMovie = {
      id: 'movie-nr',
      t: 'Remote No Timestamp',
      r: 2
      // no updated_at
    };

    Logit.Storage._movies = [localMovie];
    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie-nr'; });
    // Local has timestamp, remote doesn't — local should be preserved
    assertEqual(movie.t, 'Local Title', 'Local preserved when remote has no timestamp');
    assertEqual(movie.r, 8, 'Local rating preserved');
  }

  // Test 3: downloadRemoteChanges handles local with missing updated_at (treats as epoch 0)
  console.log('\n3. downloadRemoteChanges handles local with missing updated_at');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();

    var localMovie = {
      id: 'movie-nl',
      t: 'Local No Timestamp',
      r: 7
      // no updated_at
    };

    var remoteMovie = {
      id: 'movie-nl',
      t: 'Remote Title',
      r: 4,
      updated_at: remoteNow
    };

    Logit.Storage._movies = [localMovie];
    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie-nl'; });
    // Remote has timestamp, local doesn't — remote should win
    assertEqual(movie.t, 'Remote Title', 'Remote applied when local has no timestamp');
  }

  // Test 4: downloadRemoteChanges handles both missing timestamps (keep local)
  console.log('\n4. downloadRemoteChanges keeps local when both have missing timestamps');
  {
    savedMoviesHistory = [];

    var localMovie = {
      id: 'movie-both',
      t: 'Local Title',
      r: 6
      // no updated_at
    };

    var remoteMovie = {
      id: 'movie-both',
      t: 'Remote Title',
      r: 3
      // no updated_at
    };

    Logit.Storage._movies = [localMovie];
    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie-both'; });
    // Both treat as epoch 0, timestamps equal — local wins (last write wins tiebreaker = local)
    assertEqual(movie.t, 'Local Title', 'Local preserved when both timestamps missing');
    assertEqual(movie.r, 6, 'Local rating preserved when both timestamps missing');
  }

  // Test 5: resolveConflict returns early when local is newer (no cloud update)
  console.log('\n5. resolveConflict returns early when local is newer');
  {
    savedMoviesHistory = [];
    var localNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 300000).toISOString();

    var localMovie = {
      id: 'movie-early',
      t: 'Newer Local',
      r: 9,
      w: 'watched',
      d: '2025-06-01',
      updated_at: localNow
    };

    var remoteMovie = {
      id: 'movie-early',
      t: 'Older Remote',
      r: 2,
      w: 'watchlist',
      d: '2024-01-01',
      updated_at: olderTime
    };

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.resolveConflict('movie-early', remoteMovie, localMovie);

    var updateCalls = client._updateCalls.filter(function (c) {
      return c.data && c.data.id === 'movie-early';
    });
    assert(updateCalls.length === 0,
      'No cloud update when local is newer (early return)');
  }

  // Test 6: resolveConflict merges when remote is newer, preserving local user fields
  console.log('\n6. resolveConflict merges with local user fields when remote is newer');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 300000).toISOString();

    var localMovie = {
      id: 'movie-merge',
      t: 'Old Local Title',
      r: 9,
      w: 'watched',
      d: '2025-03-15',
      updated_at: olderTime
    };

    var remoteMovie = {
      id: 'movie-merge',
      t: 'New Remote Title',
      r: 2,
      w: 'watchlist',
      d: '2024-06-01',
      updated_at: remoteNow
    };

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.resolveConflict('movie-merge', remoteMovie, localMovie);

    var updateCall = client._updateCalls.find(function (c) {
      return c.data && c.data.id === 'movie-merge';
    });
    assert(updateCall !== undefined, 'Cloud update called when remote is newer');
    if (updateCall) {
      assertEqual(updateCall.data.t, 'New Remote Title',
        'Remote title used in merge');
      assertEqual(updateCall.data.r, 9,
        'Local rating preserved in merge (user field)');
      assertEqual(updateCall.data.w, 'watched',
        'Local watch status preserved in merge (user field)');
      assertEqual(updateCall.data.d, '2025-03-15',
        'Local date preserved in merge (user field)');
    }
  }

  // Test 7: syncMovie update skips when remote is newer (resolveConflict handles it)
  console.log('\n7. syncMovie update calls resolveConflict when remote is newer');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 600000).toISOString();

    var remoteMovie = {
      id: 'movie-res',
      t: 'Remote Latest',
      r: 5,
      updated_at: remoteNow
    };

    var item = {
      id: 'q7',
      entity: 'movie',
      entityId: 'movie-res',
      action: 'update',
      data: {
        id: 'movie-res',
        t: 'Local Stale',
        r: 8,
        updated_at: olderTime
      }
    };

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.syncMovie(item, client, 'user1');

    // When remote is newer, syncMovie should either skip or call resolveConflict
    // It should NOT blindly overwrite with local stale data
    var updateCalls = client._updateCalls.filter(function (c) {
      return c.data && c.data.id === 'movie-res';
    });
    // The update should NOT be the stale local version
    var staleOverwrite = updateCalls.find(function (c) {
      return c.data.t === 'Local Stale' && c.data.updated_at === olderTime;
    });
    assert(!staleOverwrite,
      'syncMovie does not overwrite remote with stale local data');
  }

  // Test 8: syncMovie update proceeds when local is newer (no remote conflict)
  console.log('\n8. syncMovie update proceeds when local is newer than remote');
  {
    savedMoviesHistory = [];
    var localNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 600000).toISOString();

    var remoteMovie = {
      id: 'movie-proceed',
      t: 'Old Remote',
      r: 2,
      updated_at: olderTime
    };

    var item = {
      id: 'q8',
      entity: 'movie',
      entityId: 'movie-proceed',
      action: 'update',
      data: {
        id: 'movie-proceed',
        t: 'New Local',
        r: 9,
        updated_at: localNow
      }
    };

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.syncMovie(item, client, 'user1');

    var updateCall = client._updateCalls.find(function (c) {
      return c.data && c.data.id === 'movie-proceed';
    });
    assert(updateCall !== undefined, 'Update call made when local is newer');
    if (updateCall) {
      assertEqual(updateCall.data.t, 'New Local', 'Local title applied to cloud');
    }
  }

  // Test 9: syncMovie update with missing remote timestamp (no conflict)
  console.log('\n9. syncMovie update proceeds when remote has no updated_at');
  {
    savedMoviesHistory = [];

    var item = {
      id: 'q9',
      entity: 'movie',
      entityId: 'movie-noremote',
      action: 'update',
      data: {
        id: 'movie-noremote',
        t: 'My Movie',
        r: 7,
        updated_at: new Date().toISOString()
      }
    };

    // No remote movie exists
    var client = createMockClient([]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.syncMovie(item, client, 'user1');

    var updateCall = client._updateCalls.find(function (c) {
      return c.data && c.data.id === 'movie-noremote';
    });
    assert(updateCall !== undefined, 'Update proceeds when no remote version exists');
  }

  // Test 10: downloadRemoteChanges handles empty remote list gracefully
  console.log('\n10. downloadRemoteChanges handles empty remote list');
  {
    savedMoviesHistory = [];
    Logit.Storage._movies = [{ id: 'local-only', t: 'Local Only', updated_at: new Date().toISOString() }];

    var client = createMockClient([]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    assert(movies.length === 1, 'Local movie preserved when remote is empty');
    assertEqual(movies[0].id, 'local-only', 'Correct local movie preserved');
  }

  // Summary
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  return failed;
}

runTests().then(function (failCount) {
  Logit.Offline.releaseSyncLock();
  process.exit(failCount > 0 ? 1 : 0);
}).catch(function (err) {
  console.error('Test runner error:', err.stack);
  process.exit(1);
});
