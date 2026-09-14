from __future__ import annotations

from dataclasses import dataclass, replace
import hashlib
import json
from typing import Union

SCALE = 1000


def rand(seed: str, counter: int) -> int:
    payload = f"{seed}:{counter}".encode("utf-8")
    return int.from_bytes(hashlib.sha256(payload).digest()[:8], "big")


def rand_range(seed: str, counter: int, lo: int, hi: int) -> int:
    if lo > hi:
        raise ValueError("lo must be <= hi")
    return lo + (rand(seed, counter) % (hi - lo + 1))


@dataclass(frozen=True)
class Market:
    location: str
    commodity: str
    price: int
    stock: int


@dataclass(frozen=True)
class Player:
    location: str
    cash: int
    inventory: tuple[tuple[str, int], ...]

    def qty(self, commodity: str) -> int:
        for name, quantity in self.inventory:
            if name == commodity:
                return quantity
        return 0


@dataclass(frozen=True)
class World:
    tick: int
    seed: str
    player: Player
    markets: tuple[Market, ...]


@dataclass(frozen=True)
class Buy:
    actor: str
    location: str
    commodity: str
    qty: int
    max_price: int


@dataclass(frozen=True)
class Sell:
    actor: str
    location: str
    commodity: str
    qty: int
    min_price: int


@dataclass(frozen=True)
class Move:
    actor: str
    to_location: str
    transport_cost: int


@dataclass(frozen=True)
class Tick:
    pass


Event = Union[Buy, Sell, Move, Tick]


def genesis(seed: str, locations: list[str], commodities: list[str]) -> World:
    if not locations or not commodities:
        raise ValueError("locations and commodities must be non-empty")

    markets: list[Market] = []
    counter = 0
    for location in locations:
        for commodity in commodities:
            price = 1000 + rand_range(seed, counter, -200, 200)
            stock = rand_range(seed, counter + 1, 50, 200)
            counter += 2
            markets.append(Market(location, commodity, price, stock))

    markets.sort(key=lambda market: (market.location, market.commodity))
    return World(
        tick=0,
        seed=seed,
        player=Player(location=locations[0], cash=1000 * SCALE, inventory=()),
        markets=tuple(markets),
    )


def _find_market(
    markets: tuple[Market, ...], location: str, commodity: str
) -> Market | None:
    for market in markets:
        if market.location == location and market.commodity == commodity:
            return market
    return None


def _replace_market(
    markets: tuple[Market, ...], new_market: Market
) -> tuple[Market, ...]:
    return tuple(
        new_market
        if market.location == new_market.location
        and market.commodity == new_market.commodity
        else market
        for market in markets
    )


def _set_inventory(
    inventory: tuple[tuple[str, int], ...], commodity: str, quantity: int
) -> tuple[tuple[str, int], ...]:
    if quantity < 0:
        raise ValueError("inventory quantity cannot be negative")
    values = dict(inventory)
    if quantity == 0:
        values.pop(commodity, None)
    else:
        values[commodity] = quantity
    return tuple(sorted(values.items()))


def evolve(state: World, event: Event) -> World:
    """Apply one event and return a new state. State is never mutated."""
    if isinstance(event, Tick):
        markets = []
        for index, market in enumerate(state.markets):
            drift = rand_range(
                state.seed,
                state.tick * 10000 + index,
                -30,
                30,
            )
            markets.append(replace(market, price=max(100, market.price + drift)))
        return replace(state, tick=state.tick + 1, markets=tuple(markets))

    if event.actor != "player":
        return state

    if isinstance(event, Move):
        if event.transport_cost < 0 or state.player.cash < event.transport_cost:
            return state
        if not any(market.location == event.to_location for market in state.markets):
            return state
        player = replace(
            state.player,
            location=event.to_location,
            cash=state.player.cash - event.transport_cost,
        )
        return replace(state, player=player)

    if isinstance(event, Buy):
        if event.qty <= 0 or event.max_price < 0:
            return state
        if event.location != state.player.location:
            return state
        market = _find_market(state.markets, event.location, event.commodity)
        if market is None or market.stock < event.qty or event.max_price < market.price:
            return state
        cost = event.qty * market.price
        if state.player.cash < cost:
            return state
        player = replace(
            state.player,
            cash=state.player.cash - cost,
            inventory=_set_inventory(
                state.player.inventory,
                event.commodity,
                state.player.qty(event.commodity) + event.qty,
            ),
        )
        return replace(
            state,
            player=player,
            markets=_replace_market(state.markets, replace(market, stock=market.stock - event.qty)),
        )

    if isinstance(event, Sell):
        if event.qty <= 0 or event.min_price < 0:
            return state
        if event.location != state.player.location:
            return state
        market = _find_market(state.markets, event.location, event.commodity)
        if market is None or state.player.qty(event.commodity) < event.qty:
            return state
        if event.min_price > market.price:
            return state
        revenue = event.qty * market.price
        player = replace(
            state.player,
            cash=state.player.cash + revenue,
            inventory=_set_inventory(
                state.player.inventory,
                event.commodity,
                state.player.qty(event.commodity) - event.qty,
            ),
        )
        return replace(
            state,
            player=player,
            markets=_replace_market(state.markets, replace(market, stock=market.stock + event.qty)),
        )

    raise ValueError(f"unknown event: {event!r}")


def replay(genesis_state: World, events: list[Event]) -> World:
    state = genesis_state
    for event in events:
        state = evolve(state, event)
    return state


def canon(world: World) -> str:
    payload = {
        "tick": world.tick,
        "seed": world.seed,
        "player": {
            "location": world.player.location,
            "cash": world.player.cash,
            "inventory": [list(item) for item in world.player.inventory],
        },
        "markets": [
            {
                "location": market.location,
                "commodity": market.commodity,
                "price": market.price,
                "stock": market.stock,
            }
            for market in world.markets
        ],
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def state_hash(world: World) -> str:
    return hashlib.sha256(canon(world).encode("utf-8")).hexdigest()
