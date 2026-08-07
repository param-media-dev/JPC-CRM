# Agent Instructions

## Performance & Large Datasets
- **Virtualized Lists**: Always use `react-window` (import `{ List } from 'react-window'`) for large tables or lists (e.g., Candidates).
- **Load More / Pagination**: Implement a "Load More" button for collections that could exceed 1000 items. Default increment is 100.
- **Debounced Search**: Always use `useDebounce` hook for search inputs that filter large Firestore subscriptions to avoid UI stutter.

## Interview Support System
- **Proxy Scheduling Validation**: When assigning or reassigning a proxy to an interview round, you MUST use `findBestProxyForWindow` to check for scheduling conflicts (including 15-minute buffers and manual blocks).
- **Public Uploads**: The `jpc_cv_files` collection in Firestore must allow `create` and `write` for unauthenticated users to support the public `BookingPage`.

## Styling & UX
- **Truncation**: Use `truncate` or `line-clamp` on names and notes in dense views (Pipeline, Follow-ups) to prevent layout breaking.
- **Scrollbars**: Use `custom-scrollbar` and `scrollbar-hide` where appropriate to keep the UI clean.
