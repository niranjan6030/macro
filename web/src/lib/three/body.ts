import * as THREE from "three";
import type { Physique } from "@/lib/fitness/physique";
import { cavity, relief, type LimbCentres } from "./muscles";

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
   * Keep this section outboard enough to stay visible against the torso.
   *
   * Arm offsets are a factor of shoulder width, but the waist grows with fat
   * about nine times faster than the shoulder does — so on a heavier body the
   * forearm ends up inside the flank and the arms disappear into the ribs.
   */
  clear?: boolean;
  /** Apply the elbow's carrying angle below this point. Arms only. */
  carry?: boolean;
  z?: number;
  front?: number;
  back?: number;
  n?: number;
}

/*
 * The sagittal curve.
 *
 * A spine is an S, not a pole, and this was the single least accurate thing
 * about the figure: seen from the side it was a straight column, which reads
 * as a shop mannequin however good the front view is. Since the whole thing
 * turns as you scroll, the side is on screen as often as the front.
 *
 * These are `z` offsets of the *centre* of each cross-section, forward
 * positive, as a fraction of stature. They follow standing posture, where a
 * plumb line falls through the ear, the shoulder, the greater trochanter and
 * just in front of the ankle:
 *
 *   sacrum      back, and the buttocks project behind it
 *   lumbar L3   forward — the lordosis, the hollow of the lower back
 *   thoracic T7 back — the kyphosis, the roundness of the upper back
 *   cervical    forward again, carrying the head over the shoulders
 *
 * Applied to the centre line, so the front and back surfaces both move; the
 * chest and belly are shaped separately by `front` and by the relief fields.
 */
const TORSO: Section[] = [
  /* The torso stops at the crotch, narrow enough to be hidden between the
     thighs. Two earlier versions got this wrong in opposite directions: one
     ended square at the hip and its flat cap showed as a bright rectangular
     panel, and the next tapered but ran 40 mm too far down, so the tail of it
     poked out between the legs. */
  { y: 0.434, w: ["hip", 0.40], d: 0.88, n: 2.0, z: -0.004 },
  { y: 0.452, w: ["hip", 0.70], d: 0.92, n: 2.1, z: -0.006 },
  { y: 0.470, w: ["hip", 0.94], d: 0.97, n: 2.2, back: 1.16, z: -0.005 },   // sacrum
  { y: 0.500, w: ["hip", 1.00], d: 1.00, n: 2.15, back: 1.14, z: 0.000 },
  { y: 0.545, w: ["waist", 1.05], d: 1.00, n: 2.15, back: 1.04, z: 0.006 },
  { y: 0.578, w: ["waist", 1.00], d: 1.00, n: 2.1, z: 0.010 },              // lumbar apex
  { y: 0.618, w: ["waist", 1.07], d: 1.01, n: 2.1, z: 0.004 },
  { y: 0.662, w: ["chest", 0.92], d: 1.03, n: 2.1, z: -0.004 },
  { y: 0.706, w: ["chest", 1.00], d: 1.06, n: 2.1, z: -0.010 },             // thoracic apex
  { y: 0.752, w: ["chest", 1.08], d: 1.05, n: 2.1, z: -0.009 },
  { y: 0.790, w: ["shoulder", 1.00], d: 0.95, n: 2.1, z: -0.006 },
  { y: 0.812, w: ["shoulder", 0.89], d: 0.91, n: 2.2, z: -0.003 },
  { y: 0.830, w: ["shoulder", 0.60], d: 0.95, n: 2.2, z: 0.001 },
  { y: 0.848, w: ["neck", 1.00], d: 1.18, n: 2.4, z: 0.004 },               // cervical
  { y: 0.872, w: ["neck", 0.92], d: 1.22, n: 2.4, z: 0.007 },
  { y: 0.886, w: ["neck", 0.94], d: 1.22, n: 2.4, z: 0.008 },
];

/*
 * The carrying angle.
 *
 * A relaxed arm is not straight. The forearm angles away from the body at the
 * elbow — about 11° in men and 13° in women, the wider female angle being a
 * consequence of the wider pelvis. It is small, and leaving it out is one of
 * those omissions nobody can name but everybody notices: perfectly straight
 * arms are what makes a figure look moulded rather than standing.
 *
 * Applied below the elbow only, as an extra outward drift proportional to the
 * distance down the forearm.
 */
const CARRY_ANGLE = { male: 0.030, female: 0.038 } as const;
const ELBOW_Y = 0.636;

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
  { y: 0.720, w: ["upperArm", 1.10], x: ["shoulder", 0.92], d: 1.5, z: 0.004 },   // biceps
  { clear: true, y: 0.675, w: ["upperArm", 0.95], x: ["shoulder", 0.95], d: 1.5, z: 0.008 },
  /* The elbow is wider than the arm above and below it — it is bone, with
     almost nothing over it, and it stands proud. Rounding straight through
     was part of why the arm read as a tube. */
  { clear: true, y: 0.645, w: ["upperArm", 0.86], x: ["shoulder", 0.96], d: 1.4, z: 0.011 },
  { clear: true, carry: true, y: 0.632, w: ["upperArm", 0.82], x: ["shoulder", 0.97], d: 1.35, z: 0.013 },
  { clear: true, carry: true, y: 0.596, w: ["forearm", 1.12], x: ["shoulder", 0.98], d: 1.5, z: 0.017 },  // forearm belly
  { clear: true, carry: true, y: 0.542, w: ["forearm", 0.88], x: ["shoulder", 1.00], d: 1.5, z: 0.021 },
  { clear: true, carry: true, y: 0.502, w: ["forearm", 0.62], x: ["shoulder", 1.01], d: 1.4, z: 0.024 },  // wrist
  /* The hand.
   *
   * Hanging at the side the palm faces the thigh, so the hand's breadth —
   * thumb to little finger — runs front to back, and its thickness runs side
   * to side. It is a flat paddle seen edge-on, roughly three times as deep as
   * it is thick. The previous version was very nearly circular, which is why
   * it read as an egg on a stick.
   *
   * Fingertips finish at mid-thigh, which is where they really do land. */
  { clear: true, carry: true, y: 0.486, w: ["forearm", 0.60], x: ["shoulder", 1.02], d: 2.7, z: 0.026 },
  { clear: true, carry: true, y: 0.470, w: ["forearm", 0.64], x: ["shoulder", 1.02], d: 3.1, z: 0.028 },  // knuckles
  { clear: true, carry: true, y: 0.452, w: ["forearm", 0.58], x: ["shoulder", 1.02], d: 2.9, z: 0.029 },
  /* Tapered almost to nothing. A hand that stops at full width leaves the end
     cap facing the camera as a flat rectangular chip. */
  { clear: true, carry: true, y: 0.438, w: ["forearm", 0.36], x: ["shoulder", 1.02], d: 2.3, z: 0.029 },
  { clear: true, carry: true, y: 0.430, w: ["forearm", 0.15], x: ["shoulder", 1.02], d: 1.3, z: 0.029 },
];

/*
 * The leg.
 *
 * The important correction here is that the legs *converge*. The femur runs
 * medially from the hip socket to the knee — the hip joints are about 0.045 of
 * stature either side of the midline, the knees about 0.035, the ankles about
 * 0.030 — so a standing figure narrows from pelvis to floor. The previous
 * table had the knee as the widest point of the whole leg, which bowed them
 * outward and is most of why the lower half read as furniture.
 *
 * The knee itself is wider than the shin below it. It is bone with almost
 * nothing over it and it stands proud; rounding straight through from thigh to
 * calf loses the joint entirely.
 */
const LEG: Section[] = [
  { y: 0.478, w: ["thigh", 1.10], x: ["hip", 0.50], d: 1.10 },
  { y: 0.420, w: ["thigh", 1.05], x: ["hip", 0.47], d: 1.10, front: 0.96 },
  { y: 0.360, w: ["thigh", 0.97], x: ["hip", 0.44], d: 1.10 },
  { y: 0.310, w: ["thigh", 0.82], x: ["hip", 0.42], d: 1.12 },
  { y: 0.278, w: ["knee", 1.06], x: ["hip", 0.41], d: 1.08 },              // above the knee
  { y: 0.262, w: ["knee", 1.10], x: ["hip", 0.40], d: 1.05, front: 1.04 }, // the kneecap
  { y: 0.246, w: ["knee", 0.98], x: ["hip", 0.40], d: 1.08 },
  { y: 0.216, w: ["calf", 1.05], x: ["hip", 0.39], d: 1.30, front: 0.80 }, // calf belly, high and behind
  { y: 0.170, w: ["calf", 0.92], x: ["hip", 0.38], d: 1.24, front: 0.84 },
  { y: 0.105, w: ["calf", 0.62], x: ["hip", 0.37], d: 1.14 },
  { y: 0.055, w: ["ankle", 1.02], x: ["hip", 0.36], d: 1.10 },
  /* The foot.
   *
   * Longer than it was, and correctly so: foot length is about 15% of stature,
   * which for a 178 cm man is 27 cm — so the toe box reaches well forward of
   * the ankle and the heel a little behind it. The rising `z` down the stack
   * tilts the sole so the arch lifts towards the ball of the foot; a flat slab
   * reads as a plinth. `n` climbs towards 3 because a foot is not elliptical —
   * it has a flat sole and a flat outer edge. */
  { y: 0.032, w: ["ankle", 1.16], x: ["hip", 0.36], d: 2.6, z: 0.010, n: 2.5 },
  { y: 0.018, w: ["ankle", 1.32], x: ["hip", 0.36], d: 3.6, z: 0.032, n: 2.8 },
  { y: 0.008, w: ["ankle", 1.36], x: ["hip", 0.37], d: 4.0, z: 0.046, n: 3.0 },  // ball of the foot
  { y: 0.003, w: ["ankle", 1.18], x: ["hip", 0.37], d: 3.6, z: 0.056, n: 3.0 },
  { y: 0.000, w: ["ankle", 0.70], x: ["hip", 0.37], d: 2.2, z: 0.070, n: 3.0 },  // toes
];

/**
 * The head, lofted rather than sphered.
 *
 * A scaled sphere has no jaw. It tapers evenly to a point at the chin, where a
 * real skull narrows sharply below the cheekbones and then squares off — and
 * the difference is the whole reason a sphere on a neck reads as a mannequin
 * however good the body is.
 *
 * Absolute widths, not multiples of anything: head size varies far less
 * between people than torso width does, and tying it to bodyweight would give
 * a heavy person a comically large skull. Eight heads tall puts the chin at
 * 0.875 and the crown at 1.0, and a head is deeper than it is wide — about
 * 195 mm front to back against 155 mm across — which is why every rz here
 * exceeds its rx.
 *
 * Cranium slightly back of the face, because the skull's mass sits behind the
 * jaw and the sagittal curve carries the whole head a little forward.
 */
const HEAD: Ring[] = [
  { c: [0, 0.874, 0.008], rx: 0.016, rz: 0.024, n: 2.6 },   // point of the chin
  { c: [0, 0.884, 0.007], rx: 0.028, rz: 0.038, n: 2.5 },   // jaw
  { c: [0, 0.897, 0.006], rx: 0.037, rz: 0.048, n: 2.4 },   // jaw angle
  { c: [0, 0.910, 0.005], rx: 0.042, rz: 0.053, n: 2.3 },   // cheekbone
  { c: [0, 0.925, 0.004], rx: 0.045, rz: 0.056, n: 2.2 },   // eye line
  { c: [0, 0.942, 0.002], rx: 0.046, rz: 0.057, n: 2.2 },   // widest of the cranium
  { c: [0, 0.962, 0.000], rx: 0.043, rz: 0.053, n: 2.3 },
  { c: [0, 0.980, -0.002], rx: 0.035, rz: 0.042, n: 2.4 },
  { c: [0, 0.994, -0.002], rx: 0.020, rz: 0.024, n: 2.5 },
  { c: [0, 1.000, -0.002], rx: 0.007, rz: 0.008, n: 2.5 },  // crown
];

/**
 * How wide the torso is at a given height, half-width, before relief.
 *
 * Used to keep the arms clear of the body. Read from the same table the loft
 * builds from, so the two cannot disagree.
 */
function torsoHalfWidth(p: Physique, y: number): number {
  const built = shiftForSex(TORSO, p)
    .map((s) => ({ y: s.y, w: p.w[s.w[0]] * s.w[1] }))
    .sort((a, b) => a.y - b.y);

  if (y <= built[0].y) return built[0].w;
  const last = built[built.length - 1];
  if (y >= last.y) return last.w;

  let i = 0;
  while (i < built.length - 2 && built[i + 1].y < y) i++;
  const a = built[i], b = built[i + 1];
  const span = b.y - a.y;
  return span > 1e-6 ? a.w + ((y - a.y) / span) * (b.w - a.w) : a.w;
}

/**
 * Where the centre of a limb is at a given height.
 *
 * The relief fields need this: the legs converge from hip to ankle and their
 * spacing scales with pelvis width, so a quadriceps bump pinned to an absolute
 * x lands centred on a narrow person and on the outside edge of the thigh on a
 * broad one. Read straight off the same tables that build the geometry, so the
 * muscles cannot drift away from the limbs they belong to.
 */
function limbCentres(p: Physique): LimbCentres {
  const lookup = (sections: Section[]) => {
    const built = shiftForSex(sections, p)
      .map((s) => {
        let offset = s.x ? p.w[s.x[0]] * s.x[1] : 0;
        if (s.carry && s.y < ELBOW_Y) offset += (ELBOW_Y - s.y) * CARRY_ANGLE[p.sex];
        return { y: s.y, x: offset };
      })
      .sort((m, n) => m.y - n.y);

    return (y: number) => {
      if (y <= built[0].y) return built[0].x;
      const last = built[built.length - 1];
      if (y >= last.y) return last.x;
      let i = 0;
      while (i < built.length - 2 && built[i + 1].y < y) i++;
      const a = built[i], b = built[i + 1];
      const span = b.y - a.y;
      return span > 1e-6 ? a.x + ((y - a.y) / span) * (b.x - a.x) : a.x;
    };
  };

  return { leg: lookup(LEG), arm: lookup(ARM) };
}

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

    // Below the elbow, the forearm swings out. See CARRY_ANGLE above.
    if (s.carry && s.y < ELBOW_Y) {
      offset += (ELBOW_Y - s.y) * CARRY_ANGLE[p.sex];
    }

    /* Hold the arm out against the torso — but against the torso *at this
       height*, not against the widest part of it.
     *
     * The first version used the largest of the waist and the hip everywhere,
     * which shoved the upper arms out at chest level and made the figure 61 cm
     * across at the elbows, six centimetres wider than a real person. And it
     * demanded a full arm's width of daylight, when a hanging arm genuinely
     * rests against the lat: the constraint is not "no contact", it is "no
     * more than about a third of the arm buried". */
    if (s.clear) {
      const torso = torsoHalfWidth(p, s.y);
      offset = Math.max(offset, torso + rx * 0.6);
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

  parts.push(loft(HEAD, RADIAL, 90));

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
  applyRelief(merged, p, limbCentres(p));

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
/*
 * Note the order: this runs on the geometry *before* it is centred on the
 * origin, so `y` here is still the 0-to-1 standing space the tables are
 * written in — the same space the relief fields use. Centring first, or
 * offsetting here, would put every muscle half a body-height out.
 */
function applyRelief(g: THREE.BufferGeometry, p: Physique, limbs: LimbCentres): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute;
  const shade = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);

    const d = relief(x, y, z, nx, ny, nz, p, limbs);
    if (d !== 0) pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);

    /* Cavity shading, baked into vertex colour. Sampled at the original
       position, before displacement — the field is defined on the base
       surface, and asking it about a point it has already moved gives the
       occlusion of somewhere the body no longer is. */
    const ao = cavity(x, y, z, nx, ny, nz, p, limbs);
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
    /* The centre line is no longer at z = 0 — the spine curves. Testing
       against an assumed centre would place the whole torso volume a
       centimetre or two off wherever the curve is deepest. */
    const cz = a.c[2] + (b.c[2] - a.c[2]) * f;
    const n = (a.n ?? 2.3) + ((b.n ?? 2.3) - (a.n ?? 2.3)) * f;
    const front = (a.front ?? 1) + ((b.front ?? 1) - (a.front ?? 1)) * f;
    const back = (a.back ?? 1) + ((b.back ?? 1) - (a.back ?? 1)) * f;

    const dz = z - cz;
    const depth = rz * (dz > 0 ? front : back);
    // Superellipse test: |x/rx|^n + |z/rz|^n < 1 is inside.
    return Math.pow(Math.abs(x / rx), n) + Math.pow(Math.abs(dz / depth), n) < 1;
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
