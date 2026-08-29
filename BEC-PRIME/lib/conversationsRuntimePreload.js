'use strict';

// Runtime compatibility shim for the conversation route handler.
// start.js references `conversations` as a module-level identifier.
// Expose the existing route module on the Node global before start.js loads.
global.conversations = require('../routes/conversations');
