import React, { useState, useEffect, useMemo } from 'react';
import { 
  subscribeToCollection,
  saveCandidate, 
  logActivity, 
  addPayment, 
  updatePayment,
  addPromise,
  updatePromise,
  updateQCChecklistItem,
  addFollowUp,
  updateFollowUp,
  getUserById,
  now
} from '../services/storage';
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
  User as UserIcon,
  ExternalLink,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Candidate, Payment, Promise as PromiseType, QCChecklistItem, FollowUp, ActivityLog, User, Stage } from '../types';
import { query, collection, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase';

export const CandidateDetail: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const id = params.get('id');

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [promises, setPromises] = useState<PromiseType[]>([]);
  const [checklist, setChecklist] = useState<QCChecklistItem[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !id) return;

    const unsubCandidate = onSnapshot(doc(db, 'jpc_candidates', id), (doc) => {
      if (doc.exists()) {
        setCandidate(doc.data() as Candidate);
        setIsLoading(false);
      }
    });

    const unsubPayments = onSnapshot(query(collection(db, 'jpc_payments'), where('candidate_id', '==', id)), (snap) => {
      setPayments(snap.docs.map(d => d.data() as Payment).sort((a, b) => a.part_number - b.part_number));
    });

    const unsubPromises = onSnapshot(query(collection(db, 'jpc_promises'), where('candidate_id', '==', id)), (snap) => {
      setPromises(snap.docs.map(d => d.data() as PromiseType).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    const unsubChecklist = onSnapshot(query(collection(db, 'jpc_qc_checklist'), where('candidate_id', '==', id)), (snap) => {
      setChecklist(snap.docs.map(d => d.data() as QCChecklistItem));
    });

    const unsubFollowUps = onSnapshot(query(collection(db, 'jpc_followups'), where('candidate_id', '==', id)), (snap) => {
      setFollowUps(snap.docs.map(d => d.data() as FollowUp));
    });

    const unsubActivity = onSnapshot(query(collection(db, 'jpc_activity_logs'), where('candidate_id', '==', id)), (snap) => {
      setActivityLogs(snap.docs.map(d => d.data() as ActivityLog).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });

    const unsubUsers = subscribeToCollection<User>('jpc_users', (data) => {
      setAllUsers(data);
    });

    return () => {
      unsubCandidate();
      unsubPayments();
      unsubPromises();
      unsubChecklist();
      unsubFollowUps();
      unsubActivity();
      unsubUsers();
    };
  }, [isAuthReady, id]);

  const salesUsers = allUsers.filter(u => u.role === 'jpc_sales');
  const csUsers = allUsers.filter(u => u.role === 'jpc_cs');
  const resumeUsers = allUsers.filter(u => u.role === 'jpc_resume');
  const recruiterUsers = allUsers.filter(u => u.role === 'jpc_recruiter');
  const marketingUsers = allUsers.filter(u => u.role === 'jpc_marketing');

  // Edit states
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingEducation, setIsEditingEducation] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  
  const [personalForm, setPersonalForm] = useState<Partial<Candidate>>({});
  const [educationForm, setEducationForm] = useState<Partial<Candidate>>({});
  const [packageForm, setPackageForm] = useState<Partial<Candidate>>({});

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
    }
  }, [candidate]);

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

  const handleSavePersonal = async () => {
    await saveCandidate({ ...candidate, ...personalForm } as Candidate, user?.id || null);
    await logActivity(candidate.id, 'Updated personal info', 'Personal information details were updated.', user?.id || null);
    setIsEditingPersonal(false);
    showToast('Personal info updated', 'success');
  };

  const handleSaveEducation = async () => {
    await saveCandidate({ ...candidate, ...educationForm } as Candidate, user?.id || null);
    await logActivity(candidate.id, 'Updated education info', 'Education and experience details were updated.', user?.id || null);
    setIsEditingEducation(false);
    showToast('Education info updated', 'success');
  };

  const handleSavePackage = async () => {
    await saveCandidate({ ...candidate, ...packageForm } as Candidate, user?.id || null);
    await logActivity(candidate.id, 'Updated package info', 'Package and team assignment details were updated.', user?.id || null);
    setIsEditingPackage(false);
    showToast('Package info updated', 'success');
  };

  const handleStageMove = async (newStage: Stage) => {
    const oldStageLabel = STAGES[candidate.current_stage].label;
    const newStageLabel = STAGES[newStage].label;
    
    const updated = { 
      ...candidate, 
      current_stage: newStage,
      not_interested_at: newStage === 'not_interested' ? now() : null
    };
    
    await saveCandidate(updated, user?.id || null);
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
      candidate_id: candidate.id,
      stage: candidate.current_stage,
      followup_date: followUpForm.date,
      note: followUpForm.note,
      done: false,
      created_by: user?.id || null
    });
    await logActivity(candidate.id, 'Follow-up scheduled', `Scheduled for ${followUpForm.date}`, user?.id || null);
    setFollowUpForm({ date: '', note: '' });
    showToast('Follow-up scheduled', 'success');
  };

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
  const paymentProgress = candidate.package_amount > 0 ? (totalPaid / candidate.package_amount) * 100 : 0;
  const nextPayment = payments.find(p => p.status === 'pending');

  return (
    <div className="space-y-8 pb-20">
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
      <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-text-muted uppercase tracking-widest mr-2">Move to Stage:</span>
        {TRANSITIONS[candidate.current_stage].map(stageKey => (
          <button
            key={stageKey}
            onClick={() => handleStageMove(stageKey as Stage)}
            className="px-4 py-2 bg-bg-tertiary border border-border-primary rounded-xl text-sm font-bold text-text-primary hover:border-accent-blue hover:text-accent-blue transition-all flex items-center gap-2"
          >
            {STAGES[stageKey as Stage].icon} {STAGES[stageKey as Stage].label.split('. ')[1] || STAGES[stageKey as Stage].label}
            <ArrowRight className="w-4 h-4" />
          </button>
        ))}
        {candidate.current_stage !== 'not_interested' && (
          <button
            onClick={() => handleStageMove('not_interested')}
            className="px-4 py-2 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500 hover:text-white transition-all ml-auto"
          >
            Not Interested
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 space-y-8">
          {/* Personal Info */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-accent-blue" />
                Personal Information
              </h3>
              <button 
                onClick={() => isEditingPersonal ? handleSavePersonal() : setIsEditingPersonal(true)}
                className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
              >
                {isEditingPersonal ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              </button>
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

          {/* Education & Experience */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-accent-purple" />
                Education & Experience
              </h3>
              <button 
                onClick={() => isEditingEducation ? handleSaveEducation() : setIsEditingEducation(true)}
                className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
              >
                {isEditingEducation ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              </button>
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
                    <label className="text-[10px] font-bold text-text-muted uppercase">Experience Years</label>
                    <input type="text" value={educationForm.experience_years || ''} onChange={e => setEducationForm({...educationForm, experience_years: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Current Company</label>
                    <input type="text" value={educationForm.current_company || ''} onChange={e => setEducationForm({...educationForm, current_company: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
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
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Current Company</p>
                    <p className="text-text-primary font-medium">{candidate.current_company || '—'}</p>
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

          {/* Package & Team */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary flex items-center justify-between">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <Package className="w-5 h-5 text-accent-teal" />
                Package & Team Assignment
              </h3>
              <button 
                onClick={() => isEditingPackage ? handleSavePackage() : setIsEditingPackage(true)}
                className="p-2 text-text-secondary hover:text-accent-blue transition-colors"
              >
                {isEditingPackage ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
              </button>
            </div>
            <div className="p-6">
              {isEditingPackage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Package Name</label>
                    <input type="text" value={packageForm.package_name || ''} onChange={e => setPackageForm({...packageForm, package_name: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Package Amount (₹)</label>
                    <input type="number" value={packageForm.package_amount || 0} onChange={e => setPackageForm({...packageForm, package_amount: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Assigned CS</label>
                    <select value={packageForm.assigned_cs || ''} onChange={e => setPackageForm({...packageForm, assigned_cs: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      <option value="">Select CS</option>
                      {csUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Resume</label>
                    <select value={packageForm.assigned_resume || ''} onChange={e => setPackageForm({...packageForm, assigned_resume: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      <option value="">Select Resume Team</option>
                      {resumeUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Recruiter</label>
                    <select value={packageForm.assigned_recruiter || ''} onChange={e => setPackageForm({...packageForm, assigned_recruiter: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      <option value="">Select Recruiter</option>
                      {recruiterUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Assigned Marketing</label>
                    <select value={packageForm.assigned_marketing || ''} onChange={e => setPackageForm({...packageForm, assigned_marketing: e.target.value})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      <option value="">Select Marketing</option>
                      {marketingUsers.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Package Name</p>
                    <p className="text-text-primary font-bold">{candidate.package_name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Total Amount</p>
                    <p className="text-text-primary font-bold text-lg">₹{candidate.package_amount.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">CS Representative</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_cs)?.display_name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Resume Specialist</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_resume)?.display_name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned Recruiter</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_recruiter)?.display_name || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Marketing Leader</p>
                    <p className="text-text-primary font-medium">{allUsers.find(u => u.id === candidate.assigned_marketing)?.display_name || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Payments */}
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
                          <a 
                            href={`#receipt?pay_id=${p.id}&cand_id=${candidate.id}`}
                            className="p-2 text-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 rounded-lg transition-all"
                            title="View Receipt"
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] px-2 py-1 bg-accent-amber/10 text-accent-amber font-bold rounded-full uppercase">Pending</span>
                          <button 
                            onClick={() => handleMarkPaid(p)}
                            className="px-3 py-1 bg-accent-green text-white text-xs font-bold rounded-lg hover:bg-accent-green/90 transition-all"
                          >
                            Mark Paid
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Payment Form */}
              <form onSubmit={handleAddPayment} className="pt-6 border-t border-border-primary">
                <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-4">Add Payment Plan</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-text-muted uppercase">Part #</label>
                    <select value={paymentForm.part_number} onChange={e => setPaymentForm({...paymentForm, part_number: Number(e.target.value)})} className="w-full bg-bg-tertiary border border-border-primary rounded-lg px-3 py-2 text-sm">
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>Part {n}</option>)}
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
            </div>
          </section>

          {/* Promises */}
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
                    </div>
                  </div>
                ))}
              </div>
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
            </div>
          </section>
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
            <div className="p-6 grid grid-cols-1 gap-4">
              {Object.entries(candidate.flags).map(([key, value]) => (
                <label key={key} className="flex items-center justify-between group cursor-pointer">
                  <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors capitalize">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <div 
                    onClick={() => handleToggleFlag(key as keyof Candidate['flags'])}
                    className={cn(
                      "w-12 h-6 rounded-full relative transition-all duration-300",
                      value ? "bg-accent-green" : "bg-bg-tertiary border border-border-primary"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 shadow-sm",
                      value ? "left-7" : "left-1"
                    )} />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* QC Checklist */}
          <section className="bg-bg-secondary border border-border-primary rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-border-primary">
              <h3 className="font-bold text-text-primary flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-accent-blue" />
                QC Call Checklist
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {checklist.map(item => (
                <label key={item.id} className="flex items-center gap-3 group cursor-pointer">
                  <div 
                    onClick={() => handleCheckQC(item)}
                    className={cn(
                      "w-5 h-5 rounded border flex items-center justify-center transition-all",
                      item.checked ? "bg-accent-blue border-accent-blue" : "bg-bg-tertiary border-border-primary group-hover:border-accent-blue"
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
              ))}
            </div>
          </section>

          {/* Follow-Ups */}
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
                      <button 
                        onClick={async () => {
                          await updateFollowUp({...f, done: true});
                          await logActivity(candidate.id, 'Follow-up completed', `Note: ${f.note}`, user?.id || null);
                        }}
                        className="text-[10px] font-bold text-text-muted hover:text-accent-green uppercase transition-colors"
                      >
                        Mark Done
                      </button>
                    </div>
                    <p className="text-sm text-text-primary">{f.note}</p>
                  </div>
                ))}
              </div>
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
            </div>
          </section>

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
              {activityLogs.map((log, i) => (
                <div key={log.id} className="relative pl-8">
                  <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-accent-gray border-2 border-bg-secondary" />
                  <p className="text-sm font-bold text-text-primary">{log.action}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{log.details}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-text-muted font-medium">{allUsers.find(u => u.id === log.user_id)?.display_name || 'System'}</span>
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
