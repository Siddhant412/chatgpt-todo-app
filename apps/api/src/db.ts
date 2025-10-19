import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Todo } from "@todo/core";

type Row = { id: string; userId: string; text: string; done: number; createdAt: number };
export type DB = InstanceType<typeof Database>;

export function openDb(file = "./todos.db"): DB {
  const db = new Database(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);

  // If migrating from an older table (without userId), try to add the column:
  try { db.exec(`ALTER TABLE todos ADD COLUMN userId TEXT`); } catch {}

  return db;
}

export function makeStore(db: DB) {
  const listStmt = db.prepare(
    "SELECT id, userId, text, done, createdAt FROM todos WHERE userId = ? ORDER BY createdAt DESC"
  );
  const insertStmt = db.prepare(
    "INSERT INTO todos (id, userId, text, done, createdAt) VALUES (?, ?, ?, ?, ?)"
  );
  const toggleStmt = db.prepare(
    "UPDATE todos SET done = CASE done WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND userId = ?"
  );
  const deleteStmt = db.prepare("DELETE FROM todos WHERE id = ? AND userId = ?");
  const editStmt = db.prepare("UPDATE todos SET text = ? WHERE id = ? AND userId = ?");
  const clearCompletedStmt = db.prepare("DELETE FROM todos WHERE done = 1 AND userId = ?");

  return {
    list(userId: string): Todo[] {
      const rows = listStmt.all(userId) as Row[];
      return rows.map((r) => ({
        id: r.id, text: r.text, done: !!r.done, createdAt: r.createdAt
      }));
    },
    add(userId: string, text: string) {
      insertStmt.run(randomUUID(), userId, text, 0, Date.now());
    },
    toggle(userId: string, id: string) {
      toggleStmt.run(id, userId);
    },
    remove(userId: string, id: string) {
      deleteStmt.run(id, userId);
    },
    edit(userId: string, id: string, text: string) {
      editStmt.run(text, id, userId);
    },
    clearCompleted(userId: string) {
      clearCompletedStmt.run(userId);
    },
  };
}
