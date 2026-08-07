import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Candidate, Payment, Application, InterviewSupportRequest, ActivityLog, InterviewRound } from '../types';
import { STAGES } from '../constants';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  FileText, 
  Video, 
  Activity,
  History,
  Calendar,
  ArrowUpRight,
  Download,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { handleViewFile } from '../services/fileService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';

export const CandidateDashboard: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<InterviewSupportRequest[]>([]);
  const [interviewRounds, setInterviewRounds] = useState<InterviewRound[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !user?.candidate_id) return;

    const id = user.candidate_id;

    const unsubCandidate = onSnapshot(doc(db, 'jpc_candidates', id), (doc) => {
      if (doc.exists()) {
        setCandidate(doc.data() as Candidate);
        setIsLoading(false);
      }
    });

    const unsubPayments = onSnapshot(query(collection(db, 'jpc_payments'), where('candidate_id', '==', id)), (snap) => {
      setPayments(snap.docs.map(d => d.data() as Payment));
    });

    const unsubApps = onSnapshot(query(collection(db, 'jpc_applications'), where('candidate_id', '==', id), orderBy('applied_at', 'desc'), limit(50)), (snap) => {
      setApplications(snap.docs.map(d => d.data() as Application));
    });

    const unsubInterviews = onSnapshot(query(collection(db, 'jpc_interview_requests'), where('candidate_id', '==', id)), (snap) => {
      const requests = snap.docs.map(d => d.data() as InterviewSupportRequest);
      setInterviews(requests);

      // Fetch rounds for these requests
      if (requests.length > 0) {
        const requestIds = requests.map(r => r.id);
        // Firebase 'in' query limit is 30, we likely have fewer requests
        const roundsQuery = query(collection(db, 'jpc_interview_rounds'), where('request_id', 'in', requestIds.slice(0, 30)));
        onSnapshot(roundsQuery, (roundsSnap) => {
          setInterviewRounds(roundsSnap.docs.map(d => d.data() as InterviewRound));
        });
      }
    });

    const unsubActivity = onSnapshot(query(collection(db, 'jpc_activity_logs'), where('candidate_id', '==', id)), (snap) => {
      setActivityLogs(snap.docs.map(d => d.data() as ActivityLog).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    return () => {
      unsubCandidate();
      unsubPayments();
      unsubApps();
      unsubInterviews();
      unsubActivity();
    };
  }, [isAuthReady, user]);

  const paymentData = useMemo(() => {
    const total = candidate?.package_amount || 0;
    const paid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const pending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
    return [
      { name: 'Paid', value: paid, color: '#10B981' },
      { name: 'Pending', value: pending, color: '#F59E0B' },
      { name: 'Remaining', value: Math.max(0, total - paid - pending), color: '#6B7280' }
    ];
  }, [candidate, payments]);

  const activityData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => ({
      date: date.split('-').slice(1).join('/'),
      count: activityLogs.filter(log => log.created_at.startsWith(date)).length
    }));
  }, [activityLogs]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!candidate) return null;

  const overduePayments = payments.filter(p => p.status === 'pending' && p.due_date && new Date(p.due_date) < new Date());

  const currentStageInfo = STAGES[candidate.current_stage];
  const stageIndex = Object.keys(STAGES).indexOf(candidate.current_stage);
  const totalStages = Object.keys(STAGES).length - 2; // Exclude completed and not_interested
  const progress = Math.min(100, Math.max(0, (stageIndex / totalStages) * 100));

  const handleDownloadResume = () => {
    const resumeUrl = candidate.resume_url || candidate.resume_base64;
    if (resumeUrl) {
      handleViewFile(resumeUrl, candidate.resume_filename || 'resume.pdf');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Overdue Payment Alert */}
      <AnimatePresence>
        {overduePayments.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-6 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-red-500">Action Required: Payment Overdue</h3>
                <p className="text-sm text-red-500/80">You have {overduePayments.length} pending payment(s) that are past their due date. Please settle your dues to avoid any interruption in services.</p>
              </div>
              <button className="px-6 py-2 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">
                Pay Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Welcome, {candidate.full_name}!</h1>
          <p className="text-text-secondary mt-1">Here's an overview of your journey with Auriic.</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-2 bg-bg-secondary border border-border-primary rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-accent-blue" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Current Status</p>
            <p className="text-sm font-bold text-text-primary">{currentStageInfo.label}</p>
          </div>
        </div>
      </div>

      {/* Pipeline Progress */}
      <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent-blue" />
            Your Pipeline Journey
          </h2>
          <span className="text-sm font-bold text-accent-blue">{Math.round(progress)}% Complete</span>
        </div>
        
        <div className="relative h-4 bg-bg-tertiary rounded-full overflow-hidden mb-8">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent-blue to-accent-teal shadow-[0_0_20px_rgba(59,130,246,0.5)]"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {Object.entries(STAGES).slice(0, 10).map(([key, info], index) => {
            const isCompleted = index < stageIndex;
            const isCurrent = index === stageIndex;
            return (
              <div key={key} className={cn(
                "p-3 rounded-2xl border transition-all",
                isCurrent ? "bg-accent-blue/5 border-accent-blue shadow-sm" : 
                isCompleted ? "bg-accent-green/5 border-accent-green/20" : "bg-bg-tertiary/50 border-border-primary opacity-50"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                  isCurrent ? "bg-accent-blue text-white" : 
                  isCompleted ? "bg-accent-green text-white" : "bg-bg-tertiary text-text-muted"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>
                <p className={cn(
                  "text-[10px] font-bold leading-tight",
                  isCurrent ? "text-accent-blue" : isCompleted ? "text-accent-green" : "text-text-muted"
                )}>
                  {info.label.split('. ')[1] || info.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 flex items-center justify-center">
              <FileText className="w-6 h-6 text-accent-blue" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Applications</p>
              <p className="text-2xl font-bold text-text-primary">{applications.length}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">Total jobs applied for you</p>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-purple/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-accent-purple" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Interviews</p>
              <p className="text-2xl font-bold text-text-primary">{interviews.length}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">{interviews.filter(i => i.overall_status === 'confirmed').length} scheduled upcoming</p>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-green/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-accent-green" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Paid</p>
              <p className="text-2xl font-bold text-text-primary">${payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">Out of ${candidate.package_amount.toLocaleString()}</p>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-amber/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-accent-amber" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Pending</p>
              <p className="text-2xl font-bold text-text-primary">${payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">Next payment due soon</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Overview Chart */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-accent-green" />
            Financial Overview
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {paymentData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs font-medium text-text-secondary">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Chart */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-blue" />
            Activity Trend (Last 7 Days)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#9CA3AF" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#3B82F6" 
                  strokeWidth={3} 
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Documents & Resume Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-blue" />
              Documents & Resume
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 bg-bg-tertiary/50 rounded-2xl border border-border-primary/50 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent-blue" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Professional Resume</p>
                  <p className="text-xs text-text-secondary mt-0.5 truncate max-w-[150px]">
                    {candidate.resume_filename || 'No resume uploaded'}
                  </p>
                </div>
              </div>
              <button 
                onClick={handleDownloadResume}
                disabled={!candidate.resume_url && !candidate.resume_base64}
                className="p-2 rounded-lg bg-bg-secondary border border-border-primary text-text-primary hover:bg-accent-blue hover:text-white hover:border-accent-blue transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download Resume"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-bg-tertiary/50 rounded-2xl border border-border-primary/50 flex items-center justify-between group opacity-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent-purple/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-accent-purple" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Signed Agreement</p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {candidate.agreement_filename || 'Not available'}
                  </p>
                </div>
              </div>
              <button 
                className="p-2 rounded-lg bg-bg-secondary border border-border-primary text-text-primary transition-all cursor-not-allowed"
                title="View Agreement"
                disabled
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="mt-6 p-4 bg-accent-blue/5 border border-accent-blue/10 rounded-xl">
            <p className="text-xs text-accent-blue flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Need to update your resume? Please contact your assigned recruiter or CS manager.
            </p>
          </div>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm flex flex-col">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-teal" />
            Quick Actions
          </h3>
          <div className="space-y-3 flex-1">
            <button className="w-full p-4 text-left bg-bg-tertiary hover:bg-accent-blue/5 rounded-2xl border border-border-primary hover:border-accent-blue/30 transition-all flex items-center justify-between group">
              <span className="text-sm font-bold text-text-primary group-hover:text-accent-blue">Request Mock Interview</span>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-blue" />
            </button>
            <button className="w-full p-4 text-left bg-bg-tertiary hover:bg-accent-purple/5 rounded-2xl border border-border-primary hover:border-accent-purple/30 transition-all flex items-center justify-between group">
              <span className="text-sm font-bold text-text-primary group-hover:text-accent-purple">Resume Briefing</span>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-purple" />
            </button>
            <button className="w-full p-4 text-left bg-bg-tertiary hover:bg-accent-amber/5 rounded-2xl border border-border-primary hover:border-accent-amber/30 transition-all flex items-center justify-between group">
              <span className="text-sm font-bold text-text-primary group-hover:text-accent-amber">Raise Support Ticket</span>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent-amber" />
            </button>
          </div>
        </div>
      </div>

      {/* Application Details Section */}
      <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <FileText className="w-6 h-6 text-accent-blue" />
            Application Details
          </h3>
          <div className="flex items-center gap-2 px-4 py-2 bg-accent-blue/10 rounded-xl">
            <span className="text-xs font-bold text-accent-blue">{applications.length} Total Applications</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-primary">
                <th className="pb-4 text-[10px] font-bold text-text-muted uppercase tracking-widest px-4">Company & Position</th>
                <th className="pb-4 text-[10px] font-bold text-text-muted uppercase tracking-widest px-4">Status</th>
                <th className="pb-4 text-[10px] font-bold text-text-muted uppercase tracking-widest px-4">Applied Date</th>
                <th className="pb-4 text-[10px] font-bold text-text-muted uppercase tracking-widest px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary/50">
              {applications.slice(0, 10).map((app) => (
                <tr key={app.id} className="group hover:bg-bg-tertiary/30 transition-colors">
                  <td className="py-5 px-4">
                    <div>
                      <p className="text-sm font-bold text-text-primary">{app.company_name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{app.job_title || 'Software Engineer'}</p>
                    </div>
                  </td>
                  <td className="py-5 px-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      app.status === 'Shortlisted' ? "bg-accent-green/10 text-accent-green border border-accent-green/20" :
                      app.status === 'Rejected' ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                      "bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
                    )}>
                      {app.status || 'Applied'}
                    </span>
                  </td>
                  <td className="py-5 px-4 text-sm text-text-secondary">
                    {new Date(app.applied_at).toLocaleDateString()}
                  </td>
                  <td className="py-5 px-4 text-right">
                    <a 
                      href={app.job_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-blue hover:underline"
                    >
                      View Job <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-text-muted">
                    No applications found in your profile.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Activity & Interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-accent-blue" />
            Recent Updates
          </h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {activityLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex gap-4 p-4 bg-bg-tertiary/50 rounded-2xl border border-border-primary/50">
                <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center shrink-0">
                  <Activity className="w-5 h-5 text-accent-blue" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">{log.action}</p>
                  <p className="text-xs text-text-secondary mt-1">{log.details}</p>
                  <p className="text-[10px] text-text-muted mt-2">{new Date(log.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {activityLogs.length === 0 && (
              <p className="text-center py-10 text-text-muted">No recent activity found.</p>
            )}
          </div>
        </div>

        {/* Detailed Interview Schedule */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-purple" />
            Interview Details
          </h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {interviews.map((interview) => {
              const rounds = interviewRounds.filter(r => r.request_id === interview.id);
              return (
                <div key={interview.id} className="p-6 bg-bg-tertiary/50 rounded-2xl border border-border-primary/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{interview.interview_company_name || interview.company_name}</h4>
                      <p className="text-xs text-text-secondary">{interview.job_title}</p>
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      interview.overall_status === 'confirmed' ? "bg-accent-green/10 text-accent-green border-accent-green/20" :
                      interview.overall_status === 'live' ? "bg-red-500/10 text-red-500 border-red-500/20 animate-pulse" :
                      "bg-accent-blue/10 text-accent-blue border-accent-blue/20"
                    )}>
                      {interview.overall_status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {rounds.length > 0 ? rounds.map((round, idx) => (
                      <div key={round.id} className="flex items-center justify-between p-3 bg-bg-secondary rounded-xl border border-border-primary/30">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-accent-purple" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-primary">{round.round_label}</p>
                            <p className="text-[10px] text-text-secondary">
                              {round.booked_slot_time ? new Date(round.booked_slot_time).toLocaleString() : 'Not booked yet'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-text-muted uppercase">{round.status}</span>
                      </div>
                    )) : (
                      <p className="text-center py-2 text-[10px] text-text-muted italic">No rounds defined for this request</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <a 
                      href={interview.job_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 bg-bg-secondary border border-border-primary rounded-xl text-[10px] font-bold text-text-primary hover:bg-bg-tertiary transition-colors text-center"
                    >
                      View JD
                    </a>
                    {interview.application_link && (
                      <a 
                        href={interview.application_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-bg-secondary border border-border-primary rounded-xl text-[10px] font-bold text-text-primary hover:bg-bg-tertiary transition-colors text-center"
                      >
                        App Link
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
            {interviews.length === 0 && (
              <p className="text-center py-10 text-text-muted">No interview details found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
