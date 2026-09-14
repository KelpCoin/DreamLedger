from game.economy.engine import Buy, Move, Sell, Tick, genesis, replay, state_hash

LOCATIONS = ["PortA", "PortB", "PortC", "PortD", "PortE"]
COMMODITIES = [
    "iron", "copper", "scrap", "grain", "salt",
    "timber", "coal", "oil", "wool", "pelt",
]


def test_replay_determinism():
    events = [
        Buy("player", "PortA", "iron", 10, 2000),
        Move("player", "PortB", 500),
        Sell("player", "PortB", "iron", 10, 800),
        Tick(),
        Tick(),
    ]
    first = replay(genesis("123456", LOCATIONS, COMMODITIES), events)
    second = replay(genesis("123456", LOCATIONS, COMMODITIES), events)
    assert state_hash(first) == state_hash(second)


def test_different_seed_changes_state():
    events = [Tick(), Tick()]
    first = replay(genesis("123456", LOCATIONS, COMMODITIES), events)
    second = replay(genesis("654321", LOCATIONS, COMMODITIES), events)
    assert state_hash(first) != state_hash(second)


def test_events_do_not_mutate_input():
    initial = genesis("123456", LOCATIONS, COMMODITIES)
    initial_hash = state_hash(initial)
    replay(initial, [Tick()])
    assert state_hash(initial) == initial_hash


def test_insufficient_funds_is_noop():
    initial = genesis("123456", LOCATIONS, COMMODITIES)
    result = replay(
        initial,
        [Buy("player", "PortA", "iron", 100000, 999999)],
    )
    assert result.player.cash == initial.player.cash
    assert result.player.inventory == initial.player.inventory


def test_remote_trade_is_rejected():
    initial = genesis("123456", LOCATIONS, COMMODITIES)
    result = replay(
        initial,
        [Buy("player", "PortB", "iron", 1, 999999)],
    )
    assert state_hash(result) == state_hash(initial)


def test_seed_replay_is_stable_across_twenty_runs():
    events = [Tick(), Tick(), Tick(), Tick()]
    hashes = [
        state_hash(replay(genesis("123456", LOCATIONS, COMMODITIES), events))
        for _ in range(20)
    ]
    assert len(set(hashes)) == 1
