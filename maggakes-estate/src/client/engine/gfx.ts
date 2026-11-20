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
    const size = q === 'high' ? 4096 : q === 'medium' ? 2048 : 1024;
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
    const dpr = Math.min(devicePixelRatio, this.quality === 'high' ? 2 : this.quality === 'medium' ? 1.5 : 1);
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
    this.sun.position.copy(dir.clone().multiplyScalar(60));
    this.sun.target.position.set(0, 0, 0);
    const cam = this.sun.shadow.camera;
    const half = span / 2 + 4;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.near = 1; cam.far = 160;
    cam.updateProjectionMatrix();
    this.hemi.color.setHex(m.ambientSky);
    this.hemi.groundColor.setHex(m.ambientGround);
    this.hemi.intensity = m.ambient;
    this.renderer.toneMappingExposure = m.exposure;
    this.scene.fog = new THREE.FogExp2(m.fog, m.fogDensity);
    this.renderer.shadowMap.needsUpdate = true;
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
