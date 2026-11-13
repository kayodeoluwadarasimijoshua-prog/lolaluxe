"""Run with owner writes paused. Then encrypt and copy the archive off-host."""

import argparse, sqlite3, tarfile, tempfile
from pathlib import Path
from datetime import datetime, timezone

p = argparse.ArgumentParser()
p.add_argument("data_dir")
p.add_argument("output_dir")
a = p.parse_args()
source = Path(a.data_dir).resolve()
out = Path(a.output_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory() as d:
    backup = Path(d) / "store.db"
    with sqlite3.connect(source / "store.db") as src, sqlite3.connect(backup) as dest:
        src.backup(dest)
    archive = out / (
        "lolaluxe-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".tar.gz"
    )
    with tarfile.open(archive, "w:gz") as t:
        t.add(backup, arcname="store.db")
        t.add(source / "uploads", arcname="uploads")
        t.add(source / "session.key", arcname="session.key")
    archive.chmod(0o600)
    print(archive)
