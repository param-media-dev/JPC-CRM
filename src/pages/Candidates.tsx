import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection } from '../services/storage';
import { STAGES } from '../constants';
import { Search, Filter, X, Package, Phone, Mail, MapPin, Calendar, Users, ChevronRight, MoreVertical, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Candidate, Stage, User } from '../types';

export const Candidates: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  
  useEffect(() => {
    if (!isAuthReady) return;
    const unsub = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      setCandidates(data.filter(c => c.current_stage !== 'not_interested'));
      setIsLoading(false);
    });

    const unsubUsers = subscribeToCollection<User>('jpc_users', (data) => {
      setAllUsers(data);
    });

    return () => {
      unsub();
      unsubUsers();
    };
  }, [isAuthReady]);

  // Get stage from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const stage = params.get('stage');
    if (stage) setStageFilter(stage);
  }, []);

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      // Lead Gen can only see their own leads
      if (user?.role === 'jpc_lead_gen' && String(c.lead_generated_by) !== String(user?.id)) return false;

      const matchesSearch = 
        c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      
      const matchesStage = stageFilter ? c.current_stage === stageFilter : true;
      
      return matchesSearch && matchesStage;
    });
  }, [candidates, search, stageFilter, user]);

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
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Candidates</h1>
          <p className="text-text-secondary mt-1">Manage and search through your candidate database.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input 
              type="text" 
              placeholder="Search candidates..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-bg-secondary border border-border-primary rounded-2xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors shadow-sm"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <select 
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="w-full bg-bg-secondary border border-border-primary rounded-2xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors shadow-sm appearance-none"
            >
              <option value="">All Stages</option>
              {Object.entries(STAGES).filter(([key]) => key !== 'not_interested').map(([key, stage]) => (
                <option key={key} value={key}>{stage.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="bg-bg-secondary rounded-3xl border border-border-primary overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-bg-tertiary/50 border-b border-border-primary">
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Candidate</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">ID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Portal</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Current Stage</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Package</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest">Last Update</th>
                <th className="px-6 py-4 text-[10px] font-bold text-text-muted uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              <AnimatePresence mode="popLayout">
                {filteredCandidates.map((candidate, i) => (
                  <motion.tr 
                    key={candidate.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-bg-tertiary/30 transition-colors group cursor-pointer"
                    onClick={() => window.location.hash = `#candidate?id=${candidate.id}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-bg-tertiary flex items-center justify-center text-text-secondary font-bold text-xs ring-2 ring-border-primary group-hover:ring-accent-blue transition-all">
                          {candidate.full_name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-primary group-hover:text-accent-blue transition-colors">{candidate.full_name}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {candidate.location || 'No location'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono font-medium text-text-secondary bg-bg-tertiary px-2 py-1 rounded border border-border-primary">
                        {candidate.id}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs text-text-primary flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-text-muted" /> {candidate.phone}
                        </p>
                        <p className="text-xs text-text-muted flex items-center gap-2">
                          <Mail className="w-3.5 h-3.5 text-text-muted" /> {candidate.email || '—'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {allUsers.some(u => u.candidate_id === candidate.id) ? (
                        <div className="flex items-center gap-1.5 text-accent-green">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Active</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-text-muted uppercase">No Access</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-2 px-3 py-1 bg-bg-tertiary border border-border-primary rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGES[candidate.current_stage].color }} />
                        <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                          {STAGES[candidate.current_stage].label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-text-muted" />
                        <div>
                          <p className="text-xs font-bold text-text-primary">{candidate.package_name || '—'}</p>
                          <p className="text-[10px] text-text-muted">₹{candidate.package_amount.toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-text-muted flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(candidate.updated_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-text-muted hover:text-accent-blue transition-colors">
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredCandidates.length === 0 && (
            <div className="p-20 text-center">
              <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-bold text-text-primary">No candidates found</h3>
              <p className="text-text-secondary mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
