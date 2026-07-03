import { rm, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const appApiDir = "app/api";
const disabledApiDir = ".cloudflare-next-api-disabled";

async function runBuild() {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  return new Promise((resolve, reject) => {
    const child = spawn(command, ["exec", "next", "build"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CF_PAGES_STATIC: "1"
      }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Cloudflare build failed with exit code ${code}`));
    });
  });
}

if (existsSync(disabledApiDir)) {
  await rm(disabledApiDir, { recursive: true, force: true });
}

try {
  if (existsSync(appApiDir)) {
    await rename(appApiDir, disabledApiDir);
  }
  await runBuild();
} finally {
  if (existsSync(disabledApiDir)) {
    if (existsSync(appApiDir)) {
      await rm(appApiDir, { recursive: true, force: true });
    }
    await rename(disabledApiDir, appApiDir);
  }
}
