# ORCA — AI-Assisted Marine Intelligence & Safety Platform

> **Smart India Hackathon (SIH) 2026 Internal Round Prototype**

ORCA is an AI-assisted marine safety platform designed for fishermen, coastal communities, and marine authorities. It unifies weather forecasts, ocean wave dynamics, and official IMD/cyclone bulletins into a clear, actionable coastal risk rating.

---

## Table of Contents
1. [Overview & Core Design](#overview--core-design)
2. [Key Features](#key-features)
3. [Architecture & AI Guardrails](#architecture--ai-guardrails)
4. [Folder Structure](#folder-structure)
5. [Prerequisites](#prerequisites)
6. [Backend Setup & Execution](#backend-setup--execution)
7. [Frontend Setup & Execution](#frontend-setup--execution)
8. [Demo / Offline Mode Instructions](#demo--offline-mode-instructions)
9. [API Documentation](#api-documentation)
10. [Testing](#testing)
11. [Known Limitations & Future Scope](#known-limitations--future-scope)

---

## Overview & Core Design

Coastal users face complex marine hazards: high swell, gale-force winds, unpredictable rip currents, and sudden weather shifts. Traditional bulletins use dense meteorology terminology. 

**ORCA solves this by:**
- Aggregating real-time weather & marine metrics (Open-Meteo & IMD fallback adapters).
- Calculating a deterministic risk rating (`LOW`, `MODERATE`, `HIGH`).
- Enforcing safety guardrails: official cyclone and marine warnings **automatically override** normal scores to `HIGH`.
- Providing plain-language advisory explanations via a guardrailed AI module.

### Why is the Risk Engine Deterministic?
Life safety decisions **cannot** depend on generative LLM outputs, which can hallucinate or fluctuate unpredictably. 
- **Deterministic Risk Engine**: Responsible for 100% of score calculation, risk level assignment, and warning overrides.
- **LLM Role**: Translation and plain-language explanation **only**. The LLM layer is strictly guardrailed and cannot modify scores or safety recommendations.

---

## Key Features

- **Interactive Coastal Map**: Leaflet map for pinpointing coastal locations across the Indian peninsula.
- **Real-Time Data & Offline Demo Mode**: Works with live Open-Meteo marine data or 100% offline using saved demo profiles (Chennai, Kochi Cyclone Alert, Vizag, Mumbai, Goa).
- **Official Warning Bulletins**: Automatic highlight of IMD marine/cyclone warning alerts.
- **Null Data Integrity**: Missing measurements remain `null` and are penalized by the engine—never assumed to be zero.
- **Mobile-Responsive UI**: Dark glassmorphic interface tailored for field use.

---

## Folder Structure

```
PoseidonAgent/
├── app/                      # Backend FastAPI Application
│   ├── main.py               # FastAPI entry point & CORS configuration
│   ├── config.py             # Configuration & environment variables
│   ├── schemas/              # Pydantic data models (contracts)
│   ├── routes/               # API endpoints (assess, health, meta)
│   ├── services/             # External services (IMD, Open-Meteo, LLM, demo data)
│   ├── core/                 # Deterministic risk engine & pipeline
│   ├── utils/                # Logging, error handling & geo validators
│   └── demo/                 # Offline demo dataset (chennai.json, kochi.json)
├── frontend/                 # Frontend React + Vite Application
│   ├── src/
│   │   ├── components/       # UI components (MapPicker, RiskBadgeCard, Cards, etc.)
│   │   ├── services/         # API integration client (api.js)
│   │   ├── App.jsx           # Main React component
│   │   └── index.css         # Tailwind v4 & Leaflet CSS styling
│   ├── package.json
│   └── vite.config.js
├── tests/                    # Backend unit & integration test suite
├── .env.example              # Environment template
├── Dockerfile                # Docker container build script
├── docker-compose.yml        # Docker compose orchestrator
├── postman_collection.json   # Postman API test collection
├── requirements.txt          # Python dependencies
└── run.py                    # Uvicorn launcher script
```

---

## Prerequisites

- **Python**: 3.10+ (Tested on Python 3.14)
- **Node.js**: v18+ (Tested on Node v20)
- **Git**

---

## Backend Setup & Execution

1. **Navigate to project root**:
   ```bash
   cd "PoseidonAgent"
   ```

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment File**:
   ```bash
   copy .env.example .env
   ```

4. **Start Backend Server**:
   ```bash
   python run.py
   ```
   *The server runs at `http://127.0.0.1:8000`.*
   - Swagger Documentation: `http://127.0.0.1:8000/docs`
   - Health Endpoint: `http://127.0.0.1:8000/health`

---

## Frontend Setup & Execution

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install Node dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   *The UI runs at `http://localhost:5173`.*

4. **Build for Production**:
   ```bash
   npm run build
   ```

---

## Demo / Offline Mode Instructions

ORCA is designed to be demonstrated seamlessly during SIH internal presentations even without internet access:

1. **Toggle Demo Mode** in the top navigation bar of the Web UI, or set `"demo": true` in the API request body.
2. Select any quick preset location (e.g. **Kochi Port** for Cyclone Warning demonstration, **Chennai Coast** for Moderate Risk demo).
3. The application will use local cached JSON datasets from `app/demo/` without making external network calls.

---

## API Documentation

### Primary Assessment Endpoint: `POST /api/assess`

**Request Body Example**:
```json
{
  "latitude": 13.0827,
  "longitude": 80.2707,
  "label": "Chennai Coast",
  "demo": true,
  "include_explanation": true
}
```

**Response Example**:
```json
{
  "request_id": "8d4cec9988b9",
  "assessed_at": "2026-09-08T21:22:58Z",
  "mode": "demo",
  "api_version": "0.2.0",
  "location": {
    "latitude": 13.0827,
    "longitude": 80.2707,
    "label": "Chennai Coast"
  },
  "weather": {
    "temperature_c": 29.4,
    "wind_speed_kmph": 22.5,
    "precipitation_mm_24h": 5.0
  },
  "ocean": {
    "wave_height_m": 1.8,
    "swell_height_m": 1.2,
    "ocean_current_speed_kmph": 2.1
  },
  "warnings": [],
  "risk": {
    "score": 48.5,
    "level": "MODERATE",
    "warning_override": false,
    "recommendation": "Exercise caution near the coast. Inexperienced swimmers should stay out of the water."
  },
  "explanation": {
    "text": "Moderate wind speeds and wave heights of 1.8m warrant caution near the coast.",
    "provider": "template",
    "guardrail": "Advisory only. This text cannot change the risk score or official warnings."
  }
}
```

---

## Testing

Run the test suite using pytest:
```bash
python -m pytest tests/test_assess.py tests/test_risk_engine.py
```

---

## Regional Language Support (Marathi `mr`)

ORCA includes automatic regional language detection and manual language controls for coastal advisories:

- **Supported Languages**: English (`en`), Marathi (`mr`, Devanagari script `मराठी`).
- **Automatic Regional Language Behavior**:
  - When the selected location is in **Mumbai** (18.70°N–19.40°N, 72.70°E–73.15°E) or **Goa** (14.80°N–15.80°N, 73.60°E–74.30°E), the AI summary automatically defaults to **Marathi (`mr`)**.
  - Locations outside these coastal bounding boxes (e.g. Chennai, Kochi, Visakhapatnam) retain **English (`en`)** by default.
- **Manual Language Override**:
  - Users can manually switch between **Automatic**, **English**, and **मराठी (Marathi)** via the UI language selector.
  - Manual overrides take immediate effect while preserving all underlying risk scores and official warning bulletins.
- **Region Detection Authority**:
  - Latitude and longitude coordinates take primary precedence via bounding box validation (`detectRegionalLanguage(lat, lon, label)`). Location name keywords serve as a fallback.
- **Testing Regional Language Support Locally**:
  ```bash
  python -m pytest tests/test_marathi_regional.py
  ```

---

## Known Limitations & Future Scope

### Known Limitations
- Coastal wave dynamics vary close to the shoreline; regional models provide grid-averaged forecasts.
- Official IMD API endpoints require government credentials; Open-Meteo Marine is used as live fallback.

### Future Scope
- **INCOIS Ocean State Forecast Integration**: Incorporate Potential Fishing Zone (PFZ) advisory layers.
- **Multilingual Voice Assistance**: Audio advisories in Tamil, Malayalam, Telugu, Bengali, and Hindi for illiterate fishermen.
- **Navigational Route Risk Overlay**: Spatial risk maps along fishing tracks.