import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Candidate, Payment, Application, InterviewRequest, ActivityLog } from '../types';
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
  ArrowUpRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
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
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user?.candidate_id) return;
    const id = user.candidate_id;
    setIsLoading(true);
    try {
      const [candData, paymentsData, appsData, interviewsData] = await Promise.all([
        apiService.getCandidate(id),
        apiService.getPayments({ candidate_id: id }),
        apiService.getApplications({ candidate_id: id }),
        apiService.getInterviews({ candidate_id: id })
      ]);

      if (candData) {
        setCandidate(candData);
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        setApplications(Array.isArray(appsData) ? appsData : []);
        setInterviews(Array.isArray(interviewsData) ? interviewsData : []);
        // Activity logs might need a specific fetch if needed
        setActivityLogs([]); 
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthReady || !user?.candidate_id) return;
    fetchDashboardData();
  }, [isAuthReady, user, fetchDashboardData]);

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

  const currentStageInfo = STAGES[candidate.current_stage];
  const stageIndex = Object.keys(STAGES).indexOf(candidate.current_stage);
  const totalStages = Object.keys(STAGES).length - 2; // Exclude completed and not_interested
  const progress = Math.min(100, Math.max(0, (stageIndex / totalStages) * 100));

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Welcome, {candidate.full_name}!</h1>
          <p className="text-text-secondary mt-1">Here's an overview of your journey with Placify.</p>
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
          <p className="text-xs text-text-secondary">{interviews.filter(i => i.status === 'scheduled').length} scheduled upcoming</p>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-green/10 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-accent-green" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Paid</p>
              <p className="text-2xl font-bold text-text-primary">₹{payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">Out of ₹{candidate.package_amount.toLocaleString()}</p>
        </div>

        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent-amber/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-accent-amber" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Pending</p>
              <p className="text-2xl font-bold text-text-primary">₹{payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}</p>
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

      {/* Recent Activity & Interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Activity */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <History className="w-5 h-5 text-accent-blue" />
            Recent Updates
          </h3>
          <div className="space-y-4">
            {activityLogs.slice(0, 5).map((log) => (
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

        {/* Upcoming Interviews */}
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-purple" />
            Interview Schedule
          </h3>
          <div className="space-y-4">
            {interviews.filter(i => i.status !== 'completed' && i.status !== 'rejected').slice(0, 5).map((interview) => (
              <div key={interview.id} className="flex items-center justify-between p-4 bg-bg-tertiary/50 rounded-2xl border border-border-primary/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5 text-accent-purple" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-primary">
                      {interview.status === 'scheduled' ? 'Confirmed Interview' : 'Pending Schedule'}
                    </p>
                    <p className="text-xs text-text-secondary mt-1">
                      {interview.scheduled_at ? new Date(interview.scheduled_at).toLocaleString() : 'Date TBD'}
                    </p>
                  </div>
                </div>
                {interview.calendly_link && (
                  <a 
                    href={interview.calendly_link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-2 bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition-colors"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </a>
                )}
              </div>
            ))}
            {interviews.length === 0 && (
              <p className="text-center py-10 text-text-muted">No interviews scheduled yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
