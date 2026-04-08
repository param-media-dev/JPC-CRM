export type Role = 
  | 'administrator'
  | 'jpc_manager'
  | 'jpc_sysadmin'
  | 'jpc_lead_gen'
  | 'jpc_sales'
  | 'jpc_cs'
  | 'jpc_resume'
  | 'jpc_marketing'
  | 'jpc_recruiter';

export type UserRole = Role;

export interface User {
  id: number | string;
  username: string;
  password?: string;
  display_name: string;
  role: Role;
  created_at: string;
}

export type Stage = 
  | 'lead_generation'
  | 'sales'
  | 'cs_qc'
  | 'marketing_leader'
  | 'resume_team'
  | 'cs_assign_recruiter'
  | 'recruiter'
  | 'sys_admin'
  | 'marketing_active'
  | 'completed'
  | 'not_interested';

export interface CandidateFlags {
  agreement_sent: boolean;
  agreement_signed: boolean;
  qc_checklist_done: boolean;
  resume_approved: boolean;
  candidate_resume_approved: boolean;
  linkedin_optimized: boolean;
  marketing_email_created: boolean;
  google_auth_setup: boolean;
  marketing_started: boolean;
}

export interface Candidate {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  whatsapp: string;
  job_interest: string;
  domain_interested: string;
  location: string;
  education: string;
  degree: string;
  university: string;
  graduation_year: string;
  experience_years: string;
  current_company: string;
  current_designation: string;
  skills: string;
  linkedin_url: string;
  lead_source: string;
  lead_generated_by: string | number | null;
  assigned_sales: string | number | null;
  assigned_cs: string | number | null;
  assigned_resume: string | number | null;
  assigned_recruiter: string | number | null;
  assigned_marketing: string | number | null;
  package_name: string;
  package_amount: number;
  domain_suggested: string;
  notes: string;
  current_stage: Stage;
  flags: CandidateFlags;
  not_interested_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  candidate_id: string;
  part_number: number;
  amount: number;
  due_date: string;
  paid_on: string | null;
  status: 'pending' | 'paid';
  receipt_number: string;
  payment_method: string;
  notes: string;
  created_by: string | number | null;
  created_at: string;
}

export interface FollowUp {
  id: string;
  candidate_id: string;
  stage: string;
  followup_date: string;
  note: string;
  done: boolean;
  created_by: string | number | null;
  created_at: string;
}

export interface Promise {
  id: string;
  candidate_id: string;
  promise_text: string;
  made_by: string | number | null;
  stage: string;
  status: 'active' | 'fulfilled' | 'broken';
  created_at: string;
}

export interface QCChecklistItem {
  id: string;
  candidate_id: string;
  item_key: string;
  item_label: string;
  checked: boolean;
}

export interface ActivityLog {
  id: string;
  candidate_id: string;
  user_id: string | number | null;
  action: string;
  details: string;
  created_at: string;
}
