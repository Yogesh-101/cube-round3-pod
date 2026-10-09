import os
import sys
from pathlib import Path

# Configure writable directory on serverless environments
if "VERCEL" in os.environ or not os.environ.get("OUT_DIR"):
    os.environ["OUT_DIR"] = "/tmp/out"

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

RUNTIME = ROOT / "agents" / "pack" / "runtime"
if str(RUNTIME) not in sys.path:
    sys.path.insert(0, str(RUNTIME))

from orchestration.api import app
