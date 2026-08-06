# PASTE THIS ENTIRE PROMPT INTO GOOGLE AI STUDIO

You are working on the Placify CRM (Auriic CRM) codebase. The app has a severe performance problem: every page creates its own Firestore `subscribeToCollection` real-time listeners independently. The collection `jpc_candidates` is subscribed 20 times and `jpc_users` 17 times across different pages. When a user opens any page, dozens of duplicate Firestore listeners fire simultaneously, causing massive read costs, slow load times, and browser lag.

## YOUR TASK

Fix this by creating a shared `DataContext` that subscribes ONCE to each collection, then migrate every page to use it. Do this in exact order:

---

## STEP 1: Create `src/contexts/DataContext.tsx`

Create this NEW file exactly:

```tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { subscribeToCollection } from '../services/storage';
import { useAuth } from './AuthContext';
import type {
  Candidate, User, Application, FollowUp, Payment,
  TargetReductionRequest, InterviewSupportRequest, InterviewRound,
  InterviewFeedback, ProxyAvailability, ResumeChangeRequest,
  RTRRequest, ResumePrepRequest, FeatureAnnouncement,
} from '../types';

interface DataContextType {
  candidates: Candidate[];
  users: User[];
  applications: Application[];
  followUps: FollowUp[];
  payments: Payment[];
  targetReductions: TargetReductionRequest[];
  resumeRequests: ResumeChangeRequest[];
  rtrRequests: RTRRequest[];
  prepRequests: ResumePrepRequest[];
  featureAnnouncements: FeatureAnnouncement[];
  interviewRequests: InterviewSupportRequest[];
  interviewRounds: InterviewRound[];
  interviewFeedbacks: InterviewFeedback[];
  proxyAvailabilities: ProxyAvailability[];
  calendarEvents: any[];
  isDataReady: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthReady } = useAuth();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [targetReductions, setTargetReductions] = useState<TargetReductionRequest[]>([]);
  const [resumeRequests, setResumeRequests] = useState<ResumeChangeRequest[]>([]);
  const [rtrRequests, setRtrRequests] = useState<RTRRequest[]>([]);
  const [prepRequests, setPrepRequests] = useState<ResumePrepRequest[]>([]);
  const [featureAnnouncements, setFeatureAnnouncements] = useState<FeatureAnnouncement[]>([]);
  const [interviewRequests, setInterviewRequests] = useState<InterviewSupportRequest[]>([]);
  const [interviewRounds, setInterviewRounds] = useState<InterviewRound[]>([]);
  const [interviewFeedbacks, setInterviewFeedbacks] = useState<InterviewFeedback[]>([]);
  const [proxyAvailabilities, setProxyAvailabilities] = useState<ProxyAvailability[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  const [loadedCount, setLoadedCount] = useState(0);
  const TOTAL = 15;
  const markLoaded = () => setLoadedCount(prev => Math.min(prev + 1, TOTAL));

  useEffect(() => {
    if (!isAuthReady) return;
    const isBookingPage = window.location.hash.startsWith('#book-interview');
    if (!user && !isBookingPage) return;

    setLoadedCount(0);
    const unsubs: (() => void)[] = [];

    const sub = <T,>(name: string, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
      let first = true;
      unsubs.push(subscribeToCollection<T>(name, (data) => {
        setter(data);
        if (first) { markLoaded(); first = false; }
      }));
    };

    sub<Candidate>('jpc_candidates', setCandidates);
    sub<User>('jpc_users', setUsers);
    sub<Application>('jpc_applications', setApplications);
    sub<FollowUp>('jpc_followups', setFollowUps);
    sub<Payment>('jpc_payments', setPayments);
    sub<TargetReductionRequest>('jpc_target_reductions', setTargetReductions);
    sub<ResumeChangeRequest>('jpc_resume_requests', setResumeRequests);
    sub<RTRRequest>('jpc_rtr_requests', setRtrRequests);
    sub<ResumePrepRequest>('jpc_prep_requests', setPrepRequests);
    sub<FeatureAnnouncement>('jpc_feature_announcements', setFeatureAnnouncements);
    sub<InterviewSupportRequest>('jpc_interview_requests', setInterviewRequests);
    sub<InterviewRound>('jpc_interview_rounds', setInterviewRounds);
    sub<InterviewFeedback>('jpc_interview_feedback', setInterviewFeedbacks);
    sub<ProxyAvailability>('jpc_proxy_availability', setProxyAvailabilities);
    sub<any>('jpc_calendar_events', setCalendarEvents);

    return () => unsubs.forEach(fn => fn());
  }, [isAuthReady, user?.id]);

  const isDataReady = loadedCount >= TOTAL;

  const value = useMemo<DataContextType>(() => ({
    candidates, users, applications, followUps, payments,
    targetReductions, resumeRequests, rtrRequests, prepRequests,
    featureAnnouncements, interviewRequests, interviewRounds,
    interviewFeedbacks, proxyAvailabilities, calendarEvents, isDataReady,
  }), [
    candidates, users, applications, followUps, payments,
    targetReductions, resumeRequests, rtrRequests, prepRequests,
    featureAnnouncements, interviewRequests, interviewRounds,
    interviewFeedbacks, proxyAvailabilities, calendarEvents, isDataReady,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
```

---

## STEP 2: Update `src/App.tsx`

Add this import at the top with the other context imports:
```tsx
import { DataProvider } from './contexts/DataContext';
```

Then wrap `<DataProvider>` around `<ToastProvider>` in the default export at the bottom of the file. Change:
```tsx
<ThemeProvider>
  <AuthProvider>
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  </AuthProvider>
</ThemeProvider>
```
To:
```tsx
<ThemeProvider>
  <AuthProvider>
    <DataProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </DataProvider>
  </AuthProvider>
</ThemeProvider>
```

Do NOT change anything else in App.tsx.

---

## STEP 3: Migrate Sidebar (`src/components/Sidebar.tsx`)

REMOVE these imports:
```tsx
import { subscribeToCollection } from '../services/storage';
import { FollowUp, Candidate, User } from '../types';
```

ADD this import:
```tsx
import { useData } from '../contexts/DataContext';
```

REMOVE `useState` for `allFollowUps`, `allCandidates`, `allUsers` and the entire `useEffect` that subscribes to `jpc_followups`, `jpc_candidates`, `jpc_users`.

ADD at the top of the component function:
```tsx
const { candidates: allCandidates, users: allUsers, followUps: allFollowUps } = useData();
```

Also remove `useState` and `useEffect` from the React import if they are no longer used. Keep `useMemo`.

All the `useMemo` blocks and JSX stay exactly the same — they already use `allFollowUps`, `allCandidates`, `allUsers`.

---

## STEP 4: Migrate each page file

For each file below, apply the SAME pattern: add `import { useData } from '../contexts/DataContext';`, call `const { ... } = useData();` at top of component, remove the `useState` + `subscribeToCollection` useEffect for those collections, and keep all other logic and JSX unchanged.

### `src/pages/Dashboard.tsx`
```tsx
const { candidates, users: allUsers, applications, followUps, resumeRequests, interviewRequests: interviews, targetReductions: targetRequests, featureAnnouncements } = useData();
```
REMOVE the `useState` for: `candidates/setCandidates`, `followUps/setFollowUps`, `resumeRequests/setResumeRequests`, `interviews/setInterviews`, `targetRequests/setTargetRequests`, `applications/setApplications`, `allUsers/setAllUsers`, `featureAnnouncements/setFeatureAnnouncements`.
REMOVE the 8 `subscribeToCollection` calls from the `useEffect`.
KEEP the `notifications` subscription (it uses `subscribeToQuery` with a `where` filter — that's different).
KEEP the `isLoading` state but change it: remove `setIsLoading(false)` from inside the old candidates subscription callback. Instead, use `const isLoading = !useData().isDataReady;` OR simply set `isLoading` to false based on `candidates.length` or remove the loading state entirely since DataContext handles it.
KEEP all `useMemo`, JSX, and event handlers exactly the same.
For `featureAnnouncements`, the old code filtered `a.is_active` inside the subscription callback. Move that filter to the `activeAnnouncements` useMemo instead: `featureAnnouncements.filter(a => a.is_active && ...)`.
Remove `subscribeToCollection` from the storage import. Keep `subscribeToQuery`, `markNotificationAsRead` if still used.

### `src/pages/InterviewSupport/Dashboard.tsx`
```tsx
const { interviewRequests: requests, interviewRounds: rounds, interviewFeedbacks: feedbacks, candidates, proxyAvailabilities: availabilities, calendarEvents, users } = useData();
const team = users; // or rename usage below
```
REMOVE useState for: `requests`, `rounds`, `feedbacks`, `candidates`, `team`, `availabilities`, `calendarEvents`.
REMOVE the 7 `subscribeToCollection` calls.
KEEP: all `getDocs`/`getDoc` calls inside event handlers — those are on-demand reads, NOT subscriptions.
The old code filtered team to set `setTeam(data.filter(u => !u.deleted_at))` — apply that filter in a useMemo instead.
Update import path: `import { useData } from '../../contexts/DataContext';`

### `src/pages/InterviewSupport/ProxyDashboard.tsx`
```tsx
const { proxyAvailabilities: availability, interviewRounds: rounds, interviewFeedbacks: feedbacks, interviewRequests: requests, candidates, users: team, calendarEvents } = useData();
```
REMOVE useState for: `availability`, `rounds`, `feedbacks`, `requests`, `candidates`, `team`, `calendarEvents`.
REMOVE the 7 `subscribeToCollection` calls.
KEEP all `getDocs`/`getDoc`/`deleteDoc` calls inside handlers.
Update import path: `import { useData } from '../../contexts/DataContext';`

### `src/pages/TargetDashboard.tsx`
```tsx
const { candidates, applications, targetReductions, users, interviewRequests: interviews } = useData();
const team = users;
const targetRequests = targetReductions;
```
REMOVE useState for: `candidates`, `applications`, `targetRequests`, `team`, `interviews`.
REMOVE the 5 `subscribeToCollection` calls.
The old code filtered targetReductions: `data.filter(r => ...)` — move that to a useMemo.
The old code filtered team: `data.filter(u => !u.deleted_at)` — move that to a useMemo.

### `src/pages/Candidates.tsx`
```tsx
const { candidates, users: allUsers, applications, followUps } = useData();
```
REMOVE useState for: `candidates`, `allUsers`/users, `applications`/apps, `followUps`.
REMOVE the 4 `subscribeToCollection` calls.

### `src/pages/AppTracker.tsx`
```tsx
const { applications, candidates, users } = useData();
const team = users;
```
REMOVE useState for: `applications`/apps, `candidates`, `team`/users.
REMOVE the 3 `subscribeToCollection` calls for `jpc_applications`, `jpc_candidates`, `jpc_users`.
**KEEP** the `subscribeToCollection` for `jpc_report_logs` — that collection is NOT in DataContext.
Keep `subscribeToCollection` in the import since it's still used for report_logs.

### `src/pages/CRMDashboard.tsx`
```tsx
const { candidates, followUps, applications, users: allUsers } = useData();
```
REMOVE useState for: `candidates`, `followUps`, `applications`, `allUsers`.
REMOVE the 4 `subscribeToCollection` calls.

### `src/pages/Team.tsx`
```tsx
const { users: team, candidates } = useData();
```
REMOVE useState for: `team`, `candidates`.
REMOVE the 2 `subscribeToCollection` calls.
KEEP `saveUser`, `generateId` in the storage import — those are still used.
KEEP all `getDocs`, `setDoc`, `deleteDoc` calls inside handlers.

### `src/pages/ResumeLogBook.tsx`
```tsx
const { resumeRequests: requests, candidates, users: team } = useData();
```
REMOVE useState for: `requests`, `candidates`, `team`.
REMOVE the 3 `subscribeToCollection` calls.
The old code filtered requests: `data.sort(...)` — move to useMemo.

### `src/pages/RTRLogBook.tsx`
```tsx
const { rtrRequests: requests, candidates, users: team } = useData();
```
REMOVE useState for: `requests`, `candidates`, `team`.
REMOVE the 3 `subscribeToCollection` calls.

### `src/pages/ResumePrepLog.tsx`
```tsx
const { prepRequests: requests, candidates, users: team } = useData();
```
REMOVE useState for: `requests`, `candidates`, `team`.
REMOVE the 3 `subscribeToCollection` calls.

### `src/pages/Pipeline.tsx`
```tsx
const { candidates, users: allUsers } = useData();
```
REMOVE useState for: `candidates`, `allUsers`.
REMOVE the 2 `subscribeToCollection` calls.

### `src/pages/FollowUps.tsx`
```tsx
const { followUps, candidates } = useData();
```
REMOVE useState for: `followUps`, `candidates`.
REMOVE the 2 `subscribeToCollection` calls.
KEEP `updateFollowUp`, `logActivity` in storage import.

### `src/pages/NotInterested.tsx`
```tsx
const { candidates, users: allUsers } = useData();
```
REMOVE useState for: `candidates`, `allUsers`.
REMOVE the 2 `subscribeToCollection` calls.
KEEP `saveCandidate`, `logActivity` in storage import.

### `src/pages/NotEligible.tsx`
```tsx
const { candidates, users: allUsers } = useData();
```
REMOVE useState for: `candidates`, `allUsers`.
REMOVE the 2 `subscribeToCollection` calls.
KEEP `saveCandidate`, `logActivity` in storage import.

### `src/pages/FeatureAnnouncements.tsx`
```tsx
const { featureAnnouncements: announcements } = useData();
```
REMOVE useState for `announcements`.
REMOVE the 1 `subscribeToCollection` call.

---

## STEP 5: Handle isLoading state

Many pages have `const [isLoading, setIsLoading] = useState(true)` and set it to `false` inside a subscription callback. Since data now comes from DataContext, replace this pattern:

Option A (simplest): Remove `isLoading` state entirely, and use `const { isDataReady } = useData();` then render the loading spinner when `!isDataReady`.

Option B (keeps existing pattern): Keep `isLoading` state but set it based on data:
```tsx
const { candidates, isDataReady } = useData();
const [isLoading, setIsLoading] = useState(true);
useEffect(() => { if (isDataReady) setIsLoading(false); }, [isDataReady]);
```

---

## FILES TO NEVER TOUCH

- `src/pages/InterviewSupport/BookingPage.tsx` — Public page, uses one-time `getDocs` reads, no subscriptions. Leave it alone.
- `src/pages/CandidateDetail.tsx` — Uses 10 filtered `onSnapshot` with `where('candidate_id', '==', id)` which are efficient. The only change allowed is replacing its `subscribeToCollection<User>('jpc_users', ...)` with `useData().users`. Keep the other 10 subscriptions.
- `src/pages/CandidateDashboard.tsx` — All subscriptions use filtered `onSnapshot`. Leave it alone.
- `src/pages/Receipt.tsx` — Uses `onSnapshot` on specific document IDs. Leave it alone.
- `src/components/NotificationList.tsx` — Uses `subscribeToQuery` with `where('recipient_id', '==', user.id)`. Leave it alone.

---

## CRITICAL RULES

1. Do NOT change any JSX, useMemo logic, or event handlers. Only change how data enters the component.
2. Do NOT remove `useState`/`useEffect` from React imports if other state variables or effects still use them.
3. Do NOT remove storage.ts functions like `saveCandidate`, `logActivity`, `generateId`, `updateFollowUp` from imports — those are write operations, not subscriptions.
4. If a page's subscription callback had a `.filter()` or `.sort()` (e.g. `data.filter(u => !u.deleted_at)`), move that filter into a `useMemo` instead.
5. Preserve ALL existing Firestore `getDocs`/`getDoc`/`updateDoc`/`setDoc`/`deleteDoc` calls inside event handlers — those are on-demand operations, NOT subscriptions.
6. After all changes, run `npm run lint` to confirm no TypeScript errors.