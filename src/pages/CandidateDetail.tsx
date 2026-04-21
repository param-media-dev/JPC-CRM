import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  saveCandidate, 
  logActivity, 
  addNotification,
  addPayment, 
  updatePayment,
  addPromise,
  updatePromise,
  updateQCChecklistItem,
  resetQCChecklist,
  addFollowUp,
  updateFollowUp,
  getUserById,
  now,
  deleteCandidate
} from '../services/storage';
import { uploadFile } from '../services/fileService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { STAGES, TRANSITIONS, LEAD_SOURCES } from '../constants';
import { 
  ArrowLeft, 
  Edit2, 
  Save, 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  Linkedin, 
  GraduationCap, 
  Briefcase, 
  Package, 
  CreditCard, 
  MessageSquare, 
  Flag, 
  CheckSquare, 
  Clock, 
  History,
  Plus,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileText,
  Download,
  Upload,
  RotateCcw,
  User as UserIcon,
  ExternalLink,
  Calendar,
  Video,
  TrendingUp,
  ShieldCheck,
  Share2,
  Key,
  Copy,
  Check,
  Image,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import { Candidate, Payment, Promise as PromiseType, QCChecklistItem, FollowUp, ActivityLog, User, Stage, ResumeChangeRequest, Application, InterviewRequest } from '../types';

export const CandidateDetail: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const id = params.get('id');

  const isCandidate = user?.role === 'candidate' || user?.role === 'jpc_candidate';
  const isLeadGen = user?.role === 'jpc_lead_gen';
  const isSalesperson = user?.role === 'jpc_sales';
  const canEdit = !isCandidate && !isLeadGen && !isSalesperson;
  const canEditResume = !isCandidate && !isSalesperson;
  const canEditPackage = !isCandidate;
  const canManagePayments = !isCandidate && !isLeadGen;
  const canManageFollowUps = !isCandidate && !isLeadGen;
  const canManageRemarks = !isCandidate && !isLeadGen;
  const canManageAgreement = user?.role === 'jpc_cs' || user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager';

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [promises, setPromises] = useState<PromiseType[]>([]);
  const [checklist, setChecklist] = useState<QCChecklistItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [resumeRequests, setResumeRequests] = useState<ResumeChangeRequest[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAllData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [
        candData,
        paymentsData,
        checklistData,
        followUpsData,
        activityLogsData,
        appsData,
        interviewsData,
        usersData
      ] = await Promise.all([
        apiService.getCandidate(id),
        apiService.getPayments({ candidate_id: id }),
        // Checklists are often handled by candidate state or specific endpoint
        Promise.resolve([]), 
        apiService.getFollowups({ candidate_id: id }),
        // Activity logs often handled by specific endpoint
        Promise.resolve([]),
        apiService.getApplications({ candidate_id: id }),
        apiService.getInterviews({ candidate_id: id }),
        apiService.getUsers()
      ]);

      if (candData) {
        // Role-based access check
        if (user?.role === 'jpc_recruiter' && String(candData.assigned_recruiter) !== String(user.id)) {
          showToast('Access denied. This candidate is not assigned to you.', 'error');
          window.location.hash = '#candidates';
          return;
        }
        if (user?.role === 'jpc_lead_gen' && String(candData.lead_generated_by) !== String(user.id)) {
          showToast('Access denied. You did not generate this lead.', 'error');
          window.location.hash = '#candidates';
          return;
        }

        setCandidate(candData);
        setPayments(paymentsData.sort((a: any, b: any) => a.part_number - b.part_number));
        setFollowUps(followUpsData);
        setApplications(appsData);
        setInterviews(interviewsData);
        setAllUsers(usersData);
        // setChecklist(checklistData);
      }
    } catch (error) {
      console.error('Failed to fetch candidate details:', error);
      showToast('Failed to load candidate details', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [id, user, showToast]);

  useEffect(() => {
    if (!isAuthReady || !id) return;

    // Security: Candidates can only see their own profile
    if ((user?.role === 'candidate' || user?.role === 'jpc_candidate') && user.candidate_id !== id) {
      showToast('Access denied. Redirecting to your profile.', 'error');
      window.location.hash = `#candidate?id=${user.candidate_id}`;
      return;
    }

    fetchAllData();
  }, [isAuthReady, id, user, fetchAllData]);

  const salesUsers = allUsers.filter(u => u.role === 'jpc_sales');
  const csUsers = allUsers.filter(u => u.role === 'jpc_cs');
  const resumeUsers = allUsers.filter(u => u.role === 'jpc_resume');
  const marketingLeaders = allUsers.filter(u => u.role === 'jpc_marketing');
  const marketingUsers = allUsers.filter(u => u.role === 'jpc_marketing_support' || u.role === 'jpc_marketing');

  // Edit states
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingEducation, setIsEditingEducation] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [isGeneratingAccess, setIsGeneratingAccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  
  const [personalForm, setPersonalForm] = useState<Partial<Candidate>>({});
  const [educationForm, setEducationForm] = useState<Partial<Candidate>>({});
  const [packageForm, setPackageForm] = useState<Partial<Candidate>>({});
  const [remarksForm, setRemarksForm] = useState('');

  const filteredRecruiters = useMemo(() => {
    if (!packageForm.assigned_marketing_leader) return [];
    return allUsers.filter(u => u.role === 'jpc_recruiter' && String(u.leader_id) === String(packageForm.assigned_marketing_leader));
  }, [allUsers, packageForm.assigned_marketing_leader]);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    part_number: 1,
    amount: 0,
    due_date: '',
    payment_method: 'Cash',
    notes: ''
  });

  // Promise form
  const [promiseText, setPromiseText] = useState('');

  // Follow-up form
  const [followUpForm, setFollowUpForm] = useState({
    date: '',
    note: ''
  });

  useEffect(() => {
    if (candidate) {
      setPersonalForm({ ...candidate });
      setEducationForm({ ...candidate });
      setPackageForm({ ...candidate });
      setRemarksForm(candidate.remarks || '');
    }
  }, [candidate]);

  useEffect(() => {
    if ((user?.role === 'administrator' || user?.role === 'jpc_sysadmin') && checklist.length > 0 && (checklist.length !== 8 || !checklist.some(item => item.item_label === 'Candidate indidity Verification'))) {
      resetQCChecklist(id!);
    }
  }, [checklist, id, user]);

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const paymentProgress = (candidate?.package_amount || 0) > 0 ? (totalPaid / (candidate?.package_amount || 1)) * 100 : 0;
  const nextPayment = payments.find(p => p.status === 'pending');

  const combinedLogs = useMemo(() => {
    const logs = activityLogs.map(log => ({
      id: log.id,
      action: log.action,
      details: log.details,
      user_id: log.user_id,
      created_at: log.created_at,
      type: 'activity'
    }));

    const resumeLogs = resumeRequests.map(req => ({
      id: req.id,
      action: 'Resume Change Request',
      details: `Status: ${req.status.replace('_', ' ')}. Details: ${req.details}`,
      user_id: req.recruiter_id,
      created_at: req.created_at,
      type: 'resume'
    }));

    const appLogs = applications.map(app => ({
      id: app.id,
      action: 'Job Application',
      details: `Applied via Link: ${app.job_link}.`,
      user_id: app.recruiter_id,
      created_at: app.created_at,
      type: 'application'
    }));

    const interviewLogs = interviews.map(int => ({
      id: int.id,
      action: 'Interview Support',
      details: `Status: ${int.status.replace('_', ' ')}. ${int.scheduled_at ? `Scheduled: ${new Date(int.scheduled_at).toLocaleString()}` : ''}`,
      user_id: int.proxy_id || int.cs_id,
      created_at: int.created_at,
      type: 'interview'
    }));

    return [...logs, ...resumeLogs, ...appLogs, ...interviewLogs].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [activityLogs, resumeRequests, applications, interviews]);

  const appStats = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dayApps = applications.filter(a => a.applied_at === todayStr);
    const weekApps = applications.filter(a => new Date(a.applied_at) >= startOfWeek);
    const monthApps = applications.filter(a => new Date(a.applied_at) >= startOfMonth);
    
    return {
      day: dayApps.length,
      week: weekApps.length,
      month: monthApps.length,
      lifetime: applications.length
    };
  }, [applications]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-text-primary">Candidate Not Found</h2>
          <a href="#candidates" className="text-accent-blue hover:underline mt-2 block">Back to Candidates</a>
        </div>
      </div>
    );
  }

  const hasPortal = allUsers.some(u => u.candidate_id === candidate.id);

  const generateRandomPassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleGenerateAccess = async () => {
    if (!candidate?.email) {
      showToast('Candidate must have an email address to generate access.', 'error');
      return;
    }

    setIsGeneratingAccess(true);
    const password = generateRandomPassword();

    try {
      // Create user record via REST API
      const newUser: User = {
        username: candidate.email.split('@')[0],
        display_name: candidate.full_name,
        role: 'candidate',
        candidate_id: candidate.id,
      } as User;

      await apiService.createUser(newUser);
      
      setGeneratedPassword(password);
      showToast('Portal access created successfully!', 'success');
      await logActivity(candidate.id, 'Portal access generated', `Login credentials created for ${candidate.email}`, user?.id || null);
    } catch (error: any) {
      console.error('Portal creation error:', error);
      showToast(error.message || 'Failed to create portal access', 'error');
    } finally {
      setIsGeneratingAccess(false);
    }
  };

  const handleSavePersonal = async () => {
    const oldNotes = candidate.notes;
    const newNotes = personalForm.notes;
    
    await saveCandidate({ ...candidate, ...personalForm } as Candidate, user?.id || null);
    
    if (oldNotes !== newNotes) {
      const teamMembers = [candidate.assigned_sales, candidate.assigned_cs, candidate.assigned_recruiter].filter(Boolean);
      for (const memberId of teamMembers) {
        await addNotification({
          recipient_id: memberId as string,
          sender_id: user?.id || null,
          type: 'system_alert',
          message: `Notes for candidate ${candidate.full_name} have been updated.`
        });
      }
    }

    await logActivity(candidate.id, 'Updated personal info', 'Personal information details were updated.', user?.id || null);
    setIsEditingPersonal(false);
    showToast('Personal info updated', 'success');
  };

  const handleSaveEducation = async () => {
    await saveCandidate({ ...candidate, ...educationForm } as Candidate, user?.id || null);
    
    const teamMembers = [candidate.assigned_sales, candidate.assigned_cs, candidate.assigned_recruiter].filter(Boolean);
    for (const memberId of teamMembers) {
      await addNotification({
        recipient_id: memberId as string,
        sender_id: user?.id || null,
        type: 'system_alert',
        message: `Education/Experience for candidate ${candidate.full_name} has been updated.`
      });
    }

    await logActivity(candidate.id, 'Updated education info', 'Education and experience details were updated.', user?.id || null);
    setIsEditingEducation(false);
    showToast('Education info updated', 'success');
  };

  const handleSavePackage = async () => {
    await saveCandidate({ ...candidate, ...packageForm } as Candidate, user?.id || null);
    
    // Check for assignments
    const assignmentFields = ['assigned_cs', 'assigned_resume', 'assigned_marketing_leader', 'assigned_recruiter', 'assigned_marketing', 'assigned_sales'];
    for (const field of assignmentFields) {
      if (packageForm[field as keyof Candidate] !== candidate[field as keyof Candidate] && packageForm[field as keyof Candidate]) {
        await addNotification({
          recipient_id: packageForm[field as keyof Candidate] as string,
          sender_id: user?.id || null,
          type: 'system_alert',
          message: `You have been assigned to candidate ${candidate.full_name}`
        });
      }
    }

    await logActivity(candidate.id, 'Updated package info', 'Package and team assignment details were updated.', user?.id || null);
    setIsEditingPackage(false);
    showToast('Package info updated', 'success');
  };

  const handleSaveRemarks = async () => {
    await saveCandidate({ ...candidate, remarks: remarksForm } as Candidate, user?.id || null);
    await logActivity(candidate.id, 'Updated remarks', 'Candidate remarks were updated.', user?.id || null);
    setIsEditingRemarks(false);
    showToast('Remarks updated', 'success');
  };

  const handlePaymentProofUpload = async (payment: Payment, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('Uploading proof...', 'info');
      const url = await uploadFile(file);
      const updated = {
        ...payment,
        proof_url: url,
        proof_filename: file.name
      };
      await updatePayment(updated);
      await logActivity(candidate!.id, 'Payment proof uploaded', `Proof uploaded for Part ${payment.part_number}`, user?.id || null);
      showToast('Payment proof uploaded', 'success');
    } catch (error) {
      showToast('Failed to upload proof', 'error');
    }
  };

  const handleDownloadResume = () => {
    const resumeUrl = candidate?.resume_url || candidate?.resume_base64;
    if (!resumeUrl) {
      showToast('No resume available for download', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = resumeUrl;
    link.download = candidate.resume_filename || 'resume.pdf';
    link.target = "_blank";
    link.click();
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;

    try {
      showToast('Uploading resume...', 'info');
      const url = await uploadFile(file);
      const updated: Candidate = {
        ...candidate,
        resume_url: url,
        resume_filename: file.name,
        updated_at: new Date().toISOString()
      };
      await saveCandidate(updated, user?.id || null);
      await logActivity(candidate.id, 'Resume updated', `Resume updated to ${file.name}`, user?.id || null);
      showToast('Resume updated successfully', 'success');
    } catch (error) {
      showToast('Failed to upload resume', 'error');
    }
  };

  const handleDownloadAgreement = () => {
    if (!candidate || !candidate.agreement_url) return;
    const link = document.createElement('a');
    link.href = candidate.agreement_url;
    link.download = candidate.agreement_filename || 'agreement.pdf';
    link.target = "_blank";
    link.click();
  };

  const handleAgreementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;

    try {
      showToast('Uploading agreement...', 'info');
      const url = await uploadFile(file);
      const updated: Candidate = {
        ...candidate,
        agreement_url: url,
        agreement_filename: file.name,
        updated_at: new Date().toISOString()
      };
      await saveCandidate(updated, user?.id || null);
      await logActivity(candidate.id, 'Agreement uploaded', `Agreement document uploaded: ${file.name}`, user?.id || null);
      showToast('Agreement uploaded successfully', 'success');
    } catch (error) {
      showToast('Failed to upload agreement', 'error');
    }
  };

  const handleStageMove = async (newStage: Stage) => {
    if (user?.role === 'jpc_cs' && !candidate.agreement_url) {
      showToast('Agreement must be uploaded before moving to another step.', 'error');
      return;
    }

    const oldStageLabel = STAGES[candidate.current_stage].label;
    const newStageLabel = STAGES[newStage].label;
    
    const updated = { 
      ...candidate, 
      current_stage: newStage,
      not_interested_at: newStage === 'not_interested' ? now() : null,
      flags: {
        ...(candidate.flags || {}),
        sla_timeout_notified: false
      }
    };
    
    await saveCandidate(updated, user?.id || null);
    
    const teamMembers = [candidate.assigned_sales, candidate.assigned_cs, candidate.assigned_recruiter].filter(Boolean);
    for (const memberId of teamMembers) {
      await addNotification({
        recipient_id: memberId as string,
        sender_id: user?.id || null,
        type: 'system_alert',
        message: `Candidate ${candidate.full_name} moved from ${oldStageLabel} to ${newStageLabel}.`
      });
    }

    await logActivity(candidate.id, 'Stage moved', `Moved from ${oldStageLabel} to ${newStageLabel}`, user?.id || null);
    showToast(`Moved to ${newStageLabel}`, 'success');
  };

  const handleToggleFlag = async (flag: keyof Candidate['flags']) => {
    const updated = {
      ...candidate,
      flags: { ...candidate.flags, [flag]: !candidate.flags[flag] }
    };
    await saveCandidate(updated, user?.id || null);
    await logActivity(candidate.id, 'Flag toggled', `Flag '${flag.replace(/_/g, ' ')}' was toggled.`, user?.id || null);
  };

  const handleCheckQC = async (item: QCChecklistItem) => {
    await updateQCChecklistItem({ ...item, checked: !item.checked });
    await logActivity(candidate.id, 'QC Item toggled', `QC Item '${item.item_label}' was toggled.`, user?.id || null);
  };

  const handleUpdateQCValue = async (item: QCChecklistItem, value: string) => {
    await updateQCChecklistItem({ ...item, value });
  };

  const handleResetChecklist = async () => {
    if (!candidate) return;
    if (window.confirm('This will delete current checklist items and reset to the new 8-item checklist. Continue?')) {
      await resetQCChecklist(candidate.id);
      await logActivity(candidate.id, 'QC Checklist Reset', 'Checklist was reset to the new 8-item format.', user?.id || null);
      showToast('Checklist reset successfully', 'success');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || !paymentForm.due_date) {
      showToast('Amount and Due Date are required', 'error');
      return;
    }
    await addPayment({
      candidate_id: candidate.id,
      part_number: Number(paymentForm.part_number),
      amount: Number(paymentForm.amount),
      due_date: paymentForm.due_date,
      paid_on: null,
      status: 'pending',
      receipt_number: `RCP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      payment_method: paymentForm.payment_method,
      notes: paymentForm.notes,
      created_by: user?.id || null
    });
    await logActivity(candidate.id, 'Payment plan added', `Added Part ${paymentForm.part_number} for ₹${paymentForm.amount}`, user?.id || null);
    showToast('Payment plan added', 'success');
    setPaymentForm({ part_number: payments.length + 2, amount: 0, due_date: '', payment_method: 'Cash', notes: '' });
  };

  const handleMarkPaid = async (payment: Payment) => {
    await updatePayment({ ...payment, status: 'paid', paid_on: now() });
    await logActivity(candidate.id, 'Payment received', `Part ${payment.part_number} (₹${payment.amount}) marked as paid.`, user?.id || null);
    showToast('Payment marked as paid', 'success');
  };

  const handleAddPromise = async () => {
    if (!promiseText) return;
    await addPromise({
      candidate_id: candidate.id,
      promise_text: promiseText,
      made_by: user?.id || null,
      stage: candidate.current_stage,
      status: 'active'
    });
    await logActivity(candidate.id, 'Promise made', `New promise: ${promiseText}`, user?.id || null);
    setPromiseText('');
    showToast('Promise added', 'success');
  };

  const handleAddFollowUp = async () => {
    if (!followUpForm.date || !followUpForm.note) return;
    await addFollowUp({
      candidate_id: candidate!.id,
      stage: candidate!.current_stage,
      followup_date: followUpForm.date,
      note: followUpForm.note,
      done: false,
      created_by: user?.id || null
    });
    await logActivity(candidate!.id, 'Follow-up scheduled', `Scheduled for ${followUpForm.date}`, user?.id || null);
    setFollowUpForm({ date: '', note: '' });
    showToast('Follow-up scheduled', 'success');
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Password Modal */}
      <AnimatePresence>
        {generatedPassword && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary border border-border-primary rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-accent-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="w-8 h-8 text-accent-green" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-2">Access Generated!</h3>
                <p className="text-text-secondary mb-8">Copy these credentials and share them with the candidate. They can now log in directly.</p>
                
                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary text-left">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Email Address</p>
                    <p className="text-sm font-mono text-text-primary">{candidate.email}</p>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary text-left relative group">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Generated Password</p>
                    <p className="text-sm font-mono text-text-primary">{generatedPassword}</p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword);
                        showToast('Password copied!', 'success');
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-accent-blue transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      const message = `Hello ${candidate.full_name}, your portal is ready!\n\nLogin at: ${window.location.origin}\nEmail: ${candidate.email}\nPassword: ${generatedPassword}\n\nPlease change your password after logging in.`;
                      navigator.clipboard.writeText(message);
                      showToast('Full message copied to clipboard!', 'success');
                    }}
                    className="w-full py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
                  >
                    <Copy className="w-5 h-5" />
                    Copy Full Invite
                  </button>
                  <button 
                    onClick={() => setGeneratedPassword(null)}
                    className="w-full py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <a href="#candidates" className="p-2 bg-bg-secondary border border-border-primary rounded-xl text-text-secondary hover:text-text-primary transition-all">
            <ArrowLeft className="w-5 h-5" />
          </a>
          <div>
            <h1 className="text-3xl font-bold text-text-primary">{candidate.full_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Phone className="w-4 h-4" /> {candidate.phone}
              </span>
              <span className="w-1 h-1 bg-text-muted rounded-full" />
              <span className="flex items-center gap-1.5 text-sm text-text-secondary">
                <Mail className="w-4 h-4" /> {candidate.email || 'No email'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'administrator' && (
            <button 
              onClick={async () => {
                if (window.confirm("CRITICAL WARNING: This will permanently delete this candidate and all associated data (interviews, payments, etc.). Are you absolutely sure?")) {
                  try {
                    await deleteCandidate(candidate.id);
                    showToast('Candidate completely deleted', 'success');
                    window.location.hash = '#candidates';
                  } catch (err) {
                    showToast('Error deleting candidate', 'error');
                  }
                }
              }}
              className="px-4 py-2 rounded-xl border border-accent-red/20 bg-accent-red/5 flex items-center gap-2 text-accent-red hover:bg-accent-red/10 transition-all shadow-sm"
              title="Delete candidate completely"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Delete</span>
            </button>
          )}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager') && (
            <button 
              onClick={async () => {
                const updated = { 
                  ...candidate,
                  updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
                  flags: {
                    ...(candidate.flags || {}),
                    sla_timeout_notified: false
                  }
                };
                await saveCandidate(updated, user?.id || null);
                showToast('Time limit simulated! SLA Monitor will trigger within 60 seconds.', 'success');
              }}
              className="px-4 py-2 rounded-xl border border-accent-purple/20 bg-accent-purple/5 flex items-center gap-2 text-accent-purple hover:bg-accent-purple/10 transition-all shadow-sm"
              title="Test the 2.5 hour SLA Warning system"
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Test SLA Timeout</span>
            </button>
          )}
          {hasPortal ? (
            <div className="px-4 py-2 rounded-xl border border-accent-green/20 bg-accent-green/5 flex items-center gap-2 text-accent-green">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Portal Active</span>
            </div>
          ) : (
            !isCandidate && !isLeadGen && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleGenerateAccess}
                  disabled={isGeneratingAccess}
                  className="px-4 py-2 rounded-xl border border-accent-amber/20 bg-accent-amber/5 flex items-center gap-2 text-accent-amber hover:bg-accent-amber/10 transition-all disabled:opacity-50"
                >
                  {isGeneratingAccess ? (
                    <div className="w-4 h-4 border-2 border-accent-amber/30 border-t-accent-amber rounded-full animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">Generate Access</span>
                </button>
                <button 
                  onClick={() => {
                    const signupUrl = window.location.origin;
                    const message = `Hello ${candidate.full_name}, your portal is ready. Please log in at ${signupUrl} using your email: ${candidate.email}`;
                    navigator.clipboard.writeText(message);
                    showToast('Invite message copied to clipboard!', 'success');
                  }}
                  className="px-4 py-2 rounded-xl border border-border-primary bg-bg-secondary flex items-center gap-2 text-text-secondary hover:text-accent-blue hover:border-accent-blue transition-all"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Invite</span>
                </button>
              </div>
            )
          )}
          <div className="px-4 py-2 rounded-xl border border-border-primary bg-bg-secondary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGES[candidate.current_stage].color }} />
            <span className="text-sm font-bold text-text-primary uppercase tracking-wider">
              {STAGES[candidate.current_stage].label}
            </span>
          </div>
        </div>
      </div>

      {/* Next Payment Alert */}
      {nextPayment && (
        <div className="bg-accent-amber/10 border border-accent-amber/20 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-accent-amber/20 rounded-full flex items-center justify-center text-accent-amber">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-accent-amber">Next Payment Due</p>
            <p className="text-sm text-accent-amber/80">
              ₹{nextPayment.amount.toLocaleString()} is due on {new Date(nextPayment.due_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}

      {/* Stage Move Bar */}
      {(canEdit || isSalesperson) && (
        <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-widest mr-2">Move to Stage:</span>
            {TRANSITIONS[candidate.current_stage].map(stageKey => {
              const isDisabled = user?.role === 'jpc_cs' && !candidate.agreement_url;
              return (
                <button
                  key={stageKey}
                  onClick={() => handleStageMove(stageKey as Stage)}
                  disabled={isDisabled}
                  className={cn(
                    "px-4 py-2 bg-bg-tertiary border border-border-primary rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                    isDisabled ? "opacity-50 cursor-not-allowed text-text-muted" : "text-text-primary hover:border-accent-blue hover:text-accent-blue"
                  )}
                >
                  {STAGES[stageKey as Stage].icon} {STAGES[stageKey as Stage].label.split('. ')[1] || STAGES[stageKey as Stage].label}
                  <ArrowRight className="w-4 h-4" />
                </button>
              );
            })}
            {candidate.current_stage !== 'not_interested' && (
              <button
                onClick={() => handleStageMove('not_interested')}
                className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-all ml-auto"
              >
                Not Interested
              </button>
            )}
          </div>
          {user?.role === 'jpc_cs' && !candidate.agreement_url && (
            <div className="text-xs text-rose-500 flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4" />
              You must upload the Candidate Agreement before moving the candidate to the next stage.
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 space-y-8">
          {/* Resume Section */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-purple" />
                Candidate Resume
              </h3>
              <div className="flex items-center gap-2">
                {candidate.resume_url || candidate.resume_base64 ? (
                  <button 
                    onClick={handleDownloadResume}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-purple/10 text-accent-purple font-bold rounded-xl hover:bg-accent-purple hover:text-white transition-all text-xs"
                  >
                    <Download className="w-4 h-4" />
                    Download Resume
                  </button>
                ) : null}
                {(canEditResume || isSalesperson) && (
                  <label className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-border-primary text-text-primary font-bold rounded-xl hover:border-accent-purple hover:text-accent-purple transition-all text-xs cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {candidate.resume_url || candidate.resume_base64 ? 'Update Resume' : 'Upload Resume'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleResumeUpload} />
                  </label>
                )}
              </div>
            </div>
            <div className="p-6">
              {candidate.resume_url || candidate.resume_base64 ? (
                <div className="flex items-center gap-4 p-4 bg-bg-tertiary rounded-2xl border border-border-primary">
                  <div className="w-12 h-12 bg-accent-purple/10 rounded-xl flex items-center justify-center text-accent-purple">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">{candidate.resume_filename || 'resume.pdf'}</p>
                    <p className="text-xs text-text-muted font-bold uppercase">Uploaded on {new Date(candidate.updated_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleDownloadResume}
                      className="p-2 text-text-secondary hover:text-accent-purple hover:bg-accent-purple/10 rounded-lg transition-all"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    {(candidate.resume_url || candidate.resume_base64) && (
                      <a 
                        href={candidate.resume_url || candidate.resume_base64 || '#'} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-all"
                        title="View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-border-primary rounded-2xl">
                  <FileText className="w-12 h-12 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-secondary">No resume uploaded yet</p>
                </div>
              )}
            </div>
            {resumeRequests.filter(r => r.status === 'completed' && (r.resume_url || r.resume_base64)).length > 0 && (
              <div className="px-6 py-4 bg-bg-tertiary/30 border-t border-border-primary">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3">Resume History</p>
                <div className="space-y-2">
                  {resumeRequests.filter(r => r.status === 'completed' && (r.resume_url || r.resume_base64)).map((req, idx) => (
                    <div key={req.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-3 h-3 text-text-muted" />
                        <span className="text-text-secondary">Version {idx + 1} ({new Date(req.updated_at).toLocaleDateString()})</span>
                      </div>
                      <a 
                        href={req.resume_url || req.resume_base64!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent-purple hover:underline font-medium"
                      >
                        View / Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Agreement Section */}
          {canManageAgreement && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm mt-8">
              <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-accent-blue" />
                  Candidate Agreement
                </h3>
                <div className="flex items-center gap-2">
                  {candidate.agreement_url ? (
                    <button 
                      onClick={handleDownloadAgreement}
                      className="flex items-center gap-2 px-4 py-2 bg-accent-blue/10 text-accent-blue font-bold rounded-xl hover:bg-accent-blue hover:text-white transition-all text-xs"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  ) : null}
                  <label className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary border border-border-primary text-text-primary font-bold rounded-xl hover:border-accent-blue hover:text-accent-blue transition-all text-xs cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {candidate.agreement_url ? 'Update Agreement' : 'Upload Agreement'}
                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleAgreementUpload} />
                  </label>
                </div>
              </div>
              <div className="p-6">
                {candidate.agreement_url ? (
                  <div className="flex items-center gap-4 p-4 bg-bg-tertiary rounded-2xl border border-border-primary">
                    <div className="w-12 h-12 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">{candidate.agreement_filename || 'agreement.pdf'}</p>
                      <p className="text-xs text-text-muted font-bold uppercase">Uploaded securely</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleDownloadAgreement}
                        className="p-2 text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-all"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <a 
                        href={candidate.agreement_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-all"
                        title="View"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 border-2 border-dashed border-border-primary rounded-2xl">
                    <ShieldCheck className="w-12 h-12 text-text-muted mx-auto mb-2" />
                    <p className="text-sm text-text-secondary">No agreement uploaded yet</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Personal Info */}
          {!isSalesperson && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-accent-blue" />
                Personal Information
              </h3>
              {canEdit && (
                <button 
                  onClick={() => isEditingPersonal ? handleSavePersonal() : setIsEditingPersonal(true)}
                  className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
                >
                  {isEditingPersonal ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </button>
              )}
            </div>
            <div className="p-6">
              {isEditingPersonal ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Phone</label>
                    <input type="text" value={personalForm.phone || ''} onChange={e => setPersonalForm({...personalForm, phone: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">WhatsApp</label>
                    <input type="text" value={personalForm.whatsapp || ''} onChange={e => setPersonalForm({...personalForm, whatsapp: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Email</label>
                    <input type="email" value={personalForm.email || ''} onChange={e => setPersonalForm({...personalForm, email: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Location</label>
                    <input type="text" value={personalForm.location || ''} onChange={e => setPersonalForm({...personalForm, location: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">LinkedIn URL</label>
                    <input type="text" value={personalForm.linkedin_url || ''} onChange={e => setPersonalForm({...personalForm, linkedin_url: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Lead Source</label>
                    <select value={personalForm.lead_source || ''} onChange={e => setPersonalForm({...personalForm, lead_source: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Phone / WhatsApp</p>
                    <p className="text-text-primary font-medium">{candidate.phone} / {candidate.whatsapp || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Email Address</p>
                    <p className="text-text-primary font-medium">{candidate.email || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Location</p>
                    <p className="text-text-primary font-medium">{candidate.location || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">LinkedIn Profile</p>
                    {candidate.linkedin_url ? (
                      <a href={candidate.linkedin_url} target="_blank" rel="noreferrer" className="text-accent-blue hover:underline flex items-center gap-1">
                        View Profile <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : <p className="text-text-muted italic">Not provided</p>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Lead Source</p>
                    <p className="text-text-primary font-medium">{candidate.lead_source}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Generated By</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.lead_generated_by)?.display_name || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Education & Experience */}
          {!isSalesperson && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-accent-purple" />
                Education & Experience
              </h3>
              {canEdit && (
                <button 
                  onClick={() => isEditingEducation ? handleSaveEducation() : setIsEditingEducation(true)}
                  className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
                >
                  {isEditingEducation ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </button>
              )}
            </div>
            <div className="p-6">
              {isEditingEducation ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Education Level</label>
                    <input type="text" value={educationForm.education || ''} onChange={e => setEducationForm({...educationForm, education: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Degree</label>
                    <input type="text" value={educationForm.degree || ''} onChange={e => setEducationForm({...educationForm, degree: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">University</label>
                    <input type="text" value={educationForm.university || ''} onChange={e => setEducationForm({...educationForm, university: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Graduation Year</label>
                    <input type="text" value={educationForm.graduation_year || ''} onChange={e => setEducationForm({...educationForm, graduation_year: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Experience Years</label>
                    <input type="text" value={educationForm.experience_years || ''} onChange={e => setEducationForm({...educationForm, experience_years: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Skills</label>
                    <textarea value={educationForm.skills || ''} onChange={e => setEducationForm({...educationForm, skills: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm min-h-[80px]" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Education</p>
                    <p className="text-text-primary font-medium">{candidate.education || '—'} {candidate.degree ? `(${candidate.degree})` : ''}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">University</p>
                    <p className="text-text-primary font-medium">{candidate.university || '—'} {candidate.graduation_year ? `[${candidate.graduation_year}]` : ''}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Experience</p>
                    <p className="text-text-primary font-medium">{candidate.experience_years ? `${candidate.experience_years} Years` : 'Fresher'}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Skills</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {candidate.skills ? candidate.skills.split(',').map(s => (
                        <span key={s} className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary">
                          {s.trim()}
                        </span>
                      )) : <p className="text-text-muted italic text-sm">No skills listed</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Package & Team */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-teal" />
                Package & Team Assignment
              </h3>
              {canEditPackage && (
                <button 
                  onClick={() => isEditingPackage ? handleSavePackage() : setIsEditingPackage(true)}
                  className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
                >
                  {isEditingPackage ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                </button>
              )}
            </div>
            <div className="p-6">
              {isEditingPackage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(!isLeadGen || isSalesperson) && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Package Name</label>
                        <input type="text" value={packageForm.package_name || ''} onChange={e => setPackageForm({...packageForm, package_name: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Package Amount (₹)</label>
                        <input type="number" value={packageForm.package_amount || 0} onChange={e => setPackageForm({...packageForm, package_amount: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Sales</label>
                    <select value={packageForm.assigned_sales || ''} onChange={e => setPackageForm({...packageForm, assigned_sales: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      <option value="">Select Sales</option>
                      {salesUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                  {(!isLeadGen || isSalesperson) && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-text-muted uppercase">Assigned CS</label>
                      <select value={packageForm.assigned_cs || ''} onChange={e => setPackageForm({...packageForm, assigned_cs: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                        <option value="">Select CS</option>
                        {csUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                      </select>
                    </div>
                  )}
                  {!isLeadGen && !isSalesperson && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Resume</label>
                        <select value={packageForm.assigned_resume || ''} onChange={e => setPackageForm({...packageForm, assigned_resume: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                          <option value="">Select Resume Team</option>
                          {resumeUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Marketing Leader (TL)</label>
                        <select 
                          value={packageForm.assigned_marketing_leader || ''} 
                          onChange={e => setPackageForm({...packageForm, assigned_marketing_leader: e.target.value, assigned_recruiter: null})} 
                          className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Select Marketing Leader</option>
                          {marketingLeaders.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Recruiter</label>
                        <select 
                          value={packageForm.assigned_recruiter || ''} 
                          onChange={e => setPackageForm({...packageForm, assigned_recruiter: e.target.value})} 
                          className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm"
                          disabled={!packageForm.assigned_marketing_leader}
                        >
                          <option value="">Select Recruiter</option>
                          {filteredRecruiters.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Marketing</label>
                        <select value={packageForm.assigned_marketing || ''} onChange={e => setPackageForm({...packageForm, assigned_marketing: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                          <option value="">Select Marketing</option>
                          {marketingUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Profiles Count (Target Multiplier)</label>
                        <input type="number" value={packageForm.profiles_count || 1} onChange={e => setPackageForm({...packageForm, profiles_count: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  {(!isLeadGen || isSalesperson) && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Package Name</p>
                        <p className="text-text-primary font-bold">{candidate.package_name || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Amount</p>
                        <p className="text-text-primary font-bold text-lg">₹{candidate.package_amount.toLocaleString()}</p>
                      </div>
                    </>
                  )}
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned Sales</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_sales)?.display_name || '—'}</p>
                  </div>
                  {(!isLeadGen || isSalesperson) && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">CS Representative</p>
                      <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_cs)?.display_name || '—'}</p>
                    </div>
                  )}
                  {!isLeadGen && !isSalesperson && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Resume Specialist</p>
                        <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_resume)?.display_name || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Marketing Leader (TL)</p>
                        <p className="text-text-primary font-medium">{allUsers.find(u => String(u.id) === String(candidate.assigned_marketing_leader))?.display_name || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned Recruiter</p>
                        <p className="text-text-primary font-medium">{allUsers.find(u => String(u.id) === String(candidate.assigned_recruiter))?.display_name || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Marketing Support</p>
                        <p className="text-text-primary font-medium">{allUsers.find(u => String(u.id) === String(candidate.assigned_marketing))?.display_name || '—'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Profiles Count</p>
                        <p className="text-text-primary font-bold">{candidate.profiles_count || 1}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Payments */}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || isSalesperson) && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-accent-green" />
                  Payments
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-secondary">₹{totalPaid} / ₹{candidate.package_amount}</span>
                  <div className="w-24 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                    <div className="h-full bg-accent-green" style={{ width: `${Math.min(paymentProgress, 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Payment List */}
                <div className="space-y-3">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center font-bold text-xs">
                          #{p.part_number}
                        </div>
                        <div>
                          <p className="font-bold text-text-primary">₹{p.amount.toLocaleString()}</p>
                          <p className="text-[10px] text-text-muted uppercase font-bold">Due: {new Date(p.due_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.status === 'paid' ? (
                          <>
                            <span className="text-[10px] px-2 py-1 bg-accent-green/10 text-accent-green font-bold rounded-full uppercase">Paid</span>
                            <div className="flex items-center gap-2">
                              <a 
                                href={`#receipt?pay_id=${p.id}&cand_id=${candidate.id}`}
                                className="p-2 text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-all"
                                title="View Receipt"
                              >
                                <FileText className="w-4 h-4" />
                              </a>
                              {p.proof_url || p.proof_base64 ? (
                                <a 
                                  href={p.proof_url || p.proof_base64 || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-2 text-text-secondary hover:text-accent-purple hover:bg-accent-purple/10 rounded-lg transition-all"
                                  title="View Proof"
                                >
                                  <Image className="w-4 h-4" />
                                </a>
                              ) : null}
                              {canManagePayments && (
                                <label className="p-2 text-text-secondary hover:text-accent-purple hover:bg-accent-purple/10 rounded-lg transition-all cursor-pointer" title="Upload Proof">
                                  <Upload className="w-4 h-4" />
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePaymentProofUpload(p, e)} />
                                </label>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] px-2 py-1 bg-accent-amber/10 text-accent-amber font-bold rounded-full uppercase">Pending</span>
                            <div className="flex items-center gap-2">
                              {canManagePayments && (
                                <button 
                                  onClick={() => handleMarkPaid(p)}
                                  className="px-3 py-1 bg-accent-green text-white text-xs font-bold rounded-lg hover:bg-accent-green/90 transition-all"
                                >
                                  Mark Paid
                                </button>
                              )}
                              {canManagePayments && (
                                <label className="p-2 text-text-secondary hover:text-accent-purple hover:bg-accent-purple/10 rounded-lg transition-all cursor-pointer" title="Upload Proof">
                                  <Upload className="w-4 h-4" />
                                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePaymentProofUpload(p, e)} />
                                </label>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Payment Form */}
                {canManagePayments && (
                  <form onSubmit={handleAddPayment} className="pt-6 border-t border-border-primary">
                    <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Add Payment Plan</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Part #</label>
                        <select value={paymentForm.part_number} onChange={e => setPaymentForm({...paymentForm, part_number: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                          {[1,2].map(n => <option key={n} value={n}>Part {n}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Amount</label>
                        <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Due Date</label>
                        <input type="date" value={paymentForm.due_date} onChange={e => setPaymentForm({...paymentForm, due_date: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className="w-full h-[38px] bg-bg-tertiary border border-border-primary rounded-lg text-text-primary hover:bg-accent-blue hover:text-white hover:border-accent-blue transition-all font-bold text-xs">
                          Add Plan
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </section>
          )}

          {/* Promises */}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || isSalesperson) && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent-amber" />
                  Promises Made
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  {promises.map(p => (
                    <div key={p.id} className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                      <p className="text-sm text-text-primary font-medium">"{p.promise_text}"</p>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-text-muted">By {allUsers.find(u => u.id === p.made_by)?.display_name}</span>
                          <span className="w-1 h-1 bg-text-muted rounded-full" />
                          <span className="text-[10px] text-text-muted uppercase font-bold">{STAGES[p.stage as Stage]?.label.split('. ')[1]}</span>
                        </div>
                        {!isCandidate && !isLeadGen ? (
                          <select 
                            value={p.status} 
                            onChange={async (e) => {
                              await updatePromise({...p, status: e.target.value as any});
                              await logActivity(candidate.id, 'Promise status updated', `Promise status changed to ${e.target.value}`, user?.id || null);
                            }}
                            className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded-lg bg-bg-secondary border border-border-primary focus:outline-none",
                              p.status === 'fulfilled' ? "text-accent-green" : p.status === 'broken' ? "text-accent-red" : "text-accent-amber"
                            )}
                          >
                            <option value="active">Active</option>
                            <option value="fulfilled">Fulfilled</option>
                            <option value="broken">Broken</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-bold uppercase px-2 py-1 rounded-lg",
                            p.status === 'fulfilled' ? "text-accent-green bg-accent-green/10" : p.status === 'broken' ? "text-accent-red bg-accent-red/10" : "text-accent-amber bg-accent-amber/10"
                          )}>
                            {p.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={promiseText}
                      onChange={e => setPromiseText(e.target.value)}
                      placeholder="Type a promise made to the candidate..."
                      className="flex-1 bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-amber transition-colors"
                    />
                    <button 
                      onClick={handleAddPromise}
                      className="px-4 py-2 bg-accent-amber text-white font-bold rounded-xl hover:bg-accent-amber/90 transition-all shadow-lg shadow-accent-amber/20"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 space-y-8">
          {/* Status Flags */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Flag className="w-5 h-5 text-accent-red" />
                Status Flags
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {[
                {
                  title: 'CS Team',
                  flags: [
                    { key: 'agreement_sent', label: 'Agreement Sent' },
                    { key: 'agreement_signed', label: 'Agreement Signed' },
                    { key: 'qc_checklist_done', label: 'QC Checklist Done' },
                  ]
                },
                {
                  title: 'Resume Team',
                  flags: [
                    { key: 'resume_approved', label: 'Team Leader Approved Resume' },
                    { key: 'candidate_resume_approved', label: 'Candidate Approved Resume' },
                  ]
                },
                {
                  title: 'System Admin',
                  flags: [
                    { key: 'marketing_email_created', label: 'Marketing Email Created' },
                    { key: 'two_step_verification', label: 'Added Two Step Verification' },
                  ]
                },
                {
                  title: 'Marketing Team',
                  flags: [
                    { key: 'linkedin_optimized', label: 'LinkedIn Profile Optimization' },
                  ]
                }
              ].map((group) => (
                <div key={group.title} className="space-y-3">
                  <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest border-b border-border-primary pb-1">
                    {group.title}
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    {group.flags.map((flag) => (
                      <label key={flag.key} className="flex items-center justify-between group cursor-pointer">
                        <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                          {flag.label}
                        </span>
                        <div 
                          onClick={() => canEdit && handleToggleFlag(flag.key as keyof Candidate['flags'])}
                          className={cn(
                            "w-10 h-5 rounded-full relative transition-all duration-300",
                            isCandidate ? "cursor-default" : "cursor-pointer",
                            candidate.flags[flag.key as keyof Candidate['flags']] ? "bg-accent-green" : "bg-bg-tertiary border border-border-primary"
                          )}
                        >
                          <div className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
                            candidate.flags[flag.key as keyof Candidate['flags']] ? "left-5.5" : "left-0.5"
                          )} />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Onboarding Success Message */}
              {[
                'agreement_sent',
                'agreement_signed',
                'qc_checklist_done',
                'resume_approved',
                'candidate_resume_approved',
                'marketing_email_created',
                'two_step_verification',
                'linkedin_optimized'
              ].every(key => candidate.flags[key as keyof Candidate['flags']] === true) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 p-4 bg-accent-green/10 border border-accent-green/20 rounded-xl flex items-center gap-3 text-accent-green"
                >
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <p className="font-bold">Candidate onboarded successfully!</p>
                </motion.div>
              )}
            </div>
          </section>

          {/* QC Checklist */}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs') && !isSalesperson && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-accent-blue" />
                  QC Call Checklist
                </h3>
              </div>
              <div className="p-6 space-y-4">
                {checklist.map(item => (
                  <div key={item.id} className="space-y-2">
                    <label className="flex items-center gap-3 group cursor-pointer">
                      <div 
                        onClick={() => canEdit && handleCheckQC(item)}
                        className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all",
                          item.checked ? "bg-accent-blue border-accent-blue" : "bg-bg-tertiary border-border-primary group-hover:border-accent-blue",
                          isCandidate && "cursor-default"
                        )}
                      >
                        {item.checked && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className={cn(
                        "text-sm transition-colors",
                        item.checked ? "text-text-primary font-medium" : "text-text-secondary"
                      )}>
                        {item.item_label}
                      </span>
                    </label>
                    {item.has_text_box && (
                      <div className="ml-8">
                        <input
                          type="text"
                          value={item.value || ''}
                          onChange={(e) => canEdit && handleUpdateQCValue(item, e.target.value)}
                          readOnly={isCandidate}
                          placeholder={isCandidate ? '' : `Enter ${item.item_label.toLowerCase()} details...`}
                          className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Follow-Ups */}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || isSalesperson) && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border-primary">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent-amber" />
                  Follow-Ups
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  {followUps.filter(f => !f.done).map(f => (
                    <div key={f.id} className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-accent-amber flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" /> {f.followup_date}
                        </span>
                        {canManageFollowUps && (
                          <button 
                            onClick={async () => {
                              await updateFollowUp({...f, done: true});
                              await logActivity(candidate.id, 'Follow-up completed', `Note: ${f.note}`, user?.id || null);
                            }}
                            className="text-[10px] font-bold text-text-muted hover:text-accent-green uppercase transition-colors"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-text-primary">{f.note}</p>
                    </div>
                  ))}
                </div>
                {canManageFollowUps && (
                  <div className="space-y-3 pt-4 border-t border-border-primary">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Schedule New</p>
                    <input 
                      type="date" 
                      value={followUpForm.date}
                      onChange={e => setFollowUpForm({...followUpForm, date: e.target.value})}
                      className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-amber transition-colors"
                    />
                    <textarea 
                      value={followUpForm.note}
                      onChange={e => setFollowUpForm({...followUpForm, note: e.target.value})}
                      placeholder="Follow-up note..."
                      className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-amber transition-colors min-h-[80px]"
                    />
                    <button 
                      onClick={handleAddFollowUp}
                      className="w-full py-2 bg-accent-amber text-white font-bold rounded-xl hover:bg-accent-amber/90 transition-all shadow-lg shadow-accent-amber/20"
                    >
                      Schedule Follow-Up
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Remarks Section */}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || isSalesperson) && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-accent-purple" />
                  Remarks
                </h3>
                {canManageRemarks && (
                  <button 
                    onClick={() => isEditingRemarks ? handleSaveRemarks() : setIsEditingRemarks(true)}
                    className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
                  >
                    {isEditingRemarks ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
                  </button>
                )}
              </div>
              <div className="p-6">
                {isEditingRemarks ? (
                  <div className="space-y-4">
                    <textarea 
                      value={remarksForm}
                      onChange={e => setRemarksForm(e.target.value)}
                      placeholder="Add candidate remarks..."
                      className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-purple transition-colors min-h-[120px]"
                    />
                    <button 
                      onClick={handleSaveRemarks}
                      className="w-full py-2 bg-accent-purple text-white font-bold rounded-xl hover:bg-accent-purple/90 transition-all shadow-lg shadow-accent-purple/20"
                    >
                      Save Remarks
                    </button>
                  </div>
                ) : (
                  <div className="bg-bg-tertiary/50 border border-border-primary rounded-xl p-4">
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{candidate.remarks || 'No remarks added yet.'}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Interview History */}
          {!isSalesperson && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Video className="w-5 h-5 text-accent-red" />
                Interview History
              </h3>
              <a href="#interviews" className="text-xs font-bold text-accent-blue hover:underline">View All</a>
            </div>
            <div className="p-6 space-y-4">
              {interviews.length > 0 ? (
                interviews.map(int => (
                  <div key={int.id} className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                        int.status === 'live' ? "bg-accent-red/10 text-accent-red border-accent-red/20" : "bg-bg-tertiary text-text-muted border-border-primary"
                      )}>
                        {int.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-text-muted font-medium">
                        {new Date(int.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {int.scheduled_at && (
                      <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-accent-blue" />
                        {new Date(int.scheduled_at).toLocaleString()}
                      </p>
                    )}
                    {int.feedback && (
                      <p className="text-xs text-text-secondary italic line-clamp-2">"{int.feedback}"</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-text-muted italic">No interviews recorded</p>
                </div>
              )}
            </div>
          </section>
          )}

          {/* Application Performance */}
          {!isSalesperson && (
            <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent-blue" />
                Application Performance
              </h3>
              <a href="#app-tracker" className="text-xs font-bold text-accent-blue hover:underline">Tracker</a>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Today</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{appStats.day}</p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">This Week</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{appStats.week}</p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">This Month</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{appStats.month}</p>
                </div>
                <div className="p-4 bg-bg-tertiary/50 border border-border-primary rounded-xl">
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Lifetime</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{appStats.lifetime}</p>
                </div>
              </div>
              
              {/* Daily Target Progress */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Daily Target Progress</p>
                  <p className="text-xs font-bold text-text-primary">
                    {appStats.day} / {(candidate.profiles_count || 1) * 40}
                  </p>
                </div>
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((appStats.day / ((candidate.profiles_count || 1) * 40)) * 100, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all",
                      appStats.day >= (candidate.profiles_count || 1) * 40 ? "bg-accent-green" : "bg-accent-blue"
                    )}
                  />
                </div>
                <p className="text-[10px] text-text-muted italic">Target: 40 applications per profile per day.</p>
              </div>
            </div>
          </section>
          )}

          {/* Activity Log */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <History className="w-5 h-5 text-accent-gray" />
                Activity Log
              </h3>
            </div>
            <div className="p-6 max-h-[400px] overflow-y-auto space-y-6 relative">
              <div className="absolute left-8 top-6 bottom-6 w-px bg-border-primary" />
              {combinedLogs.map((log) => (
                <div key={log.id} className="relative pl-8">
                  <div className={cn(
                    "absolute left-[-4px] top-1.5 w-2 h-2 rounded-full border-2 border-bg-secondary",
                    log.type === 'resume' ? "bg-accent-purple" : 
                    log.type === 'application' ? "bg-accent-blue" : 
                    log.type === 'interview' ? "bg-accent-red" : "bg-accent-gray"
                  )} />
                  <p className="text-sm font-bold text-text-primary">{log.action}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{log.details}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-text-muted font-medium">{allUsers.find(u => String(u.id) === String(log.user_id))?.display_name || 'System'}</span>
                    <span className="w-1 h-1 bg-text-muted rounded-full opacity-30" />
                    <span className="text-[10px] text-text-muted">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
