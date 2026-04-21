import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { saveCandidate, logActivity } from '../services/storage';
import { STAGES } from '../constants';
import { Search, Filter, X, Package, Phone, Mail, MapPin, Calendar, Users, ArrowRight, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Candidate, Stage } from '../types';

export const Pipeline: React.FC = () => {
  const { user } = useAuth();
  const { candidates: allCandidates, isLoading } = useData();
  const candidates = useMemo(() => allCandidates.filter(c => c.current_stage !== 'not_interested'), [allCandidates]);
  const [search, setSearch] = useState('');

  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;

      if (user?.role === 'jpc_recruiter') {
        return String(c.assigned_recruiter) === String(user.id);
      } else if (user?.role === 'jpc_lead_gen') {
        return String(c.lead_generated_by) === String(user.id);
      } else if (user?.role === 'jpc_marketing') {
        return String(c.assigned_marketing_leader) === String(user.id);
      }
      
      return true;
    });
  }, [candidates, search, user]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Pipeline Board</h1>
          <p className="text-text-secondary mt-1">Track candidates through the recruitment lifecycle.</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text" 
            placeholder="Search candidates..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-bg-secondary border border-border-primary rounded-2xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors shadow-sm"
          />
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-6">
        <div className="flex gap-6 h-full min-w-max">
          {Object.entries(STAGES).filter(([key]) => key !== 'not_interested').map(([key, stage]) => {
            const stageCandidates = filteredCandidates.filter(c => c.current_stage === key);
            return (
              <div key={key} className="w-80 flex flex-col bg-bg-secondary/30 rounded-3xl border border-border-primary/50 overflow-hidden">
                <div className="p-4 border-b border-border-primary flex items-center justify-between bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-lg">
                      {stage.icon}
                    </div>
                    <h3 className="font-bold text-text-primary text-sm tracking-tight">{stage.label}</h3>
                  </div>
                  <span className="px-2 py-0.5 bg-bg-tertiary border border-border-primary rounded-lg text-[10px] font-bold text-text-muted uppercase">
                    {stageCandidates.length}
                  </span>
                </div>
                
                <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                  <AnimatePresence mode="popLayout">
                    {stageCandidates.map((candidate) => (
                      <motion.div
                        key={candidate.id}
                        layout
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-bg-secondary p-4 rounded-2xl border border-border-primary shadow-sm hover:shadow-md hover:border-accent-blue transition-all group cursor-pointer relative"
                        onClick={() => window.location.hash = `#candidate?id=${candidate.id}`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="truncate pr-6">
                            <h4 className="font-bold text-text-primary text-sm group-hover:text-accent-blue transition-colors truncate">
                              {candidate.full_name}
                            </h4>
                            <p className="text-[10px] font-mono text-text-muted mt-0.5">{candidate.id}</p>
                          </div>
                          <div className="absolute right-3 top-3">
                            <MoreVertical className="w-4 h-4 text-text-muted group-hover:text-text-secondary transition-colors" />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-text-secondary">
                            <Phone className="w-3.5 h-3.5" />
                            {candidate.phone}
                          </div>
                          {candidate.package_name && (
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                              <Package className="w-3.5 h-3.5" />
                              {candidate.package_name}
                            </div>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border-primary flex items-center justify-between">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-bg-tertiary border-2 border-bg-secondary flex items-center justify-center text-[8px] font-bold text-text-muted">
                              {candidate.full_name[0]}
                            </div>
                          </div>
                          <p className="text-[10px] font-bold text-text-muted uppercase">
                            {new Date(candidate.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {stageCandidates.length === 0 && (
                    <div className="h-32 border-2 border-dashed border-border-primary rounded-2xl flex items-center justify-center">
                      <p className="text-xs text-text-muted font-medium">No candidates</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
