/**
 * Log!t Comprehensive Automated Test Suite
 * Covers Parser, Pending Serialization, Import/Export, Statistics, Backup Safeguards, and Dev Server Security.
 */

const assert = require('assert');
const path = require('path');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('Running Log!t Automated Test Suite');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // SUITE 1: Natural Language Parser (Date, Rating, Calendar Validity)
  // ----------------------------------------------------
  console.log('1. Natural Language Parser Tests');
  const Parser = require('../js/parser.js');

  test('Parses title, explicit /5 rating, and relative date', () => {
    const res = Parser.parseLine('Interstellar 5/5 yesterday');
    assert.strictEqual(res.title.toLowerCase(), 'interstellar');
    assert.strictEqual(res.rating, '5');
    assert.ok(res.watchDate);
  });

  test('Parses 9/10 normalized to 4.5/5 scale', () => {
    const res = Parser.parseLine('Inception 9/10');
    assert.strictEqual(res.title.toLowerCase(), 'inception');
    assert.strictEqual(res.rating, '4.5');
  });

  test('Parses 4★ and 4.5★ correctly without symbol count distortion', () => {
    const r1 = Parser.parseLine('The Dark Knight 4★');
    assert.strictEqual(r1.title.toLowerCase(), 'the dark knight');
    assert.strictEqual(r1.rating, '4');

    const r2 = Parser.parseLine('The Godfather 4.5★');
    assert.strictEqual(r2.title.toLowerCase(), 'the godfather');
    assert.strictEqual(r2.rating, '4.5');
  });

  test('Parses 4.5* and 4.5 stars notation', () => {
    const r1 = Parser.parseLine('Memento 4.5*');
    assert.strictEqual(r1.title.toLowerCase(), 'memento');
    assert.strictEqual(r1.rating, '4.5');

    const r2 = Parser.parseLine('Arrival 4 stars');
    assert.strictEqual(r2.title.toLowerCase(), 'arrival');
    assert.strictEqual(r2.rating, '4');
  });

  test('Parses unicode star strings (★★★★★, ★★★★☆)', () => {
    const r1 = Parser.parseLine('Whiplash ★★★★★ rewatch');
    assert.strictEqual(r1.title.toLowerCase(), 'whiplash');
    assert.strictEqual(r1.rating, '5');
    assert.strictEqual(r1.isRewatch, true);

    const r2 = Parser.parseLine('Alien ★★★★☆');
    assert.strictEqual(r2.title.toLowerCase(), 'alien');
    assert.strictEqual(r2.rating, '4');
  });

  test('Extracts release year in parentheses without corrupting title', () => {
    const res = Parser.parseLine('The Matrix (1999) 5/5');
    assert.strictEqual(res.title.toLowerCase(), 'the matrix');
    assert.strictEqual(res.year, '1999');
    assert.strictEqual(res.rating, '5');
  });

  test('Calendar validation accepts valid leap year date (Feb 29, 2024)', () => {
    assert.strictEqual(Parser._isValidCalendarDate(2024, 1, 29), true);
  });

  test('Calendar validation rejects impossible dates (Feb 29 non-leap year, Feb 30, April 31)', () => {
    assert.strictEqual(Parser._isValidCalendarDate(2023, 1, 29), false); // 2023 not leap
    assert.strictEqual(Parser._isValidCalendarDate(2024, 1, 30), false); // Feb 30 impossible
    assert.strictEqual(Parser._isValidCalendarDate(2024, 3, 31), false); // April has 30 days
    assert.strictEqual(Parser._isValidCalendarDate(2024, 5, 31), false); // June has 30 days
  });

  test('Date parser does not roll over impossible dates (e.g. 2023-02-30)', () => {
    // Should NOT roll over to 2023-03-02
    const res = Parser.parseLine('Titanic 5/5 on 2023-02-30');
    assert.notStrictEqual(res.watchDate, '2023-03-02');
  });

  test('Multi-line parser handles batch entries', () => {
    const lines = 'Interstellar 5/5\nThe Prestige 4.5\nDune 4★';
    const batch = Parser.parse(lines);
    assert.strictEqual(batch.length, 3);
    assert.strictEqual(batch[0].title.toLowerCase(), 'interstellar');
    assert.strictEqual(batch[1].title.toLowerCase(), 'the prestige');
    assert.strictEqual(batch[2].title.toLowerCase(), 'dune');
  });

  // ----------------------------------------------------
  // SUITE 2: Pending Queue Schema Serialization & Queue Isolation
  // ----------------------------------------------------
  console.log('\n2. Pending Queue Schema & Isolation Tests');
  const Pending = require('../js/pending.js');

  test('serializeForCloud produces strictly conforming pending_movies schema', () => {
    const rawCompanionItem = {
      title: 'Blade Runner 2049',
      year: '2017',
      is_rewatch: true,
      rating: '4.5',
      watchDate: '2024-06-15',
      raw: 'Blade Runner 2049 4.5 rewatch'
    };

    const serialized = Pending.serializeForCloud(rawCompanionItem, 'user_123');

    // Required database columns
    assert.strictEqual(serialized.user_id, 'user_123');
    assert.strictEqual(serialized.movie_title, 'Blade Runner 2049');
    assert.strictEqual(serialized.rating, '4.5');
    assert.strictEqual(serialized.watch_date, '2024-06-15');
    assert.strictEqual(serialized.status, 'pending');
    assert.deepStrictEqual(serialized.metadata, {
      year: '2017',
      is_rewatch: true
    });

    // CRITICAL: Unrecognized top-level fields MUST NOT exist (would break PostgREST)
    assert.strictEqual(serialized.title, undefined);
    assert.strictEqual(serialized.year, undefined);
    assert.strictEqual(serialized.is_rewatch, undefined);
    assert.strictEqual(serialized.isRewatch, undefined);
    assert.strictEqual(serialized.watchDate, undefined);
  });

  test('deserializeFromCloud restores normalized application properties', () => {
    const dbRow = {
      id: 'row_123',
      user_id: 'user_123',
      raw_input: 'Dune Part Two 5',
      movie_title: 'Dune Part Two',
      tmdb_id: '693134',
      rating: '5',
      watch_date: '2024-03-01',
      status: 'matched',
      metadata: { year: '2024', is_rewatch: false, poster_path: '/poster.jpg' },
      created_at: '2024-03-01T10:00:00Z',
      updated_at: '2024-03-01T10:00:00Z'
    };

    const appItem = Pending.deserializeFromCloud(dbRow);
    assert.strictEqual(appItem.title, 'Dune Part Two');
    assert.strictEqual(appItem.movie_title, 'Dune Part Two');
    assert.strictEqual(appItem.year, '2024');
    assert.strictEqual(appItem.is_rewatch, false);
    assert.strictEqual(appItem.watchDate, '2024-03-01');
    assert.strictEqual(appItem.tmdb_id, '693134');
  });

  test('Offline queues are strictly isolated by account ID', () => {
    const anonKey = Pending._getOfflineKey(null);
    const userAKey = Pending._getOfflineKey('user_A');
    const userBKey = Pending._getOfflineKey('user_B');

    assert.strictEqual(anonKey, 'logit_offline_pending_anon');
    assert.strictEqual(userAKey, 'logit_offline_pending_user_A');
    assert.strictEqual(userBKey, 'logit_offline_pending_user_B');
    assert.notStrictEqual(userAKey, userBKey);
    assert.notStrictEqual(userAKey, anonKey);
  });

  // ----------------------------------------------------
  // SUITE 3: Import / Export Round-Trip Compatibility
  // ----------------------------------------------------
  console.log('\n3. Import / Export Round-Trip Tests');
  const Import = require('../js/import.js');

  test('Canonical 7-column TXT parses correctly without field displacement', () => {
    const line = 'Inception | 4.5/5 | 2024-05-10 | Rewatch · 2x | 2010 | 27205 | tt1375666';
    const parsed = Import.parseLine(line);

    assert.strictEqual(parsed.title, 'Inception');
    assert.strictEqual(parsed.rating, 4.5);
    assert.strictEqual(parsed.date, '2024-05-10');
    assert.strictEqual(parsed.rewatch, true);
    assert.strictEqual(parsed.year, '2010');
    assert.strictEqual(parsed.tmdbId, '27205');
    assert.strictEqual(parsed.imdbId, 'tt1375666');
  });

  test('Legacy 5-column TXT format maintains backward compatibility', () => {
    const legacyLine = 'Whiplash | 5 | tmdb:244786 | 2023-01-15 | rewatch';
    const parsed = Import.parseLine(legacyLine);

    assert.strictEqual(parsed.title, 'Whiplash');
    assert.strictEqual(parsed.rating, 5);
    assert.strictEqual(parsed.tmdbId, '244786');
    assert.strictEqual(parsed.date, '2023-01-15');
    assert.strictEqual(parsed.rewatch, true);
  });

  test('Complete JSON export preserves all rich metadata fields and is NOT flagged as slim', () => {
    const fullMovieSample = [{
      id: 'm_1',
      t: 'Oppenheimer',
      yr: '2023',
      rt: 180,
      g: 'Drama, History',
      dr: 'Christopher Nolan',
      c: 'Cillian Murphy, Emily Blunt',
      lg: 'en',
      ct: 'United States',
      r: '5',
      d: '2023-07-21',
      w: '1st Watch',
      sp: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
      sc: '#111',
      pc: '#222',
      tmdb_id: '872585',
      imdb_id: 'tt15398776',
      overview: 'The story of J. Robert Oppenheimer...'
    }];

    assert.strictEqual(Import.isSlimExport(fullMovieSample), false);
  });

  // ----------------------------------------------------
  // SUITE 4: Statistics & Average Rating Calculations
  // ----------------------------------------------------
  console.log('\n4. Statistics & Aggregation Tests');
  const StatUtils = require('../js/statutils.js');

  test('getAverageRating excludes unrated movies from divisor', () => {
    const sampleMovies = [
      { t: 'Movie A', r: '5.0' },
      { t: 'Movie B', r: '4.0' },
      { t: 'Movie C', r: null }, // Unrated
      { t: 'Movie D', r: '' },   // Unrated
      { t: 'Movie E', r: '0' }   // Unrated
    ];

    // (5.0 + 4.0) / 2 = 4.5. (Dividing by 5 would falsely yield 1.8)
    const avg = StatUtils.getAverageRating(sampleMovies);
    assert.strictEqual(avg, '4.5');
  });

  test('getAverageRating returns 0.0 for empty or all-unrated libraries', () => {
    assert.strictEqual(StatUtils.getAverageRating([]), '0.0');
    assert.strictEqual(StatUtils.getAverageRating([{ t: 'Unrated 1', r: null }, { t: 'Unrated 2', r: '' }]), '0.0');
  });

  // ----------------------------------------------------
  // SUITE 5: Development Server Path Traversal & Security
  // ----------------------------------------------------
  console.log('\n5. Development Server Path Traversal & Security Tests');
  const { resolveSafePath, ROOT } = require('./serve.js');

  test('Allows legitimate files inside repository root', () => {
    const indexPath = resolveSafePath('/index.html', ROOT);
    assert.ok(indexPath);
    assert.strictEqual(indexPath, path.resolve(ROOT, 'index.html'));

    const cssPath = resolveSafePath('/css/main.css', ROOT);
    assert.ok(cssPath);
    assert.strictEqual(cssPath, path.resolve(ROOT, 'css/main.css'));
  });

  test('Rejects ../ path traversal attacks', () => {
    assert.strictEqual(resolveSafePath('/../../etc/passwd', ROOT), null);
    assert.strictEqual(resolveSafePath('/../../../windows/win.ini', ROOT), null);
    assert.strictEqual(resolveSafePath('/../logit/../package.json', ROOT), null);
  });

  test('Rejects URL-encoded traversal attacks', () => {
    assert.strictEqual(resolveSafePath('/%2e%2e/%2e%2e/secret.txt', ROOT), null);
    assert.strictEqual(resolveSafePath('/%2e%2e%2f%2e%2e%2fetc%2fpasswd', ROOT), null);
  });

  test('Rejects sibling-directory prefix attacks (e.g. root-secret)', () => {
    const fakeSibling = ROOT + '-secret' + path.sep + 'test.txt';
    const relativeToFake = path.relative(ROOT, fakeSibling);
    // Relative starts with '..' so resolveSafePath must disallow it
    assert.ok(relativeToFake.startsWith('..'));
    assert.strictEqual(resolveSafePath('/../' + path.basename(ROOT) + '-secret/test.txt', ROOT), null);
  });

  test('Rejects null-byte poisoning attempts', () => {
    assert.strictEqual(resolveSafePath('/index.html\0.exe', ROOT), null);
    assert.strictEqual(resolveSafePath('/index.html%00.png', ROOT), null);
  });

  // ----------------------------------------------------
  // SUITE 6: Database & RLS Schema Integrity Verification
  // ----------------------------------------------------
  console.log('\n6. Database Migration & RLS Syntax Checks');
  const fs = require('fs');

  test('supabase/migrations.sql does not use unsupported ADD CONSTRAINT IF NOT EXISTS', () => {
    const sql = fs.readFileSync('supabase/migrations.sql', 'utf8');
    assert.ok(!sql.includes('ADD CONSTRAINT IF NOT EXISTS'), 'Should not contain ADD CONSTRAINT IF NOT EXISTS');
    assert.ok(sql.includes('chk_rating_range'), 'Contains check constraint for rating');
  });

  test('supabase/rls-setup.sql does not contain unrestricted USING (true) on users', () => {
    const rls = fs.readFileSync('supabase/rls-setup.sql', 'utf8');
    assert.ok(!rls.includes('ON users FOR SELECT\n  USING (true);'), 'Must not allow public SELECT USING (true) on users table');
    assert.ok(rls.includes('get_email_for_username'), 'Contains secure get_email_for_username RPC');
    assert.ok(rls.includes('check_username_available'), 'Contains secure check_username_available RPC');
  });

  test('supabase/schema.sql provides consolidated authoritative schema', () => {
    assert.ok(fs.existsSync('supabase/schema.sql'));
    const schema = fs.readFileSync('supabase/schema.sql', 'utf8');
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS movies'));
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS pending_movies'));
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS settings'));
    assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS users'));
  });

  console.log('\n====================================================');
  console.log(`Test Execution Summary: ${totalTests} total | ${passedTests} passed | ${failedTests} failed`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
