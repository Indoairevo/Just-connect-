const emailNode = document.querySelector("#admin-email");
const listNode = document.querySelector("#leads-list");
const countNode = document.querySelector("#lead-count");
const serviceNode = document.querySelector("#latest-service");
const latestDateNode = document.querySelector("#latest-date");
const topServiceNode = document.querySelector("#top-service");
const topServiceCountNode = document.querySelector("#top-service-count");
const searchNode = document.querySelector("#lead-search");
const filterNode = document.querySelector("#service-filter");
const resultCountNode = document.querySelector("#result-count");
const dialog = document.querySelector("#lead-dialog");
const proposalForm = document.querySelector("#proposal-form");
const dialogStatusMessage = document.querySelector("#dialog-status-message");
const pipelineTabs = [...document.querySelectorAll(".pipeline-tab")];
let leads = [];
let selectedLead = null;
let statusFilter = "";

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function renderLeads() {
  const query = searchNode.value.trim().toLowerCase();
  const service = filterNode.value;
  const filteredLeads = leads.filter((lead) => {
    const searchable = `${lead.name} ${lead.email} ${lead.phone} ${lead.service} ${lead.message}`.toLowerCase();
    return (!query || searchable.includes(query)) && (!service || lead.service === service) && (!statusFilter || (lead.status || "new") === statusFilter);
  });
  resultCountNode.textContent = filteredLeads.length === leads.length ? `${leads.length} ${leads.length === 1 ? "inquiry" : "inquiries"}` : `${filteredLeads.length} of ${leads.length} shown`;
  listNode.innerHTML = filteredLeads.length ? filteredLeads.map((lead) => `
    <article class="lead-row" data-lead-id="${escapeHtml(lead.id)}" tabindex="0" role="button" aria-label="Review ${escapeHtml(lead.name)}">
      <div class="lead-avatar">${escapeHtml(lead.name.charAt(0).toUpperCase())}</div>
      <div class="lead-details"><strong>${escapeHtml(lead.name)}</strong><span>${escapeHtml(lead.email)}</span><p>${escapeHtml(lead.message)}</p></div>
      <div class="lead-meta"><b class="status-${escapeHtml(lead.status || "new")}">${escapeHtml(lead.status || "new")}</b><time>${formatDate(lead.createdAt)}</time></div>
    </article>`).join("") : `<p class="empty-state">${leads.length ? "No inquiries match your search." : "No inquiries yet. Your next project will appear here."}</p>`;
}

function updateSummary() {
  countNode.textContent = leads.length;
  serviceNode.textContent = leads[0]?.service || "—";
  latestDateNode.textContent = leads[0] ? formatDate(leads[0].createdAt) : "Waiting for data";
  const serviceCounts = leads.reduce((counts, lead) => ({ ...counts, [lead.service]: (counts[lead.service] || 0) + 1 }), {});
  const topService = Object.entries(serviceCounts).sort(([, first], [, second]) => second - first)[0];
  topServiceNode.textContent = topService?.[0] || "—";
  topServiceCountNode.textContent = topService ? `${topService[1]} ${topService[1] === 1 ? "inquiry" : "inquiries"}` : "Based on inquiries";
  document.querySelector("#pipeline-all").textContent = leads.length;
  ["new", "reviewing", "approved", "contacted"].forEach((status) => {
    document.querySelector(`#pipeline-${status}`).textContent = leads.filter((lead) => (lead.status || "new") === status).length;
  });
  const services = [...new Set(leads.map((lead) => lead.service))].sort();
  filterNode.innerHTML = '<option value="">All services</option>' + services.map((service) => `<option value="${escapeHtml(service)}">${escapeHtml(service)}</option>`).join("");
  renderLeads();
}

function proposalMessage(lead) {
  const estimate = document.querySelector("#dialog-estimate").value.trim() || "to be confirmed";
  const budget = document.querySelector("#dialog-budget").value.trim() || "to be confirmed";
  const template = document.querySelector("#message-template").value;
  if (template === "received") return `Hi ${lead.name},\n\nThanks for your inquiry about ${lead.service}. We have received your project details and will review them shortly.\n\nWe will be back in touch within one business day.\n\nBest,\nNexora`;
  if (template === "followup") return `Hi ${lead.name},\n\nJust checking in about your ${lead.service} project. We would be happy to answer any questions and confirm the next step whenever you are ready.\n\nBest,\nNexora`;
  return `Hi ${lead.name},\n\nThanks for reaching out about ${lead.service}. We would be happy to help.\n\nEstimated timeline: ${estimate}\nEstimated investment: ${budget}\n\nWe can confirm the next steps once you reply to this message.\n\nBest,\nNexora`;
}

function updateContactLinks() {
  if (!selectedLead) return;
  const message = proposalMessage(selectedLead);
  document.querySelector("#email-customer").href = `mailto:${selectedLead.email}?subject=${encodeURIComponent(`Your ${selectedLead.service} project with Nexora`)}&body=${encodeURIComponent(message)}`;
  document.querySelector("#sms-customer").href = selectedLead.phone ? `sms:${encodeURIComponent(selectedLead.phone)}?body=${encodeURIComponent(message)}` : "#";
}

function ensurePaymentControls() {
  if (document.querySelector("#payment-fields")) return;
  const deliveryBuilder = document.querySelector(".delivery-builder");
  const fields = document.createElement("div");
  fields.id = "payment-fields";
  fields.className = "payment-fields proposal-wide";
  fields.innerHTML = '<div class="proposal-section-title">Payment tracking</div><label>Payment status<select id="dialog-payment-status"><option value="unpaid">Unpaid</option><option value="deposit_due">Deposit due</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option></select></label><label>Amount<input id="dialog-payment-amount" placeholder="e.g. $1,250" /></label><label>Due date<input id="dialog-payment-due" type="date" /></label><label class="portal-toggle"><input id="dialog-portal-revoked" type="checkbox" /> Disable client portal access</label>';
  (deliveryBuilder || proposalForm).after(fields);
}

function openLead(lead) {
  ensurePaymentControls();
  selectedLead = lead;
  document.querySelector("#dialog-name").textContent = lead.name;
  const emailNode = document.querySelector("#dialog-email");
  emailNode.textContent = lead.email;
  emailNode.href = `mailto:${encodeURIComponent(lead.email)}`;
  const phoneNode = document.querySelector("#dialog-phone");
  phoneNode.textContent = lead.phone || "No phone number provided";
  phoneNode.href = lead.phone ? `tel:${encodeURIComponent(lead.phone)}` : "#";
  document.querySelector("#dialog-message").textContent = lead.message;
  document.querySelector("#dialog-status").value = lead.status || "new";
  document.querySelector("#dialog-estimate").value = lead.estimate || "";
  document.querySelector("#dialog-budget").value = lead.budget || "";
  document.querySelector("#dialog-start-date").value = lead.startDate || "";
  document.querySelector("#dialog-deadline").value = lead.deadline || "";
  document.querySelector("#dialog-revisions").value = lead.revisions || "";
  document.querySelector("#dialog-deliverables").value = lead.deliverables || "";
  document.querySelector("#dialog-payment-terms").value = lead.paymentTerms || "";
  document.querySelector("#dialog-notes").value = lead.adminNotes || "";
  document.querySelector("#dialog-project-status").value = lead.projectStatus || "not_started";
  document.querySelector("#dialog-progress").value = lead.progress || 0;
  document.querySelector("#progress-value").value = `${lead.progress || 0}%`;
  document.querySelector("#dialog-delivery-url").value = lead.deliveryUrl || "";
  document.querySelector("#dialog-delivery-notes").value = lead.deliveryNotes || "";
  document.querySelector("#dialog-payment-status").value = lead.paymentStatus || "unpaid";
  document.querySelector("#dialog-payment-amount").value = lead.paymentAmount || "";
  document.querySelector("#dialog-payment-due").value = lead.paymentDue || "";
  document.querySelector("#dialog-portal-revoked").checked = Boolean(lead.portalRevoked);
  document.querySelector("#client-portal-link").href = lead.clientToken ? `/client.html?token=${encodeURIComponent(lead.clientToken)}` : "#";
  updateContactLinks();
  document.querySelector("#message-preview").value = proposalMessage(lead);
  dialogStatusMessage.textContent = "";
  dialog.showModal();
}

async function loadLeads() {
  const response = await fetch("/api/leads");
  if (response.status === 401) return (window.location.href = "/login.html");
  if (!response.ok) throw new Error("Could not load leads.");
  leads = await response.json();
  updateSummary();
}

async function logMessage(channel) {
  if (!selectedLead) return;
  await fetch(`/api/leads/${encodeURIComponent(selectedLead.id)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, template: document.querySelector("#message-template").value, body: document.querySelector("#message-preview").value }) });
}

async function init() {
  try {
    const me = await fetch("/api/auth/me");
    if (!me.ok) return (window.location.href = "/login.html");
    const result = await me.json();
    emailNode.textContent = result.user.email;
    await loadLeads();
  } catch {
    listNode.innerHTML = '<p class="empty-state error">Could not load inquiries. Try refreshing.</p>';
  }
}

document.querySelector("#refresh-leads")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await loadLeads();
  } catch {
    listNode.innerHTML = '<p class="empty-state error">Could not load inquiries. Try refreshing.</p>';
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#logout")?.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});
listNode.addEventListener("click", (event) => {
  const row = event.target.closest("[data-lead-id]");
  if (row) openLead(leads.find((lead) => lead.id === row.dataset.leadId));
});
listNode.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest("[data-lead-id]");
  if (row) { event.preventDefault(); openLead(leads.find((lead) => lead.id === row.dataset.leadId)); }
});
document.querySelector("#close-dialog")?.addEventListener("click", () => dialog.close());
document.querySelector("#email-customer")?.addEventListener("click", () => logMessage("email"));
document.querySelector("#sms-customer")?.addEventListener("click", () => logMessage("sms"));
proposalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = proposalForm.querySelector("button[type='submit']");
  submit.disabled = true;
  dialogStatusMessage.textContent = "Saving project details…";
  try {
    const proposal = { status: document.querySelector("#dialog-status").value, estimate: document.querySelector("#dialog-estimate").value, budget: document.querySelector("#dialog-budget").value, startDate: document.querySelector("#dialog-start-date").value, deadline: document.querySelector("#dialog-deadline").value, revisions: document.querySelector("#dialog-revisions").value, deliverables: document.querySelector("#dialog-deliverables").value, paymentTerms: document.querySelector("#dialog-payment-terms").value, adminNotes: document.querySelector("#dialog-notes").value, projectStatus: document.querySelector("#dialog-project-status").value, progress: Number(document.querySelector("#dialog-progress").value), deliveryUrl: document.querySelector("#dialog-delivery-url").value, deliveryNotes: document.querySelector("#dialog-delivery-notes").value, paymentStatus: document.querySelector("#dialog-payment-status").value, paymentAmount: document.querySelector("#dialog-payment-amount").value, paymentDue: document.querySelector("#dialog-payment-due").value, portalRevoked: document.querySelector("#dialog-portal-revoked").checked };
    const response = await fetch(`/api/leads/${encodeURIComponent(selectedLead.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(proposal) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not save project details.");
    Object.assign(selectedLead, { ...proposal });
    dialogStatusMessage.textContent = "Project details saved.";
    renderLeads();
  } catch (error) { dialogStatusMessage.textContent = error.message; }
  finally { submit.disabled = false; }
});
proposalForm?.querySelectorAll("input, textarea, select").forEach((field) => field.addEventListener("input", () => { updateContactLinks(); if (field.id !== "dialog-status") document.querySelector("#message-preview").value = proposalMessage(selectedLead); }));
document.querySelector("#dialog-progress")?.addEventListener("input", (event) => { document.querySelector("#progress-value").value = `${event.target.value}%`; });
document.querySelector("#message-template")?.addEventListener("change", () => { updateContactLinks(); document.querySelector("#message-preview").value = proposalMessage(selectedLead); });
document.querySelector("#copy-message")?.addEventListener("click", async () => { await navigator.clipboard.writeText(document.querySelector("#message-preview").value); dialogStatusMessage.textContent = "Message copied to clipboard."; });
pipelineTabs.forEach((tab) => tab.addEventListener("click", () => {
  statusFilter = tab.dataset.status;
  pipelineTabs.forEach((item) => item.classList.toggle("is-active", item === tab));
  renderLeads();
}));
searchNode?.addEventListener("input", renderLeads);
filterNode?.addEventListener("change", renderLeads);
init();
