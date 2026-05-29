const express = require('express');
const path = require('path');
const app = express();
app.use(express.static(__dirname));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log('DreamLedger running on ' + PORT));