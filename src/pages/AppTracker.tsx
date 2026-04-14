import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, generateId, logActivity } from '../services/storage';
import { Application, Candidate, User, Notification } from '../types';
import { 
  FileText, 
  Search, 
  Plus, 
  ExternalLink, 
  Calendar, 
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { collection, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';

export const AppTracker: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [reportLogs, setReportLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    candidate_id: '',
    job_link: '',
    company_name: '',
    applied_at: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubApps = subscribeToCollection<Application>('jpc_applications', (data) => {
      setApplications(data.sort((a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()));
      setIsLoading(false);
    });

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      setCandidates(data);
    });

    const unsubTeam = subscribeToCollection<User>('jpc_users', (data) => {
      setTeam(data);
    });

    const unsubLogs = subscribeToCollection<any>('jpc_report_logs', setReportLogs);

    return () => {
      unsubApps();
      unsubCandidates();
      unsubTeam();
      unsubLogs();
    };
  }, [isAuthReady]);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      const candidate = candidates.find(c => c.id === app.candidate_id);
      
      // Filter by assigned recruiter if user is a recruiter
      if (user?.role === 'jpc_recruiter') {
        if (String(candidate?.assigned_recruiter) !== String(user.id)) return false;
      }

      const recruiter = team.find(u => u.id === app.recruiter_id);
      const searchStr = `${candidate?.full_name} ${app.company_name} ${recruiter?.display_name}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [applications, candidates, team, searchTerm, user]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayApps = applications.filter(a => a.applied_at === today);
    
    // Calculate candidate-wise progress for assigned candidates
    const candidateProgress = candidates
      .filter(c => {
        if (user?.role === 'jpc_recruiter') {
          return String(c.assigned_recruiter) === String(user.id);
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
      const today = new Date().toISOString().split('T')[0];
      const currentHour = new Date().getHours();
      
      // Automatically trigger after 5 PM (17:00)
      if (currentHour < 17) return;

      for (const p of stats.candidateProgress) {
        if (p.count < p.target) {
          // Check if already reported today for this candidate
          const alreadyReported = reportLogs.some(log => 
            log.recruiter_id === String(user.id) && 
            log.candidate_id === p.id && 
            log.date === today
          );

          if (!alreadyReported) {
            const recruiter = team.find(u => String(u.id) === String(user.id));
            const tl = team.find(u => String(u.id) === String(recruiter?.leader_id));
            const manager = team.find(u => u.role === 'jpc_manager' || u.role === 'administrator');

            if (tl) {
              const id = generateId();
              const message = `Automatic Alert: Recruiter ${user.display_name} has not completed the target for candidate ${p.name}. Progress: ${p.count}/${p.target} applications (${p.profiles} profile(s)).`;
              
              const notification: Notification = {
                id,
                recipient_id: String(tl.id),
                sender_id: String(user.id),
                type: 'target_not_met',
                message,
                read: false,
                created_at: new Date().toISOString()
              };

              try {
                await setDoc(doc(db, 'jpc_notifications', id), notification);
                
                if (manager) {
                  const ccId = generateId();
                  await setDoc(doc(db, 'jpc_notifications', ccId), {
                    ...notification,
                    id: ccId,
                    recipient_id: String(manager.id),
                    message: `[CC] ${message}`
                  });
                }

                // Log the report to prevent duplicates
                const logId = generateId();
                await setDoc(doc(db, 'jpc_report_logs', logId), {
                  id: logId,
                  recruiter_id: String(user.id),
                  candidate_id: p.id,
                  date: today,
                  sent_at: new Date().toISOString()
                });

                console.log(`[AUTO-EMAIL SIMULATION] To: ${tl.display_name}, Message: ${message}`);
              } catch (error) {
                console.error('Auto-notification error:', error);
              }
            }
          }
        }
      }
    };

    checkAndNotify();
  }, [stats.candidateProgress, user, team, reportLogs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidate_id || !formData.job_link || !formData.company_name) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    // Check for duplicate link
    const isDuplicate = applications.some(app => app.job_link.trim().toLowerCase() === formData.job_link.trim().toLowerCase());
    if (isDuplicate) {
      showToast('This job link has already been applied to!', 'error');
      return;
    }

    const id = generateId();
    const newApp: Application = {
      id,
      candidate_id: formData.candidate_id,
      recruiter_id: String(user?.id),
      job_link: formData.job_link,
      company_name: formData.company_name,
      applied_at: formData.applied_at,
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'jpc_applications', id), newApp);
      await logActivity(formData.candidate_id, 'Job Applied', `Applied to ${formData.company_name} via ${user?.display_name}`, user?.id || null);
      showToast('Application tracked successfully', 'success');
      setIsAddModalOpen(false);
      setFormData({
        candidate_id: '',
        job_link: '',
        company_name: '',
        applied_at: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save application', 'error');
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
            <p className="text-text-secondary mt-1">Track daily job applications and recruiter performance.</p>
          </div>
          <div className="flex items-center gap-3">
            {(user?.role === 'administrator' || user?.role === 'jpc_manager' || user?.role === 'jpc_recruiter') && (
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
              >
                <Plus className="w-5 h-5" />
                Add Application
              </button>
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
          <div className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-widest">
            <FileText className="w-4 h-4" />
            <span>Sheet View</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
            <thead>
              <tr className="bg-bg-tertiary/80">
                <th className="w-12 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase text-center">#</th>
                <th className="w-32 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Date</th>
                <th className="w-64 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Candidate</th>
                <th className="w-64 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Company</th>
                <th className="w-48 border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Recruiter</th>
                <th className="border border-border-primary px-3 py-2 text-[10px] font-bold text-text-muted uppercase tracking-widest">Job Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {/* Quick Add Row */}
              <tr className="bg-accent-blue/5 group">
                <td className="border border-border-primary px-3 py-2 text-center text-[10px] font-bold text-accent-blue">+</td>
                <td className="border border-border-primary px-2 py-1">
                  <input 
                    type="date" 
                    value={formData.applied_at}
                    onChange={e => setFormData({...formData, applied_at: e.target.value})}
                    className="w-full bg-transparent border-none text-xs text-text-primary focus:ring-0 p-0"
                  />
                </td>
                <td className="border border-border-primary px-2 py-1">
                  <select 
                    value={formData.candidate_id}
                    onChange={e => setFormData({...formData, candidate_id: e.target.value})}
                    className="w-full bg-transparent border-none text-xs text-text-primary focus:ring-0 p-0 appearance-none"
                  >
                    <option value="">Select Candidate...</option>
                    {candidates
                      .filter(c => {
                        if (user?.role === 'jpc_recruiter') {
                          return String(c.assigned_recruiter) === String(user.id);
                        }
                        return true;
                      })
                      .filter(c => c.current_stage !== 'not_interested')
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))}
                  </select>
                </td>
                <td className="border border-border-primary px-2 py-1">
                  <input 
                    type="text" 
                    placeholder="Company Name"
                    value={formData.company_name}
                    onChange={e => setFormData({...formData, company_name: e.target.value})}
                    className="w-full bg-transparent border-none text-xs text-text-primary focus:ring-0 p-0"
                  />
                </td>
                <td className="border border-border-primary px-3 py-2 text-xs text-text-muted italic">
                  {user?.display_name}
                </td>
                <td className="border border-border-primary px-2 py-1 relative">
                  <input 
                    type="url" 
                    placeholder="Paste Link & Press Enter"
                    value={formData.job_link}
                    onChange={e => setFormData({...formData, job_link: e.target.value})}
                    onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                    className="w-full bg-transparent border-none text-xs text-text-primary focus:ring-0 p-0 pr-8"
                  />
                  <button 
                    onClick={handleSubmit}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-accent-blue hover:bg-accent-blue/10 rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </td>
              </tr>

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
                      <span className="text-xs font-bold text-text-primary">{candidate?.full_name || 'Unknown'}</span>
                    </td>
                    <td className="border border-border-primary px-3 py-2">
                      <span className="text-xs text-text-primary">{app.company_name}</span>
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
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-bg-secondary border border-border-primary rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-bold text-text-primary tracking-tight">Track Application</h2>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-bg-tertiary rounded-xl transition-colors">
                    <Plus className="w-6 h-6 rotate-45 text-text-secondary" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Select Candidate</label>
                    <select 
                      value={formData.candidate_id}
                      onChange={e => setFormData({...formData, candidate_id: e.target.value})}
                      className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
                      required
                    >
                      <option value="">Choose a candidate...</option>
                      {candidates
                        .filter(c => {
                          if (user?.role === 'jpc_recruiter') {
                            return String(c.assigned_recruiter) === String(user.id);
                          }
                          return true;
                        })
                        .filter(c => c.current_stage !== 'not_interested')
                        .map(c => (
                          <option key={c.id} value={c.id}>{c.full_name} ({c.job_interest})</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Company Name</label>
                    <input 
                      type="text"
                      value={formData.company_name}
                      onChange={e => setFormData({...formData, company_name: e.target.value})}
                      className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                      placeholder="e.g. Google, Amazon"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Job Link</label>
                    <input 
                      type="url"
                      value={formData.job_link}
                      onChange={e => setFormData({...formData, job_link: e.target.value})}
                      className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                      placeholder="https://linkedin.com/jobs/..."
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Applied Date</label>
                    <input 
                      type="date"
                      value={formData.applied_at}
                      onChange={e => setFormData({...formData, applied_at: e.target.value})}
                      className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                      required
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="flex-1 py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
                    >
                      Track App
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
