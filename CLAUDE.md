# CLAUDE.md - Auriic CRM (Placify) Development Guide

## Project Overview
Auriic CRM (Placify) is a professional application tracking system and interview support platform. It features real-time updates via Firestore, multi-role access control, automated performance tracking, and Google Calendar integration.

## Tech Stack
- **Frontend**: React 19, Vite, Tailwind CSS 4, React Router 7, Motion, Recharts.
- **Backend**: Express (Node.js), `firebase-admin`, `node-cron`, `googleapis`.
- **Database**: Firebase Firestore (`production-placify`).
- **AI**: Gemini API (@google/genai) for compliance auditing.

## Build & Development Commands
- `npm run dev`: Starts the Express server with `tsx` (Vite middleware handles frontend).
- `npm run build`: Builds frontend and bundles `server.ts` into `api/index.js` (for Vercel/Cloud Run).
- `npm start`: Runs the production server.
- `npm run lint`: Runs TypeScript type checks.

## Project Structure
- `/src/pages/`: Core views (Dashboard, Pipeline, Interview Support, etc.).
- `/src/components/`: Reusable UI components (Shared layout, Modals, Forms).
- `/src/services/`:
  - `storage.ts`: Firestore CRUD and real-time subscriptions.
  - `interviewService.ts`: Logic for booking links and scheduling.
  - `calendarService.ts`: Google Calendar API integration.
  - `aiService.ts`: Gemini API handlers.
- `server.ts`: Main entry point for API routes, Cron jobs, and OAuth flows.

## Core Architectural Patterns
- **Real-time Data**: Use `onSnapshot` (via `subscribeToCollection`) for most lists to ensure live updates across teams.
- **Role-Based UI**: Check `user.role` (defined in `types.ts`) to gate features and navigation.
- **Server-Side Secrets**: All API keys (Gemini, SMTP, OAuth) must stay on the server. Use `/api/*` routes for sensitive operations.
- **Virtualization**: Use `react-window` for large data sets (e.g., Candidates list).

## Critical Business Logic
- **Recruiter Targets**: Daily target is 40 applications per profile assigned to a candidate.
- **Performance Status**:
  - **PASS**: >= 4 activities (screenings/interviews) per month.
  - **STABLE**: 2-3 activities per month.
  - **FAIL**: 0-1 activities per month.
- **Interview Scheduling**: Always use `findBestProxyForWindow` to check for proxy conflicts (includes 15-minute buffers).
- **Public Booking**: The `BookingPage` is public; `jpc_cv_files` must allow unauthenticated writes for resume uploads.

## Environment Variables
Declared in `.env.example`:
- `GEMINI_API_KEY`: For AI compliance auditing.
- `FIREBASE_SERVICE_ACCOUNT`: For server-side Firestore access.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Google Calendar OAuth.
- `RESUME_API_URL`: (Optional) for external resume processing.

## Security & Constraints
- **IP Restriction**: The app includes IP-based access logic (see `server.ts`).
- **Port**: Always bind the server to port `3000`.
