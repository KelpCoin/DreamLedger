const BOOST_MULTIPLIER = 2.5;
const REPUTATION_WEIGHT = 0.85;
const BRAIN_WEIGHT = 0.15;

function calculateScore(listing, boostExpired, reputation, brainWeight) {
    const base = (reputation || 250) / 1000;
    const brain = Math.min(brainWeight || 0, 0.15);
    const boostMult = boostExpired ? 1 : BOOST_MULTIPLIER;
    return (base * REPUTATION_WEIGHT + brain * BRAIN_WEIGHT) * boostMult;
}

function rankListings(listings, boostedSet, reputationMap, brainAlloc) {
    return listings.map(l => {
        const rep = reputationMap[l.user_id] || 250;
        const brain = brainAlloc[l.id]?.weight || 0;
        const boostExpired = !boostedSet.has(l.id);
        const score = calculateScore(l, boostExpired, rep, brain);
        return { ...l, _score: score };
    }).sort((a, b) => b._score - a._score || b.created_at.localeCompare(a.created_at));
}

module.exports = { rankListings, BOOST_MULTIPLIER };
