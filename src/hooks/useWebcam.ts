import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useWebcam(videoRef: RefObject<HTMLVideoElement | null>) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function setupCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Browser API navigator.mediaDevices.getUserMedia not available');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true, // Request audio here to prevent double getUserMedia lock on Windows
          video: {
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setIsReady(true);
            setStream(stream);
            videoRef.current?.play().catch(console.error);
          };
        }
      } catch (err) {
        setError('Error accessing webcam: ' + (err as Error).message);
      }
    }

    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [videoRef]);

  return { isReady, error, stream };
}
