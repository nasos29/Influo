import { spawn } from "node:child_process";
import path from "node:path";
import { stagingRoot } from "@/lib/portfolioUploadStaging";

export type PortfolioMediaWorkerMode = "uploads-only" | "links-only";

/** CLI argv tail for the Python worker (tested in creator-media-embed-policy.test.mts). */
export function portfolioMediaWorkerArgv(mode: PortfolioMediaWorkerMode): string[] {
  const script = path.join(process.cwd(), "scripts", "process_creator_media_jobs.py");
  return [script, mode === "links-only" ? "--links-only" : "--uploads-only"];
}

/** Fire-and-forget portfolio media worker. Cron remains the backstop. */
export function triggerPortfolioMediaWorker(mode: PortfolioMediaWorkerMode = "uploads-only"): void {
  if (process.env.PORTFOLIO_UPLOAD_DISABLE_WORKER_TRIGGER === "1") return;
  const py = process.env.PYTHON_PATH || (process.platform === "win32" ? "python" : "python3");
  const argv = portfolioMediaWorkerArgv(mode);
  try {
    let loggedSpawnError = false;
    const child = spawn(py, argv, {
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        PORTFOLIO_UPLOAD_STAGING_DIR: stagingRoot(),
        PORTFOLIO_UPLOAD_H264_PRESET: process.env.PORTFOLIO_UPLOAD_H264_PRESET || "fast",
      },
    });
    child.on("error", (err) => {
      if (loggedSpawnError) return;
      loggedSpawnError = true;
      console.warn("[portfolio-upload] media worker spawn failed (cron will retry):", err.message);
    });
    child.unref();
  } catch {
    /* cron will pick it up */
  }
}