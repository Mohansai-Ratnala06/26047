# Vaidyaarc 🩺⚡

> Next-Generation AI Clinical Intelligence & Telemedicine Platform

Vaidyaarc is an end-to-end clinical intelligence ecosystem designed to bridge patient episodes, automated document intelligence (prescriptions, lab reports, discharge summaries), clinical risk & safety scoring, care pathways, and doctor-patient collaborative follow-ups.

---

## 📁 Repository Structure

```
Vaidyaarc/
├── backend/                       # Node.js + Express + TypeScript API Service
│   ├── src/
│   │   ├── config/                # Strongly typed environment configuration
│   │   ├── routes/                # Versioned API routes (/api/v1/...)
│   │   ├── controllers/           # HTTP controllers & response envelopes
│   │   ├── services/              # Domain business logic layer
│   │   ├── repositories/          # Data access layer (MongoDB)
│   │   ├── models/                # Database entities & schema definitions
│   │   ├── middleware/            # Security, logging, and error handling
│   │   ├── validators/            # Request payload schema validators (Zod)
│   │   ├── integrations/          # External integrations (S3, ABDM, LLMs)
│   │   ├── workflows/             # Multi-step clinical state machines & pipelines
│   │   ├── agents/                # Clinical reasoning & extraction AI agents
│   │   ├── types/                 # Shared TypeScript interfaces & DTOs
│   │   ├── app.ts                 # Express application factory
│   │   └── server.ts              # Server bootstrap and lifecycle management
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── mobile/                        # Cross-platform Expo React Native TypeScript App
│   ├── src/
│   │   ├── api/                   # Network client and API integration
│   │   ├── components/            # Reusable UI components (common & layout)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── navigation/            # App navigation stacks and tabs
│   │   ├── screens/               # Screen views & containers
│   │   ├── services/              # Client-side domain services
│   │   ├── store/                 # Global state management
│   │   ├── theme/                 # Design tokens (colors, typography, spacing)
│   │   ├── types/                 # Mobile TypeScript definitions
│   │   └── utils/                 # Utility helpers
│   ├── assets/                    # Icons, splash screens, and images
│   ├── App.tsx                    # Root UI entry
│   ├── app.json                   # Expo configuration (Expo Go compatible)
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                          # Architectural & Technical Specifications
│   ├── architecture.md            # System & layer architecture guide
│   ├── data-model.md              # Database schemas and data relationships
│   ├── api-contract.md            # REST API contracts and OpenAPI specs
│   └── workflows.md               # Clinical workflows and state machines
│
├── implementation/                # Phase-by-phase implementation blueprints
│   ├── PHASE_00_PROJECT_INIT.md
│   └── ...
│
└── PROJECT_SPEC.md                # High-level product & engineering specification
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **NPM**: v10+
- **Expo Go App**: (Optional for physical device preview) available on Google Play & Apple App Store

---

### 2. Backend Setup & Run

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run in development mode (with hot reloading)
npm run dev

# Or build and start production bundle
npm run build
npm start
```

Backend will be accessible at `http://localhost:5000`.

#### Verify Health Endpoint:
```bash
curl http://localhost:5000/api/v1/health
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "service": "vaidyaarc-api",
    "status": "healthy"
  }
}
```

---

### 3. Mobile Setup & Run (Expo Go)

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Start Expo development server
npx expo start
```

- Scan the QR code displayed in your terminal using the **Expo Go** app on iOS or Android.
- Press `a` to open on Android Emulator, `i` to open on iOS Simulator, or `w` to open on Web.

---

## 🔒 Environment Variables

### Backend (`backend/.env.example`)
| Variable | Description |
| :--- | :--- |
| `PORT` | Server listening port (default `5000`) |
| `NODE_ENV` | `development` / `production` / `test` |
| `API_PREFIX` | Prefix for API routes (default `/api/v1`) |
| `MONGODB_URI` | MongoDB connection string |
| `AWS_REGION` | AWS Region for S3 storage |
| `AWS_S3_BUCKET` | AWS S3 Bucket for clinical document storage |
| `OPENAI_API_KEY` | Placeholder for LLM extraction and agent pipelines |
| `GEMINI_API_KEY` | Placeholder for multimodal document processing |
| `ABDM_CLIENT_ID` | Ayushman Bharat Digital Mission API credentials |

### Mobile (`mobile/.env.example`)
| Variable | Description |
| :--- | :--- |
| `API_BASE_URL` | Base API URL pointing to the backend (e.g. `http://localhost:5000/api/v1`) |

---

- [ ] **Phase 10: Doctor Collaboration & Follow-up Outcomes**
- [ ] **Phase 11: External Integrations & ABDM Compliance**
