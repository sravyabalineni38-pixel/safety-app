import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const Devices = collection("wearableDevices");

router.get("/", requireAuth, (req, res) => {
  res.json({ devices: Devices.find((d) => d.userId === req.user.id) });
});

router.post("/pair", requireAuth, (req, res) => {
  const { deviceName, deviceId } = req.body;
  if (!deviceName || !deviceId) return res.status(400).json({ error: "deviceName and deviceId are required." });
  const device = {
    id: nanoid(),
    userId: req.user.id,
    deviceName,
    deviceId,
    battery: 100,
    connected: true,
    lastSync: new Date().toISOString()
  };
  Devices.insert(device);
  res.json({ device });
});

router.post("/:id/sync", requireAuth, (req, res) => {
  const { battery, connected } = req.body;
  const device = Devices.findOne((d) => d.id === req.params.id && d.userId === req.user.id);
  if (!device) return res.status(404).json({ error: "Device not found." });
  const updated = Devices.update(device.id, {
    battery: battery ?? device.battery,
    connected: connected ?? true,
    lastSync: new Date().toISOString()
  });
  res.json({ device: updated });
});

router.delete("/:id", requireAuth, (req, res) => {
  Devices.remove(req.params.id);
  res.json({ ok: true });
});

export default router;
