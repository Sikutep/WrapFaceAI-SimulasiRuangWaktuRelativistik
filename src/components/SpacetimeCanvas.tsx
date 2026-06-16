import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SpacetimeCanvasProps {
  speed: number;
  dopplerFactor: number;
  stream: MediaStream | null;
}

const VERTEX_SHADER = `
  uniform float uSpeed;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 newPosition = position;
    
    // Calculate normalized distance from center using UV
    float dist = length(uv - 0.5) * 2.0;
    
    if (uSpeed > 0.0) {
      // 1. Cinematic Z-Warp (Push center into deep screen)
      float warpFactor = pow(uSpeed, 3.0) * 800.0;
      newPosition.z -= (1.0 / (dist + 0.2)) * warpFactor;
      
      // 2. Physical 3D Lorentz Contraction
      float contraction = sqrt(1.0 - pow(uSpeed, 2.0));
      newPosition.x *= contraction;
    }
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float spd = uSpeed;
    float t = uTime;
    vec2 center = uv - 0.5;

    // 1) EXTREME LORENTZ CONTRACTION + WORMHOLE WARP
    // As spd approaches 1.0, the squeeze becomes infinite.
    // We'll map spd (0 to 0.99) to a massive horizontal squeeze.
    float squeezePower = pow(spd, 4.0) * 8.0; // Up to 8x squeeze
    center.x *= (1.0 + squeezePower);
    
    // Radial warp (Wormhole edge bending)
    float r = length(center);
    float warpPower = pow(spd, 3.0) * 2.0;
    float warpFactor = 1.0 - (r * r * warpPower);
    center *= warpFactor;
    
    // Vertical stretch (spaghettification)
    center.y *= 1.0 - (pow(spd, 2.0) * 0.3);
    
    vec2 warpedUv = center + 0.5;

    // 2) RELATIVISTIC CHROMATIC ABERRATION (Neon Doppler)
    // Blue shifts INWARD, Red shifts OUTWARD
    float aberStrength = pow(spd, 3.0) * 0.15; // Extreme color separation at high speed
    
    vec2 redCenter = center * (1.0 - aberStrength); // Pull inwards
    vec2 blueCenter = center * (1.0 + aberStrength); // Push outwards
    
    vec2 redUv = redCenter + 0.5;
    vec2 greenUv = warpedUv;
    vec2 blueUv = blueCenter + 0.5;

    // Sample textures with edge clamping/black out
    vec4 redSample = texture2D(tDiffuse, clamp(redUv, 0.0, 1.0));
    vec4 greenSample = texture2D(tDiffuse, clamp(greenUv, 0.0, 1.0));
    vec4 blueSample = texture2D(tDiffuse, clamp(blueUv, 0.0, 1.0));

    // Masking to make edges black if UVs go out of bounds
    float redMask = step(0.0, redUv.x) * step(redUv.x, 1.0) * step(0.0, redUv.y) * step(redUv.y, 1.0);
    float greenMask = step(0.0, greenUv.x) * step(greenUv.x, 1.0) * step(0.0, greenUv.y) * step(greenUv.y, 1.0);
    float blueMask = step(0.0, blueUv.x) * step(blueUv.x, 1.0) * step(0.0, blueUv.y) * step(blueUv.y, 1.0);

    vec3 color = vec3(
      redSample.r * redMask,
      greenSample.g * greenMask,
      blueSample.b * blueMask
    );

    float isVisible = max(redMask, max(greenMask, blueMask));

    // 3) NEON DOPPLER TINTING
    // Overdrive the colors to look like a sci-fi neon interface
    float totalDoppler = spd * 0.8 + uDoppler;
    vec3 blueTint = vec3(0.0, 0.5, 1.0);
    vec3 redTint  = vec3(1.0, 0.1, 0.0);
    vec3 tint = mix(redTint, blueTint, clamp(totalDoppler + 0.5, 0.0, 1.0));
    
    float tintStrength = pow(spd, 2.0) * 0.8;
    color = mix(color, color + (tint * color) * 2.0, tintStrength * isVisible);
    
    // Add brightness/bloom at extreme speeds
    color += tint * pow(spd, 6.0) * 1.5 * isVisible;

    // 4) VOID GLOW (Event Horizon edge glow)
    float voidGlow = (1.0 - isVisible);
    if (voidGlow > 0.0) {
      float glowPower = exp(-length(center) * 4.0) * spd * 2.0;
      vec3 boundaryColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 1.0), sin(t * 5.0) * 0.5 + 0.5);
      color += boundaryColor * glowPower;
    }

    // 4.5) GRAVITATIONAL SHADOW (Vignette)
    float distSq = dot(center, center);
    float vignette = smoothstep(0.5, 0.1, distSq * (0.5 + pow(spd, 2.0) * 3.0));
    color *= mix(1.0, vignette, spd);

    // 5) HIGH-SPEED SCANLINES & GLITCH
    float scanFreq = uResolution.y * 1.5;
    float scan = sin(vUv.y * scanFreq - t * 10.0) * 0.5 + 0.5;
    color *= mix(1.0, scan, pow(spd, 2.0) * 0.3);

    if (spd > 0.8) {
      float glitchChance = hash(vec2(floor(t * 30.0), floor(vUv.y * 50.0)));
      if (glitchChance > 0.95) {
        float offset = (hash(vec2(t, vUv.y)) - 0.5) * 0.1 * spd;
        vec2 glitchUv = clamp(warpedUv + vec2(offset, 0.0), 0.0, 1.0);
        color.rgb = texture2D(tDiffuse, glitchUv).rgb;
        color.rgb += vec3(0.0, 1.0, 0.5) * 0.5; // Neon green flash
      }
    }

    // 6) FILM GRAIN
    float grain = hash(vUv * t * 200.0) * 0.08 * spd;
    color += vec3(grain);

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

export function SpacetimeCanvas({ speed, dopplerFactor, stream }: SpacetimeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef(speed);
  const dopplerRef = useRef(dopplerFactor);
  speedRef.current = speed;
  dopplerRef.current = dopplerFactor;

  useEffect(() => {
    if (!containerRef.current || !stream) return;

    const container = containerRef.current;
    let animId = 0;
    let destroyed = false;
    let renderer: THREE.WebGLRenderer | null = null;
    let video: HTMLVideoElement | null = null;

    console.log('[SpacetimeCanvas] Init stream tracks:', stream.getTracks().length);

    // 1) Create PRIVATE video element
    video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.srcObject = stream;
    // Make sure Chrome actually decodes the video by keeping it in the DOM but invisible
    video.style.cssText = 'position:fixed;top:0;left:0;width:320px;height:240px;opacity:0.001;pointer-events:none;z-index:-9999;';
    document.body.appendChild(video);

    video.play().catch(err => {
      console.error('[SpacetimeCanvas] video.play() failed:', err);
    });

    function waitForVideo() {
      if (destroyed || !video) return;
      if (video.readyState < 2 || video.videoWidth === 0) {
        setTimeout(waitForVideo, 100);
        return;
      }
      console.log('[SpacetimeCanvas] ✅ VIDEO READY: ' + video.videoWidth + 'x' + video.videoHeight);
      buildScene();
    }

    function buildScene() {
      if (destroyed || !containerRef.current || !video) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) {
        setTimeout(buildScene, 100);
        return;
      }

      console.log('[SpacetimeCanvas] Container:', w, 'x', h);

      // Use PerspectiveCamera to correctly render the Z-Warp depth
      const fov = 45;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(fov, w / h, 1, 4000);
      
      // Calculate distance to perfectly fit the plane of size (w, h)
      const d = (h / 2) / Math.tan((fov * Math.PI / 180) / 2);
      camera.position.z = d;

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(window.devicePixelRatio);
      container.appendChild(renderer.domElement);
      renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';

      // NATIVE THREE.js VideoTexture! (Handles all updates natively)
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.colorSpace = THREE.SRGBColorSpace;

      const material = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse:    { value: texture },
          uSpeed:      { value: 0.0 },
          uGamma:      { value: 1.0 },
          uDoppler:    { value: 0.0 },
          uTime:       { value: 0.0 },
          uResolution: { value: new THREE.Vector2(w, h) }
        },
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true
      });

      // Dense Mesh 128x128 for high-quality vertex bending
      const geometry = new THREE.PlaneGeometry(w, h, 128, 128);
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (destroyed || !renderer || !containerRef.current) return;
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        if (nw === 0 || nh === 0) return;
        
        renderer.setSize(nw, nh);
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        
        // Recalculate distance to fit plane
        const newD = (nh / 2) / Math.tan((fov * Math.PI / 180) / 2);
        camera.position.z = newD;
        
        plane.geometry.dispose();
        plane.geometry = new THREE.PlaneGeometry(nw, nh, 128, 128);
        material.uniforms.uResolution.value.set(nw, nh);
      });
      ro.observe(container);

      let frames = 0;
      function animate() {
        if (destroyed) return;
        animId = requestAnimationFrame(animate);

        frames++;
        if (frames === 1) console.log('[SpacetimeCanvas] First render frame!');

        let s = speedRef.current;
        if (isNaN(s)) s = 0.0;
        let g = s < 1.0 ? 1.0 / Math.sqrt(1.0 - s * s) : 100.0;
        if (isNaN(g)) g = 1.0;
        let d = dopplerRef.current;
        if (isNaN(d)) d = 0.0;

        material.uniforms.uSpeed.value = s;
        material.uniforms.uGamma.value = g;
        material.uniforms.uDoppler.value = d;
        material.uniforms.uTime.value = performance.now() / 1000;

        // Cinematic Camera Shake
        if (s > 0.85) {
          const shakeIntensity = Math.pow(s - 0.85, 2) * 500.0;
          camera.position.x = (Math.random() - 0.5) * shakeIntensity;
          camera.position.y = (Math.random() - 0.5) * shakeIntensity;
        } else {
          camera.position.x = 0;
          camera.position.y = 0;
        }

        renderer!.render(scene, camera);
      }
      animate();
    }

    waitForVideo();

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      if (video && document.body.contains(video)) {
        document.body.removeChild(video);
      }
      if (renderer && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [stream]);

  // zIndex 10 ensures it is ABOVE all the HUD grid/lines
  return <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10 }} />;
}
