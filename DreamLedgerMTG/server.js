const express = require('express');
const path = require('path');
const app = express();

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(3000, () => console.log('Local dev server on :3000'));
