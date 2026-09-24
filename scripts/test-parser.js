const Parser = require('../js/parser.js');

const testCases = [
  {
    input: "Interstellar 5/5 yesterday",
    expectedTitle: "Interstellar",
    expectedRating: "5"
  },
  {
    input: "The Prestige 4.5",
    expectedTitle: "The Prestige",
    expectedRating: "4.5"
  },
  {
    input: "Dune Part Two",
    expectedTitle: "Dune Part Two",
    expectedRating: null
  },
  {
    input: "Arrival tomorrow",
    expectedTitle: "Arrival",
    expectedRating: null
  },
  {
    input: "Inception 9/10",
    expectedTitle: "Inception",
    expectedRating: "4.5"
  },
  {
    input: "Whiplash ★★★★★ rewatch",
    expectedTitle: "Whiplash",
    expectedRating: "5",
    expectedRewatch: true
  },
  {
    input: "Blade Runner 2049 4.5 2 days ago",
    expectedTitle: "Blade Runner 2049",
    expectedRating: "4.5"
  },
  {
    input: "The Matrix (1999) 5/5",
    expectedTitle: "The Matrix",
    expectedRating: "5",
    expectedYear: "1999"
  },
  {
    input: "Everything Everywhere All at Once 4.5 watched on sep 20",
    expectedTitle: "Everything Everywhere All at Once",
    expectedRating: "4.5"
  }
];

let allPassed = true;

testCases.forEach((tc, idx) => {
  const parsed = Parser.parseLine(tc.input);
  const titleOk = parsed.title.toLowerCase() === tc.expectedTitle.toLowerCase();
  const ratingOk = parsed.rating === tc.expectedRating;
  const rewatchOk = tc.expectedRewatch === undefined || parsed.isRewatch === tc.expectedRewatch;
  const yearOk = tc.expectedYear === undefined || parsed.year === tc.expectedYear;

  if (titleOk && ratingOk && rewatchOk && yearOk) {
    console.log(`✓ Test ${idx + 1} passed: "${tc.input}" -> Title: "${parsed.title}", Rating: ${parsed.rating}, Date: ${parsed.watchDate}, Rewatch: ${parsed.isRewatch}`);
  } else {
    allPassed = false;
    console.error(`✗ Test ${idx + 1} failed: "${tc.input}"`);
    console.error(`  Expected: Title="${tc.expectedTitle}", Rating=${tc.expectedRating}`);
    console.error(`  Got:      Title="${parsed.title}", Rating=${parsed.rating}, Date=${parsed.watchDate}, Rewatch=${parsed.isRewatch}`);
  }
});

// Test multi-line
const multiLineText = `Interstellar 5/5 yesterday
The Prestige 4.5
Dune Part Two
Arrival tomorrow`;

const multiResults = Parser.parse(multiLineText);
if (multiResults.length === 4) {
  console.log(`✓ Multi-line test passed: parsed ${multiResults.length} items`);
} else {
  allPassed = false;
  console.error(`✗ Multi-line test failed: expected 4 items, got ${multiResults.length}`);
}

if (!allPassed) {
  process.exit(1);
}
console.log('\nAll parser tests passed successfully!');
