import "dotenv/config";
import express from "express";
import cors from "cors";
import { openDb, makeStore } from "./db";
import { verifyAccessToken } from "./auth";

const app = express();
app.use(express.json());
app.use(cors({ origin: true }));

// Env, startup logs
const ISSUER = process.env.ISSUER!;
const AUDIENCE = process.env.AUDIENCE!;
if (!ISSUER || !AUDIENCE) {
  console.error("Missing env: ISSUER or AUDIENCE");
  process.exit(1);
}
console.log("[API] ISSUER  =", ISSUER);
console.log("[API] AUDIENCE=", AUDIENCE);

// advertising how to get a token
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  const issuer = ISSUER.endsWith("/") ? ISSUER : `${ISSUER}/`;
  res.json({
    issuer,                                  // where to get/validate tokens
    jwks_uri: `${issuer}.well-known/jwks.json`,
    resource: AUDIENCE,                      // the required aud
    scopes_supported: ["todo.read", "todo.write", "todo.delete"],
    authorization_servers: [issuer],
  });
});

// Auth helpers
function mergeScopes(payload: any): Set<string> {
  const perms = Array.isArray(payload?.permissions) ? payload.permissions as string[] : [];
  const scopeStr = typeof payload?.scope === "string" ? (payload.scope as string) : "";
  const scopeList = scopeStr.split(" ").filter(Boolean);
  return new Set<string>([...perms, ...scopeList]);
}

function requireScopes(required: string[]) {
  return (req: any, res: any, next: any) => {
    const granted = mergeScopes(req.auth);
    const ok = required.every((s) => granted.has(s));
    if (!ok) return res.status(403).json({ error: `Missing scope(s): ${required.join(" ")}` });
    next();
  };
}

// Verifies token and attaches req.auth + req.user.sub
app.use(async (req: any, res, next) => {
  try {
    const bearer = req.headers.authorization as string | undefined;
    const payload = await verifyAccessToken(bearer);
    if (!payload) {
      // hint header for OAuth clients
      res.setHeader(
        "WWW-Authenticate",
        `Bearer resource_metadata="${req.protocol}://${req.get("host")}/.well-known/oauth-protected-resource"`
      );
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.auth = payload;
    req.user = { sub: (payload as any).sub as string };
    next();
  } catch (e: any) {
    console.error("[API] Auth verify error:", e?.message || e);
    return res.status(401).json({ error: "Unauthorized" });
  }
});

// Data store
const store = makeStore(openDb());

// Routes
// Me (for debugging)
app.get("/me", (req: any, res) => {
  res.json({
    sub: req.user.sub,
    permissions: Array.isArray(req.auth?.permissions) ? req.auth.permissions : [],
    scope: req.auth?.scope ?? "",
    aud: req.auth?.aud,
    iss: req.auth?.iss,
  });
});

// List
app.get("/todos", requireScopes(["todo.read"]), (req: any, res) => {
  res.json({ todos: store.list(req.user.sub) });
});

// Add
app.post("/todos", requireScopes(["todo.write"]), (req: any, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  store.add(req.user.sub, text);
  res.json({ todos: store.list(req.user.sub) });
});

// Toggle
app.post("/todos/:id/toggle", requireScopes(["todo.write"]), (req: any, res) => {
  store.toggle(req.user.sub, req.params.id);
  res.json({ todos: store.list(req.user.sub) });
});

// Edit
app.put("/todos/:id", requireScopes(["todo.write"]), (req: any, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  store.edit(req.user.sub, req.params.id, text);
  res.json({ todos: store.list(req.user.sub) });
});

// Delete one
app.delete("/todos/:id", requireScopes(["todo.delete"]), (req: any, res) => {
  store.remove(req.user.sub, req.params.id);
  res.json({ todos: store.list(req.user.sub) });
});

// Clear completed
app.post("/todos/clear-completed", requireScopes(["todo.delete"]), (req: any, res) => {
  store.clearCompleted(req.user.sub);
  res.json({ todos: store.list(req.user.sub) });
});

// DELETE /todos to clear
app.delete("/todos", requireScopes(["todo.delete"]), (req: any, res) => {
  store.clearCompleted(req.user.sub);
  res.json({ todos: store.list(req.user.sub) });
});

// Error logger
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[API] Error:", err?.code || err?.name || "Error", err?.message || err);
  res.status(err?.status || 500).json({ error: err?.message || "error" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`API on http://localhost:${PORT}`);
});
