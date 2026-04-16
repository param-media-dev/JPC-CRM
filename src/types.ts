export type Role = 
  | 'administrator'
  | 'jpc_manager'
  | 'jpc_sysadmin'
  | 'jpc_lead_gen'
  | 'jpc_sales'
  | 'jpc_cs'
  | 'jpc_resume'
  | 'jpc_marketing'
  | 'jpc_marketing_support'
  | 'jpc_recruiter'
  | 'jpc_proxy'
  | 'jpc_candidate'
  | 'candidate';

export type UserRole = Role;

export interface User {
  id: number | string;
  username: string;
  password?: string;
  display_name: string;
  role: Role;
  email?: string;
  temp_password?: string | null;
  candidate_id?: string | null;
  leader_id?: string | number | null;
  calendly_link?: string | null;
  calendly_token?: string;
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
  | 'application_tracking'
  | 'completed'
  | 'not_interested';

export interface CandidateFlags {
  agreement_sent: boolean;
  agreement_signed: boolean;
  qc_checklist_done: boolean;
  resume_approved: boolean;
  candidate_resume_approved: boolean;
  marketing_email_created: boolean;
  two_step_verification: boolean;
  linkedin_optimized: boolean;
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
  assigned_marketing_leader: string | number | null;
  assigned_recruiter: string | number | null;
  assigned_marketing: string | number | null;
  package_name: string;
  package_amount: number;
  domain_suggested: string;
  notes: string;
  current_stage: Stage;
  flags: CandidateFlags;
  profiles_count?: number;
  not_interested_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  temp_portal_password?: string | null;
  resume_url?: string | null;
  resume_base64?: string | null;
  resume_filename?: string | null;
  agreement_url?: string | null;
  agreement_filename?: string | null;
  remarks?: string;
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
  proof_url?: string | null;
  proof_base64?: string | null;
  proof_filename?: string | null;
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
  value?: string;
  has_text_box?: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  candidate_id: string;
  user_id: string | number | null;
  action: string;
  details: string;
  created_at: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  job_link: string;
  company_name: string;
  sheet_type?: string;
  applied_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string | number;
  sender_id: string | number | null;
  type: 'target_not_met' | 'system_alert' | 'resume_request';
  message: string;
  read: boolean;
  created_at: string;
}

export interface ResumeChangeRequest {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  details: string;
  status: 'pending_tl' | 'pending_cs' | 'pending_resume_team' | 'completed' | 'rejected';
  tl_notes?: string;
  cs_notes?: string;
  resume_team_notes?: string;
  new_resume_url?: string;
  resume_base64?: string;
  resume_filename?: string;
  created_at: string;
  updated_at: string;
}

export interface InterviewRequest {
  id: string;
  candidate_id: string;
  cs_id: string;
  proxy_id?: string;
  recruiter_id?: string;
  status: 'pending_proxy' | 'scheduled' | 'live' | 'feedback_shared' | 'result_pending' | 'next_round' | 'rejected' | 'completed';
  calendly_link?: string;
  scheduled_at?: string;
  whatsapp_group_link?: string;
  feedback?: string;
  result?: 'next_round' | 'rejected';
  cs_decision?: 'restart_marketing' | 'plan_completed';
  created_at: string;
  updated_at: string;
}
