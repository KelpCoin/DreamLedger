"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = process.env.PORT || 3000;
const STATIC = path.join(__dirname, "frontend");

function serveStatic(url, res) {
    const safe = path.normalize(url).replace(/^(\.\.[\/\\])+/, "");
    const filePath = path.join(STATIC, safe === "/" ? "index.html" : safe);
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath);
            const mime = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml" }[ext] || "text/plain";
            res.writeHead(200, { "Content-Type": mime });
            res.end(fs.readFileSync(filePath, "utf-8"));
            return true;
        }
    } catch {}
    return false;
}

const server = http.createServer((req, res) => {
    const url = (req.url || "/").split("?")[0];
    if (url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: true, service: "DreamLedger", status: "alive", time: new Date().toISOString() }));
    }
    if (url === "/signup" && req.method === "POST") {
        let body = "";
        req.on("data", c => body += c);
        req.on("end", () => {
            console.log("Signup:", body);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<html><body style='background:#0a0a0a;color:#d4af37;font-family:system-ui;padding:3rem;text-align:center'><h1>Welcome to DreamLedger</h1><p>Signup received. Full MTG marketplace access coming soon.</p><p><a href='/' style='color:#d97706'>Home</a> | <a href='https://www.patreon.com/happyhomarid' style='color:#d97706'>Patreon</a></p></body></html>");
        });
        return;
    }
    if (serveStatic(url, res)) return;
    res.writeHead(404);
    res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => console.log("DreamLedger running on port", PORT));
