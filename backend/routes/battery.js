import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const BatteryLogs = collection("batteryLogs");
const Users = collection("users");

const LOW_BATTERY_THRESHOLD = 15;

router.post("/", requireAuth, (req, res) => {
  const { level, charging, device } = req.body;
  if (level === undefined) return res.status(400).json({ error: "level is required." });
  const entry = {
    id: nanoid(),
    userId: req.user.id,
    level,
    charging: !!charging,
    device: device || "phone",
    timestamp: new Date().toISOString()
  };
  BatteryLogs.insert(entry);

  let lowBatteryWarning = null;
  if (level <= LOW_BATTERY_THRESHOLD && !charging) {
    const user = Users.findOne((u) => u.id === req.user.id);
    lowBatteryWarning = `${device || "Phone"} battery is at ${level}%. Consider notifying a trusted contact before it dies: ${
      (user?.emergencyContacts || []).map((c) => c.name).join(", ") || "no contacts added yet"
    }.`;
  }

  res.json({ entry, lowBatteryWarning });
});

router.get("/latest", requireAuth, (req, res) => {
  const mine = BatteryLogs.find((b) => b.userId === req.user.id).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  res.json({ latest: mine[0] || null, threshold: LOW_BATTERY_THRESHOLD });
});

router.get("/history", requireAuth, (req, res) => {
  const mine = BatteryLogs.find((b) => b.userId === req.user.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 100);
  res.json({ history: mine });
});

export default router;
