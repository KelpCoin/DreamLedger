"""Outcome-based autonomy budget. External evidence controls promotion/demotion."""
def evaluate_window(metrics: dict, thresholds: dict, current_level: str, max_level: str) -> dict:
    breaches=[k for k,v in thresholds.items() if metrics.get(k) is None or metrics[k] < v]
    if breaches:
        return {"action":"DEMOTE","level":"GATED","breaches":breaches}
    if current_level != max_level:
        return {"action":"PROMOTE","level":max_level,"breaches":[]}
    return {"action":"HOLD","level":current_level,"breaches":[]}
