import { Router } from "express";
import { setTakeoverState, logConversationTurn, audit } from "../db/aiDb.js";

export const takeoverRouter = Router();

takeoverRouter.post("/:clientId", async (req, res) => {
  const { active, setBy } = req.body as { active: boolean; setBy?: string };
  const state = await setTakeoverState(req.params.clientId, active, setBy);
  await audit({ clientId: req.params.clientId, actor: setBy ?? "rm", action: "takeover", detail: String(active) });
  res.json(state);
});

// A human replying from the dashboard while takeover is active (PRD section 16.1:
// "Messages sent by a human in takeover mode are labelled").
takeoverRouter.post("/:clientId/reply", async (req, res) => {
  const { message, sentBy } = req.body as { message: string; sentBy: string };
  const labelled = `${message}\n— ${sentBy}, Fitelo team`;
  await logConversationTurn({ clientId: req.params.clientId, direction: "outbound", message: labelled, intent: "human_takeover" });
  res.json({ ok: true, message: labelled });
});
