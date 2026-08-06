# Placify Custom Skill Definitions

This file contains the technical rules and logic patterns implemented in the Placify CRM.

## 1. Interview Support Validation & Proxy Reassignment
- **Core Logic**: All proxy assignments or reassignments must be programmatically validated against existing `InterviewRound` and `ProxyAvailability` records to prevent double bookings.
- **Buffer Rules**: A mandatory 15-minute buffer is applied before and after each interview slot to allow proxies adequate transition time.
- **Exclusion on Reassignment**: When reassigning an existing interview round, the active round's own ID (`round.id`) must be excluded from conflict calculations (passed as `excludeRoundId` in `findBestProxyForWindow`) so that the proxy is not flagged as conflicting with themselves for the same slot.
- **UI Safety Controls**: 
  - The proxy selection dropdown lists all proxy team members but appends a `(Busy/Conflict)` indicator next to unavailable options.
  - An inline red alert box is displayed when a conflicting proxy is selected: *"Scheduling Conflict Detected: This proxy is already assigned to another interview or has a manual block during this time window (including 15m buffers)."*
  - The "Assign" button is dynamically disabled (`disabled={!isSelectedProxyAvailable}`) to enforce scheduling integrity.
- **Implementation Location**: 
  - Validation: `src/services/interviewService.ts` (`findBestProxyForWindow`)
  - UI Modal: `src/components/ProxyAssignmentModal.tsx`

## 2. Public Access Rules & Direct Booking Uploads
- **Firestore Collection**: `jpc_cv_files`
- **Security Context**: The public `BookingPage` allows candidates to directly schedule their interviews and upload resumes without authenticating.
- **Rules Configuration**: To support this, Firestore security rules allow unauthenticated `create` and `write` operations specifically on the `jpc_cv_files` collection, while restricting update/delete actions to managers and administrators.
- **Implementation Location**: `/firestore.rules`

## 3. High-Volume List Optimization & Virtualized Rendering
- **Virtualization Pattern**: To maintain a butter-smooth 60fps scrolling experience in high-volume tables (such as the Candidates table), use `react-window`'s `<List>` component for collections exceeding 50 items.
- **Pagination Model**: Implement a lazy-loading "Load More" pagination pattern. The page fetches a subset of records up to a local state `limitCount` (default increment of 100) and displays a primary action button at the bottom of the virtualized grid to fetch the next block.
- **Implementation Location**: `src/pages/Candidates.tsx`

## 4. Timezone Consistency & Date Normalization
- **Standard**: All operations and scheduler blocks are normalized strictly to **EST (America/New_York)** using `getCalendarDateInfo`.
- **Validation**: Prevent timezone or browser drift by parsing raw date strings directly into UTC-anchored objects.
- **Implementation Location**: `src/services/calendarService.ts`
