import { useEffect, useMemo, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { useApi, type Todo } from "./lib/api";

type Filter = "all" | "active" | "done";

function AppInner() {
  const { user, logout, isAuthenticated, isLoading: authLoading, error: authError } = useAuth0();
  const { listTodos, addTodo, toggleTodo, editTodo, deleteTodo, clearCompleted } = useApi();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  async function refresh() {
    setLoading(true);
    try {
      const items = await listTodos();
      setTodos(items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) void refresh();
  }, [isAuthenticated]);

  const counts = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((t) => t.done).length;
    const active = total - done;
    return { total, active, done };
  }, [todos]);

  const visible = useMemo(() => {
    if (filter === "active") return todos.filter((t) => !t.done);
    if (filter === "done") return todos.filter((t) => t.done);
    return todos;
  }, [todos, filter]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    setText("");
    const items = await addTodo(v);
    setTodos(items);
  }

  async function handleToggle(id: string) {
    const items = await toggleTodo(id);
    setTodos(items);
  }

  async function handleEdit(id: string) {
    const current = todos.find((t) => t.id === id);
    if (!current) return;
    const next = (prompt("Edit task", current.text) ?? "").trim();
    if (!next || next === current.text) return;
    const items = await editTodo(id, next);
    setTodos(items);
  }

  async function handleDelete(id: string) {
    const items = await deleteTodo(id);
    setTodos(items);
  }

  async function handleClearCompleted() {
    const items = await clearCompleted();
    setTodos(items);
  }

  if (authLoading) return <div style={{ padding: 24 }}>Loading auth…</div>;
  if (authError) return <div style={{ padding: 24, color: "tomato" }}>Auth error: {String(authError)}</div>;

  // Styles
  const S = {
    page: { minHeight: "100vh", background: "#0b0d10", color: "#e9eaee" },
    shell: { maxWidth: 680, margin: "0 auto", padding: 24 },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    btn: {
      padding: "8px 12px",
      borderRadius: 10,
      border: "1px solid #3a414a",
      background: "#222a33",
      color: "white",
      cursor: "pointer",
    } as const,
    input: {
      flex: 1,
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #3a414a",
      background: "#0f1318",
      color: "white",
      outline: "none",
    } as const,
    card: {
      background: "#161a1f",
      border: "1px solid #2b3138",
      borderRadius: 18,
      padding: 20,
      boxShadow: "0 10px 30px rgba(0,0,0,.35)",
    },
    controls: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "10px 0 6px" },
    filterBar: { display: "flex", gap: 8 },
    filterBtn: (active: boolean) =>
      ({
        padding: "8px 12px",
        borderRadius: 10,
        border: "1px solid #3a414a",
        background: active ? "#354051" : "#222a33",
        color: "white",
        cursor: "pointer",
      }) as const,
    counts: { fontSize: 13, opacity: 0.8 },
    list: { display: "grid", gap: 10 },
    row: { display: "flex", alignItems: "center", gap: 10 },
    text: (done: boolean) =>
      ({
        flex: 1,
        textDecoration: done ? "line-through" : "none",
        opacity: done ? 0.6 : 1,
        cursor: "pointer",
      }) as const,
    checkbox: { accentColor: "#79a7ff" } as const,
    dangerBtn: {
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #6b2f2f",
      background: "#3b2729",
      color: "white",
      cursor: "pointer",
    } as const,
  };

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <header style={S.header}>
          <h1 style={{ margin: 0, fontSize: 22 }}>My Todos</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 13, opacity: 0.7 }}>{user?.email ?? user?.name ?? ""}</span>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              style={S.btn}
            >
              Logout
            </button>
          </div>
        </header>

        <div style={S.card as React.CSSProperties}>
          {/* Add form */}
          <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a task…"
              style={S.input}
            />
            <button type="submit" style={S.btn}>
              Add
            </button>
          </form>

          {/* Controls: filter, counts, clear-completed */}
          <div style={S.controls as React.CSSProperties}>
            <div style={S.filterBar}>
              <button type="button" style={S.filterBtn(filter === "all")} onClick={() => setFilter("all")}>
                All
              </button>
              <button type="button" style={S.filterBtn(filter === "active")} onClick={() => setFilter("active")}>
                Active
              </button>
              <button type="button" style={S.filterBtn(filter === "done")} onClick={() => setFilter("done")}>
                Done
              </button>
            </div>

            <div style={S.counts}>
              {counts.total} total — {counts.active} active, {counts.done} done
            </div>

            {counts.done > 0 && (
              <button type="button" onClick={handleClearCompleted} style={S.dangerBtn}>
                Clear completed
              </button>
            )}
          </div>

          {/* List */}
          {loading ? (
            <div style={{ opacity: 0.7 }}>Loading…</div>
          ) : visible.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No tasks here.</div>
          ) : (
            <div style={S.list}>
              {visible.map((t) => (
                <div key={t.id} style={S.row}>
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => handleToggle(t.id)}
                    style={S.checkbox}
                  />
                  <span
                    onClick={() => handleEdit(t.id)}
                    style={S.text(t.done)}
                    title="Click to edit"
                  >
                    {t.text}
                  </span>
                  <button onClick={() => handleDelete(t.id)} style={S.dangerBtn}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginGate() {
  const { loginWithRedirect, isLoading, error } = useAuth0();
  if (isLoading) return <div style={{ padding: 24 }}>Loading auth…</div>;
  if (error) return <div style={{ padding: 24, color: "tomato" }}>Auth error: {String(error)}</div>;
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0d10", color: "#e9eaee" }}>
      <button onClick={() => loginWithRedirect()} style={{ padding: "12px 16px", borderRadius: 10, border: "1px solid #3a414a", background: "#222a33", color: "white" }}>
        Sign in with Google
      </button>
    </div>
  );
}

export default withAuthenticationRequired(AppInner, {
  onRedirecting: () => <LoginGate />,
});
