/* ==========================================================================
   DuckStudio — cena 3D (Three.js)
   Pato procedural extrudado a partir da logo (pipeline img2threejs:
   blockout → structure → form → material → lighting → interaction → optimization).
   A cena é leve: 1 malha principal, poucos objetos flutuantes e partículas.
   ========================================================================== */
import * as THREE from '../vendor/three.module.min.js';
import { DUCK_OUTER, DUCK_HOLE } from './duck-shape.js';

const canvas = document.getElementById('gl');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const small = () => innerWidth < 768;

/* Estado controlado pelo GSAP (main.js). Valores interpolados a cada frame. */
export const pose = {
  x: 2.4, y: -0.1, z: 0, s: 1, ry: -0.55, rx: 0.1,
  duck: 1,        // opacidade do pato sólido
  morph: 0,       // 0 = pontos na forma do pato, 1 = constelação dispersa
  points: 0,      // opacidade dos pontos do pato
  float: 1,       // opacidade dos objetos flutuantes
  dust: 0.55,     // brilho das partículas ambientes
  night: 0,       // 0 = céu diurno, 1 = espaço (muda cor das partículas)
};

function supportsWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch (e) { return false; }
}

export function initScene() {
  if (!canvas || !supportsWebGL()) { document.documentElement.classList.add('no-webgl'); return null; }

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !coarse, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  /* ---------- lighting pass: ambiente gerado (sem HDR externo) ---------- */
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(20, 32, 16);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.30,0.42,0.95);
        vec3 mid = vec3(0.86,0.91,1.0);
        vec3 low = vec3(0.10,0.06,0.62);
        vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.9, h)) : mix(mid, low, smoothstep(0.0, 0.7, -h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  envScene.add(new THREE.Mesh(envGeo, envMat));
  const softbox = (w, h, pos, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }));
    m.position.copy(pos); m.lookAt(0, 0, 0); envScene.add(m);
  };
  softbox(14, 5, new THREE.Vector3(0, 12, 6), 3.2);
  softbox(4, 10, new THREE.Vector3(-12, 2, 4), 1.8);
  softbox(4, 8, new THREE.Vector3(12, -2, -6), 1.2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  envGeo.dispose(); envMat.dispose(); pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(3, 6, 8); scene.add(key);

  /* ---------- blockout + structure + form: pato extrudado ---------- */
  const toVec = (arr) => { const v = []; for (let i = 0; i < arr.length; i += 2) v.push(new THREE.Vector2(arr[i], arr[i + 1])); return v; };
  const shape = new THREE.Shape(toVec(DUCK_OUTER));
  shape.holes.push(new THREE.Path(toVec(DUCK_HOLE)));
  const duckGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.1, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.014, bevelOffset: -0.014, bevelSegments: small() ? 3 : 6, curveSegments: 4,
  });
  duckGeo.center();
  duckGeo.computeVertexNormals();

  /* material pass: perolado com clearcoat — ar, luz, precisão */
  const duckMat = new THREE.MeshPhysicalMaterial({
    color: 0xf3f5ff, roughness: 0.22, metalness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.08,
    iridescence: 0.45, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 420],
    sheen: 0.4, sheenColor: new THREE.Color(0x8fa2ff), sheenRoughness: 0.5,
    envMapIntensity: 1.25, transparent: true,
  });
  const duckGroup = new THREE.Group();
  const duck = new THREE.Mesh(duckGeo, duckMat);
  duck.scale.setScalar(3.1);
  duckGroup.add(duck);
  scene.add(duckGroup);

  /* ---------- action anchor: pato em pontos (morph para constelação) ---------- */
  const COUNT = small() ? 1400 : 3200;
  const posAttr = duckGeo.getAttribute('position');
  const idx = duckGeo.getIndex();
  const triCount = idx ? idx.count / 3 : posAttr.count / 3;
  const areas = new Float32Array(triCount);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const getTri = (t) => {
    const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(posAttr, i0); b.fromBufferAttribute(posAttr, i1); c.fromBufferAttribute(posAttr, i2);
  };
  let total = 0;
  for (let t = 0; t < triCount; t++) { getTri(t); const ar = new THREE.Triangle(a, b, c).getArea(); total += ar; areas[t] = total; }
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const shapePos = new Float32Array(COUNT * 3), scatter = new Float32Array(COUNT * 3), rand = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const r = rnd() * total; let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
    getTri(lo);
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const p = new THREE.Vector3().copy(a).addScaledVector(new THREE.Vector3().subVectors(b, a), u).addScaledVector(new THREE.Vector3().subVectors(c, a), v).multiplyScalar(3.1);
    shapePos.set([p.x, p.y, p.z], i * 3);
    const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1), rad = 3 + rnd() * 7;
    scatter.set([Math.sin(ph) * Math.cos(th) * rad * 1.6, Math.cos(ph) * rad * 0.8, Math.sin(ph) * Math.sin(th) * rad - 2], i * 3);
    rand[i] = rnd();
  }
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(shapePos, 3));
  ptsGeo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  ptsGeo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const ptsMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uMorph: { value: 0 }, uOpacity: { value: 0 }, uTime: { value: 0 }, uSize: { value: 2.2 * Math.min(devicePixelRatio, 2) } },
    vertexShader: `
      attribute vec3 aScatter; attribute float aRand;
      uniform float uMorph, uTime, uSize; varying float vA;
      void main(){
        float m = smoothstep(0.0, 1.0, clamp(uMorph * 1.4 - aRand * 0.4, 0.0, 1.0));
        vec3 p = mix(position, aScatter, m);
        p += 0.04 * vec3(sin(uTime*0.7 + aRand*40.0), cos(uTime*0.6 + aRand*30.0), 0.0) * (0.3 + m);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.6 + aRand) * (10.0 / -mv.z);
        vA = 0.55 + 0.45 * sin(uTime * 1.3 + aRand * 60.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity; varying float vA;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float s = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.78, 0.84, 1.0), s * uOpacity * vA);
      }`,
  });
  const duckPts = new THREE.Points(ptsGeo, ptsMat);
  duckGroup.add(duckPts);

  /* ---------- objetos flutuantes (estruturas pequenas) ---------- */
  const floaters = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdfe6ff, roughness: 0.12, metalness: 0, clearcoat: 1, iridescence: 0.6, transparent: true, opacity: 0.9, envMapIntensity: 1.4 });
  const blue = new THREE.MeshPhysicalMaterial({ color: 0x0f00d7, roughness: 0.3, metalness: 0.1, clearcoat: 1, transparent: true, envMapIntensity: 1 });
  const defs = [
    [new THREE.IcosahedronGeometry(0.34, 4), glass, [-4.6, 2.2, -2]],
    [new THREE.IcosahedronGeometry(0.18, 3), blue, [4.8, 2.9, -1]],
    [new THREE.TorusGeometry(0.42, 0.035, 12, 64), glass, [-3.4, -2.6, -1.5]],
    [new THREE.OctahedronGeometry(0.22, 0), blue, [5.6, -2.2, -3]],
    [new THREE.IcosahedronGeometry(0.12, 2), glass, [-1.4, 3.3, -3]],
    [new THREE.TorusGeometry(0.26, 0.03, 10, 48), blue, [1.6, -3.4, -2.5]],
  ];
  defs.forEach(([g, m, p], i) => {
    const mesh = new THREE.Mesh(g, m); mesh.position.set(...p);
    mesh.userData = { base: new THREE.Vector3(...p), ph: i * 1.7, sp: 0.25 + i * 0.05 };
    floaters.add(mesh);
  });
  if (!small()) scene.add(floaters);

  /* ---------- partículas ambientes (poeira de luz) ---------- */
  const DUST = small() ? 380 : 1100;
  const dPos = new Float32Array(DUST * 3), dRand = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dPos.set([(rnd() - 0.5) * 26, (rnd() - 0.5) * 16, -rnd() * 14 + 2], i * 3); dRand[i] = rnd();
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute('aRand', new THREE.BufferAttribute(dRand, 1));
  const dMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uScroll: { value: 0 }, uOpacity: { value: 0.55 }, uNight: { value: 0 }, uSize: { value: 1.6 * Math.min(devicePixelRatio, 2) } },
    vertexShader: `
      attribute float aRand; uniform float uTime, uScroll, uSize; varying float vR;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.05 + aRand * 0.08) + uScroll * (0.4 + aRand), 16.0) - 8.0;
        p.x += sin(uTime * 0.2 + aRand * 20.0) * 0.3;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * (0.5 + aRand * 1.2) * (12.0 / -mv.z);
        vR = aRand;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOpacity, uNight; varying float vR;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float s = smoothstep(0.5, 0.05, d);
        vec3 day = vec3(1.0);
        vec3 night = mix(vec3(0.7, 0.75, 1.0), vec3(1.0, 0.95, 0.9), vR);
        gl_FragColor = vec4(mix(day, night, uNight), s * uOpacity * (0.35 + vR * 0.65));
      }`,
  });
  const dust = new THREE.Points(dGeo, dMat);
  scene.add(dust);

  /* ---------- interaction: mouse + resize ---------- */
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse && !reduced) {
    addEventListener('pointermove', (e) => { mouse.tx = e.clientX / innerWidth - 0.5; mouse.ty = e.clientY / innerHeight - 0.5; }, { passive: true });
  }
  let scrollVel = 0, lastY = scrollY;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio, small() ? 1.25 : 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 42 : 32;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  /* ---------- loop (optimization: pausa fora da aba e quando nada é visível) ---------- */
  const clock = new THREE.Clock();
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { clock.getDelta(); tick(); } });
  const cur = { ...pose };

  function frame(dt, t) {
    const k = reduced ? 1 : 1 - Math.pow(0.0015, dt);
    for (const key in pose) cur[key] += (pose[key] - cur[key]) * k;
    mouse.x += (mouse.tx - mouse.x) * (reduced ? 1 : 0.05);
    mouse.y += (mouse.ty - mouse.y) * (reduced ? 1 : 0.05);

    const bob = reduced ? 0 : Math.sin(t * 0.6) * 0.12;
    duckGroup.position.set(cur.x + mouse.x * 0.35, cur.y + bob - mouse.y * 0.25, cur.z);
    duckGroup.scale.setScalar(Math.max(cur.s, 0.0001));
    duckGroup.rotation.set(cur.rx + mouse.y * 0.25 + (reduced ? 0 : Math.sin(t * 0.4) * 0.04), cur.ry + mouse.x * 0.5 + (reduced ? 0 : Math.sin(t * 0.3) * 0.08), reduced ? 0 : Math.sin(t * 0.5) * 0.03);

    duckMat.opacity = cur.duck;
    duck.visible = cur.duck > 0.01;
    ptsMat.uniforms.uOpacity.value = cur.points;
    ptsMat.uniforms.uMorph.value = cur.morph;
    ptsMat.uniforms.uTime.value = t;
    duckPts.visible = cur.points > 0.01;

    floaters.visible = cur.float > 0.01;
    floaters.children.forEach((m) => {
      const u = m.userData;
      m.position.set(u.base.x + mouse.x * (1 + u.ph * 0.1), u.base.y + (reduced ? 0 : Math.sin(t * u.sp + u.ph) * 0.3) - mouse.y * 0.6, u.base.z);
      m.rotation.x = t * 0.2 + u.ph; m.rotation.y = t * 0.15;
      m.material.opacity = cur.float * 0.95;
    });

    scrollVel += ((scrollY - lastY) * 0.0006 - scrollVel) * 0.1; lastY = scrollY;
    dMat.uniforms.uTime.value = reduced ? 0 : t;
    dMat.uniforms.uScroll.value = scrollY * 0.0004;
    dMat.uniforms.uOpacity.value = cur.dust;
    dMat.uniforms.uNight.value = cur.night;
    camera.position.x = mouse.x * 0.4;
    camera.position.y = -mouse.y * 0.3 - scrollVel * 2;
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
  }

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    frame(dt, clock.elapsedTime);
    if (!reduced) requestAnimationFrame(tick);
  }
  if (reduced) {
    // Movimento reduzido: renderiza apenas quando o estado muda (sem loop contínuo).
    frame(1, 0);
    const again = () => frame(1, 0);
    return { pose, redraw: again };
  }
  tick();
  return { pose, redraw: () => {} };
}
