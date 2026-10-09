import sys
from pathlib import Path

_RUNTIME = Path(__file__).resolve().parent / "runtime"
if str(_RUNTIME) not in sys.path:
    sys.path.insert(0, str(_RUNTIME))
