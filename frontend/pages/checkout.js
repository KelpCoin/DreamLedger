import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Checkout() {
  const router = useRouter();
  const { offer } = router.query;
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (offer) {
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: offer })
      })
      .then(res => res.json())
      .then(data => {
        if (data.url) window.location.href = data.url;
        else alert('Checkout error');
        setLoading(false);
      })
      .catch(() => setLoading(false));
    }
  }, [offer]);
  return <div style={{ background: '#0a0e17', color: '#00d4ff', padding: '2rem' }}>{loading ? 'Processing...' : 'Redirecting...'}</div>;
}
