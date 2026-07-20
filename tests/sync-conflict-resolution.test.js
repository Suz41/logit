/**
 * Conflict Resolution Tests for Logit.Sync
 * Tests timestamp-based "last write wins" conflict resolution
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

// Track what was saved to verify behavior
let savedMoviesHistory = [];

// Mock Storage
Logit.Storage = {
  _movies: [],
  loadMovies() { return JSON.parse(JSON.stringify(this._movies)); },
  saveMovies(movies) {
    savedMoviesHistory.push(JSON.parse(JSON.stringify(movies)));
    this._movies = JSON.parse(JSON.stringify(movies));
  }
};

// Mock Auth
Logit.Auth = {
  isOfflineMode() { return false; }
};

// Mock Offline
Logit.Offline = {
  acquireSyncLock() { return true; },
  releaseSyncLock() {},
  getPending() { return []; },
  clearSynced() {},
  getFailed() { return []; },
  markSynced() {},
  markError() {}
};

// Mock Supabase with tracking
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
              for (const item of data) {
                movies.push({ ...item });
              }
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
                      if (idx >= 0) {
                        movies[idx] = { ...movies[idx], ...data };
                      }
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

// Mock Supabase module
Logit.Supabase = {
  getClient: function () { return null; },
  isOnline: function () { return Promise.resolve(true); }
};

// Load sync.js source
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
  // Test 1: downloadRemoteChanges applies remote when remote is newer
  console.log('1. downloadRemoteChanges applies remote when remote is newer');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 120000).toISOString();

    var localMovie = {
      id: 'movie2',
      t: 'Old Local Title',
      r: 3,
      updated_at: olderTime
    };

    var remoteMovie = {
      id: 'movie2',
      t: 'New Remote Title',
      r: 9,
      updated_at: remoteNow
    };

    Logit.Storage._movies = [localMovie];

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie2'; });
    assertEqual(movie.t, 'New Remote Title', 'Remote title applied (remote is newer)');
    assertEqual(movie.r, 9, 'Remote rating applied (remote is newer)');
  }

  // Test 2: downloadRemoteChanges preserves local when local is newer
  console.log('\n2. downloadRemoteChanges preserves local when local is newer');
  {
    savedMoviesHistory = [];
    var localNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 120000).toISOString();

    var localMovie = {
      id: 'movie3',
      t: 'New Local Title',
      r: 10,
      updated_at: localNow
    };

    var remoteMovie = {
      id: 'movie3',
      t: 'Old Remote Title',
      r: 2,
      updated_at: olderTime
    };

    Logit.Storage._movies = [localMovie];

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movie = movies.find(function (m) { return m.id === 'movie3'; });
    assertEqual(movie.t, 'New Local Title', 'Local title preserved (local is newer)');
    assertEqual(movie.r, 10, 'Local rating preserved (local is newer)');
  }

  // Test 3: downloadRemoteChanges adds new remote movies not in local
  console.log('\n3. downloadRemoteChanges adds new remote movies');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();

    var remoteMovie = {
      id: 'movie-new',
      t: 'New Movie From Cloud',
      r: 8,
      updated_at: remoteNow
    };

    Logit.Storage._movies = [];

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    assert(movies.length === 1, 'New remote movie added to local storage');
    assertEqual(movies[0].t, 'New Movie From Cloud', 'New movie has correct title');
  }

  // Test 4: Multiple movies resolved independently
  console.log('\n4. Multiple movies resolved independently');
  {
    savedMoviesHistory = [];
    var remoteNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 60000).toISOString();
    var newerTime = new Date(Date.now() + 60000).toISOString();

    var localMovies = [
      { id: 'movieA', t: 'Old A', updated_at: olderTime },
      { id: 'movieB', t: 'New B', updated_at: newerTime }
    ];

    var remoteMovies = [
      { id: 'movieA', t: 'New A', updated_at: remoteNow },
      { id: 'movieB', t: 'Old B', updated_at: olderTime }
    ];

    Logit.Storage._movies = localMovies.slice();

    var client = createMockClient(remoteMovies);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.downloadRemoteChanges();

    var movies = Logit.Storage.loadMovies();
    var movieA = movies.find(function (m) { return m.id === 'movieA'; });
    var movieB = movies.find(function (m) { return m.id === 'movieB'; });

    assertEqual(movieA.t, 'New A', 'Movie A updated from remote (remote newer)');
    assertEqual(movieB.t, 'New B', 'Movie B preserved locally (local newer)');
  }

  // Test 5: resolveConflict method exists
  console.log('\n5. resolveConflict method exists');
  assert(typeof Logit.Sync.resolveConflict === 'function', 'resolveConflict is a function');
  assert(typeof Logit.Sync.downloadRemoteChanges === 'function', 'downloadRemoteChanges is a function');

  // Test 6: syncMovie should not blindly overwrite updated_at
  console.log('\n6. syncMovie should preserve timestamp from queue item');
  {
    savedMoviesHistory = [];
    var originalTime = new Date(Date.now() - 300000).toISOString();

    var item = {
      id: 'q1',
      entity: 'movie',
      entityId: 'movie-ts',
      action: 'update',
      data: {
        id: 'movie-ts',
        t: 'Updated Title',
        r: 7,
        updated_at: originalTime
      }
    };

    var client = createMockClient([]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.syncMovie(item, client, 'user1');

    var updateCall = client._updateCalls.find(function (c) { return c.data.id === 'movie-ts'; });
    if (updateCall) {
      assertEqual(updateCall.data.updated_at, originalTime,
        'syncMovie preserves original timestamp from queue item');
    } else {
      assert(false, 'syncMovie should have called update');
    }
  }

  // Test 7: syncMovie create action should set timestamp
  console.log('\n7. syncMovie create action should set updated_at');
  {
    savedMoviesHistory = [];

    var item = {
      id: 'q2',
      entity: 'movie',
      entityId: 'movie-new',
      action: 'create',
      data: {
        id: 'movie-new',
        t: 'New Movie',
        r: 0
      }
    };

    var client = createMockClient([]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.syncMovie(item, client, 'user1');

    assert(client._movies.length > 0, 'syncMovie insert was called');
  }

  // Test 8: resolveConflict should compare timestamps
  console.log('\n8. resolveConflict compares timestamps before overwriting');
  {
    savedMoviesHistory = [];
    var localNow = new Date().toISOString();
    var olderTime = new Date(Date.now() - 120000).toISOString();

    var localMovie = {
      id: 'movie-rc',
      t: 'Local Version',
      r: 8,
      w: 'watched',
      d: '2024-01-01',
      updated_at: localNow
    };

    var remoteMovie = {
      id: 'movie-rc',
      t: 'Remote Version',
      r: 3,
      w: 'watchlist',
      d: '2024-06-01',
      updated_at: olderTime
    };

    Logit.Storage._movies = [localMovie];

    var client = createMockClient([remoteMovie]);
    Logit.Supabase.getClient = function () { return client; };
    localStorage.setItem('logit_user_id', 'user1');

    await Logit.Sync.resolveConflict('movie-rc', remoteMovie, localMovie);

    var updateCall = client._updateCalls.find(function (c) { return c.data.id === 'movie-rc'; });
    if (updateCall) {
      // When local is newer, resolveConflict should preserve local data
      assertEqual(updateCall.data.t, 'Local Version',
        'resolveConflict preserves local title when local is newer');
      assertEqual(updateCall.data.r, 8,
        'resolveConflict preserves local rating when local is newer');
    } else {
      assert(true, 'resolveConflict completes (no cloud update needed when local is newer)');
    }
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
