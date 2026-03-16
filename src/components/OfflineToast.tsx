import { useState, useEffect } from 'react';
import * as m from '../paraglide/messages.js';
import './offline-toast.css';

export default function OfflineToast() {
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'PRECACHE_DONE') {
        setVisible(true);
        setHiding(false);
        setTimeout(() => {
          setHiding(true);
          setTimeout(() => setVisible(false), 300);
        }, 3000);
      }
    }

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  if (!visible) return null;

  return (
    <div className={`offline-toast${hiding ? ' offline-toast--hiding' : ''}`}>
      {m.offline_ready()}
    </div>
  );
}
