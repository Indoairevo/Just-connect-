const form = document.querySelector("#login-form");
const status = document.querySelector(".form-status");
form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Signing in…";
  status.className = "form-status";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error);
    window.location.href = "/admin.html";
  } catch (error) {
    status.textContent = error.message || "Unable to sign in.";
    status.classList.add("error");
  } finally {
    button.disabled = false;
  }
});
