(function () {
  'use strict';

  var CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_live_a1Y5eV1gJkOrAfMmF00mHsXlwOflznGRzXSwvqPLGUTxDWJ8OgDrlN0NBM#fidnandhYHdWcXxpYCc%2FJ2FgY2RwaXEnKSdicGRmZGhqaWBTZHdsZGtxJz8nZmprcXdqaScpJ2R1bE5gfCc%2FJ3VuWmlsc2BaMDRWfVFfV0B%2FM2hjNUpvU1V2Yl1zQHFkXFVTR11jUUs2UG9JVU59cW5QQGtDb3NATHZuMmdvanBpUHJfb2xCTjxASHI2YDRcUFd0MGhRb1RyaHQ9NVxocGw1NUF%2FcUhNRDdEJyknY3dqaFZgd3Ngdyc%2FcXdwYCknZ2RmbmJ3anBrYUZqaWp3Jz8nJmNjY2NjYycpJ2lkfGpwcVF8dWAnPyd2bGtiaWBabHFgaCcpJ2BrZGdpYFVpZGZgbWppYWB3dic%2FcXdwYHgl';

  document.querySelectorAll('[data-checkout]').forEach(function (link) {
    link.href = CHECKOUT_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
})();
