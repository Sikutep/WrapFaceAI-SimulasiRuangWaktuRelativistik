import { useEffect, useState, useRef } from 'react';
import type { RefObject } from 'react';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';

export function useFaceTracking(videoRef: RefObject<HTMLVideoElement | null>, isReady: boolean) {
  const [dopplerFactor, setDopplerFactor] = useState(0.0);
  const [isFaceModelReady, setIsFaceModelReady] = useState(false);
  
  const detectorRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
  const lastFaceAreaRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadModel() {
      // Use CPU backend so TF.js doesn't fight Three.js for the WebGL context
      await tf.setBackend('cpu');
      await tf.ready();
      const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
      const detectorConfig: faceLandmarksDetection.MediaPipeFaceMeshTfjsModelConfig = {
        runtime: 'tfjs',
        refineLandmarks: false
      };
      detectorRef.current = await faceLandmarksDetection.createDetector(model, detectorConfig);
      setIsFaceModelReady(true);
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (!isReady || !isFaceModelReady || !videoRef.current) return;

    let isDetecting = false;
    let timeoutId: number;

    async function detectFace() {
      if (isDetecting || !detectorRef.current || !videoRef.current) return;
      isDetecting = true;
      
      try {
        const video = videoRef.current;
        if (video.readyState < 2) {
          isDetecting = false;
          timeoutId = window.setTimeout(detectFace, 200);
          return;
        }

        const faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: false });
        
        if (faces.length > 0) {
          const face = faces[0];
          const width = face.box.width;
          const height = face.box.height;
          const currentArea = width * height;
          
          if (lastFaceAreaRef.current !== null) {
            const delta = currentArea - lastFaceAreaRef.current;
            const normalizedDelta = Math.max(-1.0, Math.min(1.0, delta / 10000.0));
            setDopplerFactor(prev => prev * 0.8 + normalizedDelta * 0.2);
          }
          lastFaceAreaRef.current = currentArea;
        } else {
          setDopplerFactor(prev => prev * 0.9);
          lastFaceAreaRef.current = null;
        }
      } catch (err) {
        console.error("Face detection error:", err);
      }

      isDetecting = false;
      // Run at ~5 FPS on CPU — plenty for doppler detection, won't block GPU
      timeoutId = window.setTimeout(detectFace, 200);
    }

    detectFace();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isReady, isFaceModelReady, videoRef]);

  return { dopplerFactor, isFaceModelReady };
}
