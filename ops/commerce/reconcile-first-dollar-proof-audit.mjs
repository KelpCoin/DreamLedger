#!/usr/bin/env node
'use strict';
// Backward-compatible path for base-branch workflows that have not yet been updated.
// The standalone audit offer is retired; the only implementation is Truth Oracle reconciliation.
import './reconcile-truth-oracle-access.mjs';
