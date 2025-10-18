export {};

declare global {
  interface Window {
    openai?: {
      callTool?: (name: string, args?: Record<string, any>) => Promise<any>;
    };
  }
}

type Todo = { id: string; text: string; done: boolean; createdAt: number };
type Filter = "all" | "active" | "done";

function injectStyles() {
  const css = `
:root{
  --bg:#0b0d10;
  --card:#161a1f;
  --card-border:#2b3138;
  --text:#e9eaee;
  --muted:#a9b0bb;
  --input:#0f1318;
  --input-border:#3a414a;
  --btn:#222a33;
  --btn-hover:#2c3440;
  --danger:#3b2729;
  --danger-border:#6b2f2f;
  --accent:#79a7ff;
  --shadow:0 10px 30px rgba(0,0,0,.35);
}
@media (prefers-color-scheme: light){
  :root{
    --bg:#f7f8fa;
    --card:#ffffff;
    --card-border:#e7e9ee;
    --text:#0f1720;
    --muted:#526074;
    --input:#fff;
    --input-border:#ccd3dd;
    --btn:#f3f5f8;
    --btn-hover:#e9edf3;
    --danger:#ffeaea;
    --danger-border:#ffb4b4;
    --accent:#3b82f6;
    --shadow:0 8px 24px rgba(0,0,0,.08);
  }
}
*{box-sizing:border-box}
body{color:var(--text)}
.card{
  background:var(--card);
  border:1px solid var(--card-border);
  border-radius:18px;
  padding:20px;
  box-shadow:var(--shadow);
}
.title{margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:.2px}
.row{display:flex;align-items:center;gap:12px}
.controls{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 6px}
.counts{color:var(--muted);font-size:13px}
.filter{display:flex;gap:8px}
.btn{
  padding:8px 12px;border-radius:10px;border:1px solid var(--input-border);
  background:var(--btn);color:var(--text);cursor:pointer;line-height:1;
}
.btn:hover{background:var(--btn-hover)}
.btn.active{background:#354051}
.btn-danger{background:var(--danger);border-color:var(--danger-border)}
.input{
  height:44px;width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--input-border);
  background:var(--input);color:var(--text);outline:none;
}
.input::placeholder{color:var(--muted)}
.input:focus,.btn:focus{outline:2px solid var(--accent);outline-offset:2px}
.list{display:grid;gap:10px;margin-top:8px}
.todo-text{flex:1}
.todo-text.done{text-decoration:line-through;opacity:.55}
.checkbox{width:18px;height:18px;transform:scale(1.15);accent-color:var(--accent);cursor:pointer}
  `.trim();

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

function h(
  tag: string,
  attrs: Record<string, any> = {},
  children: (Node | string)[] = []
) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") (el as any)[k.toLowerCase()] = v;
    else if (v != null) el.setAttribute(k, String(v));
  }
  for (const c of children) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

injectStyles();

const root = document.getElementById("root")!;
const container = h("div", { class: "card" });

const title = h("h3", { class: "title" }, ["My Todos"]);

const formRow = h("form", { class: "row", style: { gap: "10px", marginBottom: "10px" } });
const input = h("input", { class: "input", placeholder: "Add a task…" }) as HTMLInputElement;
const addBtn = h("button", { class: "btn", type: "submit" }, ["Add"]);

const controls = h("div", { class: "controls" });
const filterBar = h("div", { class: "filter" });
const btnAll = h("button", { class: "btn active", type: "button" }, ["All"]) as HTMLButtonElement;
const btnActive = h("button", { class: "btn", type: "button" }, ["Active"]) as HTMLButtonElement;
const btnDone = h("button", { class: "btn", type: "button" }, ["Done"]) as HTMLButtonElement;
filterBar.append(btnAll, btnActive, btnDone);

const counts = h("div", { class: "counts" }, ["—"]);
const clearBtn = h("button", { class: "btn btn-danger", type: "button" }, ["Clear completed"]) as HTMLButtonElement;

controls.append(filterBar, counts, clearBtn);

const list = h("div", { class: "list" });

formRow.append(input, addBtn);
container.append(title, formRow, controls, list);
root.replaceChildren(container);

let stateTodos: Todo[] = [];
let currentFilter: Filter = "all";
let refreshing = false;

function setActiveFilter(f: Filter) {
  currentFilter = f;
  btnAll.classList.toggle("active", f === "all");
  btnActive.classList.toggle("active", f === "active");
  btnDone.classList.toggle("active", f === "done");
  render();
}

btnAll.onclick = () => setActiveFilter("all");
btnActive.onclick = () => setActiveFilter("active");
btnDone.onclick = () => setActiveFilter("done");

async function callTool(name: string, args?: Record<string, any>) {
  try {
    return await window.openai?.callTool?.(name, args);
  } catch (e) {
    console.error("callTool failed:", e);
    return undefined;
  }
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const res = await callTool("list_todos", {});
    const next = (res?.structuredContent?.todos ?? stateTodos) as Todo[];
    if (Array.isArray(next)) stateTodos = next;
    render();
  } finally {
    refreshing = false;
  }
}

function render() {
  const todos = stateTodos;

  const total = todos.length;
  const done = todos.filter(t => t.done).length;
  const active = total - done;
  counts.textContent = `${total} total — ${active} active, ${done} done`;
  clearBtn.style.display = done > 0 ? "inline-block" : "none";

  let view = todos;
  if (currentFilter === "active") view = todos.filter(t => !t.done);
  else if (currentFilter === "done") view = todos.filter(t => t.done);

  list.innerHTML = "";
  if (!view.length) {
    list.append(h("div", { class: "counts" }, ["No tasks here."]));
    return;
  }

  for (const t of view) {
    const row = h("div", { class: "row" });

    const cb = h("input", { type: "checkbox", class: "checkbox" }) as HTMLInputElement;
    cb.checked = t.done;
    cb.addEventListener("change", async () => {
      await callTool("toggle_todo", { id: t.id });
      await refresh();
    });

    const text = h("span", {
      class: `todo-text${t.done ? " done" : ""}`,
      title: "Click to edit"
    }, [t.text]) as HTMLSpanElement;

    text.addEventListener("click", async () => {
      const next = (prompt("Edit task", t.text) ?? "").trim();
      if (!next || next === t.text) return;
      await callTool("edit_todo", { id: t.id, text: next });
      await refresh();
    });

    const del = h("button", { class: "btn btn-danger", type: "button" }, ["Delete"]) as HTMLButtonElement;
    del.addEventListener("click", async () => {
      await callTool("delete_todo", { id: t.id });
      await refresh();
    });

    row.append(cb, text, del);
    list.append(row);
  }
}

formRow.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = input.value.trim();
  if (!v) return;
  input.value = "";
  await callTool("add_todo", { text: v });
  await refresh();
});

clearBtn.onclick = async () => {
  await callTool("clear_completed", {});
  await refresh();
};

refresh();
window.addEventListener("openai:set_globals", () => refresh());

render();
