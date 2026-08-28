import * as THREE from "three";

/**
 * An athletic human figure, built rather than loaded.
 *
 * There is no model file here on purpose. A GLB of a body is several
 * megabytes before it is rigged, it has to be fetched before anything can be
 * drawn, and it would need a licence. This builds the same shape from about
 * sixty numbers, which ship in the bundle and cost nothing to load.
 *
 * The method is lofting: define the cross-section of the body at a series of
 * heights, then stitch consecutive sections into a surface. Every section is
 * a superellipse rather than a circle, because a torso is much wider than it
 * is deep and a circular ribcage reads instantly as a snowman.
 *
 * Proportions are the standard ~7.5-head canon, with the soft tissue set for
 * a trained body: shoulders around 1.6 times the waist, which is the V-taper
 * that makes a figure read as fit from a distance and in silhouette.
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

const RADIAL = 48;

/**
 * Stitch a stack of cross-sections into a closed surface.
 *
 * Rings are horizontal, which is a small lie on a limb that leans — but every
 * limb here is within a few degrees of vertical, and the alternative (framing
 * each ring to the path tangent) costs a lot of code for a difference no one
 * can see at this scale.
 */
export function loft(rings: Ring[], radial = RADIAL): THREE.BufferGeometry {
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
 * Read every number as a fraction of height.
 *
 * Proportions are measured off a reference silhouette of a lean athletic
 * male: eight heads tall, shoulders 0.118 of height at the half-width, waist
 * 0.076, and limbs far slimmer than they first look — a thigh is only about
 * 0.042 across at the half, and a bicep 0.026. The first pass at this was
 * built from memory and came out roughly half again too thick everywhere,
 * which reads as a heavyset man rather than a trained one. Bodies are
 * narrower than they feel.
 *
 * Depth runs about 0.68 of width through the torso, because a ribcage is an
 * ellipse on its side, and close to 1.0 in the limbs, which are round.
 */

const TORSO: Ring[] = [
  { c: [0, 0.440, 0], rx: 0.079, rz: 0.062, n: 2.4, front: 0.94 },
  { c: [0, 0.470, 0], rx: 0.084, rz: 0.066, n: 2.4, front: 0.92, back: 1.26 },
  { c: [0, 0.500, 0], rx: 0.085, rz: 0.068, n: 2.3, front: 0.92, back: 1.22 },  // hip and glutes
  { c: [0, 0.545, 0], rx: 0.078, rz: 0.062, n: 2.3, front: 0.92, back: 1.04 },
  { c: [0, 0.578, 0], rx: 0.075, rz: 0.060, n: 2.2, front: 0.92 },   // waist
  { c: [0, 0.618, 0], rx: 0.080, rz: 0.064, n: 2.2, front: 0.98 },
  { c: [0, 0.662, 0], rx: 0.092, rz: 0.071, n: 2.2, front: 1.02 },
  { c: [0, 0.706, 0], rx: 0.103, rz: 0.077, n: 2.1, front: 1.14, back: 1.06 },  // chest
  { c: [0, 0.752, 0], rx: 0.111, rz: 0.079, n: 2.1, front: 1.08, back: 1.10 },
  { c: [0, 0.790, 0], rx: 0.117, rz: 0.077, n: 2.1 },                // deltoids
  /* The slope from the point of the shoulder into the neck. Skipping
     straight from a 0.117 shoulder to a 0.043 neck built a body whose head
     sat between its ears; the trapezius needs these two rings to read. */
  { c: [0, 0.812, 0], rx: 0.104, rz: 0.070, n: 2.2 },
  { c: [0, 0.830, 0], rx: 0.070, rz: 0.058, n: 2.2 },
  { c: [0, 0.848, 0], rx: 0.045, rz: 0.044, n: 2.4 },                // neck
  { c: [0, 0.872, 0], rx: 0.041, rz: 0.041, n: 2.4 },
  { c: [0, 0.886, 0], rx: 0.042, rz: 0.042, n: 2.4 },
];

/**
 * One arm, hanging close with a slight outward bow.
 *
 * The top ring sits high and well inside the deltoid on purpose: it is buried
 * in the torso, so the flat cap that closes the loft never shows. An earlier
 * pass started the arm at the outer edge of the shoulder and the caps stuck
 * out as two hard-edged slabs hovering beside the ribs.
 *
 * Below that the arm is nearly vertical, drifting out by about 0.06 of height
 * over its length, with the fingertips finishing at mid-thigh. What makes it
 * readable in silhouette is not distance from the body but that its inner
 * edge clears the waist, which at these widths it does comfortably.
 *
 * Mirrored for the other side, so the halves cannot drift apart.
 */
function arm(side: 1 | -1): Ring[] {
  const x = (v: number) => side * v;
  return [
    /* The top ring must fit entirely inside the torso at this height, or the
       flat cap that closes the loft shows as a hard horizontal edge and the
       arm reads as a plank bolted to the shoulder. At y = 0.800 the torso is
       0.113 across at the half, so 0.070 + 0.044 = 0.114 just tucks under. */
    { c: [x(0.070), 0.800, 0], rx: 0.044, rz: 0.044 },
    { c: [x(0.086), 0.780, 0], rx: 0.038, rz: 0.039 },
    { c: [x(0.099), 0.750, 0.002], rx: 0.032, rz: 0.033 },
    { c: [x(0.108), 0.720, 0.004], rx: 0.029, rz: 0.030 },   // biceps
    { c: [x(0.116), 0.675, 0.008], rx: 0.025, rz: 0.026 },
    { c: [x(0.121), 0.636, 0.012], rx: 0.021, rz: 0.022 },   // elbow
    /* Forward through the forearm. A dead-straight arm hanging in a plane
       reads as a mannequin's; the slight bend is most of what makes it look
       like it belongs to someone standing. */
    { c: [x(0.125), 0.596, 0.016], rx: 0.023, rz: 0.024 },
    { c: [x(0.129), 0.542, 0.020], rx: 0.019, rz: 0.020 },
    { c: [x(0.131), 0.502, 0.023], rx: 0.014, rz: 0.016 },   // wrist
    { c: [x(0.133), 0.478, 0.026], rx: 0.018, rz: 0.023 },   // the hand
    { c: [x(0.133), 0.452, 0.028], rx: 0.015, rz: 0.020 },
    /* Tapered almost to nothing. A hand that stops at full width leaves the
       end cap facing the camera as a flat rectangular chip. */
    { c: [x(0.133), 0.436, 0.028], rx: 0.006, rz: 0.009 },
  ];
}

function leg(side: 1 | -1): Ring[] {
  const x = (v: number) => side * v;
  return [
    { c: [x(0.045), 0.478, 0], rx: 0.049, rz: 0.053 },   // buried in the pelvis
    { c: [x(0.047), 0.420, 0], rx: 0.045, rz: 0.049, front: 0.96 },
    { c: [x(0.049), 0.360, 0], rx: 0.041, rz: 0.045 },
    { c: [x(0.050), 0.310, 0], rx: 0.035, rz: 0.039 },
    { c: [x(0.050), 0.265, 0], rx: 0.029, rz: 0.032 },   // knee
    { c: [x(0.049), 0.222, 0], rx: 0.031, rz: 0.036, front: 0.86 },  // calf
    { c: [x(0.048), 0.170, 0], rx: 0.027, rz: 0.031, front: 0.86 },
    { c: [x(0.046), 0.105, 0], rx: 0.019, rz: 0.022 },
    { c: [x(0.045), 0.048, 0], rx: 0.015, rz: 0.017 },   // ankle
    { c: [x(0.046), 0.022, 0.012], rx: 0.019, rz: 0.038, n: 2.6 },
    { c: [x(0.047), 0.008, 0.020], rx: 0.018, rz: 0.046, n: 2.8 },
    { c: [x(0.047), 0.001, 0.022], rx: 0.013, rz: 0.036, n: 2.8 },   // sole
  ];
}

/**
 * The whole figure as one merged geometry.
 *
 * Merged rather than kept as a group of meshes so the whole thing is a single
 * draw call, and so the material and any post-processing treat it as one
 * object. The parts interpenetrate at the shoulder and hip; those seams are
 * inside the surface and never visible.
 */
export function buildBody(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    loft(TORSO),
    loft(arm(1)), loft(arm(-1)),
    loft(leg(1)), loft(leg(-1)),
  ];

  /* Eight heads tall, so the skull is 0.125 of the figure and its radius
     about 0.058. Slightly narrow, slightly deep — a head is an egg, not a
     ball — and a shallower cap sat on top for hair, which is what stops the
     silhouette reading as a mannequin. */
  const skull = new THREE.SphereGeometry(0.058, 32, 24);
  skull.scale(0.84, 1.08, 0.94);
  skull.translate(0, 0.934, 0.004);
  parts.push(skull);

  const hair = new THREE.SphereGeometry(0.0595, 32, 20);
  hair.scale(0.88, 0.66, 0.97);
  hair.translate(0, 0.958, -0.003);
  parts.push(hair);

  const merged = mergeGeometries(parts);
  // Centre on the origin so it rotates about its own axis, not its feet.
  merged.translate(0, -0.5, 0);
  merged.computeVertexNormals();
  return merged;
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
