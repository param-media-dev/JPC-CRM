import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, generateId, addNotification } from '../services/storage';
import { ResumeChangeRequest, Candidate, User } from '../types';
import { 
  FileEdit, 
  Search, 
  Plus, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowRight,
  MessageSquare,
  User as UserIcon,
  Filter,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { Upload, FileText, Loader2 } from 'lucide-react';

export const ResumeLogBook: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<ResumeChangeRequest[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionConfig, setActionConfig] = useState<{
    requestId: string;
    type: 'tl_forward' | 'tl_reject' | 'cs_forward' | 'cs_back' | 'resume_complete' | 'resume_back' | 'resume_reject';
    candidateName: string;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [formData, setFormData] = useState({
    candidate_id: '',
    details: ''
  });

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubRequests = subscribeToCollection<ResumeChangeRequest>('jpc_resume_requests', (data) => {
      setRequests(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      setIsLoading(false);
    });

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', setCandidates);
    const unsubTeam = subscribeToCollection<User>('jpc_users', setTeam);

    return () => {
      unsubRequests();
      unsubCandidates();
      unsubTeam();
    };
  }, [isAuthReady]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const candidate = candidates.find(c => c.id === req.candidate_id);
      const recruiter = team.find(u => String(u.id) === String(req.recruiter_id));
      
      const matchesSearch = `${candidate?.full_name} ${recruiter?.display_name} ${req.details}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || req.status === filterStatus;

      // Role-based visibility
      if (user?.role === 'jpc_recruiter') {
        if (String(req.recruiter_id) !== String(user.id)) return false;
      }

      return matchesSearch && matchesFilter;
    });
  }, [requests, candidates, team, searchTerm, filterStatus, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidate_id || !formData.details) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    const id = generateId();
    const newRequest: ResumeChangeRequest = {
      id,
      candidate_id: formData.candidate_id,
      recruiter_id: String(user?.id),
      details: formData.details,
      status: 'pending_tl',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'jpc_resume_requests', id), newRequest);
      showToast('Resume change request submitted to Marketing TL', 'success');
      setIsAddModalOpen(false);
      setFormData({ candidate_id: '', details: '' });
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to submit request', 'error');
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionConfig) return;

    const { requestId, type } = actionConfig;
    let newStatus: ResumeChangeRequest['status'];
    
    switch (type) {
      case 'tl_forward': newStatus = 'pending_cs'; break;
      case 'tl_reject': newStatus = 'rejected'; break;
      case 'cs_forward': newStatus = 'pending_resume_team'; break;
      case 'cs_back': newStatus = 'pending_tl'; break;
      case 'resume_complete': newStatus = 'completed'; break;
      case 'resume_back': newStatus = 'pending_cs'; break;
      case 'resume_reject': newStatus = 'rejected'; break;
      default: return;
    }

    if ((type === 'tl_reject' || type === 'resume_reject' || type === 'cs_back' || type === 'resume_back') && !actionNotes) {
      showToast('Please provide a reason/notes', 'error');
      return;
    }

    let finalResumeUrl = '';

    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      let resumeBase64 = '';
      let resumeFilename = '';

      if (type === 'resume_complete') {
        if (!selectedFile) {
          showToast('Please select a file to upload', 'error');
          setIsUploading(false);
          return;
        }

        // Use Local Proxy API for upload to bypass CORS
        try {
          const formData = new FormData();
          formData.append('file', selectedFile);

          setUploadProgress(30);
          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            let errorMessage = `Upload failed with status: ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage = errorData.details || errorData.error || errorMessage;
            } catch (e) {
              // If parsing JSON fails, try to get text
              try {
                const textError = await response.text();
                if (textError && textError.length < 200) errorMessage = textError;
              } catch (e2) {}
            }
            throw new Error(errorMessage);
          }

          const result = await response.json();
          setUploadProgress(100);
          
          // Assuming the API returns the file URL in a 'url' or 'file_url' field
          finalResumeUrl = result.url || result.file_url || result.data?.url;
          
          if (!finalResumeUrl) {
            console.warn('API did not return a URL, falling back to Base64');
            // Fallback to Base64 if API succeeds but URL is missing
            resumeFilename = selectedFile.name;
            resumeBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(selectedFile);
            });
          }
        } catch (apiError: any) {
          console.error('Custom API Upload error:', apiError);
          showToast('API Upload failed, using local storage fallback', 'warning');
          
          // Fallback to Base64 if API fails
          if (selectedFile.size > 800 * 1024) {
            showToast('File too large for fallback. Use a smaller file.', 'error');
            setIsUploading(false);
            return;
          }

          resumeFilename = selectedFile.name;
          resumeBase64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(selectedFile);
          });
          setUploadProgress(100);
        }
      }

      await handleUpdateStatus(requestId, newStatus, actionNotes, finalResumeUrl, resumeBase64, resumeFilename);
      setIsActionModalOpen(false);
      setActionNotes('');
      setSelectedFile(null);
      setUploadProgress(0);
      setActionConfig(null);
    } catch (error) {
      console.error('Action error:', error);
      showToast('An unexpected error occurred', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const openActionModal = (requestId: string, candidateName: string, type: typeof actionConfig.type) => {
    setActionConfig({ requestId, candidateName, type });
    setActionNotes('');
    setSelectedFile(null);
    setIsActionModalOpen(true);
  };

  const handleUpdateStatus = async (requestId: string, newStatus: ResumeChangeRequest['status'], notes?: string, resumeUrl?: string, resumeBase64?: string, resumeFilename?: string) => {
    try {
      const updateData: any = { 
        status: newStatus, 
        updated_at: new Date().toISOString() 
      };
      
      if (user?.role === 'jpc_marketing' && notes) updateData.tl_notes = notes;
      if (user?.role === 'jpc_cs' && notes) updateData.cs_notes = notes;
      if (user?.role === 'jpc_resume') {
        if (notes) updateData.resume_team_notes = notes;
        if (resumeUrl) updateData.new_resume_url = resumeUrl;
        if (resumeBase64) updateData.resume_base64 = resumeBase64;
        if (resumeFilename) updateData.resume_filename = resumeFilename;
      }

      await updateDoc(doc(db, 'jpc_resume_requests', requestId), updateData);
      
      const request = requests.find(r => r.id === requestId);
      if (request) {
        await addNotification({
          recipient_id: request.recruiter_id,
          sender_id: user?.id || null,
          type: 'resume_request',
          message: `Resume request for candidate ${candidates.find(c => c.id === request.candidate_id)?.full_name || 'Unknown'} has been updated to ${newStatus.replace('_', ' ')}`
        });
      }

      showToast(`Request updated to ${newStatus.replace('_', ' ')}`, 'success');
    } catch (error) {
      console.error('Update error:', error);
      showToast('Failed to update request', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_tl': return 'bg-accent-purple/10 text-accent-purple border-accent-purple/20';
      case 'pending_cs': return 'bg-accent-amber/10 text-accent-amber border-accent-amber/20';
      case 'pending_resume_team': return 'bg-accent-blue/10 text-accent-blue border-accent-blue/20';
      case 'completed': return 'bg-accent-green/10 text-accent-green border-accent-green/20';
      case 'rejected': return 'bg-accent-red/10 text-accent-red border-accent-red/20';
      default: return 'bg-bg-tertiary text-text-secondary border-border-primary';
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
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Resume Log Book</h1>
          <p className="text-text-secondary mt-1">Track and manage resume modification requests.</p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'jpc_recruiter' && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
            >
              <Plus className="w-5 h-5" />
              Request Change
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text"
            placeholder="Search requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-2xl px-4 py-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-text-primary cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="pending_tl">Pending TL</option>
            <option value="pending_cs">Pending CS</option>
            <option value="pending_resume_team">Pending Resume Team</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredRequests.map((req) => {
            const candidate = candidates.find(c => c.id === req.candidate_id);
            const recruiter = team.find(u => String(u.id) === String(req.recruiter_id));

            return (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-bg-secondary border border-border-primary rounded-3xl p-6 hover:shadow-xl hover:shadow-black/5 transition-all group"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        getStatusColor(req.status)
                      )}>
                        {req.status.replace('_', ' ')}
                      </div>
                      <span className="text-xs text-text-muted font-medium">
                        {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <UserIcon className="w-5 h-5 text-accent-blue" />
                        {candidate?.full_name || 'Unknown Candidate'}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1 flex items-center gap-1">
                        Requested by <span className="font-bold text-text-primary">{recruiter?.display_name || 'Unknown Recruiter'}</span>
                      </p>
                    </div>

                    <div className="bg-bg-tertiary rounded-2xl p-4 border border-border-primary/50">
                      <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                        {req.details}
                      </p>
                    </div>

                    {(req.tl_notes || req.cs_notes || req.resume_team_notes) && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {req.tl_notes && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">TL Notes</span>
                            <div className="bg-accent-purple/5 border border-accent-purple/10 rounded-xl p-3 text-xs text-text-secondary italic">
                              {req.tl_notes}
                            </div>
                          </div>
                        )}
                        {req.cs_notes && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">CS Notes</span>
                            <div className="bg-accent-amber/5 border border-accent-amber/10 rounded-xl p-3 text-xs text-text-secondary italic">
                              {req.cs_notes}
                            </div>
                          </div>
                        )}
                        {req.resume_team_notes && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-1">Resume Team Notes</span>
                            <div className="bg-accent-blue/5 border border-accent-blue/10 rounded-xl p-3 text-xs text-text-secondary italic">
                              {req.resume_team_notes}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(req.new_resume_url || req.resume_base64) && (
                      <div className="flex items-center gap-2 pt-2">
                        <span className="text-xs font-bold text-text-primary">New Resume:</span>
                        <button 
                          onClick={() => {
                            if (req.resume_base64) {
                              const link = document.createElement('a');
                              link.href = req.resume_base64;
                              link.download = req.resume_filename || 'updated_resume';
                              link.click();
                            } else if (req.new_resume_url) {
                              window.open(req.new_resume_url, '_blank');
                            }
                          }}
                          className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {req.resume_base64 ? 'Download Document' : 'View Document'}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-[180px]">
                    {/* TL Actions */}
                    {user?.role === 'jpc_marketing' && req.status === 'pending_tl' && (
                      <>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'tl_forward')}
                          className="w-full py-3 bg-accent-purple text-white font-bold rounded-xl hover:bg-accent-purple/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-purple/20"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Forward to CS
                        </button>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'tl_reject')}
                          className="w-full py-3 bg-bg-tertiary text-accent-red font-bold rounded-xl hover:bg-accent-red/10 transition-all flex items-center justify-center gap-2 border border-accent-red/20"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Request
                        </button>
                      </>
                    )}

                    {/* CS Actions */}
                    {user?.role === 'jpc_cs' && req.status === 'pending_cs' && (
                      <>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'cs_forward')}
                          className="w-full py-3 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-blue/20"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Forward to Resume
                        </button>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'cs_back')}
                          className="w-full py-3 bg-bg-tertiary text-accent-amber font-bold rounded-xl hover:bg-accent-amber/10 transition-all flex items-center justify-center gap-2 border border-accent-amber/20"
                        >
                          <Clock className="w-4 h-4" />
                          Send Back to TL
                        </button>
                      </>
                    )}

                    {/* Resume Team Actions */}
                    {user?.role === 'jpc_resume' && req.status === 'pending_resume_team' && (
                      <>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'resume_complete')}
                          className="w-full py-3 bg-accent-green text-white font-bold rounded-xl hover:bg-accent-green/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-green/20"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Upload & Complete
                        </button>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'resume_back')}
                          className="w-full py-3 bg-bg-tertiary text-accent-amber font-bold rounded-xl hover:bg-accent-amber/10 transition-all flex items-center justify-center gap-2 border border-accent-amber/20"
                        >
                          <Clock className="w-4 h-4" />
                          Send Back to CS
                        </button>
                        <button 
                          onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'resume_reject')}
                          className="w-full py-3 bg-bg-tertiary text-accent-red font-bold rounded-xl hover:bg-accent-red/10 transition-all flex items-center justify-center gap-2 border border-accent-red/20"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject Request
                        </button>
                      </>
                    )}

                    {/* General Status Info */}
                    {(req.status === 'completed' || req.status === 'rejected') && (
                      <div className="text-center py-4">
                        {req.status === 'completed' ? (
                          <div className="flex flex-col items-center gap-2 text-accent-green">
                            <CheckCircle2 className="w-8 h-8" />
                            <span className="font-bold text-sm">Request Completed</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-accent-red">
                            <XCircle className="w-8 h-8" />
                            <span className="font-bold text-sm">Request Rejected</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredRequests.length === 0 && (
          <div className="bg-bg-secondary border border-border-primary border-dashed rounded-3xl p-12 text-center">
            <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
              <FileEdit className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-bold text-text-primary">No requests found</h3>
            <p className="text-text-secondary mt-1">
              {searchTerm || filterStatus !== 'all' ? 'Try adjusting your filters' : 'New resume change requests will appear here'}
            </p>
          </div>
        )}
      </div>

      {/* Add Request Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-bg-secondary w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden border border-border-primary"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-text-primary tracking-tight">Request Resume Change</h2>
                  <p className="text-text-secondary text-sm mt-1">Submit your request to the Marketing TL.</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-bg-tertiary rounded-xl transition-colors"
                >
                  <XCircle className="w-6 h-6 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">Select Candidate</label>
                  <select 
                    value={formData.candidate_id}
                    onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium"
                    required
                  >
                    <option value="">Choose a candidate...</option>
                    {candidates
                      .filter(c => String(c.assigned_recruiter) === String(user?.id))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">Change Details</label>
                  <textarea 
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    placeholder="Describe the changes needed in the resume..."
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all min-h-[150px] font-medium"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
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
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

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
                    {actionConfig.type.includes('complete') ? 'Complete Request' : 
                     actionConfig.type.includes('reject') ? 'Reject Request' : 
                     actionConfig.type.includes('back') ? 'Send Back' : 'Forward Request'}
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
                {actionConfig.type === 'resume_complete' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-text-primary px-1">Upload New Resume</label>
                      <div className="relative">
                        <input 
                          type="file"
                          id="resume-upload"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          required
                        />
                        <label 
                          htmlFor="resume-upload"
                          className={cn(
                            "w-full flex flex-col items-center justify-center gap-3 p-8 bg-bg-tertiary border-2 border-dashed border-border-primary rounded-2xl cursor-pointer hover:bg-bg-tertiary/80 transition-all",
                            selectedFile && "border-accent-blue bg-accent-blue/5"
                          )}
                        >
                          {selectedFile ? (
                            <>
                              <FileText className="w-10 h-10 text-accent-blue" />
                              <div className="text-center">
                                <p className="text-sm font-bold text-text-primary">{selectedFile.name}</p>
                                <p className="text-xs text-text-secondary mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <Upload className="w-10 h-10 text-text-muted" />
                              <div className="text-center">
                                <p className="text-sm font-bold text-text-primary">Click to upload resume</p>
                                <p className="text-xs text-text-secondary mt-1">PDF, DOC, DOCX (Max 800KB)</p>
                              </div>
                            </>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">
                    {actionConfig.type.includes('reject') ? 'Rejection Reason' : 
                     actionConfig.type.includes('back') ? 'Feedback' : 'Notes (Optional)'}
                  </label>
                  <textarea 
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Enter details here..."
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all min-h-[120px] font-medium"
                    required={actionConfig.type.includes('reject') || actionConfig.type.includes('back')}
                  />
                </div>

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
                    disabled={isUploading}
                    className={cn(
                      "flex-1 py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2",
                      isUploading ? "bg-bg-tertiary text-text-muted cursor-not-allowed" :
                      actionConfig.type.includes('reject') ? "bg-accent-red shadow-accent-red/20 hover:bg-accent-red/90" :
                      actionConfig.type.includes('complete') ? "bg-accent-green shadow-accent-green/20 hover:bg-accent-green/90" :
                      "bg-accent-blue shadow-accent-blue/20 hover:bg-accent-blue/90"
                    )}
                  >
                    {isUploading ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-accent-blue"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      'Confirm Action'
                    )}
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
