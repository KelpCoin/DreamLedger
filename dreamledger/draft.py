"""Approval-gated outreach drafter. No sending and no invented pricing."""
from __future__ import annotations

from typing import Any

RESCUE_TEMPLATE = """Hi — I read your post about {problem_summary}.

I do bounded paid rescues for exactly this: identify the specific failure in the workflow, fix it, and give you back a working version with a short note on what broke and how to spot it next time.

What you get for {price_display}:
- The specific node or connection causing the failure, named
- The fix, applied and tested against a payload
- A one-page handover: what broke, what changed, how to verify

What I need from you:
- A sanitised workflow export (redact credentials)
- One failing example (input + what happened)
- One line on expected vs actual behaviour

No production credentials required. If it turns out the problem is larger than a bounded rescue, I'll tell you before doing anything else.

If that works, I'll send the checkout link.
"""

IMPLEMENTATION_TEMPLATE = """Hi — I read your post about {problem_summary}.

I do fixed-scope implementations for this kind of workflow. {scope_line}

What you get for {price_display}:
- The workflow built and working on your stack
- One tested end-to-end run with a payload you supply
- A short handover document so you can maintain it
- Two weeks of small fixes after go-live

What I need to quote accurately:
- The exact steps the automation should perform
- Which tools/systems it needs to talk to
- One example of what "working" looks like to you

Once I see those, I'll confirm scope and send the checkout link.
"""


def draft(*, buyer_handle: str, problem_summary: str, scope_kind: str, price_nzd: int, extra_scope_line: str = "") -> dict[str, Any]:
    if not buyer_handle.strip() or not problem_summary.strip():
        raise ValueError("buyer_handle and problem_summary are required")
    if price_nzd <= 0:
        raise ValueError("price_nzd must be positive")
    if scope_kind == "rescue":
        body = RESCUE_TEMPLATE.format(problem_summary=problem_summary.strip(), price_display=f"NZ${price_nzd}")
    elif scope_kind == "implementation":
        body = IMPLEMENTATION_TEMPLATE.format(problem_summary=problem_summary.strip(), price_display=f"NZ${price_nzd}", scope_line=extra_scope_line.strip())
    else:
        raise ValueError(f"unknown scope_kind: {scope_kind}")
    return {"buyer_handle": buyer_handle, "price_nzd": price_nzd, "scope_kind": scope_kind, "subject": f"Re: your post — {problem_summary.strip()[:60]}", "body": body, "approved": False, "sent": False}
