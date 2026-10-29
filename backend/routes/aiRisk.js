import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { sendSms } from "../notify.js";

const router = Router();
const Reports = collection("unsafeAreaReports");
const Users = collection("users");
const ShareTokens = collection("shareTokens");
const SosEvents = collection("sosEvents");

const SEVERITY_WEIGHT = { low: 1, medium: 2, high: 3 };
const NEARBY_RADIUS_KM = 0.6;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hourRiskFactor(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 23 || hour < 5) return 3;
  if (hour >= 20 || hour < 6) return 2;
  return 1;
}

function scoreLocation(lat, lng, at = new Date()) {
  const point = { lat, lng };
  const nearby = Reports.all().filter((r) => haversineKm(point, { lat: r.lat, lng: r.lng }) <= NEARBY_RADIUS_KM);
  const reportScore = nearby.reduce((sum, r) => sum + (SEVERITY_WEIGHT[r.severity] || 1), 0);
  const timeScore = hourRiskFactor(at);
  const raw = reportScore * 6 + timeScore * 8;
  const score = Math.min(100, raw);
  let level = "low";
  if (score >= 60) level = "high";
  else if (score >= 30) level = "medium";
  return { score: Math.round(score), level, nearbyReports: nearby.length, timeOfDayFactor: timeScore, reports: nearby };
}

// Score single location
router.post("/score", requireAuth, (req, res) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) return res.status(400).json({ error: "lat and lng are required." });
  const result = scoreLocation(lat, lng);
  res.json(result);
});

// Check if user has entered an unsafe area and trigger emergency contact alert
router.post("/check-unsafe-breach", requireAuth, async (req, res) => {
  const { lat, lng } = req.body;
  if (lat === undefined || lng === undefined) return res.status(400).json({ error: "lat and lng required" });

  const risk = scoreLocation(lat, lng);
  const user = Users.findOne((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let alerted = false;
  let notifiedContacts = [];

  if (risk.level === "high" || risk.score >= 50) {
    let share = ShareTokens.findOne((t) => t.userId === user.id);
    let token = share ? share.token : "live";

    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const smsMessage = `⚠️ UNSAFE ROUTE ALERT: ${user.name} has entered a HIGH-RISK / UNSAFE AREA (${risk.score}/100 risk score). Live location: ${mapsLink}. Please check on them immediately!`;

    const contacts = user.emergencyContacts || [];
    for (const c of contacts) {
      const sms = await sendSms(c.phone, smsMessage);
      notifiedContacts.push({ contact: c, sms });
    }
    alerted = true;

    // Log as emergency event in history
    SosEvents.insert({
      id: nanoid(),
      userId: user.id,
      status: "active",
      source: "unsafe_route_detector",
      note: `Unsafe route breach detected! Area risk score: ${risk.score}/100.`,
      location: { lat, lng },
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      notifiedContacts,
      notifiedServices: []
    });
  }

  res.json({
    isUnsafe: risk.level === "high" || risk.score >= 50,
    risk,
    alerted,
    message: alerted
      ? "🚨 UNSAFE ROUTE WARNING! High risk detected near your path. Emergency contacts have been notified."
      : "Route segment is within safe limits."
  });
});

// Calculate and compare Direct Route vs AI Safe Route
router.post("/safe-route", requireAuth, (req, res) => {
  const { origin, destination } = req.body;
  if (!origin || !destination) return res.status(400).json({ error: "origin and destination are required." });

  const steps = 6;
  
  // 1. Direct Route
  const directWaypoints = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = origin.lat + (destination.lat - origin.lat) * t;
    const lng = origin.lng + (destination.lng - origin.lng) * t;
    directWaypoints.push({ lat, lng });
  }
  const directRiskPoints = directWaypoints.map((w) => scoreLocation(w.lat, w.lng));
  const directAvgRisk = Math.round(directRiskPoints.reduce((s, p) => s + p.score, 0) / directRiskPoints.length);

  // 2. AI Safe Route (Nudged away from dark spots and reported hazards)
  const safeWaypoints = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let lat = origin.lat + (destination.lat - origin.lat) * t;
    let lng = origin.lng + (destination.lng - origin.lng) * t;

    const nearby = Reports.all().filter(
      (r) => haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng }) <= NEARBY_RADIUS_KM
    );
    for (const r of nearby) {
      const pushLat = lat - r.lat;
      const pushLng = lng - r.lng;
      const mag = Math.sqrt(pushLat ** 2 + pushLng ** 2) || 1;
      lat += (pushLat / mag) * 0.002 * (SEVERITY_WEIGHT[r.severity] || 1);
      lng += (pushLng / mag) * 0.002 * (SEVERITY_WEIGHT[r.severity] || 1);
    }
    safeWaypoints.push({ lat, lng });
  }

  const safeRiskPoints = safeWaypoints.map((w) => scoreLocation(w.lat, w.lng));
  const safeAvgRisk = Math.round(safeRiskPoints.reduce((s, p) => s + p.score, 0) / safeRiskPoints.length);

  const directLevel = directAvgRisk >= 60 ? "high" : directAvgRisk >= 30 ? "medium" : "low";
  const safeLevel = safeAvgRisk >= 60 ? "high" : safeAvgRisk >= 30 ? "medium" : "low";

  const isDirectUnsafe = directAvgRisk >= 40;

  res.json({
    waypoints: safeWaypoints,
    avgRiskScore: safeAvgRisk,
    riskLevel: safeLevel,
    directRoute: {
      waypoints: directWaypoints,
      avgRiskScore: directAvgRisk,
      riskLevel: directLevel,
      isUnsafe: isDirectUnsafe
    },
    recommendation: isDirectUnsafe
      ? "⚠️ WARNING: The direct route passes through unsafe / high-risk areas! We strongly recommend using the AI Safe Route."
      : "🟢 Safe Navigation: The route has low risk and is recommended for travel.",
    shouldWarnContacts: isDirectUnsafe
  });
});

export default router;
