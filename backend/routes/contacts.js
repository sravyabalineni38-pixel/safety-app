import { Router } from "express";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const Users = collection("users");

router.get("/", requireAuth, (req, res) => {
  const user = Users.findOne((u) => u.id === req.user.id);
  res.json({ contacts: user?.emergencyContacts || [] });
});

router.post("/", requireAuth, (req, res) => {
  const { name, phone, relation } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "Name and phone are required." });
  const user = Users.findOne((u) => u.id === req.user.id);
  const contact = { id: nanoid(), name, phone, relation: relation || "Trusted contact" };
  const contacts = [...(user.emergencyContacts || []), contact];
  Users.update(user.id, { emergencyContacts: contacts });
  res.json({ contacts });
});

router.delete("/:contactId", requireAuth, (req, res) => {
  const user = Users.findOne((u) => u.id === req.user.id);
  const contacts = (user.emergencyContacts || []).filter((c) => c.id !== req.params.contactId);
  Users.update(user.id, { emergencyContacts: contacts });
  res.json({ contacts });
});

export default router;
