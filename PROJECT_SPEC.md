# Project Specification: Vaidyaarc 🩺

## 1. Product Objective
Vaidyaarc is a next-generation AI Clinical Intelligence & Telemedicine platform. The application provides an intuitive, accessible, and high-trust experience across patient and clinician workflows.

## 2. Design System Direction
- **Typography**: TT Firs Neue / Inter (fallback system geometric sans)
- **Primary Color**: Deep Teal (`#0A4D52`, `#0D5C63`)
- **Wash / Secondary**: Light Mint / Teal Wash (`#E6F4F1`, `#D1EBE7`, `#F0FAF8`)
- **Surfaces**: White (`#FFFFFF`), Premium Gray (`#F8FAFC`, `#F1F5F9`)
- **Text**: Soft Black (`#0F172A`, `#1E293B`, `#334155`)
- **Accents**: Mint (`#14B8A6`), Coral / Alert (`#EF4444`)
- **Shape & Elevation**: Rounded cards (16px–24px), soft subtle elevation, liquid/glass frosted visual influence.

## 3. Modular Architecture
- **Mobile Client**: Expo React Native TypeScript with custom Bottom Navigation (44px standard tabs, 56px center Voice Agent action target).
- **Backend Service**: Node.js, Express, TypeScript layered architecture.
- **Service Boundaries**: Decoupled `AuthService`, `ConversationService`, `RecordService`.

## 4. Phase Breakdown
- **Phase 00**: Project Initialization & Modular Foundation (Completed)
- **Phase 01**: Base Application UI & Design System (In Progress)
- **Phase 02**: Backend Foundation, Auth & RBAC
- **Phase 03**: Database Models & Repositories
- **Phase 04**: Secure Storage & Media Upload Pipeline
- **Phase 05**: Patient Episode Management & Intake
- **Phase 06**: Clinical History & Timeline Aggregation
- **Phase 07**: Document Intelligence & OCR Extraction
- **Phase 08**: Clinical Risk Scoring & Safety Triaging
- **Phase 09**: Dynamic Care Pathways & Protocols
- **Phase 10**: Doctor Follow-up & Outcome Assessment
- **Phase 11**: External Integrations & ABDM Compliance
