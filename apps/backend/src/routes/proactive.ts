import { Router } from "express";
import { runProactiveScan } from "../proactive/engine.js";

export const proactiveRouter = Router();

// Manual trigger for testing — the real trigger is the hourly scheduler in server.ts.
proactiveRouter.post("/run", async (_req, res) => {
  try {
    const result = await runProactiveScan();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});
