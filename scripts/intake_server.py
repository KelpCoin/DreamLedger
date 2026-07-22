import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from env_loader import load_env_file
load_env_file(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))
#!/usr/bin/env python3
"""DreamLedger Intake Server  Run locally to accept phone submissions."""
import os, json, uuid
from datetime import datetime, timezone
from flask import Flask, request, render_template, send_from_directory, redirect

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUEUE_DIR = os.path.join(ROOT, "mobile-intake", "queue", "pending")
UPLOADS_DIR = os.path.join(ROOT, "mobile-intake", "uploads")
os.makedirs(QUEUE_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)

app = Flask(__name__, template_folder=os.path.join(ROOT, "mobile-intake", "app"))

@app.route('/')
def index():
    return redirect('/intake')

@app.route('/intake')
def intake_page():
    return render_template('intake.html')

@app.route('/submit', methods=['POST'])
def submit():
    intake_id = f"INTAKE-{uuid.uuid4().hex[:8].upper()}"
    data = {
        "id": intake_id,
        "type": request.form.get('type', 'deck'),
        "name": request.form.get('name', ''),
        "price_estimate": request.form.get('price', '0'),
        "notes": request.form.get('notes', ''),
        "photos": [],
        "created": datetime.now(timezone.utc).isoformat()
    }
    for file in request.files.getlist('photos'):
        if file.filename:
            photo_id = uuid.uuid4().hex[:8]
            ext = os.path.splitext(file.filename)[1]
            photo_name = f"{intake_id}_{photo_id}{ext}"
            file.save(os.path.join(UPLOADS_DIR, photo_name))
            data["photos"].append(photo_name)
    queue_file = os.path.join(QUEUE_DIR, f"{intake_id}.json")
    with open(queue_file, "w") as f:
        json.dump(data, f, indent=2)
    return json.dumps({"status": "received", "id": intake_id}), 200

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOADS_DIR, filename)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
