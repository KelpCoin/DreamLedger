"""Strict storage and publication boundary for privately-owned Substack research.

This module creates no website output, PR, Stripe SKU, or Truth Oracle article.
"""
from pathlib import Path
import os

STATE = Path.home() / ".local" / "share" / "beck" / "substack-ingest"
SOURCE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = STATE / "ingest.sqlite"
DEFAULT_OUTBOX = STATE / "outbox"

def _inside(child: Path, parent: Path) -> bool:
    return child == parent or parent in child.parents

def require_private_path(path, label="research"):
    """Fail closed when content would land in a source checkout or public website."""
    dest = Path(path).expanduser().resolve()
    source = SOURCE_ROOT.resolve()
    if _inside(dest, source):
        raise ValueError(label + " must be kept OUTSIDE the Substack source checkout")
    # Detect BECK's public Git checkout even if the destination is elsewhere inside it.
    for candidate in source.parents:
        if (candidate / "vercel.json").is_file() and (candidate / "public").is_dir():
            if _inside(dest, candidate):
                raise ValueError(label + " must be kept OUTSIDE the public DreamLedger repository")
            break
    webroot = os.environ.get("BECK_PUBLIC_WEBROOT", "").strip()
    if webroot and _inside(dest, Path(webroot).expanduser().resolve()):
        raise ValueError(label + " must be kept OUTSIDE BECK_PUBLIC_WEBROOT")
    if any(part.lower() in ("public", "public_html", "wwwroot") for part in dest.parts):
        raise ValueError(label + " must not reside in a public web directory")
    return str(dest)

POLICY = {
    "classification": "OWNER_PRIVATE_RESEARCH",
    "source_text_trust": "UNTRUSTED",
    "web_publication_allowed": False,
    "public_artifact_allowed": False,
    "may_trigger_commerce": False,
    "may_trigger_truth_oracle_release": False,
    "truth_oracle_requires": [
        "specific founder approval",
        "independent factual verification",
        "copyright and attribution review",
        "independently authored transformation",
        "separate explicit publish-or-sell decision",
    ],
}
