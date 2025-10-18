import { useEffect, useMemo, useState } from "react";
import "./index.css";

type Todo = { id: string; text: string; done: boolean; createdAt: number };
type Filter = "all" | "active" | "done";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    setErr(null);
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  async function fetchTodos() {
    setLoading(true);
    try {
      const data = await req<Todo[]>("/todos");
      setTodos(data);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTodos();
  }, []);

  async function addTodo() {
    const v = text.trim();
    if (!v) return;
    setText("");
    await req<Todo[]>("/todos", { method: "POST", body: JSON.stringify({ text: v }) });
    await fetchTodos();
  }

  async function toggleTodo(id: string) {
    await req<Todo[]>(`/todos/${id}/toggle`, { method: "POST" });
    await fetchTodos();
  }

  async function deleteTodo(id: string) {
    await req<Todo[]>(`/todos/${id}`, { method: "DELETE" });
    await fetchTodos();
  }

  async function editTodo(id: string, current: string) {
    const next = (prompt("Edit task", current) ?? "").trim();
    if (!next || next === current) return;
    await req<Todo[]>(`/todos/${id}`, { method: "POST", body: JSON.stringify({ text: next }) });
    await fetchTodos();
  }

  async function clearCompleted() {
    await req<Todo[]>(`/todos`, { method: "DELETE" });
    await fetchTodos();
  }

  const counts = useMemo(() => {
    const total = todos.length;
    const done = todos.filter(t => t.done).length;
    const active = total - done;
    return { total, done, active };
  }, [todos]);

  const view = useMemo(() => {
    if (filter === "active") return todos.filter(t => !t.done);
    if (filter === "done") return todos.filter(t => t.done);
    return todos;
  }, [todos, filter]);

  return (
    <div className="page">
      <div className="card">
        <h3 className="title">My Todos</h3>

        <form
          className="row"
          style={{ gap: 10, marginBottom: 10 }}
          onSubmit={(e) => { e.preventDefault(); void addTodo(); }}
        >
          <input
            className="input"
            placeholder="Add a task…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn" type="submit">Add</button>
        </form>

        <div className="controls">
          <div className="filter">
            <button className={`btn ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}>All</button>
            <button className={`btn ${filter === "active" ? "active" : ""}`} type="button" onClick={() => setFilter("active")}>Active</button>
            <button className={`btn ${filter === "done" ? "active" : ""}`} type="button" onClick={() => setFilter("done")}>Done</button>
          </div>

          <div className="counts">
            {counts.total} total — {counts.active} active, {counts.done} done
          </div>

          {counts.done > 0 && (
            <button className="btn btn-danger" type="button" onClick={() => void clearCompleted()}>
              Clear completed
            </button>
          )}
        </div>

        <div className="list">
          {err && <div className="counts" style={{ color: "#f88" }}>{err}</div>}
          {loading && <div className="counts">Loading…</div>}
          {!loading && view.length === 0 && <div className="counts">No tasks here.</div>}

          {view.map((t) => (
            <div key={t.id} className="row">
              <input
                className="checkbox"
                type="checkbox"
                checked={t.done}
                onChange={() => void toggleTodo(t.id)}
              />
              <span
                className={`todo-text ${t.done ? "done" : ""}`}
                title="Click to edit"
                onClick={() => void editTodo(t.id, t.text)}
                style={{ cursor: "pointer" }}
              >
                {t.text}
              </span>
              <button className="btn btn-danger" type="button" onClick={() => void deleteTodo(t.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
