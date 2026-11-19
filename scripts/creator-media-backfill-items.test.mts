import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

/** Pure helper checks for scripts/host_creator_media.collect_backfill_items */
test("collect_backfill_items skips YouTube portfolio and dedupes portfolio/top overlap", () => {
  const code = `
from pathlib import Path
import importlib.util
root = Path("scripts/host_creator_media.py").resolve()
spec = importlib.util.spec_from_file_location("hcm", root)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
shared = "https://www.instagram.com/reel/AbCdEf/"
inf = {
    "videos": [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.tiktok.com/@u/video/111",
        shared,
    ],
    "accounts": [
        {
            "platform": "Instagram",
            "top_posts": [
                {"url": shared, "type": "video", "views": 100, "likes": 1, "comments": 0},
                {"url": "https://www.instagram.com/reel/PhotoOnly/", "type": "image", "views": 50},
            ],
        }
    ],
}
items = mod.collect_backfill_items(inf)
kinds = [(i["kind"], i["url"]) for i in items]
assert not any("youtube.com" in i["url"] for i in items)
assert not any("PhotoOnly" in i["url"] for i in items)
assert ("portfolio", shared) in kinds
assert ("portfolio", "https://www.tiktok.com/@u/video/111") in kinds
# Top-post slot still lists the IG reel; hosting reuses the portfolio folder.
assert ("top_post", shared) in kinds
`;
  const py = process.platform === "win32" ? "py" : "python3";
  const r = spawnSync(py, ["-c", code], { encoding: "utf-8", cwd: process.cwd() });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});