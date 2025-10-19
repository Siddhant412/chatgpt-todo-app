import "dotenv/config";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetch,
  RequestInit as URequestInit,
  HeadersInit as UHeadersInit,
} from "undici";
import { decodeJwt } from "jose";
import { z } from "zod";

import { verifyAccessToken, wwwAuthHeader, formatBearer } from "./auth.js";

const BASE_URL = process.env.BASE_URL!;
const ISSUER = process.env.ISSUER!;
const AUDIENCE = process.env.AUDIENCE!;
const API_URL = process.env.API_URL || "http://localhost:4000";

if (!BASE_URL || !ISSUER || !AUDIENCE) {
  console.error("Missing env: BASE_URL, ISSUER, or AUDIENCE");
  process.exit(1);
}
console.log("[MCP] Using API_URL =", API_URL);

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// request logger
app.use((req, _res, next) => {
  console.log(`[MCP] ${req.method} ${req.path}`);
  next();
});

// helpers
const asAny = <T>(v: T) => v as any;

type IdArg = { id: string };
type TextArg = { text: string };
type EditArgs = { id: string; text: string };

// Cache latest Authorization header per session id (for UI refreshes where host may omit auth)
const latestAuthBySession = new Map<string, string>();
function sessionIdFromReq(req: import("express").Request): string {
  return (req.get("x-mcp-session") || "default").toString();
}

// capture session, auth for every /mcp call
app.use((req, _res, next) => {
  if (req.path === "/mcp") {
    const sid = sessionIdFromReq(req);
    const auth = req.get("authorization");
    if (auth) latestAuthBySession.set(sid, auth);
    console.log(`[MCP] ${req.method} /mcp sid=${sid} auth=${auth ? "yes" : "no"}`);
  }
  next();
});

// Read Authorization header from the HTTP transport extras (untyped),
// or fall back to the per-session cache.
function getRawBearer(extra: any): string {
  const h =
    extra?.request?.headers?.get?.("authorization") ??
    extra?.request?.headers?.get?.("Authorization");
  if (h) return String(h);

  const sid =
    extra?.request?.headers?.get?.("x-mcp-session") ??
    extra?.request?.headers?.get?.("X-MCP-Session") ??
    "default";
  const cached = latestAuthBySession.get(String(sid));
  return cached || "";
}

function logTokenPreview(bearer: string) {
  const formatted = formatBearer(bearer);
  if (!formatted) {
    if (bearer) {
      console.warn(
        "[MCP] Bearer present but not recognized (first 18):",
        JSON.stringify(bearer.slice(0, 18))
      );
    }
    return;
  }
  const raw = formatted.slice(7);
  try {
    const claims = decodeJwt(raw);
    console.log("[MCP] token aud:", (claims as any).aud, "scope:", (claims as any).scope);
  } catch (e) {
    console.log("[MCP] could not decode token:", (e as Error).message);
  }
}

const ok = (todos: any[]) =>
  asAny({
    content: [{ type: "text", text: "" }],
    structuredContent: { todos },
  });

// Minimal API proxy (forwards Authorization)
async function api<T = any>(
  bearer: string,
  path: string,
  init: URequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {};

  // normalize headers passed by callers
  if (init.headers) {
    const entries =
      Array.isArray(init.headers)
        ? init.headers
        : init.headers instanceof Map
        ? Array.from(init.headers.entries())
        : typeof init.headers === "object"
        ? Object.entries(init.headers as Record<string, string>)
        : [];
    for (const [k, v] of entries) headers[String(k)] = String(v);
  }

  headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  if (bearer) headers["Authorization"] = bearer;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: headers as UHeadersInit,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// MCP server
const server = new McpServer({
  name: "todo-mcp",
  version: "1.0.0",
});

// Widget resource (HTML + bundled JS)
server.registerResource("todo-widget", "ui://widget/todos.html", {}, async () => {
  const widgetPath = join(__dirname, "..", "widget-dist", "widget.js");
  const widgetJs = existsSync(widgetPath)
    ? readFileSync(widgetPath, "utf8")
    : `<p style="padding:12px">Widget not built yet. Run: <code>npm run build -w mcp-server</code></p>`;
  return {
    contents: [
      {
        uri: "ui://widget/todos.html",
        mimeType: "text/html+skybridge",
        text: `<div id="root"></div><script>${widgetJs}</script>`,
      },
    ],
  };
});

const ZTodo = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  createdAt: z.number(),
});
const ZTodos = z.array(ZTodo);

const OutputTodosShape = { todos: ZTodos };

// Tools

// 1) List todos
server.registerTool(
  "list_todos",
  asAny({
    title: "List Todos",
    description: "Return all todos for the current user",
    inputSchema: {},
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.read"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (_args: Record<string, any>, extra) => {
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, "/todos");
    return ok(data.todos);
  }
);

// 2) Add todo
server.registerTool(
  "add_todo",
  asAny({
    title: "Add Todo",
    description: "Create a new todo",
    inputSchema: { text: z.string().min(1) },
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.write"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (args: Record<string, any>, extra) => {
    const { text } = args as TextArg;
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, "/todos", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    return ok(data.todos);
  }
);

// 3) Toggle todo
server.registerTool(
  "toggle_todo",
  asAny({
    title: "Toggle Todo",
    description: "Toggle done/undone",
    inputSchema: { id: z.string() },
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.write"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (args: Record<string, any>, extra) => {
    const { id } = args as IdArg;
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, `/todos/${id}/toggle`, {
      method: "POST",
    });
    return ok(data.todos);
  }
);

// 4) Edit todo
server.registerTool(
  "edit_todo",
  asAny({
    title: "Edit Todo",
    description: "Change todo text",
    inputSchema: { id: z.string(), text: z.string().min(1) },
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.write"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (args: Record<string, any>, extra) => {
    const { id, text } = args as EditArgs;
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, `/todos/${id}`, {
      method: "PUT",
      body: JSON.stringify({ text }),
    });
    return ok(data.todos);
  }
);

// 5) Delete todo
server.registerTool(
  "delete_todo",
  asAny({
    title: "Delete Todo",
    description: "Delete a todo by id",
    inputSchema: { id: z.string() },
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.delete"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (args: Record<string, any>, extra) => {
    const { id } = args as IdArg;
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, `/todos/${id}`, {
      method: "DELETE",
    });
    return ok(data.todos);
  }
);

// 6) Clear completed
server.registerTool(
  "clear_completed",
  asAny({
    title: "Clear Completed",
    description: "Remove all completed todos",
    inputSchema: {},
    outputSchema: OutputTodosShape,
    securitySchemes: [{ type: "oauth2", scopes: ["todo.delete"] }],
    _meta: {
      "openai/outputTemplate": "ui://widget/todos.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Updating…",
      "openai/toolInvocation/invoked": "Updated.",
    },
  }),
  async (_args: Record<string, any>, extra) => {
    const rawBearer = getRawBearer(extra);
    const bearer = formatBearer(rawBearer) || "";
    logTokenPreview(rawBearer);
    const data = await api<{ todos: any[] }>(bearer, `/todos/clear-completed`, {
      method: "POST",
    });
    return ok(data.todos);
  }
);

// OAuth Protected Resource metadata
app.get("/.well-known/oauth-protected-resource", (_req, res) => {
  res.json({
    resource: `${BASE_URL}/mcp`,
    authorization_servers: [ISSUER],
    scopes_supported: ["todo.read", "todo.write", "todo.delete"],
    resource_name: "ToDo MCP",
  });
});

// HTTP transport with preflight auth check
app.post("/mcp", async (req, res) => {
  try {
    const body = req.body as
      | { jsonrpc?: string; id?: string | number | null; method?: string; params?: any }
      | undefined;

    if (body?.method === "tools/call") {
      const bearer = req.header("authorization") ?? "";
      console.log("[MCP] Preflight Authorization (first 14):", JSON.stringify(bearer.slice(0, 14)));
      const payload = await verifyAccessToken(bearer).catch(() => null);
      if (!payload) {
        res.set(
          "WWW-Authenticate",
          wwwAuthHeader(new URL("/.well-known/oauth-protected-resource", BASE_URL).toString())
        );
        return res.status(401).json({
          jsonrpc: "2.0",
          id: body.id ?? null,
          error: { code: -32001, message: "Unauthorized" },
        });
      }
    }
  } catch {
    // transport handles regular JSON-RPC errors
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`MCP server → ${BASE_URL}/mcp`);
  console.log(`Protected Resource Metadata → ${BASE_URL}/.well-known/oauth-protected-resource`);
});
