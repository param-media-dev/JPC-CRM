import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, generateId, addInterviewRequest, updateInterviewRequest, logActivity, addNotification } from '../services/storage';
import { InterviewRequest, Candidate, User } from '../types';
import { 
  Calendar, 
  Search, 
  Clock, 
  CheckCircle2, 
  XCircle,
  ArrowRight,
  MessageSquare,
  User as UserIcon,
  Filter,
  ExternalLink,
  Video,
  Check,
  RefreshCcw,
  Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useToast } from '../contexts/ToastContext';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export const InterviewSupport: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionConfig, setActionConfig] = useState<{
    interviewId: string;
    type: 'schedule' | 'start_live' | 'provide_feedback' | 'update_result' | 'final_decision';
    candidateName: string;
  } | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [actionData, setActionData] = useState({
    calendly_link: '',
    scheduled_at: '',
    feedback: '',
    result: '' as 'next_round' | 'rejected',
    cs_decision: '' as 'restart_marketing' | 'plan_completed'
  });

  const [calendlyToken, setCalendlyToken] = useState(user?.calendly_token || '');
  const [isSyncing, setIsSyncing] = useState(false);
  const [unlinkedBookings, setUnlinkedBookings] = useState<any[]>([]);

  useEffect(() => {
    if (actionConfig?.type === 'schedule' && user?.calendly_link) {
      setActionData(prev => ({ ...prev, calendly_link: user.calendly_link || '' }));
    }
  }, [actionConfig, user]);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubInterviews = subscribeToCollection<InterviewRequest>('jpc_interviews', (data) => {
      setInterviews(data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setIsLoading(false);
    });

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', setCandidates);
    const unsubTeam = subscribeToCollection<User>('jpc_users', setTeam);

    return () => {
      unsubInterviews();
      unsubCandidates();
      unsubTeam();
    };
  }, [isAuthReady]);

  const filteredInterviews = useMemo(() => {
    return interviews.filter(interview => {
      const candidate = candidates.find(c => c.id === interview.candidate_id);
      const cs = team.find(u => String(u.id) === String(interview.cs_id));
      
      const matchesSearch = `${candidate?.full_name} ${cs?.display_name}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || interview.status === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [interviews, candidates, team, searchTerm, filterStatus]);

  const saveCalendlyToken = async () => {
    if (!user) return;
    try {
      setIsSyncing(true);
      // Update user document in jpc_users collection
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, 'jpc_users', String(user.id)), { 
        ...user, 
        calendly_token: calendlyToken 
      }, { merge: true });
      showToast('Calendly Token saved!', 'success');
    } catch (error) {
      showToast('Failed to save token', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncCalendly = async () => {
    if (!calendlyToken) {
      showToast('Please connect Calendly first', 'error');
      return;
    }
    setIsSyncing(true);
    try {
      showToast('Fetching recent bookings from Calendly...', 'info');
      
      let bookings = [];
      
      // Real API Call via Proxy
      const response = await fetch('/api/calendly/bookings', {
        headers: {
          'Authorization': calendlyToken
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch from Calendly');
      }
      
      const data = await response.json();
      bookings = data.collection.map((b: any) => ({
        ...b,
        calendly_link: user?.calendly_link || 'https://calendly.com/proxy'
      }));
      
      // Filter out already linked bookings
      const newBookings = bookings.filter(b => !interviews.some(i => i.scheduled_at === b.start_time));
      
      if (newBookings.length === 0) {
        showToast('No new bookings found', 'info');
      } else {
        setUnlinkedBookings(newBookings);
        showToast(`Found ${newBookings.length} new bookings!`, 'success');
      }
    } catch (error: any) {
      console.error('Calendly Sync Error:', error);
      showToast(error.message || 'Failed to sync with Calendly', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const verifyAndLink = async (booking: any, candidateId: string) => {
    if (!candidateId) {
      showToast('Please select a candidate', 'error');
      return;
    }

    const candidate = candidates.find(c => c.id === candidateId);
    
    try {
      await addInterviewRequest({
        candidate_id: candidateId,
        cs_id: candidate?.recruiter_id ? String(team.find(u => u.id === candidate.recruiter_id)?.leader_id || user?.id) : String(user?.id),
        recruiter_id: candidate?.recruiter_id || null,
        status: 'scheduled',
        scheduled_at: booking.start_time,
        calendly_link: booking.calendly_link,
        proxy_id: String(user?.id)
      });

      await logActivity(candidateId, 'Interview Linked from Calendly', `Proxy Team verified and linked booking for ${new Date(booking.start_time).toLocaleString()}`, user?.id || null);
      
      setUnlinkedBookings(prev => prev.filter(b => b.id !== booking.id));
      showToast('Interview verified and linked!', 'success');
    } catch (error) {
      showToast('Failed to link interview', 'error');
    }
  };

  const sendNotification = async (recipientId: string, message: string, type: 'system_alert') => {
    try {
      await addNotification({
        recipient_id: recipientId,
        sender_id: user?.id || null,
        type,
        message
      });
    } catch (error) {
      console.error('Notification error:', error);
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionConfig) return;

    const { interviewId, type } = actionConfig;
    const interview = interviews.find(i => i.id === interviewId);
    if (!interview) return;

    const candidate = candidates.find(c => c.id === interview.candidate_id);

    try {
      switch (type) {
        case 'schedule':
          if (!actionData.calendly_link || !actionData.scheduled_at) {
            showToast('Please provide Calendly link and schedule time', 'error');
            return;
          }
          await updateInterviewRequest(interviewId, {
            status: 'scheduled',
            calendly_link: actionData.calendly_link,
            scheduled_at: actionData.scheduled_at,
            proxy_id: String(user?.id)
          });
          await logActivity(interview.candidate_id, 'Interview Scheduled', `Interview scheduled for ${new Date(actionData.scheduled_at).toLocaleString()}`, user?.id || null);
          
          // Notify Candidate and CS
          await sendNotification(interview.cs_id, `Interview scheduled for ${candidate?.full_name} at ${new Date(actionData.scheduled_at).toLocaleString()}`, 'system_alert');
          break;

        case 'start_live':
          await updateInterviewRequest(interviewId, {
            status: 'live'
          });
          await logActivity(interview.candidate_id, 'Interview Started', 'Proxy team started live interview support.', user?.id || null);
          break;

        case 'provide_feedback':
          if (!actionData.feedback) {
            showToast('Please provide feedback', 'error');
            return;
          }
          await updateInterviewRequest(interviewId, {
            status: 'feedback_shared',
            feedback: actionData.feedback
          });
          await logActivity(interview.candidate_id, 'Interview Feedback Shared', 'Proxy team shared post-interview feedback.', user?.id || null);
          break;

        case 'update_result':
          if (!actionData.result) {
            showToast('Please select a result', 'error');
            return;
          }
          await updateInterviewRequest(interviewId, {
            status: actionData.result === 'next_round' ? 'next_round' : 'rejected',
            result: actionData.result
          });
          await logActivity(interview.candidate_id, 'Interview Result Updated', `Recruiter updated result: ${actionData.result.replace('_', ' ')}`, user?.id || null);
          
          if (actionData.result === 'next_round') {
            showToast('Candidate moved to next round. Flow will repeat.', 'success');
          }
          break;

        case 'final_decision':
          if (!actionData.cs_decision) {
            showToast('Please select a decision', 'error');
            return;
          }
          await updateInterviewRequest(interviewId, {
            status: 'completed',
            cs_decision: actionData.cs_decision
          });
          await logActivity(interview.candidate_id, 'Interview Completed', `CS Team finalized interview support: ${actionData.cs_decision.replace('_', ' ')}`, user?.id || null);
          
          if (actionData.cs_decision === 'restart_marketing') {
            showToast('Marketing restarted for candidate', 'success');
          } else {
            showToast('Interview support plan completed', 'success');
          }
          break;
      }

      setIsActionModalOpen(false);
      setActionData({
        calendly_link: '',
        scheduled_at: '',
        feedback: '',
        result: '' as any,
        cs_decision: '' as any
      });
      showToast('Action completed successfully', 'success');
    } catch (error) {
      console.error('Action error:', error);
      showToast('Failed to complete action', 'error');
    }
  };

  const getStatusColor = (status: InterviewRequest['status']) => {
    switch (status) {
      case 'pending_proxy': return 'bg-accent-amber/10 text-accent-amber border-accent-amber/20';
      case 'scheduled': return 'bg-accent-blue/10 text-accent-blue border-accent-blue/20';
      case 'live': return 'bg-accent-red/10 text-accent-red border-accent-red/20 animate-pulse';
      case 'feedback_shared': return 'bg-accent-purple/10 text-accent-purple border-accent-purple/20';
      case 'result_pending': return 'bg-accent-gray/10 text-accent-gray border-accent-gray/20';
      case 'next_round': return 'bg-accent-green/10 text-accent-green border-accent-green/20';
      case 'rejected': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'completed': return 'bg-bg-tertiary text-text-muted border-border-primary';
      default: return 'bg-bg-tertiary text-text-muted border-border-primary';
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Interview Support</h1>
          <p className="text-text-secondary mt-1">Manage proxy interview coordination and feedback</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'jpc_proxy' && (
            <>
              <div className="flex items-center gap-2 p-1 bg-bg-secondary border border-border-primary rounded-2xl">
                <input 
                  type="password"
                  value={calendlyToken}
                  onChange={(e) => setCalendlyToken(e.target.value)}
                  placeholder="Calendly API Token"
                  className="bg-transparent border-none focus:ring-0 text-xs px-3 py-2 w-32"
                />
                <button 
                  onClick={saveCalendlyToken}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-accent-blue text-white text-[10px] font-bold rounded-xl hover:bg-accent-blue/90 disabled:opacity-50"
                >
                  {isSyncing ? 'Saving...' : 'Connect'}
                </button>
              </div>
              <button 
                onClick={syncCalendly}
                disabled={isSyncing}
                className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50"
              >
                <RefreshCcw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
                Sync Bookings
              </button>
            </>
          )}
        </div>
      </div>

      {user?.role === 'jpc_proxy' && (
        <p className="text-[10px] text-text-muted italic text-right px-2">
          Note: Only actual scheduled bookings (not event types) will be synced from Calendly.
        </p>
      )}

      {/* Filters & Search */}
      {unlinkedBookings.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 bg-accent-amber rounded-full animate-pulse" />
            <h2 className="text-sm font-bold text-text-primary uppercase tracking-widest">Pending Verification ({unlinkedBookings.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unlinkedBookings.map(booking => (
              <motion.div 
                key={booking.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-bg-secondary border border-accent-amber/30 rounded-[24px] p-6 shadow-xl shadow-accent-amber/5"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs font-bold text-accent-amber uppercase tracking-widest mb-1">New Calendly Booking</p>
                    <h3 className="text-lg font-bold text-text-primary">{booking.invitee_name}</h3>
                    <p className="text-sm text-text-secondary">{booking.invitee_email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-1">Time</p>
                    <p className="text-sm font-bold text-text-primary">{new Date(booking.start_time).toLocaleString()}</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <select 
                    onChange={(e) => booking.selectedCandidateId = e.target.value}
                    className="flex-1 bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue/20"
                  >
                    <option value="">Select Candidate...</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => verifyAndLink(booking, (booking as any).selectedCandidateId)}
                    className="px-6 py-2 bg-accent-blue text-white text-xs font-bold rounded-xl hover:bg-accent-blue/90 transition-all"
                  >
                    Verify & Link
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text"
            placeholder="Search by candidate or CS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium"
          />
        </div>
        <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-2xl px-4 py-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-sm font-bold text-text-primary uppercase tracking-wider"
          >
            <option value="all">All Status</option>
            <option value="pending_proxy">Pending Proxy</option>
            <option value="scheduled">Scheduled</option>
            <option value="live">Live Interview</option>
            <option value="feedback_shared">Feedback Shared</option>
            <option value="next_round">Next Round</option>
            <option value="rejected">Rejected</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredInterviews.map((interview) => {
            const candidate = candidates.find(c => c.id === interview.candidate_id);
            const cs = team.find(u => String(u.id) === String(interview.cs_id));
            const proxy = team.find(u => String(u.id) === String(interview.proxy_id));
            const recruiter = team.find(u => String(u.id) === String(interview.recruiter_id));

            return (
              <motion.div 
                key={interview.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-bg-secondary border border-border-primary rounded-[32px] p-6 hover:shadow-xl hover:shadow-accent-blue/5 transition-all group"
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusColor(interview.status)
                      )}>
                        {interview.status.replace('_', ' ')}
                      </div>
                      <span className="text-xs text-text-muted font-medium">
                        Updated {new Date(interview.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                          <UserIcon className="w-5 h-5 text-accent-blue" />
                          {candidate?.full_name || 'Unknown Candidate'}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2">
                          <p className="text-sm text-text-secondary flex items-center gap-1">
                            CS: <span className="font-bold text-text-primary">{cs?.display_name || 'Unknown'}</span>
                          </p>
                          {proxy && (
                            <p className="text-sm text-text-secondary flex items-center gap-1">
                              Proxy: <span className="font-bold text-accent-purple">{proxy.display_name}</span>
                            </p>
                          )}
                          {recruiter && (
                            <p className="text-sm text-text-secondary flex items-center gap-1">
                              Recruiter: <span className="font-bold text-accent-blue">{recruiter.display_name}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Details based on status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {interview.scheduled_at && (
                        <div className="bg-bg-tertiary rounded-2xl p-4 border border-border-primary/50">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Scheduled Time</p>
                          <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-accent-blue" />
                            {new Date(interview.scheduled_at).toLocaleString()}
                          </p>
                          {interview.calendly_link && (
                            <a href={interview.calendly_link} target="_blank" rel="noreferrer" className="text-xs text-accent-blue hover:underline mt-2 flex items-center gap-1">
                              Calendly Link <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {interview.feedback && (
                      <div className="bg-accent-purple/5 border border-accent-purple/10 rounded-2xl p-4">
                        <p className="text-[10px] font-bold text-accent-purple uppercase tracking-widest mb-1">Proxy Feedback</p>
                        <p className="text-sm text-text-primary italic">"{interview.feedback}"</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                      {interview.calendly_link && (
                        <a 
                          href={interview.calendly_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-border-primary rounded-xl text-xs font-bold text-text-primary hover:bg-bg-tertiary/80 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Calendly
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px] justify-center">
                    {/* Proxy Actions */}
                    {user?.role === 'jpc_proxy' && interview.status === 'pending_proxy' && (
                      <div className="flex flex-col gap-2">
                        {calendlyToken && (
                          <button 
                            onClick={() => syncCalendly()}
                            disabled={isSyncing}
                            className="w-full py-3 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/20"
                          >
                            <RefreshCcw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                            Sync from Calendly
                          </button>
                        )}
                      </div>
                    )}

                    {user?.role === 'jpc_proxy' && interview.status === 'scheduled' && (
                      <button 
                        onClick={() => {
                          setActionConfig({ interviewId: interview.id, type: 'start_live', candidateName: candidate?.full_name || 'Candidate' });
                          setIsActionModalOpen(true);
                        }}
                        className="w-full py-3 bg-accent-red text-white font-bold rounded-xl hover:bg-accent-red/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-red/20"
                      >
                        <Video className="w-4 h-4" />
                        Start Interview
                      </button>
                    )}

                    {user?.role === 'jpc_proxy' && interview.status === 'live' && (
                      <button 
                        onClick={() => {
                          setActionConfig({ interviewId: interview.id, type: 'provide_feedback', candidateName: candidate?.full_name || 'Candidate' });
                          setIsActionModalOpen(true);
                        }}
                        className="w-full py-3 bg-accent-purple text-white font-bold rounded-xl hover:bg-accent-purple/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/20"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Provide Feedback
                      </button>
                    )}

                    {/* Recruiter Actions */}
                    {user?.role === 'jpc_recruiter' && interview.status === 'feedback_shared' && (
                      <button 
                        onClick={() => {
                          setActionConfig({ interviewId: interview.id, type: 'update_result', candidateName: candidate?.full_name || 'Candidate' });
                          setIsActionModalOpen(true);
                        }}
                        className="w-full py-3 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/20"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        Update Result
                      </button>
                    )}

                    {/* CS Actions */}
                    {user?.role === 'jpc_cs' && interview.status === 'pending_proxy' && interview.calendly_link && (
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(interview.calendly_link || '');
                          showToast('Booking link copied to clipboard!', 'success');
                        }}
                        className="w-full py-3 bg-accent-teal/10 text-accent-teal font-bold rounded-xl border border-accent-teal/20 hover:bg-accent-teal/20 transition-all flex items-center justify-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Copy Booking Link
                      </button>
                    )}

                    {user?.role === 'jpc_cs' && (interview.status === 'next_round' || interview.status === 'rejected') && (
                      <button 
                        onClick={() => {
                          setActionConfig({ interviewId: interview.id, type: 'final_decision', candidateName: candidate?.full_name || 'Candidate' });
                          setIsActionModalOpen(true);
                        }}
                        className="w-full py-3 bg-accent-teal text-white font-bold rounded-xl hover:bg-accent-teal/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-teal/20"
                      >
                        <Flag className="w-4 h-4" />
                        Complete Interview
                      </button>
                    )}

                    {interview.status === 'completed' && (
                      <div className="text-center py-2 px-4 bg-bg-tertiary rounded-xl border border-border-primary">
                        <p className="text-[10px] font-bold text-text-muted uppercase">Decision</p>
                        <p className="text-sm font-bold text-text-primary capitalize">{interview.cs_decision?.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredInterviews.length === 0 && (
          <div className="text-center py-20 bg-bg-secondary border border-border-primary border-dashed rounded-[32px]">
            <Calendar className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-text-primary">No interview requests found</h3>
            <p className="text-text-secondary mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {isActionModalOpen && actionConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-bg-secondary w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-border-primary"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary tracking-tight">
                    {actionConfig.type === 'schedule' ? 'Schedule Interview' : 
                     actionConfig.type === 'start_live' ? 'Start Interview' : 
                     actionConfig.type === 'provide_feedback' ? 'Provide Feedback' : 
                     actionConfig.type === 'update_result' ? 'Update Result' : 'Complete Interview'}
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Candidate: <span className="font-bold text-text-primary">{actionConfig.candidateName}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setIsActionModalOpen(false)}
                  className="p-2 hover:bg-bg-tertiary rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleAction} className="space-y-6">
                {actionConfig.type === 'schedule' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary px-1">Calendly Link</label>
                      <input 
                        type="url"
                        value={actionData.calendly_link}
                        onChange={(e) => setActionData({ ...actionData, calendly_link: e.target.value })}
                        placeholder="https://calendly.com/..."
                        className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary px-1">Scheduled Date & Time</label>
                      <input 
                        type="datetime-local"
                        value={actionData.scheduled_at}
                        onChange={(e) => setActionData({ ...actionData, scheduled_at: e.target.value })}
                        className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium"
                        required
                      />
                    </div>
                  </>
                )}

                {actionConfig.type === 'start_live' && (
                  <div className="p-4 bg-accent-blue/5 border border-accent-blue/10 rounded-2xl">
                    <p className="text-sm text-text-primary">
                      Are you ready to start the interview support for this candidate?
                    </p>
                  </div>
                )}

                {actionConfig.type === 'provide_feedback' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary px-1">Interview Feedback</label>
                    <textarea 
                      value={actionData.feedback}
                      onChange={(e) => setActionData({ ...actionData, feedback: e.target.value })}
                      placeholder="Performance, areas of improvement, likely outcome..."
                      className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium min-h-[120px]"
                      required
                    />
                  </div>
                )}

                {actionConfig.type === 'update_result' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary px-1">Interview Result</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        onClick={() => setActionData({ ...actionData, result: 'next_round' })}
                        className={cn(
                          "py-4 rounded-2xl font-bold border-2 transition-all",
                          actionData.result === 'next_round' ? "bg-accent-green/10 border-accent-green text-accent-green" : "bg-bg-tertiary border-border-primary text-text-secondary"
                        )}
                      >
                        Next Round
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActionData({ ...actionData, result: 'rejected' })}
                        className={cn(
                          "py-4 rounded-2xl font-bold border-2 transition-all",
                          actionData.result === 'rejected' ? "bg-rose-500/10 border-rose-500 text-rose-500" : "bg-bg-tertiary border-border-primary text-text-secondary"
                        )}
                      >
                        Rejected
                      </button>
                    </div>
                  </div>
                )}

                {actionConfig.type === 'final_decision' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary px-1">CS Team Decision</label>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        type="button"
                        onClick={() => setActionData({ ...actionData, cs_decision: 'restart_marketing' })}
                        className={cn(
                          "py-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-center gap-2",
                          actionData.cs_decision === 'restart_marketing' ? "bg-accent-blue/10 border-accent-blue text-accent-blue" : "bg-bg-tertiary border-border-primary text-text-secondary"
                        )}
                      >
                        <RefreshCcw className="w-4 h-4" />
                        Restart Marketing
                      </button>
                      <button 
                        type="button"
                        onClick={() => setActionData({ ...actionData, cs_decision: 'plan_completed' })}
                        className={cn(
                          "py-4 rounded-2xl font-bold border-2 transition-all flex items-center justify-center gap-2",
                          actionData.cs_decision === 'plan_completed' ? "bg-accent-green/10 border-accent-green text-accent-green" : "bg-bg-tertiary border-border-primary text-text-secondary"
                        )}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Plan Completed
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsActionModalOpen(false)}
                    className="flex-1 py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
                  >
                    Confirm
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
