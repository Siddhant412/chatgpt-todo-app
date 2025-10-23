// const BASE = import.meta.env.VITE_API_URL;

// export type Todo = { id: string; text: string; done: boolean; createdAt: number };

// export async function listTodos(): Promise<Todo[]> {
//   const r = await fetch(`${BASE}/todos`);
//   return r.json();
// }

// export async function addTodo(text: string): Promise<Todo> {
//   const r = await fetch(`${BASE}/todos`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ text })
//   });
//   if (!r.ok) throw new Error("add failed");
//   return r.json();
// }

// export async function toggleTodo(id: string): Promise<void> {
//   await fetch(`${BASE}/todos/${id}/toggle`, { method: "PATCH" });
// }

// export async function deleteTodo(id: string): Promise<void> {
//   await fetch(`${BASE}/todos/${id}`, { method: "DELETE" });
// }
