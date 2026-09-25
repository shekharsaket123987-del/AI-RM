import { Router } from "express";
import { listAllEscalations } from "../db/aiDb.js";
import { assignEscalation, resolveEscalation, reopenEscalation, closeEscalation } from "../escalation/engine.js";

export const escalationsRouter = Router();

escalationsRouter.get("/", async (_req, res) => {
  res.json(await listAllEscalations());
});

escalationsRouter.post("/:id/assign", async (req, res) => {
  const { assignedTo } = req.body as { assignedTo: string };
  res.json(await assignEscalation(req.params.id, assignedTo));
});

escalationsRouter.post("/:id/resolve", async (req, res) => {
  const { resolutionNote } = req.body as { resolutionNote: string };
  res.json(await resolveEscalation(req.params.id, resolutionNote));
});

escalationsRouter.post("/:id/reopen", async (req, res) => {
  res.json(await reopenEscalation(req.params.id));
});

escalationsRouter.post("/:id/close", async (req, res) => {
  res.json(await closeEscalation(req.params.id));
});
