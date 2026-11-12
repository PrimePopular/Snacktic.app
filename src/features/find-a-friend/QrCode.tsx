import { useEffect, useState } from 'react';

/** Makes a QR code picture (a data address usable as an image). The small library loads only when this is called. */
export async function makeQrDataUrl(value: string, width = 512): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(value, { margin: 2, width, errorCorrectionLevel: 'M', color: { dark: '#35231f', light: '#ffffff' } });
}

/** Draws a QR code. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void makeQrDataUrl(value)
      .then((url) => {
        if (active) setSrc(url);
      })
      .catch((error: unknown) => console.error('[find-a-friend] qr', error));
    return () => {
      active = false;
    };
  }, [value]);

  return src ? <img className="qr-code" src={src} alt={label} width={256} height={256} /> : <div className="qr-code qr-code--loading" aria-busy="true" />;
}
