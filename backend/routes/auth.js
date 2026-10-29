import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { collection } from "../db.js";
import { signToken, requireAuth } from "../middleware/auth.js";

const router = Router();
const Users = collection("users");

router.post("/register", async (req, res) => {
  const { name, phone, email, password, bloodGroup } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ error: "Name, phone and password are required." });
  }
  if (Users.findOne((u) => u.phone === phone)) {
    return res.status(409).json({ error: "An account with this phone number already exists. Please log in instead." });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    phone,
    email: email || "",
    bloodGroup: bloodGroup || "",
    passwordHash,
    emergencyContacts: [],
    createdAt: new Date().toISOString()
  };
  Users.insert(user);
  const token = signToken({ id: user.id, role: "user", name: user.name });
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { phone, password } = req.body;
  const user = Users.findOne((u) => u.phone === phone);
  if (!user) return res.status(401).json({ error: "Invalid phone number or password." });
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid phone number or password." });
  const token = signToken({ id: user.id, role: "user", name: user.name });
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, email: user.email } });
});

router.get("/me", requireAuth, (req, res) => {
  const user = Users.findOne((u) => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const { passwordHash, ...safeUser } = user;
  res.json({ user: safeUser });
});

export default router;
