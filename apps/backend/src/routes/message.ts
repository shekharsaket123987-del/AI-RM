import { Router } from "express";
import { runPipeline } from "../pipeline/runPipeline.js";

export const messageRouter = Router();

// Stands in for the WhatsApp webhook (PRD section 22). The /simulate page in
// the dashboard calls this exact endpoint, so the pipeline code path is
// identical to what a real webhook would hit.
messageRouter.post("/", async (req, res) => {
  const { phone, message } = req.body as { phone?: string; message?: string };
  if (!phone || !message) {
    return res.status(400).json({ error: "phone and message are required" });
  }
  try {
    const result = await runPipeline(phone, message);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});
