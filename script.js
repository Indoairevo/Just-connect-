const menuButton = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav-links");

menuButton?.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
    menuButton?.setAttribute("aria-label", "Open navigation");
  });
});

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
} else {
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("visible"));
}

const glow = document.querySelector(".cursor-glow");
window.addEventListener("pointermove", (event) => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (glow) {
    glow.style.left = `${event.clientX}px`;
    glow.style.top = `${event.clientY}px`;
  }
});

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!prefersReducedMotion) {
  document.querySelectorAll(".service-card, .work-feature, .button").forEach((element) => {
    element.addEventListener("pointermove", (event) => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty("--tilt-x", `${((event.clientX - bounds.left) / bounds.width - 0.5) * 4}deg`);
      element.style.setProperty("--tilt-y", `${((event.clientY - bounds.top) / bounds.height - 0.5) * -4}deg`);
    });
    element.addEventListener("pointerleave", () => {
      element.style.removeProperty("--tilt-x");
      element.style.removeProperty("--tilt-y");
    });
  });
}

const counters = document.querySelectorAll("[data-count]");
if ("IntersectionObserver" in window && counters.length) {
  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const node = entry.target;
      const target = Number(node.dataset.count);
      if (prefersReducedMotion) {
        node.textContent = target;
        observer.unobserve(node);
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / 1300, 1);
        const value = target * (1 - Math.pow(1 - progress, 3));
        node.textContent = target % 1 ? value.toFixed(1) : Math.round(value);
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      observer.unobserve(node);
    });
  }, { threshold: 0.6 });
  counters.forEach((counter) => counterObserver.observe(counter));
}

const leadForm = document.querySelector("#lead-form");
const formStatus = document.querySelector(".form-status");
leadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = leadForm.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.classList.add("is-loading");
  formStatus.textContent = "Sending your inquiry…";
  formStatus.className = "form-status";

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(leadForm))),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Something went wrong.");
    formStatus.textContent = result.message;
    formStatus.classList.add("success");
    leadForm.reset();
  } catch (error) {
    formStatus.textContent = error.message || "Could not send your inquiry. Please try again.";
    formStatus.classList.add("error");
  } finally {
    submit.disabled = false;
    submit.classList.remove("is-loading");
  }
});
