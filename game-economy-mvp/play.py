#!/usr/bin/env python3
"""
DreamLedger – minimal interactive play loop for the economic MVP.

This is still pure game world. The only way to cross into real-world work
is via an explicit “propose work packet” action that creates a REAL_CANDIDATE
and stops. No automatic real execution.
"""

from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from game.economy.engine import EconomyEngine
from game.economy.types import TransactionState, money_to_str
from game.work_packet import create_candidate_from_game, WorkPacketState


def print_status(engine: EconomyEngine):
    a = engine.state.avatar
    print(f"\n── Avatar ──────────────────────────────────")
    print(f"  Capital:     {money_to_str(a.capital)}")
    print(f"  Reputation:  {a.reputation}")
    print(f"  Capacity:    {a.inventory_capacity}")
    print(f"  Trades:      {a.transaction_count}")
    print(f"  Profit:      {money_to_str(a.profit_total)}  |  Loss: {money_to_str(a.loss_total)}")
    if a.inventory:
        print("  Inventory:")
        for lot in a.inventory.values():
            print(f"    {lot.commodity_id}: {lot.quantity} @ {lot.location}")


def list_opportunities(engine: EconomyEngine, limit: int = 8):
    opps = engine.discover_opportunities(engine.state.avatar.id)
    opps = sorted(opps, key=lambda o: o.risk_adjusted_spread, reverse=True)[:limit]
    print(f"\n── Top Opportunities (imperfect info) ─────")
    if not opps:
        print("  No positive risk-adjusted opportunities visible.")
        return []
    for i, o in enumerate(opps, 1):
        print(f"  [{i}] {o.commodity_id}")
        print(f"      {o.origin_market} → {o.destination_market}")
        print(f"      Buy {money_to_str(o.observed_buy_price)}  Sell {money_to_str(o.observed_sell_price)}")
        print(f"      Est. spread {money_to_str(o.estimated_spread)}  |  Risk-adj {money_to_str(o.risk_adjusted_spread)}")
        print(f"      Uncertainty penalty {money_to_str(o.uncertainty_penalty)}  |  Max qty {o.max_quantity}")
    return opps


def take_trade(engine: EconomyEngine, opps, choice: int, qty: int):
    if choice < 1 or choice > len(opps):
        print("Invalid choice.")
        return
    o = opps[choice - 1]
    qty = min(qty, o.max_quantity, 15)
    key = f"player_{engine.state.tick}_{o.commodity_id}_{qty}"
    tx = engine.authorize_trade(
        engine.state.avatar.id,
        o.commodity_id,
        qty,
        o.origin_market,
        o.destination_market,
        key,
    )
    if tx.status == TransactionState.REJECTED:
        print(f"  Rejected: {tx.failure_reason}")
        return
    settled = engine.execute_and_settle(tx.id)
    if settled.status == TransactionState.SETTLED:
        print(f"  SETTLED  net {money_to_str(settled.net_profit)}")
    elif settled.status == TransactionState.FAILED:
        print(f"  FAILED   {settled.failure_reason}")
    else:
        print(f"  Status: {settled.status.value}")


def propose_real_candidate(engine: EconomyEngine, opps, choice: int):
    """Create a REAL_CANDIDATE work packet. Does NOT execute anything real."""
    if choice < 1 or choice > len(opps):
        print("Invalid choice.")
        return
    o = opps[choice - 1]
    hypothesis = (
        f"Persistent price discrepancy on {o.commodity_id} between "
        f"{o.origin_market} and {o.destination_market}. "
        f"Observed buy {money_to_str(o.observed_buy_price)}, "
        f"observed sell {money_to_str(o.observed_sell_price)}. "
        f"Risk-adjusted spread appears positive under current information age."
    )
    packet = create_candidate_from_game(
        hypothesis=hypothesis,
        evidence_required=[
            "Current real-world spot or list prices for the commodity in both locations",
            "Transport / logistics cost quote for the route",
            "At least one potential buyer and one potential seller contact or listing",
            "Liquidity / volume evidence (can the size actually clear?)",
        ],
        potential_counterparties=[
            f"Suppliers near {o.origin_market}",
            f"Buyers near {o.destination_market}",
        ],
        expected_economics={
            "commodity": o.commodity_id,
            "observed_buy_cents": o.observed_buy_price,
            "observed_sell_cents": o.observed_sell_price,
            "estimated_spread_cents": o.estimated_spread,
            "risk_adjusted_cents": o.risk_adjusted_spread,
            "note": "Game numbers are illustrative only. Real verification required.",
        },
        verification_criteria=[
            "External economic outcome exists (actual payment or signed commitment)",
            "BrownEye evidence record created after the real outcome",
            "No game state is treated as proof of real commerce",
        ],
        source_opportunity_id=o.id,
    )
    print("\n── Work Packet created (REAL_CANDIDATE) ───")
    print(packet.to_json())
    print("\n  This packet is now ready for HUMAN_REVIEW.")
    print("  No real-world action has been taken or authorised.")
    path = Path("work_packets") / f"{packet.id}.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(packet.to_json())
    print(f"  Saved to {path}")


def main():
    print("═══════════════════════════════════════════")
    print("  DreamLedger Economic MVP – Play Session")
    print("  Pure game world. Real work is gated.")
    print("═══════════════════════════════════════════")

    engine = EconomyEngine(seed=123456)
    engine.initialize()
    engine.state.tick = 1

    while True:
        print_status(engine)
        print("\nCommands:")
        print("  o          – list opportunities")
        print("  t <n> <q>  – take trade #n with quantity q")
        print("  p <n>      – propose real-world candidate from opportunity #n")
        print("  n          – advance tick + let a few NPCs act")
        print("  g <bp>     – change marketplace fee (100-700 bp)")
        print("  q          – quit")
        try:
            cmd = input("\n> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nSession ended.")
            break

        if cmd == "q":
            break
        elif cmd == "o":
            list_opportunities(engine)
        elif cmd.startswith("t "):
            parts = cmd.split()
            if len(parts) >= 3:
                opps = list_opportunities(engine)
                take_trade(engine, opps, int(parts[1]), int(parts[2]))
            else:
                print("Usage: t <opportunity#> <quantity>")
        elif cmd.startswith("p "):
            parts = cmd.split()
            if len(parts) >= 2:
                opps = list_opportunities(engine)
                propose_real_candidate(engine, opps, int(parts[1]))
            else:
                print("Usage: p <opportunity#>")
        elif cmd == "n":
            engine.state.tick += 1
            acted = engine.tick_npcs(max_actions=3)
            print(f"  Tick {engine.state.tick}. NPCs acted on {len(acted)} trades.")
        elif cmd.startswith("g "):
            try:
                bp = int(cmd.split()[1])
                ok = engine.set_marketplace_fee(bp, "player")
                print("  Fee updated." if ok else "  Fee out of range (100-700).")
            except Exception:
                print("Usage: g <basis_points>")
        else:
            print("Unknown command.")

    print("\nFinal capital:", money_to_str(engine.state.avatar.capital))
    print("Remember: only REAL_VERIFIED outcomes with external evidence count as real revenue.")


if __name__ == "__main__":
    main()
