#!/usr/bin/env python3
"""Synthetic tests only: never use a human sketch or put art in the public repo."""
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SCRIPT=ROOT/"ops"/"dreammeez"/"sketch_to_layers.py"

class SketchProofTest(unittest.TestCase):
    def test_rights_gated_private_non_generative_ink(self):
        from PIL import Image, ImageDraw
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            source=root/"synthetic.png"
            img=Image.new("RGB",(1200,1200),"white")
            pen=ImageDraw.Draw(img)
            pen.ellipse([380,160,820,1050],outline="black",width=12)
            img.save(source)
            original=hashlib.sha256(source.read_bytes()).hexdigest()
            out=root/"private"
            cmd=[sys.executable,str(SCRIPT),"--input",str(source),"--out",str(out),
                 "--artist-credit","CI synthetic fixture","--declared-dpi","600"]
            missing=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(missing.returncode,0,"Rights gate must refuse")
            self.assertFalse(out.exists(),"No unauthorized output")
            run=subprocess.run(cmd+["--rights-confirmed"],capture_output=True,text=True)
            self.assertEqual(run.returncode,0,run.stderr)
            receipt=json.loads(run.stdout)
            self.assertEqual(receipt["status"],"DRAFT_PRIVATE_ONLY")
            manifest=json.loads(Path(receipt["proof_file"]).read_text())
            self.assertEqual(manifest["source_sha256"],original)
            self.assertFalse(manifest["artist_approval"])
            self.assertFalse(manifest["human_origin_independently_verified"])
            self.assertFalse(manifest["ai_generation_used"])
            self.assertFalse(manifest["published"])
            self.assertFalse(manifest["checkout_available"])
            with Image.open(receipt["ink_file"]) as layer:
                self.assertEqual(layer.mode,"RGBA")
                self.assertEqual(layer.getpixel((0,0))[3],0)
                self.assertGreater(layer.getpixel((380,600))[3],0)
            self.assertEqual(hashlib.sha256(source.read_bytes()).hexdigest(),original)
            second=subprocess.run(cmd+["--rights-confirmed"],capture_output=True,text=True)
            self.assertNotEqual(second.returncode,0,"Must not silently overwrite proof")

    def test_repository_output_is_forbidden(self):
        with tempfile.TemporaryDirectory() as folder:
            input_path=Path(folder)/"placeholder.png"
            input_path.write_bytes(b"not a real image")
            cmd=[sys.executable,str(SCRIPT),"--input",str(input_path),
                 "--out",str(ROOT/"public"/"unsafe-sketch"),
                 "--artist-credit","CI fixture","--rights-confirmed"]
            result=subprocess.run(cmd,capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn("OUTSIDE the public source repository",result.stderr)

if __name__=="__main__":
    unittest.main()
