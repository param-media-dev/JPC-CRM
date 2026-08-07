import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Zap, 
  Plus, 
  X, 
  Trash2, 
  Edit3, 
  ExternalLink, 
  Image as ImageIcon, 
  FileText,
  Users,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToCollection, 
  addFeatureAnnouncement, 
  updateFeatureAnnouncement, 
  deleteFeatureAnnouncement 
} from '../services/storage';
import { FeatureAnnouncement, Role } from '../types';
import { cn } from '../lib/utils';
import Select from 'react-select';

const TEAM_OPTIONS = [
  { value: 'ALL', label: 'All Teams' },
  { value: 'jpc_lead_gen', label: 'Lead Gen' },
  { value: 'jpc_sales', label: 'Sales Team' },
  { value: 'jpc_cs', label: 'Customer Success' },
  { value: 'jpc_resume', label: 'Resume Team' },
  { value: 'jpc_marketing', label: 'Marketing Leader' },
  { value: 'jpc_marketing_support', label: 'Marketing Support' },
  { value: 'jpc_recruiter', label: 'Recruiter' },
  { value: 'jpc_proxy', label: 'Proxy Team' },
];

export const FeatureAnnouncements: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'administrator';

  const [announcements, setAnnouncements] = useState<FeatureAnnouncement[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<FeatureAnnouncement | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'my_team'>('all');

  useEffect(() => {
    const unsub = subscribeToCollection<FeatureAnnouncement>('jpc_feature_announcements', (data) => {
      setAnnouncements(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    });
    return unsub;
  }, []);

  const filteredAnnouncements = useMemo(() => {
    if (activeFilter === 'my_team' && user) {
      return announcements.filter(a => a.target_teams === 'ALL' || (Array.isArray(a.target_teams) && a.target_teams.includes(user.role)));
    }
    // For non-admins, they should only see ones relevant to them
    if (!isAdmin && user) {
      return announcements.filter(a => a.target_teams === 'ALL' || (Array.isArray(a.target_teams) && a.target_teams.includes(user.role)));
    }
    return announcements;
  }, [announcements, activeFilter, user, isAdmin]);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-text-primary tracking-tight">Feature Alerts</h1>
          <p className="text-text-secondary font-medium mt-1">Stay updated with the latest CRM features and improvements.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-bg-secondary p-1 rounded-2xl border border-border-primary">
            <button
              onClick={() => setActiveFilter('all')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                activeFilter === 'all' ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" : "text-text-muted hover:text-text-primary"
              )}
            >
              All Alerts
            </button>
            <button
              onClick={() => setActiveFilter('my_team')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                activeFilter === 'my_team' ? "bg-accent-blue text-white shadow-lg shadow-accent-blue/20" : "text-text-muted hover:text-text-primary"
              )}
            >
              For My Team
            </button>
          </div>

          {isAdmin && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-black rounded-2xl hover:bg-accent-blue/90 hover:-translate-y-0.5 transition-all shadow-xl shadow-accent-blue/20"
            >
              <Plus className="w-5 h-5" />
              New Feature
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredAnnouncements.map((announcement, index) => (
            <AnnouncementCard 
              key={announcement.id} 
              announcement={announcement} 
              isAdmin={isAdmin}
              onEdit={() => {
                setEditingAnnouncement(announcement);
                setIsModalOpen(true);
              }}
              onDelete={async () => {
                if (window.confirm('Are you sure you want to delete this alert?')) {
                  await deleteFeatureAnnouncement(announcement.id);
                  showToast('Announcement deleted', 'success');
                }
              }}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>

      {filteredAnnouncements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-bg-secondary rounded-[48px] border border-dashed border-border-primary">
          <div className="w-20 h-20 bg-bg-tertiary rounded-3xl flex items-center justify-center mb-6 text-text-muted">
            <Zap className="w-10 h-10 opacity-20" />
          </div>
          <p className="text-lg font-black text-text-primary">No alerts found</p>
          <p className="text-sm font-bold text-text-muted">Everything is calm and up-to-date.</p>
        </div>
      )}

      {isModalOpen && (
        <AnnouncementModal 
          onClose={() => {
            setIsModalOpen(false);
            setEditingAnnouncement(null);
          }}
          initialData={editingAnnouncement}
          creatorId={user?.id as string}
        />
      )}
    </div>
  );
};

const AnnouncementCard: React.FC<{
  announcement: FeatureAnnouncement;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}> = ({ announcement, isAdmin, onEdit, onDelete, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-bg-secondary rounded-[40px] border border-border-primary p-8 hover:border-accent-blue/30 transition-all hover:shadow-2xl hover:shadow-accent-blue/5 flex flex-col h-full overflow-hidden relative"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="p-3 bg-accent-blue/10 rounded-2xl text-accent-blue">
          <Zap className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={onEdit} className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-accent-blue transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-accent-red transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest bg-bg-tertiary px-3 py-1.5 rounded-full border border-border-primary/50">
            {new Date(announcement.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <h3 className="text-2xl font-black text-text-primary tracking-tight mb-4 group-hover:text-accent-blue transition-colors">{announcement.title}</h3>
      <p className="text-sm font-medium text-text-secondary leading-relaxed mb-6 flex-1">{announcement.summary}</p>

      <div className="space-y-4">
        {(announcement.image_url || announcement.pdf_url) && (
          <div className="grid grid-cols-2 gap-3 pb-6 border-b border-border-primary/50">
            {announcement.image_url && (
              <a 
                href={announcement.image_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-bg-tertiary rounded-2xl border border-border-primary text-[10px] font-black text-text-primary hover:bg-bg-tertiary/80 transition-all uppercase tracking-widest"
              >
                <ImageIcon className="w-4 h-4 text-accent-blue" />
                Image
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </a>
            )}
            {announcement.pdf_url && (
              <a 
                href={announcement.pdf_url} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 bg-bg-tertiary rounded-2xl border border-border-primary text-[10px] font-black text-text-primary hover:bg-bg-tertiary/80 transition-all uppercase tracking-widest"
              >
                <FileText className="w-4 h-4 text-accent-red" />
                Docs
                <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
              </a>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 bg-bg-tertiary rounded-full border-2 border-bg-secondary flex items-center justify-center text-accent-blue shadow-sm">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">
            {announcement.target_teams === 'ALL' ? 'All Teams' : `${announcement.target_teams.length} Team(s)`}
          </span>
          <ChevronRight className="w-4 h-4 text-text-muted ml-auto group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Background decoration */}
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent-blue/5 rounded-full blur-[60px] pointer-events-none group-hover:scale-150 transition-transform duration-700" />
    </motion.div>
  );
};

const AnnouncementModal: React.FC<{
  onClose: () => void;
  initialData?: FeatureAnnouncement | null;
  creatorId: string;
}> = ({ onClose, initialData, creatorId }) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    summary: initialData?.summary || '',
    image_url: initialData?.image_url || '',
    pdf_url: initialData?.pdf_url || '',
    target_teams: initialData?.target_teams || 'ALL' as Role[] | 'ALL'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.summary) return;

    setIsSubmitting(true);
    try {
      if (initialData) {
        await updateFeatureAnnouncement(initialData.id, {
          ...formData,
        });
        showToast('Announcement updated', 'success');
      } else {
        await addFeatureAnnouncement({
          ...formData,
          image_url: formData.image_url || null,
          pdf_url: formData.pdf_url || null,
          created_by: creatorId,
        });
        showToast('Feature alert sent!', 'success');
      }
      onClose();
    } catch (error) {
      showToast('Action failed. Try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTeams = useMemo(() => {
    if (formData.target_teams === 'ALL') return [TEAM_OPTIONS[0]];
    return TEAM_OPTIONS.filter(opt => Array.isArray(formData.target_teams) && formData.target_teams.includes(opt.value as Role));
  }, [formData.target_teams]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-bg-secondary w-full max-w-2xl rounded-[48px] shadow-2xl overflow-hidden border border-border-primary my-8"
      >
        <form onSubmit={handleSubmit} className="p-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <span className="text-[10px] font-black text-accent-blue uppercase tracking-[0.3em]">New Blast</span>
              <h2 className="text-3xl font-black text-text-primary tracking-tight mt-1">
                {initialData ? 'Edit Feature Alert' : 'Announce Feature'}
              </h2>
              <p className="text-xs font-bold text-text-muted mt-2">Nofity specified teams about CRM changes.</p>
            </div>
            <button type="button" onClick={onClose} className="p-3 hover:bg-bg-tertiary rounded-2xl transition-colors">
              <X className="w-6 h-6 text-text-muted" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Alert Title</label>
              <input 
                required
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., New Interview Tracker Updates"
                className="w-full px-6 py-4 bg-bg-tertiary border border-border-primary rounded-[24px] text-sm focus:ring-2 focus:ring-accent-blue/20 outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Feature Summary</label>
              <textarea 
                required
                value={formData.summary}
                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Briefly describe what's new and how it helps..."
                rows={4}
                className="w-full px-6 py-4 bg-bg-tertiary border border-border-primary rounded-[24px] text-sm focus:ring-2 focus:ring-accent-blue/20 outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Image URL (Optional)</label>
                <div className="relative">
                  <ImageIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    value={formData.image_url || ''}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full pl-14 pr-6 py-4 bg-bg-tertiary border border-border-primary rounded-[24px] text-xs focus:ring-2 focus:ring-accent-blue/20 outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">PDF Documentation link (Optional)</label>
                <div className="relative">
                  <FileText className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input 
                    value={formData.pdf_url || ''}
                    onChange={e => setFormData({ ...formData, pdf_url: e.target.value })}
                    className="w-full pl-14 pr-6 py-4 bg-bg-tertiary border border-border-primary rounded-[24px] text-xs focus:ring-2 focus:ring-accent-blue/20 outline-none"
                    placeholder="https://drive..."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-1">Target Teams</label>
              <Select 
                isMulti
                options={TEAM_OPTIONS}
                value={selectedTeams}
                onChange={(vals: any) => {
                  if (vals.some((v: any) => v.value === 'ALL')) {
                    setFormData({ ...formData, target_teams: 'ALL' });
                  } else {
                    setFormData({ ...formData, target_teams: vals.map((v: any) => v.value) as Role[] });
                  }
                }}
                styles={{
                  ...customSelectStyles,
                  container: (base) => ({ ...base, borderRadius: '24px' }),
                  control: (base) => ({ ...base, borderRadius: '24px', padding: '6px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' })
                }}
              />
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                type="button" 
                onClick={onClose}
                className="flex-1 py-5 bg-bg-tertiary text-text-primary font-black rounded-[24px] hover:bg-bg-tertiary/80 transition-all text-sm"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-5 bg-accent-blue text-white font-black rounded-[24px] hover:bg-accent-blue/90 shadow-2xl shadow-accent-blue/20 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {initialData ? 'Update Alert' : 'Send Alert Now'}
                    <Zap className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const customSelectStyles = {
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '20px',
    padding: '8px',
    boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)',
    zIndex: 100
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected ? 'var(--accent-blue)' : state.isFocused ? 'var(--bg-tertiary)' : 'transparent',
    color: state.isSelected ? '#fff' : 'var(--text-primary)',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: 'var(--accent-blue)',
    borderRadius: '8px',
    padding: '2px 4px'
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: '#fff',
    fontWeight: 'black',
    fontSize: '10px',
    textTransform: 'uppercase'
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#fff',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.2)',
      color: '#fff'
    }
  })
};
