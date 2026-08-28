"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildBody } from "@/lib/three/body";
import { physiqueOf, type Composition } from "@/lib/fitness/physique";
import { useBody } from "@/lib/bodyStore";

/**
 * The figure, turning as you scroll.
 *
 * Fixed behind the page and non-interactive: it is the ground the content
 * sits on, not something you click. Scroll drives rotation directly rather
 * than through a spring, so the connection between the wheel and the body is
 * immediate — that link is the whole effect, and half a second of easing
 * breaks it.
 *
 * Everything is monochrome. There is one white key light, one rim light
 * behind the shoulders to separate the figure from the black, and a dim fill
 * so the front never goes fully to zero.
 */

const CAP_DPR = 1.8;               // retina is wasted on a matte white body
/* A slow sway, not a turntable. The figure is the person's own body and its
   default state should be facing them; an unbounded drift meant it was
   showing its back as often as its front, for no reason anyone asked for. */
const SWAY_SPEED = 0.00034;
const SWAY_RADIANS = 0.12;
const SCROLL_TO_RADIANS = 0.0042;  // about a full turn per three screens

/**
 * The default body, for anyone not signed in or not set up yet.
 *
 * A real 178 cm, 80 kg man at 22% — around the middle of the range, which is
 * where most people actually start. Not a shredded ideal: the landing screen
 * should not open with a body nobody has.
 */
const DEFAULT_BODY: Composition = {
  sex: "male", heightCm: 178, weightKg: 80, bodyFatPct: 22, leanKg: 80 * 0.78,
};

export function Scene({
  className,
  composition,
}: {
  className?: string;
  /** The person's own body. Falls back to a neutral default. */
  composition?: Composition | null;
}) {
  const host = useRef<HTMLDivElement>(null);
  const fromStore = useBody((s) => s.composition);

  /* Rebuild only when the composition genuinely moves. Rounding first means a
     50 g fluctuation on the scales does not rebuild 14,000 vertices, while a
     real change still does. */
  const physique = useMemo(() => {
    const c = composition ?? fromStore ?? DEFAULT_BODY;
    return physiqueOf({
      ...c,
      weightKg: Math.round(c.weightKg * 2) / 2,
      bodyFatPct: Math.round(c.bodyFatPct * 2) / 2,
      leanKg: Math.round(c.leanKg * 2) / 2,
    });
  }, [composition, fromStore]);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.02, 4.6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL — an old phone, or a locked-down browser. The page is
      // perfectly usable without this, so fail quietly.
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CAP_DPR));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* --- the figure ------------------------------------------------- */
    const geometry = buildBody(physique);
    /* Grey clay, the way an anatomy sculpt is presented. A pure white body
       blows out its own highlights and the relief disappears into them; a mid
       grey keeps the whole tonal range available for form. */
    const material = new THREE.MeshStandardMaterial({
      color: 0xc4c4c4,
      roughness: 0.78,
      metalness: 0.0,
      /* The baked cavity map multiplies in here. Without it the groove
         between two pectorals stays as bright as the pectorals — both its
         walls face the light — and the separation is invisible however the
         lamps are arranged. */
      vertexColors: true,
    });
    const body = new THREE.Mesh(geometry, material);
    body.scale.setScalar(2.0);

    const group = new THREE.Group();
    group.add(body);
    // A few degrees off square, so the pose reads as a body standing rather
    // than a diagram pinned to the screen.
    group.rotation.x = 0.04;
    scene.add(group);

    /* --- light ------------------------------------------------------- */
    /* Low ambient on purpose. Relief is read from the gradient between lit
       and unlit, and filling the shadows flattens every muscle back into the
       surface it was displaced out of. */
    scene.add(new THREE.AmbientLight(0xffffff, 0.16));

    // Raking across the body rather than square on, so the form casts.
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(1.5, 1.5, 1.0);
    scene.add(key);

    // The rim is what makes it sculptural. Behind and above, so the edge of
    // the shoulder and the outside of the arm catch a hard white line.
    const rim = new THREE.DirectionalLight(0xffffff, 2.6);
    rim.position.set(-1.6, 0.9, -1.5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffffff, 0.42);
    fill.position.set(-1.2, -0.5, 1.1);
    scene.add(fill);

    // A dim underlight, so the undersides of the pecs and glutes do not read
    // as holes cut in the figure.
    const bounce = new THREE.DirectionalLight(0xffffff, 0.28);
    bounce.position.set(0, -1.5, 0.6);
    scene.add(bounce);

    /* --- dust -------------------------------------------------------- */
    const COUNT = 420;
    const dust = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // A hollow shell, so nothing sits inside the figure.
      const r = 2.2 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      dust[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      dust[i * 3 + 1] = r * Math.cos(phi) * 0.7;
      dust[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      drift[i] = 0.1 + Math.random() * 0.9;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.019, sizeAttenuation: true,
      transparent: true, opacity: 0.62, depthWrite: false,
    });
    const points = new THREE.Points(dustGeo, dustMat);
    scene.add(points);

    /* --- size -------------------------------------------------------- */
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      /* updateStyle must stay on. With it off the canvas keeps its
         backing-store size in CSS pixels — at a device ratio of 1.8 that is a
         1620px canvas inside a 900px window, and the figure ends up somewhere
         off the bottom right of the screen. */
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      /* Frame the figure to the height of the window. A body is tall and thin,
         so on a narrow screen it is height that runs out first, and the camera
         has to pull back or the head and feet crop. */
      const portrait = w / h < 0.8;
      camera.position.z = portrait ? 5.6 : 4.6;
      /* On a phone the copy lives in the lower third, so the figure is lifted
         out of it. On a wide screen there is room either side and it stays
         centred. */
      group.position.y = portrait ? 0.42 : 0.1;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    /* --- scroll ------------------------------------------------------ */
    let scrollRotation = 0;
    const onScroll = () => {
      scrollRotation = window.scrollY * SCROLL_TO_RADIANS;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    /* --- loop -------------------------------------------------------- */
    let raf = 0;
    let idle = 0;
    let running = true;

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;

      if (!reduced) idle = Math.sin(t * SWAY_SPEED) * SWAY_RADIANS;
      group.rotation.y = scrollRotation + idle;
      points.rotation.y = -(scrollRotation * 0.18) - idle * 0.4;

      if (!reduced) {
        const pos = dustGeo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < COUNT; i++) {
          // Slow vertical drift, wrapping at the top and bottom of the shell.
          let y = pos.getY(i) + drift[i] * 0.00035;
          if (y > 4) y = -4;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    // A hidden tab should not be burning battery on a body nobody is looking at.
    const onVisibility = () => { running = document.visibilityState === "visible"; };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      geometry.dispose();
      material.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [physique]);

  return <div ref={host} aria-hidden className={className} />;
}
