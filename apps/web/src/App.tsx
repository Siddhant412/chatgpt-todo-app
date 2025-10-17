import { useEffect, useState } from "react";
import { listTodos, addTodo, toggleTodo, deleteTodo, type Todo } from "./api";

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [text, setText] = useState("");

  async function refresh() { setTodos(await listTodos()); }
  useEffect(() => { refresh(); }, []);

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await addTodo(text.trim());
    setText("");
    await refresh();
  }

  return (
    <div className="container">
      <h1>My Todos</h1>

      <form onSubmit={onAdd}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a task…"
        />
        <button>Add</button>
      </form>

      <ul>
        {todos.map((t) => (
          <li key={t.id}>
            <input
              type="checkbox"
              checked={t.done}
              onChange={async () => { await toggleTodo(t.id); await refresh(); }}
            />
            <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none" }}>
              {t.text}
            </span>
            <button onClick={async () => { await deleteTodo(t.id); await refresh(); }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
