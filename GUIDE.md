# Placify: Roles & Permissions Documentation

Welcome to Placify. This document provides a comprehensive guide on how roles and permissions are structured within the application to ensure data security, workflow integrity, and the principle of least privilege.

---

## 1. User Roles Overview

The CRM uses a Role-Based Access Control (RBAC) system. Each user is assigned a specific role that determines what they can see and do.

### Core Management Roles
*   **Administrator (`administrator`)**: Full system access. Can manage users, view all candidate data, monitor all dashboards, and override any stage.
*   **Manager (`manager`)**: High-level access similar to Admin. Focused on team performance and overall pipeline monitoring.
*   **System Admin (`sysadmin`)**: Technical role focused on system flags (e.g., 2-step verification, email creation) and technical configurations.

### Operational Roles
*   **Lead Generation (`lead_gen`)**: Responsible for adding new leads to the system. They can only see the leads they have generated.
*   **Sales (`sales`)**: Handles the initial conversion of leads. Assigned by Lead Gen.
*   **Customer Service (`cs`)**: The "hub" of the onboarding process. Handles QC calls, agreements, payment tracking, and assigning recruiters.
*   **Recruiter (`recruiter`)**: Manages the day-to-day job applications for assigned candidates. They track targets and request resume updates.
*   **Resume Team (`resume`)**: Specialized role for modifying and uploading resumes based on recruiter requests.
*   **Marketing Team (`marketing`)**: Handles LinkedIn optimization and approves resume change requests (as Team Leaders).
*   **Proxy Team (`proxy`)**: Provides interview support, handles scheduling, and records interview feedback.

### Candidate Role
*   **Candidate (`candidate`)**: The individual being placed. They have access to their own "Candidate Portal" to view their progress, payments, and interview schedule.

---

## 2. Permissions Matrix

| Feature / Page | Admin/Manager | CS | Recruiter | Lead Gen | Resume | Proxy | Marketing |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Dashboard (All Stats)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Dashboard (Personal Stats)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Add Candidate** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View All Candidates** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View Assigned Candidates** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit Package/Payments** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **QC Checklist** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **App Tracker** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Resume Log Book** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Interview Support** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Team Management** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 3. The Workflow Lifecycle

The CRM enforces a structured workflow to move a candidate from a lead to a successful placement.

### Step 1: Lead Generation
*   **Role**: `lead_gen`
*   **Action**: Adds a new candidate via the "Add Candidate" modal.
*   **Assignment**: Must select an **Assigned Sales** person.
*   **Visibility**: The lead is only visible to the creator and the assigned sales person.

### Step 2: Sales Conversion
*   **Role**: `sales`
*   **Action**: Contacts the lead, pitches the services, and moves the candidate to the `sales` stage.

### Step 3: CS Onboarding & QC
*   **Role**: `cs`
*   **Action**: Performs a **QC Call**.
*   **Checklist**: Must complete the "QC Call Checklist" in the Candidate Detail page.
*   **Agreement**: Sends and tracks the agreement status via Status Flags.
*   **Payments**: Sets up the payment plan (Part 1, Part 2, etc.).

### Step 4: Resume Preparation
*   **Role**: `recruiter` -> `marketing` -> `cs` -> `resume`
*   **Action**: Recruiter requests a resume update in the **Resume Log Book**.
*   **Approval**: Marketing TL approves -> CS forwards -> Resume Team uploads the final file.

### Step 5: Marketing & Application Tracking
*   **Role**: `recruiter`
*   **Action**: Logs daily job applications in the **App Tracker**.
*   **Target**: System monitors if the daily target (e.g., 40 apps) is met. Alerts are sent to Admin if targets are missed.

### Step 6: Interview Support
*   **Role**: `proxy`
*   **Action**: When a company responds, an interview is scheduled. The Proxy team provides support and logs feedback/results.

### Step 7: Completion
*   **Role**: `administrator` / `manager`
*   **Action**: Once the candidate is placed, they are moved to the `completed` stage.

---

## 4. Data Visibility Rules

To maintain privacy and focus, data is filtered automatically:

1.  **Recruiters**: Only see candidates assigned to them in the Pipeline, Candidates list, and Dashboard.
2.  **Lead Gen**: Only see candidates they created.
3.  **Dashboard**: Statistics (Active, Completed, Not Interested) are calculated based on the user's role. A recruiter sees *their* counts, while an Admin sees *total* counts.
4.  **Candidate Detail**: Sensitive sections like "Payments" and "QC Checklist" are hidden from roles that don't need them (e.g., Lead Gen or Resume Team).

---

## 5. Admin Guide: Managing Users

Administrators can manage the team via the **Team** page (`#team`).

1.  **Adding Users**: Create accounts for new team members and assign them one of the roles listed in Section 1.
2.  **Password Management**: Admins can see/reset temporary passwords for team members and candidates.
3.  **Role Changes**: If a team member changes departments, update their role to immediately adjust their permissions across the CRM.

---

*Last Updated: April 14, 2026*
