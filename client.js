const query = new URLSearchParams(window.location.search);
const token = query.get("token");
const loadingNode = document.querySelector("#client-loading");
const errorNode = document.querySelector("#client-error");
const projectNode = document.querySelector("#client-project");

const statusLabels = {
  not_started: "Not started",
  in_progress: "In progress",
  review: "In review",
  delivered: "Delivered",
  complete: "Complete",
};

function setText(selector, value, fallback = "-") {
  document.querySelector(selector).textContent = value || fallback;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function loadProject() {
  if (!token) throw new Error("Missing project token");
  const response = await fetch(`/api/client-project/${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("Project not found");
  return response.json();
}

loadProject().then((project) => {
  setText("#client-name", project.name);
  setText("#client-service", project.service);
  setText("#client-status", statusLabels[project.projectStatus] || "In progress");
  setText("#client-progress-value", `${project.progress || 0}%`);
  document.querySelector("#client-progress-bar").style.width = `${project.progress || 0}%`;
  setText("#client-deliverables", project.deliverables, "Your project scope will appear here shortly.");
  setText("#client-estimate", project.estimate);
  setText("#client-deadline", formatDate(project.deadline));
  setText("#client-revisions", project.revisions);
  setText("#client-notes", project.deliveryNotes, "We will share the next update here as the project moves forward.");
  setText("#client-payment", project.paymentStatus === "paid" ? "Paid" : project.paymentAmount ? `${project.paymentStatus.replaceAll("_", " ")} - ${project.paymentAmount}` : project.paymentStatus.replaceAll("_", " "));
  const delivery = document.querySelector("#client-delivery");
  if (project.deliveryUrl && /^https?:\/\//i.test(project.deliveryUrl)) { delivery.href = project.deliveryUrl; delivery.hidden = false; }
  const title = project.projectStatus === "complete" ? "Your project is complete." : project.projectStatus === "delivered" ? "Your delivery is ready." : project.projectStatus === "review" ? "Your project is in review." : "We are getting started.";
  setText("#client-next-title", title);
  loadingNode.hidden = true;
  projectNode.hidden = false;
}).catch(() => {
  loadingNode.hidden = true;
  errorNode.hidden = false;
});

document.querySelector("#client-response-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = event.currentTarget.querySelector("button");
  const statusNode = document.querySelector("#client-response-status");
  submit.disabled = true;
  statusNode.textContent = "Sending response...";
  try {
    const response = await fetch(`/api/client-project/${encodeURIComponent(token)}/response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response: document.querySelector("#client-response").value, message: document.querySelector("#client-response-message").value }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not send response.");
    statusNode.textContent = result.message;
    event.currentTarget.reset();
  } catch (error) { statusNode.textContent = error.message; }
  finally { submit.disabled = false; }
});
