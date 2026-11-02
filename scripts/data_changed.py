"""Decide whether a scheduled refresh changed any published value, not just timestamps.

Exit 0 when the snapshot should be committed: a value in web/data/*.json differs from HEAD
after dropping run timestamps, raw-file hashes and raw error strings, or the snapshot committed
at HEAD was collected more than MAX_AGE_DAYS ago (so recorded last-success times never drift
past the 8-day freshness limit).
Exit 1 when only timestamps moved. The site is deployed from the working tree either way,
so visitors still see the latest collection time.
"""
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Run timestamps, raw-file hashes and raw error strings; a failure still shows up as a changed "status".
VOLATILE = {"attemptedAt", "lastSuccess", "lastAttempt", "verifiedAt", "discoveredAt", "checkedAt", "generatedAt", "sha256", "error", "requestErrors"}
MAX_AGE_DAYS = 3


def strip(value):
    if isinstance(value, dict):
        return {k: strip(v) for k, v in value.items() if k not in VOLATILE}
    if isinstance(value, list):
        return [strip(v) for v in value]
    return value


def at_head(path):
    try:
        return subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        return None


def changed_files():
    out = []
    for file in sorted((ROOT / "web/data").glob("*.json")):
        rel = file.relative_to(ROOT).as_posix()
        old = at_head(rel)
        if old is None or strip(json.loads(old)) != strip(json.loads(file.read_text())):
            out.append(rel)
    return out


def committed_snapshot_age_days():
    """Age of the collection recorded at HEAD. Read from the file, not git log: Actions checks out depth 1."""
    old = at_head("web/data/observations.json")
    try:
        stamp = datetime.fromisoformat(json.loads(old)["attemptedAt"]).timestamp()
    except (TypeError, KeyError, ValueError):
        return float("inf")
    return (time.time() - stamp) / 86400


if __name__ == "__main__":
    files = changed_files()
    if files:
        print("values changed:", ", ".join(files))
        sys.exit(0)
    age = committed_snapshot_age_days()
    if age > MAX_AGE_DAYS:
        print(f"only timestamps changed, but the committed snapshot is {age:.1f} days old")
        sys.exit(0)
    print("only timestamps changed; deploying without a commit")
    sys.exit(1)
