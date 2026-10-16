"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Icosahedron, OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from "@react-three/postprocessing";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

const phases = [
  ["01", "Discover", "We get curious about your business, your audience, and the opportunity ahead.", "The useful questions come first."],
  ["02", "Define", "We turn insight into a sharp strategy and a roadmap you can believe in.", "Clarity creates velocity."],
  ["03", "Deliver", "We build, launch, and refine until your digital presence earns its place.", "Momentum becomes measurable."],
];

function ApproachOrb() {
  const orb = useRef();
  useFrame(({ clock, pointer }) => {
    orb.current.rotation.x = clock.getElapsedTime() * 0.16 + pointer.y * 0.2;
    orb.current.rotation.y = clock.getElapsedTime() * 0.22 + pointer.x * 0.25;
  });
  return <group ref={orb}>
    <Float speed={1.7} rotationIntensity={0.35} floatIntensity={0.8}><Icosahedron args={[1.35, 2]}><meshStandardMaterial color="#d8ff59" emissive="#789000" emissiveIntensity={0.9} roughness={0.25} wireframe /></Icosahedron></Float>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.9, 0.015, 10, 100]} /><meshBasicMaterial color="#b8a5ff" /></mesh>
  </group>;
}

function ApproachCameraRig({ cameraApi }) {
  useFrame(({ camera }) => {
    cameraApi.current.z ??= 6;
    cameraApi.current.x ??= 0;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraApi.current.z, 0.08);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraApi.current.x, 0.08);
  });
  return null;
}

function ApproachScene({ cameraApi }) {
  return <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}><PerspectiveCamera ref={(camera) => { cameraApi.current.camera = camera; }} makeDefault position={[0, 0, 6]} fov={42} /><ApproachCameraRig cameraApi={cameraApi} /><ambientLight intensity={1.3} /><pointLight position={[3, 3, 4]} color="#d8ff59" intensity={12} /><pointLight position={[-3, -1, 2]} color="#b8a5ff" intensity={10} /><Stars radius={6} depth={3} count={90} factor={1.4} saturation={0} fade speed={0.5} /><ApproachOrb /><EffectComposer><Bloom intensity={1.1} luminanceThreshold={0.3} mipmapBlur /><ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation modulationOffset={0.15} /><Vignette eskil={false} offset={0.24} darkness={0.7} /></EffectComposer><OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.7} /></Canvas>;
}

export default function ApproachPage() {
  const page = useRef(null);
  const cameraApi = useRef({ camera: null });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    const tick = (time) => lenis.raf(time);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    const context = gsap.context(() => {
      gsap.from(".approach-hero-copy > *", { opacity: 0, y: 35, stagger: 0.1, duration: 1, ease: "power4.out" });
      gsap.to(".approach-scene", { yPercent: 18, rotate: -5, scrollTrigger: { trigger: ".approach-hero", scrub: 1 } });
      gsap.to(cameraApi.current, { z: 4.65, x: 0.45, ease: "none", scrollTrigger: { trigger: ".approach-hero", start: "top top", end: "bottom top", scrub: 1 } });
      gsap.to(".scroll-progress", { scaleX: 1, ease: "none", scrollTrigger: { scrub: 0.15 } });
      gsap.utils.toArray(".phase-card").forEach((card, index) => gsap.from(card, { opacity: 0, y: 70, rotate: index % 2 ? 2 : -2, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: card, start: "top 82%" } }));
      const cursorDot = document.querySelector(".cursor-dot");
      const cursorRing = document.querySelector(".cursor-ring");
      const moveDot = gsap.quickTo(cursorDot, "x", { duration: 0.12, ease: "power3" });
      const moveDotY = gsap.quickTo(cursorDot, "y", { duration: 0.12, ease: "power3" });
      const moveRing = gsap.quickTo(cursorRing, "x", { duration: 0.45, ease: "power3" });
      const moveRingY = gsap.quickTo(cursorRing, "y", { duration: 0.45, ease: "power3" });
      const onPointerMove = (event) => {
        moveDot(event.clientX); moveDotY(event.clientY); moveRing(event.clientX); moveRingY(event.clientY);
        const card = event.target.closest(".phase-card");
        if (card) { const bounds = card.getBoundingClientRect(); card.style.setProperty("--glare-x", `${event.clientX - bounds.left}px`); card.style.setProperty("--glare-y", `${event.clientY - bounds.top}px`); }
      };
      const onEnter = (event) => { if (event.target.closest("a, button, .magnetic, .phase-card")) cursorRing.classList.add("is-active"); };
      const onLeave = (event) => { if (!event.relatedTarget?.closest?.("a, button, .magnetic, .phase-card")) cursorRing.classList.remove("is-active"); };
      window.addEventListener("pointermove", onPointerMove); window.addEventListener("pointerover", onEnter); window.addEventListener("pointerout", onLeave);
      context.add(() => { window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerover", onEnter); window.removeEventListener("pointerout", onLeave); });
    }, page);
    return () => { context.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  return <div ref={page} className="site approach-page"><div className="scroll-progress" aria-hidden="true" /><div className="cursor-dot" aria-hidden="true" /><div className="cursor-ring" aria-hidden="true" /><header className="header"><a className="brand" href="/" aria-label="Nexora home"><span className="brand-mark"><i /><i /><i /></span>NEXORA<span>.</span></a><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><span /><span /></button><nav className={menuOpen ? "nav is-open" : "nav"}><a href="/">Home</a><a href="/#services">Services</a><a className="nav-cta" href="/#contact">Start a project ↗</a></nav></header><main>
    <section className="approach-hero section-wrap"><div className="approach-hero-copy"><p className="eyebrow">The way we work <span /></p><h1>Make the <em>complex</em><br />feel possible.</h1><p>Good work is not a relay race. It is a shared room, a sharp point of view, and a steady rhythm from first question to final launch.</p><a className="button button-dark magnetic" href="#phases">See the phases ↓</a></div><div className="approach-scene"><ApproachScene cameraApi={cameraApi} /></div></section>
    <section className="approach-statement"><p className="eyebrow">A better kind of momentum <span /></p><h2>We bring the right amount of <em>friction.</em></h2><p>Enough to find the real problem. Not enough to slow down the good idea.</p></section>
    <section id="phases" className="phase-section section-wrap"><div className="phase-heading"><p className="eyebrow">Three movements <span /></p><h2>Less ceremony.<br /><em>More progress.</em></h2></div><div className="phase-grid">{phases.map(([number, title, copy, note]) => <article className="phase-card" key={number}><span className="phase-number">{number}</span><div className="phase-glyph">{number === "01" ? "?" : number === "02" ? "↗" : "✦"}</div><h3>{title}</h3><p>{copy}</p><small>{note}</small><span className="phase-arrow">↗</span></article>)}</div></section>
    <section className="approach-quote"><div className="section-wrap"><p>“The best digital work makes a business feel more like itself, only clearer.”</p><span>NEXORA / FIELD NOTE 03</span></div></section>
  </main><footer className="footer section-wrap"><a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span>NEXORA<span>.</span></a><p>Digital growth, made simple.</p><a href="mailto:hello@nexora.studio">hello@nexora.studio ↗</a></footer></div>;
}