import React, { useState, useEffect, useMemo } from 'react';
import { subscribeToCollection, saveCandidate, deleteCandidate } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Candidate } from '../types';
import { ArrowLeft, Trash2, RotateCcw, Search, UserX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const Trash: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsub = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      const trashed = data.filter(c => c.trashed_at);
      
      // Auto-delete if older than 30 days
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      trashed.forEach(c => {
        if (c.trashed_at && (now - new Date(c.trashed_at).getTime()) > thirtyDaysMs) {
          deleteCandidate(c.id).catch(console.error);
        }
      });

      setCandidates(trashed);
      setIsLoading(false);
    });

    return () => unsub();
  }, [isAuthReady]);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      // Sales/Recruiter etc see only theirs if needed, but Trash is usually for Admin/Sales
      if (user?.role === 'jpc_sales' && String(c.assigned_sales) !== String(user?.id)) return false;
      
      const matchesSearch = 
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      
      return matchesSearch;
    });
  }, [candidates, search, user]);

  const handleRestore = async (candidate: Candidate) => {
    if (window.confirm(`Restore ${candidate.full_name}? They will be returned to their previous stage.`)) {
      await saveCandidate({ ...candidate, trashed_at: null }, user?.id || null);
      showToast('Candidate restored successfully', 'success');
    }
  };

  const handlePermanentDelete = async (candidate: Candidate) => {
    if (user?.role === 'administrator' && window.confirm(`PERMANENTLY DELETE ${candidate.full_name}? This cannot be undone.`)) {
      await deleteCandidate(candidate.id);
      showToast('Candidate permanently deleted', 'success');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-red/30 border-t-accent-red rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
            <Trash2 className="w-8 h-8 text-accent-red" />
            Trash (Not Eligible)
          </h1>
          <p className="text-text-secondary mt-1">Candidates marked as not eligible. Items here will be automatically deleted after 30 days.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            className="w-full bg-bg-secondary border border-border-primary rounded-2xl py-3 pl-12 pr-4 text-sm text-text-primary focus:outline-none focus:border-accent-red focus:ring-1 focus:ring-accent-red transition-all"
            placeholder="Search trash by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-bg-tertiary/50 border-b border-border-primary">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Candidate</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Trashed On</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              <AnimatePresence mode="popLayout">
                {filteredCandidates.map((candidate) => (
                  <motion.tr 
                    key={candidate.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="group hover:bg-bg-tertiary/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-red/10 flex items-center justify-center text-accent-red font-bold shrink-0">
                          {candidate.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-primary">{candidate.full_name}</p>
                          <p className="text-xs text-text-secondary">{candidate.job_interest || 'No Role'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-text-secondary">
                        <div>{candidate.phone}</div>
                        <div>{candidate.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary">
                      {candidate.trashed_at ? new Date(candidate.trashed_at).toLocaleDateString() : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRestore(candidate)}
                          className="p-2 text-text-muted hover:text-accent-green hover:bg-accent-green/10 rounded-xl transition-all"
                          title="Restore Candidate"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        {user?.role === 'administrator' && (
                          <button
                            onClick={() => handlePermanentDelete(candidate)}
                            className="p-2 text-text-muted hover:text-accent-red hover:bg-accent-red/10 rounded-xl transition-all"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {filteredCandidates.length === 0 && (
                  <tr className="hover:bg-transparent">
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-text-muted">
                        <UserX className="w-12 h-12 mb-4 opacity-50" />
                        <p className="text-sm font-medium">Trash is empty</p>
                        <p className="text-xs mt-1">No ineligible candidates found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
