'use strict';
// Compatibility entry point for deployments whose configured root directory is public.
// The canonical verifier lives at the repository root and checks repository/public paths.
require('../../scripts/verify-vercel-public-release.cjs');
