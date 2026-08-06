import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { saveCandidate, addNotification } from '../services/storage';
import { Candidate, Stage } from '../types';
import { STAGES } from '../constants';

export const SLAMonitor: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { candidates, users } = useData();

  // Refs so the interval always sees fresh data without re-creating
  const candidatesRef = useRef(candidates);
  const usersRef = useRef(users);
  const userRef = useRef(user);
  useEffect(() => { candidatesRef.current = candidates; }, [candidates]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (!['administrator', 'jpc_sysadmin', 'jpc_manager'].includes(user.role)) return;

    const monitorInterval = setInterval(() => {
      const cands = candidatesRef.current;
      const usrs = usersRef.current;
      const u = userRef.current;
      if (!cands.length || !usrs.length || !u) return;

      const TIMEOUT_MS = 2.5 * 60 * 60 * 1000;
      const now = Date.now();
      const ACTIVE_STAGES: Stage[] = [
        'sales', 'cs_qc', 'marketing_leader', 'cs_strategy_check',
        'resume_team', 'cs_assign_recruiter', 'recruiter', 'sys_admin'
      ];

      cands.forEach(async (candidate) => {
        if (ACTIVE_STAGES.includes(candidate.current_stage) && !candidate.flags?.sla_timeout_notified) {
          if (now - new Date(candidate.updated_at).getTime() >= TIMEOUT_MS) {
            try {
              const updatedFlags = { ...(candidate.flags || {}), sla_timeout_notified: true };
              await saveCandidate({ ...candidate, flags: updatedFlags } as Candidate, u.id as string);
              const recipients = new Set<string>();
              let assignee: string | number | null = null;
              switch (candidate.current_stage) {
                case 'sales': assignee = candidate.assigned_sales; break;
                case 'cs_qc': case 'cs_assign_recruiter': assignee = candidate.assigned_cs; break;
                case 'marketing_leader': assignee = candidate.assigned_marketing_leader; break;
                case 'resume_team': assignee = candidate.assigned_resume; break;
                case 'recruiter': assignee = candidate.assigned_recruiter; break;
                case 'sys_admin': usrs.forEach(x => { if (x.role === 'jpc_sysadmin') recipients.add(String(x.id)); }); break;
              }
              if (assignee) recipients.add(String(assignee));
              if (candidate.lead_generated_by) recipients.add(String(candidate.lead_generated_by));
              usrs.forEach(x => {
                if (x.role === 'jpc_cs' || x.role === 'jpc_manager' || x.role === 'administrator') recipients.add(String(x.id));
              });
              const stageLabel = STAGES[candidate.current_stage]?.label || candidate.current_stage;
              await Promise.all(Array.from(recipients).map(rid => {
                let message = `SLA Warning: ${candidate.full_name} stuck in "${stageLabel}" for over 2.5 hours.`;
                if (assignee && rid === String(assignee)) message = `Action Required: ${candidate.full_name} stuck in "${stageLabel}" for over 2.5 hours!`;
                return addNotification({ recipient_id: rid, sender_id: 'system', type: 'system_alert', message });
              }));
            } catch (err) { console.error('SLA timeout error:', candidate.id, err); }
          }
        }
      });
    }, 60_000);

    return () => clearInterval(monitorInterval);
  }, [isAuthReady, user?.role]); // stable deps — no data arrays

  return null;
};
