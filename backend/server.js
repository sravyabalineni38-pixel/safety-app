import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.js";
import contactsRoutes from "./routes/contacts.js";
import sosRoutes from "./routes/sos.js";
import locationRoutes from "./routes/location.js";
import unsafeAreasRoutes from "./routes/unsafeAreas.js";
import batteryRoutes from "./routes/battery.js";
import periodTrackerRoutes from "./routes/periodTracker.js";
import safetyTimerRoutes from "./routes/safetyTimer.js";
import fallDetectionRoutes from "./routes/fallDetection.js";
import wearableRoutes from "./routes/wearable.js";
import aiRiskRoutes from "./routes/aiRisk.js";
import aiAssistantRoutes from "./routes/aiAssistant.js";
import adminRoutes from "./routes/admin.js";
import { emergencyNumbers } from "./notify.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "guardian-safety-backend", time: new Date().toISOString() });
});

app.get("/api/emergency-numbers", (req, res) => {
  res.json(emergencyNumbers());
});

app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactsRoutes);
app.use("/api/sos", sosRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/unsafe-areas", unsafeAreasRoutes);
app.use("/api/battery", batteryRoutes);
app.use("/api/period-tracker", periodTrackerRoutes);
app.use("/api/safety-timer", safetyTimerRoutes);
app.use("/api/fall-detection", fallDetectionRoutes);
app.use("/api/wearable", wearableRoutes);
app.use("/api/ai-risk", aiRiskRoutes);
app.use("/api/ai-assistant", aiAssistantRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Guardian safety backend running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ [PORT CONFLICT] Port ${PORT} is already in use by another process.`);
    console.error(`👉 Stop the existing process or run: npx kill-port ${PORT}\n`);
    process.exit(1);
  } else {
    console.error("Server error:", err);
  }
});
