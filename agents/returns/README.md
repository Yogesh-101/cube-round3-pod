# RETURNIQ — Creative React/Vite + Flask Return Intelligence

RETURNIQ is an AI-assisted returns inspection workspace. This version keeps the existing React/Vite workflow, adds a production-shaped Flask API, persistent inspection-image storage, catalog-vs-return visual matching, optional Gemini vision analysis, and a more cinematic command-center theme.

## Project structure

```text
ProjectManagement/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── data/
│   │   ├── services/
│   │   ├── assets/images/
│   │   ├── index.css
│   │   ├── style.css
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── .env.example
│   └── storage/inspection-images/
└── README.md
```

## Frontend — npm

Requires Node.js 20+.

```bash
cd frontend
npm install
npm run dev
```

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

Vite runs on `http://localhost:3003` and proxies `/api/*` to Flask on port `3000`.

## Backend — Flask

Requires Python 3.10+.

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

Install:

```bash
pip install -r requirements.txt
```

Optional Gemini configuration:

```bash
cp .env.example .env
```

Set:

```env
GEMINI_API_KEY=your_real_key_here
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

Run:

```bash
python app.py
```

Health check:

```text
http://localhost:3000/api/health
```

## Return-image matching and storage

The inspection flow now sends the original catalog product image as the visual baseline together with every uploaded return image.

The Flask backend:

1. receives the return images;
2. saves normalized JPEG copies under `backend/storage/inspection-images/`;
3. exposes saved images through `/api/images/<filename>`;
4. computes a local perceptual similarity signal against the original catalog image;
5. optionally sends the catalog image + return images to Gemini when `GEMINI_API_KEY` is configured;
6. combines the visual result with the existing frontend decision engine;
7. returns structured identity, condition, completeness, integrity, and evidence information.

Important: image similarity is an inspection signal, not proof that a product is authentic. Serial numbers, barcodes, hidden components, and final fraud decisions should still use the existing evidence/manual-review workflow.

## API

### `GET /api/health`

Returns backend status and whether Gemini is configured.

### `POST /api/inspect`

JSON body:

```json
{
  "returnId": "RET-88410",
  "order": {
    "orderId": "ORD-10984",
    "productName": "Apple iPhone 15 Pro Max (256GB)",
    "brand": "Apple",
    "model": "A2849",
    "sku": "APPL-IPH15PM-256-NT",
    "serialNumber": "SERIAL",
    "expectedComponents": [],
    "expectedImageData": "data:image/jpeg;base64,..."
  },
  "images": [
    {
      "id": "img-1",
      "category": "FRONT",
      "name": "front.jpg",
      "data": "data:image/jpeg;base64,..."
    }
  ]
}
```

Response includes:

- `analysis`
- `visualMatch`
- `storedImages`
- `inspectionId`
- `processingTimeMs`
- analysis source

### `GET /api/inspections`

Returns recently saved inspection-image references.

## Visual design upgrades

The UI now includes:

- animated ambient AI/warehouse grid background;
- floating light-orb graphics;
- subtle scanline effect;
- glass-style operational panels;
- improved motion and hover depth;
- reduced-motion accessibility fallback;
- a dedicated `src/style.css` theme layer while preserving Tailwind;
- local imported demo product images so Vite builds can resolve assets correctly.

## Architecture

```text
React + TypeScript + Vite
        |
        | /api/inspect
        v
Flask REST API
        |
        +--> persistent inspection image storage
        |
        +--> local perceptual image matching
        |
        +--> optional Gemini Vision
        |
        +--> structured inspection result
        |
        v
Existing deterministic decision engine
        |
        v
Dashboard / Analytics / Manual Review / Certificate
```

## Security

Keep API keys only in `backend/.env`. Never put `GEMINI_API_KEY` in frontend code.

For production, replace the local filesystem storage with object storage (S3/GCS/Azure Blob), add authentication, database-backed inspection records, rate limiting, and virus/content validation for uploaded files.
