import { Router } from "express";
import { listAllKbEntries, createKbEntry, setKbEntryActive } from "../db/aiDb.js";

export const kbRouter = Router();

kbRouter.get("/", async (_req, res) => {
  res.json(await listAllKbEntries());
});

kbRouter.post("/", async (req, res) => {
  const { category, question, answer, owner } = req.body as {
    category: string;
    question: string;
    answer: string;
    owner: string;
  };
  res.json(await createKbEntry({ category, question, answer, owner }));
});

kbRouter.post("/:id/toggle", async (req, res) => {
  const { active } = req.body as { active: boolean };
  res.json(await setKbEntryActive(req.params.id, active));
});
