import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Todo } from "@todo/core";

type DbRow = {
  id: string;
  text: string;
  done: 0 | 1;
  createdAt: number;
};

export function openDb(path = "./todos.db") {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );
  `);
  return db;
}

export function makeStore(db = openDb()) {
  const listStmt = db.prepare(
    "SELECT id, text, done, createdAt FROM todos ORDER BY createdAt DESC"
  );
  const insertStmt = db.prepare(
    "INSERT INTO todos (id, text, done, createdAt) VALUES (@id,@text,@done,@createdAt)"
  );
  const toggleStmt = db.prepare("UPDATE todos SET done = NOT done WHERE id = ?");
  const deleteStmt = db.prepare("DELETE FROM todos WHERE id = ?");

  return {
    list(): Todo[] {
      const rows = listStmt.all() as DbRow[];

      return rows.map(({ id, text, done, createdAt }) => ({
        id,
        text,
        done: !!done,
        createdAt
      }));
    },

    add(text: string): Todo {
      const todo: Todo = {
        id: randomUUID(),
        text,
        done: false,
        createdAt: Date.now(),
      };

      insertStmt.run({
        id: todo.id,
        text: todo.text,
        done: todo.done ? 1 : 0,
        createdAt: todo.createdAt,
      });

      return todo;
    },

    toggle(id: string): void {
      toggleStmt.run(id);
    },

    remove(id: string): void {
      deleteStmt.run(id);
    }
  };
}
