import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface SpacetimeCanvasProps {
  videoElement: HTMLVideoElement | null;
  speed: number;
  dopplerFactor: number;
}

// ============================================================
//  ULTIMATE RELATIVISTIC SHADER — Wormhole + Doppler Neon
// ============================================================

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  uniform sampler2D tDiffuse;
  uniform float uSpeed;
  uniform float uGamma;
  uniform float uDoppler;
  uniform float uTime;
  uniform vec2  uResolution;

  varying vec2 vUv;

  // ---- helpers (defined OUTSIDE main) ----
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // GPU-native bounds check: returns 1.0 if in [0,1], 0.0 if out
  float inBounds(vec2 c) {
    vec2 s = step(0.0, c) * step(c, vec2(1.0));
    return s.x * s.y;
  }

  void main() {
    vec2 uv = vUv;
    float spd = uSpeed;
    float t = uTime;

    vec2 center = uv - 0.5;

    // ===================================
    // 1) LORENTZ CONTRACTION + WORMHOLE WARP
    // ===================================
    float squeeze = 1.0 / uGamma;
    center.x /= max(squeeze, 0.01);

    // Wormhole barrel distortion
    float warpPower = spd * spd * 0.6;
    float r = length(center);
    float warpFactor = 1.0 + warpPower * r * r;
    warpFactor += sin(t * 3.0) * spd * spd * 0.02;
    center *= warpFactor;

    // Vertical stretch
    center.y *= 1.0 + spd * spd * 0.15;

    vec2 warpedUv = center + 0.5;

    // ===================================
    // 2) CHROMATIC ABERRATION (Radial: Blue inward, Red outward)
    // ===================================
    float aberStrength = spd * spd * 0.035 + abs(uDoppler) * 0.02;
    vec2 radialDir = normalize(warpedUv - 0.5 + vec2(0.0001));
    float radialDist = length(warpedUv - 0.5);

    vec2 redUv   = warpedUv + radialDir * aberStrength * radialDist;
    vec2 greenUv = warpedUv;
    vec2 blueUv  = warpedUv - radialDir * aberStrength * radialDist;

    // Sample ALL channels unconditionally (GPU-safe),
    // then mask by bounds using mix
    vec4 redSample   = texture2D(tDiffuse, clamp(redUv,   0.0, 1.0));
    vec4 greenSample = texture2D(tDiffuse, clamp(greenUv, 0.0, 1.0));
    vec4 blueSample  = texture2D(tDiffuse, clamp(blueUv,  0.0, 1.0));

    float redMask   = inBounds(redUv);
    float greenMask = inBounds(greenUv);
    float blueMask  = inBounds(blueUv);

    float finalR = redSample.r   * redMask;
    float finalG = greenSample.g * greenMask;
    float finalB = blueSample.b  * blueMask;

    vec3 color = vec3(finalR, finalG, finalB);

    float isVisible = max(redMask, max(greenMask, blueMask));

    // ===================================
    // 3) DOPPLER COLOR TINTING
    // ===================================
    float totalDoppler = spd * 0.6 + uDoppler * 0.8;
    vec3 blueTint = vec3(0.15, 0.3, 0.9);
    vec3 redTint  = vec3(0.9, 0.2, 0.05);
    float tintStrength = abs(totalDoppler) * 0.4;
    vec3 tint = mix(redTint, blueTint, clamp(totalDoppler + 0.5, 0.0, 1.0));
    color = mix(color, color + tint * tintStrength, min(spd * 1.5, 1.0) * isVisible);

    // Boost saturation
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 1.0 + spd * 0.8);

    // ===================================
    // 4) NEON BLOOM
    // ===================================
    float bloom = smoothstep(0.4, 0.9, lum) * spd * 0.6 * isVisible;
    vec3 bloomColor = mix(vec3(0.0, 0.6, 1.0), vec3(0.6, 0.0, 1.0), spd);
    color += bloomColor * bloom;

    // ===================================
    // 5) HYPERSPACE STREAKS
    // ===================================
    float streakPower = smoothstep(0.25, 0.99, spd);
    streakPower *= streakPower;
    if (streakPower > 0.0) {
      vec2 sc = vUv - 0.5;
      float angle = atan(sc.y, sc.x);
      float dist = length(sc);
      float streaks = 0.0;
      for (float i = 0.0; i < 4.0; i += 1.0) {
        float sp = 1.5 + i * 0.8;
        float den = 25.0 + i * 15.0;
        float line = smoothstep(0.97, 1.0, sin(angle * den + t * sp));
        float radFade = smoothstep(0.02, 0.35 + spd * 0.2, dist);
        streaks += line * radFade;
      }
      vec3 streakColor = mix(vec3(0.4, 0.7, 1.0), vec3(1.0), streakPower * 0.7);
      color += streakColor * streaks * streakPower * 0.5;
    }

    // ===================================
    // 6) VIGNETTE
    // ===================================
    float vigStrength = 0.3 + spd * 1.2;
    vec2 vigUv = vUv - 0.5;
    float vig = 1.0 - dot(vigUv, vigUv) * vigStrength * 2.5;
    vig = clamp(vig, 0.0, 1.0);
    vec3 vigColor = mix(vec3(0.0), vec3(0.0, 0.02, 0.08), spd);
    color = mix(vigColor, color, vig);

    // ===================================
    // 7) SCANLINES
    // ===================================
    float scanFreq = uResolution.y * 1.2;
    float scan = sin(vUv.y * scanFreq + t * 2.0) * 0.5 + 0.5;
    scan = mix(1.0, scan, 0.06 + spd * 0.08);
    color *= scan;

    // ===================================
    // 8) VOID BOUNDARY GLOW
    // ===================================
    float voidGlow = (1.0 - isVisible);
    if (voidGlow > 0.0) {
      vec2 edgeDist = abs(warpedUv - 0.5);
      float edgeFactor = max(edgeDist.x, edgeDist.y) - 0.5;
      float glow = exp(-edgeFactor * 8.0) * spd;
      vec3 boundaryColor = mix(
        vec3(0.0, 0.8, 1.0), vec3(0.7, 0.0, 1.0),
        sin(t * 2.0 + atan(warpedUv.y - 0.5, warpedUv.x - 0.5)) * 0.5 + 0.5
      );
      color += boundaryColor * glow * 0.7 * voidGlow;
    }

    // ===================================
    // 9) GLITCH
    // ===================================
    if (spd > 0.6) {
      float glitchChance = hash(vec2(floor(t * 20.0), floor(vUv.y * 40.0)));
      if (glitchChance > 0.97) {
        float offset = (hash(vec2(t, vUv.y)) - 0.5) * 0.05 * spd;
        vec2 glitchUv = clamp(warpedUv + vec2(offset, 0.0), 0.0, 1.0);
        color.rgb = texture2D(tDiffuse, glitchUv).rgb;
        color.rgb += vec3(0.0, 0.3, 0.5) * spd * 0.3;
      }
    }

    // ===================================
    // 10) FILM GRAIN
    // ===================================
    float grain = hash(vUv * t * 137.0) * 0.04 * spd;
    color += vec3(grain);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;

export function SpacetimeCanvas({ videoElement, speed, dopplerFactor }: SpacetimeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    material: THREE.ShaderMaterial;
    plane: THREE.Mesh;
    offscreenCanvas: HTMLCanvasElement;
    offscreenCtx: CanvasRenderingContext2D;
    videoTexture: THREE.CanvasTexture;
    animationId: number;
    clock: THREE.Clock;
  } | null>(null);

  const speedRef = useRef(speed);
  const dopplerRef = useRef(dopplerFactor);
  speedRef.current = speed;
  dopplerRef.current = dopplerFactor;

  const initScene = useCallback(() => {
    if (!containerRef.current || !videoElement) return;

    if (stateRef.current) {
      cancelAnimationFrame(stateRef.current.animationId);
      if (containerRef.current.contains(stateRef.current.renderer.domElement)) {
        containerRef.current.removeChild(stateRef.current.renderer.domElement);
      }
      stateRef.current.renderer.dispose();
      stateRef.current.material.dispose();
      stateRef.current.plane.geometry.dispose();
      stateRef.current = null;
    }

    const w = containerRef.current.clientWidth || 640;
    const h = containerRef.current.clientHeight || 480;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, 0.1, 10);
    camera.position.z = 1;

    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);
    containerRef.current.appendChild(renderer.domElement);

    const videoTexture = new THREE.VideoTexture(videoElement);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.colorSpace = THREE.SRGBColorSpace;
    videoTexture.generateMipmaps = false;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse:    { value: videoTexture },
        uSpeed:      { value: 0.0 },
        uGamma:      { value: 1.0 },
        uDoppler:    { value: 0.0 },
        uTime:       { value: 0.0 },
        uResolution: { value: new THREE.Vector2(w, h) }
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER
    });

    const geometry = new THREE.PlaneGeometry(w, h);
    const plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    function animate() {
      const aid = requestAnimationFrame(animate);
      if (stateRef.current) stateRef.current.animationId = aid;

      const s = speedRef.current;
      const g = s < 1.0 ? 1.0 / Math.sqrt(1.0 - s * s) : 100.0;
      material.uniforms.uSpeed.value = s;
      material.uniforms.uGamma.value = g;
      material.uniforms.uDoppler.value = dopplerRef.current;
      material.uniforms.uTime.value = performance.now() / 1000;

      renderer.render(scene, camera);
    }

    const firstFrameId = requestAnimationFrame(animate);

    stateRef.current = {
      renderer, scene, camera, material, plane,
      offscreenCanvas: null as any, offscreenCtx: null as any,
      videoTexture: videoTexture as any, animationId: firstFrameId, clock: null as any
    };
  }, [videoElement]);

  useEffect(() => {
    initScene();

    const ro = new ResizeObserver(() => {
      if (!stateRef.current || !containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      const { renderer, camera, plane, material } = stateRef.current;
      renderer.setSize(w, h);
      camera.left = -w/2; camera.right = w/2;
      camera.top = h/2; camera.bottom = -h/2;
      camera.updateProjectionMatrix();
      plane.geometry.dispose();
      plane.geometry = new THREE.PlaneGeometry(w, h);
      material.uniforms.uResolution.value.set(w, h);
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      if (stateRef.current) {
        cancelAnimationFrame(stateRef.current.animationId);
        if (containerRef.current && containerRef.current.contains(stateRef.current.renderer.domElement)) {
          containerRef.current.removeChild(stateRef.current.renderer.domElement);
        }
        stateRef.current.renderer.dispose();
        stateRef.current.material.dispose();
        stateRef.current.plane.geometry.dispose();
        stateRef.current = null;
      }
    };
  }, [initScene]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 2 }} />;
}
