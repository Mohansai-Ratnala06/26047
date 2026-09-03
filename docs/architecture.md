# Vaidyaarc Architecture Overview

## 1. System High-Level Topology

```
+-------------------------------------------------------------+
|                      Mobile Client                          |
|             (React Native / Expo / TypeScript)              |
|                                                             |
|   +---------------+  +------------------+  +------------+   |
|   | Screen Views  |  | State Management |  | API Client |   |
|   +---------------+  +------------------+  +------------+   |
+--------------------------------|----------------------------+
                                 | HTTPS / REST
                                 v
+-------------------------------------------------------------+
|                      Backend Service                        |
|             (Node.js / Express / TypeScript)                |
|                                                             |
|   +-----------------------------------------------------+   |
|   | Routes & Versioning (/api/v1/...)                   |   |
|   +-----------------------------------------------------+   |
|   | Middleware (Auth, Security/Helmet, Logger, Errors)  |   |
|   +-----------------------------------------------------+   |
|   | Controllers (Request envelope & status mapping)     |   |
|   +-----------------------------------------------------+   |
|   | Validators (Zod Schemas)                            |   |
|   +-----------------------------------------------------+   |
|   | Services (Core Business Domain Logic)               |   |
|   +-----------------------------------------------------+   |
|   | Clinical Agents & Workflows (AI & Rule Engines)     |   |
|   +-----------------------------------------------------+   |
|   | Repositories (Data Access Layer)                    |   |
|   +-----------------------------------------------------+   |
+--------------------|-----------------------|----------------+
                     |                       |
                     v                       v
      +------------------------+   +-------------------+
      |   MongoDB / Database   |   | AWS S3 & Cloud /  |
      |   (Encrypted at rest)  |   | External APIs     |
      +------------------------+   +-------------------+
```

---

## 2. Backend Layered Architecture

The backend adopts strict separation of concerns into distinct modular layers:

1. **`config/`**: Centralized configuration management using strongly typed environment variables.
2. **`routes/`**: Route declarations cleanly organized under versioned paths (e.g., `/api/v1`).
3. **`controllers/`**: HTTP controllers that orchestrate input parsing, service invocation, and uniform API response packaging (`{ success, data, error }`).
4. **`validators/`**: Input validation schemas powered by Zod to guarantee typed runtime boundaries before reaching controllers.
5. **`middleware/`**: Cross-cutting concerns including security headers (`helmet`), CORS configuration, distributed request logging, JWT verification, and standardized error handling.
6. **`services/`**: Pure business logic containing patient intake flows, clinical evaluation logic, and care plan generation.
7. **`agents/`**: AI reasoning modules, multimodal LLM pipelines, prompt templates, and clinical safety guardrails.
8. **`workflows/`**: Deterministic state machine pipelines orchestrating multi-step clinical processes (e.g. document processing, patient triage, follow-up notifications).
9. **`repositories/`**: Database abstraction and data-access methods isolating database queries from domain logic.
10. **`models/`**: Domain schemas and data persistence entities.
11. **`integrations/`**: Third-party adapter clients (AWS S3, OCR services, ABDM gateways, SMS providers).
12. **`types/`**: Shared interfaces, DTOs, and global utility types.

---

## 3. Mobile Architecture (Expo React Native)

The mobile client is built on **React Native (Expo SDK 52) with TypeScript**, optimized for instant execution via **Expo Go**:

- **`screens/`**: High-level visual screens representing patient and clinician workflows.
- **`components/`**: Atomic, reusable UI elements grouped into `common` and `layout`.
- **`navigation/`**: Navigation stacks, tabs, and protected route guards.
- **`theme/`**: Design tokens defining colors, typography, elevations, and spacing.
- **`api/`**: Strongly typed REST API client wrappers.
- **`hooks/`**: Custom React hooks encapsulating stateful logic.
- **`store/`**: Centralized state management for authentication, cached patient summaries, and active episodes.
- **`services/`**: Client-side background services (e.g. offline sync, local storage).
- **`types/`**: Mobile-specific data contracts.
- **`utils/`**: Helper methods for formatting, date manipulation, and data transformation.

---

## 4. API Standardization

Every backend response conforms to the standard envelope format:

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable message"
}
```

### Error Response:
```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE_STRING",
    "details": {}
  }
}
```

---

## 5. Security & Compliance Principles
- **Zero Hardcoded Secrets**: All keys, connection strings, and endpoints are managed through environment variables (`.env`).
- **Data Isolation**: Encrypted storage for sensitive patient healthcare records and PHI.
- **Sanitized Headers**: Default inclusion of `helmet` and strict CORS policies.
