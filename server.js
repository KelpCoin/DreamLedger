"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;

function send(res, code, data, type="application/json") {
    res.writeHead(code, {
        "Content-Type": type
    });

    if (typeof data === "string") {
        res.end(data);
    } else {
        res.end(JSON.stringify(data, null, 2));
    }
}

function router(req, res) {

    const url = (req.url || "/").split("?")[0];

    if (url === "/") {
        return send(
            res,
            200,
            "<html><body style='background:#0b0f14;color:white;font-family:Arial;padding:40px'>" +
            "<h1>DreamLedger LIVE</h1>" +
            "<p>Stable recovery server online.</p>" +
            "</body></html>",
            "text/html"
        );
    }

    if (url === "/health") {
        return send(res, 200, {
            ok: true,
            service: "DreamLedger",
            status: "alive",
            time: new Date().toISOString()
        });
    }

    if (url === "/dashboard") {
        return send(
            res,
            200,
            "<html><body style='background:#111;color:#00ff99;font-family:Arial;padding:40px'>" +
            "<h2>DreamLedger Dashboard</h2>" +
            "<p>Revenue systems operational.</p>" +
            "</body></html>",
            "text/html"
        );
    }

    if (url === "/mtg") {
        return send(res, 200, {
            ok: true,
            silo: "mtg",
            marketplace: "online"
        });
    }

    if (url === "/revenue") {
        return send(res, 200, {
            ok: true,
            revenue: 0,
            currency: "USD"
        });
    }

    return send(res, 404, {
        error: "not_found",
        route: url
    });
}

const server = http.createServer(router);

server.listen(PORT, "0.0.0.0", () => {
    console.log("DreamLedger LIVE on port", PORT);
});
