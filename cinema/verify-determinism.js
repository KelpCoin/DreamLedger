const { generateFixture, fnv1aHash } = require("./cinema-core.js");

function run() {
  const seed = 12345;
  const runA = generateFixture(seed, "Atraxa Superfriends", "Krenko Goblins", 10);
  const runB = generateFixture(seed, "Atraxa Superfriends", "Krenko Goblins", 10);
  const jsonA = JSON.stringify(runA);
  const jsonB = JSON.stringify(runB);
  const same = jsonA === jsonB;

  const otherSeed = generateFixture(99999, "Atraxa Superfriends", "Krenko Goblins", 10);
  const different = JSON.stringify(otherSeed) !== jsonA;

  console.log("EXACT_COMMAND: node cinema/verify-determinism.js");
  console.log("TEST 1 - same seed produces identical output:", same ? "PASS" : "FAIL");
  console.log("TEST 2 - different seed produces different output:", different ? "PASS" : "FAIL");
  console.log("event_source_hash (fnv1a of event array):", fnv1aHash(JSON.stringify(runA.events)));
  console.log("full_fixture_hash (fnv1a of full object):", fnv1aHash(jsonA));

  if (!same || !different) process.exit(1);
}

run();
