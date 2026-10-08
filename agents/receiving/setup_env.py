import json
import secrets
import os
from pathlib import Path

root = Path(__file__).parent
env_file = root / ".env"
frontend_env_file = root / "frontend" / ".env"

if not env_file.exists():
    env_example = root / ".env.example"
    if env_example.exists():
        content = env_example.read_text()
    else:
        content = ""
else:
    content = env_file.read_text()

op_key = secrets.token_urlsafe(32)
app_key = secrets.token_urlsafe(32)
seal_key = secrets.token_urlsafe(32)

keys_json = json.dumps({
    op_key: {"organization_id": "org-demo", "operator_id": "op-1", "role": "operator"},
    app_key: {"organization_id": "org-demo", "operator_id": "sup-1", "role": "approver"}
})

new_lines = []
for line in content.splitlines():
    if line.startswith("RECEIVING_API_KEYS="):
        new_lines.append(f"RECEIVING_API_KEYS={keys_json}")
    elif line.startswith("RECEIVING_SEAL_KEY="):
        new_lines.append(f"RECEIVING_SEAL_KEY={seal_key}")
    else:
        new_lines.append(line)

if "RECEIVING_API_KEYS=" not in content:
    new_lines.append(f"RECEIVING_API_KEYS={keys_json}")
if "RECEIVING_SEAL_KEY=" not in content:
    new_lines.append(f"RECEIVING_SEAL_KEY={seal_key}")

env_file.write_text("\n".join(new_lines) + "\n")

frontend_env_file.parent.mkdir(exist_ok=True)
frontend_env_content = f"VITE_RECEIVING_API_KEY={op_key}\nVITE_API_BASE_URL=http://localhost:8000\n"
frontend_env_file.write_text(frontend_env_content)

print("Environment setup complete.")
