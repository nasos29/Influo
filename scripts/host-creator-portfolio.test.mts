import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import test from "node:test";

function runHostCreatorPython(script: string): SpawnSyncReturns<string> {
  const attempts =
    process.platform === "win32"
      ? [
          { cmd: "py", args: ["-3", "-c", script] },
          { cmd: "python", args: ["-c", script] },
        ]
      : [
          { cmd: "python3", args: ["-c", script] },
          { cmd: "python", args: ["-c", script] },
        ];
  for (const { cmd, args } of attempts) {
    const r = spawnSync(cmd, args, { cwd: "scripts", encoding: "utf8" });
    if (r.status === 0) return r;
    if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") continue;
    return r;
  }
  return spawnSync("python", ["-c", script], { cwd: "scripts", encoding: "utf8" });
}

test("wanted_portfolio keeps self-hosted upload URLs for link-job pruning", () => {
  const script = `
from host_creator_media import wanted_portfolio_url_norms, normalize_source_url
base = "https://media.example.com"
upload = f"{base}/creators/11111111-2222-3333-4444-555555555555/portfolio/upload-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee/video.mp4"
inf = {"videos": [upload, "https://www.tiktok.com/@x/video/1"]}
wanted = wanted_portfolio_url_norms(inf)
assert normalize_source_url(upload) in wanted
assert len(wanted) == 2
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});

test("is_self_hosted_media_url resolves media_public_base_url without AttributeError", () => {
  const script = `
import os
os.environ["MEDIA_PUBLIC_BASE_URL"] = "https://media.example.com"
from host_creator_media import is_self_hosted_media_url
self_hosted = "https://media.example.com/creators/11111111-2222-3333-4444-555555555555/portfolio/ig-abc/video.mp4"
external = "https://www.tiktok.com/@x/video/1"
assert is_self_hosted_media_url(self_hosted) is True
assert is_self_hosted_media_url(external) is False
print("ok")
`;
  const r = runHostCreatorPython(script);
  assert.equal(r.status, 0, r.stderr || r.stdout || String(r.error));
  assert.match(r.stdout, /ok/);
});