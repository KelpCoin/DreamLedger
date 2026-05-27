"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

// ============================
// SAFE DIRECTORIES
// ============================
const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, "logs");

try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (_) {}

// ============================
// CRASH SAFETY LAYER
// ============================
function safeLog(file, data) {
    try {
        fs.appendFileSync(file, data + "\n");
    } catch (_) {}
}

const CRASH_LOG = path.join(LOG_DIR, "crash.log");

// ============================
// GLOBAL ERROR TRAPS
// ============================
process.on("uncaughtException", (err) => {
    safeLog(CRASH_LOG, "[uncaughtException] " + (err?.stack || err));
});

process.on("unhandledRejection", (err) => {
    safeLog(CRASH_LOG, "[unhandledRejection] " + (err?.stack || err));
});

// ============================
// RESPONSE SAFE WRAPPER
// ============================
function send(res, status, data, type = "application/json") {
    try {
        res.writeHead(status, { "Content-Type": type });
        res.end(typeof data === "string" ? data : JSON.stringify(data));
    } catch (e) {
        safeLog(CRASH_LOG, "[send] " + e.message);
    }
}

// ============================
// ROUTER (NO DEPENDENCIES)
// ============================
function router(req, res) {
    const url = (req.url || "/").split("?")[0];

    try {
        if (url === "/" || url === "/health") {
            return send(res, 200, {
                status: "alive",
                service: "DreamLedger",
                time: new Date().toISOString(),
                pid: process.pid
            });
        }

        if (url === "/mtg") {
            return send(res, 200, { ok: true, silo: "mtg" });
        }

        if (url === "/revenue") {
            return send(res, 200, {
                total: 0,
                status: "stub",
                message: "backend not connected"
            });
        }

        if (url === "/dashboard") {
            return send(
                res,
                200,
                `<html><body style="background:#0b0f14;color:#d6e2ff;font-family:Arial">
                <h2>DreamLedger LIVE</h2>
                <p>Server stable.</p>
                <p>/health OK</p>
                </body></html>`,
                "text/html"
            );
        }

        return send(res, 404, { error: "not_found", path: url });

    } catch (err) {
        safeLog(CRASH_LOG, "[router] " + (err?.stack || err));
        return send(res, 500, { error: "router_failure_safe_mode" });
    }
}

// ============================
// SERVER BOOT (CRITICAL SECTION)
// ============================
let server;

try {
    server = http.createServer((req, res) => {
        router(req, res);
    });

    server.on("error", (err) => {
        safeLog(CRASH_LOG, "[server_error] " + err.message);
    });

    server.listen(PORT, () => {
        console.log("DreamLedger ONLINE");
        console.log("PORT:", PORT);
        console.log("PID:", process.pid);
    });

} catch (err) {
    safeLog(CRASH_LOG, "[BOOT_FAILURE] " + (err?.stack || err));

    // CRITICAL: prevent Render instant exit loop
    setInterval(() => {
        console.log("BOOT SAFE HOLDING STATE");
    }, 10000);
}

// ============================
// HEARTBEAT (PROVES ALIVE)
// ============================
setInterval(() => {
    try {
        fs.writeFileSync(
            path.join(LOG_DIR, "heartbeat.json"),
            JSON.stringify({
                alive: true,
                time: new Date().toISOString(),
                pid: process.pid
            }, null, 2)
        );
    } catch (_) {}
}, 15000);