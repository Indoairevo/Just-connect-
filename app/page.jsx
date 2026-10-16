"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

const services = [
  ["01", "Websites", "Digital homes with a point of view and a reason to stay.", "lime", "that work harder."],
  ["02", "Systems", "Simple workflows that keep your momentum in one place.", "violet", "stay in sync."],
  ["03", "Identity", "A visual language your best customers recognize instantly.", "yellow", "people remember."],
  ["04", "Visibility", "Content and SEO that put your next opportunity within reach.", "dark", "and stay relevant."],
];

function SignalField() {
  const group = useRef();
  const pulse = useRef();
  const particles = useRef();
  const points = useMemo(() => Array.from({ length: 220 }, (_, index) => {
    const angle = (index / 220) * Math.PI * 2;
    const radius = 2.05 + Math.sin(index * 2.3) * 0.25 + (index % 7) * 0.025;
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(index * 1.7) * 0.3, Math.sin(angle) * radius);
  }), []);
  useEffect(() => {
    points.forEach((point, index) => {
      const matrix = new THREE.Matrix4().makeTranslation(point.x, point.y, point.z);
      particles.current.setMatrixAt(index, matrix);
    });
    particles.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  useFrame(({ clock, pointer }) => {
    const time = clock.getElapsedTime();
    group.current.rotation.y = time * 0.08 + pointer.x * 0.14;
    group.current.rotation.x = pointer.y * 0.08;
    pulse.current.scale.setScalar(1 + Math.sin(time * 2.2) * 0.04);
    points.forEach((point, index) => {
      const wave = Math.sin(time * 1.8 + index * 0.35) * 0.055;
      const matrix = new THREE.Matrix4().makeTranslation(point.x, point.y + wave, point.z);
      particles.current.setMatrixAt(index, matrix);
    });
    particles.current.instanceMatrix.needsUpdate = true;
  });
  return <group ref={group}>
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.6}>
      <mesh ref={pulse}><icosahedronGeometry args={[1.25, 2]} /><meshStandardMaterial color="#d8ff59" emissive="#8ea912" emissiveIntensity={0.7} roughness={0.3} wireframe /></mesh>
    </Float>
    <Line points={points} color="#d8ff59" transparent opacity={0.48} lineWidth={1} />
    <instancedMesh ref={particles} args={[null, null, points.length]}><sphereGeometry args={[0.045, 8, 8]} /><meshBasicMaterial color="#d8ff59" toneMapped={false} /></instancedMesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.75, 0]}><torusGeometry args={[1.75, 0.012, 8, 80]} /><meshBasicMaterial color="#d8ff59" transparent opacity={0.5} /></mesh>
  </group>;
}

function CameraRig({ cameraApi }) {
  useFrame(({ camera }) => {
    cameraApi.current.z ??= 7;
    cameraApi.current.x ??= 0;
    cameraApi.current.y ??= 0;
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, cameraApi.current.z, 0.08);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, cameraApi.current.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, cameraApi.current.y, 0.08);
  });
  return null;
}

function HeroScene({ cameraApi }) {
  return <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
    <PerspectiveCamera ref={(camera) => { cameraApi.current.camera = camera; }} makeDefault position={[0, 0, 7]} fov={38} />
    <CameraRig cameraApi={cameraApi} />
    <ambientLight intensity={1.4} /><pointLight position={[3, 3, 4]} color="#d8ff59" intensity={12} /><pointLight position={[-4, -2, 2]} color="#816dff" intensity={10} />
    <SignalField /><EffectComposer><Bloom intensity={1.25} luminanceThreshold={0.35} mipmapBlur /><ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation modulationOffset={0.15} /><Noise opacity={0.035} /><Vignette eskil={false} offset={0.22} darkness={0.7} /></EffectComposer><OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.45} />
  </Canvas>;
}

function ProjectForm() {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setSending(true); setStatus("Sending your inquiry...");
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Something went wrong.");
      event.currentTarget.reset(); setStatus(result.message);
    } catch (error) { setStatus(error.message || "Could not send your inquiry."); }
    finally { setSending(false); }
  }
  return <form className="project-form" onSubmit={submit}>
    <div className="form-top"><span>START A PROJECT</span><span>01 / 01</span></div>
    <label>Name<input name="name" placeholder="Jane Smith" required /></label>
    <label>Email<input name="email" type="email" placeholder="jane@company.com" required /></label>
    <label>Focus<select name="service" required defaultValue=""><option value="" disabled>Choose a service</option><option>Website & landing page</option><option>CRM & automation</option><option>Branding & logo</option><option>Social media & SEO</option><option>Something else</option></select></label>
    <label>What are you building?<textarea name="message" rows="4" placeholder="A few words about the next chapter..." required /></label>
    <input className="honeypot" name="website" tabIndex="-1" autoComplete="off" />
    <button className="button button-light" type="submit" disabled={sending}>{sending ? "Sending..." : "Send inquiry ↗"}</button><p className="form-status" aria-live="polite">{status}</p>
  </form>;
}

export default function Home() {
  const page = useRef(null);
  const cameraApi = useRef({ camera: null });
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    const tick = (time) => lenis.raf(time);
    gsap.ticker.add(tick); gsap.ticker.lagSmoothing(0);
    const context = gsap.context(() => {
      gsap.from(".hero-copy > *", { opacity: 0, y: 28, stagger: 0.1, duration: 0.9, ease: "power3.out" });
      gsap.utils.toArray(".reveal").forEach((element) => gsap.from(element, { opacity: 0, y: 45, duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 84%" } }));
      gsap.to(".hero-orbit", { yPercent: 18, rotate: 12, scrollTrigger: { trigger: ".hero", scrub: true } });
      gsap.to(".ticker-track", { xPercent: -22, scrollTrigger: { trigger: ".ticker", scrub: true } });
      gsap.to(".hero-art", { yPercent: 16, rotate: 2, scrollTrigger: { trigger: ".hero", scrub: 1 } });
      gsap.to(cameraApi.current, { z: 5.15, x: 0.35, y: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 } });
      gsap.to(".scroll-progress", { scaleX: 1, ease: "none", scrollTrigger: { scrub: 0.15 } });
      gsap.utils.toArray(".split-line").forEach((line, index) => gsap.from(line, { yPercent: 110, opacity: 0, duration: 0.85, delay: index * 0.06, ease: "power4.out", scrollTrigger: { trigger: line, start: "top 88%" } }));
      const cursorDot = document.querySelector(".cursor-dot");
      const cursorRing = document.querySelector(".cursor-ring");
      const moveDot = gsap.quickTo(cursorDot, "x", { duration: 0.12, ease: "power3" });
      const moveDotY = gsap.quickTo(cursorDot, "y", { duration: 0.12, ease: "power3" });
      const moveRing = gsap.quickTo(cursorRing, "x", { duration: 0.45, ease: "power3" });
      const moveRingY = gsap.quickTo(cursorRing, "y", { duration: 0.45, ease: "power3" });
      const onPointerMove = (event) => {
        moveDot(event.clientX); moveDotY(event.clientY); moveRing(event.clientX); moveRingY(event.clientY);
        const card = event.target.closest(".service-card, .project-form");
        if (card) { const bounds = card.getBoundingClientRect(); card.style.setProperty("--glare-x", `${event.clientX - bounds.left}px`); card.style.setProperty("--glare-y", `${event.clientY - bounds.top}px`); card.style.setProperty("--tilt-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 4}deg`); card.style.setProperty("--tilt-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * -4}deg`); }
      };
      const onEnter = (event) => { if (event.target.closest("a, button, .magnetic")) cursorRing.classList.add("is-active"); };
      const onLeave = (event) => { if (!event.relatedTarget?.closest?.("a, button, .magnetic")) cursorRing.classList.remove("is-active"); };
      window.addEventListener("pointermove", onPointerMove); window.addEventListener("pointerover", onEnter); window.addEventListener("pointerout", onLeave);
      context.add(() => { window.removeEventListener("pointermove", onPointerMove); window.removeEventListener("pointerover", onEnter); window.removeEventListener("pointerout", onLeave); });
    }, page);
    return () => { context.revert(); gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  const closeMenu = () => setMenuOpen(false);
  return <div ref={page} className="site">
    <div className="scroll-progress" aria-hidden="true" />
    <div className="cursor-dot" aria-hidden="true" /><div className="cursor-ring" aria-hidden="true" />
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="header"><a className="brand" href="#top" aria-label="Nexora home"><span className="brand-mark"><i /><i /><i /></span>NEXORA<span>.</span></a><button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation"><span /><span /></button><nav className={menuOpen ? "nav is-open" : "nav"}><a href="#services" onClick={closeMenu}>Services</a><a href="/approach" onClick={closeMenu}>Approach</a><a href="#work" onClick={closeMenu}>Work</a><a className="nav-cta" href="#contact" onClick={closeMenu}>Start a project ↗</a></nav></header>
    <main id="main">
      <section id="top" className="hero section-wrap"><div className="hero-copy"><p className="eyebrow">Digital growth partner <span /></p><h1><span className="split-line">Make your business</span> <span className="split-line"><em>impossible</em> to ignore.</span></h1><p className="hero-intro">We build the presence, systems, and momentum ambitious businesses need to get noticed and grow.</p><div className="hero-actions"><a className="button button-dark magnetic" href="#contact">Let&apos;s grow together ↗</a><a className="under-link" href="#services">Explore services ↓</a></div><div className="hero-proof"><span>Trusted by teams building the future</span><b>north</b><b>alt.</b><b>HŌME</b><b>VANTA</b></div></div><div className="hero-art"><div className="hero-orbit orbit-a" /><div className="hero-orbit orbit-b" /><div className="scene"><HeroScene cameraApi={cameraApi} /></div><span className="art-label label-a">SIGNAL / 01</span><span className="art-label label-b">SYSTEMS THAT MOVE</span></div></section>
      <section className="ticker" aria-label="Capabilities"><div className="ticker-track"><span>Strategy</span><i>✦</i><span>Websites</span><i>✦</i><span>Branding</span><i>✦</i><span>Automation</span><i>✦</i><span>SEO</span><i>✦</i><span>Strategy</span><i>✦</i><span>Websites</span><i>✦</i><span>Branding</span><i>✦</i><span>Automation</span><i>✦</i><span>SEO</span></div></section>
      <section id="services" className="section-wrap services"><div className="section-intro reveal"><div><p className="eyebrow">One partner. Every possibility <span /></p><h2>Digital work with <em>gravity.</em></h2></div><p>Sharp thinking, expressive design, and the technical muscle to make the next move count.</p></div><div className="service-grid">{services.map(([number, title, copy, tone, ending]) => <article className={`service-card ${tone} reveal`} key={number}><span className="card-number">{number}</span><div className="service-icon">↗</div><h3>{title}<br /><em>{ending}</em></h3><p>{copy}</p><a href="#contact">Build momentum ↗</a></article>)}</div></section>
      <section id="approach" className="approach"><div className="section-wrap approach-inner"><div className="reveal"><p className="eyebrow">No jargon. No guesswork <span /></p><h2>From “what if?”<br />to <em>what&apos;s next.</em></h2></div><div className="steps">{[["01", "Discover", "We get curious about your business, your audience, and the opportunity ahead."], ["02", "Define", "We turn insight into a sharp strategy and a roadmap you can believe in."], ["03", "Deliver", "We build, launch, and refine until your digital presence earns its place."]].map(([number, title, copy]) => <div className="step reveal" key={number}><span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div><b>↗</b></div>)}</div></div></section>
      <section id="work" className="section-wrap work"><div className="work-copy reveal"><p className="eyebrow">A glimpse of what&apos;s possible <span /></p><h2>Built for <em>impact.</em></h2><a className="button button-dark" href="#contact">See all projects ↗</a></div><div className="case-study reveal"><div className="case-art"><span>OUT<br />OF<br />OFFICE</span><i /></div><div className="case-meta"><div><small>Branding · Website · SEO</small><h3>Slow days.<br />Big feeling.</h3></div><b>↗</b></div></div></section>
      <section id="contact" className="contact"><div className="section-wrap contact-inner"><div className="contact-copy reveal"><p className="eyebrow">Your next chapter starts here <span /></p><h2>Ready to make<br />some <em>noise?</em></h2><p>Tell us a little about what you&apos;re building. We&apos;ll take it from there.</p><span className="reply-note">✦ Replies within one business day</span></div><ProjectForm /></div></section>
    </main>
    <footer className="footer section-wrap"><a className="brand" href="#top"><span className="brand-mark"><i /><i /><i /></span>NEXORA<span>.</span></a><p>Digital growth, made simple.</p><a href="mailto:hello@nexora.studio">hello@nexora.studio ↗</a></footer>
  </div>;
}