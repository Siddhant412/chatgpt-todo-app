import express from "express";
import cors from "cors";
import { makeStore, openDb } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

const db = openDb();
const store = makeStore(db);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/todos", (_req, res) => {
  res.json(store.list());
});

app.post("/todos", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  store.add(text);
  res.json(store.list());
});

app.post("/todos/:id/toggle", (req, res) => {
  store.toggle(req.params.id);
  res.json(store.list());
});

app.delete("/todos/:id", (req, res) => {
  store.remove(req.params.id);
  res.json(store.list());
});

app.post("/todos/:id", (req, res) => {
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });
  store.edit(req.params.id, text);
  res.json(store.list());
});

app.delete("/todos", (_req, res) => {
  store.clearCompleted();
  res.json(store.list());
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`API running → http://localhost:${PORT}`);
});
