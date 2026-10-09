# Provenance: Returns Manager Agent

- **Source Repository**: `https://github.com/2420030580-HEMA/cube26-rtn-0259-2420030580-hema`
- **Origin Commit**: `a0b9f44`
- **Author/Owner**: 2420030580-HEMA
- **Stage**: Returns Manager (`agents/returns`)
- **Key Modules**:
  - `returns_manager_agent.py`: 5-Check Condition Protocol & Conservative Decision Engine
  - `database.py`: Dual-Engine Persistence (SQLite + Supabase REST API)
  - `evaluate_agent.py`: 50-Sample Unseen Evaluation Suite (88% Accuracy, 0 False Positives)
  - `schema.sql`: Database schema definition
  - `frontend/`: React 19 + TypeScript + Vite HUD & Operator Console
  - `backend/app.py`: Flask / FastAPI inspection API
