import * as THREE from "three";

/**
 * The four-pointed star.
 *
 * Measured off the reference: symmetric, about as tall as it is wide, with
 * points that taper to hairlines and deeply concave curves between them. That
 * shape is an astroid — the curve `x^(2/3) + y^(2/3) = 1`, which in
 * parametric form is simply `x = cos³t, y = sin³t`. Cubing is what pulls the
 * sides inward; without it you get an ellipse.
 *
 * In three dimensions it becomes a superellipsoid with the same exponent,
 * which gives points on all six axes. The z-axis is scaled down so the two
 * pointing at the camera stay stubby: the star reads as a flat four-pointed
 * sparkle from the front, and the front and back points fill out its middle,
 * which is exactly the fuller core the reference has.
 *
 * Turned side-on it is a slimmer star rather than a flat card, so the
 * silhouette stays interesting all the way round — which matters here,
 * because the whole thing is on a turntable driven by the scrollbar.
 */

export interface StarOptions {
  /** Reach of the points along each axis. */
  radius?: [number, number, number];
  /**
   * How sharply the sides pinch in.
   *
   * 1 is an ellipsoid. 2 already has visible points. 3 is the true astroid and
   * is what the reference looks like — long needle points and a deep hollow
   * between them.
   */
  sharpness?: number;
  /** Grid resolution. Points need density or they facet visibly. */
  segments?: number;
}

/** Signed power, so the curve keeps its shape in all four quadrants. */
const sp = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), e);

export function buildStar({
  radius = [1.0, 1.02, 0.34],
  sharpness = 3,
  segments = 168,
}: StarOptions = {}): THREE.BufferGeometry {
  const [a, b, c] = radius;
  const lat = segments;
  const lon = segments;

  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lat; i++) {
    // Latitude, pole to pole. The poles are the north and south points.
    const v = -Math.PI / 2 + (Math.PI * i) / lat;
    const cv = sp(Math.cos(v), sharpness);
    const sv = sp(Math.sin(v), sharpness);

    for (let j = 0; j <= lon; j++) {
      const u = (2 * Math.PI * j) / lon;
      positions.push(
        a * cv * sp(Math.cos(u), sharpness),
        b * sv,
        c * cv * sp(Math.sin(u), sharpness),
      );
    }
  }

  const stride = lon + 1;
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const p0 = i * stride + j;
      const p1 = p0 + stride;
      indices.push(p0, p1, p0 + 1);
      indices.push(p0 + 1, p1, p1 + 1);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Brightness per vertex, baked in.
 *
 * The reference's star is pale along its edges and dense through its middle.
 * Some of that comes free from additive blending — a surface seen edge-on
 * stacks more motes into the same pixels — but not enough, because the points
 * are so thin that there is little surface there to stack.
 *
 * So distance from the centre is written into a colour attribute, and the
 * dust shader reads it. The tips come out bright, the hollows between the
 * points fall away.
 */
export function shadeStar(g: THREE.BufferGeometry, radius: [number, number, number]): void {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const shade = new Float32Array(pos.count * 3);
  const [a, b, c] = radius;

  for (let i = 0; i < pos.count; i++) {
    // Normalised so a point on any axis reads as 1, whatever its reach.
    const nx = pos.getX(i) / a;
    const ny = pos.getY(i) / b;
    const nz = pos.getZ(i) / c;
    const r = Math.min(Math.hypot(nx, ny, nz), 1);

    // Bright at the tips, dimmer in the waists, never fully dark.
    const v = 0.42 + 0.58 * Math.pow(r, 1.6);
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = v;
  }

  g.setAttribute("color", new THREE.BufferAttribute(shade, 3));
}
