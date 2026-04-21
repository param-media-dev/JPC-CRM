import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, generateId, logActivity } from '../services/storage';
import { Application, Candidate, User, Notification } from '../types';
import { 
  FileText, 
  Search, 
  ExternalLink, 
  Calendar, 
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Target,
  ArrowRight,
  Plus,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { CandidateSheet } from '../components/CandidateSheet';
import { TrackJobSheet } from '../components/TrackJobSheet';
import { apiService } from '../services/apiService';

export const AppTracker: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [trackingCandidate, setTrackingCandidate] = useState<Candidate | null>(null);
  const [isTrackSheetOpen, setIsTrackSheetOpen] = useState(false);
  const [filterCandidateId, setFilterCandidateId] = useState<string | null>(null);
  const [inlineJobLink, setInlineJobLink] = useState('');
  const [isInlineSubmitting, setIsInlineSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthReady) return;
    setIsLoading(true);
    try {
      const [appsData, candsData, teamData] = await Promise.all([
        apiService.getApplications(),
        apiService.getCandidates(),
        apiService.getUsers()
      ]);
      setApplications(Array.isArray(appsData) ? appsData.sort((a: any, b: any) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()) : []);
      setCandidates(Array.isArray(candsData) ? candsData : []);
      setTeam(Array.isArray(teamData) ? teamData : []);
      setReportLogs([]); // Mock or implement if exists
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthReady]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      // Priority filter by selected candidate
      if (filterCandidateId && app.candidate_id !== filterCandidateId) return false;

      const candidate = candidates.find(c => c.id === app.candidate_id);
      
      // Filter by assigned recruiter if user is a recruiter
      if (user?.role === 'jpc_recruiter') {
        if (String(candidate?.assigned_recruiter) !== String(user.id)) return false;
      }

      const recruiter = team.find(u => u.id === app.recruiter_id);
      const searchStr = `${candidate?.full_name} ${recruiter?.display_name} ${app.job_link}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [applications, candidates, team, searchTerm, user, filterCandidateId]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayApps = applications.filter(a => a.applied_at === today);
    
    // Calculate candidate-wise progress for assigned candidates
    const candidateProgress = candidates
      .filter(c => {
        if (user?.role === 'jpc_recruiter') {
          return String(c.assigned_recruiter) === String(user.id);
        } else if (user?.role === 'jpc_marketing') {
          return String(c.assigned_marketing_leader) === String(user.id);
        }
        return true;
      })
      .map(c => {
        const count = todayApps.filter(a => a.candidate_id === c.id).length;
        const profiles = c.profiles_count || 1;
        const target = profiles * 40;
        return {
          id: c.id,
          name: c.full_name,
          count,
          target,
          profiles,
          recruiter_id: c.assigned_recruiter
        };
      });

    return {
      totalToday: todayApps.length,
      candidateProgress
    };
  }, [applications, team, candidates, user]);

  // Automatic Target Notification Logic
  useEffect(() => {
    if (!user || user.role !== 'jpc_recruiter' || stats.candidateProgress.length === 0) return;

    const checkAndNotify = async () => {
      // Automatic notifications are currently disabled as the backend does not support the /notifications endpoint
      /*
      const today = new Date().toISOString().split('T')[0];
      ...
      */
      console.log('Automatic target checks are scheduled but notifications are disabled due to missing API support.');
    };

    checkAndNotify();
  }, [stats.candidateProgress, user, team, reportLogs]);

  const myCandidates = useMemo(() => {
    return candidates.filter(c => {
      if (user?.role === 'jpc_recruiter') {
        return String(c.assigned_recruiter) === String(user.id);
      } else if (user?.role === 'jpc_marketing') {
        return String(c.assigned_marketing_leader) === String(user.id);
      }
      return true;
    }).filter(c => c.current_stage !== 'not_interested');
  }, [candidates, user]);

  const handleInlineSubmit = async (e: React.KeyboardEvent | React.MouseEvent) => {
    if (!filterCandidateId || !inlineJobLink || isInlineSubmitting) return;
    
    // If keyboard event, only trigger on Enter
    if ('key' in e && e.key !== 'Enter') return;

    const candidate = candidates.find(c => c.id === filterCandidateId);
    if (!candidate) return;

    // Check for duplicate link
    const isDuplicate = applications.some(app => app.job_link.trim().toLowerCase() === inlineJobLink.trim().toLowerCase());
    if (isDuplicate) {
      showToast('LINK IS DUPLICATE! This job link has already been applied in the CRM.', 'error');
      return;
    }

    setIsInlineSubmitting(true);
    const id = generateId();
    const newApp: Application = {
      id,
      candidate_id: candidate.id,
      recruiter_id: String(user?.id),
      job_link: inlineJobLink,
      company_name: 'N/A',
      sheet_type: candidate.job_interest,
      applied_at: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    try {
      await apiService.request('/applications', { method: 'POST', body: JSON.stringify(newApp) });
      await logActivity(candidate.id, 'Job Applied (Inline)', `Applied via Link: ${inlineJobLink}`, user?.id || null);
      showToast('Entry added to sheet', 'success');
      setInlineJobLink('');
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save entry', 'error');
    } finally {
      setIsInlineSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">Application Tracker</h1>
            <p className="text-text-secondary mt-1">Select a candidate to track their daily job applications.</p>
          </div>
        </div>

      {/* Assigned Candidates List */}
      <div className="space-y-4">
        <h2 className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
          <UserIcon className="w-4 h-4" />
          My Assigned Candidates
        </h2>
        <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
          {myCandidates.map(candidate => (
            <motion.button
              key={candidate.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setFilterCandidateId(candidate.id === filterCandidateId ? null : candidate.id);
                setTrackingCandidate(candidate);
              }}
              className={cn(
                "flex-shrink-0 w-64 border rounded-2xl p-4 shadow-sm transition-all group text-left relative overflow-hidden",
                filterCandidateId === candidate.id 
                  ? "bg-accent-blue border-accent-blue shadow-lg shadow-accent-blue/20" 
                  : "bg-bg-secondary border-border-primary hover:border-accent-blue"
              )}
            >
              <div className="flex items-start justify-between mb-3 relative z-10">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                  filterCandidateId === candidate.id ? "bg-white/20 text-white" : "bg-accent-blue/10 text-accent-blue"
                )}>
                  {candidate.full_name.charAt(0)}
                </div>
                <div className={cn(
                  "p-1.5 rounded-lg transition-all",
                  filterCandidateId === candidate.id ? "bg-white/20 text-white" : "bg-bg-tertiary text-accent-blue"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setTrackingCandidate(candidate);
                  setIsTrackSheetOpen(true);
                }}>
                  <Plus className="w-4 h-4" />
                </div>
              </div>
              <div className="relative z-10">
                <h3 className={cn(
                  "text-sm font-bold transition-colors",
                  filterCandidateId === candidate.id ? "text-white" : "text-text-primary"
                )}>
                  {candidate.full_name}
                </h3>
                <p className={cn(
                  "text-[10px] uppercase tracking-wider font-bold mt-0.5 transition-colors",
                  filterCandidateId === candidate.id ? "text-white/70" : "text-text-muted"
                )}>
                  {candidate.job_interest || 'General'}
                </p>
                <div className={cn(
                  "mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest py-1 px-2 rounded-md w-fit transition-colors",
                  filterCandidateId === candidate.id ? "bg-white/20 text-white" : "bg-accent-blue/5 text-accent-blue"
                )}>
                  {filterCandidateId === candidate.id ? 'Viewing Sheet' : 'Track Job'} <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </motion.button>
          ))}
          {myCandidates.length === 0 && (
            <div className="w-full py-12 bg-bg-secondary/50 border border-dashed border-border-primary rounded-3xl flex flex-col items-center justify-center text-text-muted">
              <UserIcon className="w-12 h-12 opacity-10 mb-2" />
              <p className="text-sm italic">No active candidates assigned to you.</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-blue/10 rounded-2xl flex items-center justify-center text-accent-blue">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Total Today</p>
              <p className="text-2xl font-bold text-text-primary">{stats.totalToday}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-bg-secondary border border-border-primary rounded-3xl p-6 shadow-sm md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent-teal/10 rounded-2xl flex items-center justify-center text-accent-teal">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Candidate Targets (40/Profile)</p>
                <p className="text-sm text-text-secondary">Track progress for each assigned candidate</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {stats.candidateProgress.map(p => (
              <div key={p.id} className="space-y-2 p-4 bg-bg-tertiary/30 rounded-2xl border border-border-primary/50">
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-text-primary truncate max-w-[150px]">{p.name}</p>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider">{p.profiles} Profile(s)</p>
                  </div>
                  <div className="text-right">
                    <span className={cn("text-xs font-bold", p.count >= p.target ? "text-accent-green" : "text-accent-amber")}>
                      {p.count} / {p.target}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((p.count / p.target) * 100, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all",
                      p.count >= p.target ? "bg-accent-green" : "bg-accent-blue"
                    )}
                  />
                </div>
              </div>
            ))}
            {stats.candidateProgress.length === 0 && (
              <div className="col-span-full py-8 text-center text-text-muted text-sm italic">
                No candidates assigned to track.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-bg-secondary border border-border-primary rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border-primary flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search sheet..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-bg-tertiary border border-border-primary rounded-2xl pl-12 pr-4 py-3 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            />
          </div>
          <div className="flex items-center gap-3">
            {filterCandidateId && (
              <>
                <button 
                  onClick={() => setFilterCandidateId(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-tertiary text-text-muted rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-bg-tertiary/80 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Close Sheet
                </button>
              </>
            )}
            <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-widest ml-1">
              <FileText className="w-4 h-4" />
              <span>{filterCandidateId ? candidates.find(c => c.id === filterCandidateId)?.full_name + "'s Sheet" : "Master Sheet View"}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
            <thead>
              <tr className="bg-bg-tertiary/80">
                <th className="w-12 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase text-center">#</th>
                <th className="w-32 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                <th className="w-48 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Sheet Type</th>
                <th className="w-64 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Candidate</th>
                <th className="w-48 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Recruiter</th>
                <th className="border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Job Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {/* Excel-like Inline Quick Entry Row */}
              {filterCandidateId && (
                <tr className="bg-accent-blue/5 border-2 border-accent-blue/20 shadow-inner">
                  <td className="border border-border-primary px-3 py-2 text-center">
                    <div className="w-5 h-5 bg-accent-blue text-white rounded-full flex items-center justify-center text-[10px] mx-auto animate-pulse">
                      *
                    </div>
                  </td>
                  <td className="border border-border-primary px-3 py-2 bg-bg-secondary">
                    <span className="text-xs text-text-secondary font-bold truncate">Today</span>
                  </td>
                  <td className="border border-border-primary px-3 py-2 bg-bg-secondary">
                    <div className="flex items-center gap-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                       <span className="text-[10px] font-bold text-text-primary uppercase truncate">
                         {candidates.find(c => c.id === filterCandidateId)?.job_interest || 'Auto'}
                       </span>
                    </div>
                  </td>
                  <td className="border border-border-primary px-3 py-2 bg-bg-secondary">
                    <span className="text-xs font-bold text-text-primary truncate">
                      {candidates.find(c => c.id === filterCandidateId)?.full_name}
                    </span>
                  </td>
                  <td className="border border-border-primary px-3 py-2 bg-bg-secondary">
                    <span className="text-xs text-text-secondary font-medium italic underline underline-offset-4 decoration-accent-blue/30">
                      {user?.display_name}
                    </span>
                  </td>
                  <td className="border border-border-primary px-3 py-1 relative">
                    <input 
                      type="text"
                      placeholder="Paste Job URL here and press Enter to save..."
                      value={inlineJobLink}
                      onChange={e => setInlineJobLink(e.target.value)}
                      onKeyDown={handleInlineSubmit}
                      disabled={isInlineSubmitting}
                      className="w-full h-full bg-transparent border-none text-xs text-accent-blue font-mono placeholder:text-text-muted/40 focus:ring-0 focus:outline-none py-2"
                      autoFocus
                    />
                    {isInlineSubmitting && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-3 h-3 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
                      </div>
                    )}
                  </td>
                </tr>
              )}

              {filteredApps.map((app, index) => {
                const candidate = candidates.find(c => c.id === app.candidate_id);
                const recruiter = team.find(u => u.id === app.recruiter_id);
                return (
                  <tr key={app.id} className="hover:bg-bg-tertiary/30 transition-colors group">
                    <td className="border border-border-primary px-3 py-2 text-center text-[10px] font-mono text-text-muted">
                      {filteredApps.length - index}
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <span className="text-xs text-text-secondary">{new Date(app.applied_at).toLocaleDateString()}</span>
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
                        <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">{app.sheet_type || candidate?.job_interest || 'General'}</span>
                      </div>
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <button 
                        onClick={() => {
                          setFilterCandidateId(candidate?.id || null);
                          if (candidate) setTrackingCandidate(candidate);
                        }}
                        className="text-xs font-bold text-text-primary hover:text-accent-blue transition-colors text-left"
                      >
                        {candidate?.full_name || 'Unknown'}
                      </button>
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <span className="text-xs text-text-secondary">{recruiter?.display_name || 'System'}</span>
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-accent-blue truncate max-w-[300px] font-mono">
                          {app.job_link}
                        </span>
                        <a 
                          href={app.job_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-1 text-text-muted hover:text-accent-blue transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center border border-border-primary">
                    <div className="flex flex-col items-center gap-3 text-text-muted">
                      <FileText className="w-12 h-12 opacity-20" />
                      <p className="text-sm">No applications found in sheet.</p>
                      {filterCandidateId && (
                        <button 
                          onClick={() => setIsTrackSheetOpen(true)}
                          className="mt-2 flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-xl font-bold hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
                        >
                          <Plus className="w-4 h-4" />
                          Add First Entry
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TrackJobSheet 
        candidate={trackingCandidate}
        isOpen={isTrackSheetOpen}
        onClose={() => {
          setIsTrackSheetOpen(false);
          setTrackingCandidate(null);
        }}
        applications={applications}
      />
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
