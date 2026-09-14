"""
DreamLedger MVP - Core types and fixed-point arithmetic.
All monetary values use integer units (cents). No floating point for currency.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Any
import json


# Fixed-point: 1 unit = 1 cent. All calculations stay in integers.
Money = int
Quantity = int
Tick = int


class TransactionState(Enum):
    DISCOVERED = "DISCOVERED"
    AUTHORIZED = "AUTHORIZED"
    RESERVED = "RESERVED"
    EXECUTED = "EXECUTED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    SOLD = "SOLD"
    SETTLED = "SETTLED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"
    EXPIRED = "EXPIRED"


class ActorType(Enum):
    PLAYER = "PLAYER"
    NPC = "NPC"


class CommodityId(str, Enum):
    COPPER_PARTS = "copper_parts"
    FRESH_PRODUCE = "fresh_produce"
    SCRAP_COMPONENTS = "scrap_components"
    STEEL_INGOTS = "steel_ingots"
    TEXTILE_BOLTS = "textile_bolts"
    ELECTRONICS = "electronics"
    CHEMICALS = "chemicals"
    RARE_EARTH = "rare_earth"
    MACHINERY = "machinery"
    CONSUMABLES = "consumables"


class MarketId(str, Enum):
    MARKET_A = "market_a"
    MARKET_B = "market_b"
    MARKET_C = "market_c"
    MARKET_D = "market_d"
    MARKET_E = "market_e"


@dataclass(frozen=True)
class Commodity:
    id: str
    name: str
    base_value: Money
    mass: int  # units of mass
    volume: int  # units of volume
    spoil_rate_per_tick: int = 0  # expected loss units per tick in transit (scaled)
    transform_input: Optional[str] = None
    transform_output: Optional[str] = None
    transform_ratio_in: int = 1
    transform_ratio_out: int = 1
    transform_cost_per_unit: Money = 0


@dataclass
class Market:
    id: str
    name: str
    location: str
    prices: Dict[str, Money]          # commodity_id -> current price
    supply: Dict[str, Quantity]
    demand: Dict[str, Quantity]
    price_age: Dict[str, Tick]        # ticks since last observation update
    liquidity: Dict[str, Quantity]    # how much can be bought/sold before impact
    transport_links: List[str]        # route ids


@dataclass
class Route:
    id: str
    from_market: str
    to_market: str
    distance: int
    base_cost: Money
    distance_cost_per_unit: Money
    risk_cost_per_unit: Money
    transit_time: Tick
    failure_probability_bp: int  # basis points (0-10000)
    capacity: Quantity


@dataclass
class InventoryLot:
    id: str
    avatar_id: str
    commodity_id: str
    quantity: Quantity
    acquisition_cost: Money  # total cost basis
    acquisition_transaction_id: str
    location: str  # market id or "in_transit"


@dataclass
class Avatar:
    id: str
    name: str
    capital: Money
    inventory: Dict[str, InventoryLot]  # lot_id -> lot
    inventory_capacity: Quantity
    skills: Dict[str, int]
    reputation: int
    specialization: str
    transaction_count: int
    profit_total: Money
    loss_total: Money
    permissions: List[str]
    authority_limit: Money


@dataclass
class NPC:
    id: str
    archetype: str
    capital: Money
    inventory: Dict[str, InventoryLot]
    inventory_capacity: Quantity
    risk_tolerance: int  # 0-100
    strategy: str
    reputation: int
    authority_limit: Money
    transaction_count: int = 0
    profit_total: Money = 0
    loss_total: Money = 0


@dataclass
class Opportunity:
    id: str
    commodity_id: str
    origin_market: str
    destination_market: str
    observed_buy_price: Money
    observed_sell_price: Money
    observation_timestamp: Tick
    estimated_transport_cost: Money
    estimated_fees: Money
    estimated_spread: Money
    uncertainty_penalty: Money
    risk_adjusted_spread: Money
    max_quantity: Quantity


@dataclass
class Transaction:
    id: str
    actor_id: str
    actor_type: str
    type: str  # "TRADE"
    status: TransactionState
    authority_limit: Money
    budget_limit: Money
    idempotency_key: str
    created_at: Tick
    settled_at: Optional[Tick] = None
    commodity_id: Optional[str] = None
    quantity: Quantity = 0
    origin_market: Optional[str] = None
    destination_market: Optional[str] = None
    route_id: Optional[str] = None
    buy_price: Money = 0
    sell_price: Money = 0
    purchase_cost: Money = 0
    transport_cost: Money = 0
    transformation_cost: Money = 0
    fees: Money = 0
    sale_revenue: Money = 0
    net_profit: Money = 0
    failure_reason: Optional[str] = None
    event_ids: List[str] = field(default_factory=list)


@dataclass
class GovernanceRule:
    id: str
    name: str
    parameter: str
    value: int  # e.g. fee in basis points
    changed_by: str
    effective_tick: Tick


@dataclass
class GameEvent:
    id: str
    tick: Tick
    type: str
    payload: Dict[str, Any]


@dataclass
class GameState:
    tick: Tick
    seed: int
    district_id: str
    markets: Dict[str, Market]
    commodities: Dict[str, Commodity]
    routes: Dict[str, Route]
    avatar: Avatar
    npcs: Dict[str, NPC]
    opportunities: Dict[str, Opportunity]
    transactions: Dict[str, Transaction]
    governance: Dict[str, GovernanceRule]
    events: List[GameEvent]
    next_ids: Dict[str, int]  # for deterministic id generation


def money_to_str(m: Money) -> str:
    return f"${m / 100:.2f}"


def to_dict(obj: Any) -> Any:
    if hasattr(obj, "__dataclass_fields__"):
        return {k: to_dict(getattr(obj, k)) for k in obj.__dataclass_fields__}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {k: to_dict(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_dict(v) for v in obj]
    return obj
