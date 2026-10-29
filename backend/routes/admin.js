import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { signToken, requireAdmin } from "../middleware/auth.js";

const router = Router();
const Admins = collection("admins");
const Users = collection("users");
const SosEvents = collection("sosEvents");
const Reports = collection("unsafeAreaReports");
const FallEvents = collection("fallEvents");
const Timers = collection("safetyTimers");
const Devices = collection("wearableDevices");

// One-time bootstrap so there's a way to create the first admin account
// without a public "become an admin" endpoint. Requires ADMIN_SETUP_KEY
// from .env, which only the app operator knows.
router.post("/bootstrap", async (req, res) => {
  const { name, email, password, setupKey } = req.body;
  if (setupKey !== (process.env.ADMIN_SETUP_KEY || "change_this_admin_bootstrap_key")) {
    return res.status(403).json({ error: "Invalid setup key." });
  }
  if (Admins.findOne((a) => a.email === email)) {
    return res.status(409).json({ error: "An admin with this email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = { id: nanoid(), name, email, passwordHash, createdAt: new Date().toISOString() };
  Admins.insert(admin);
  res.json({ message: "Admin created. You can now log in." });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const admin = Admins.findOne((a) => a.email === email);
  if (!admin) return res.status(401).json({ error: "Invalid email or password." });
  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid email or password." });
  const token = signToken({ id: admin.id, role: "admin", name: admin.name });
  res.json({ token, admin: { id: admin.id, name: admin.name, email: admin.email } });
});

router.get("/overview", requireAdmin, (req, res) => {
  const users = Users.all();
  const sos = SosEvents.all();
  const reports = Reports.all();
  const falls = FallEvents.all();
  const timers = Timers.all();
  const devices = Devices.all();

  res.json({
    totals: {
      users: users.length,
      activeSos: sos.filter((s) => s.status === "active").length,
      totalSos: sos.length,
      unsafeAreaReports: reports.length,
      fallEvents: falls.length,
      activeTimers: timers.filter((t) => t.status === "active").length,
      pairedDevices: devices.filter((d) => d.connected).length
    },
    recentSos: sos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10),
    recentReports: reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10),
    recentFalls: falls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10)
  });
});

router.get("/users", requireAdmin, (req, res) => {
  const users = Users.all().map(({ passwordHash, ...u }) => u);
  res.json({ users });
});

router.get("/sos-events", requireAdmin, (req, res) => {
  const events = SosEvents.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ events });
});

router.get("/unsafe-areas", requireAdmin, (req, res) => {
  const reports = Reports.all().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ reports });
});

export default router;
