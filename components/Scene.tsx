"use client";

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function createRenderer(container: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x03040a, 1);
  const dpr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);
  renderer.domElement.classList.add('canvas');
  return renderer;
}

function createEarth(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(2.2, 128, 128);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCyan: { value: new THREE.Color('#00eaff') },
      uBlue: { value: new THREE.Color('#0abdc6') }
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      varying vec3 vPos;
      varying vec3 vNormal;
      void main(){
        vPos = position;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vPos;
      varying vec3 vNormal;
      uniform float uTime;
      uniform vec3 uCyan;
      uniform vec3 uBlue;

      float grid(vec3 p){
        // spherical lat-long grid
        vec3 n = normalize(p);
        float lat = acos(clamp(n.y, -1.0, 1.0));
        float lon = atan(n.z, n.x);
        float g1 = smoothstep(0.0, 0.02, 0.02 - abs(fract((lat/3.14159)*24.0)-0.5));
        float g2 = smoothstep(0.0, 0.02, 0.02 - abs(fract((lon/6.28318)*48.0)-0.5));
        return max(g1, g2);
      }

      void main(){
        vec3 n = normalize(vNormal);
        float fresnel = pow(1.0 - max(dot(n, vec3(0.0,0.0,1.0)), 0.0), 2.0);
        float g = grid(vPos + vec3(uTime*0.03));
        vec3 col = mix(uBlue, uCyan, 0.5 + 0.5*sin(uTime*0.7));
        float glow = fresnel*1.2 + g*1.6;
        gl_FragColor = vec4(col * glow, 0.9);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

function createEye(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(3.0, 3.0, 1, 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpen: { value: 0 }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime;
      uniform float uOpen;

      float circle(vec2 uv, vec2 c, float r, float blur){
        float d = length(uv - c);
        return smoothstep(r, r - blur, d);
      }

      void main(){
        vec2 uv = vUv * 2.0 - 1.0;
        uv.x *= 1.2;
        float open = smoothstep(0.0, 1.0, uOpen);
        float lid = smoothstep(0.0, 1.0, 1.0 - abs(uv.y) * (1.4 - 0.8*open));

        float irisR = mix(0.02, 0.35, open);
        float pupil = circle(uv, vec2(0.0), 0.10, 0.08) * open;
        float iris = circle(uv, vec2(0.0), irisR, 0.12);

        float rays = sin(atan(uv.y, uv.x)*18.0 + uTime*1.5)*0.5+0.5;
        float ring = smoothstep(irisR, irisR-0.08, length(uv));

        vec3 base = vec3(0.0, 0.9, 1.0);
        vec3 col = base*1.2*ring + base*0.9*rays*iris + base*0.6*pupil;
        float glow = ring*1.2 + iris*0.4 + pupil*0.6 + lid*0.2;

        float alpha = clamp(glow, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 3.6, -2.0);
  return mesh;
}

function createDataStreams(count = 800) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.acos(THREE.MathUtils.randFloatSpread(2));
    const phi = THREE.MathUtils.randFloat(0, Math.PI * 2);
    const r = 2.35 + Math.random()*0.25;
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.cos(theta);
    const z = r * Math.sin(theta) * Math.sin(phi);
    positions.set([x, y, z], i * 3);
    speeds[i] = THREE.MathUtils.randFloat(0.4, 1.4);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute float aSpeed;
      uniform float uTime;
      varying float vGlow;
      void main(){
        vec3 p = position;
        float t = uTime * aSpeed;
        // subtle orbit around Y
        float s = sin(t*0.2), c = cos(t*0.2);
        mat2 rot = mat2(c, -s, s, c);
        p.xz = rot * p.xz;
        vGlow = fract(t*0.25 + (p.y+3.0));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = 2.0 + 2.0*vGlow;
      }
    `,
    fragmentShader: /* glsl */`
      precision mediump float;
      varying float vGlow;
      void main(){
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float d = dot(uv, uv);
        float alpha = smoothstep(1.0, 0.0, d) * (0.4 + 0.6*vGlow);
        vec3 col = mix(vec3(0.05,0.6,0.9), vec3(0.0,1.0,1.0), vGlow);
        gl_FragColor = vec4(col, alpha);
      }
    `
  });

  return new THREE.Points(geometry, material);
}

function createCircuitLines(lines = 200) {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: new THREE.Color('#00eaff'), transparent: true, opacity: 0.35 });
  for (let i = 0; i < lines; i++) {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const a = new THREE.Vector3().randomDirection().multiplyScalar(2.2);
    const b = a.clone().multiplyScalar(1.05).add(new THREE.Vector3().randomDirection().multiplyScalar(0.4));
    const c = b.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.4));
    const curve = new THREE.CatmullRomCurve3([a, b, c]);
    const points = curve.getPoints(24);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, material);
    group.add(line);
  }
  return group;
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const count = 2000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = THREE.MathUtils.randFloat(40, 80);
    const dir = new THREE.Vector3().randomDirection().multiplyScalar(r);
    positions.set([dir.x, dir.y, dir.z], i * 3);
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: '#7fe9ff', size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.6 });
  return new THREE.Points(geometry, material);
}

export default function Scene() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const renderer = createRenderer(container);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 1.4, 9);

    const ambient = new THREE.AmbientLight('#2bd9ff', 0.25);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight('#9ff6ff', 1.1);
    dir.position.set(-4, 6, 6);
    scene.add(dir);

    // Background fog for depth
    scene.fog = new THREE.FogExp2(0x06152a, 0.03);

    const earth = createEarth();
    scene.add(earth);

    const eye = createEye();
    eye.position.set(0, 3.2, 0);
    scene.add(eye);

    const streams = createDataStreams();
    scene.add(streams);

    const circuits = createCircuitLines();
    scene.add(circuits);

    const stars = createStars();
    scene.add(stars);

    const clock = new THREE.Clock();

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    let zoomProgress = 0; // 0..1

    const animate = () => {
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();

      (earth.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (streams.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      (eye.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
      const open = Math.min(1, t * 0.35);
      (eye.material as THREE.ShaderMaterial).uniforms.uOpen.value = open;

      earth.rotation.y += 0.02 * dt;
      stars.rotation.y += 0.002 * dt;
      circuits.rotation.y -= 0.01 * dt;

      // Cinematic zoom towards the eye
      zoomProgress = Math.min(1, zoomProgress + 0.02 * dt);
      const zoom = THREE.MathUtils.smoothstep(zoomProgress, 0, 1);
      camera.position.lerp(new THREE.Vector3(0, 2.0, 5.4), 0.02 * dt);
      camera.lookAt(0, 2.6, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };

    let raf = requestAnimationFrame(animate);

    // 8K frame render & download
    const btn = document.getElementById('render-8k');
    const onClick = async () => {
      const prevSize = renderer.getSize(new THREE.Vector2());
      const prevRatio = renderer.getPixelRatio();
      const targetW = 7680, targetH = 4320;
      renderer.setPixelRatio(1);
      renderer.setSize(targetW, targetH, false);
      renderer.render(scene, camera);
      const dataURL = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = 'ai-reality-check-8k.png';
      a.click();
      renderer.setPixelRatio(prevRatio);
      renderer.setSize(prevSize.x, prevSize.y, false);
    };
    btn?.addEventListener('click', onClick);

    return () => {
      btn?.removeEventListener('click', onClick);
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="container" />;
}
