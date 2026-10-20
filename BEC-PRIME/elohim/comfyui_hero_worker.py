#!/usr/bin/env python3
"""Local-only Elohim SKU hero image worker for ComfyUI.

The worker sends prompts only to ComfyUI bound to loopback. It does not call
cloud models, upload artifacts, publish pages, or grant an image release gate.
Images and manifests remain in a local staging directory for offline review.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

SAFE_NODE_CLASSES = frozenset({
    "CheckpointLoaderSimple",
    "CLIPTextEncode",
    "EmptyLatentImage",
    "KSampler",
    "VAEDecode",
    "SaveImage",
    "LoraLoader",
    "CLIPSetLastLayer",
    "ConditioningCombine",
    "ConditioningZeroOut",
    "ImageScale",
    "ImageScaleBy",
    "ImageUpscaleWithModel",
    "UpscaleModelLoader",
    "LatentUpscale",
    "LatentUpscaleBy",
})
MAX_WORKFLOW_BYTES = 2 * 1024 * 1024
MAX_NODES = 128
MAX_PROMPT_CHARS = 6000
MAX_IMAGE_BYTES = 30 * 1024 * 1024
MAX_PIXELS = 20_000_000
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


class WorkerError(RuntimeError):
    """A fail-closed local worker error."""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_loopback_url(base_url: str) -> str:
    parsed = urlsplit(base_url)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise WorkerError("ComfyUI must be HTTP loopback only (127.0.0.1, localhost or ::1).")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise WorkerError("ComfyUI base URL must not contain credentials, a query or a fragment.")
    if parsed.path not in {"", "/"}:
        raise WorkerError("ComfyUI base URL must not include a path prefix.")
    if not parsed.port or not (1 <= parsed.port <= 65535):
        raise WorkerError("ComfyUI loopback port is invalid.")
    return f"http://{parsed.hostname}:{parsed.port}"


def load_workflow(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    if len(raw) > MAX_WORKFLOW_BYTES:
        raise WorkerError("ComfyUI workflow exceeds the 2 MiB safety limit.")
    try:
        workflow = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise WorkerError(f"Workflow must be valid UTF-8 JSON: {exc}") from exc
    if not isinstance(workflow, dict) or not workflow or len(workflow) > MAX_NODES:
        raise WorkerError("Workflow must be a non-empty ComfyUI API graph with at most 128 nodes.")
    for node_id, node in workflow.items():
        if not isinstance(node_id, str) or not isinstance(node, dict):
            raise WorkerError("Workflow node map is malformed.")
        class_type = node.get("class_type")
        if class_type not in SAFE_NODE_CLASSES:
            raise WorkerError(f"Node {node_id} uses non-allowlisted class_type: {class_type!r}")
        if not isinstance(node.get("inputs"), dict):
            raise WorkerError(f"Node {node_id} has no inputs object.")
        if class_type in {"CheckpointLoaderSimple", "LoraLoader", "UpscaleModelLoader"}:
            field = {"CheckpointLoaderSimple": "ckpt_name", "LoraLoader": "lora_name", "UpscaleModelLoader": "model_name"}[class_type]
            name = node["inputs"].get(field)
            if isinstance(name, str) and ("/" in name or "\\" in name or name in {".", ".."}):
                raise WorkerError(f"Model reference {field} must be a model filename, not a path.")
    return workflow, sha256_bytes(raw)


def prepare_workflow(
    workflow: dict[str, Any],
    positive_node: str,
    negative_node: str,
    positive_prompt: str,
    negative_prompt: str,
    job_tag: str,
) -> dict[str, Any]:
    if not positive_prompt.strip() or len(positive_prompt) > MAX_PROMPT_CHARS:
        raise WorkerError("Positive prompt must contain 1 to 6000 characters.")
    if len(negative_prompt) > MAX_PROMPT_CHARS:
        raise WorkerError("Negative prompt exceeds 6000 characters.")
    if positive_node == negative_node or positive_node not in workflow or negative_node not in workflow:
        raise WorkerError("Positive and negative prompt node IDs must exist and be different.")
    for node_id, prompt in ((positive_node, positive_prompt), (negative_node, negative_prompt)):
        node = workflow[node_id]
        if node.get("class_type") != "CLIPTextEncode":
            raise WorkerError(f"Prompt node {node_id} must be the standard CLIPTextEncode node.")
        node["inputs"]["text"] = prompt
    save_nodes = [node for node in workflow.values() if node.get("class_type") == "SaveImage"]
    if not save_nodes:
        raise WorkerError("Workflow must include an allowlisted SaveImage output node.")
    for node in save_nodes:
        node["inputs"]["filename_prefix"] = f"elo_h_{job_tag}"
    return workflow


def validate_png(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or len(data) > MAX_IMAGE_BYTES:
        raise WorkerError("PNG output size is outside permitted bounds.")
    if data[:8] != PNG_SIGNATURE or data[12:16] != b"IHDR":
        raise WorkerError("ComfyUI output is not a valid PNG header.")
    width = int.from_bytes(data[16:20], "big")
    height = int.from_bytes(data[20:24], "big")
    if not (512 <= width <= 4096 and 512 <= height <= 4096):
        raise WorkerError(f"Image dimensions are out of bounds: {width}x{height}.")
    if width * height > MAX_PIXELS:
        raise WorkerError("Image pixel count exceeds the 20 megapixel limit.")
    return width, height


class LoopbackComfyClient:
    def __init__(self, base_url: str, timeout: int = 10):
        self.base_url = validate_loopback_url(base_url)
        self.timeout = timeout
        # Explicitly disable HTTP proxy lookup so loopback traffic never follows
        # an environment-configured proxy to another machine.
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(self, path: str, payload: dict[str, Any] | None = None, timeout: int | None = None) -> Any:
        if not path.startswith("/") or path.startswith("//"):
            raise WorkerError("Internal ComfyUI path is invalid.")
        data = None if payload is None else json.dumps(payload).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(self.base_url + path, data=data, headers=headers,
                                     method="GET" if data is None else "POST")
        try:
            with self.opener.open(req, timeout=timeout or self.timeout) as response:
                raw = response.read(MAX_IMAGE_BYTES + 1)
                if len(raw) > MAX_IMAGE_BYTES:
                    raise WorkerError("ComfyUI response exceeded maximum permitted size.")
                content_type = response.headers.get("Content-Type", "")
                return raw if content_type.startswith("image/") else json.loads(raw.decode("utf-8"))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise WorkerError(f"Local ComfyUI request failed: {exc}") from exc

    def run(self, workflow: dict[str, Any], timeout_seconds: int) -> tuple[bytes, dict[str, Any]]:
        client_id = str(uuid.uuid4())
        queued = self.request("/prompt", {"prompt": workflow, "client_id": client_id})
        prompt_id = queued.get("prompt_id") if isinstance(queued, dict) else None
        if not isinstance(prompt_id, str) or not prompt_id:
            raise WorkerError("ComfyUI did not return a prompt_id; nothing is marked complete.")
        deadline = time.monotonic() + timeout_seconds
        history: dict[str, Any] | None = None
        while time.monotonic() < deadline:
            result = self.request("/history/" + urllib.parse.quote(prompt_id, safe=""))
            if isinstance(result, dict) and isinstance(result.get(prompt_id), dict):
                candidate = result[prompt_id]
                if candidate.get("outputs"):
                    history = candidate
                    break
                status = candidate.get("status", {})
                if isinstance(status, dict) and status.get("status_str") == "error":
                    raise WorkerError("ComfyUI reported a generation error.")
            time.sleep(1.0)
        if not history:
            raise WorkerError("ComfyUI job timed out or produced no completed output.")
        images = []
        for node_output in history.get("outputs", {}).values():
            for image in node_output.get("images", []) if isinstance(node_output, dict) else []:
                if image.get("type") == "output" and str(image.get("filename", "")).lower().endswith(".png"):
                    filename = str(image.get("filename", ""))
                    subfolder = str(image.get("subfolder", ""))
                    if Path(filename).name != filename or ".." in Path(subfolder).parts or Path(subfolder).is_absolute():
                        raise WorkerError("ComfyUI returned an unsafe output path.")
                    images.append((filename, subfolder))
        if not images:
            raise WorkerError("ComfyUI completed without an allowlisted PNG output.")
        filename, subfolder = images[0]
        query = urllib.parse.urlencode({"filename": filename, "subfolder": subfolder, "type": "output"})
        req = urllib.request.Request(self.base_url + "/view?" + query, headers={"Accept": "image/png"})
        try:
            with self.opener.open(req, timeout=self.timeout) as response:
                if not response.headers.get("Content-Type", "").startswith("image/"):
                    raise WorkerError("ComfyUI /view did not return an image content type.")
                image_bytes = response.read(MAX_IMAGE_BYTES + 1)
        except (urllib.error.URLError, TimeoutError) as exc:
            raise WorkerError(f"Could not retrieve local image output: {exc}") from exc
        validate_png(image_bytes)
        return image_bytes, {"prompt_id": prompt_id, "output_filename": filename, "output_subfolder": subfolder}


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workflow", required=True, type=Path, help="Trusted ComfyUI API-format workflow JSON")
    parser.add_argument("--positive-node", required=True, help="CLIPTextEncode node ID for the positive prompt")
    parser.add_argument("--negative-node", required=True, help="CLIPTextEncode node ID for the negative prompt")
    parser.add_argument("--positive-prompt", required=True)
    parser.add_argument("--negative-prompt", default="watermark, gibberish text, distorted product, fake logos, blurry, low quality")
    parser.add_argument("--silo-id", required=True, help="Silo slug used only as manifest metadata")
    parser.add_argument("--sku-id", required=True, help="Existing SKU ID, not a request to create a new SKU")
    parser.add_argument("--comfy-url", default=os.environ.get("ELOHIM_COMFYUI_URL", "http://127.0.0.1:8188"))
    parser.add_argument("--staging-dir", type=Path, default=Path(os.environ.get(
        "ELOHIM_HERO_STAGING",
        str(Path.home() / "BrownEyeCortexData" / "ELOHIM" / "HERO-STAGING")
    )))
    parser.add_argument("--timeout-seconds", type=int, default=600)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not re.fullmatch(r"[a-z0-9]+(?:[-_][a-z0-9]+)*", args.silo_id):
        raise WorkerError("silo-id must be a lowercase URL-safe slug.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{1,119}", args.sku_id):
        raise WorkerError("sku-id must be an existing SKU-safe identifier.")
    if not (1 <= args.timeout_seconds <= 1800):
        raise WorkerError("timeout-seconds must be between 1 and 1800.")
    base = validate_loopback_url(args.comfy_url)
    workflow, workflow_hash = load_workflow(args.workflow)
    job_tag = uuid.uuid4().hex[:12]
    prepared = prepare_workflow(workflow, args.positive_node, args.negative_node,
                                args.positive_prompt, args.negative_prompt, job_tag)
    client = LoopbackComfyClient(base)
    # Fail before queuing if the local ComfyUI process is not reachable.
    client.request("/system_stats")
    image_bytes, run_meta = client.run(prepared, args.timeout_seconds)
    width, height = validate_png(image_bytes)

    args.staging_dir.mkdir(parents=True, exist_ok=True)
    if args.staging_dir.is_symlink():
        raise WorkerError("Staging directory must not be a symbolic link.")
    image_path = args.staging_dir / f"{args.silo_id}-{args.sku_id}-hero-{job_tag}.png"
    image_path.write_bytes(image_bytes)
    image_hash = sha256_bytes(image_bytes)
    manifest = {
        "schema": "DREAMLEDGER/ELOHIM/LOCAL-COMFYUI-HERO/v1",
        "status": "GENERATED_UNREVIEWED",
        "silo_id": args.silo_id,
        "sku_id": args.sku_id,
        "created_at": utc_now(),
        "worker": "LOCAL_LOOPBACK_COMFYUI",
        "endpoint_class": "LOOPBACK_ONLY",
        "prompt_sha256": sha256_bytes(args.positive_prompt.encode("utf-8")),
        "negative_prompt_sha256": sha256_bytes(args.negative_prompt.encode("utf-8")),
        "workflow_sha256": workflow_hash,
        "artifact_relative_path": image_path.name,
        "artifact_sha256": image_hash,
        "artifact_format": "PNG",
        "dimensions": {"width": width, "height": height},
        "comfyui": run_meta,
        "approval": {
            "state": "HUMAN_REVIEW_REQUIRED",
            "gauntlet": "PENDING",
            "secret_scan": "NOT_RUN",
            "rights_review": "PENDING",
            "online_release": "BLOCKED"
        },
        "side_effects": {
            "cloud_inference": False,
            "upload": False,
            "publication": False,
            "checkout_mutation": False,
            "revenue_claim": False
        }
    }
    manifest_path = image_path.with_suffix(".manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": manifest["status"],
        "image_path": str(image_path),
        "manifest_path": str(manifest_path),
        "artifact_sha256": image_hash,
        "dimensions": manifest["dimensions"],
        "gauntlet": "PENDING",
        "online_release": "BLOCKED",
        "cloud_calls": 0,
        "published": False,
        "revenue_claim": False
    }, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except WorkerError as exc:
        print(json.dumps({"status": "BLOCKED", "code": "LOCAL_COMFYUI_WORKER_BLOCKED", "reason": str(exc)}), flush=True)
        raise SystemExit(2)
