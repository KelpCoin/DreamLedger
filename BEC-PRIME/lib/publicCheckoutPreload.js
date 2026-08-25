'use strict';

const auth = require('../routes/auth');
const mvpRoutes = require('../routes/mvpRoutes');
const PUBLIC_CHECKOUT = '/api/offer-checkout/create';

function wrap(mod, name) {
  const original = mod[name];
  if (typeof original !== 'function' || original.__dreamledgerPublicCheckoutWrapped) return;
  const wrapped = async function(req, res, url) {
    if (String(url || '').split('?')[0] === PUBLIC_CHECKOUT) return false;
    return original.apply(this, arguments);
  };
  wrapped.__dreamledgerPublicCheckoutWrapped = true;
  mod[name] = wrapped;
}

wrap(auth, 'handle');
wrap(mvpRoutes, 'handle');
require('./billboardRuntimePreload');
require('./billboardSupabaseMirror');
require('./billboardWebhookPreload');
