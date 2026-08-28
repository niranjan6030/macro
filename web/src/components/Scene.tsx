"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildBody } from "@/lib/three/body";

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
const IDLE_SPEED = 0.00022;        // slow drift when nobody is scrolling
const SCROLL_TO_RADIANS = 0.0042;  // about a full turn per three screens

export function Scene({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);

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
    const geometry = buildBody();
    const material = new THREE.MeshStandardMaterial({
      color: 0xf2f2f2,
      roughness: 0.62,
      metalness: 0.04,
      flatShading: false,
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
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));

    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(1.1, 1.6, 1.4);
    scene.add(key);

    // The rim is what makes it sculptural. Behind and above, so the edge of
    // the shoulder and the outside of the arm catch a hard white line.
    const rim = new THREE.DirectionalLight(0xffffff, 2.6);
    rim.position.set(-1.6, 0.9, -1.5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-0.8, -0.6, 1.2);
    scene.add(fill);

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

      if (!reduced) idle = t * IDLE_SPEED;
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
  }, []);

  return <div ref={host} aria-hidden className={className} />;
}
