import { useAuth0 } from "@auth0/auth0-react";
import type { GetTokenSilentlyOptions } from "@auth0/auth0-spa-js";

export type Todo = { id: string; text: string; done: boolean; createdAt: number };

const API_URL = String(import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}${txt ? `: ${txt}` : ""}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  async function authHeader(opts?: GetTokenSilentlyOptions) {
    const token = await getAccessTokenSilently(opts);
    return `Bearer ${token}`;
  }

  return {
    listTodos: async () => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      const res = await fetch(`${API_URL}/todos`, { headers });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },

    addTodo: async (text: string) => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      headers.set("Content-Type", "application/json");
      const res = await fetch(`${API_URL}/todos`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text }),
      });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },

    toggleTodo: async (id: string) => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      const res = await fetch(`${API_URL}/todos/${id}/toggle`, { method: "POST", headers });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },

    deleteTodo: async (id: string) => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      const res = await fetch(`${API_URL}/todos/${id}`, { method: "DELETE", headers });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },

    editTodo: async (id: string, text: string) => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      headers.set("Content-Type", "application/json");
      const res = await fetch(`${API_URL}/todos/${id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ text }),
      });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },

    clearCompleted: async () => {
      const headers = new Headers();
      headers.set("Authorization", await authHeader());
      const res = await fetch(`${API_URL}/todos/clear-completed`, { method: "POST", headers });
      const data = await asJson<{ todos: Todo[] }>(res);
      return data.todos;
    },
  };
}
