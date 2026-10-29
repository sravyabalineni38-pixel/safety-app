import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const PeriodLogs = collection("periodLogs");

const AVG_CYCLE_LENGTH_DAYS = 28;
const AVG_PERIOD_LENGTH_DAYS = 5;

router.get("/", requireAuth, (req, res) => {
  const logs = PeriodLogs.find((p) => p.userId === req.user.id).sort(
    (a, b) => new Date(b.startDate) - new Date(a.startDate)
  );
  res.json({ logs, prediction: predictNext(logs) });
});

router.post("/", requireAuth, (req, res) => {
  const { startDate, endDate, flow, symptoms, notes } = req.body;
  if (!startDate) return res.status(400).json({ error: "startDate is required." });
  const log = {
    id: nanoid(),
    userId: req.user.id,
    startDate,
    endDate: endDate || null,
    flow: flow || "medium", // light | medium | heavy
    symptoms: symptoms || [], // e.g. ["cramps", "headache", "mood swings"]
    notes: notes || "",
    createdAt: new Date().toISOString()
  };
  PeriodLogs.insert(log);
  const logs = PeriodLogs.find((p) => p.userId === req.user.id);
  res.json({ log, prediction: predictNext(logs) });
});

router.delete("/:id", requireAuth, (req, res) => {
  const PeriodLogsRaw = PeriodLogs.findOne((p) => p.id === req.params.id && p.userId === req.user.id);
  if (!PeriodLogsRaw) return res.status(404).json({ error: "Log not found." });
  PeriodLogs.remove(req.params.id);
  res.json({ ok: true });
});

function predictNext(logs) {
  if (!logs.length) return null;
  const sorted = [...logs].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  let avgCycle = AVG_CYCLE_LENGTH_DAYS;
  if (sorted.length >= 2) {
    const diffs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const d = (new Date(sorted[i].startDate) - new Date(sorted[i + 1].startDate)) / 86400000;
      if (d > 0 && d < 60) diffs.push(d);
    }
    if (diffs.length) avgCycle = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  }
  const lastStart = new Date(sorted[0].startDate);
  const nextStart = new Date(lastStart.getTime() + avgCycle * 86400000);
  const fertileStart = new Date(nextStart.getTime() - (avgCycle - 14 + 5) * 86400000);
  const fertileEnd = new Date(fertileStart.getTime() + 6 * 86400000);
  return {
    avgCycleLengthDays: avgCycle,
    avgPeriodLengthDays: AVG_PERIOD_LENGTH_DAYS,
    nextPeriodStart: nextStart.toISOString().slice(0, 10),
    fertileWindow: {
      start: fertileStart.toISOString().slice(0, 10),
      end: fertileEnd.toISOString().slice(0, 10)
    }
  };
}

export default router;
