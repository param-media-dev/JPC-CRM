import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  Shield, 
  ArrowRightLeft, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  UserX,
  Activity,
  CheckCircle2,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { User, Candidate } from '../types';

interface MarketingProfileDashboardProps {
  team: User[];
  candidates: Candidate[];
  onReassignClick: (recruiter: User) => void;
  currentUser: User | null;
}

export const MarketingProfileDashboard: React.FC<MarketingProfileDashboardProps> = ({
  team,
  candidates,
  onReassignClick,
  currentUser,
}) => {
  const [viewMode, setViewMode] = useState<'hierarchy' | 'leaderboard'>('hierarchy');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'leave'>('all');

  // Filter team members based on roles
  const marketingLeaders = useMemo(() => team.filter(u => u.role === 'jpc_marketing'), [team]);
  const recruiters = useMemo(() => team.filter(u => u.role === 'jpc_recruiter'), [team]);

  // Load calculations
  const getWorkloadClass = (count: number) => {
    if (count <= 2) return { 
      label: 'Light Load', 
      badge: 'bg-accent-blue/10 text-accent-blue border-accent-blue/20',
      bar: 'bg-accent-blue' 
    };
    if (count <= 8) return { 
      label: 'Optimal Load', 
      badge: 'bg-accent-green/10 text-accent-green border-accent-green/20',
      bar: 'bg-accent-green' 
    };
    if (count <= 14) return { 
      label: 'Heavy Load', 
      badge: 'bg-accent-amber/10 text-accent-amber border-accent-amber/20',
      bar: 'bg-accent-amber' 
    };
    return { 
      label: 'Overloaded', 
      badge: 'bg-accent-red/10 text-accent-red border-accent-red/30 animate-pulse',
      bar: 'bg-accent-red' 
    };
  };

  // Process independent recruiters (no leader assigned or unknown leader role)
  const independentRecruiters = useMemo(() => {
    return recruiters.filter(r => 
      !r.leader_id || 
      !marketingLeaders.some(l => String(l.id) === String(r.leader_id))
    );
  }, [recruiters, marketingLeaders]);

  // General dashboard statistics
  const stats = useMemo(() => {
    const totalMarketingCandidates = candidates.filter(c => c.assigned_marketing_leader || c.assigned_recruiter);
    const activeRecruiters = recruiters.filter(r => !r.is_on_leave);
    const averageLoad = activeRecruiters.length > 0 
      ? (totalMarketingCandidates.length / activeRecruiters.length).toFixed(1) 
      : '0';

    const unassignedCount = candidates.filter(c => 
      !c.assigned_marketing_leader && 
      !c.assigned_recruiter && 
      c.current_stage !== 'completed' && 
      c.current_stage !== 'not_interested' && 
      c.current_stage !== 'not_eligible'
    ).length;

    // Workload alerts
    let overloadedCount = 0;
    let underloadedCount = 0;

    recruiters.forEach(r => {
      const pCount = candidates.filter(c => String(c.assigned_recruiter) === String(r.id)).length;
      if (pCount > 14) overloadedCount++;
      if (pCount <= 2) underloadedCount++;
    });

    return {
      totalAssigned: totalMarketingCandidates.length,
      averageLoad,
      unassignedCount,
      overloadedCount,
      underloadedCount,
      totalRecruiters: recruiters.length,
    };
  }, [candidates, recruiters]);

  // Build cluster level summary
  const clusters = useMemo(() => {
    return marketingLeaders.map(leader => {
      // Direct assignments to lead
      const directCandidates = candidates.filter(c => String(c.assigned_marketing_leader) === String(leader.id));
      
      // Recruiters under this leader
      const leaderRecruiters = recruiters.filter(r => String(r.leader_id) === String(leader.id));

      const recruiterDetails = leaderRecruiters.map(r => {
        const recruiterCandidates = candidates.filter(c => String(c.assigned_recruiter) === String(r.id));
        
        // Stage distribution
        const stages = recruiterCandidates.reduce((acc, c) => {
          acc[c.current_stage] = (acc[c.current_stage] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return {
          recruiter: r,
          count: recruiterCandidates.length,
          stages,
        };
      });

      const recruitersTotalCandidates = recruiterDetails.reduce((sum, rd) => sum + rd.count, 0);
      const totalClusterCandidates = directCandidates.length + recruitersTotalCandidates;

      return {
        leader,
        directCount: directCandidates.length,
        recruitersDetails: recruiterDetails.sort((a,b) => b.count - a.count),
        totalCount: totalClusterCandidates,
      };
    }).sort((a,b) => b.totalCount - a.totalCount);
  }, [marketingLeaders, recruiters, candidates]);

  // Global recruit workload list
  const globalLeaderboard = useMemo(() => {
    return recruiters.map(r => {
      const assigned = candidates.filter(c => String(c.assigned_recruiter) === String(r.id));
      const leaderName = marketingLeaders.find(l => String(l.id) === String(r.leader_id))?.display_name || 'Independent';

      // Stage breakdown
      const stages = assigned.reduce((acc, c) => {
        acc[c.current_stage] = (acc[c.current_stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        recruiter: r,
        leaderName,
        count: assigned.length,
        stages,
      };
    })
    .filter(item => {
      const matchesSearch = item.recruiter.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.recruiter.username.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' ||
                            (statusFilter === 'active' && !item.recruiter.is_on_leave) ||
                            (statusFilter === 'leave' && item.recruiter.is_on_leave);
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => b.count - a.count);
  }, [recruiters, candidates, marketingLeaders, searchTerm, statusFilter]);

  return (
    <div className="space-y-8" id="marketing_profile_distribution_dashboard">
      {/* Overview Stat Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary flex items-center gap-4 shadow-sm" id="widget-total-profiles">
          <div className="w-12 h-12 rounded-2xl bg-accent-blue/10 flex items-center justify-center text-accent-blue">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Assigned Marketing Profiles</p>
            <h3 className="text-2xl font-black text-text-primary mt-1">{stats.totalAssigned}</h3>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary flex items-center gap-4 shadow-sm" id="widget-average-load">
          <div className="w-12 h-12 rounded-2xl bg-accent-teal/10 flex items-center justify-center text-accent-teal">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Avg Profile Load / Active</p>
            <h3 className="text-2xl font-black text-text-primary mt-1">{stats.averageLoad}</h3>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary flex items-center gap-4 shadow-sm" id="widget-unassigned-leads">
          <div className="w-12 h-12 rounded-2xl bg-accent-amber/10 flex items-center justify-center text-accent-amber">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Unassigned Active Leads</p>
            <div className="flex items-center gap-2 mt-1">
              <h3 className="text-2xl font-black text-text-primary">{stats.unassignedCount}</h3>
              {stats.unassignedCount > 0 && (
                <span className="px-2 py-0.5 bg-accent-red/10 text-accent-red text-[10px] font-bold rounded">
                  Needs Action
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary flex items-center gap-4 shadow-sm" id="widget-alert-counts">
          <div className="w-12 h-12 rounded-2xl bg-accent-red/10 flex items-center justify-center text-accent-red">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-text-muted uppercase tracking-wider">Workload Incidents</p>
            <p className="text-sm font-semibold text-text-primary mt-1">
              <span className="text-accent-red font-black">{stats.overloadedCount}</span> overloaded • <span className="text-accent-blue font-black">{stats.underloadedCount}</span> light
            </p>
          </div>
        </div>
      </div>

      {/* Main Interface Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-secondary p-4 rounded-3xl border border-border-primary">
        <div className="flex bg-bg-tertiary p-1.5 rounded-2xl border border-border-primary w-fit">
          <button
            onClick={() => setViewMode('hierarchy')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'hierarchy' 
                ? "bg-bg-secondary text-text-primary shadow-sm" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Shield className="w-4 h-4" />
            Marketing Cluster Hierarchy
          </button>
          <button
            onClick={() => setViewMode('leaderboard')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'leaderboard' 
                ? "bg-bg-secondary text-text-primary shadow-sm" 
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <Users className="w-4 h-4" />
            Recruiter Workload Leaderboard
          </button>
        </div>

        {viewMode === 'leaderboard' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search recruiter..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-bg-tertiary border border-border-primary rounded-xl pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-colors w-48"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-bg-tertiary border border-border-primary rounded-xl px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
            >
              <option value="all">Status: All</option>
              <option value="active">Active Only</option>
              <option value="leave">On Leave Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Render Workspace Content based on Selected Tab View */}
      <AnimatePresence mode="wait">
        {viewMode === 'hierarchy' ? (
          <motion.div
            key="hierarchy"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {clusters.map((cluster) => (
              <div 
                key={cluster.leader.id} 
                className="bg-bg-secondary rounded-3xl border border-border-primary p-6 shadow-sm space-y-6"
                id={`cluster-card-${cluster.leader.id}`}
              >
                {/* Cluster Leader Header and info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-primary">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-purple/10 to-accent-blue/10 flex items-center justify-center text-accent-purple font-bold">
                      {cluster.leader.display_name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="text-md font-bold text-text-primary flex items-center gap-2">
                        {cluster.leader.display_name}
                        <span className="px-2 py-0.5 bg-accent-purple/10 text-accent-purple rounded text-[10px] uppercase font-bold tracking-tight">
                          Marketing Leader (TL)
                        </span>
                      </h4>
                      <p className="text-xs text-text-muted mt-1">
                        @{cluster.leader.username} • {cluster.leader.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Cluster Size</span>
                      <span className="text-lg font-black text-text-primary">{cluster.totalCount} active profiles</span>
                    </div>
                    {cluster.directCount > 0 && (
                      <div className="px-4 py-2 bg-bg-tertiary rounded-2xl border border-border-primary text-center">
                        <span className="text-[10px] text-text-muted uppercase tracking-wider block">Assigned Direct</span>
                        <span className="text-sm font-bold text-text-secondary">{cluster.directCount}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cluster Recruiters List */}
                <div>
                  <h5 className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">
                    Assigned Recruiters ({cluster.recruitersDetails.length})
                  </h5>
                  {cluster.recruitersDetails.length === 0 ? (
                    <div className="p-8 border border-dashed border-border-primary rounded-2xl text-center text-xs text-text-muted">
                      No recruiters mapped to this marketing leader cluster yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {cluster.recruitersDetails.map(({ recruiter, count, stages }) => {
                        const loadInfo = getWorkloadClass(count);

                        return (
                          <div 
                            key={recruiter.id} 
                            className="bg-bg-tertiary border border-border-primary hover:border-border-secondary p-5 rounded-2xl transition-all shadow-sm flex flex-col justify-between h-48 relative group"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h6 className="font-bold text-text-primary text-sm truncate">{recruiter.display_name}</h6>
                                  <p className="text-[10px] text-text-muted">@{recruiter.username}</p>
                                </div>
                                <span className={cn("px-2 py-0.5 border rounded text-[9px] font-black uppercase whitespace-nowrap", loadInfo.badge)}>
                                  {count} Profiles • {loadInfo.label}
                                </span>
                              </div>

                              {/* Workload health bar */}
                              <div className="w-full bg-border-primary h-1.5 rounded-full overflow-hidden mt-3">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-500", loadInfo.bar)}
                                  style={{ width: `${Math.min((count / 20) * 100, 100)}%` }}
                                />
                              </div>

                              {/* Quick stages visualization dot chart */}
                              <div className="flex items-center gap-3 mt-4 flex-wrap">
                                {Object.entries(stages).length === 0 ? (
                                  <span className="text-[10px] text-text-muted italic">No active pipelines</span>
                                ) : (
                                  Object.entries(stages).map(([stage, num]) => (
                                    <div key={stage} className="flex items-center gap-1 bg-bg-secondary px-2 py-0.5 border border-border-primary rounded-md text-[10px] text-text-secondary font-semibold">
                                      <span className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        stage === 'interviewing' ? 'bg-accent-purple' :
                                        stage === 'marketing_active' ? 'bg-accent-green' :
                                        stage === 'sys_admin' ? 'bg-accent-amber' :
                                        stage === 'recruiter' ? 'bg-accent-blue' : 'bg-text-muted'
                                      )} />
                                      <span className="capitalize">{stage.replace('_', ' ')}:</span>
                                      <span className="text-text-primary font-bold">{num}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Options and leave details */}
                            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border-primary/50">
                              <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full", recruiter.is_on_leave ? "bg-accent-red" : "bg-accent-green")} />
                                <span className="text-[9px] font-bold text-text-muted uppercase">
                                  {recruiter.is_on_leave ? 'On Leave' : 'Active'}
                                </span>
                              </div>

                              <button
                                onClick={() => onReassignClick(recruiter)}
                                className="p-1 px-2.5 bg-bg-secondary hover:bg-accent-blue hover:text-white border border-border-primary rounded-lg text-[10px] font-bold text-text-secondary transition-all flex items-center gap-1"
                                title="Reassign / Unload Profiles"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Reassign
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Render Independent recruit section */}
            {independentRecruiters.length > 0 && (
              <div className="bg-bg-secondary rounded-3xl border border-border-primary p-6 shadow-sm space-y-6" id="independent-recruiter-section">
                <div className="flex items-center gap-4 pb-4 border-b border-border-primary">
                  <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-secondary font-bold">
                    IR
                  </div>
                  <div>
                    <h4 className="text-md font-bold text-text-primary flex items-center gap-2">
                      Independent Recruiters
                      <span className="px-2 py-0.5 bg-text-muted/15 text-text-secondary rounded text-[10px] uppercase font-bold tracking-tight">
                        No Leader Assigned
                      </span>
                    </h4>
                    <p className="text-xs text-text-muted mt-1">
                      These recruiters operate autonomously or have no designated team leads.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {independentRecruiters.map((recruiter) => {
                    const count = candidates.filter(c => String(c.assigned_recruiter) === String(recruiter.id)).length;
                    const loadInfo = getWorkloadClass(count);

                    return (
                      <div 
                        key={recruiter.id} 
                        className="bg-bg-tertiary border border-border-primary p-5 rounded-2xl flex flex-col justify-between h-48"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h6 className="font-bold text-text-primary text-sm truncate">{recruiter.display_name}</h6>
                              <p className="text-[10px] text-text-muted">@{recruiter.username}</p>
                            </div>
                            <span className={cn("px-2 py-0.5 border rounded text-[9px] font-black uppercase whitespace-nowrap", loadInfo.badge)}>
                              {count} Profiles • {loadInfo.label}
                            </span>
                          </div>

                          <div className="w-full bg-border-primary h-1.5 rounded-full overflow-hidden mt-3">
                            <div 
                              className={cn("h-full rounded-full transition-all duration-500", loadInfo.bar)}
                              style={{ width: `${Math.min((count / 20) * 100, 100)}%` }}
                            />
                          </div>

                          <div className="text-xs mt-3 text-text-secondary">
                            Status: <span className={recruiter.is_on_leave ? "text-accent-red font-black" : "text-accent-green font-black"}>{recruiter.is_on_leave ? 'On Leave' : 'Active'}</span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 mt-4 border-t border-border-primary/50">
                          <button
                            onClick={() => onReassignClick(recruiter)}
                            className="p-1 px-2.5 bg-bg-secondary hover:bg-accent-blue hover:text-white border border-border-primary rounded-lg text-[10px] font-bold text-text-secondary transition-all flex items-center gap-1"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                            Reassign
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border-primary text-text-muted text-[10px] font-black uppercase tracking-widest">
                    <th className="pb-4 pl-4">Rank</th>
                    <th className="pb-4">Recruiter</th>
                    <th className="pb-4">Team Leader / TL</th>
                    <th className="pb-4 text-center">Profile Count</th>
                    <th className="pb-4">Workload Status</th>
                    <th className="pb-4">Operation Status</th>
                    <th className="pb-4 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/40 text-xs">
                  {globalLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-muted italic">
                        No recruiters found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    globalLeaderboard.map((item, index) => {
                      const loadInfo = getWorkloadClass(item.count);

                      return (
                        <tr key={item.recruiter.id} className="hover:bg-bg-tertiary/40 transition-colors">
                          <td className="py-4 pl-4 font-black text-text-secondary text-sm">
                            #{index + 1}
                          </td>
                          <td className="py-4">
                            <p className="font-bold text-text-primary text-sm">{item.recruiter.display_name}</p>
                            <p className="text-[10px] text-text-muted mt-0.5">@{item.recruiter.username}</p>
                          </td>
                          <td className="py-4">
                            <span className="font-semibold text-text-secondary">{item.leaderName}</span>
                          </td>
                          <td className="py-4 text-center">
                            <span className="text-md font-black text-text-primary">{item.count}</span>
                          </td>
                          <td className="py-4">
                            <span className={cn("px-2.5 py-1 rounded-xl text-[10px] font-bold border", loadInfo.badge)}>
                              {loadInfo.label}
                            </span>
                          </td>
                          <td className="py-4">
                            <span className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              item.recruiter.is_on_leave ? "bg-accent-red/10 text-accent-red" : "bg-accent-green/10 text-accent-green"
                            )}>
                              <span className={cn("w-1 h-1 rounded-full", item.recruiter.is_on_leave ? "bg-accent-red" : "bg-accent-green")} />
                              {item.recruiter.is_on_leave ? 'On Leave' : 'Active'}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-right">
                            <button
                              onClick={() => onReassignClick(item.recruiter)}
                              className="px-3 py-1.5 bg-bg-tertiary hover:bg-accent-blue hover:text-white border border-border-primary rounded-xl text-[10px] font-extrabold text-text-secondary transition-all flex items-center gap-1 ml-auto"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              Reassign All
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Advice Section & Unassigned Warning */}
      {stats.unassignedCount > 0 && (
        <div className="bg-accent-amber/5 border border-accent-amber/20 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4" id="warning-unassigned-profiles-bar">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent-amber/10 flex items-center justify-center text-accent-amber shrink-0 mt-0.5">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-bold text-text-primary text-sm">Action Suggested: Map {stats.unassignedCount} Active Candidates</h5>
              <p className="text-xs text-text-secondary mt-1">
                There are active profiles that have no Marketing TL or Assigned Recruiter. Go to the Candidates view to filter by stage and assign them to load-balanced team members.
              </p>
            </div>
          </div>
          <a
            href="#candidates"
            className="px-5 py-2.5 bg-accent-amber text-bg-secondary text-xs font-bold rounded-2xl hover:bg-accent-amber/90 transition-all text-center whitespace-nowrap self-start sm:self-center"
          >
            Assign Profiles
          </a>
        </div>
      )}
    </div>
  );
};
