import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendSms, placeCall, formatE164 } from "../notify.js";

const router = Router();
const FallEvents = collection("fallEvents");
const Users = collection("users");

// Wearable device posts here when its accelerometer/gyroscope pattern
// matches a fall signature. confidence is 0-1.
router.post("/", requireAuth, async (req, res) => {
  const { confidence, lat, lng, autoAlert = true } = req.body;
  if (confidence === undefined) return res.status(400).json({ error: "confidence is required." });

  const event = {
    id: nanoid(),
    userId: req.user.id,
    confidence,
    location: lat && lng ? { lat, lng } : null,
    createdAt: new Date().toISOString(),
    status: confidence >= 0.7 ? "alerting" : "monitoring"
  };
  FallEvents.insert(event);

  let notified = [];
  if (autoAlert && confidence >= 0.7) {
    const user = Users.findOne((u) => u.id === req.user.id);
    const mapsLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : "location unavailable";
    const msg = `⚠️ FALL DETECTED\n\nPossible fall detected for ${user.name} by their safety device.\n\n📍 Location: ${mapsLink}\nConfidence: ${(confidence * 100).toFixed(0)}%\n\nPlease check on them IMMEDIATELY.\n\n— Guardian Safety App`;

    for (const c of user.emergencyContacts || []) {
      const formatted = formatE164(c.phone);
      const encodedMsg = encodeURIComponent(msg);

      let smsResult, callResult;
      try {
        smsResult = await sendSms(c.phone, msg);
      } catch (err) {
        console.error(`[Fall SMS Error] ${c.name}: ${err.message}`);
        smsResult = { ok: false, error: err.message };
      }

      try {
        callResult = await placeCall(c.phone, msg);
      } catch (err) {
        console.error(`[Fall Call Error] ${c.name}: ${err.message}`);
        callResult = { ok: false, error: err.message };
      }

      notified.push({
        contact: c.name,
        phone: formatted,
        sms: smsResult,
        call: callResult,
        // Always include native fallback links
        smsLink: `sms:${formatted}?body=${encodedMsg}`,
        waLink: `https://wa.me/${formatted.replace("+", "")}?text=${encodedMsg}`,
        callLink: `tel:${formatted}`
      });
    }
    console.log(`[Fall Alert] ${user.name} — confidence ${(confidence * 100).toFixed(0)}% — notified ${notified.length} contacts`);
  }

  res.json({ event, notified });
});

router.post("/:id/im-ok", requireAuth, (req, res) => {
  const event = FallEvents.findOne((e) => e.id === req.params.id && e.userId === req.user.id);
  if (!event) return res.status(404).json({ error: "Event not found." });
  const updated = FallEvents.update(event.id, { status: "dismissed" });
  res.json({ event: updated });
});

router.get("/history", requireAuth, (req, res) => {
  const events = FallEvents.find((e) => e.userId === req.user.id).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  res.json({ events });
});

export default router;
