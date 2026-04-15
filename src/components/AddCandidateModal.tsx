import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { LEAD_SOURCES } from '../constants';
import { getUsers, generateId, saveCandidate, seedQCChecklist, logActivity, addNotification } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Candidate, User } from '../types';
import { cn } from '../lib/utils';
import { parseResume } from '../services/aiService';
import { FileText, Upload, Loader2, Sparkles, Brain, Search, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [salesUsers, setSalesUsers] = useState<User[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsingSteps = [
    { icon: FileText, text: '📄 Reading resume file...', color: 'text-accent-blue' },
    { icon: Brain, text: '🧠 Analyzing structure...', color: 'text-accent-purple' },
    { icon: Search, text: '🔍 Extracting candidate details...', color: 'text-accent-teal' },
    { icon: Sparkles, text: '✨ Finalizing data...', color: 'text-accent-amber' }
  ];

  useEffect(() => {
    let interval: any;
    if (isParsing) {
      setParsingStep(0);
      interval = setInterval(() => {
        setParsingStep(prev => (prev < parsingSteps.length - 1 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isParsing]);

  useEffect(() => {
    if (isOpen) {
      getUsers().then(users => {
        setSalesUsers(users.filter(u => u.role === 'jpc_sales'));
      });
    }
  }, [isOpen]);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    job_interest: '',
    domain_interested: '',
    location: '',
    education: '',
    lead_source: 'Facebook',
    assigned_sales: '',
    notes: ''
  });

  const [extraData, setExtraData] = useState({
    degree: '',
    university: '',
    graduation_year: '',
    experience_years: '',
    current_company: '',
    current_designation: '',
    skills: '',
    linkedin_url: ''
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Please upload a PDF, DOCX, or Text file', 'error');
      return;
    }

    setIsParsing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result?.toString().split(',')[1];
        if (base64) {
          const parsed = await parseResume(base64, file.type);
          if (parsed) {
            setFormData(prev => ({
              ...prev,
              full_name: parsed.full_name || prev.full_name,
              phone: parsed.phone || prev.phone,
              email: parsed.email || prev.email,
              job_interest: parsed.job_interest || prev.job_interest,
              location: parsed.location || prev.location,
              education: parsed.education || prev.education,
              notes: parsed.notes || prev.notes
            }));
            setExtraData({
              degree: parsed.degree || '',
              university: parsed.university || '',
              graduation_year: parsed.graduation_year || '',
              experience_years: parsed.experience_years || '',
              current_company: parsed.current_company || '',
              current_designation: parsed.current_designation || '',
              skills: parsed.skills || '',
              linkedin_url: parsed.linkedin_url || ''
            });
            showToast('Resume parsed successfully!', 'success');
          } else {
            showToast('Failed to parse resume details', 'error');
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading file:', error);
      if (error.message?.includes('429')) {
        showToast('Rate limit exceeded. Please try again in a few minutes.', 'error');
      } else {
        showToast('Error reading file', 'error');
      }
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.phone) {
      showToast('Name and Phone are required', 'error');
      return;
    }

    const id = generateId();
    const newCandidate: Candidate = {
      id,
      full_name: formData.full_name,
      phone: formData.phone,
      whatsapp: formData.whatsapp,
      email: formData.email,
      job_interest: formData.job_interest,
      domain_interested: formData.domain_interested,
      location: formData.location,
      education: formData.education,
      degree: extraData.degree,
      university: extraData.university,
      graduation_year: extraData.graduation_year,
      experience_years: extraData.experience_years,
      current_company: extraData.current_company,
      current_designation: extraData.current_designation,
      skills: extraData.skills,
      linkedin_url: extraData.linkedin_url,
      lead_source: formData.lead_source,
      lead_generated_by: user?.id || null,
      assigned_sales: formData.assigned_sales || null,
      assigned_cs: null,
      assigned_resume: null,
      assigned_marketing_leader: null,
      assigned_recruiter: null,
      assigned_marketing: null,
      package_name: '',
      package_amount: 0,
      domain_suggested: '',
      notes: formData.notes,
      current_stage: 'lead_generation',
      flags: {
        agreement_sent: false,
        agreement_signed: false,
        qc_checklist_done: false,
        resume_approved: false,
        candidate_resume_approved: false,
        marketing_email_created: false,
        two_step_verification: false,
        linkedin_optimized: false,
        marketing_started: false
      },
      not_interested_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    saveCandidate(newCandidate, user?.id || null);
    seedQCChecklist(id);
    logActivity(id, 'Candidate created', `Candidate ${formData.full_name} added to the system.`, user?.id || null);
    
    if (formData.assigned_sales) {
      addNotification({
        recipient_id: formData.assigned_sales,
        sender_id: user?.id || null,
        type: 'system_alert',
        message: `You have been assigned to a new candidate: ${formData.full_name}`
      });
    }

    showToast('Candidate added successfully', 'success');
    onSuccess();
    onClose();
    setFormData({
      full_name: '',
      phone: '',
      whatsapp: '',
      email: '',
      job_interest: '',
      domain_interested: '',
      location: '',
      education: '',
      lead_source: 'Facebook',
      assigned_sales: '',
      notes: ''
    });
    setExtraData({
      degree: '',
      university: '',
      graduation_year: '',
      experience_years: '',
      current_company: '',
      current_designation: '',
      skills: '',
      linkedin_url: ''
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isParsing ? "AI Parsing in Progress" : "Add New Candidate"}
      footer={!isParsing ? (
        <>
          <div className="mr-auto">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              className="flex items-center gap-2 px-4 py-2 bg-bg-tertiary text-text-primary font-medium rounded-xl hover:bg-bg-tertiary/80 transition-all disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Upload Resume
            </button>
          </div>
          <button 
            onClick={onClose}
            className="px-4 py-2 text-text-secondary font-medium hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            className="px-6 py-2 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
          >
            Save Candidate
          </button>
        </>
      ) : null}
    >
      <div className="relative min-h-[400px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {isParsing ? (
            <motion.div
              key="preloader"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center p-8 text-center w-full"
            >
              <div className="relative mb-12">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="w-32 h-32 border-4 border-accent-blue/10 border-t-accent-blue rounded-full shadow-[0_0_20px_rgba(0,173,140,0.2)]"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    key={parsingStep}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                  >
                    {React.createElement(parsingSteps[parsingStep].icon, { 
                      className: cn("w-12 h-12", parsingSteps[parsingStep].color) 
                    })}
                  </motion.div>
                </div>
              </div>
              
              <motion.div
                key={parsingStep}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="space-y-4"
              >
                <h3 className="text-2xl font-bold text-text-primary tracking-tight">AI is working...</h3>
                <p className="text-lg text-text-secondary font-medium min-h-[1.5em]">
                  {parsingSteps[parsingStep].text}
                </p>
              </motion.div>

              <div className="mt-12 flex gap-3">
                {parsingSteps.map((_, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-700",
                      idx === parsingStep ? "bg-accent-blue w-12" : 
                      idx < parsingStep ? "bg-accent-blue/40 w-4" : "bg-bg-tertiary w-4"
                    )}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.form 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full"
            >
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Full Name *</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={e => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="John Doe"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Phone *</label>
          <input
            type="text"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="+91 00000 00000"
            required
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">WhatsApp</label>
          <input
            type="text"
            value={formData.whatsapp}
            onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="Same as phone"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="john@example.com"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Job Interest</label>
          <input
            type="text"
            value={formData.job_interest}
            onChange={e => setFormData({ ...formData, job_interest: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="e.g. Software Engineer"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Location</label>
          <input
            type="text"
            value={formData.location}
            onChange={e => setFormData({ ...formData, location: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
            placeholder="e.g. Bangalore"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Lead Source</label>
          <select
            value={formData.lead_source}
            onChange={e => setFormData({ ...formData, lead_source: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
          >
            {LEAD_SOURCES.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Assigned Sales</label>
          <select
            value={formData.assigned_sales}
            onChange={e => setFormData({ ...formData, assigned_sales: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
          >
            <option value="">Select Sales Person</option>
            {salesUsers.map(u => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2 space-y-1">
          <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notes</label>
          <textarea
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue transition-colors min-h-[100px]"
            placeholder="Any additional details..."
          />
        </div>
      </motion.form>
    )}
  </AnimatePresence>
</div>
</Modal>
);
};
