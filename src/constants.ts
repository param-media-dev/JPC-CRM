import { Stage, Role } from './types';

export const STAGES: Record<Stage, { label: string; color: string; icon: string }> = {
  lead_generation:     { label: '1. Lead Generation',      color: '#3B82F6', icon: '◎' },
  sales:               { label: '2. Sales',                color: '#10B981', icon: '◈' },
  cs_qc:               { label: '3. CS QC Call',          color: '#8B5CF6', icon: '◉' },
  marketing_leader:    { label: '4. Marketing Leader',     color: '#059669', icon: '◆' },
  resume_team:         { label: '5. Resume Team',          color: '#F59E0B', icon: '◐' },
  cs_assign_recruiter: { label: '6. CS Assign Recruiter', color: '#8B5CF6', icon: '◉' },
  recruiter:           { label: '7. Recruiter',            color: '#3B82F6', icon: '◎' },
  sys_admin:           { label: '8. System Admin',         color: '#64748B', icon: '◧' },
  marketing_active:    { label: '9. Marketing Active',     color: '#059669', icon: '◆' },
  application_tracking: { label: '10. App Tracking',       color: '#3B82F6', icon: '◎' },
  completed:           { label: 'Completed',               color: '#10B981', icon: '✓' },
  not_interested:      { label: 'Not Interested',          color: '#6B7280', icon: '✕' },
};

export const TRANSITIONS: Record<Stage, Stage[]> = {
  lead_generation:     ['sales'],
  sales:               ['cs_qc', 'not_interested'],
  cs_qc:               ['marketing_leader'],
  marketing_leader:    ['resume_team'],
  resume_team:         ['cs_assign_recruiter'],
  cs_assign_recruiter: ['recruiter'],
  recruiter:           ['sys_admin'],
  sys_admin:           ['marketing_active'],
  marketing_active:    ['application_tracking'],
  application_tracking: ['completed'],
  completed:           [],
  not_interested:      [],
};

export const ROLE_PERMISSIONS: Record<Role, { allowedStages: Stage[] | 'ALL'; adminFeatures?: boolean; teamManagement?: boolean }> = {
  administrator: { allowedStages: 'ALL', adminFeatures: true, teamManagement: true },
  jpc_manager: { allowedStages: 'ALL', teamManagement: true },
  jpc_sysadmin: { allowedStages: 'ALL', adminFeatures: true, teamManagement: true },
  jpc_lead_gen: { allowedStages: ['lead_generation'] },
  jpc_sales: { allowedStages: ['sales'] },
  jpc_cs: { allowedStages: ['cs_qc', 'cs_assign_recruiter'] },
  jpc_resume: { allowedStages: ['resume_team'] },
  jpc_marketing: { allowedStages: ['marketing_leader', 'marketing_active'] },
  jpc_marketing_support: { allowedStages: ['marketing_active', 'application_tracking'] },
  jpc_recruiter: { allowedStages: ['recruiter', 'application_tracking'] },
  jpc_proxy: { allowedStages: 'ALL' },
  jpc_candidate: { allowedStages: [] },
  candidate: { allowedStages: [] },
};

export const LEAD_SOURCES = [
  'Facebook', 'Instagram', 'Google Ads', 'Referral', 'Walk-in', 'WhatsApp', 'LinkedIn', 'Event', 'Other'
];

export const QC_CHECKLIST_TEMPLATE = [
  { key: 'name_verified', label: 'Full name verified' },
  { key: 'phone_verified', label: 'Phone number verified' },
  { key: 'email_verified', label: 'Email address verified' },
  { key: 'job_interest_conf', label: 'Job interest confirmed' },
  { key: 'package_explained', label: 'Package explained to candidate' },
  { key: 'payment_plan_conf', label: 'Payment plan confirmed' },
  { key: 'promises_discussed', label: 'Promises discussed' },
  { key: 'agreement_ready', label: 'Agreement ready to send' },
];
