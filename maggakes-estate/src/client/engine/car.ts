import * as THREE from 'three';
import { box, cyl, glow, mat, rbox, sph, glass, CHROME, BLACKMETAL } from './props';

export interface CarModel {
  obj: THREE.Group;
  wheels: THREE.Object3D[];
  front: THREE.Object3D[];
  /** Seat height for the driver. */
  seat: number;
  length: number;
}

interface Spec { l: number; w: number; h: number; cab: number; cabL: number; cabZ: number; open?: boolean; wheel: number; seat: number; spoiler?: boolean; low?: number }

const SPECS: Record<string, Spec> = {
  hatch: { l: 3.7, w: 1.75, h: 0.7, cab: 0.6, cabL: 2.0, cabZ: -0.2, wheel: 0.32, seat: 0.45 },
  buggy: { l: 2.6, w: 1.3, h: 0.45, cab: 0, cabL: 0, cabZ: 0, open: true, wheel: 0.25, seat: 0.4 },
  convertible: { l: 4.3, w: 1.85, h: 0.62, cab: 0, cabL: 0, cabZ: 0, open: true, wheel: 0.34, seat: 0.4 },
  suv: { l: 4.8, w: 2.0, h: 0.95, cab: 0.75, cabL: 2.9, cabZ: -0.3, wheel: 0.42, seat: 0.75 },
  sports: { l: 4.4, w: 1.9, h: 0.55, cab: 0.45, cabL: 1.8, cabZ: -0.15, wheel: 0.34, seat: 0.3, spoiler: true, low: 0.18 },
  super: { l: 4.6, w: 2.0, h: 0.5, cab: 0.42, cabL: 1.6, cabZ: 0.1, wheel: 0.35, seat: 0.28, spoiler: true, low: 0.16 },
  limo: { l: 6.6, w: 2.0, h: 0.75, cab: 0.6, cabL: 4.6, cabZ: -0.3, wheel: 0.38, seat: 0.5 },
};

export function buildCar(model: string, paint: string): CarModel {
  const s = SPECS[model] ?? SPECS.hatch;
  const g = new THREE.Group();
  const paintM = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.25, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.05 });
  const lowY = s.low ?? 0.22;
  rbox(g, s.w, s.h, s.l, paintM, 0, lowY, 0, 0.18);
  if (!s.open && s.cab > 0) {
    rbox(g, s.w * 0.86, s.cab, s.cabL, glass('#2a3440', 0.75), 0, lowY + s.h - 0.05, s.cabZ, 0.2);
    rbox(g, s.w * 0.88, 0.06, s.cabL * 0.9, paintM, 0, lowY + s.h + s.cab - 0.08, s.cabZ, 0.03);
  } else {
    box(g, s.w * 0.8, 0.35, 0.05, glass('#cfe9ff', 0.4), 0, lowY + s.h, s.l * 0.12);
    for (const x of [-0.4, 0.4]) {
      rbox(g, 0.55, 0.15, 0.55, mat('#f5efe6', 0.8), x * (s.w / 1.8), lowY + s.h - 0.15, -0.15, 0.06);
      rbox(g, 0.55, 0.55, 0.12, mat('#f5efe6', 0.8), x * (s.w / 1.8), lowY + s.h - 0.1, -0.45, 0.05);
    }
    if (model === 'buggy') {
      for (const [x, z] of [[-0.55, 0.5], [0.55, 0.5], [-0.55, -0.9], [0.55, -0.9]]) cyl(g, 0.03, 0.03, 1.3, CHROME(), x, lowY + s.h, z, 8);
      rbox(g, 1.35, 0.06, 1.7, mat('#ffffff', 0.5), 0, lowY + s.h + 1.3, -0.2, 0.03);
    }
  }
  if (s.spoiler) {
    box(g, s.w * 0.9, 0.05, 0.3, BLACKMETAL(), 0, lowY + s.h + 0.25, -s.l / 2 + 0.2);
    for (const x of [-0.5, 0.5]) box(g, 0.05, 0.25, 0.1, BLACKMETAL(), x, lowY + s.h, -s.l / 2 + 0.2);
  }
  // lights
  for (const x of [-s.w / 2 + 0.3, s.w / 2 - 0.3]) {
    const hl = box(g, 0.35, 0.1, 0.04, glow('#fff8e0', 2.5), x, lowY + s.h * 0.55, s.l / 2 - 0.01);
    hl.castShadow = false;
    const tl = box(g, 0.35, 0.08, 0.04, glow('#ff2030', 2), x, lowY + s.h * 0.6, -s.l / 2 + 0.01);
    tl.castShadow = false;
  }
  box(g, s.w * 0.5, 0.14, 0.03, mat('#222', 0.4, 0.6), 0, lowY + 0.1, s.l / 2);
  // steering wheel
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 20), mat('#222', 0.5));
  sw.position.set(-s.w * 0.22, lowY + s.h + 0.12, s.open ? 0.35 : s.cabZ + s.cabL * 0.25);
  sw.rotation.x = -0.9;
  g.add(sw);

  const wheels: THREE.Object3D[] = [];
  const front: THREE.Object3D[] = [];
  const tyre = mat('#141414', 0.85);
  const rim = mat(model === 'limo' || model === 'super' ? '#d8b45a' : '#cfd4da', 0.2, 1);
  const wz = s.l / 2 - s.wheel - 0.35;
  for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x * (s.w / 2 - 0.08), s.wheel, z * wz);
    const spin = new THREE.Group();
    pivot.add(spin);
    const t = cyl(spin, s.wheel, s.wheel, 0.26, tyre, 0, -0.13, 0, 24);
    t.rotation.z = Math.PI / 2; t.position.set(0, 0, 0);
    const r = cyl(spin, s.wheel * 0.6, s.wheel * 0.6, 0.27, rim, 0, -0.135, 0, 12);
    r.rotation.z = Math.PI / 2; r.position.set(x * 0.005, 0, 0);
    sph(spin, 0.06, rim, x * 0.14, 0, 0);
    g.add(pivot);
    wheels.push(spin);
    if (z > 0) front.push(pivot);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { obj: g, wheels, front, seat: lowY + s.seat, length: s.l };
}

/** Simple arcade driving. */
export class Driving {
  speed = 0;
  steer = 0;
  update(dt: number, throttle: number, turn: number, boost: boolean): void {
    const max = boost ? 22 : 14;
    const accel = throttle > 0 ? 9 : throttle < 0 ? 12 : 0;
    if (throttle !== 0) this.speed += throttle * accel * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 6 * dt);
    this.speed = Math.max(-6, Math.min(max, this.speed));
    this.steer += (turn - this.steer) * Math.min(1, dt * 8);
  }
}
