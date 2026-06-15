import { useEffect, useRef } from 'react';

interface StarfieldCanvasProps {
  speed: number;
}

interface Star {
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
}

export function StarfieldCanvas({ speed }: StarfieldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Size to parent
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Init stars
    const NUM_STARS = 400;
    const stars: Star[] = [];
    for (let i = 0; i < NUM_STARS; i++) {
      stars.push({
        x: (Math.random() - 0.5) * canvas.width * 3,
        y: (Math.random() - 0.5) * canvas.height * 3,
        z: Math.random() * 1500 + 100,
        prevX: 0,
        prevY: 0,
      });
    }
    starsRef.current = stars;

    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      const w = canvas!.width;
      const h = canvas!.height;
      const cx = w / 2;
      const cy = h / 2;
      const spd = speedRef.current;

      // Fade trail effect (longer trails at high speed)
      const fadeAlpha = spd > 0.3 ? 0.15 : 0.4;
      ctx.fillStyle = `rgba(5, 5, 5, ${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // Star speed scales exponentially
      const starSpeed = 1 + spd * spd * 60;

      for (const star of stars) {
        // Store previous projected position
        star.prevX = (star.x / star.z) * 300 + cx;
        star.prevY = (star.y / star.z) * 300 + cy;

        // Move star toward viewer
        star.z -= starSpeed;

        // Reset if behind camera
        if (star.z <= 0) {
          star.x = (Math.random() - 0.5) * w * 3;
          star.y = (Math.random() - 0.5) * h * 3;
          star.z = 1500;
          star.prevX = (star.x / star.z) * 300 + cx;
          star.prevY = (star.y / star.z) * 300 + cy;
        }

        // Project to 2D
        const px = (star.x / star.z) * 300 + cx;
        const py = (star.y / star.z) * 300 + cy;

        // Size based on depth
        const size = Math.max(0.5, (1 - star.z / 1500) * 3);

        // Brightness
        const brightness = Math.min(1, (1 - star.z / 1500) * 1.5);

        if (spd > 0.2) {
          // Draw STREAKS (hyperspace effect)
          const streakLength = Math.min(
            Math.sqrt((px - star.prevX) ** 2 + (py - star.prevY) ** 2),
            200
          );

          if (streakLength > 1) {
            ctx.beginPath();
            ctx.moveTo(star.prevX, star.prevY);
            ctx.lineTo(px, py);
            
            // Color shifts from white → blue → cyan at high speed
            const hue = 200 + spd * 40;
            const sat = Math.min(100, spd * 150);
            ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${70 + brightness * 30}%, ${brightness * 0.8})`;
            ctx.lineWidth = size * (1 + spd);
            ctx.stroke();
          }
        } else {
          // Draw dots (stationary stars)
          ctx.beginPath();
          ctx.arc(px, py, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 220, 255, ${brightness * 0.7})`;
          ctx.fill();
        }
      }
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
