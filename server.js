const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const port = Number.parseInt(process.env.PORT, 10) || 8080;
const root = __dirname;
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });
const database = new DatabaseSync(path.join(dataDir, "nexora.sqlite"));
const sessionMaxAge = 1000 * 60 * 60 * 24 * 7;
const isProduction = process.env.NODE_ENV === "production";
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};
const authAttempts = new Map();
const authWindowMs = 15 * 60 * 1000;
const authAttemptLimit = 10;
const leadAttempts = new Map();
const leadWindowMs = 60 * 60 * 1000;
const leadAttemptLimit = 20;

database.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lead_messages (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    template TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

for (const statement of [
  "ALTER TABLE leads ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN status TEXT NOT NULL DEFAULT 'new'",
  "ALTER TABLE leads ADD COLUMN estimate TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN budget TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN admin_notes TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN deliverables TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN start_date TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN deadline TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN revisions TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN payment_terms TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN client_token TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN project_status TEXT NOT NULL DEFAULT 'not_started'",
  "ALTER TABLE leads ADD COLUMN progress INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE leads ADD COLUMN delivery_url TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN delivery_notes TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN client_token_expires_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN portal_revoked INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE leads ADD COLUMN customer_response TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN customer_message TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN responded_at TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'",
  "ALTER TABLE leads ADD COLUMN payment_amount TEXT NOT NULL DEFAULT ''",
  "ALTER TABLE leads ADD COLUMN payment_due TEXT NOT NULL DEFAULT ''",
]) {
  try { database.exec(statement); } catch (error) {
    if (!error.message.includes("duplicate column name")) throw error;
  }
}
const defaultTokenExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
database.prepare("UPDATE leads SET client_token_expires_at = ? WHERE client_token_expires_at = ''").run(defaultTokenExpiry);

function isRateLimitedByKey(store, key, windowMs, limit) {
  const now = Date.now();
  const recent = (store.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  store.set(key, recent);
  return recent.length > limit;
}
const leadsWithoutTokens = database.prepare("SELECT id FROM leads WHERE client_token = ''").all();
const setClientToken = database.prepare("UPDATE leads SET client_token = ? WHERE id = ?");
for (const lead of leadsWithoutTokens) setClientToken.run(randomBytes(24).toString("base64url"), lead.id);

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [part.trim(), ""];
    try {
      return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
    } catch {
      return [part.slice(0, index).trim(), ""];
    }
  }));
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function verifyPassword(password, storedHash) {
  const [salt, digest] = storedHash.split(":");
  if (!salt || !digest) return false;
  try {
    const expected = Buffer.from(digest, "hex");
    if (!expected.length || expected.length % 2 !== 0) return false;
    const actual = scryptSync(password, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function hashToken(token) {
  return scryptSync(token, "nexora-session", 32).toString("hex");
}

function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!email || !password) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    throw new Error("ADMIN_EMAIL must be valid and ADMIN_PASSWORD must be at least 12 characters.");
  }
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!existing) {
    database.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
      .run(randomUUID(), email, hashPassword(password), new Date().toISOString());
    console.log(`Created admin account for ${email}`);
  }
}

seedAdmin();

function currentUser(request) {
  const token = parseCookies(request).nexora_session;
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const session = database.prepare(`
    SELECT users.id, users.email, sessions.token_hash
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), new Date().toISOString());
  return session || null;
}

function createSession(userId) {
  const token = randomBytes(32).toString("base64url");
  database.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), userId, new Date(Date.now() + sessionMaxAge).toISOString(), new Date().toISOString());
  return token;
}

function sessionCookie(token, maxAge = sessionMaxAge / 1000) {
  return `nexora_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${isProduction ? "; Secure" : ""}`;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let settled = false;
    request.on("data", (chunk) => {
      if (settled) return;
      body += chunk;
      if (body.length > 100_000) {
        settled = true;
        reject(Object.assign(new Error("Request body too large"), { statusCode: 413 }));
      }
    });
    request.on("end", () => {
      if (settled) return;
      try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON")); }
    });
    request.on("error", reject);
  });
}

function isRateLimited(request) {
  const key = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const recent = (authAttempts.get(key) || []).filter((timestamp) => now - timestamp < authWindowMs);
  recent.push(now);
  authAttempts.set(key, recent);
  return recent.length > authAttemptLimit;
}

function requireAuth(request, response) {
  const user = currentUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Authentication required." });
    return null;
  }
  return user;
}

function isSafeExternalUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function serveFile(request, response) {
  const requestedPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const safePath = path.normalize(requestedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(root, safePath);
  if (!filePath.startsWith(root)) return sendJson(response, 403, { error: "Forbidden" });
  fs.readFile(filePath, (error, content) => {
    if (error) return sendJson(response, error.code === "ENOENT" ? 404 : 500, { error: "File not found" });
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": "default-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
      ...(isProduction ? { "Strict-Transport-Security": "max-age=31536000; includeSubDomains" } : {}),
    });
    response.end(request.method === "HEAD" ? undefined : content);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = requestUrl.pathname;

    if (request.method === "GET" && pathname === "/api/health") {
      return sendJson(response, 200, { ok: true, service: "nexora-api", database: "sqlite", timestamp: new Date().toISOString() });
    }

    if (request.method === "POST" && pathname === "/api/auth/login") {
      if (isRateLimited(request)) {
        return sendJson(response, 429, { error: "Too many sign-in attempts. Please try again later." }, { "Retry-After": String(authWindowMs / 1000) });
      }
      const payload = await readBody(request);
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
        return sendJson(response, 400, { error: "Enter a valid email and password." });
      }
      const user = database.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email);
      if (!user || !verifyPassword(password, user.password_hash)) {
        return sendJson(response, 401, { error: "Invalid email or password." });
      }
      database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
      return sendJson(response, 200, { ok: true, user: { email: user.email } }, { "Set-Cookie": sessionCookie(createSession(user.id)) });
    }

    if (request.method === "POST" && pathname === "/api/auth/logout") {
      const token = parseCookies(request).nexora_session;
      if (token) database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
      return sendJson(response, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
    }

    if (request.method === "GET" && pathname === "/api/auth/me") {
      const user = currentUser(request);
      return sendJson(response, user ? 200 : 401, user ? { authenticated: true, user: { email: user.email } } : { authenticated: false });
    }

    if (request.method === "POST" && pathname === "/api/leads") {
      if (isRateLimitedByKey(leadAttempts, request.socket.remoteAddress || "unknown", leadWindowMs, leadAttemptLimit)) {
        return sendJson(response, 429, { error: "Too many inquiries from this address. Please try again later." }, { "Retry-After": String(leadWindowMs / 1000) });
      }
      const payload = await readBody(request);
      const name = String(payload.name || "").trim();
      const email = String(payload.email || "").trim();
      const phone = String(payload.phone || "").trim();
      const service = String(payload.service || "").trim();
      const message = String(payload.message || "").trim();
      const website = String(payload.website || "").trim();
      if (website) return sendJson(response, 400, { error: "Please complete all fields with a valid email." });
      if (
        !name || name.length > 200 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 ||
        phone.length > 40 ||
        !service || service.length > 100 ||
        !message || message.length > 5000
      ) {
        return sendJson(response, 400, { error: "Please complete all fields with a valid email." });
      }
      database.prepare("INSERT INTO leads (id, name, email, phone, service, message, client_token, client_token_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(randomUUID(), name, email, phone, service, message, randomBytes(24).toString("base64url"), new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(), new Date().toISOString());
      return sendJson(response, 201, { ok: true, message: "Thanks — we’ll be in touch shortly." });
    }

    if (request.method === "GET" && pathname === "/api/leads") {
      if (!requireAuth(request, response)) return;
      return sendJson(response, 200, database.prepare("SELECT id, name, email, phone, service, message, status, estimate, budget, admin_notes AS adminNotes, deliverables, start_date AS startDate, deadline, revisions, payment_terms AS paymentTerms, client_token AS clientToken, client_token_expires_at AS clientTokenExpiresAt, portal_revoked AS portalRevoked, project_status AS projectStatus, progress, delivery_url AS deliveryUrl, delivery_notes AS deliveryNotes, customer_response AS customerResponse, customer_message AS customerMessage, responded_at AS respondedAt, payment_status AS paymentStatus, payment_amount AS paymentAmount, payment_due AS paymentDue, created_at AS createdAt FROM leads ORDER BY created_at DESC").all());
    }

    if (request.method === "PATCH" && pathname.startsWith("/api/leads/")) {
      if (!requireAuth(request, response)) return;
      const id = pathname.slice("/api/leads/".length);
      const payload = await readBody(request);
      const status = String(payload.status || "new").trim();
      const estimate = String(payload.estimate || "").trim();
      const budget = String(payload.budget || "").trim();
      const adminNotes = String(payload.adminNotes || "").trim();
      const deliverables = String(payload.deliverables || "").trim();
      const startDate = String(payload.startDate || "").trim();
      const deadline = String(payload.deadline || "").trim();
      const revisions = String(payload.revisions || "").trim();
      const paymentTerms = String(payload.paymentTerms || "").trim();
      const projectStatus = String(payload.projectStatus || "not_started").trim();
      const progress = Number(payload.progress);
      const deliveryUrl = String(payload.deliveryUrl || "").trim();
      const deliveryNotes = String(payload.deliveryNotes || "").trim();
      const portalRevoked = payload.portalRevoked ? 1 : 0;
      const paymentStatus = String(payload.paymentStatus || "unpaid").trim();
      const paymentAmount = String(payload.paymentAmount || "").trim();
      const paymentDue = String(payload.paymentDue || "").trim();
      const allowedStatuses = ["new", "reviewing", "approved", "contacted", "closed"];
      const allowedProjectStatuses = ["not_started", "in_progress", "review", "delivered", "complete"];
      const allowedPaymentStatuses = ["unpaid", "deposit_due", "partially_paid", "paid"];
      if (!allowedStatuses.includes(status) || !allowedProjectStatuses.includes(projectStatus) || !allowedPaymentStatuses.includes(paymentStatus) || !Number.isInteger(progress) || progress < 0 || progress > 100 || estimate.length > 200 || budget.length > 100 || adminNotes.length > 5000 || deliverables.length > 5000 || startDate.length > 30 || deadline.length > 30 || revisions.length > 100 || paymentTerms.length > 500 || deliveryUrl.length > 1000 || !isSafeExternalUrl(deliveryUrl) || deliveryNotes.length > 5000 || paymentAmount.length > 100 || paymentDue.length > 30) {
        return sendJson(response, 400, { error: "Please provide valid project details." });
      }
      const result = database.prepare("UPDATE leads SET status = ?, estimate = ?, budget = ?, admin_notes = ?, deliverables = ?, start_date = ?, deadline = ?, revisions = ?, payment_terms = ?, project_status = ?, progress = ?, delivery_url = ?, delivery_notes = ?, portal_revoked = ?, payment_status = ?, payment_amount = ?, payment_due = ? WHERE id = ?")
        .run(status, estimate, budget, adminNotes, deliverables, startDate, deadline, revisions, paymentTerms, projectStatus, progress, deliveryUrl, deliveryNotes, portalRevoked, paymentStatus, paymentAmount, paymentDue, id);
      if (!result.changes) return sendJson(response, 404, { error: "Lead not found." });
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && pathname.startsWith("/api/client-project/")) {
      const token = pathname.slice("/api/client-project/".length);
      const project = database.prepare("SELECT name, service, status, estimate, budget, deliverables, start_date AS startDate, deadline, revisions, payment_terms AS paymentTerms, project_status AS projectStatus, progress, delivery_url AS deliveryUrl, delivery_notes AS deliveryNotes, payment_status AS paymentStatus, payment_amount AS paymentAmount, payment_due AS paymentDue FROM leads WHERE client_token = ? AND client_token_expires_at > ? AND portal_revoked = 0 AND status IN ('approved', 'contacted')").get(token, new Date().toISOString());
      if (!project) return sendJson(response, 404, { error: "Project not found." });
      return sendJson(response, 200, project);
    }

    if (request.method === "POST" && pathname.startsWith("/api/client-project/") && pathname.endsWith("/response")) {
      const token = pathname.slice("/api/client-project/".length, -"/response".length);
      const payload = await readBody(request);
      const responseType = String(payload.response || "").trim();
      const customerMessage = String(payload.message || "").trim();
      if (!["accepted", "changes_requested", "declined"].includes(responseType) || customerMessage.length > 5000) return sendJson(response, 400, { error: "Please provide a valid response." });
      const result = database.prepare("UPDATE leads SET customer_response = ?, customer_message = ?, responded_at = ? WHERE client_token = ? AND client_token_expires_at > ? AND portal_revoked = 0 AND status IN ('approved', 'contacted')")
        .run(responseType, customerMessage, new Date().toISOString(), token, new Date().toISOString());
      if (!result.changes) return sendJson(response, 404, { error: "Project not found." });
      return sendJson(response, 200, { ok: true, message: "Your response has been sent." });
    }

    if (request.method === "POST" && pathname.startsWith("/api/leads/") && pathname.endsWith("/messages")) {
      if (!requireAuth(request, response)) return;
      const id = pathname.slice("/api/leads/".length, -"/messages".length);
      const payload = await readBody(request);
      const channel = String(payload.channel || "").trim();
      const template = String(payload.template || "").trim();
      const body = String(payload.body || "").trim();
      if (!["email", "sms"].includes(channel) || !template || !body || body.length > 10000) return sendJson(response, 400, { error: "Please provide valid message details." });
      const result = database.prepare("INSERT INTO lead_messages (id, lead_id, channel, template, body, created_at) SELECT ?, id, ?, ?, ?, ? FROM leads WHERE id = ?")
        .run(randomUUID(), channel, template, body, new Date().toISOString(), id);
      if (!result.changes) return sendJson(response, 404, { error: "Lead not found." });
      return sendJson(response, 201, { ok: true });
    }

    if (request.method === "GET" || request.method === "HEAD") return serveFile(request, response);
    return sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    return sendJson(response, error.statusCode === 413 || error.message === "Invalid JSON" ? error.statusCode || 400 : 500, {
      error: error.statusCode === 413 ? error.message : error.message === "Invalid JSON" ? "Request body must be valid JSON." : "Unexpected server error.",
    });
  }
});

server.listen(port, () => console.log(`Nexora running at http://localhost:${port}`));
