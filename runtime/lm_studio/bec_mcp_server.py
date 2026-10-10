"""Read-only local MCP tools for BECK. No shell, arbitrary file writes, or network tools."""
from __future__ import annotations
import json, os
from pathlib import Path
from mcp.server.fastmcp import FastMCP

ROOT = Path(os.environ.get("BEC_ROOT", Path(__file__).resolve().parents[2])).resolve()
FIXTURES = (ROOT / "runtime" / "lm_studio" / "fixtures").resolve()
mcp = FastMCP("beck-runtime-readonly")

@mcp.tool()
def runtime_status() -> dict:
    """Report local runtime paths and whether LM Studio SDK is importable."""
    try:
        import lmstudio  # noqa: F401
        sdk = True
    except Exception:
        sdk = False
    return {"runtime": "BECK", "mode": "READ_ONLY", "sdk_installed": sdk,
            "fixture_directory_exists": FIXTURES.is_dir(), "external_actions_enabled": False}

@mcp.tool()
def list_local_signal_fixtures() -> list:
    """List names of local, non-secret demand-signal fixture files."""
    if not FIXTURES.is_dir():
        return []
    return sorted(p.name for p in FIXTURES.glob("*.json") if p.is_file())

@mcp.tool()
def search_local_signal_fixtures(query: str) -> list:
    """Search only the fixed local signal-fixture directory; no web access."""
    q = str(query or "").strip().lower()
    if not q or not FIXTURES.is_dir():
        return []
    found = []
    for path in sorted(FIXTURES.glob("*.json")):
        try:
            row = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        if q in json.dumps(row, ensure_ascii=False).lower():
            found.append({"fixture": path.name, "signal": row})
    return found[:10]

if __name__ == "__main__":
    mcp.run(transport="stdio")
