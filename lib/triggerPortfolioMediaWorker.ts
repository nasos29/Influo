import { spawn } from "node:child_process";
import path from "node:path";
import { stagingRoot } from "@/lib/portfolioUploadStaging";

/** Fire-and-forget portfolio upload worker (--uploads-only). Cron remains the backstop. */
export function triggerPortfolioMediaWorker(): void {
  if (process.env.PORTFOLIO_UPLOAD_DISABLE_WORKER_TRIGGER === "1") return;
  const script = path.join(process.cwd(), "scripts", "process_creator_media_jobs.py");
  const py = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
  try {
    const child = spawn(py, [script, "--uploads-only"], {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PORTFOLIO_UPLOAD_STAGING_DIR: stagingRoot(),
        PORTFOLIO_UPLOAD_H264_PRESET: process.env.PORTFOLIO_UPLOAD_H264_PRESET || "fast",
      },
    });
    child.unref();
  } catch {
    /* cron will pick it up */
  }
}