import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { makeStore, openDb } from "../../api/src/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const server = new McpServer({ name: "todo-mcp", version: "1.0.0" });

const dbPath = join(__dirname, "..", "..", "api", "todos.db");
const store = makeStore(openDb(dbPath));

const widgetPath = join(__dirname, "..", "widget-dist", "widget.js");

server.registerResource(
  "todo-widget",
  "ui://widget/todos.html",
  {},
  async () => {
    const widgetJs = existsSync(widgetPath)
      ? readFileSync(widgetPath, "utf8")
      : `<p style="padding:12px">Widget not built yet. Run: <code>npm run build -w mcp-server</code></p>`;

    return {
      contents: [
        {
          uri: "ui://widget/todos.html",
          mimeType: "text/html+skybridge",
          text: `
<div id="root"><div style="font:14px/1.4 system-ui;padding:8px;color:#bbb">Widget shell loaded…</div></div>
<script>${widgetJs}</script>`.trim()
        }
      ]
    };
  }
);

const ZTodo = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean(),
  createdAt: z.number()
});
const ZTodos = z.array(ZTodo);

const meta = {
  "openai/outputTemplate": "ui://widget/todos.html",
  "openai/widgetAccessible": true,
  "openai/toolInvocation/invoking": "Updating…",
  "openai/toolInvocation/invoked": "Updated."
} as const;


server.registerTool(
  "list_todos",
  { 
    title: "List todos", 
    description: "Return all todos", 
    inputSchema: {}, 
    outputSchema: { todos: ZTodos }, 
    _meta: meta 
  },
  async () => ({ 
    content: [{ type: "text", text: "Fetched todos." }], 
    structuredContent: { todos: store.list() } 
  })
);

server.registerTool(
  "add_todo",
  { 
    title: "Add todo", 
    description: "Add a new todo", 
    inputSchema: { text: z.string().min(1) }, 
    outputSchema: { todos: ZTodos }, 
    _meta: meta 
  },
  async ({ text }) => { 
    store.add(text); 
    return { 
      content: [{ type: "text", text: `Added: ${text}` }], 
      structuredContent: { todos: store.list() } 
    }; 
  }
);

server.registerTool(
  "toggle_todo",
  { 
    title: "Toggle todo", 
    description: "Toggle done by id", 
    inputSchema: { id: z.string() }, 
    outputSchema: { todos: ZTodos }, 
    _meta: meta 
  },
  async ({ id }) => { 
    store.toggle(id); 
    return { 
      content: [{ type: "text", text: `Toggled: ${id}` }], 
      structuredContent: { todos: store.list() } 
    };
  }
);

server.registerTool(
  "edit_todo",
  { title: "Edit todo", description: "Edit text by id", inputSchema: { id: z.string(), text: z.string().min(1) }, outputSchema: { todos: ZTodos }, _meta: meta },
  async ({ id, text }) => { store.edit(id, text); return { content: [{ type: "text", text: `Edited: ${id}` }], structuredContent: { todos: store.list() } }; }
);

server.registerTool(
  "clear_completed",
  { title: "Clear completed", description: "Remove all completed todos", inputSchema: {}, outputSchema: { todos: ZTodos }, _meta: meta },
  async () => { store.clearCompleted(); return { content: [{ type: "text", text: "Cleared completed." }], structuredContent: { todos: store.list() } }; }
);

server.registerTool(
  "delete_todo",
  { 
    title: "Delete todo",
    description: "Delete by id", 
    inputSchema: { id: z.string() }, 
    outputSchema: { todos: ZTodos }, 
    _meta: meta 
  },
  async ({ id }) => { 
    store.remove(id); 
    return { 
      content: [{ type: "text", text: `Deleted: ${id}` }], 
      structuredContent: { todos: store.list() } 
    }; 
  }
);

// HTTP transport
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`MCP server → http://localhost:${PORT}/mcp`);
});
