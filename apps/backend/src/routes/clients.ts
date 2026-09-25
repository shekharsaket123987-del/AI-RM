import { Router } from "express";
import * as sourceDb from "../db/sourceDb.js";
import { buildContextBundle } from "../pipeline/contextBuilder.js";
import { getRecentConversation, getActiveMemoryNotes, deleteMemoryNote, audit } from "../db/aiDb.js";

export const clientsRouter = Router();

clientsRouter.get("/", async (_req, res) => {
  const clients = await sourceDb.listClients();
  res.json(clients);
});

clientsRouter.get("/:id", async (req, res) => {
  try {
    const bundle = await buildContextBundle(req.params.id);
    const conversation = await getRecentConversation(req.params.id, 50);
    const memoryNotes = await getActiveMemoryNotes(req.params.id, 20);
    res.json({ bundle, conversation, memoryNotes });
  } catch (err) {
    res.status(404).json({ error: (err as Error).message });
  }
});

clientsRouter.delete("/:id/memory-notes/:noteId", async (req, res) => {
  await deleteMemoryNote(req.params.noteId);
  await audit({ clientId: req.params.id, actor: "rm", action: "memory_delete", detail: req.params.noteId });
  res.json({ ok: true });
});
