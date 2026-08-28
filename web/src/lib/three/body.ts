import * as THREE from "three";
import type { Physique } from "@/lib/fitness/physique";
import { cavity, relief } from "./muscles";

/**
 * A human figure, built rather than loaded.
 *
 * There is no model file here on purpose. A rigged GLB of a body is several
 * megabytes before it is textured, it has to be fetched before anything can
 * be drawn, and it would need a licence. More to the point, a fixed model
 * cannot do the one thing this app needs: change shape as the person does.
 *
 * The method is lofting. Define the cross-section of the body at a series of
 * heights, resample those sections into a dense smooth stack, stitch them
 * into a surface, then push every vertex out along its own normal by the
 * muscle and fat relief at that point. Every section is a superellipse rather
 * than a circle, because a torso is much wider than it is deep and a circular
 * ribcage reads instantly as a snowman.
 *
 * Both stages are driven by the person's own composition. The widths come
 * from `physiqueOf`, and so does the relief — so the body on screen at 26%
 * body fat is not merely a wider version of the body at 14%, it is a
 * different shape with the muscle buried instead of showing.
 */

export interface Ring {
  /** Centre of the section. */
  c: [number, number, number];
  /** Half-width (side to side) and half-depth (front to back). */
  rx: number;
  rz: number;
  /** Pushes the front of the section forward — pectorals, quadriceps, shins. */
  front?: number;
  /** Pushes the back out — buttocks, calves, the curve of the upper back. */
  back?: number;
  /** Squareness of the section. 2 is an ellipse; higher is flatter-sided. */
  n?: number;
}

/* Dense enough that the muscle relief has something to displace. At 48
   segments the pectorals came out as two facets. */
/** How far the finished mesh is dropped so it turns about its middle. */
const CENTRE_OFFSET = 0.5;

const RADIAL = 112;
/** Cross-sections after resampling. The hand-written rings are far fewer. */
const ROWS = 190;

/**
 * Stitch a stack of cross-sections into a closed surface.
 *
 * Rings are horizontal, which is a small lie on a limb that leans — but every
 * limb here is within a few degrees of vertical, and the alternative (framing
 * each ring to the path tangent) costs a lot of code for a difference no one
 * can see at this scale.
 */
/**
 * Smooth a hand-written stack of rings into a dense one.
 *
 * Catmull-Rom through every channel. Straight linear interpolation between
 * the authored rings leaves a visible crease at each one — the surface is
 * continuous but its slope is not, and raking light across it shows every
 * seam as a hard band.
 */
function resample(rings: Ring[], rows: number): Ring[] {
  const at = (i: number) => rings[Math.max(0, Math.min(rings.length - 1, i))];

  /* Catmull-Rom, clamped to the segment it is interpolating.
   *
   * Unclamped it overshoots wherever two neighbouring sections differ sharply
   * — and they do, at the neck, where depth jumps from 0.92 of width to 1.30,
   * and at the foot, where it goes to 3.1. The overshoot showed as horizontal
   * bands ringing the torso like a tyre. Clamping keeps the curve smooth and
   * stops it inventing bulges that no control point asked for. */
  const cr = (a: number, b: number, c: number, d: number, t: number) => {
    const t2 = t * t, t3 = t2 * t;
    const v = 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    const lo = Math.min(b, c), hi = Math.max(b, c);
    return v < lo ? lo : v > hi ? hi : v;
  };

  const out: Ring[] = [];
  const span = rings.length - 1;

  for (let r = 0; r < rows; r++) {
    const u = (r / (rows - 1)) * span;
    const i = Math.min(Math.floor(u), span - 1);
    const t = u - i;
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);

    const ch = (pick: (x: Ring) => number) =>
      cr(pick(p0), pick(p1), pick(p2), pick(p3), t);

    out.push({
      c: [ch((x) => x.c[0]), ch((x) => x.c[1]), ch((x) => x.c[2])],
      rx: Math.max(0.001, ch((x) => x.rx)),
      rz: Math.max(0.001, ch((x) => x.rz)),
      front: ch((x) => x.front ?? 1),
      back: ch((x) => x.back ?? 1),
      n: ch((x) => x.n ?? 2.3),
    });
  }
  return out;
}

export function loft(input: Ring[], radial = RADIAL, rows = ROWS): THREE.BufferGeometry {
  const rings = resample(input, rows);
  const positions: number[] = [];
  const indices: number[] = [];

  for (const ring of rings) {
    const [cx, cy, cz] = ring.c;
    const n = ring.n ?? 2.3;
    const front = ring.front ?? 1;
    const back = ring.back ?? 1;
    const p = 2 / n;

    for (let i = 0; i < radial; i++) {
      const t = (i / radial) * Math.PI * 2;
      const ct = Math.cos(t), st = Math.sin(t);

      // Superellipse. The sign/abs dance keeps all four quadrants.
      const sx = Math.sign(ct) * Math.pow(Math.abs(ct), p);
      const sz = Math.sign(st) * Math.pow(Math.abs(st), p);

      /* Front and back are scaled independently, so a chest can come forward
         without dragging the spine with it. This asymmetry is what makes the
         rotation legible: a body that is the same shape front and back reads
         as a stationary column no matter how fast it spins. */
      const depth = ring.rz * (sz > 0 ? front : back);

      positions.push(cx + ring.rx * sx, cy, cz + depth * sz);
    }
  }

  for (let s = 0; s < rings.length - 1; s++) {
    const a = s * radial;
    const b = (s + 1) * radial;
    for (let i = 0; i < radial; i++) {
      const j = (i + 1) % radial;
      indices.push(a + i, b + i, a + j);
      indices.push(a + j, b + i, b + j);
    }
  }

  // Caps, so the shape is closed and shades correctly at the ends.
  const capStart = positions.length / 3;
  const first = rings[0], last = rings[rings.length - 1];
  positions.push(...first.c);
  positions.push(...last.c);
  const topIdx = capStart, botIdx = capStart + 1;
  const lastRing = (rings.length - 1) * radial;
  for (let i = 0; i < radial; i++) {
    const j = (i + 1) % radial;
    indices.push(topIdx, i, j);
    indices.push(botIdx, lastRing + j, lastRing + i);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/*
 * The body, in a space where the figure is 1.0 tall with its feet at y = 0.
 *
 * Nothing here is an absolute width. Each cross-section names the measurement
 * that drives it and a factor — so `["shoulder", 1.0]` at y 0.790 is the
 * widest point of the deltoids, and it moves whenever the person's lean mass
 * does. That indirection is the whole reason the figure can change with the
 * diary instead of being redrawn by hand.
 *
 * Landmark heights are the eight-head canon measured off a reference
 * silhouette: shoulder at 0.79, waist at 0.578, crotch at 0.44, knee at
 * 0.265. Those are skeletal and do not move; only the widths do.
 */

type Key = "neck" | "shoulder" | "chest" | "waist" | "hip"
         | "thigh" | "knee" | "calf" | "ankle" | "upperArm" | "forearm";

interface Section {
  /** Height up the figure. */
  y: number;
  /** Which measurement drives this section, and by how much. */
  w: [Key, number];
  /** Sideways offset, as a factor of the same measurement. 0 is centred. */
  x?: [Key, number];
  /** Depth as a factor of the figure's overall depth ratio. */
  d?: number;
  /**
   * Push outboard far enough to clear the torso.
   *
   * Arm offsets are a factor of shoulder width, but the waist grows with fat
   * about nine times faster than the shoulder does — so on a heavier body the
   * forearm ends up inside the flank and the arms disappear into the ribs.
   * This holds a gap open whatever the composition.
   */
  clear?: boolean;
  z?: number;
  front?: number;
  back?: number;
  n?: number;
}

const TORSO: Section[] = [
  /* The torso stops at the crotch, narrow enough to be hidden between the
     thighs. Two earlier versions got this wrong in opposite directions: one
     ended square at the hip and its flat cap showed as a bright rectangular
     panel, and the next tapered but ran 40 mm too far down, so the tail of it
     poked out between the legs. */
  { y: 0.434, w: ["hip", 0.40], d: 0.88, n: 2.0 },
  { y: 0.452, w: ["hip", 0.70], d: 0.92, n: 2.1 },
  { y: 0.470, w: ["hip", 0.94], d: 0.97, n: 2.2, back: 1.16 },
  { y: 0.500, w: ["hip", 1.00], d: 1.00, n: 2.15, back: 1.14 },
  { y: 0.545, w: ["waist", 1.05], d: 1.00, n: 2.15, back: 1.04 },
  { y: 0.578, w: ["waist", 1.00], d: 1.00, n: 2.1 },
  { y: 0.618, w: ["waist", 1.07], d: 1.01, n: 2.1 },
  { y: 0.662, w: ["chest", 0.92], d: 1.03, n: 2.1 },
  { y: 0.706, w: ["chest", 1.00], d: 1.06, n: 2.1 },
  { y: 0.752, w: ["chest", 1.08], d: 1.05, n: 2.1 },
  { y: 0.790, w: ["shoulder", 1.00], d: 0.95, n: 2.1 },
  { y: 0.812, w: ["shoulder", 0.89], d: 0.91, n: 2.2 },
  { y: 0.830, w: ["shoulder", 0.60], d: 0.95, n: 2.2 },
  { y: 0.848, w: ["neck", 1.00], d: 1.18, n: 2.4 },
  { y: 0.872, w: ["neck", 0.92], d: 1.22, n: 2.4 },
  { y: 0.886, w: ["neck", 0.94], d: 1.22, n: 2.4 },
];

/*
 * Note on `front` and `back`.
 *
 * These used to vary section by section to shape the chest and the glutes,
 * and it was a mistake: each control point put a ridge across the body at its
 * own height, and the abdomen came out banded like a tyre. Depth profiles
 * want to be almost flat. Chest projection, buttocks and belly are all shaped
 * by the relief fields instead, which blend in three dimensions and leave no
 * horizon where one section ends and the next begins.
 */

/**
 * One arm, hanging close with a slight outward bow and a forward elbow.
 *
 * The top section must fit entirely inside the torso at its height, or the
 * flat cap that closes the loft shows as a hard horizontal edge and the arm
 * reads as a plank bolted to the ribs. Offsets are factors of shoulder width,
 * so a broader person's arms hang wider without any of this being re-tuned.
 */
const ARM: Section[] = [
  { y: 0.800, w: ["upperArm", 1.62], x: ["shoulder", 0.60], d: 1.5 },
  { y: 0.780, w: ["upperArm", 1.42], x: ["shoulder", 0.74], d: 1.5 },
  { y: 0.750, w: ["upperArm", 1.20], x: ["shoulder", 0.85], d: 1.5, z: 0.002 },
  { y: 0.720, w: ["upperArm", 1.10], x: ["shoulder", 0.92], d: 1.5, z: 0.004 },
  { clear: true, y: 0.675, w: ["upperArm", 0.95], x: ["shoulder", 0.99], d: 1.5, z: 0.008 },
  { clear: true, y: 0.636, w: ["upperArm", 0.80], x: ["shoulder", 1.03], d: 1.5, z: 0.012 },
  { clear: true, y: 0.596, w: ["forearm", 1.10], x: ["shoulder", 1.07], d: 1.5, z: 0.016 },
  { clear: true, y: 0.542, w: ["forearm", 0.90], x: ["shoulder", 1.10], d: 1.5, z: 0.020 },
  { clear: true, y: 0.502, w: ["forearm", 0.67], x: ["shoulder", 1.12], d: 1.5, z: 0.023 },
  { clear: true, y: 0.478, w: ["forearm", 0.86], x: ["shoulder", 1.13], d: 1.6, z: 0.026 },
  { clear: true, y: 0.452, w: ["forearm", 0.71], x: ["shoulder", 1.13], d: 1.6, z: 0.028 },
  { clear: true, y: 0.436, w: ["forearm", 0.29], x: ["shoulder", 1.13], d: 1.6, z: 0.028 },
];

const LEG: Section[] = [
  { y: 0.478, w: ["thigh", 1.10], x: ["hip", 0.50], d: 1.10 },
  { y: 0.420, w: ["thigh", 1.04], x: ["hip", 0.52], d: 1.10, front: 0.96 },
  { y: 0.360, w: ["thigh", 0.98], x: ["hip", 0.58], d: 1.10 },
  { y: 0.310, w: ["thigh", 0.83], x: ["hip", 0.59], d: 1.12 },
  { y: 0.265, w: ["knee", 1.00], x: ["hip", 0.59], d: 1.12 },
  { y: 0.222, w: ["calf", 1.03], x: ["hip", 0.58], d: 1.16, front: 0.86 },
  { y: 0.170, w: ["calf", 0.90], x: ["hip", 0.57], d: 1.16, front: 0.86 },
  { y: 0.105, w: ["calf", 0.63], x: ["hip", 0.54], d: 1.16 },
  { y: 0.048, w: ["ankle", 1.00], x: ["hip", 0.53], d: 1.13 },
  { y: 0.022, w: ["ankle", 1.27], x: ["hip", 0.54], d: 2.6, z: 0.012, n: 2.6 },
  { y: 0.008, w: ["ankle", 1.20], x: ["hip", 0.55], d: 3.1, z: 0.020, n: 2.8 },
  { y: 0.001, w: ["ankle", 0.87], x: ["hip", 0.55], d: 2.7, z: 0.022, n: 2.8 },
];

/** Turn a table of sections into rings, at this person's measurements. */
/**
 * Landmark heights differ between the sexes, and not by a little.
 *
 * A woman's torso is shorter for her height and her waist sits higher — the
 * gap between the bottom rib and the iliac crest is larger, which is most of
 * what makes the waist read as a waist. Scaling a male figure down produces
 * something that is unmistakably a small man, which is what every parametric
 * body gets wrong when it treats sex as a set of width multipliers.
 *
 * These shift the y of each section, leaving the widths to `physiqueOf`.
 */
function shiftForSex(sections: Section[], p: Physique): Section[] {
  if (p.sex === "male") return sections;
  return sections.map((s) => {
    let y = s.y;
    // Waist up by ~1.5% of stature, shoulders and chest down slightly.
    if (y > 0.50 && y < 0.70) y += 0.016;
    else if (y >= 0.70 && y < 0.80) y -= 0.004;
    else if (y >= 0.80) y -= 0.010;
    return { ...s, y };
  });
}

function rings(sections: Section[], p: Physique, side: 1 | -1 = 1): Ring[] {
  return shiftForSex(sections, p).map((s) => {
    const rx = p.w[s.w[0]] * s.w[1];
    let offset = s.x ? p.w[s.x[0]] * s.x[1] : 0;
    if (s.clear) {
      // The widest the torso gets here, plus the arm's own radius, plus air.
      offset = Math.max(offset, Math.max(p.w.waist, p.w.hip) * 1.04 + rx + 0.006);
    }
    const cx = s.x ? side * offset : 0;
    return {
      c: [cx, s.y, s.z ?? 0],
      rx,
      rz: rx * p.depth * (s.d ?? 1),
      front: s.front,
      back: s.back,
      n: s.n,
    };
  });
}

/**
 * The whole figure as one merged geometry, at this composition.
 *
 * Merged rather than kept as a group of meshes so the whole thing is a single
 * draw call and the relief pass can treat it as one surface. The parts
 * interpenetrate at the shoulder and hip; those seams are inside the volume
 * and never visible.
 */
export function buildBody(p: Physique): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    loft(rings(TORSO, p)),
    loft(rings(ARM, p, 1)), loft(rings(ARM, p, -1)),
    loft(rings(LEG, p, 1)), loft(rings(LEG, p, -1)),
  ];

  /* Eight heads tall, so the skull is 0.125 of the figure. A head is an egg
     rather than a ball, and the shallower cap on top is hair — which is most
     of what stops a silhouette reading as a mannequin. */
  const skull = new THREE.SphereGeometry(0.058, 64, 48);
  skull.scale(0.84, 1.08, 0.94);
  skull.translate(0, 0.934, 0.004);
  parts.push(skull);

  const hair = new THREE.SphereGeometry(0.0595, 64, 32);
  hair.scale(0.88, 0.66, 0.97);
  hair.translate(0, 0.958, -0.003);
  parts.push(hair);

  /* Breast tissue is mostly fat, so its size tracks adiposity and its
     position tracks the chest — it is not a fixed shape stamped on every
     female figure. Added as geometry rather than as surface relief because at
     any real size it changes the silhouette, and relief only changes shading. */
  if (p.sex === "female") {
    const chest = p.w.chest;
    const r = chest * (0.34 + 0.20 * p.adiposity);
    for (const side of [1, -1] as const) {
      const breast = new THREE.SphereGeometry(r, 40, 28);
      breast.scale(1.0, 0.94, 1.15);
      breast.translate(side * chest * 0.44, 0.700, chest * p.depth * 0.62);
      parts.push(breast);
    }
  }

  const merged = mergeGeometries(parts);
  merged.computeVertexNormals();
  applyRelief(merged, p);

  // Centre on the origin so it turns about its own axis, not its feet.
  merged.translate(0, -CENTRE_OFFSET, 0);
  return merged;
}

/**
 * Push every vertex out along its normal by the muscle and fat relief there.
 *
 * Done on the CPU at build time rather than in a vertex shader, because it
 * runs once per composition change — at most daily — and doing it here means
 * the normals can be recomputed from the displaced surface. A shader would
 * have to fake them, and the lighting is most of what sells the anatomy.
 */
function applyRelief(g: THREE.BufferGeometry, p: Physique): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const shade = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);

    const d = relief(x, y, z, nx, ny, nz, p);
    if (d !== 0) pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);

    /* Cavity shading, baked into vertex colour. Sampled at the original
       position, before displacement — the field is defined on the base
       surface, and asking it about a point it has already moved gives the
       occlusion of somewhere the body no longer is. */
    const ao = cavity(x, y, z, nx, ny, nz, p);
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = ao;
  }

  pos.needsUpdate = true;
  g.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  // Recomputed from the displaced surface, so the relief catches the light.
  g.computeVertexNormals();
}

/**
 * Is this point buried inside the torso?
 *
 * The arms and legs are separate lofts pushed into the torso so their end caps
 * are hidden — which works for a solid surface, where the buried geometry is
 * simply never seen. It does not work for additively blended dust: those
 * interior surfaces are inside the volume, nothing occludes them, and their
 * motes pile onto the ones in front. The result was a bright cap glowing on
 * each deltoid and hip, exactly where the parts overlap.
 *
 * So the sampler is given this, and skips anything inside the torso. It
 * rebuilds the torso's cross-section at the point's height and tests the
 * superellipse — the same shape the loft drew, so the test agrees with the
 * geometry by construction rather than by a tuned fudge factor.
 *
 * The 2% inset keeps the torso's *own* surface points, which sit exactly on
 * the boundary, from culling themselves.
 */
export function torsoContainment(p: Physique): (x: number, y: number, z: number) => boolean {
  const sections = resample(rings(TORSO, p), ROWS);
  const lo = sections[0].c[1];
  const hi = sections[sections.length - 1].c[1];

  return (x, rawY, z) => {
    /* The section tables describe a figure standing on y = 0, but `buildBody`
       centres the finished mesh on the origin — so points arrive here half a
       body-height low. Testing them without this offset culls the wrong half
       of the figure, silently. */
    const y = rawY + CENTRE_OFFSET;
    if (y < lo || y > hi) return false;

    /* Find the two sections bracketing this height.
     *
     * Not by dividing the range — resampling interpolates by *index*, and the
     * authored rings are not evenly spaced in y, so the stack is denser
     * wherever the body changes shape fastest. Assuming even spacing looked up
     * the wrong cross-section by as much as several centimetres, which culled
     * whole regions of dust that were never buried at all. */
    let i = 0;
    let step = sections.length >> 1;
    while (step > 0) {
      while (i + step < sections.length - 1 && sections[i + step].c[1] <= y) i += step;
      step >>= 1;
    }
    const a = sections[i];
    const b = sections[Math.min(i + 1, sections.length - 1)];
    const span = b.c[1] - a.c[1];
    const f = span > 1e-6 ? (y - a.c[1]) / span : 0;

    const rx = (a.rx + (b.rx - a.rx) * f) * 0.98;
    const rz = (a.rz + (b.rz - a.rz) * f) * 0.98;
    const n = (a.n ?? 2.3) + ((b.n ?? 2.3) - (a.n ?? 2.3)) * f;
    const front = (a.front ?? 1) + ((b.front ?? 1) - (a.front ?? 1)) * f;
    const back = (a.back ?? 1) + ((b.back ?? 1) - (a.back ?? 1)) * f;

    const depth = rz * (z > 0 ? front : back);
    // Superellipse test: |x/rx|^n + |z/rz|^n < 1 is inside.
    return Math.pow(Math.abs(x / rx), n) + Math.pow(Math.abs(z / depth), n) < 1;
  };
}

/** three's BufferGeometryUtils lives in examples; this is the only bit needed. */
function mergeGeometries(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const g of list) {
    const pos = g.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    const idx = g.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    }
    offset += pos.count;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setIndex(indices);
  return out;
}
