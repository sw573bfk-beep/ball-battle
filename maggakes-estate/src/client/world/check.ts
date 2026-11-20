import { buildZone } from './build';
import { ALL_ZONES } from '../../shared/floors';
import { LAYOUTS } from './layouts';

/** Debug check: every room, door and station must be reachable on foot. */
export function checkZones(): string[] {
  const problems: string[] = [];
  for (const id of ALL_ZONES) {
    const z = buildZone(id);
    const L = LAYOUTS[id];
    const R = 0.3, step = 0.25;
    const ox = -L.w / 2, oz = -L.d / 2;
    const free = (x: number, zz: number) => {
      if (Math.abs(x) > L.w / 2 - R || Math.abs(zz) > L.d / 2 - R) return false;
      if (!z.rooms.some((r) => x >= r.box.x0 && x < r.box.x1 && zz >= r.box.z0 && zz < r.box.z1)) return false;
      for (const c of z.colliders) if (x + R > c.x0 && x - R < c.x1 && zz + R > c.z0 && zz - R < c.z1) return false;
      return true;
    };
    const nx = Math.ceil(L.w / step), nz = Math.ceil(L.d / step);
    const seen = new Uint8Array(nx * nz);
    const lx = z.lift.x + Math.sin(z.lift.rot) * 1.8, lz = z.lift.z + Math.cos(z.lift.rot) * 1.8;
    const toI = (x: number, zz: number) => [Math.floor((x - ox) / step), Math.floor((zz - oz) / step)];
    const [si, sj] = toI(lx, lz);
    if (!free(lx, lz)) problems.push(`${id}: lift exit is blocked`);
    const q: [number, number][] = [[si, sj]];
    seen[sj * nx + si] = 1;
    while (q.length) {
      const [i, j] = q.pop()!;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a]) continue;
        if (!free(ox + (a + 0.5) * step, oz + (b + 0.5) * step)) continue;
        seen[b * nx + a] = 1;
        q.push([a, b]);
      }
    }
    const reached = (x: number, zz: number, r: number) => {
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        if (seen[j * nx + i] && Math.hypot(ox + (i + 0.5) * step - x, oz + (j + 0.5) * step - zz) < r) return true;
      }
      return false;
    };
    for (const s of z.stations) if (!reached(s.wx, s.wz, 1.3)) problems.push(`${id}: station ${s.kind}${s.id ? ':' + s.id : ''} unreachable`);
    for (const r of z.rooms) {
      let ok = false;
      for (let j = 0; j < nz && !ok; j++) for (let i = 0; i < nx && !ok; i++) {
        const x = ox + (i + 0.5) * step, zz = oz + (j + 0.5) * step;
        if (seen[j * nx + i] && x >= r.box.x0 && x < r.box.x1 && zz >= r.box.z0 && zz < r.box.z1) ok = true;
      }
      if (!ok) problems.push(`${id}: room ${r.id} unreachable`);
    }
    for (const [dx, dz] of L.doors) if (!free(dx + ox, dz + oz) && !free(dx + ox + 0.3, dz + oz) && !free(dx + ox, dz + oz + 0.3)) problems.push(`${id}: door at ${dx},${dz} blocked`);
  }
  return problems;
}

/** Debug: colliders within r of a floor-plan point. */
export function near(id: (typeof ALL_ZONES)[number], px: number, pz: number, r = 1.5): string[] {
  const z = buildZone(id);
  const L = LAYOUTS[id];
  const x = px - L.w / 2, zz = pz - L.d / 2;
  return z.colliders.filter((c) => x + r > c.x0 && x - r < c.x1 && zz + r > c.z0 && zz - r < c.z1)
    .map((c) => `${(c.x0 + L.w / 2).toFixed(2)},${(c.z0 + L.d / 2).toFixed(2)} → ${(c.x1 + L.w / 2).toFixed(2)},${(c.z1 + L.d / 2).toFixed(2)}`);
}
