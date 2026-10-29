import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const Reports = collection("unsafeAreaReports");

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

router.get("/", requireAuth, (req, res) => {
  let reports = Reports.all();
  const { lat, lng, radiusKm } = req.query;

  if (lat !== undefined && lng !== undefined && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    reports = reports.map((r) => {
      const dist = haversineKm({ lat: userLat, lng: userLng }, { lat: r.lat, lng: r.lng });
      const distKm = Math.round(dist * 100) / 100;
      const distMeters = Math.round(dist * 1000);
      return {
        ...r,
        distanceKm: distKm,
        distanceMeters: distMeters
      };
    });

    if (radiusKm && !isNaN(parseFloat(radiusKm))) {
      const maxR = parseFloat(radiusKm);
      reports = reports.filter((r) => r.distanceKm <= maxR);
    }

    reports.sort((a, b) => a.distanceKm - b.distanceKm);
  } else {
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  res.json({ reports });
});

router.post("/", requireAuth, (req, res) => {
  const { lat, lng, category, description, severity } = req.body;
  if (lat === undefined || lng === undefined || !category) {
    return res.status(400).json({ error: "lat, lng and category are required." });
  }
  const report = {
    id: nanoid(),
    userId: req.user.id,
    lat,
    lng,
    category, // e.g. "Poor lighting", "Harassment", "Isolated area", "No CCTV"
    description: description || "",
    severity: severity || "medium", // low | medium | high
    createdAt: new Date().toISOString(),
    upvotes: 0
  };
  Reports.insert(report);
  res.json({ report });
});

router.post("/:id/upvote", requireAuth, (req, res) => {
  const report = Reports.findOne((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  const updated = Reports.update(report.id, { upvotes: (report.upvotes || 0) + 1 });
  res.json({ report: updated });
});

export default router;
