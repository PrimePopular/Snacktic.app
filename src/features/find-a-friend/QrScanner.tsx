import { useEffect, useRef, useState } from 'react';
import { Button } from '../../shared/components';

/** Finds an invite code in what a QR code says: the invite link (…/#/r/<code>) or just the code. Null if it is something else. */
export function codeFromQr(text: string): string | null {
  const link = /#\/r\/([a-z0-9]{8,32})/i.exec(text);
  if (link) return link[1].toLowerCase();
  const plain = text.trim().toLowerCase();
  return /^[a-z0-9]{12,32}$/.test(plain) ? plain : null;
}

interface QrScannerProps {
  /** Called once with the friend's invite code. */
  onCode: (code: string) => void;
  onClose: () => void;
}

/**
 * Opens the back camera and looks for a Snacktic invite QR code. Nothing is recorded or uploaded: each video frame is
 * checked on the phone and thrown away. The small decoding library loads only when this opens.
 */
export function QrScanner({ onCode, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error('No camera available');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const { default: jsQR } = await import('jsqr');

        const tick = () => {
          if (stopped) return;
          if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
            const code = result ? codeFromQr(result.data) : null;
            if (code) {
              stopped = true;
              onCodeRef.current(code);
              return;
            }
          }
          frame = requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        console.error('[find-a-friend] camera', err);
        if (!stopped) setError('We could not open the camera. Allow camera access in your browser and try again.');
      }
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="scanner">
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <div className="scanner__view">
          <video ref={videoRef} className="scanner__video" playsInline muted aria-label="Camera view" />
          <div className="scanner__frame" aria-hidden="true" />
        </div>
      )}
      <p className="text-secondary text-small">Point the camera at your friend's Snacktic QR code.</p>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
    </div>
  );
}
