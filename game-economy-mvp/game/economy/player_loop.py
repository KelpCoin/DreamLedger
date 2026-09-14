"""
Hardened Player Decision Loop contracts.

Implements the load-bearing surface:

  inspect → calculate_opportunities → authorize → tick* → proof

One EconomyEngine, multiple actors. Player is an actor with AUTHORIZE capability.
Engine is the sole authority. No direct state mutation by the player.
"""

from __future__ import annotations
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
import json

from .types import (
    Money, Quantity, Tick, TransactionState, ActorType,
    Commodity, Market, Route, InventoryLot, Avatar, NPC,
    Opportunity, Transaction, GameState, money_to_str
)
from .engine import EconomyEngine


class RejectReason(str, Enum):
    REJECTED_INSUFFICIENT_CAPITAL = "REJECTED_INSUFFICIENT_CAPITAL"
    REJECTED_INSUFFICIENT_INVENTORY = "REJECTED_INSUFFICIENT_INVENTORY"
    REJECTED_ROUTE_CAPACITY_EXHAUSTED = "REJECTED_ROUTE_CAPACITY_EXHAUSTED"
    REJECTED_ACTOR_LACKS_AUTHORITY = "REJECTED_ACTOR_LACKS_AUTHORITY"
    REJECTED_MARKET_STATE_INVALID = "REJECTED_MARKET_STATE_INVALID"
    REJECTED_OPPORTUNITY_STALE = "REJECTED_OPPORTUNITY_STALE"
    REJECTED_COMMODITY_UNAVAILABLE = "REJECTED_COMMODITY_UNAVAILABLE"
    REJECTED_NOT_AUTHORIZED = "REJECTED_NOT_AUTHORIZED"
    REJECTED_DOUBLE_SPEND = "REJECTED_DOUBLE_SPEND"


@dataclass(frozen=True)
class MarketView:
    market_id: str
    commodity_id: str
    tick: int
    current_buy_price: Money
    expected_sell_price: Money
    available_quantity: int
    market_depth: int
    information_age_ticks: int
    route_cost: Money
    route_risk_score_bp: int
    route_capacity: int
    route_capacity_available: int
    best_sell_market: str


@dataclass(frozen=True)
class RankedOpportunity:
    commodity_id: str
    buy_market: str
    sell_market: str
    quantity_suggested: int
    buy_price: Money
    sell_price: Money
    buy_cost: Money
    transport_cost: Money
    fees: Money
    estimated_risk_cost: Money
    capital_required: Money
    absolute_profit: Money
    return_on_capital_bp: int
    profit_per_capital_tick: Money
    transit_ticks: int
    information_age_ticks: int
    route_risk_score_bp: int
    market_depth: int
    route_capacity_available: int


class PlayerLoop:
    def __init__(self, engine: EconomyEngine):
        self.engine = engine
        assert engine.state is not None, "Engine must be initialized"

    def inspect(self, market_id: str, commodity_id: str) -> Optional[MarketView]:
        state = self.engine.state
        if market_id not in state.markets or commodity_id not in state.commodities:
            return None
        m = state.markets[market_id]
        buy_price = m.prices.get(commodity_id, 0)
        depth = m.liquidity.get(commodity_id, 0)
        age = m.price_age.get(commodity_id, 0)
        available = m.supply.get(commodity_id, 0)
        best_sell = buy_price
        best_market = market_id
        best_route_cost = 0
        best_risk_bp = 0
        best_cap = 0
        best_cap_avail = 0
        for other_id, other in state.markets.items():
            if other_id == market_id:
                continue
            sell_p = other.prices.get(commodity_id, 0)
            route_id = f"route_{market_id}_{other_id}"
            route = state.routes.get(route_id)
            if not route:
                continue
            cost = route.base_cost + route.distance_cost_per_unit + route.risk_cost_per_unit
            if sell_p - cost > best_sell - best_route_cost:
                best_sell = sell_p
                best_market = other_id
                best_route_cost = cost
                best_risk_bp = route.failure_probability_bp
                best_cap = route.capacity
                best_cap_avail = route.capacity
        return MarketView(
            market_id=market_id,
            commodity_id=commodity_id,
            tick=state.tick,
            current_buy_price=buy_price,
            expected_sell_price=best_sell,
            available_quantity=available,
            market_depth=depth,
            information_age_ticks=age,
            route_cost=best_route_cost,
            route_risk_score_bp=best_risk_bp,
            route_capacity=best_cap,
            route_capacity_available=best_cap_avail,
            best_sell_market=best_market,
        )

    def calculate_opportunities(
        self,
        actor_id: str,
        rank_by: str = "absolute_profit",
        limit: int = 12,
    ) -> List[RankedOpportunity]:
        state = self.engine.state
        results: List[RankedOpportunity] = []
        fee_bp = state.governance["marketplace_fee"].value
        for buy_mid, buy_m in state.markets.items():
            for sell_mid, sell_m in state.markets.items():
                if buy_mid == sell_mid:
                    continue
                route_id = f"route_{buy_mid}_{sell_mid}"
                route = state.routes.get(route_id)
                if not route:
                    continue
                for cid, commodity in state.commodities.items():
                    buy_p = buy_m.prices.get(cid, 0)
                    sell_p = sell_m.prices.get(cid, 0)
                    if buy_p <= 0 or sell_p <= 0:
                        continue
                    depth = buy_m.liquidity.get(cid, 0)
                    qty = min(8, depth, route.capacity) if depth > 0 else 0
                    if qty < 1:
                        continue
                    transport = route.base_cost + (route.distance_cost_per_unit + route.risk_cost_per_unit) * qty
                    buy_cost = buy_p * qty
                    fees = (buy_cost * fee_bp // 10000) + (sell_p * qty * fee_bp // 10000)
                    risk_cost = (route.failure_probability_bp * buy_cost) // 20000
                    capital_req = buy_cost + transport + fees
                    revenue = sell_p * qty
                    absolute = revenue - capital_req
                    if absolute <= 0:
                        continue
                    roc_bp = (absolute * 10000) // capital_req if capital_req > 0 else 0
                    transit = max(1, route.transit_time)
                    ppt = absolute // transit
                    age = buy_m.price_age.get(cid, 0)
                    results.append(RankedOpportunity(
                        commodity_id=cid,
                        buy_market=buy_mid,
                        sell_market=sell_mid,
                        quantity_suggested=qty,
                        buy_price=buy_p,
                        sell_price=sell_p,
                        buy_cost=buy_cost,
                        transport_cost=transport,
                        fees=fees,
                        estimated_risk_cost=risk_cost,
                        capital_required=capital_req,
                        absolute_profit=absolute,
                        return_on_capital_bp=roc_bp,
                        profit_per_capital_tick=ppt,
                        transit_ticks=transit,
                        information_age_ticks=age,
                        route_risk_score_bp=route.failure_probability_bp,
                        market_depth=depth,
                        route_capacity_available=route.capacity,
                    ))
        key_fn = {
            "absolute_profit": lambda o: o.absolute_profit,
            "return_on_capital": lambda o: o.return_on_capital_bp,
            "profit_per_capital_tick": lambda o: o.profit_per_capital_tick,
        }.get(rank_by, lambda o: o.absolute_profit)
        results.sort(key=key_fn, reverse=True)
        return results[:limit]

    def authorize(
        self,
        actor_id: str,
        commodity_id: str,
        quantity: int,
        buy_market: str,
        sell_market: str,
        idempotency_key: str,
    ) -> Tuple[Optional[Transaction], Optional[RejectReason]]:
        state = self.engine.state
        if actor_id == state.avatar.id:
            actor = state.avatar
            if "trade" not in actor.permissions:
                return None, RejectReason.REJECTED_ACTOR_LACKS_AUTHORITY
        elif actor_id in state.npcs:
            actor = state.npcs[actor_id]
        else:
            return None, RejectReason.REJECTED_ACTOR_LACKS_AUTHORITY
        if buy_market not in state.markets or sell_market not in state.markets:
            return None, RejectReason.REJECTED_MARKET_STATE_INVALID
        if commodity_id not in state.commodities:
            return None, RejectReason.REJECTED_COMMODITY_UNAVAILABLE
        route_id = f"route_{buy_market}_{sell_market}"
        if route_id not in state.routes:
            return None, RejectReason.REJECTED_MARKET_STATE_INVALID
        tx = self.engine.authorize_trade(
            actor_id, commodity_id, quantity, buy_market, sell_market, idempotency_key
        )
        if tx.status == TransactionState.REJECTED:
            reason_map = {
                "INSUFFICIENT_CAPITAL": RejectReason.REJECTED_INSUFFICIENT_CAPITAL,
                "INVENTORY_CAPACITY": RejectReason.REJECTED_INSUFFICIENT_INVENTORY,
                "ROUTE_CAPACITY": RejectReason.REJECTED_ROUTE_CAPACITY_EXHAUSTED,
                "NO_ROUTE": RejectReason.REJECTED_MARKET_STATE_INVALID,
            }
            return tx, reason_map.get(tx.failure_reason or "", RejectReason.REJECTED_MARKET_STATE_INVALID)
        return tx, None

    def execute_authorized(self, tx_id: str) -> Transaction:
        tx = self.engine.state.transactions.get(tx_id)
        if not tx:
            raise ValueError("unknown transaction")
        if tx.status not in (TransactionState.AUTHORIZED, TransactionState.RESERVED):
            tx.status = TransactionState.REJECTED
            tx.failure_reason = "REJECTED_NOT_AUTHORIZED"
            return tx
        return self.engine.execute_and_settle(tx_id)

    def tick(self, npc_actions: int = 2) -> Dict[str, Any]:
        state = self.engine.state
        state.tick += 1
        for m in state.markets.values():
            for cid in m.price_age:
                m.price_age[cid] += 1
        acted = self.engine.tick_npcs(max_actions=npc_actions)
        return {
            "tick": state.tick,
            "npc_actions": len(acted),
            "avatar_capital": state.avatar.capital,
        }

    def proof(self, tx_id: str) -> Dict[str, Any]:
        state = self.engine.state
        tx = state.transactions.get(tx_id)
        if not tx:
            return {"error": "unknown_transaction", "tx_id": tx_id}
        return {
            "seed": state.seed,
            "trade_id": tx.id,
            "actor_id": tx.actor_id,
            "commodity_id": tx.commodity_id,
            "origin_market": tx.origin_market,
            "destination_market": tx.destination_market,
            "quantity": tx.quantity,
            "player_decision": "AUTHORIZED" if tx.status != TransactionState.REJECTED else "REJECTED",
            "authorization_tick": tx.created_at,
            "settled_at_tick": tx.settled_at,
            "status": tx.status.value,
            "final_settlement": {
                "sale_revenue": tx.sale_revenue,
                "buy_cost": tx.purchase_cost,
                "transport_cost": tx.transport_cost,
                "fees": tx.fees,
                "transformation_cost": tx.transformation_cost,
                "profit_loss": tx.net_profit,
            },
            "event_ids": list(tx.event_ids),
            "failure_reason": tx.failure_reason,
        }

    def proof_canonical_json(self, tx_id: str) -> str:
        art = self.proof(tx_id)
        return json.dumps(art, sort_keys=True, separators=(",", ":"))
