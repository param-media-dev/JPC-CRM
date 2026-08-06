import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToCollection } from '../services/storage';
import { useAuth } from './AuthContext';
import type {
  Candidate, User, Application, FollowUp, Payment,
  TargetReductionRequest, InterviewSupportRequest, InterviewRound,
  InterviewFeedback, ProxyAvailability, ResumeChangeRequest,
  RTRRequest, ResumePrepRequest, FeatureAnnouncement,
} from '../types';

// ---------------------------------------------------------------------------
// Each collection gets its own context so updating applications
// doesn't re-render pages that only use candidates.
// ---------------------------------------------------------------------------

const CandidatesCtx = createContext<Candidate[]>([]);
const UsersCtx = createContext<User[]>([]);
const ApplicationsCtx = createContext<Application[]>([]);
const FollowUpsCtx = createContext<FollowUp[]>([]);
const PaymentsCtx = createContext<Payment[]>([]);
const TargetReductionsCtx = createContext<TargetReductionRequest[]>([]);
const ResumeRequestsCtx = createContext<ResumeChangeRequest[]>([]);
const RtrRequestsCtx = createContext<RTRRequest[]>([]);
const PrepRequestsCtx = createContext<ResumePrepRequest[]>([]);
const FeatureAnnouncementsCtx = createContext<FeatureAnnouncement[]>([]);
const InterviewRequestsCtx = createContext<InterviewSupportRequest[]>([]);
const InterviewRoundsCtx = createContext<InterviewRound[]>([]);
const InterviewFeedbacksCtx = createContext<InterviewFeedback[]>([]);
const ProxyAvailabilitiesCtx = createContext<ProxyAvailability[]>([]);
const CalendarEventsCtx = createContext<any[]>([]);
const DataReadyCtx = createContext<boolean>(false);

// Combined type for backward compatibility with useData()
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

  const loadedRef = useRef(0);
  const [isDataReady, setIsDataReady] = useState(false);
  const TOTAL = 15;
  const markLoaded = useCallback(() => {
    loadedRef.current += 1;
    if (loadedRef.current >= TOTAL) setIsDataReady(true);
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const isBookingPage = window.location.hash.startsWith('#book-interview');
    if (!user && !isBookingPage) return;

    loadedRef.current = 0;
    setIsDataReady(false);
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
  }, [isAuthReady, user?.id, markLoaded]);

  return (
    <DataReadyCtx.Provider value={isDataReady}>
    <CandidatesCtx.Provider value={candidates}>
    <UsersCtx.Provider value={users}>
    <ApplicationsCtx.Provider value={applications}>
    <FollowUpsCtx.Provider value={followUps}>
    <PaymentsCtx.Provider value={payments}>
    <TargetReductionsCtx.Provider value={targetReductions}>
    <ResumeRequestsCtx.Provider value={resumeRequests}>
    <RtrRequestsCtx.Provider value={rtrRequests}>
    <PrepRequestsCtx.Provider value={prepRequests}>
    <FeatureAnnouncementsCtx.Provider value={featureAnnouncements}>
    <InterviewRequestsCtx.Provider value={interviewRequests}>
    <InterviewRoundsCtx.Provider value={interviewRounds}>
    <InterviewFeedbacksCtx.Provider value={interviewFeedbacks}>
    <ProxyAvailabilitiesCtx.Provider value={proxyAvailabilities}>
    <CalendarEventsCtx.Provider value={calendarEvents}>
      {children}
    </CalendarEventsCtx.Provider>
    </ProxyAvailabilitiesCtx.Provider>
    </InterviewFeedbacksCtx.Provider>
    </InterviewRoundsCtx.Provider>
    </InterviewRequestsCtx.Provider>
    </FeatureAnnouncementsCtx.Provider>
    </PrepRequestsCtx.Provider>
    </RtrRequestsCtx.Provider>
    </ResumeRequestsCtx.Provider>
    </TargetReductionsCtx.Provider>
    </PaymentsCtx.Provider>
    </FollowUpsCtx.Provider>
    </ApplicationsCtx.Provider>
    </UsersCtx.Provider>
    </CandidatesCtx.Provider>
    </DataReadyCtx.Provider>
  );
};

// ---------------------------------------------------------------------------
// useData() — backward compatible hook (returns all collections)
// ---------------------------------------------------------------------------
export const useData = (): DataContextType => ({
  candidates: useContext(CandidatesCtx),
  users: useContext(UsersCtx),
  applications: useContext(ApplicationsCtx),
  followUps: useContext(FollowUpsCtx),
  payments: useContext(PaymentsCtx),
  targetReductions: useContext(TargetReductionsCtx),
  resumeRequests: useContext(ResumeRequestsCtx),
  rtrRequests: useContext(RtrRequestsCtx),
  prepRequests: useContext(PrepRequestsCtx),
  featureAnnouncements: useContext(FeatureAnnouncementsCtx),
  interviewRequests: useContext(InterviewRequestsCtx),
  interviewRounds: useContext(InterviewRoundsCtx),
  interviewFeedbacks: useContext(InterviewFeedbacksCtx),
  proxyAvailabilities: useContext(ProxyAvailabilitiesCtx),
  calendarEvents: useContext(CalendarEventsCtx),
  isDataReady: useContext(DataReadyCtx),
});
