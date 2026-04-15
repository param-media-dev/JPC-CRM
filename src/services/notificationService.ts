/**
 * notificationService.ts
 * 
 * Central notification service for JPC CRM.
 * All notification logic is here — import and call from any page.
 * 
 * Place this file at: src/services/notificationService.ts
 */

import { addNotification } from './storage';
import { User, Candidate, Stage, InterviewRequest, ResumeChangeRequest } from '../types';

// ─────────────────────────────────────────────
// Helper: send to multiple recipients at once
// ─────────────────────────────────────────────
const notify = async (
  recipientIds: (string | number | null | undefined)[],
  senderId: string | number | null,
  message: string,
  type: 'system_alert' | 'resume_request' | 'target_not_met' = 'system_alert'
) => {
  const uniqueIds = [...new Set(
    recipientIds
      .filter(Boolean)
      .map(id => String(id))
  )];

  await Promise.all(
    uniqueIds.map(id =>
      addNotification({
        recipient_id: id,
        sender_id: senderId ? String(senderId) : null,
        type,
        message,
      })
    )
  );
};

// ─────────────────────────────────────────────────────────────────
// 1. CANDIDATE ASSIGNED to a role
//    Triggered: when admin/manager assigns a user to a candidate
// ─────────────────────────────────────────────────────────────────
export const notifyAssignment = async (
  candidate: Candidate,
  assignedUserId: string | number,
  roleLabel: string,
  senderId: string | number | null
) => {
  await notify(
    [assignedUserId],
    senderId,
    `You have been assigned as ${roleLabel} for candidate ${candidate.full_name}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 2. STAGE MOVED
//    Triggered: when a candidate moves from one pipeline stage to next
//    Notifies: all team members assigned to that candidate + manager
// ─────────────────────────────────────────────────────────────────
export const notifyStageMove = async (
  candidate: Candidate,
  oldStageLabel: string,
  newStageLabel: string,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const teamIds = [
    candidate.assigned_sales,
    candidate.assigned_cs,
    candidate.assigned_recruiter,
    candidate.assigned_resume,
    candidate.assigned_marketing,
    candidate.assigned_marketing_leader,
  ];

  // Also notify managers and admins
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [...teamIds, ...managers],
    senderId,
    `Candidate ${candidate.full_name} moved from "${oldStageLabel}" → "${newStageLabel}".`
  );
};

// ─────────────────────────────────────────────────────────────────
// 3. LEAD ASSIGNED TO SALES
//    Triggered: when lead_gen assigns a lead to a sales user
// ─────────────────────────────────────────────────────────────────
export const notifyLeadAssignedToSales = async (
  candidate: Candidate,
  salesUserId: string | number,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [salesUserId, ...managers],
    senderId,
    `New lead assigned to you: ${candidate.full_name}. Please follow up!`
  );
};

// ─────────────────────────────────────────────────────────────────
// 4. NEW CANDIDATE ADDED
//    Triggered: when a new candidate is created
//    Notifies: admin + manager
// ─────────────────────────────────────────────────────────────────
export const notifyNewCandidate = async (
  candidate: Candidate,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    managers,
    senderId,
    `New candidate added: ${candidate.full_name} (${candidate.job_interest || 'No domain specified'}).`
  );
};

// ─────────────────────────────────────────────────────────────────
// 5. NOTES UPDATED
//    Triggered: when notes are changed on a candidate
//    Notifies: all team members on that candidate
// ─────────────────────────────────────────────────────────────────
export const notifyNotesUpdated = async (
  candidate: Candidate,
  senderId: string | number | null
) => {
  await notify(
    [candidate.assigned_sales, candidate.assigned_cs, candidate.assigned_recruiter],
    senderId,
    `Notes updated for candidate ${candidate.full_name}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 6. EDUCATION/INFO UPDATED
//    Triggered: when education or personal info is saved
// ─────────────────────────────────────────────────────────────────
export const notifyInfoUpdated = async (
  candidate: Candidate,
  section: string,
  senderId: string | number | null
) => {
  await notify(
    [candidate.assigned_sales, candidate.assigned_cs, candidate.assigned_recruiter],
    senderId,
    `${section} updated for candidate ${candidate.full_name}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 7. FOLLOW-UP CREATED
//    Triggered: when a follow-up is added
//    Notifies: the assigned sales + cs of that candidate
// ─────────────────────────────────────────────────────────────────
export const notifyFollowUpCreated = async (
  candidate: Candidate,
  followUpDate: string,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [candidate.assigned_sales, candidate.assigned_cs, ...managers],
    senderId,
    `Follow-up scheduled for ${candidate.full_name} on ${followUpDate}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 8. RESUME REQUEST CREATED
//    Triggered: when recruiter requests resume change
//    Notifies: marketing leader (TL)
// ─────────────────────────────────────────────────────────────────
export const notifyResumeRequestCreated = async (
  candidate: Candidate,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const marketingLeader = candidate.assigned_marketing_leader;
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [marketingLeader, ...managers],
    senderId,
    `New resume change request raised for ${candidate.full_name}. Please review.`,
    'resume_request'
  );
};

// ─────────────────────────────────────────────────────────────────
// 9. RESUME REQUEST STATUS UPDATED
//    Triggered: when TL/CS/Resume team updates the request status
//    Notifies: the recruiter who raised it
// ─────────────────────────────────────────────────────────────────
export const notifyResumeRequestUpdated = async (
  candidateName: string,
  recruiterId: string | number,
  newStatus: string,
  senderId: string | number | null
) => {
  await notify(
    [recruiterId],
    senderId,
    `Your resume request for ${candidateName} has been updated to: ${newStatus.replace(/_/g, ' ')}.`,
    'resume_request'
  );
};

// ─────────────────────────────────────────────────────────────────
// 10. INTERVIEW REQUEST CREATED
//     Triggered: when CS creates an interview support request
//     Notifies: proxy team members
// ─────────────────────────────────────────────────────────────────
export const notifyInterviewRequestCreated = async (
  candidate: Candidate,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const proxyUsers = allUsers.filter(u => u.role === 'jpc_proxy').map(u => u.id);
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [...proxyUsers, ...managers],
    senderId,
    `New interview support request for ${candidate.full_name}. Please schedule.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 11. INTERVIEW SCHEDULED
//     Triggered: when proxy schedules the interview
//     Notifies: CS team + recruiter + candidate's team
// ─────────────────────────────────────────────────────────────────
export const notifyInterviewScheduled = async (
  candidate: Candidate,
  interview: InterviewRequest,
  scheduledAt: string,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [interview.cs_id, interview.recruiter_id, candidate.assigned_sales, ...managers],
    senderId,
    `Interview scheduled for ${candidate.full_name} on ${new Date(scheduledAt).toLocaleString()}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 12. INTERVIEW FEEDBACK SHARED
//     Triggered: when proxy shares feedback after interview
//     Notifies: CS + recruiter
// ─────────────────────────────────────────────────────────────────
export const notifyInterviewFeedback = async (
  candidate: Candidate,
  interview: InterviewRequest,
  senderId: string | number | null
) => {
  await notify(
    [interview.cs_id, interview.recruiter_id],
    senderId,
    `Interview feedback shared for ${candidate.full_name}. Please review and update the result.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 13. INTERVIEW RESULT UPDATED
//     Triggered: when recruiter marks next_round or rejected
//     Notifies: CS + manager
// ─────────────────────────────────────────────────────────────────
export const notifyInterviewResult = async (
  candidate: Candidate,
  interview: InterviewRequest,
  result: string,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [interview.cs_id, candidate.assigned_sales, ...managers],
    senderId,
    `Interview result for ${candidate.full_name}: ${result === 'next_round' ? '✅ Next Round' : '❌ Rejected'}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 14. TARGET NOT MET (Application Tracker)
//     Triggered: auto after 5 PM if target not met
//     Notifies: TL + manager
// ─────────────────────────────────────────────────────────────────
export const notifyTargetNotMet = async (
  recruiterName: string,
  candidateName: string,
  progress: number,
  target: number,
  tlId: string | number,
  managerId: string | number | null,
  senderId: string | number | null
) => {
  const message = `Target not met: ${recruiterName} completed ${progress}/${target} applications for ${candidateName}.`;
  await notify([tlId, managerId], senderId, message, 'target_not_met');
};

// ─────────────────────────────────────────────────────────────────
// 15. PAYMENT ADDED
//     Triggered: when a payment is recorded
//     Notifies: admin + manager
// ─────────────────────────────────────────────────────────────────
export const notifyPaymentAdded = async (
  candidate: Candidate,
  amount: number,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [...managers, candidate.assigned_sales, candidate.assigned_cs],
    senderId,
    `Payment of $${amount} recorded for ${candidate.full_name}.`
  );
};

// ─────────────────────────────────────────────────────────────────
// 16. CANDIDATE MARKED NOT INTERESTED
//     Triggered: when stage moves to not_interested
//     Notifies: all team + managers
// ─────────────────────────────────────────────────────────────────
export const notifyNotInterested = async (
  candidate: Candidate,
  senderId: string | number | null,
  allUsers: User[]
) => {
  const managers = allUsers
    .filter(u => u.role === 'administrator' || u.role === 'jpc_manager')
    .map(u => u.id);

  await notify(
    [
      candidate.assigned_sales,
      candidate.assigned_cs,
      candidate.assigned_recruiter,
      candidate.lead_generated_by,
      ...managers,
    ],
    senderId,
    `Candidate ${candidate.full_name} has been marked as Not Interested.`
  );
};
