import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SpacetimeCanvasProps {
  speed: number;
  dopplerFactor: number;
  stream: MediaStream | null;
}

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

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float inBounds(vec2 c) {
    vec2 s = step(0.0, c) * step(c, vec2(1.0));
    return s.x * s.y;
  }

  void main() {
    vec2 uv = vUv;
    float spd = uSpeed;
    float t = uTime;
    vec2 center = uv - 0.5;

    // 1) LORENTZ CONTRACTION + WORMHOLE
    float squeeze = 1.0 / uGamma;
    center.x /= max(squeeze, 0.01);
    float warpPower = spd * spd * 0.6;
    float r = length(center);
    float warpFactor = 1.0 + warpPower * r * r;
    warpFactor += sin(t * 3.0) * spd * spd * 0.02;
    center *= warpFactor;
    center.y *= 1.0 + spd * spd * 0.15;
    vec2 warpedUv = center + 0.5;

    // 2) CHROMATIC ABERRATION
    float aberStrength = spd * spd * 0.035 + abs(uDoppler) * 0.02;
    vec2 radialDir = normalize(warpedUv - 0.5 + vec2(0.0001));
    float radialDist = length(warpedUv - 0.5);
    vec2 redUv   = warpedUv + radialDir * aberStrength * radialDist;
    vec2 greenUv = warpedUv;
    vec2 blueUv  = warpedUv - radialDir * aberStrength * radialDist;

    vec4 redSample   = texture2D(tDiffuse, clamp(redUv,   0.0, 1.0));
    vec4 greenSample = texture2D(tDiffuse, clamp(greenUv, 0.0, 1.0));
    vec4 blueSample  = texture2D(tDiffuse, clamp(blueUv,  0.0, 1.0));

    float redMask   = inBounds(redUv);
    float greenMask = inBounds(greenUv);
    float blueMask  = inBounds(blueUv);

    vec3 color = vec3(
      redSample.r   * redMask,
      greenSample.g * greenMask,
      blueSample.b  * blueMask
    );
    float isVisible = max(redMask, max(greenMask, blueMask));

    // 3) DOPPLER TINTING
    float totalDoppler = spd * 0.6 + uDoppler * 0.8;
    vec3 blueTint = vec3(0.15, 0.3, 0.9);
    vec3 redTint  = vec3(0.9, 0.2, 0.05);
    float tintStrength = abs(totalDoppler) * 0.4;
    vec3 tint = mix(redTint, blueTint, clamp(totalDoppler + 0.5, 0.0, 1.0));
    color = mix(color, color + tint * tintStrength, min(spd * 1.5, 1.0) * isVisible);
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, 1.0 + spd * 0.8);

    // 4) BLOOM
    float bloom = smoothstep(0.4, 0.9, lum) * spd * 0.6 * isVisible;
    vec3 bloomColor = mix(vec3(0.0, 0.6, 1.0), vec3(0.6, 0.0, 1.0), spd);
    color += bloomColor * bloom;

    // 5) HYPERSPACE STREAKS
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

    // 6) VIGNETTE
    float vigStrength = 0.3 + spd * 1.2;
    vec2 vigUv = vUv - 0.5;
    float vig = 1.0 - dot(vigUv, vigUv) * vigStrength * 2.5;
    vig = clamp(vig, 0.0, 1.0);
    vec3 vigColor = mix(vec3(0.0), vec3(0.0, 0.02, 0.08), spd);
    color = mix(vigColor, color, vig);

    // 7) SCANLINES
    float scanFreq = uResolution.y * 1.2;
    float scan = sin(vUv.y * scanFreq + t * 2.0) * 0.5 + 0.5;
    scan = mix(1.0, scan, 0.06 + spd * 0.08);
    color *= scan;

    // 8) VOID GLOW
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

    // 9) GLITCH
    if (spd > 0.6) {
      float glitchChance = hash(vec2(floor(t * 20.0), floor(vUv.y * 40.0)));
      if (glitchChance > 0.97) {
        float offset = (hash(vec2(t, vUv.y)) - 0.5) * 0.05 * spd;
        vec2 glitchUv = clamp(warpedUv + vec2(offset, 0.0), 0.0, 1.0);
        color.rgb = texture2D(tDiffuse, glitchUv).rgb;
        color.rgb += vec3(0.0, 0.3, 0.5) * spd * 0.3;
      }
    }

    // 10) GRAIN
    float grain = hash(vUv * t * 137.0) * 0.04 * spd;
    color += vec3(grain);

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
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

      // Standard Orthographic Setup mapped 1:1 to pixels
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, 1, 1000);
      camera.position.z = 100;

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

      // Plane matches pixel dimensions of container
      const geometry = new THREE.PlaneGeometry(w, h);
      const plane = new THREE.Mesh(geometry, material);
      scene.add(plane);

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (destroyed || !renderer || !containerRef.current) return;
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        if (nw === 0 || nh === 0) return;
        
        renderer.setSize(nw, nh);
        camera.left = nw / -2;
        camera.right = nw / 2;
        camera.top = nh / 2;
        camera.bottom = nh / -2;
        camera.updateProjectionMatrix();
        
        plane.geometry.dispose();
        plane.geometry = new THREE.PlaneGeometry(nw, nh);
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
