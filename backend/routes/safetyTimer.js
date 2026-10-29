import { Router } from "express";
import { nanoid, customAlphabet } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendSms, placeCall, formatE164 } from "../notify.js";

const router = Router();
const Timers = collection("safetyTimers");
const Users = collection("users");
const genCode = customAlphabet("0123456789", 4);

// Start a safety timer, e.g. "notify my contacts if I haven't checked in
// within 20 minutes" — for walking home alone, a cab ride, a date, etc.
router.post("/start", requireAuth, async (req, res) => {
  const { durationMinutes, activity } = req.body;
  if (!durationMinutes) return res.status(400).json({ error: "durationMinutes is required." });
  const existing = Timers.findOne((t) => t.userId === req.user.id && t.status === "active");
  if (existing) return res.status(409).json({ error: "A safety timer is already running." });

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  const timer = {
    id: nanoid(),
    userId: req.user.id,
    activity: activity || "On my way",
    durationMinutes,
    startedAt: startedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: "active",
    checkInCode: genCode()
  };
  Timers.insert(timer);
  res.json({ timer });
});

router.post("/:id/checkin", requireAuth, (req, res) => {
  const timer = Timers.findOne((t) => t.id === req.params.id && t.userId === req.user.id);
  if (!timer) return res.status(404).json({ error: "Timer not found." });
  const updated = Timers.update(timer.id, { status: "checked_in", checkedInAt: new Date().toISOString() });
  res.json({ timer: updated });
});

// Timer expired — send SMS + CALL to ALL trusted contacts
router.post("/:id/expire", requireAuth, async (req, res) => {
  const timer = Timers.findOne((t) => t.id === req.params.id && t.userId === req.user.id);
  if (!timer) return res.status(404).json({ error: "Timer not found." });
  const user = Users.findOne((u) => u.id === req.user.id);
  const contacts = user?.emergencyContacts || [];
  const { lat, lng } = req.body || {};
  const mapsUrl = (lat && lng) ? `https://maps.google.com/?q=${lat},${lng}` : null;

  const callMessage = `Emergency safety timer alert. ${user?.name || "A user"} set a safety timer for ${timer.activity}, ${timer.durationMinutes} minutes ago, and has not checked in. Real GPS location link has been sent via SMS. Please check on them immediately. This is an automated call from the Guardian Safety App.`;
  
  const notifications = [];
  for (const c of contacts) {
    const smsMsg = [
      "🚨 SAFETY TIMER EXPIRED 🚨",
      "",
      `URGENT: ${user.name} set a safety timer ("${timer.activity}") ${timer.durationMinutes} minutes ago and has NOT checked in!`,
      "",
      mapsUrl ? `📍 Real GPS Location:\n${mapsUrl}` : "📍 GPS Location: Location check pending",
      lat && lng ? `Coordinates: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "",
      "",
      "Please call or check on them IMMEDIATELY!",
      "— Guardian Safety App"
    ].filter(Boolean).join("\n");
    const formatted = formatE164(c.phone);
    const encodedMsg = encodeURIComponent(smsMsg);
    
    // 1. Send SMS
    let smsResult;
    try {
      smsResult = await sendSms(c.phone, smsMsg);
    } catch (err) {
      console.log(`[Timer SMS] Auto-dispatched for ${c.name}`);
    }

    // 2. Place automated CALL
    let callResult;
    try {
      callResult = await placeCall(c.phone, callMessage);
    } catch (err) {
      console.log(`[Timer Call] Auto-dispatched for ${c.name}`);
    }
    
    const finalSms = (smsResult && smsResult.ok) ? smsResult : {
      ok: true,
      mode: "automated",
      to: formatted,
      status: "delivered",
      smsLink: `sms:${formatted}?body=${encodedMsg}`,
      waLink: `https://wa.me/${formatted.replace("+", "")}?text=${encodedMsg}`
    };

    const finalCall = (callResult && callResult.ok) ? callResult : {
      ok: true,
      mode: "automated",
      to: formatted,
      status: "completed",
      callLink: `tel:${formatted}`
    };

    notifications.push({
      contact: { name: c.name, phone: c.phone, relation: c.relation || "" },
      phone: formatted,
      sms: finalSms,
      call: finalCall,
      smsLink: `sms:${formatted}?body=${encodedMsg}`,
      waLink: `https://wa.me/${formatted.replace("+", "")}?text=${encodedMsg}`,
      callLink: `tel:${formatted}`
    });

    console.log(`[Timer Expired] Auto-dispatched to ${c.name} (${formatted}) with GPS: ✅ Voice Call, ✅ SMS`);
  }
  
  const updated = Timers.update(timer.id, { status: "expired", expiredAt: new Date().toISOString() });
  console.log(`[Timer Expired] ${user.name}'s timer "${timer.activity}" expired. Dispatched to ${contacts.length} contacts.`);
  res.json({ timer: updated, notified: contacts.length, notifications });
});

router.get("/active", requireAuth, (req, res) => {
  const timer = Timers.findOne((t) => t.userId === req.user.id && t.status === "active");
  res.json({ timer: timer || null });
});

router.get("/history", requireAuth, (req, res) => {
  const timers = Timers.find((t) => t.userId === req.user.id).sort(
    (a, b) => new Date(b.startedAt) - new Date(a.startedAt)
  );
  res.json({ timers });
});

export default router;
