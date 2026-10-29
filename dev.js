import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isWin = process.platform === "win32";
const npmCmd = isWin ? "npm.cmd" : "npm";

console.log("\n🚀 [Guardian] Starting Full-Stack Safety App (Backend + Frontend)...\n");

// 1. Start Backend on port 4000
const backend = spawn(npmCmd, ["start"], {
  cwd: path.join(__dirname, "backend"),
  stdio: "inherit",
  shell: true
});

// 2. Start Frontend Vite server on port 5173
const frontend = spawn(npmCmd, ["run", "dev"], {
  cwd: path.join(__dirname, "frontend"),
  stdio: "inherit",
  shell: true
});

function cleanup() {
  console.log("\n🛑 [Guardian] Shutting down servers...");
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

backend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`⚠️ [Guardian] Backend exited with code ${code}`);
  }
});

frontend.on("exit", (code) => {
  if (code !== 0 && code !== null) {
    console.error(`⚠️ [Guardian] Frontend exited with code ${code}`);
  }
});

