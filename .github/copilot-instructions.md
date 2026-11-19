# Copilot Instructions for ai_mock-platfrom

## Repository overview

This repository contains a two-part app:

- `backend/` is a Django REST API for a mock-test / exam platform.
- `frontend/` is a Next.js app for the exam dashboard, login flow, and admin mock-data tooling.

The backend stores users, mock tests, saved progress, and scored attempts. The frontend consumes the API and lets users browse exam categories and attempt tests.

## Key architecture and files

- `backend/backend/settings.py` configures Django, DRF, CORS, and PostgreSQL via `DATABASE_URL` / `DATABASE_URL_POOLED`.
- `backend/api/models.py` defines the domain models:
  - `MockTest`
  - `TestResult`
  - `TestProgress`
- `backend/api/views.py` contains the business logic for:
  - user registration and login
  - listing tests and fetching test details
  - autosaving progress
  - submitting answers and computing scorecard analytics
  - importing JSON question banks
  - merging sectional tests into full mocks
- `backend/api/urls.py` exposes the API routes under `/api/...`.
- `frontend/lib/api.ts` centralizes the API base URL from `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_API_URL`.
- `frontend/app/login/page.tsx` is the auth flow.
- `frontend/app/dashboard/page.tsx` is the exam category and series browser.
- `frontend/app/admin/page.tsx` is the admin mock-builder / merger UI.

## Coding conventions

- Keep the backend and frontend behavior aligned. Changing a payload, route, or auth scheme in one side usually requires a matching update in the other.
- Preserve the existing domain language: `MockTest`, `PYQ`, `sectional`, `full mock`, `autosave`, `attempt_status`, and `section_breakdown`.
- Favor surgical, minimal changes that match the current file patterns rather than introducing new frameworks, abstraction layers, or unrelated refactors.
- Do not hardcode secrets or expose environment variables in committed code. Keep local configuration in `.env` files that are not checked in.
- Do not commit generated artifacts such as `.next/`, `node_modules/`, or local database state unless the task explicitly requires it.

## Frontend guidance

Before writing frontend code, read and follow the project-local rule in `frontend/AGENTS.md`.

That file states that this is not a standard Next.js app and that the agent should read the relevant next docs under `node_modules/next/dist/docs/` before writing code. Follow it carefully, especially around API conventions and app-router behavior.

Also follow these project-specific frontend rules:

- Use the App Router pattern already present in `frontend/app/`.
- Keep user-facing labels and flows consistent with the exam platform domain.
- Preserve client-side token handling via `localStorage` and the `Token` auth scheme used by the Django API.
- If a change affects routing or screen state, keep the existing UX patterns in `dashboard` and `admin` consistent.

## Backend guidance

- Prefer Django REST Framework patterns already used in `api/views.py`.
- Keep authentication enforcement and permissions consistent with `TokenAuthentication` and `IsAuthenticated`.
- When modifying the data model, check for migration impact and update the related API logic.
- Maintain backward compatibility for consumers of the mock-test JSON import pipeline and the scoring logic.

## Validation

Run the smallest relevant validation for the files you change.

- Backend validation: `cd backend && python manage.py check`
- Backend tests, if relevant: `cd backend && python manage.py test`
- Frontend validation: `cd frontend && npm run lint`
- Frontend production check if a route or build issue is likely: `cd frontend && npm run build`

If a change spans both halves of the repo, run the relevant checks for each side separately.

## Working style

- Start with a targeted read of the relevant files; avoid broad, unnecessary exploration.
- Prefer existing patterns over inventing new ones.
- When there is ambiguity, prefer the behavior that matches the current exam platform and the existing API contract.
- Keep the solution aligned with the repo's current architecture rather than guessing at a different stack.
