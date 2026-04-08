import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { LEAD_SOURCES } from '../constants';
import { getUsers, generateId, saveCandidate, seedQCChecklist, logActivity } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Candidate, User } from '../types';

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCandidateModal: React.FC<AddCandidateModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [salesUsers, setSalesUsers] = useState<User[]>([]);

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
      degree: '',
      university: '',
      graduation_year: '',
      experience_years: '',
      current_company: '',
      current_designation: '',
      skills: '',
      linkedin_url: '',
      lead_source: formData.lead_source,
      lead_generated_by: user?.id || null,
      assigned_sales: formData.assigned_sales || null,
      assigned_cs: null,
      assigned_resume: null,
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
        linkedin_optimized: false,
        marketing_email_created: false,
        google_auth_setup: false,
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
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Candidate"
      footer={
        <>
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
      }
    >
      <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      </form>
    </Modal>
  );
};
