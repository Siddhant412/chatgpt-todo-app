import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Todo } from "@todo/core";

type Row = { id: string; text: string; done: number; createdAt: number };

export type DB = InstanceType<typeof Database>;

export function openDb(file = "./todos.db"): DB {
  const db = new Database(file);
  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      done INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
  return db;
}

export function makeStore(db: DB) {
  const listStmt = db.prepare(
    "SELECT id, text, done, createdAt FROM todos ORDER BY createdAt DESC"
  );
  const insertStmt = db.prepare(
    "INSERT INTO todos (id, text, done, createdAt) VALUES (?, ?, ?, ?)"
  );
  const toggleStmt = db.prepare(
    "UPDATE todos SET done = CASE done WHEN 1 THEN 0 ELSE 1 END WHERE id = ?"
  );

  const deleteStmt = db.prepare("DELETE FROM todos WHERE id = ?");
  const editStmt = db.prepare("UPDATE todos SET text = ? WHERE id = ?");
  const clearCompletedStmt = db.prepare("DELETE FROM todos WHERE done = 1");

  return {
    list(): Todo[] {
      const rows = listStmt.all() as Row[];
      return rows.map((r: Row) => ({
        id: r.id,
        text: r.text,
        done: !!r.done,
        createdAt: r.createdAt
      }));
    },

    add(text: string) {
      insertStmt.run(randomUUID(), text, 0, Date.now());
    },

    toggle(id: string) {
      toggleStmt.run(id);
    },

    remove(id: string) {
      deleteStmt.run(id);
    },

    edit(id: string, text: string) {
      editStmt.run(text, id);
    },

    clearCompleted() {
      clearCompletedStmt.run();
    }
  };
}
