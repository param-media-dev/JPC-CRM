import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection } from '../services/storage';
import { STAGES } from '../constants';
import { Users, CheckCircle2, Clock, UserX, ArrowRight, LayoutGrid, Phone, Calendar, ArrowUpRight, AlertCircle, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Candidate, FollowUp } from '../types';

export const Dashboard: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      setCandidates(data);
      setIsLoading(false);
    });

    const unsubFollowUps = subscribeToCollection<FollowUp>('jpc_followups', (data) => {
      setFollowUps(data);
    });

    return () => {
      unsubCandidates();
      unsubFollowUps();
    };
  }, [isAuthReady]);

  const activeCandidates = useMemo(() => candidates.filter(c => c.current_stage !== 'not_interested' && c.current_stage !== 'completed'), [candidates]);
  const completedCount = useMemo(() => candidates.filter(c => c.current_stage === 'completed').length, [candidates]);
  const notInterestedCount = useMemo(() => candidates.filter(c => c.current_stage === 'not_interested').length, [candidates]);
  
  const today = new Date().toISOString().split('T')[0];
  const personalFollowUps = useMemo(() => {
    return user?.role === 'administrator' || user?.role === 'jpc_manager' 
      ? followUps 
      : followUps.filter(f => f.created_by === user?.id);
  }, [followUps, user]);

  const dueTodayCount = useMemo(() => personalFollowUps.filter(f => !f.done && f.followup_date <= today).length, [personalFollowUps, today]);

  const stats = [
    { label: 'Active Candidates', value: activeCandidates.length, icon: Users, color: 'text-accent-blue', bg: 'bg-accent-blue/10' },
    { label: 'Completed', value: completedCount, icon: CheckCircle2, color: 'text-accent-green', bg: 'bg-accent-green/10' },
    { label: 'Follow-Ups Due', value: dueTodayCount, icon: Clock, color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
    { label: 'Not Interested', value: notInterestedCount, icon: UserX, color: 'text-accent-red', bg: 'bg-accent-red/10' },
  ];

  const recentCandidates = useMemo(() => [...candidates].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 5), [candidates]);

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
          <p className="text-text-secondary mt-1">Here's what's happening with your pipeline today.</p>
        </div>
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Pipeline Overview */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-accent-blue" />
            Pipeline Overview
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(STAGES).filter(([key]) => key !== 'not_interested').map(([key, stage], i) => {
              const count = candidates.filter(c => c.current_stage === key).length;
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
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-amber" />
            Recent Updates
          </h2>
          <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
            <div className="divide-y divide-border-primary">
              {recentCandidates.length > 0 ? recentCandidates.map(candidate => (
                <a 
                  key={candidate.id} 
                  href={`#candidate?id=${candidate.id}`}
                  className="p-4 flex items-center gap-4 hover:bg-bg-tertiary transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary font-bold text-xs">
                    {candidate.full_name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{candidate.full_name}</p>
                    <p className="text-xs text-text-muted truncate">
                      Moved to <span className="text-accent-blue font-medium">{STAGES[candidate.current_stage].label}</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-text-muted font-bold uppercase">
                    {new Date(candidate.updated_at).toLocaleDateString()}
                  </p>
                </a>
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
    </div>
  );
};
