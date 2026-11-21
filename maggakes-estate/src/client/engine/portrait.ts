import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Look } from '../../shared/look';
import { Avatar } from './avatar';

/**
 * A tiny photo studio: renders avatars to images for islander cards,
 * the host banner and the cast line-up.
 */
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const cache = new Map<string, string>();

function studio(): { r: THREE.WebGLRenderer; s: THREE.Scene } {
  if (!renderer || !scene) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xfff1e6, 2.2);
    key.position.set(1.5, 2.5, 3);
    const rim = new THREE.DirectionalLight(0xffc4dd, 1.4);
    rim.position.set(-2, 2, -2);
    scene.add(key, rim, new THREE.HemisphereLight(0xffffff, 0x8a6a7a, 0.7));
  }
  return { r: renderer, s: scene };
}

export function portrait(look: Look, mode: 'head' | 'full' = 'head', size = 256): string {
  const k = `${mode}|${size}|${JSON.stringify(look)}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const { r, s } = studio();
  r.setSize(size, size, false);
  const av = new Avatar(look);
  av.update(0.016, 1, 0, 'walk');
  s.add(av.root);
  const box = new THREE.Box3().setFromObject(av.root);
  const top = box.max.y;
  const cam = new THREE.PerspectiveCamera(mode === 'head' ? 22 : 30, 1, 0.05, 20);
  if (mode === 'head') { cam.position.set(0.25, top - 0.13, 1.25); cam.lookAt(0, top - 0.16, 0); }
  else { cam.position.set(0.6, top * 0.6, 4.1); cam.lookAt(0, top * 0.5, 0); }
  r.setClearColor(0x000000, 0);
  r.render(s, cam);
  const url = r.domElement.toDataURL('image/png');
  s.remove(av.root);
  av.dispose();
  cache.set(k, url);
  return url;
}

/** Debug: a group shot of several looks side by side. */
export function lineup(looks: Look[], w = 1400, h = 700): string {
  const { r, s } = studio();
  r.setSize(w, h, false);
  const avs = looks.map((l, i) => {
    const a = new Avatar(l);
    a.update(0.016, 1, 0, 'walk');
    a.root.position.x = (i - (looks.length - 1) / 2) * 0.62;
    s.add(a.root);
    return a;
  });
  const cam = new THREE.PerspectiveCamera(26, w / h, 0.05, 50);
  cam.position.set(0, 1.2, (looks.length * 0.62) / 0.9);
  cam.lookAt(0, 0.95, 0);
  r.setClearColor(0xf3e9ee, 1);
  r.render(s, cam);
  const url = r.domElement.toDataURL('image/png');
  for (const a of avs) { s.remove(a.root); a.dispose(); }
  return url;
}
