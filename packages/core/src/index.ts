import { z } from "zod";

export const Todo = z.object({
  id: z.string(),
  text: z.string().min(1),
  done: z.boolean(),
  createdAt: z.number()
});
export type Todo = z.infer<typeof Todo>;
