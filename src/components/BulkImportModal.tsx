import React, { useState, useRef, useEffect } from 'react';
import { Modal } from './Modal';
import { STAGES, LEAD_SOURCES } from '../constants';
import { generateId, saveCandidate, seedQCChecklist, logActivity, checkDuplicateCandidate } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Candidate, Stage, User } from '../types';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download, Table } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState<Stage>('lead_generation');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'jpc_users'));
        setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      } catch (error) {
        console.error('Error fetching users for import:', error);
      }
    };
    fetchUsers();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast('Please upload a CSV file', 'error');
      return;
    }

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        if (!rows || rows.length === 0) {
          showToast('No data found in CSV', 'error');
          return;
        }

        // Search for header row
        let headerIndex = -1;
        const keywords = ['name', 'mobile', 'phone', 'location', 'tl', 'recruiter'];
        
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const row = rows[i].map(cell => (cell || '').toString().toLowerCase());
          const hasKeywords = keywords.some(k => row.some(cell => cell.includes(k)));
          if (hasKeywords) {
            headerIndex = i;
            break;
          }
        }

        if (headerIndex === -1) {
          // Fallback: assume first row or use direct object if it worked before
          // But usually this means we didn't find headers
          showToast('Could not find header row in CSV. Please ensure columns like "Candidate Name" or "Mobile Number" are present.', 'error');
          return;
        }

        const headers = rows[headerIndex].map(h => h.trim());
        const dataRows = rows.slice(headerIndex + 1);

        const dataObjects = dataRows.map(row => {
          const obj: any = {};
          headers.forEach((h, index) => {
            if (h) obj[h] = row[index];
          });
          return obj;
        }).filter(obj => {
          // Basic validation: must have some data to be a valid candidate row
          const values = Object.values(obj).join('').trim();
          return values.length > 10; // Simple check to skip "Mohit Team" lines
        });

        if (dataObjects.length > 0) {
          setParsedData(dataObjects);
          showToast(`Found ${dataObjects.length} records in CSV`, 'success');
        } else {
          showToast('No data found in CSV', 'error');
        }
      },
      error: (error) => {
        showToast(`Error parsing CSV: ${error.message}`, 'error');
      }
    });
  };

  const downloadTemplate = () => {
    const headers = [
      'full_name', 'phone', 'email', 'whatsapp', 'location', 
      'job_interest', 'domain_interested', 'education', 
      'experience_years', 'current_designation', 'skills', 
      'linkedin_url', 'notes', 'stage'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'John Doe,+91 9876543210,john@example.com,+91 9876543210,Mumbai,Software Engineer,IT,B.Tech,3 years,SDE,React Node.js,https://linkedin.com/in/johndoe,Passionate developer,lead_generation';
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'candidate_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    const total = parsedData.length;

    for (let i = 0; i < total; i++) {
      const row = parsedData[i];
      // Normalize row keys (trim spaces)
      const normalizedRow: any = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.trim()] = row[key];
      });

      const fullName = (normalizedRow.full_name || normalizedRow.Name || normalizedRow['Full Name'] || normalizedRow['Candidate Name'] || '').toString().trim();
      const phone = (normalizedRow.phone || normalizedRow.Phone || normalizedRow['Phone Number'] || normalizedRow['Moblie Nomber'] || normalizedRow['Moblie Nomber '] || '').toString().trim();
      const email = (normalizedRow.email || normalizedRow.Email || '').toString().trim();
      
      const tlNameInput = normalizedRow['Team Leader'] || normalizedRow.team_leader || normalizedRow.Leader;
      const recruiterNameInput = normalizedRow.Recruiter || normalizedRow.recruiter;

      const findUserIdByName = (name: any) => {
        if (!name) return null;
        const cleanName = name.toString().toLowerCase().trim();
        if (!cleanName) return null;
        
        const matchedUser = allUsers.find(u => 
          u.display_name.toLowerCase().trim() === cleanName || 
          u.username.toLowerCase().trim() === cleanName ||
          u.display_name.toLowerCase().trim().includes(cleanName)
        );
        return matchedUser ? String(matchedUser.id) : null;
      };

      const assignedLeaderId = findUserIdByName(tlNameInput);
      const assignedRecruiterId = findUserIdByName(recruiterNameInput);
      
      // Determine stage: priority to CSV column, fallback to selected stage
      let candidateStage: Stage = selectedStage;
      const csvStageRaw = (normalizedRow.stage || normalizedRow.current_stage || '').toString().toLowerCase().trim();
      
      if (csvStageRaw) {
        // 1. Try direct key match
        if (STAGES[csvStageRaw as Stage]) {
          candidateStage = csvStageRaw as Stage;
        } else {
          // 2. Try numeric match (1, 2, 3...)
          const stageNumber = parseInt(csvStageRaw);
          if (!isNaN(stageNumber)) {
            const matchedKey = (Object.keys(STAGES) as Stage[]).find(key => 
              STAGES[key].label.startsWith(`${stageNumber}.`) || 
              STAGES[key].label.startsWith(stageNumber.toString())
            );
            if (matchedKey) candidateStage = matchedKey;
          } else {
            // 3. Try label match (case insensitive, partial)
            const matchedKey = (Object.keys(STAGES) as Stage[]).find(key => {
              const label = STAGES[key].label.toLowerCase();
              // Remove "1. ", "2. " etc for cleaner matching
              const cleanLabel = label.replace(/^\d+\.\s*/, '');
              return label.includes(csvStageRaw) || cleanLabel.includes(csvStageRaw) || csvStageRaw.includes(cleanLabel);
            });
            if (matchedKey) candidateStage = matchedKey;
          }
        }
      }

      if (!fullName || !phone) {
        failCount++;
        continue;
      }

      try {
        // Quick check for duplicates (optional, might slow down bulk import significantly)
        // const duplicateError = await checkDuplicateCandidate(phone, email, row.whatsapp);
        // if (duplicateError) {
        //   failCount++;
        //   continue;
        // }

        const id = generateId();
        const newCandidate: Candidate = {
          id,
          full_name: fullName,
          phone: phone,
          whatsapp: row.whatsapp || phone,
          email: email || '',
          job_interest: row.job_interest || '',
          domain_interested: row.domain_interested || '',
          location: normalizedRow.location || normalizedRow.Location || '',
          education: normalizedRow.education || normalizedRow.Education || '',
          degree: normalizedRow.degree || normalizedRow.Degree || '',
          university: normalizedRow.university || normalizedRow.University || '',
          graduation_year: normalizedRow.graduation_year || normalizedRow['Graduation Year'] || '',
          experience_years: normalizedRow.experience_years || normalizedRow.Experience || '',
          current_company: normalizedRow.current_company || 'N/A',
          current_designation: normalizedRow.current_designation || normalizedRow.Designation || '',
          skills: normalizedRow.skills || normalizedRow.Skills || '',
          linkedin_url: normalizedRow.linkedin_url || normalizedRow.LinkedIn || '',
          lead_source: normalizedRow.lead_source || 'Bulk Import',
          lead_generated_by: user?.id || null,
          assigned_sales: null,
          assigned_cs: null,
          assigned_resume: null,
          assigned_marketing_leader: assignedLeaderId,
          assigned_recruiter: assignedRecruiterId,
          assigned_marketing: null,
          package_name: '',
          package_amount: 0,
          domain_suggested: '',
          notes: normalizedRow.notes || normalizedRow.Notes || 'Bulk imported record.',
          current_stage: candidateStage,
          flags: {
            agreement_sent: false,
            agreement_signed: false,
            qc_checklist_done: false,
            resume_approved: false,
            candidate_resume_approved: false,
            marketing_email_created: false,
            two_step_verification: false,
            linkedin_optimized: false,
            marketing_started: false
          },
          not_interested_at: null,
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await saveCandidate(newCandidate, user?.id ? String(user.id) : null);
        await seedQCChecklist(id);
        await logActivity(id, 'Candidate imported', `Candidate ${fullName} added via bulk import.`, user?.id ? String(user.id) : null);
        successCount++;
      } catch (err) {
        console.error('Import row error:', err);
        failCount++;
      }

      setImportProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsImporting(false);
    showToast(`Import complete: ${successCount} success, ${failCount} failed.`, successCount > 0 ? 'success' : 'error');
    if (successCount > 0) {
      onSuccess();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Bulk Import Candidates"
      footer={
        <>
          <button 
            onClick={onClose}
            className="px-4 py-2 text-text-secondary font-medium hover:text-text-primary transition-colors"
            disabled={isImporting}
          >
            Cancel
          </button>
          {!isImporting && parsedData.length > 0 && (
            <button 
              onClick={handleImport}
              className="px-6 py-2 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
            >
              Start Import ({parsedData.length} Records)
            </button>
          )}
        </>
      }
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {isImporting ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-bg-tertiary stroke-current"
                  strokeWidth="8"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                ></circle>
                <circle
                  className="text-accent-blue stroke-current transition-all duration-500"
                  strokeWidth="8"
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  strokeDasharray={`${importProgress * 2.51}, 251.2`}
                  transform="rotate(-90 50 50)"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-text-primary">
                {importProgress}%
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-text-primary">Importing Data...</h3>
              <p className="text-text-secondary text-sm mt-1">Please do not close this modal until the process is complete.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-6 bg-accent-blue/5 border border-accent-blue/20 rounded-3xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-accent-blue/20 rounded-2xl flex items-center justify-center text-accent-blue shrink-0">
                  <Table className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Import from CSV</h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Upload a CSV file with your candidate records. Ensure columns like <b>full_name</b> and <b>phone</b> are included.
                  </p>
                  <button 
                    onClick={downloadTemplate}
                    className="mt-4 flex items-center gap-2 text-xs font-bold text-accent-blue uppercase tracking-widest hover:underline"
                  >
                    <Download className="w-3 h-3" />
                    Download CSV Template
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">Initial Stage for Imported Candidates</label>
                <select
                  value={selectedStage}
                  onChange={e => setSelectedStage(e.target.value as Stage)}
                  className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
                >
                  {Object.entries(STAGES).map(([key, info]) => (
                    <option key={key} value={key}>{info.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">CSV File</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border-primary rounded-3xl p-10 flex flex-col items-center justify-center hover:border-accent-blue hover:bg-accent-blue/5 transition-all cursor-pointer group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".csv"
                  />
                  <div className="w-16 h-16 bg-bg-tertiary rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-text-muted group-hover:text-accent-blue" />
                  </div>
                  <p className="font-bold text-text-primary">
                    {parsedData.length > 0 ? `File Selected: ${parsedData.length} records found` : 'Click to select CSV file'}
                  </p>
                  <p className="text-sm text-text-muted mt-1">Only .csv files are supported</p>
                </div>
              </div>
            </div>

            {parsedData.length > 0 && (
              <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary overflow-hidden">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 px-1">Preview (First 5 Rows)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border-primary">
                        <th className="pb-2 font-bold text-text-secondary pr-4">Name</th>
                        <th className="pb-2 font-bold text-text-secondary pr-4">Phone</th>
                        <th className="pb-2 font-bold text-text-secondary pr-4">TL / Recruiter</th>
                        <th className="pb-2 font-bold text-text-secondary">Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-primary/50">
                      {parsedData.slice(0, 5).map((row, idx) => {
                        // Normalize row keys (trim spaces)
                        const normalizedRow: any = {};
                        Object.keys(row).forEach(key => {
                          normalizedRow[key.trim()] = row[key];
                        });

                        const csvStage = (normalizedRow.stage || normalizedRow.current_stage || '').toLowerCase().trim();
                        const displayStage = STAGES[csvStage as Stage]?.label || STAGES[selectedStage].label;
                        
                        const tlName = normalizedRow['Team Leader'] || normalizedRow.team_leader || normalizedRow.Leader;
                        const recName = normalizedRow.Recruiter || normalizedRow.recruiter;

                        return (
                          <tr key={idx}>
                            <td className="py-2 text-text-primary pr-4 truncate max-w-[120px] font-medium">{normalizedRow.full_name || normalizedRow.Name || normalizedRow['Full Name'] || normalizedRow['Candidate Name'] || '—'}</td>
                            <td className="py-2 text-text-primary pr-4">{normalizedRow.phone || normalizedRow.Phone || normalizedRow['Phone Number'] || normalizedRow['Moblie Nomber'] || normalizedRow['Moblie Nomber '] || '—'}</td>
                            <td className="py-2 text-text-primary pr-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-text-primary font-bold truncate max-w-[100px]">{tlName || '—'}</span>
                                <span className="text-[9px] text-text-muted truncate max-w-[100px]">{recName || '—'}</span>
                              </div>
                            </td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 bg-bg-secondary border border-border-primary rounded text-[10px] font-bold text-text-secondary uppercase">
                                {displayStage}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
