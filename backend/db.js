// db.js
// Lightweight JSON-file database. No native build tools required, so it
// installs anywhere. Swap this out for Postgres/Mongo in production —
// every route only talks to the functions exported here, so that's the
// only file you'd need to touch.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "data", "db.json");

const DEFAULT_DB = {
  users: [],           // { id, name, phone, email, passwordHash, emergencyContacts: [], bloodGroup, createdAt }
  admins: [],           // { id, name, email, passwordHash }
  sosEvents: [],         // { id, userId, status, location:{lat,lng}, createdAt, resolvedAt, notifiedContacts, notifiedServices }
  locations: [],         // { id, userId, lat, lng, timestamp, battery }
  unsafeAreaReports: [],     // { id, userId, lat, lng, category, description, severity, createdAt, upvotes }
  batteryLogs: [],        // { id, userId, level, charging, timestamp }
  periodLogs: [],         // { id, userId, startDate, endDate, symptoms, flow, notes }
  safetyTimers: [],        // { id, userId, durationMinutes, startedAt, expiresAt, status, checkInCode }
  fallEvents: [],         // { id, userId, confidence, location, createdAt, status }
  aiChats: [],           // { id, userId, messages: [{role, text, at}] }
  wearableDevices: [],     // { id, userId, deviceName, deviceId, battery, connected, lastSync }
  shareTokens: []         // { id, token, userId, expiresAt, createdAt }
};

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_FILE))) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  // Backfill any new collections added after a DB file already existed
  for (const key of Object.keys(DEFAULT_DB)) {
    if (!(key in parsed)) parsed[key] = DEFAULT_DB[key];
  }
  return parsed;
}

export function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function collection(name) {
  return {
    all() {
      return readDb()[name];
    },
    find(predicate) {
      return readDb()[name].filter(predicate);
    },
    findOne(predicate) {
      return readDb()[name].find(predicate);
    },
    insert(item) {
      const db = readDb();
      db[name].push(item);
      writeDb(db);
      return item;
    },
    update(id, patch) {
      const db = readDb();
      const idx = db[name].findIndex((x) => x.id === id);
      if (idx === -1) return null;
      db[name][idx] = { ...db[name][idx], ...patch };
      writeDb(db);
      return db[name][idx];
    },
    remove(id) {
      const db = readDb();
      db[name] = db[name].filter((x) => x.id !== id);
      writeDb(db);
    }
  };
}
