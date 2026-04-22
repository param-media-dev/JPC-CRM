import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Link as LinkIcon, Calendar, User as UserIcon, Send, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { Candidate, Application } from '../types';
import { generateId, logActivity } from '../services/storage';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { cn } from '../lib/utils';

interface TrackJobSheetProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  applications: Application[]; // To check for duplicates
}

export const TrackJobSheet: React.FC<TrackJobSheetProps> = ({ candidate, isOpen, onClose, applications }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [jobLink, setJobLink] = useState('');
  const [appliedAt, setAppliedAt] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !jobLink) return;

    // Check for duplicate link
    const isDuplicate = applications.some(app => app.job_link.trim().toLowerCase() === jobLink.trim().toLowerCase());
    if (isDuplicate) {
      showToast('LINK IS DUPLICATE! This job link has already been applied in the CRM.', 'error');
      return;
    }

    setIsSubmitting(true);
    const id = generateId();
    const newApp: Application = {
      id,
      candidate_id: candidate.id,
      recruiter_id: String(user?.id),
      job_link: jobLink,
      company_name: 'N/A', // As requested to remove/ignore
      sheet_type: candidate.job_interest, // Automated based on candidate
      applied_at: appliedAt,
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'jpc_applications', id), newApp);
      await logActivity(candidate.id, 'Job Applied', `Applied via Link: ${jobLink} by ${user?.display_name}`, user?.id || null);
      showToast('Application tracked successfully', 'success');
      setJobLink('');
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      showToast('Failed to save application', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && candidate && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[70]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-bg-secondary shadow-2xl z-[80] overflow-hidden flex flex-col border-l border-border-primary"
          >
            {/* Header */}
            <div className="p-6 border-b border-border-primary flex items-center justify-between bg-bg-primary">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent-blue/10 flex items-center justify-center text-accent-blue font-bold">
                  {candidate.full_name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary tracking-tight">Track Application</h2>
                  <p className="text-xs text-text-muted">For {candidate.full_name}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-bg-tertiary rounded-xl transition-all"
              >
                <X className="w-6 h-6 text-text-secondary" />
              </button>
            </div>

            {/* History Preview */}
            <div className="px-6 py-4 bg-bg-tertiary/30 border-b border-border-primary">
              <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent Applications
              </h3>
              <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2 no-scrollbar">
                {applications
                  .filter(app => app.candidate_id === candidate.id)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, 3)
                  .map(app => (
                    <div key={app.id} className="p-2 bg-bg-secondary border border-border-primary rounded-lg flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-accent-blue truncate font-mono">{app.job_link}</p>
                        <p className="text-[9px] text-text-muted mt-0.5">{new Date(app.applied_at).toLocaleDateString()}</p>
                      </div>
                      <a href={app.job_link} target="_blank" rel="noopener noreferrer" className="p-1 text-text-muted hover:text-accent-blue">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                {applications.filter(app => app.candidate_id === candidate.id).length === 0 && (
                  <p className="text-[10px] text-text-muted italic py-2 text-center">No previous applications tracked.</p>
                )}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar">
              <div className="space-y-6">
                <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-2xl p-4 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-accent-blue shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-text-primary">Direct Application Tracking</p>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      Tracking is automatically assigned to you. Just paste the job link to register the application for <strong>{candidate.full_name}</strong>.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon className="w-3.5 h-3.5" />
                    Job URL / Link
                  </label>
                  <textarea 
                    value={jobLink}
                    onChange={e => setJobLink(e.target.value)}
                    placeholder="https://linkedin.com/jobs/view/..."
                    className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors min-h-[120px] resize-none"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    Applied Date
                  </label>
                  <input 
                    type="date"
                    value={appliedAt}
                    onChange={e => setAppliedAt(e.target.value)}
                    className="w-full bg-bg-tertiary border border-border-primary rounded-2xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Duplicate Warning Preview */}
              {jobLink && applications.some(app => app.job_link.trim().toLowerCase() === jobLink.trim().toLowerCase()) && (
                <div className="p-4 bg-accent-red/5 border border-accent-red/20 rounded-2xl flex items-center gap-3 text-accent-red">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-xs font-bold uppercase tracking-wider">Duplicate link detected!</p>
                </div>
              )}
            </form>

            {/* Footer Actions */}
            <div className="p-6 border-t border-border-primary bg-bg-primary">
              <button 
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || !jobLink}
                className={cn(
                  "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg",
                  isSubmitting || !jobLink 
                    ? "bg-bg-tertiary text-text-muted cursor-not-allowed" 
                    : "bg-accent-blue text-white hover:bg-accent-blue/90 shadow-accent-blue/20"
                )}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                Submit Application
              </button>
              <button 
                onClick={onClose}
                className="w-full mt-3 py-3 text-sm font-bold text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
