#!/usr/bin/env python3
"""DreamMeez source-preserving paper sketch cleanup. Human art only; NO generative synthesis.

Usage:
 python -m pip install Pillow
 python ops/dreammeez/sketch_to_layers.py --input PRIVATE_SCAN.png \
     --out PRIVATE_ARTIFACT_DIR --artist-credit "Artist pen name" \
     --rights-confirmed --declared-dpi 600

This command never publishes, uploads, enables a checkout or grants an entitlement.
Keep inputs and generated source manifests OUTSIDE the public repo.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

def hash_file(filepath: Path) -> str:
    h = hashlib.sha256()
    with filepath.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Existing original scan; never modified")
    parser.add_argument("--out", required=True, type=Path, help="Private output directory, not public web root")
    parser.add_argument("--artist-credit", required=True, help="Artist name or authorised pseudonym")
    parser.add_argument("--rights-confirmed", action="store_true", help="Operator has permission to process sketch")
    parser.add_argument("--declared-dpi", type=int, default=600, help="Scanning setting, not a claim of new image detail")
    parser.add_argument("--paper-threshold", type=int, default=225, help="Light pixels above this fade to transparent")
    args = parser.parse_args()

    if not args.rights_confirmed:
        parser.error("--rights-confirmed is required; owner must authorize processing of the source sketch")
    if not args.artist_credit.strip() or len(args.artist_credit) > 100:
        parser.error("Artist credit is required (max 100 characters)")
    if not (200 <= args.declared_dpi <= 2400):
        parser.error("DPI must be between 200 and 2400")
    if not (150 <= args.paper_threshold <= 250):
        parser.error("Paper threshold must be between 150 and 250")
    try:
        from PIL import Image, ImageOps
    except ImportError:
        parser.error("Pillow not installed: python -m pip install Pillow")
    src = args.input.resolve(strict=True)
    out = args.out.resolve()
    if src.is_dir() or out == src or src in out.parents:
        parser.error("Input must be a file and output must not be inside the input path")
    if out.is_relative_to(Path.cwd().resolve() / "public"):
        parser.error("Private sketch output cannot be under the public website")
    # Private model input must be an actual image; never silently convert arbitrary uploads.
    with Image.open(src) as source:
        if source.format not in ("PNG", "TIFF", "JPEG"):
            parser.error("Accepted scan formats: PNG, TIFF, JPEG")
        img = ImageOps.exif_transpose(source).convert("L")
        width, height = img.size
        if width < 300 or height < 300 or width > 20000 or height > 20000:
            parser.error("Scan dimensions must be 300..20,000 pixels on each side")
        # Convert darkness to translucent black ink. No line redraw, no shape changes.
        # Preserve gradual antialiasing; lighten bright paper pixels towards transparent.
        alpha = img.point(lambda gray: max(0, min(255, int((args.paper_threshold - gray) * 255 / max(1, args.paper_threshold - 65)))))
        rgba = Image.new("RGBA", img.size, (7, 9, 12, 0))
        rgba.putalpha(alpha)
    out.mkdir(parents=True, exist_ok=True)
    digest = hash_file(src)
    target = out / ("ink-layer-" + digest[:12] + ".png")
    # Refuse to overwrite an existing approved or revised output.
    if target.exists():
        parser.error("Output already exists; choose an empty private output folder or audit existing art")
    rgba.save(target, format="PNG", optimize=True)
    result = {
        "schema": "dreammeez/hand-drawn-source-proof/v1",
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source_sha256": digest,
        "source_file_name": src.name,
        "scan_width_px": width,
        "scan_height_px": height,
        "declared_dpi": args.declared_dpi,
        "paper_threshold": args.paper_threshold,
        "source_dimensions_are_not_4k": max(width, height) < 3840,
        "cleaned_ink_sha256": hash_file(target),
        "cleaned_ink_filename": target.name,
        "artist_credit": args.artist_credit.strip(),
        "rights_confirmed_by_operator": True,
        "artist_approval": False,
        "human_origin_independently_verified": False,
        "ai_generation_used": False,
        "ai_enhancement_used": False,
        "original_source_preserved": True,
        "body_fit_verified": False,
        "published": False,
        "checkout_available": False,
        "claim": "Operator-attested original source, deterministically cleaned. Final art pending human review."
    }
    proof = out / ("source-manifest-" + digest[:12] + ".json")
    if proof.exists():
        parser.error("Provenance manifest already exists; refuse overwrite")
    proof.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "DRAFT_PRIVATE_ONLY", "ink_file": str(target), "proof_file": str(proof),
                      "source_sha256": digest, "cleaned_sha256": result["cleaned_ink_sha256"]}))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
