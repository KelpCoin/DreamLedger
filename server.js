const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");

const START_TIME = Date.now();

function log(msg){
  console.log("[DREAMLEDGER]", msg);
}

app.use(express.json());
app.use(express.static("public"));

// =====================
// IDENTITY ROUTE (CRITICAL)
// =====================
app.get("/identity", (req, res) => {
  res.json({
    service: "dreamledger",
    runtime: "express",
    pid: process.pid,
    cwd: process.cwd(),
    startTime: START_TIME,
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// =====================
// DEBUG ROUTE (CRITICAL)
// =====================
app.get("/debug", (req, res) => {
  res.json({
    ok: true,
    routes: ["/health", "/identity", "/debug", "/mtg", "/mtg-test"],
    pid: process.pid,
    ts: Date.now()
  });
});

app.get("/mtg-test", (req, res) => {
  res.send("MTG TEST OK");
});

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "dreamledger", ts: Date.now() });
});

// =====================
// MTG SAFE FALLBACK (NO SUPABASE DEPENDENCY)
// =====================
app.get("/mtg", (req, res) => {
  res.send(`
    <h1>DREAMLEDGER MTG LIVE</h1>
    <p>Server PID: ${process.pid}</p>
    <p>Runtime verified: EXPRESS</p>
    <p>If you see this, routing is fixed.</p>
  `);
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log("Server running on port " + PORT);
  log("PID " + process.pid);
});