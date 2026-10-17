from __future__ import annotations
import asyncio
from apify import Actor
from src.feed_diff import FeedValidationError, compare_csv_texts

async def main() -> None:
    async with Actor:
        actor_input = await Actor.get_input() or {}
        if actor_input.get("authorizedDataUse") is not True:
            raise ValueError("Set authorizedDataUse=true only when you have permission to process both snapshots.")
        baseline = actor_input.get("baselineCsv")
        current = actor_input.get("currentCsv")
        if not isinstance(baseline, str) or not isinstance(current, str):
            raise ValueError("baselineCsv and currentCsv must both be supplied as CSV text. Network URLs are not fetched.")
        max_rows = actor_input.get("maxRows", 10000)
        max_bytes = actor_input.get("maxInputBytes", 2000000)
        if not isinstance(max_rows, int) or isinstance(max_rows, bool) or not 1 <= max_rows <= 50000:
            raise ValueError("maxRows must be an integer between 1 and 50000.")
        if not isinstance(max_bytes, int) or isinstance(max_bytes, bool) or not 1 <= max_bytes <= 5000000:
            raise ValueError("maxInputBytes must be an integer between 1 and 5000000.")
        fields = {
            "sku_field": actor_input.get("skuField", "sku"),
            "price_field": actor_input.get("priceField", "price"),
            "currency_field": actor_input.get("currencyField", "currency"),
        }
        try:
            result = compare_csv_texts(
                baseline, current, max_rows=max_rows, max_input_bytes=max_bytes, **fields
            )
        except FeedValidationError as exc:
            Actor.log.warning("Input rejected by deterministic validation: %s", exc)
            raise

        # One billable unit represents a successfully computed comparison.
        # Configure this event and its price in Apify Console before public release.
        charge = await Actor.charge(
            event_name="feed-comparison-completed",
            idempotency_key=result["comparison_idempotency_key"],
        )
        if charge.event_charge_limit_reached or charge.charged_count < 1:
            raise RuntimeError("The run spending limit prevented billing this comparison; no result was published.")
        result["billing"] = {
            "model": "APIFY_PAY_PER_EVENT",
            "event": "feed-comparison-completed",
            "charged_count": charge.charged_count,
            "pricing_configured_in_console": True,
        }
        # Persist a durable result object and dataset row after the charge is accepted.
        await Actor.set_value("OUTPUT", result, content_type="application/json; charset=utf-8")
        await Actor.push_data(result)
        Actor.log.info(
            "Comparison completed. rows=%s status=%s key=%s",
            len(result["rows"]), result["status"], result["comparison_idempotency_key"][:12]
        )

if __name__ == "__main__":
    asyncio.run(main())
