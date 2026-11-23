import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Offline UPI QR (no external service). Falls back to qrserver only if local generation fails. */
export function UpiQr({ value, className = '' }: { value: string; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(value, { width: 360, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#011f43', light: '#ffffff' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(value)}`));
    return () => {
      alive = false;
    };
  }, [value]);
  return src ? <img alt="UPI QR" src={src} className={className} /> : <div className={`${className} animate-pulse bg-[#eef1f7] rounded`} />;
}
