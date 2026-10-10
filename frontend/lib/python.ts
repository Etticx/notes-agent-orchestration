import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "..");
const python = resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

export function startPython(args: string[] = []) {
  return spawn(python, ["-u", resolve(root, "web_runner.py"), ...args], {
    cwd: root,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
}
