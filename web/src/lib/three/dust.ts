import * as THREE from "three";

/**
 * Turning the body into dust.
 *
 * The reference this app's look is drawn from renders its centrepiece as a
 * grainy, translucent, glowing volume rather than a solid object — you can see
 * the starfield through it, its edges feather away instead of stopping, and it
 * brightens where the form is thick. A lit polygon surface cannot do any of
 * that: it is opaque, it has a hard silhouette, and it gets darker at glancing
 * angles rather than brighter.
 *
 * So the figure is drawn twice. A faint solid mesh underneath carries the
 * anatomy and the light, and a few tens of thousands of points scattered over
 * its surface carry the atmosphere. Additively blended, the points accumulate
 * where the body is dense and thin out at the edges, which is exactly the
 * quality being copied — and it comes out of the geometry rather than being
 * faked with a blur.
 *
 * Points are distributed by triangle area, not per vertex. Sampling vertices
 * would cluster the dust wherever the mesh happens to be finely divided —
 * around the head and the hands — and leave the thighs bare.
 */

export interface DustOptions {
  /** How many points to scatter. */
  count?: number;
  /** Push points out along the normal, so the cloud sits just off the skin. */
  lift?: number;
  /** Random spread around that lift, which is what makes it read as dust. */
  jitter?: number;
  /**
   * Return true for a point that is buried inside the body.
   *
   * Interior surfaces are invisible on a solid mesh and very visible in an
   * additive cloud, where they pile onto whatever is in front of them.
   */
  buried?: (x: number, y: number, z: number) => boolean;
}

export function surfaceDust(
  source: THREE.BufferGeometry,
  { count = 26_000, lift = 0.004, jitter = 0.012, buried }: DustOptions = {},
): THREE.BufferGeometry {
  const pos = source.getAttribute("position") as THREE.BufferAttribute;
  const nor = source.getAttribute("normal") as THREE.BufferAttribute;
  const col = source.getAttribute("color") as THREE.BufferAttribute | undefined;
  const index = source.getIndex();
  if (!index) throw new Error("surfaceDust needs an indexed geometry");

  const triangles = index.count / 3;

  /* Cumulative area, so a point can be placed on a uniformly random position
     over the whole surface with one binary search. */
  const cumulative = new Float32Array(triangles);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cross = new THREE.Vector3();

  let total = 0;
  for (let t = 0; t < triangles; t++) {
    const i0 = index.getX(t * 3), i1 = index.getX(t * 3 + 1), i2 = index.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a); ac.subVectors(c, a);
    total += cross.crossVectors(ab, ac).length() * 0.5;
    cumulative[t] = total;
  }

  const points = new Float32Array(count * 3);
  const shades = new Float32Array(count);
  const sizes = new Float32Array(count);

  const n0 = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  let written = 0;
  // A budget, so a bad containment test cannot spin here forever.
  for (let attempt = 0; written < count && attempt < count * 6; attempt++) {
    const p = written;
    const target = Math.random() * total;

    // Binary search for the triangle this lands in.
    let lo = 0, hi = triangles - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1; else hi = mid;
    }
    const t = lo;

    const i0 = index.getX(t * 3), i1 = index.getX(t * 3 + 1), i2 = index.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);

    /* Uniform barycentric coordinates. The square root is what keeps points
       from bunching in one corner of the triangle. */
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;

    n0.fromBufferAttribute(nor, i0);
    n1.fromBufferAttribute(nor, i1);
    n2.fromBufferAttribute(nor, i2);
    normal.set(
      n0.x * w + n1.x * u + n2.x * v,
      n0.y * w + n1.y * u + n2.y * v,
      n0.z * w + n1.z * u + n2.z * v,
    ).normalize();

    const off = lift + (Math.random() - 0.5) * jitter;
    const px = a.x * w + b.x * u + c.x * v + normal.x * off;
    const py = a.y * w + b.y * u + c.y * v + normal.y * off;
    const pz = a.z * w + b.z * u + c.z * v + normal.z * off;

    if (buried?.(px, py, pz)) continue;

    points[p * 3] = px;
    points[p * 3 + 1] = py;
    points[p * 3 + 2] = pz;

    /* Carry the baked cavity shading through, so the dust is darker in the
       creases too — otherwise the cloud flattens all the anatomy the relief
       pass just spent its time creating. */
    const ao = col
      ? col.getX(i0) * w + col.getX(i1) * u + col.getX(i2) * v
      : 1;
    shades[p] = ao;

    // A spread of sizes reads as depth; all-identical dots read as a screen.
    sizes[p] = 0.55 + Math.random() * Math.random() * 1.9;
    written++;
  }

  const g = new THREE.BufferGeometry();
  // Trimmed to what was actually written, or the unused tail draws at the origin.
  g.setAttribute("position", new THREE.BufferAttribute(points.subarray(0, written * 3), 3));
  g.setAttribute("shade", new THREE.BufferAttribute(shades.subarray(0, written), 1));
  g.setAttribute("scale", new THREE.BufferAttribute(sizes.subarray(0, written), 1));
  return g;
}

/**
 * A soft round sprite for each mote.
 *
 * Without it every point is a hard square, and thirty thousand hard squares
 * look like static rather than dust. Drawn once into a small canvas and reused.
 */
export function dustSprite(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/**
 * The dust material.
 *
 * Additive, so overlapping motes brighten each other and the figure glows
 * where it is thick — that accumulation is the whole effect. Depth writing is
 * off, or each point would punch a hole in the ones behind it.
 */
export function dustMaterial(sprite: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: sprite },
      uSize: { value: 4.6 },
      uOpacity: { value: 0.78 },
      uColor: { value: new THREE.Color(0xffffff) },
      uPixelRatio: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float shade;
      attribute float scale;
      uniform float uSize;
      uniform float uPixelRatio;
      varying float vShade;

      void main() {
        vShade = shade;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Perspective size, so motes at the back are smaller and the cloud
        // reads as having depth rather than being a flat sticker.
        gl_PointSize = uSize * scale * uPixelRatio * (1.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying float vShade;

      void main() {
        vec4 sprite = texture2D(uMap, gl_PointCoord);
        if (sprite.a < 0.02) discard;
        /* Shading is applied to the colour more than to the alpha. Taken out
           of the alpha as well, the creases stopped being dark and simply
           became gaps, and the cloud tore open along every groove. */
        float a = sprite.a * uOpacity * (0.55 + 0.45 * vShade);
        gl_FragColor = vec4(uColor * (0.35 + 0.65 * vShade), a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
