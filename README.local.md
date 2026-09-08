# ORCA Backend API

FastAPI backend for the ORCA coastal risk assessment prototype (SIH).
Pipeline: `data services (IMD/Open-Meteo) -> normalizer -> deterministic risk engine -> response
(+ optional guardrailed LLM explanation)`.

## Quickstart (Windows PowerShell)
```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```
- Swagger docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Root info |
| GET | `/health` | Liveness + cache stats |
| GET | `/api/meta` | Thresholds, sources, guardrails, demo locations |
| GET | `/api/demo/locations` | Saved demo locations |
| POST | `/api/assess` | Full risk assessment |

## Example
```bash
curl -X POST http://127.0.0.1:8000/api/assess -H "Content-Type: application/json" -d "{\"latitude\": 13.0827, \"longitude\": 80.2707}"
```
Demo mode is ON by default (`ORCA_DEMO_MODE=true`). Send `"demo": false` for live data,
or `"demo": true` to force the saved Chennai/Kochi samples (works fully offline).

## Tests
```powershell
pytest -q
```

## Docker
```powershell
docker compose up --build
```

## Guardrails
1. Official warnings (severity `warning`/`alert`) force risk to HIGH (`warning_override=true`).
2. The LLM layer is explanation-only and can never change score/level/recommendations.
3. Missing data is returned as `null` (never zero) and listed in `risk.missing_inputs`.
4. Wording is advisory (Low/Moderate/High) — never a guarantee of safety.