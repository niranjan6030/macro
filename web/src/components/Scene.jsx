"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildStar, shadeStar } from "@/lib/three/star";
import { dustMaterial, dustSprite, surfaceDust } from "@/lib/three/dust";

/**
 * The star, turning as you scroll.
 *
 * Fixed behind the page and non-interactive: it is the ground the content sits
 * on, not something you click. Scroll drives rotation directly rather than
 * through a spring, so the connection between the wheel and the shape is
 * immediate — that link is the whole effect, and half a second of easing
 * breaks it.
 *
 * It is drawn as dust rather than as a surface. Tens of thousands of points
 * scattered over the geometry by triangle area and blended additively: the
 * shape becomes translucent, its edges feather away instead of stopping, and
 * it brightens where it is dense. A lit polygon surface can do none of that —
 * it is opaque, hard-edged, and gets darker at glancing angles rather than
 * brighter.
 *
 * This does nothing else. No data drives it and nothing reads from it.
 */

const CAP_DPR = 1.8;
const SWAY_SPEED = 0.00028;
const SWAY_RADIANS = 0.1;
/** About a full turn per three screens of scrolling. */
const SCROLL_TO_RADIANS = 0.0042;

const RADIUS = [1.0, 1.02, 0.34];

export function Scene({ className }) {
  const host = useRef(null);

  useEffect(() => {
    const mount = host.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      // No WebGL — an old phone, or a locked-down browser. The page is
      // perfectly usable without this, so fail quietly.
      return;
    }
    const dpr = Math.min(window.devicePixelRatio, CAP_DPR);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    /* --- the star ---------------------------------------------------- */
    const geometry = buildStar({ radius: RADIUS });
    shadeStar(geometry, RADIUS);

    const sprite = dustSprite();

    const motes = new THREE.Points(
      surfaceDust(geometry, { count: 72_000, lift: 0.002, jitter: 0.012 }),
      dustMaterial(sprite),
    );
    const moteMat = motes.material;
    moteMat.uniforms.uPixelRatio.value = dpr;
    /* Denser and brighter than the default. The star has far less surface than
       a body but spreads it over a similar silhouette — the points are thin —
       so the same settings came out as a faint smudge. */
    moteMat.uniforms.uSize.value = 5.6;
    moteMat.uniforms.uOpacity.value = 1.15;
    moteMat.uniforms.uRim.value = 1.1;

    /* A looser layer standing further off the surface. This is the halo: it
       makes the silhouette feather away instead of ending, and it is most of
       what reads as a glow. */
    const haze = new THREE.Points(
      surfaceDust(geometry, { count: 14_000, lift: 0.025, jitter: 0.08 }),
      dustMaterial(sprite),
    );
    const hazeMat = haze.material;
    hazeMat.uniforms.uPixelRatio.value = dpr;
    hazeMat.uniforms.uSize.value = 15.0;
    hazeMat.uniforms.uOpacity.value = 0.22;
    hazeMat.uniforms.uRim.value = 0.5;

    const group = new THREE.Group();
    group.scale.setScalar(1.02);
    // A few degrees off square, so it reads as an object in space rather than
    // a diagram pinned to the screen.
    group.rotation.x = 0.06;
    group.add(motes);
    group.add(haze);
    scene.add(group);

    /* --- ambient dust ------------------------------------------------ */
    const COUNT = 420;
    const field = new Float32Array(COUNT * 3);
    const drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      // A hollow shell, so nothing sits inside the star.
      const r = 2.6 + Math.random() * 6.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      field[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      field[i * 3 + 1] = r * Math.cos(phi) * 0.75;
      field[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      drift[i] = 0.1 + Math.random() * 0.9;
    }
    const fieldGeo = new THREE.BufferGeometry();
    fieldGeo.setAttribute("position", new THREE.BufferAttribute(field, 3));
    const fieldMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.019,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    const stars = new THREE.Points(fieldGeo, fieldMat);
    scene.add(stars);

    /* --- size -------------------------------------------------------- */
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = mount;
      if (!w || !h) return;
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      // On a narrow screen the star needs the camera pulled back or its points
      // run off the sides.
      camera.position.z = w / h < 0.8 ? 6.4 : 5.2;
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
    let running = true;

    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (!running) return;

      const sway = reduced ? 0 : Math.sin(t * SWAY_SPEED) * SWAY_RADIANS;
      group.rotation.y = scrollRotation + sway;
      // A touch of counter-tilt, so it tumbles rather than spinning on a pole.
      group.rotation.z = reduced ? 0 : Math.sin(t * SWAY_SPEED * 0.6) * 0.05;
      stars.rotation.y = -(scrollRotation * 0.18) - sway * 0.4;

      if (!reduced) {
        const pos = fieldGeo.getAttribute("position");
        for (let i = 0; i < COUNT; i++) {
          // Slow vertical drift, wrapping at the top and bottom of the shell.
          let y = pos.getY(i) + drift[i] * 0.00035;
          if (y > 4.5) y = -4.5;
          pos.setY(i, y);
        }
        pos.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(frame);

    // A hidden tab should not burn battery on something nobody is looking at.
    const onVisibility = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      geometry.dispose();
      motes.geometry.dispose();
      moteMat.dispose();
      haze.geometry.dispose();
      hazeMat.dispose();
      fieldGeo.dispose();
      fieldMat.dispose();
      sprite.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={host} aria-hidden className={className} />;
}
