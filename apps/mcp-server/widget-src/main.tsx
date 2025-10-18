export {};

declare global {
  interface Window {
    openai?: {
      callTool?: (name: string, args?: Record<string, any>) => Promise<any>;
      toolOutput?: any;
    };
  }
}

type Todo = { id: string; text: string; done: boolean; createdAt: number };

function getTodos(): Todo[] {
  try {
    return (window.openai?.toolOutput?.todos ?? []) as Todo[];
  } catch {
    return [];
  }
}

function h(
  tag: string,
  attrs: Record<string, any> = {},
  children: (Node | string)[] = []
) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function")
      (el as any)[k.toLowerCase()] = v;
    else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

const root = document.getElementById("root")!;
const app = h("div", {
  id: "app",
  style: {
    padding: "12px",
    maxWidth: "560px",
    margin: "0 auto",
    fontFamily: "system-ui,-apple-system,Segoe UI,Roboto,sans-serif"
  }
});

const title = h("h3", {}, ["My Todos"]);
const form = h("form", { id: "f", style: { display: "flex", gap: "8px", marginBottom: "12px" } });
const input = h("input", {
  id: "t",
  placeholder: "Add a task…",
  style: {
    flex: "1",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #444",
    background: "#111",
    color: "#eee"
  }
}) as HTMLInputElement;
const addBtn = h("button", {
  type: "submit",
  style: {
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #444",
    background: "#222",
    color: "#eee"
  }
}, ["Add"]);
const list = h("div", { id: "list", style: { display: "grid", gap: "10px" } });

form.append(input, addBtn);
app.append(title, form, list);
root.innerHTML = "";
root.append(app);

function render(todos: Todo[] = getTodos()) {
  list.innerHTML = "";
  if (!todos.length) {
    list.append(h("div", { style: { color: "#aaa" } }, ["No tasks yet."]));
    return;
  }
  for (const t of todos) {
    const row = h("div", { class: "row", style: { display: "flex", alignItems: "center", gap: "10px" } });
    const cb = h("input", { type: "checkbox" }) as HTMLInputElement;
    cb.checked = t.done;
    cb.addEventListener("change", async () => {
      await window.openai?.callTool?.("toggle_todo", { id: t.id });
      await refresh();
    });

    const text = h("span", {
      style: {
        flex: "1",
        textDecoration: t.done ? "line-through" : "none",
        opacity: t.done ? "0.5" : "1"
      }
    }, [t.text]);

    const del = h("button", {
      style: {
        padding: "6px 10px",
        borderRadius: "8px",
        border: "1px solid #444",
        background: "#222",
        color: "#eee"
      }
    }, ["Delete"]);
    del.addEventListener("click", async () => {
      await window.openai?.callTool?.("delete_todo", { id: t.id });
      await refresh();
    });

    row.append(cb, text, del);
    list.append(row);
  }
}

async function refresh() {
  const res = await window.openai?.callTool?.("list_todos", {});
  const next = (res?.structuredContent?.todos ?? getTodos()) as Todo[];
  render(next);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;
  input.value = "";
  await window.openai?.callTool?.("add_todo", { text: v });
  await refresh();
});

window.addEventListener("openai:set_globals", () => render());

render();
