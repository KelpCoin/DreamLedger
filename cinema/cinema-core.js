// DreamLedger Cinema - deterministic fixture/event generator
// schema_version: cinema-event-v1
// Pure functions only. No Math.random(). No Date.now() inside generation logic.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EVENT_TYPES = [
  { type: "draw", desc: (d) => `${d} draws a card` },
  { type: "land", desc: (d) => `${d} plays a land` },
  { type: "cast", desc: (d) => `${d} casts a spell` },
  { type: "attack", desc: (d) => `${d} attacks` },
  { type: "block", desc: (d) => `${d} blocks` },
  { type: "removal", desc: (d) => `${d} removes a threat` },
  { type: "combo", desc: (d) => `${d} assembles a combo piece` }
];

function generateFixture(seed, deckA, deckB, turnCount) {
  seed = Number(seed) >>> 0;
  deckA = deckA || "Deck A";
  deckB = deckB || "Deck B";
  turnCount = turnCount || 8;

  const rng = mulberry32(seed);
  const events = [];
  let scoreA = 0;
  let scoreB = 0;

  for (let turn = 1; turn <= turnCount; turn++) {
    const actorIsA = rng() < 0.5;
    const actor = actorIsA ? deckA : deckB;
    const actorId = actorIsA ? "A" : "B";
    const typeIdx = Math.floor(rng() * EVENT_TYPES.length);
    const ev = EVENT_TYPES[typeIdx];
    const weight = rng();

    if (actorIsA) scoreA += weight; else scoreB += weight;

    events.push({
      turn,
      actor: actorId,
      type: ev.type,
      description: ev.desc(actor),
      weight: Number(weight.toFixed(4))
    });
  }

  const winner = scoreA >= scoreB ? "A" : "B";
  const winnerName = winner === "A" ? deckA : deckB;

  return {
    schema_version: "cinema-event-v1",
    seed,
    match_id: `cinema-${seed}`,
    participants: [
      { id: "A", name: deckA },
      { id: "B", name: deckB }
    ],
    events,
    result: {
      winner,
      winner_name: winnerName,
      reason: `Cumulative event weight ${winner === "A" ? scoreA.toFixed(2) : scoreB.toFixed(2)} vs ${winner === "A" ? scoreB.toFixed(2) : scoreA.toFixed(2)}`
    }
  };
}

function fnv1aHash(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

if (typeof module !== "undefined") {
  module.exports = { mulberry32, generateFixture, fnv1aHash };
}
