"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;

function send(res, code, data, type="text/html") {
    res.writeHead(code, { "Content-Type": type });
    res.end(data);
}

function router(req, res) {
    const url = (req.url || "/").split("?")[0];
    // static files
    const safe = path.normalize(url).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(__dirname, "homarid", "frontend", safe);
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const mime = {
                ".html": "text/html",
                ".js": "text/javascript",
                ".css": "text/css",
                ".json": "application/json",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".svg": "image/svg+xml"
            }[ext] || "text/plain";
            return send(res, 200, fs.readFileSync(filePath, "utf-8"), mime);
        }
    } catch {}
    // API routes
    if (url === "/health") return send(res, 200, JSON.stringify({ok:true,service:"DreamLedger"}));
    // fallback to index.html for root
    return send(res, 200, fs.readFileSync(path.join(__dirname, "homarid", "frontend", "index.html"), "utf-8"), "text/html");
}

http.createServer(router).listen(PORT, "0.0.0.0", () => console.log("Serving on", PORT));
