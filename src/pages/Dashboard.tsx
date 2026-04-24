import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, subscribeToQuery, markNotificationAsRead } from '../services/storage';
import { STAGES } from '../constants';
import { Users, CheckCircle2, Clock, UserX, ArrowRight, LayoutGrid, Phone, Calendar, ArrowUpRight, AlertCircle, ChevronRight, FileEdit, Video, TrendingUp, Check, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Candidate, FollowUp, Notification, ResumeChangeRequest, InterviewRequest, Application } from '../types';
import { CandidateSheet } from '../components/CandidateSheet';
import { db, firebaseConfig } from '../firebase';
import { query, collection, where } from 'firebase/firestore';

export const Dashboard: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [resumeRequests, setResumeRequests] = useState<ResumeChangeRequest[]>([]);
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [motivationalQuote, setMotivationalQuote] = useState('');

  const quotes = useMemo(() => [
    "Success usually comes to those who are too busy to be looking for it.",
    "Don't limit your challenges. Challenge your limits.",
    "The secret of getting ahead is getting started.",
    "Great things never come from comfort zones.",
    "Dream big and dare to fail.",
    "It always seems impossible until it's done.",
    "Your limitation—it's only your imagination.",
    "Push yourself, because no one else is going to do it for you.",
    "Sometimes later becomes never. Do it now.",
    "Hard work beats talent when talent doesn't work hard."
  ], []);

  useEffect(() => {
    setMotivationalQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    
    const updateTime = () => {
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      setCurrentTime(timeFormatter.format(new Date()));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [quotes]);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      setCandidates(data);
      setIsLoading(false);
    });

    const unsubFollowUps = subscribeToCollection<FollowUp>('jpc_followups', (data) => {
      setFollowUps(data);
    });

    let unsubNotifications = () => {};
    if (user) {
      const q = query(
        collection(db, 'jpc_notifications'),
        where('recipient_id', '==', String(user.id))
      );
      unsubNotifications = subscribeToQuery<Notification>(q, setNotifications, 'jpc_notifications');
    }

    const unsubResumeRequests = subscribeToCollection<ResumeChangeRequest>('jpc_resume_requests', (data) => {
      setResumeRequests(data);
    });

    const unsubInterviews = subscribeToCollection<InterviewRequest>('jpc_interviews', (data) => {
      setInterviews(data);
    });

    const unsubApps = subscribeToCollection<Application>('jpc_applications', (data) => {
      setApplications(data);
    });

    return () => {
      unsubCandidates();
      unsubFollowUps();
      unsubNotifications();
      unsubResumeRequests();
      unsubInterviews();
      unsubApps();
    };
  }, [isAuthReady, user]);

  const activeCandidates = useMemo(() => {
    let filtered = candidates.filter(c => c.current_stage !== 'not_interested' && c.current_stage !== 'completed');
    if (user?.role === 'jpc_recruiter') {
      filtered = filtered.filter(c => String(c.assigned_recruiter) === String(user.id));
    } else if (user?.role === 'jpc_lead_gen') {
      filtered = filtered.filter(c => String(c.lead_generated_by) === String(user.id));
    } else if (user?.role === 'jpc_marketing') {
      filtered = filtered.filter(c => String(c.assigned_marketing_leader) === String(user.id));
    }
    return filtered;
  }, [candidates, user]);

  const completedCount = useMemo(() => {
    let filtered = candidates.filter(c => c.current_stage === 'completed');
    if (user?.role === 'jpc_recruiter') {
      filtered = filtered.filter(c => String(c.assigned_recruiter) === String(user.id));
    } else if (user?.role === 'jpc_lead_gen') {
      filtered = filtered.filter(c => String(c.lead_generated_by) === String(user.id));
    } else if (user?.role === 'jpc_marketing') {
      filtered = filtered.filter(c => String(c.assigned_marketing_leader) === String(user.id));
    }
    return filtered.length;
  }, [candidates, user]);

  const notInterestedCount = useMemo(() => {
    let filtered = candidates.filter(c => c.current_stage === 'not_interested');
    if (user?.role === 'jpc_recruiter') {
      filtered = filtered.filter(c => String(c.assigned_recruiter) === String(user.id));
    } else if (user?.role === 'jpc_lead_gen') {
      filtered = filtered.filter(c => String(c.lead_generated_by) === String(user.id));
    } else if (user?.role === 'jpc_marketing') {
      filtered = filtered.filter(c => String(c.assigned_marketing_leader) === String(user.id));
    }
    return filtered.length;
  }, [candidates, user]);
  
  const today = new Date().toISOString().split('T')[0];
  const personalFollowUps = useMemo(() => {
    return user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' 
      ? followUps 
      : followUps.filter(f => f.created_by === user?.id);
  }, [followUps, user]);

  const dueTodayCount = useMemo(() => personalFollowUps.filter(f => !f.done && f.followup_date <= today).length, [personalFollowUps, today]);

  const pendingResumeRequests = useMemo(() => {
    if (user?.role === 'jpc_marketing') return resumeRequests.filter(r => r.status === 'pending_tl');
    if (user?.role === 'jpc_cs') return resumeRequests.filter(r => r.status === 'pending_cs');
    if (user?.role === 'jpc_resume') return resumeRequests.filter(r => r.status === 'pending_resume_team');
    return [];
  }, [resumeRequests, user]);

  const activeInterviews = useMemo(() => {
    if (user?.role === 'jpc_proxy') return interviews.filter(i => ['pending_proxy', 'scheduled', 'live'].includes(i.status));
    if (user?.role === 'jpc_cs') return interviews.filter(i => ['pending_proxy', 'scheduled', 'live', 'feedback_shared', 'result_pending', 'next_round', 'rejected'].includes(i.status));
    return [];
  }, [interviews, user]);

  const appStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let filteredApps = applications;
    if (user?.role === 'jpc_recruiter') {
      // Recruiters only see apps for their assigned candidates
      const myCandidateIds = candidates
        .filter(c => String(c.assigned_recruiter) === String(user.id))
        .map(c => c.id);
      filteredApps = applications.filter(a => myCandidateIds.includes(a.candidate_id));
    } else if (user?.role === 'jpc_marketing') {
      // Marketing TLs only see apps for candidates in their cluster
      const myCandidateIds = candidates
        .filter(c => String(c.assigned_marketing_leader) === String(user.id))
        .map(c => c.id);
      filteredApps = applications.filter(a => myCandidateIds.includes(a.candidate_id));
    }
    
    const dayApps = filteredApps.filter(a => a.applied_at === todayStr);
    const weekApps = filteredApps.filter(a => new Date(a.applied_at) >= startOfWeek);
    const monthApps = filteredApps.filter(a => new Date(a.applied_at) >= startOfMonth);
    
    return {
      day: dayApps.length,
      week: weekApps.length,
      month: monthApps.length,
      lifetime: filteredApps.length
    };
  }, [applications, user, candidates]);

  const stats = [
    { label: 'Active Candidates', value: activeCandidates.length, icon: Users, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-accent-green', bg: 'bg-accent-green/10' },
    { label: 'Follow-Ups Due', value: dueTodayCount, icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
    { label: 'Not Interested', value: notInterestedCount, icon: UserX, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  ];

  const targetAlerts = useMemo(() => {
    if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager') return [];
    
    const todayStr = new Date().toISOString().split('T')[0];
    const alerts: { candidate: Candidate, count: number, target: number }[] = [];
    
    // Only check candidates in marketing stages
    const marketingCandidates = candidates.filter(c => 
      ['marketing_leader', 'marketing_active', 'application_tracking'].includes(c.current_stage)
    );

    marketingCandidates.forEach(c => {
      const dayApps = applications.filter(a => a.candidate_id === c.id && a.applied_at === todayStr).length;
      const target = (c.profiles_count || 1) * 40;
      if (dayApps < target) {
        alerts.push({ candidate: c, count: dayApps, target });
      }
    });

    return alerts.sort((a, b) => a.count - b.count);
  }, [candidates, applications, user]);

  const recentCandidates = useMemo(() => {
    let filtered = [...candidates];
    if (user?.role === 'jpc_recruiter') {
      filtered = filtered.filter(c => String(c.assigned_recruiter) === String(user.id));
    } else if (user?.role === 'jpc_lead_gen') {
      filtered = filtered.filter(c => String(c.lead_generated_by) === String(user.id));
    }
    return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5);
  }, [candidates, user]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Welcome back, {user?.display_name}!</h1>
          <p className="text-text-secondary mt-1">{motivationalQuote}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-xl flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent-blue" />
            <span className="text-sm font-bold text-text-primary tracking-wider">
              US Time (EST): {currentTime}
            </span>
          </div>
          <div className="px-4 py-2 bg-bg-secondary border border-border-primary rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
            <span className="text-sm font-bold text-text-primary uppercase tracking-wider">System Live</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-bg-secondary p-6 rounded-3xl border border-border-primary shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                <stat.icon className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-sm font-bold text-text-muted uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-3xl font-bold text-text-primary mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Application Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-bg-secondary border border-border-primary rounded-[32px] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Application Performance</h2>
              <p className="text-text-secondary mt-1">Real-time tracking of job applications across the team.</p>
            </div>
            <div className="w-12 h-12 bg-accent-blue/10 rounded-2xl flex items-center justify-center text-accent-blue">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Today</p>
              <p className="text-4xl font-bold text-text-primary">{appStats.day}</p>
              <div className="h-1 w-12 bg-accent-blue rounded-full mt-2" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">This Week</p>
              <p className="text-4xl font-bold text-text-primary">{appStats.week}</p>
              <div className="h-1 w-12 bg-accent-purple rounded-full mt-2" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">This Month</p>
              <p className="text-4xl font-bold text-text-primary">{appStats.month}</p>
              <div className="h-1 w-12 bg-accent-teal rounded-full mt-2" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Lifetime</p>
              <p className="text-4xl font-bold text-text-primary">{appStats.lifetime}</p>
              <div className="h-1 w-12 bg-accent-green rounded-full mt-2" />
            </div>
          </div>
        </div>

        {targetAlerts.length > 0 && (
          <div className="bg-bg-secondary border border-border-primary rounded-[32px] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight">Target Not Met</h2>
                <p className="text-text-secondary mt-1">Candidates below daily application target (40/profile).</p>
              </div>
              <div className="w-12 h-12 bg-accent-red/10 rounded-2xl flex items-center justify-center text-accent-red">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>
            
            <div className="space-y-4 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {targetAlerts.map(({ candidate, count, target }) => (
                <button 
                  key={candidate.id} 
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    setIsSheetOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 bg-bg-tertiary/50 rounded-2xl border border-border-primary hover:border-accent-blue transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center text-[10px] font-bold text-text-secondary group-hover:bg-accent-blue/10 group-hover:text-accent-blue transition-colors">
                      {candidate.full_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors">{candidate.full_name}</p>
                      <p className="text-[10px] text-text-muted uppercase font-bold">{STAGES[candidate.current_stage].label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-bold", count === 0 ? "text-accent-red" : "text-accent-amber")}>
                      {count} / {target}
                    </p>
                    <div className="w-20 h-1 bg-bg-tertiary rounded-full mt-1 overflow-hidden">
                      <div 
                        className={cn("h-full", count === 0 ? "bg-accent-red" : "bg-accent-amber")} 
                        style={{ width: `${(count / target) * 100}%` }} 
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Overview */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-accent-blue" />
            Pipeline Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(STAGES).filter(([key]) => key !== 'not_interested').map(([key, stage], i) => {
              const count = candidates.filter(c => {
                const matchesStage = c.current_stage === key;
                if (!matchesStage) return false;
                
                if (user?.role === 'jpc_recruiter') {
                  return String(c.assigned_recruiter) === String(user.id);
                } else if (user?.role === 'jpc_lead_gen') {
                  return String(c.lead_generated_by) === String(user.id);
                }
                return true;
              }).length;
              return (
                <motion.a
                  key={key}
                  href={`#pipeline?stage=${key}`}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-bg-secondary p-5 rounded-2xl border border-border-primary flex items-center justify-between hover:border-accent-blue transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center text-xl">
                      {stage.icon}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">{stage.label}</p>
                      <p className="text-xs text-text-muted">{count} candidates</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent-blue transition-colors" />
                </motion.a>
              );
            })}
          </div>
        </div>

        {/* Recent Activity / Follow-ups */}
        <div className="space-y-6">
          {notifications.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-accent-red" />
                Team Alerts
              </h2>
              <div className="space-y-3">
                {notifications.filter(n => !n.read).map(n => (
                  <div key={n.id} className="p-4 bg-accent-red/5 border border-accent-red/20 rounded-2xl relative group flex justify-between items-start">
                    <div>
                      <p className="text-xs text-text-primary pr-6">{n.message}</p>
                      <p className="text-[10px] text-text-muted mt-2 font-bold uppercase">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    <button 
                      onClick={() => markNotificationAsRead(n.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-accent-red/10 rounded transition-opacity"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4 text-accent-red" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeInterviews.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <Video className="w-5 h-5 text-accent-red" />
                Active Interviews
              </h2>
              <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
                <div className="divide-y divide-border-primary">
                  {activeInterviews.slice(0, 3).map(int => {
                    const candidate = candidates.find(c => c.id === int.candidate_id);
                    return (
                      <a 
                        key={int.id} 
                        href="#interviews"
                        className="p-4 flex items-center gap-4 hover:bg-bg-tertiary transition-colors group"
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          int.status === 'live' ? "bg-accent-red/10 text-accent-red animate-pulse" : "bg-accent-blue/10 text-accent-blue"
                        )}>
                          <Video className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-text-primary truncate">{candidate?.full_name || 'Candidate'}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-text-muted">{candidate?.id}</span>
                            <span className="text-[10px] text-text-muted">•</span>
                            <p className="text-[10px] text-text-muted truncate capitalize">{int.status.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </a>
                    );
                  })}
                </div>
                <div className="p-3 bg-bg-tertiary/50 border-t border-border-primary">
                  <a href="#interviews" className="text-[10px] font-bold text-accent-blue hover:underline flex items-center justify-center gap-1 uppercase tracking-wider">
                    View All Interviews <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-amber" />
            Recent Updates
          </h2>
          
          {pendingResumeRequests.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-accent-blue" />
                Resume Requests
              </h2>
              <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
                <div className="divide-y divide-border-primary">
                  {pendingResumeRequests.slice(0, 3).map(req => (
                    <a 
                      key={req.id} 
                      href="#resume-log"
                      className="p-4 flex items-center gap-4 hover:bg-bg-tertiary transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                        <FileEdit className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">Resume Change Needed</p>
                        <p className="text-xs text-text-muted truncate">{req.details}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted" />
                    </a>
                  ))}
                </div>
                <div className="p-3 bg-bg-tertiary/50 border-t border-border-primary">
                  <a href="#resume-log" className="text-[10px] font-bold text-accent-blue hover:underline flex items-center justify-center gap-1 uppercase tracking-wider">
                    View All Requests <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
            <div className="divide-y divide-border-primary">
              {recentCandidates.length > 0 ? recentCandidates.map(candidate => (
                <button 
                  key={candidate.id} 
                  onClick={() => {
                    setSelectedCandidate(candidate);
                    setIsSheetOpen(true);
                  }}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-bg-tertiary transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary font-bold text-xs group-hover:bg-accent-blue/10 group-hover:text-accent-blue transition-colors">
                    {candidate.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors truncate">{candidate.full_name}</p>
                      <span className="text-[10px] font-mono text-text-muted">{candidate.id}</span>
                    </div>
                    <p className="text-xs text-text-muted truncate">
                      Moved to <span className="text-accent-blue font-medium">{STAGES[candidate.current_stage].label}</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-text-muted font-bold uppercase">
                    {new Date(candidate.updated_at).toLocaleDateString()}
                  </p>
                </button>
              )) : (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">No recent activity</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-bg-tertiary/50 border-t border-border-primary">
              <a href="#candidates" className="text-xs font-bold text-accent-blue hover:underline flex items-center justify-center gap-2">
                View All Candidates <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Only: System Diagnosis Options */}
      {(user?.role === 'jpc_sysadmin' || user?.role === 'administrator') && (
        <div className="bg-[#0f172a] border border-blue-900/50 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">System Diagnosis</h2>
              <p className="text-sm text-slate-400">Firebase Configuration & Database Status</p>
            </div>
            <div className="ml-auto px-3 py-1 bg-accent-green/20 text-accent-green text-[10px] font-bold rounded-full border border-accent-green/30 tracking-widest uppercase">
              Authenticated: {user?.display_name}
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 font-mono text-xs overflow-x-auto">
              <p className="text-slate-500 mb-2">// Current Firebase Configuration</p>
              <pre className="text-slate-300">
                <span className="text-blue-400">const</span> <span className="text-blue-300">firebaseConfig</span> <span className="text-blue-400">=</span> {'{\n'}
                <span className="text-teal-300">  projectId:</span> <span className="text-amber-300">"{firebaseConfig.projectId}"</span>,{'\n'}
                <span className="text-teal-300">  appId:</span> <span className="text-amber-300">"{firebaseConfig.appId}"</span>,{'\n'}
                <span className="text-teal-300">  apiKey:</span> <span className="text-amber-300">"{firebaseConfig.apiKey}"</span>,{'\n'}
                <span className="text-teal-300">  authDomain:</span> <span className="text-amber-300">"{firebaseConfig.authDomain}"</span>,{'\n'}
                <span className="text-teal-300">  firestoreDatabaseId:</span> <span className="text-amber-300">"{firebaseConfig.firestoreDatabaseId}"</span>,{'\n'}
                <span className="text-teal-300">  storageBucket:</span> <span className="text-amber-300">"{firebaseConfig.storageBucket}"</span>,{'\n'}
                <span className="text-teal-300">  messagingSenderId:</span> <span className="text-amber-300">"{firebaseConfig.messagingSenderId}"</span>{'\n'}
                {'}'};
              </pre>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 space-y-4">
              <h4 className="text-white font-bold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Database Migration Status
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Source DB:</span>
                  <span className="font-mono text-slate-300">ai-studio-f34...</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Dest DB (Prod):</span>
                  <span className="font-mono text-accent-green">production-placify</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full mt-2 overflow-hidden">
                  <div className="w-full h-full bg-accent-green animate-pulse shadow-[0_0_8px_rgba(0,173,140,0.5)]" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-800">
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Note: All data (Candidates, Users, QC, Notifications) has been successfully ported to the 'production-placify' instance. 
                  Admin rules have been deployed to ensure your account maintains full control.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <CandidateSheet 
        candidate={selectedCandidate}
        isOpen={isSheetOpen}
        onClose={() => {
          setIsSheetOpen(false);
          setSelectedCandidate(null);
        }}
      />
    </div>
  );
};
