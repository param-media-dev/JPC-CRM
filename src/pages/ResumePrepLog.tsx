import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, generateId, addNotification } from '../services/storage';
import { ResumePrepRequest, Candidate, User } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  HelpCircle,
  FileText,
  Upload,
  Loader2,
  ExternalLink,
  User as UserIcon,
  MessageSquare,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '../contexts/ToastContext';
import { uploadFile, handleViewFile } from '../services/fileService';

type TabType = 'resume_understanding' | 'interview_questions';

export const ResumePrepLog: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabType>('resume_understanding');
  
  const [requests, setRequests] = useState<ResumePrepRequest[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  
  // Add state
  const [formData, setFormData] = useState({
    candidate_id: '',
    details: '',
    type: 'resume_understanding' as TabType
  });

  // Action state (Complete / Reject)
  const [actionConfig, setActionConfig] = useState<{
    requestId: string;
    type: 'complete' | 'reject';
    candidateName: string;
    reqType: TabType;
  } | null>(null);
  
  const [actionNotes, setActionNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubRequests = subscribeToCollection<ResumePrepRequest>('jpc_prep_requests', (data) => {
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
      if (req.type !== activeTab) return false;
      
      const candidate = candidates.find(c => c.id === req.candidate_id);
      const recruiter = team.find(u => String(u.id) === String(req.recruiter_id));
      
      const matchesSearch = `${candidate?.full_name || ''} ${recruiter?.display_name || ''} ${req.details || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || req.status === filterStatus;

      // Role-based visibility: recruiter and marketing leader can only see their own requests
      if (user?.role === 'jpc_recruiter' || user?.role === 'jpc_marketing') {
        if (String(req.recruiter_id) !== String(user.id)) return false;
      }

      return matchesSearch && matchesFilter;
    });
  }, [requests, candidates, team, searchTerm, filterStatus, user, activeTab]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.candidate_id || !formData.details) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    const id = generateId();
    const newRequest: ResumePrepRequest = {
      id,
      type: formData.type,
      candidate_id: formData.candidate_id,
      recruiter_id: String(user?.id),
      details: formData.details,
      status: 'pending_resume_team',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'jpc_prep_requests', id), newRequest);
      
      // Notify Resume Team members
      const resumeTeamUsers = team.filter(u => u.role === 'jpc_resume');
      const typeLabel = newRequest.type === 'resume_understanding' ? 'Resume Understanding' : 'Interview Prep Questions';
      const candidateName = candidates.find(c => c.id === newRequest.candidate_id)?.full_name || 'Unknown';
      
      for (const rtMember of resumeTeamUsers) {
        await addNotification({
          recipient_id: rtMember.id,
          sender_id: user?.id || null,
          type: newRequest.type === 'resume_understanding' ? 'resume_understanding_request' : 'interview_question_request',
          message: `New ${typeLabel} request submitted for candidate ${candidateName}`
        }).catch(err => console.error('Notification failed:', err));
      }

      showToast(`${typeLabel} request assigned directly to Resume Team!`, 'success');
      setIsAddModalOpen(false);
      setFormData({ candidate_id: '', details: '', type: activeTab });
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to submit request', 'error');
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionConfig) return;

    const { requestId, type, candidateName, reqType } = actionConfig;
    const finalStatus = type === 'complete' ? 'completed' : 'rejected';

    if (type === 'reject' && !actionNotes) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    let docUrl = '';
    let docFilename = '';

    try {
      // If completing, a file upload is required
      if (type === 'complete') {
        if (!selectedFile) {
          showToast('Please select a PDF or Document to complete the request', 'error');
          setIsUploading(false);
          return;
        }

        setUploadProgress(30);
        const req = requests.find(r => r.id === requestId);
        const cand = candidates.find(c => c.id === req?.candidate_id);

        try {
          docUrl = await uploadFile(selectedFile, {
            name: cand?.full_name || candidateName,
            email: cand?.email || 'N/A',
            phone: cand?.phone || ''
          });
          docFilename = selectedFile.name;
          setUploadProgress(100);
        } catch (uploadError: any) {
          console.error('File upload failed:', uploadError);
          showToast(uploadError.message || 'File upload failed', 'error');
          setIsUploading(false);
          return;
        }
      }

      // Update Firestore Request Doc
      const updateData: any = {
        status: finalStatus,
        updated_at: new Date().toISOString()
      };

      if (actionNotes) {
        updateData.resume_team_notes = actionNotes;
      }
      if (docUrl) {
        updateData.document_url = docUrl;
        updateData.document_filename = docFilename;
      }

      await updateDoc(doc(db, 'jpc_prep_requests', requestId), updateData);

      // Notify the recruiter who requested this
      const reqDoc = requests.find(r => r.id === requestId);
      if (reqDoc) {
        const typeLabel = reqType === 'resume_understanding' ? 'Resume Understanding' : 'Interview Question';
        await addNotification({
          recipient_id: reqDoc.recruiter_id,
          sender_id: user?.id || null,
          type: reqType === 'resume_understanding' ? 'resume_understanding_request' : 'interview_question_request',
          message: `Your ${typeLabel} request for candidate ${candidateName} has been ${finalStatus}!`
        }).catch(err => console.error('Notification failed:', err));
      }

      showToast(`Request successfully marked as ${finalStatus}`, 'success');
      setIsActionModalOpen(false);
      setActionNotes('');
      setSelectedFile(null);
      setActionConfig(null);
    } catch (err: any) {
      console.error('Update request error:', err);
      showToast('An unexpected error occurred during state transition.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (requestId: string) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'jpc_prep_requests', requestId));
      showToast('Prep request deleted successfully', 'success');
      setDeletingId(null);
    } catch (error) {
      console.error('Delete request error:', error);
      showToast('Failed to delete prep request', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const openActionModal = (requestId: string, candidateName: string, type: 'complete' | 'reject', reqType: TabType) => {
    setActionConfig({ requestId, type, candidateName, reqType });
    setActionNotes('');
    setSelectedFile(null);
    setIsActionModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_resume_team': return 'bg-accent-blue/10 text-accent-blue border-accent-blue/20';
      case 'completed': return 'bg-accent-green/10 text-accent-green border-accent-green/20';
      case 'rejected': return 'bg-accent-red/10 text-accent-red border-accent-red/20';
      default: return 'bg-bg-tertiary text-text-secondary border-border-primary';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'pending_resume_team') return 'Pending Resume Team';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight font-heading">
            Resume Understanding & IQ Log
          </h1>
          <p className="text-text-secondary mt-1">
            Manage expert resume evaluations and interview prep deliverables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(user?.role === 'jpc_recruiter' || user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_marketing') && (
            <button 
              onClick={() => {
                setFormData({ candidate_id: '', details: '', type: activeTab });
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 cursor-pointer"
            >
              <Plus className="w-5 h-5 animate-pulse" />
              Generate Request
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border-primary flex gap-6">
        <button
          onClick={() => setActiveTab('resume_understanding')}
          className={cn(
            "pb-4 font-bold text-base relative transition-all flex items-center gap-2",
            activeTab === 'resume_understanding' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <BookOpen className="w-5 h-5" />
          Resume Understanding Requests
          {activeTab === 'resume_understanding' && (
            <motion.div layoutId="prepTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('interview_questions')}
          className={cn(
            "pb-4 font-bold text-base relative transition-all flex items-center gap-2",
            activeTab === 'interview_questions' ? "text-accent-blue" : "text-text-secondary hover:text-text-primary"
          )}
        >
          <HelpCircle className="w-5 h-5" />
          Interview Question Log
          {activeTab === 'interview_questions' && (
            <motion.div layoutId="prepTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-blue" />
          )}
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text"
            placeholder={`Search ${activeTab === 'resume_understanding' ? 'resume analysis' : 'interview logs'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-2xl px-4 py-2">
          <Filter className="w-4 h-4 text-text-muted" />
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-sm font-medium text-text-primary cursor-pointer focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="pending_resume_team">Pending Resume Team</option>
            <option value="completed">Completed</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Request Grid */}
      {isLoading ? (
        <div className="py-24 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredRequests.map((req) => {
              const candidate = candidates.find(c => c.id === req.candidate_id);
              const recruiter = team.find(u => String(u.id) === String(req.recruiter_id));

              return (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="bg-bg-secondary border border-border-primary rounded-3xl p-6 hover:shadow-xl hover:shadow-black/5 transition-all group"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                          getStatusColor(req.status)
                        )}>
                          {getStatusLabel(req.status)}
                        </span>
                        <span className="text-xs text-text-muted font-medium">
                          Created on {new Date(req.created_at).toLocaleDateString()} at {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-text-primary flex items-center gap-2.5">
                          <UserIcon className="w-5 h-5 text-accent-blue" />
                          {candidate?.full_name || 'Unknown Candidate'}
                        </h3>
                        <p className="text-sm text-text-secondary mt-1">
                          Generated by: <span className="font-semibold text-text-primary">{recruiter?.display_name || 'System'}</span>
                        </p>
                      </div>

                      <div className="bg-bg-tertiary rounded-2xl p-4 border border-border-primary/50">
                        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                          {req.details}
                        </p>
                      </div>

                      {req.resume_team_notes && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-accent-green" />
                            Resume Team Response / Notes
                          </span>
                          <div className={cn(
                            "bg-bg-tertiary border rounded-2xl p-4 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap",
                            req.status === 'rejected' ? 'border-accent-red/10 bg-accent-red/5' : 'border-accent-green/10 bg-accent-green/5'
                          )}>
                            {req.resume_team_notes}
                          </div>
                        </div>
                      )}

                      {req.document_url && (
                        <div className="flex items-center gap-2 pt-2">
                          <FileText className="w-5 h-5 text-accent-green" />
                          <span className="text-sm font-bold text-text-primary">Deliverable Document:</span>
                          <button 
                            onClick={() => handleViewFile(req.document_url || '', req.document_filename || 'analysis.pdf')}
                            className="text-sm text-accent-blue hover:underline hover:text-accent-blue/80 flex items-center gap-1.5 font-bold cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {req.document_filename || 'View / Download Evaluation'}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                      {/* Actions for Resume Team role or higher */}
                      {(user?.role === 'jpc_resume' || user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager') && req.status === 'pending_resume_team' && (
                        <>
                          <button 
                            onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'complete', req.type)}
                            className="w-full py-3 bg-accent-green text-white font-bold rounded-xl hover:bg-accent-green/90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent-green/20 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Upload & Complete
                          </button>
                          
                          <button 
                            onClick={() => openActionModal(req.id, candidate?.full_name || 'Candidate', 'reject', req.type)}
                            className="w-full py-3 bg-bg-tertiary text-accent-red font-bold rounded-xl hover:bg-accent-red/10 transition-all flex items-center justify-center gap-2 border border-accent-red/20 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject Request
                          </button>
                        </>
                      )}

                      {/* Completed / Rejected Outcome Label */}
                      {(req.status === 'completed' || req.status === 'rejected') && (
                        <div className="bg-bg-tertiary rounded-2xl border border-border-primary p-4 text-center">
                          {req.status === 'completed' ? (
                            <div className="flex flex-col items-center gap-1.5 text-accent-green">
                              <CheckCircle2 className="w-7 h-7" />
                              <span className="font-bold text-xs">Evaluated & Completed</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-accent-red">
                              <XCircle className="w-7 h-7" />
                              <span className="font-bold text-xs">Reconciliation Rejected</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Admin Delete Option */}
                      {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin') && (
                        <div className="mt-2 pt-2 border-t border-border-primary/40">
                          {deletingId === req.id ? (
                            <div className="space-y-2 bg-accent-red/5 p-2 rounded-xl border border-accent-red/10">
                              <p className="text-[10px] font-bold text-accent-red text-center uppercase tracking-wider">Confirm deletion?</p>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => handleDelete(req.id)}
                                  className="flex-1 py-1.5 bg-accent-red text-white text-[10px] font-bold rounded-lg hover:bg-accent-red/90 transition-all cursor-pointer text-center"
                                >
                                  Yes, Delete
                                </button>
                                <button 
                                  onClick={() => setDeletingId(null)}
                                  className="flex-1 py-1.5 bg-bg-tertiary text-text-primary text-[10px] font-bold rounded-lg hover:bg-bg-tertiary/80 transition-all cursor-pointer text-center border border-border-primary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => setDeletingId(req.id)}
                              className="w-full py-2 bg-accent-red/10 text-accent-red hover:bg-accent-red/20 font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-xs border border-accent-red/20 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete Request
                            </button>
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
            <div className="bg-bg-secondary border border-border-primary border-dashed rounded-3xl p-16 text-center">
              <div className="w-16 h-16 bg-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                {activeTab === 'resume_understanding' ? (
                  <BookOpen className="w-8 h-8 text-text-muted" />
                ) : (
                  <HelpCircle className="w-8 h-8 text-text-muted" />
                )}
              </div>
              <h3 className="text-lg font-bold text-text-primary">No requests found</h3>
              <p className="text-text-secondary mt-1 text-sm max-w-sm mx-auto">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Adjust your query, tags, or status filters and try again.' 
                  : `New ${activeTab === 'resume_understanding' ? 'resume evaluation' : 'interview question'} logs reported by recruiters will show here.`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recruiter Generate Request Modal */}
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
                  <h2 className="text-2xl font-bold text-text-primary tracking-tight font-heading">
                    {formData.type === 'resume_understanding' ? 'Resume Understanding' : 'Interview Question Log'}
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Route directly to the Resume Team for expert analysis.
                  </p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-bg-tertiary rounded-xl transition-colors text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Select Request Type explicitly */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">Request Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as TabType })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium focus:text-text-primary"
                    required
                  >
                    <option value="resume_understanding">Resume Understanding</option>
                    <option value="interview_questions">Interview Questions (Prep log)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">Select Candidate</label>
                  <select 
                    value={formData.candidate_id}
                    onChange={(e) => setFormData({ ...formData, candidate_id: e.target.value })}
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all font-medium focus:text-text-primary"
                    required
                  >
                    <option value="">Select candidate profile...</option>
                    {candidates
                      .filter(c => {
                        if (user?.role === 'jpc_recruiter') {
                          return String(c.assigned_recruiter) === String(user?.id);
                        }
                        if (user?.role === 'jpc_marketing') {
                          return String(c.assigned_marketing_leader) === String(user?.id);
                        }
                        return true;
                      })
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1">Request Details / Instructions</label>
                  <textarea 
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    placeholder={
                      formData.type === 'resume_understanding' 
                        ? 'Describe candidate experience context or specific elements to review (e.g. gaps, skills highlight)...' 
                        : 'Specify target role, company, format format, and any candidate specific constraints...'
                    }
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all min-h-[140px] font-medium text-sm leading-relaxed"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 cursor-pointer"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}

      {/* Action Dialog (Complete / Reject Interface) */}
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
                  <h2 className="text-2xl font-bold text-text-primary tracking-tight font-heading">
                    {actionConfig.type === 'complete' ? 'Upload Analysis File' : 'Reject Evaluation Request'}
                  </h2>
                  <p className="text-text-secondary text-sm mt-1">
                    Candidate: <span className="font-bold text-text-primary">{actionConfig.candidateName}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setIsActionModalOpen(false)}
                  className="p-2 hover:bg-bg-tertiary rounded-xl transition-colors text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleAction} className="space-y-6">
                {actionConfig.type === 'complete' && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-text-primary px-1">Upload Evaluation PDF/Doc</label>
                    <div className="relative">
                      <input 
                        type="file"
                        id="prep-eval-upload"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        required
                      />
                      <label 
                        htmlFor="prep-eval-upload"
                        className={cn(
                          "w-full flex flex-col items-center justify-center gap-3 p-8 bg-bg-tertiary border-2 border-dashed border-border-primary rounded-2xl cursor-pointer hover:bg-bg-tertiary/80 transition-all",
                          selectedFile && "border-accent-green bg-accent-green/5"
                        )}
                      >
                        {selectedFile ? (
                          <>
                            <FileText className="w-10 h-10 text-accent-green" />
                            <div className="text-center">
                              <p className="text-sm font-bold text-text-primary truncate max-w-xs">{selectedFile.name}</p>
                              <p className="text-xs text-text-secondary mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <Upload className="w-10 h-10 text-text-muted group-hover:text-text-primary transition-all" />
                            <div className="text-center">
                              <p className="text-sm font-bold text-text-primary">Click to select deliverable file</p>
                              <p className="text-xs text-text-secondary mt-1">PDF, DOC, DOCX or Image (Max 1MB)</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-text-primary px-1 flex items-center gap-1.5">
                    {actionConfig.type === 'reject' ? 'Reason for Rejection' : 'Notes & Instructions (Optional)'}
                  </label>
                  <textarea 
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder={
                      actionConfig.type === 'reject' 
                        ? 'Details explaining why the request cannot be processed...'
                        : 'Explain key findings or details to assist the recruiter and candidate...'
                    }
                    className="w-full px-4 py-3 bg-bg-tertiary border border-border-primary rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-blue/20 transition-all min-h-[120px] font-medium text-sm leading-relaxed"
                    required={actionConfig.type === 'reject'}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsActionModalOpen(false)}
                    className="flex-1 py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isUploading}
                    className={cn(
                      "flex-1 py-4 text-white font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer",
                      isUploading ? "bg-bg-tertiary text-text-muted cursor-not-allowed" :
                      actionConfig.type === 'reject' ? "bg-accent-red shadow-accent-red/20 hover:bg-accent-red/90" :
                      "bg-accent-green shadow-accent-green/20 hover:bg-accent-green/90"
                    )}
                  >
                    {isUploading ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                          <span>Uploading...</span>
                          <span>{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-accent-green"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      'Submit Deliverable'
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
