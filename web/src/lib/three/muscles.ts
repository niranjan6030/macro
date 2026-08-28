import type { Physique } from "@/lib/fitness/physique";

/**
 * Muscle relief.
 *
 * A lofted surface built from cross-sections is smooth — it has a silhouette
 * but no anatomy, and at any size it reads as a shop mannequin. What makes a
 * body look like a body is the relief: the sternum groove between the pecs,
 * the line of the linea alba, the lat sweeping into the waist, the teardrop
 * above the knee.
 *
 * So each muscle group is an anisotropic gaussian field in body space, and
 * every vertex is pushed out along its own normal by the sum of the fields
 * that reach it. Grooves are the same thing with a negative amplitude.
 *
 * Two gates keep it honest, and they are the whole point of doing it this way
 * rather than sculpting one fixed body:
 *
 *   · Amplitude scales with `definition`, which needs both muscle to show and
 *     little enough fat over it to show through. A strong person carrying fat
 *     renders smooth, because that is what they look like.
 *   · Fat has its own fields — the abdomen and the flanks — which grow with
 *     adiposity and are entirely independent of the muscle ones. Someone can
 *     be round and strong at the same time, and the surface says so.
 *
 * Positions are in the same space as the loft: figure 1.0 tall, feet at y=0,
 * centre line at x=0, front at +z.
 */

export interface Field {
  /** Centre. x is mirrored, so give the right-hand side only; 0 means centred. */
  c: [number, number, number];
  /** Falloff radii. */
  r: [number, number, number];
  /** Peak displacement. Negative carves a groove. */
  amp: number;
  /** Which way the surface must face for this to apply. */
  face: "front" | "back" | "side" | "any";
  /**
   * How this field is scaled.
   *   muscle — fades with definition; needs both mass and leanness
   *   fat    — grows with adiposity
   *   form   — bone and face. Always there, only softened as fat covers it.
   */
  kind: "muscle" | "fat" | "form";
  /** Only drawn below the body fat where it would really be visible. */
  needsAbs?: boolean;
}

const M = "muscle" as const;
const F = "fat" as const;
const B = "form" as const;

export const FIELDS: Field[] = [
  /* ---- front ---------------------------------------------------- */
  // Pectorals, and the sternum groove between them.
  { c: [0.044, 0.714, 0.052], r: [0.052, 0.046, 0.080], amp: 0.0165, face: "front", kind: M },
  { c: [0.000, 0.716, 0.062], r: [0.009, 0.038, 0.06], amp: -0.0055, face: "front", kind: M },
  // The shelf under the pec, which is what separates chest from abdomen.
  { c: [0.046, 0.686, 0.052], r: [0.048, 0.011, 0.06], amp: -0.0045, face: "front", kind: M },

  // Abdominals: three rows either side of the linea alba.
  { c: [0.021, 0.672, 0.055], r: [0.019, 0.015, 0.06], amp: 0.0062, face: "front", kind: M, needsAbs: true },
  { c: [0.021, 0.645, 0.055], r: [0.019, 0.015, 0.06], amp: 0.0060, face: "front", kind: M, needsAbs: true },
  { c: [0.020, 0.618, 0.054], r: [0.018, 0.015, 0.06], amp: 0.0052, face: "front", kind: M, needsAbs: true },
  { c: [0.000, 0.645, 0.058], r: [0.007, 0.060, 0.06], amp: -0.0050, face: "front", kind: M, needsAbs: true },

  // Serratus, and the oblique running down into the hip.
  { c: [0.074, 0.678, 0.036], r: [0.020, 0.032, 0.05], amp: 0.0042, face: "front", kind: M, needsAbs: true },
  { c: [0.064, 0.600, 0.042], r: [0.022, 0.038, 0.05], amp: 0.0055, face: "front", kind: M },
  // The inguinal line, from hip bone to groin.
  { c: [0.045, 0.540, 0.045], r: [0.030, 0.016, 0.05], amp: -0.0040, face: "front", kind: M, needsAbs: true },

  { c: [0.100, 0.780, 0.028], r: [0.036, 0.036, 0.05], amp: 0.0105, face: "front", kind: M },  // front delt
  { c: [0.114, 0.724, 0.022], r: [0.026, 0.040, 0.035], amp: 0.0095, face: "front", kind: M }, // biceps
  { c: [0.128, 0.600, 0.020], r: [0.021, 0.038, 0.035], amp: 0.0060, face: "front", kind: M }, // forearm

  { c: [0.052, 0.365, 0.042], r: [0.036, 0.080, 0.055], amp: 0.0105, face: "front", kind: M }, // quadriceps
  { c: [0.036, 0.298, 0.038], r: [0.021, 0.032, 0.045], amp: 0.0080, face: "front", kind: M }, // teardrop
  { c: [0.046, 0.195, 0.030], r: [0.016, 0.048, 0.035], amp: 0.0042, face: "front", kind: M }, // shin

  /* ---- back ------------------------------------------------------ */
  { c: [0.000, 0.796, -0.048], r: [0.080, 0.052, 0.07], amp: 0.0105, face: "back", kind: M },  // traps
  { c: [0.000, 0.690, -0.058], r: [0.009, 0.105, 0.06], amp: -0.0065, face: "back", kind: M }, // spine
  { c: [0.080, 0.692, -0.042], r: [0.042, 0.062, 0.06], amp: 0.0115, face: "back", kind: M },  // lats
  { c: [0.019, 0.612, -0.052], r: [0.015, 0.058, 0.05], amp: 0.0062, face: "back", kind: M },  // erectors
  { c: [0.102, 0.776, -0.028], r: [0.033, 0.033, 0.05], amp: 0.0085, face: "back", kind: M },  // rear delt
  { c: [0.114, 0.720, -0.022], r: [0.025, 0.044, 0.035], amp: 0.0092, face: "back", kind: M }, // triceps
  { c: [0.042, 0.474, -0.044], r: [0.048, 0.055, 0.075], amp: 0.0150, face: "back", kind: M },  // glutes
  { c: [0.052, 0.372, -0.042], r: [0.034, 0.072, 0.055], amp: 0.0082, face: "back", kind: M }, // hamstrings
  { c: [0.049, 0.220, -0.032], r: [0.028, 0.048, 0.045], amp: 0.0105, face: "back", kind: M }, // calves

  /* ---- side ------------------------------------------------------ */
  { c: [0.116, 0.784, 0.000], r: [0.032, 0.034, 0.06], amp: 0.0090, face: "side", kind: M },   // lateral delt
  { c: [0.126, 0.700, 0.000], r: [0.024, 0.040, 0.05], amp: 0.0050, face: "side", kind: M },   // brachialis

  /* ---- bone and face ---------------------------------------------
     Skeleton shows at any composition — it is what stops a lean figure
     reading as a balloon and a heavy one as a sack. Softened, not removed,
     as fat covers it. */
  { c: [0.042, 0.826, 0.036], r: [0.040, 0.009, 0.04], amp: 0.0045, face: "front", kind: B },  // clavicle
  { c: [0.042, 0.838, 0.032], r: [0.032, 0.009, 0.04], amp: -0.0035, face: "front", kind: B }, // hollow above it
  { c: [0.000, 0.836, 0.038], r: [0.011, 0.009, 0.03], amp: -0.0055, face: "front", kind: B }, // sternal notch
  { c: [0.019, 0.858, 0.028], r: [0.011, 0.024, 0.03], amp: 0.0040, face: "front", kind: B },  // sternocleidomastoid
  { c: [0.072, 0.540, 0.028], r: [0.022, 0.013, 0.04], amp: 0.0035, face: "front", kind: B },  // iliac crest
  { c: [0.050, 0.268, 0.034], r: [0.021, 0.023, 0.03], amp: 0.0042, face: "front", kind: B },  // kneecap
  { c: [0.128, 0.634, -0.018], r: [0.017, 0.017, 0.025], amp: 0.0035, face: "back", kind: B }, // elbow
  { c: [0.048, 0.055, 0.004], r: [0.013, 0.013, 0.02], amp: 0.0030, face: "side", kind: B },   // ankle bone
  { c: [0.036, 0.802, -0.010], r: [0.014, 0.014, 0.03], amp: 0.0030, face: "back", kind: B },  // scapula spine

  /* The face. Not portraiture — just enough that the head has a front and a
     back, which a bare ovoid does not, and which is most of what makes the
     rotation legible from across a room. */
  { c: [0.021, 0.951, 0.044], r: [0.023, 0.011, 0.035], amp: 0.0032, face: "front", kind: B },  // brow
  { c: [0.021, 0.943, 0.046], r: [0.016, 0.012, 0.03], amp: -0.0042, face: "front", kind: B },  // eye socket
  { c: [0.000, 0.937, 0.050], r: [0.011, 0.023, 0.035], amp: 0.0058, face: "front", kind: B },  // nose bridge
  { c: [0.000, 0.926, 0.052], r: [0.009, 0.009, 0.025], amp: 0.0040, face: "front", kind: B },  // nose tip
  { c: [0.031, 0.935, 0.036], r: [0.017, 0.015, 0.03], amp: 0.0030, face: "front", kind: B },   // cheekbone
  { c: [0.000, 0.915, 0.046], r: [0.015, 0.006, 0.03], amp: -0.0032, face: "front", kind: B },  // mouth
  { c: [0.000, 0.905, 0.044], r: [0.015, 0.013, 0.03], amp: 0.0030, face: "front", kind: B },   // chin
  { c: [0.034, 0.915, 0.018], r: [0.015, 0.021, 0.03], amp: 0.0022, face: "side", kind: B },    // jaw
  { c: [0.046, 0.933, -0.006], r: [0.009, 0.017, 0.013], amp: 0.0055, face: "side", kind: B },  // ear
  { c: [0.041, 0.951, 0.016], r: [0.015, 0.015, 0.03], amp: -0.0022, face: "side", kind: B },   // temple

  /* ---- fat -------------------------------------------------------
     Independent of every muscle field above. This is the half of the model
     that makes an 80 kg body at 26% look different from an 80 kg body at 14%,
     rather than merely wider. */
  /* Broad and shallow rather than tall and strong. The first pass used a
     tight, high-amplitude field here and it built an apron with a hard rim at
     the hip — fat does not stop at a line, it feathers out over the whole
     abdomen and into the flank. */
  { c: [0.000, 0.628, 0.050], r: [0.115, 0.170, 0.130], amp: 0.019, face: "front", kind: F },
  { c: [0.086, 0.600, 0.004], r: [0.058, 0.105, 0.11], amp: 0.014, face: "side", kind: F },   // flanks
  { c: [0.000, 0.570, -0.052], r: [0.090, 0.085, 0.09], amp: 0.010, face: "back", kind: F },  // lower back
  /* Buttocks are there whatever the composition — fat or muscle, the shape is
     the same. Without this the back of a soft body went dead flat. */
  { c: [0.042, 0.470, -0.042], r: [0.050, 0.058, 0.08], amp: 0.0155, face: "back", kind: B },
  { c: [0.044, 0.702, 0.050], r: [0.060, 0.048, 0.08], amp: 0.009, face: "front", kind: F },  // chest
  { c: [0.052, 0.400, 0.030], r: [0.050, 0.095, 0.07], amp: 0.009, face: "any", kind: F },    // thigh
];

/**
 * Total displacement at a point, along its own normal.
 *
 * Called once per vertex at build time, not per frame — the geometry is
 * rebuilt only when the body composition actually changes, which is at most
 * once a day.
 */
export function relief(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  p: Physique,
): number {
  let total = 0;

  for (const f of FIELDS) {
    if (f.needsAbs && !p.absVisible) continue;

    const strength =
      f.kind === "muscle" ? p.definition
      : f.kind === "form" ? 1 - p.adiposity * 0.45
      : f.amp > 0.02 ? p.belly
      : p.adiposity;
    if (strength <= 0.001) continue;

    // Which way is this bit of surface pointing?
    let gate: number;
    switch (f.face) {
      case "front": gate = Math.max(0, nz); break;
      case "back": gate = Math.max(0, -nz); break;
      case "side": gate = Math.abs(nx); break;
      default: gate = 1;
    }
    if (gate <= 0.01) continue;

    // Mirrored: a field given on the right applies to the left as well.
    const dx = (f.c[0] === 0 ? x : Math.abs(x) - f.c[0]) / f.r[0];
    const dy = (y - f.c[1]) / f.r[1];
    const dz = (z - f.c[2]) / f.r[2];

    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 9) continue;                     // beyond three sigma, nothing

    total += f.amp * strength * gate * Math.exp(-d2);
  }

  return total;
}

/**
 * Cavity shading, baked per vertex.
 *
 * This is the single thing that makes the relief read as anatomy rather than
 * as gentle undulation. Directional light alone cannot darken the groove
 * between two pectorals — both walls of it face the light — so the surface
 * stays bright and the separation disappears. What sells it is occlusion: the
 * crevices are darker because less of the world reaches them.
 *
 * Computing that properly means ray-casting against the whole mesh. Instead
 * this samples the displacement field around each point and asks whether its
 * neighbours sit higher than it does. Where they do, the point is in a
 * hollow. It is a discrete Laplacian of the relief — a cavity map, the same
 * thing a sculpting program bakes, for a few microseconds of work.
 *
 * Returns a multiplier for the vertex colour: below 1 in the crevices,
 * slightly above 1 on the peaks.
 */
export function cavity(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  p: Physique,
): number {
  const here = relief(x, y, z, nx, ny, nz, p);

  // Two directions across the surface, perpendicular to the normal.
  const up: [number, number, number] = Math.abs(ny) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const t1 = norm(cross([nx, ny, nz], up));
  const t2 = norm(cross([nx, ny, nz], t1));

  const step = 0.011;
  let around = 0;
  for (const t of [t1, t2]) {
    for (const sign of [1, -1]) {
      const ox = x + t[0] * step * sign;
      const oy = y + t[1] * step * sign;
      const oz = z + t[2] * step * sign;
      around += relief(ox, oy, oz, nx, ny, nz, p);
    }
  }
  around /= 4;

  /* Positive means the neighbourhood is higher than this point: a hollow.
     The scale is tuned so a 5 mm groove reads clearly without the whole body
     turning to soot. */
  const concavity = (around - here) * 78;
  return clamp01(1 - concavity * 0.55) * 0.92 + 0.08;
}

const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const clamp01 = (n: number) => (n < 0.28 ? 0.28 : n > 1.25 ? 1.25 : n);
