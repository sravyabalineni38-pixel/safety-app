import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const Locations = collection("locations");
const Users = collection("users");
const ShareTokens = collection("shareTokens");
const SosEvents = collection("sosEvents");

router.post("/", requireAuth, (req, res) => {
  const { lat, lng, battery } = req.body;
  if (lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "lat and lng are required." });
  }
  const entry = {
    id: nanoid(),
    userId: req.user.id,
    lat,
    lng,
    battery: battery ?? null,
    timestamp: new Date().toISOString()
  };
  Locations.insert(entry);
  res.json({ location: entry });
});

router.get("/latest", requireAuth, (req, res) => {
  const mine = Locations.find((l) => l.userId === req.user.id).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  res.json({ location: mine[0] || null });
});

router.get("/trail", requireAuth, (req, res) => {
  const limit = Number(req.query.limit) || 50;
  const mine = Locations.find((l) => l.userId === req.user.id)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
  res.json({ trail: mine });
});

// Create/Get share token for live location sharing (Used by Trusted Contact & Emergency Services)
router.post("/share-token", requireAuth, (req, res) => {
  const existing = ShareTokens.findOne((t) => t.userId === req.user.id);
  if (existing) {
    return res.json({ token: existing.token, shareUrl: `/track/${existing.token}` });
  }
  const token = nanoid(10);
  const entry = {
    id: nanoid(),
    token,
    userId: req.user.id,
    createdAt: new Date().toISOString()
  };
  ShareTokens.insert(entry);
  res.json({ token, shareUrl: `/track/${token}` });
});

// Public Endpoint for Trusted Contacts & Emergency Services to track live location
router.get("/public-track/:token", (req, res) => {
  const share = ShareTokens.findOne((t) => t.token === req.params.token);
  if (!share) {
    return res.status(404).json({ error: "Tracking link is invalid or expired." });
  }

  const user = Users.findOne((u) => u.id === share.userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  const mine = Locations.find((l) => l.userId === user.id).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  const latestLocation = mine[0] || null;
  const trail = mine.slice(0, 30);

  const activeSos = SosEvents.findOne((e) => e.userId === user.id && e.status === "active");

  res.json({
    user: {
      name: user.name,
      phone: user.phone,
      bloodGroup: user.bloodGroup
    },
    location: latestLocation,
    trail,
    activeSos: activeSos ? { id: activeSos.id, createdAt: activeSos.createdAt, note: activeSos.note } : null
  });
});

export default router;
