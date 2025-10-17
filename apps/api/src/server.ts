import express from "express";
import cors from "cors";
import { z } from "zod";
import { makeStore } from "./db.js";

const app = express();
const store = makeStore();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/todos", (_req, res) => {
  res.json(store.list());
});

app.post("/todos", (req, res) => {
  const body = z.object({ text: z.string().min(1) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "text required" });
  const todo = store.add(body.data.text);
  res.status(201).json(todo);
});

app.patch("/todos/:id/toggle", (req, res) => {
  store.toggle(req.params.id);
  res.json({ ok: true });
});

app.delete("/todos/:id", (req, res) => {
  store.remove(req.params.id);
  res.status(204).end();
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`API running → http://localhost:${PORT}`));
