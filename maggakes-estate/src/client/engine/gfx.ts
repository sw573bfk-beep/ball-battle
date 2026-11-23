import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

export type Quality = 'high' | 'medium' | 'low';

export interface Mood {
  /** Sun elevation in degrees (low = sunset). */
  sun: number;
  sunAzimuth: number;
  sunColor: number;
  sunIntensity: number;
  ambient: number;
  ambientSky: number;
  ambientGround: number;
  exposure: number;
  fog: number;
  fogDensity: number;
  indoor: boolean;
}

export const MOODS: Record<string, Mood> = {
  day: { sun: 42, sunAzimuth: 140, sunColor: 0xfff1dc, sunIntensity: 1.9, ambient: 0.75, ambientSky: 0xdfeaff, ambientGround: 0xf1e3d3, exposure: 1.0, fog: 0xcfe3f5, fogDensity: 0.004, indoor: true },
  golden: { sun: 14, sunAzimuth: 230, sunColor: 0xffb878, sunIntensity: 2.2, ambient: 0.7, ambientSky: 0xffd2b0, ambientGround: 0x6a4a5a, exposure: 1.05, fog: 0xf3b48f, fogDensity: 0.005, indoor: false },
  garage: { sun: 55, sunAzimuth: 120, sunColor: 0xfff4e6, sunIntensity: 1.8, ambient: 0.7, ambientSky: 0xdfe8ff, ambientGround: 0x55585e, exposure: 1.0, fog: 0xbfd4e8, fogDensity: 0.004, indoor: false },
  moody: { sun: 50, sunAzimuth: 160, sunColor: 0xffe6f0, sunIntensity: 1.3, ambient: 0.6, ambientSky: 0xe6d8ff, ambientGround: 0x3a2a40, exposure: 1.0, fog: 0xb9b2d6, fogDensity: 0.004, indoor: true },
};

export class Gfx {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  smaa: SMAAPass;
  sun = new THREE.DirectionalLight(0xffffff, 2.5);
  hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1);
  sky: Sky;
  quality: Quality;
  /** Direction towards the sun/moon. The shadow box follows the player along it. */
  private lightDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize();
  private shadowR = 24;
  private envTex: THREE.Texture;

  constructor(host: HTMLElement, quality: Quality) {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 900);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.35;

    this.sky = new Sky();
    this.sky.scale.setScalar(800);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.85;
    this.scene.add(this.sky);

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 2.4);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.smaa = new SMAAPass();
    this.composer.addPass(this.smaa);

    this.applyQuality();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.applyQuality();
    this.resize();
  }

  private applyQuality(): void {
    const q = this.quality;
    // The shadow box follows the player (see followShadow), so a modest map stays sharp.
    const size = q === 'high' ? 2048 : 1024;
    this.shadowR = q === 'high' ? 24 : 20;
    this.setShadowBox();
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.bloom.enabled = q !== 'low';
    this.smaa.enabled = q !== 'low';
    this.renderer.shadowMap.needsUpdate = true;
  }

  resize(): void {
    const w = innerWidth, h = innerHeight;
    const dpr = Math.min(devicePixelRatio, this.quality === 'high' ? 1.75 : this.quality === 'medium' ? 1.25 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Sets sky, sun and fog for a zone. `span` is how big the playable area is. */
  setMood(m: Mood, span: number): void {
    const phi = THREE.MathUtils.degToRad(90 - m.sun);
    const theta = THREE.MathUtils.degToRad(m.sunAzimuth);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    this.sun.color.setHex(m.sunColor);
    this.sun.intensity = m.sunIntensity;
    this.lightDir.copy(dir);
    this.setShadowBox();
    this.hemi.color.setHex(m.ambientSky);
    this.hemi.groundColor.setHex(m.ambientGround);
    this.hemi.intensity = m.ambient;
    this.renderer.toneMappingExposure = m.exposure;
    this.scene.fog = new THREE.FogExp2(m.fog, m.fogDensity);
    this.renderer.shadowMap.needsUpdate = true;
  }

  // ------------------------------------------------------------ day & night

  private stars?: THREE.Points;
  /** 0..1 how "night" it is right now (for lamps, stars, HUD). */
  night = 0;

  /**
   * Shared day/night cycle. `phase` 0..1 (0 = sunrise, 0.58 = sunset, 0.66–0.92 = night).
   * `indoor` floors keep a little more ambient light so rooms stay readable at night.
   */
  setTimeOfDay(phase: number, span: number, indoor: boolean): void {
    type K = { p: number; sun: number; col: number; int: number; amb: number; sky: number; gnd: number; exp: number; fog: number; moon: number };
    const keys: K[] = [
      { p: 0.0, sun: 5, col: 0xffb38a, int: 1.4, amb: 0.55, sky: 0xffc9a8, gnd: 0x6a4a5a, exp: 1.05, fog: 0xf3c4a8, moon: 0 },
      { p: 0.08, sun: 45, col: 0xfff1dc, int: 1.9, amb: 0.75, sky: 0xdfeaff, gnd: 0xf1e3d3, exp: 1.0, fog: 0xcfe3f5, moon: 0 },
      { p: 0.5, sun: 40, col: 0xfff1dc, int: 1.9, amb: 0.75, sky: 0xdfeaff, gnd: 0xf1e3d3, exp: 1.0, fog: 0xcfe3f5, moon: 0 },
      { p: 0.58, sun: 4, col: 0xff8a4c, int: 1.8, amb: 0.45, sky: 0xffb08a, gnd: 0x4a2a40, exp: 1.0, fog: 0xe8956f, moon: 0 },
      { p: 0.66, sun: -10, col: 0x8fa8ff, int: 0.22, amb: 0.16, sky: 0x2a3560, gnd: 0x0d0b18, exp: 0.95, fog: 0x0e1426, moon: 1 },
      { p: 0.92, sun: -10, col: 0x8fa8ff, int: 0.22, amb: 0.16, sky: 0x2a3560, gnd: 0x0d0b18, exp: 0.95, fog: 0x0e1426, moon: 1 },
      { p: 1.0, sun: 5, col: 0xffb38a, int: 1.4, amb: 0.55, sky: 0xffc9a8, gnd: 0x6a4a5a, exp: 1.05, fog: 0xf3c4a8, moon: 0 },
    ];
    let i = 0;
    while (i < keys.length - 2 && phase > keys[i + 1].p) i++;
    const a = keys[i], b = keys[i + 1];
    const t = THREE.MathUtils.smoothstep(phase, a.p, b.p);
    const lerp = (x: number, y: number) => x + (y - x) * t;
    const col = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), t);
    const moon = lerp(a.moon, b.moon);
    this.night = moon;
    // Sky uses the real sun (below the horizon at night = dark sky); lighting uses sun or moon.
    const sunEl = lerp(a.sun, b.sun);
    const az = THREE.MathUtils.degToRad(140 + phase * 180);
    const skyDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - sunEl), az);
    this.sky.material.uniforms.sunPosition.value.copy(skyDir);
    const lightEl = moon > 0.5 ? 40 : Math.max(8, sunEl);
    // Move the light in small steps, not every frame, so shadows don't crawl and shimmer.
    const step = THREE.MathUtils.degToRad(1.5);
    const q = (v: number) => Math.round(v / step) * step;
    this.lightDir.setFromSphericalCoords(1, q(THREE.MathUtils.degToRad(90 - lightEl)), q(moon > 0.5 ? az + Math.PI : az));
    this.sun.color.copy(col(a.col, b.col));
    this.sun.intensity = lerp(a.int, b.int);
    this.hemi.color.copy(col(a.sky, b.sky));
    this.hemi.groundColor.copy(col(a.gnd, b.gnd));
    this.hemi.intensity = Math.max(lerp(a.amb, b.amb), indoor ? 0.6 - moon * 0.12 : 0);
    this.renderer.toneMappingExposure = lerp(a.exp, b.exp);
    this.scene.environmentIntensity = 0.35 * (1 - moon * (indoor ? 0.55 : 0.88));
    this.scene.fog = new THREE.FogExp2(col(a.fog, b.fog), 0.004);
    if (!this.stars) {
      const pts = new Float32Array(900 * 3);
      for (let k = 0; k < 900; k++) {
        const v = new THREE.Vector3().setFromSphericalCoords(450, Math.acos(Math.random() * 0.95), Math.random() * Math.PI * 2);
        pts.set([v.x, v.y, v.z], k * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
      this.scene.add(this.stars);
    }
    (this.stars.material as THREE.PointsMaterial).opacity = moon;
    this.stars.visible = moon > 0.02;
  }

  private setShadowBox(): void {
    const cam = this.sun.shadow.camera;
    const r = this.shadowR;
    if (cam.right === r) return;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
  }

  private lightBasis = new THREE.Matrix4();
  private tmpV = new THREE.Vector3();
  /**
   * Centres the shadow box on the player, snapped to whole shadow-map texels
   * so shadow edges stay still while you walk (no flicker).
   */
  followShadow(x: number, z: number): void {
    const texel = (this.shadowR * 2) / this.sun.shadow.mapSize.x;
    // Light-space axes.
    this.lightBasis.lookAt(this.lightDir, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
    const inv = this.lightBasis.clone().invert();
    const v = this.tmpV.set(x, 0, z).applyMatrix4(inv);
    v.x = Math.round(v.x / texel) * texel;
    v.y = Math.round(v.y / texel) * texel;
    v.applyMatrix4(this.lightBasis);
    this.sun.target.position.copy(v);
    this.sun.position.copy(v).addScaledVector(this.lightDir, 60);
    this.sun.target.updateMatrixWorld();
  }

  render(): void {
    if (this.quality === 'low') this.renderer.render(this.scene, this.camera);
    else this.composer.render();
  }
}

// ------------------------------------------------------------------ water

const waterUniforms: { uTime: { value: number } }[] = [];

/** Animated pool water with fake caustics and a fresnel sheen. */
export function waterMaterial(deep = '#0b6fa4', shallow = '#4fd8e8'): THREE.ShaderMaterial {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(deep) },
    uShallow: { value: new THREE.Color(shallow) },
  };
  waterUniforms.push(uniforms);
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      varying vec3 vView;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vView = cameraPosition - w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec3 vWorld;
      varying vec3 vView;
      float caustic(vec2 p) {
        float t = uTime * 0.6;
        vec2 i = p;
        float c = 1.0;
        float inten = 0.005;
        for (int n = 0; n < 4; n++) {
          float tt = t * (1.0 - (3.5 / float(n + 1)));
          i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
        }
        c /= 4.0;
        c = 1.17 - pow(c, 1.4);
        return pow(abs(c), 8.0);
      }
      void main() {
        vec2 p = vWorld.xz * 0.9;
        float c = caustic(mod(p, 6.2831) - 250.0);
        vec3 col = mix(uDeep, uShallow, 0.55 + 0.25 * sin(vWorld.x * 0.3 + uTime * 0.4));
        col += vec3(0.55, 0.8, 0.85) * c * 0.55;
        vec3 v = normalize(vView);
        float fres = pow(1.0 - max(v.y, 0.0), 3.0);
        col = mix(col, vec3(0.85, 0.95, 1.0), fres * 0.6);
        float ripple = sin(vWorld.x * 3.0 + uTime * 2.0) * sin(vWorld.z * 3.3 - uTime * 1.7);
        col += vec3(0.08) * smoothstep(0.7, 1.0, ripple);
        gl_FragColor = vec4(col, 0.82);
        #include <colorspace_fragment>
      }`,
  });
}

export function tickWater(t: number): void {
  for (const u of waterUniforms) u.uTime.value = t;
}

export function clearWater(): void {
  waterUniforms.length = 0;
}
