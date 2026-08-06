import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Application, Candidate } from '../types';
import { generateId, logActivity, handleFirestoreError, OperationType } from '../services/storage';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getEasternDate, cn } from '../lib/utils';
import { 
  Link as LinkIcon, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Info, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  AlertTriangle,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BulkLinkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  existingApplications: Application[];
  onSuccess: () => void;
}

interface ParsedLink {
  id: string;
  url: string;
  originalUrl: string;
  selected: boolean;
  status: 'ready' | 'duplicate_existing' | 'duplicate_batch' | 'invalid';
}

// Normalize URLs to prevent false-positives/true-positives bypasses (stripping UTMS, ref params, www, trailing slashes, etc.)
const normalizeUrl = (urlStr: string): string => {
  try {
    let clean = urlStr.trim().toLowerCase();
    
    // Add protocol if missing for URL parsing
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    
    const parsed = new URL(clean);
    
    // Get hostname and remove www.
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.substring(4);
    }
    
    let pathName = parsed.pathname;
    // Remove trailing slash
    if (pathName.endsWith('/')) {
      pathName = pathName.substring(0, pathName.length - 1);
    }
    
    // Extract key variables for specific tracking query strings
    // We want to discard general UTMS and tracking tags, but KEEP specific parameters like jk in Indeed.
    let searchPart = '';
    if (host.includes('indeed.com')) {
      const jk = parsed.searchParams.get('jk');
      if (jk) {
        searchPart = `?jk=${jk}`;
      }
    }
    
    return `${host}${pathName}${searchPart}`;
  } catch (_) {
    return urlStr.trim().toLowerCase();
  }
};

// Attempt to extract company name from certain URLs if possible
const extractCompanyFromUrl = (urlStr: string): string | null => {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    
    const parts = host.split('.');
    if (parts.length >= 2) {
      // Ignore general job search sites so we don't treat indeed/linkedin themselves as company
      const ignoreDomains = [
        'linkedin', 'indeed', 'glassdoor', 'ziprecruiter', 'careerbuilder', 
        'monster', 'wellfound', 'angel', 'dice', 'simplyhired', 'google', 
        'github', 'jobspresso', 'lever', 'greenhouse', 'workday', 'icims'
      ];
      
      const domainIndex = parts.length - 2;
      const domain = parts[domainIndex];
      
      if (domain && !ignoreDomains.includes(domain) && !['com', 'org', 'net', 'co', 'io', 'jobs', 'careers'].includes(domain)) {
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }
  } catch (_) {}
  return null;
};

// A highly robust URL detector
const detectUrl = (text: string): string | null => {
  try {
    const trimmed = text.trim();
    if (!trimmed) return null;
    
    // Regex matching common URL formats
    const urlRegex = /(https?:\/\/[^\s,;\t]+|www\.[^\s,;\t]+\.[^\s,;\t]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\/[^\s,;\t]*)/i;
    const match = trimmed.match(urlRegex);
    if (match) {
      let url = match[0];
      // Clean trailing punctuation
      url = url.replace(/[.,;)]+$/, '');
      return url;
    }
    
    // Fallback logic for raw text URLs that don't match the regex but are URL-like (e.g. "indeed.com/job/123")
    if (trimmed.includes('.') && !trimmed.includes(' ') && trimmed.length > 5) {
      return trimmed;
    }
  } catch (_) {}
  return null;
};

export const BulkLinkImportModal: React.FC<BulkLinkImportModalProps> = ({
  isOpen,
  onClose,
  candidate,
  existingApplications,
  onSuccess
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Wizard states
  const [mode, setMode] = useState<'input' | 'review' | 'importing' | 'completed'>('input');
  const [linksText, setLinksText] = useState('');
  const [parsedLinks, setParsedLinks] = useState<ParsedLink[]>([]);
  const [progress, setProgress] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);

  // Parse list of raw links
  const handleAnalyze = () => {
    if (!candidate || !linksText.trim()) return;

    const lines = linksText.split('\n');
    const tempParsed: ParsedLink[] = [];
    const seenInBatch = new Set<string>();

    const existingCandidateApps = existingApplications.filter(
      app => app.candidate_id === candidate.id
    );

    // Create normalized set of existing applications
    const existingNormSet = new Set(
      existingCandidateApps.map(app => normalizeUrl(app.job_link))
    );

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      const url = detectUrl(trimmedLine);
      if (!url) {
        // Line has no valid URL
        tempParsed.push({
          id: generateId(),
          url: trimmedLine,
          originalUrl: trimmedLine,
          selected: false,
          status: 'invalid'
        });
        return;
      }

      let formattedUrl = url;
      if (!formattedUrl.toLowerCase().startsWith('http://') && !formattedUrl.toLowerCase().startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }

      const norm = normalizeUrl(formattedUrl);
      const isDuplicateExisting = existingNormSet.has(norm);
      const isDuplicateBatch = seenInBatch.has(norm);

      let status: ParsedLink['status'] = 'ready';
      if (isDuplicateExisting) status = 'duplicate_existing';
      else if (isDuplicateBatch) status = 'duplicate_batch';

      seenInBatch.add(norm);

      tempParsed.push({
        id: generateId(),
        url: formattedUrl,
        originalUrl: trimmedLine,
        selected: status === 'ready',
        status
      });
    });

    if (tempParsed.length === 0) {
      showToast('No valid links detected in your input.', 'error');
      return;
    }

    setParsedLinks(tempParsed);
    setMode('review');
  };

  const handleUpdateItem = (id: string, updates: Partial<ParsedLink>) => {
    setParsedLinks(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleSelectAll = (select: boolean) => {
    setParsedLinks(prev => prev.map(item => {
      if (item.status !== 'ready') {
        return { ...item, selected: false };
      }
      return { ...item, selected: select };
    }));
  };

  const handleConfirmImport = async () => {
    if (!candidate) return;

    const toImport = parsedLinks.filter(item => item.selected && item.status !== 'invalid');
    if (toImport.length === 0) {
      showToast('Please select at least one valid link to import', 'error');
      return;
    }

    setMode('importing');
    setProgress(0);
    
    let ok = 0;
    let fail = 0;
    const today = getEasternDate();

    // Import sequentially
    for (let i = 0; i < toImport.length; i++) {
      const item = toImport[i];
      const extractedCompany = extractCompanyFromUrl(item.url) || 'N/A';
      
      const newApp: Application = {
        id: item.id,
        candidate_id: candidate.id,
        recruiter_id: String(user?.id),
        job_link: item.url,
        job_title: 'N/A', // Forced to N/A as requested (No Job Title)
        company_name: extractedCompany, // Auto-detected from link or N/A
        status: 'Applied',
        notes: 'Bulk imported link',
        sheet_type: candidate.job_interest,
        applied_at: today, // Taken automatically of that day
        created_at: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'jpc_applications', item.id), newApp);
        ok++;
      } catch (error) {
        console.error('Bulk import save error:', error);
        fail++;
        try {
          handleFirestoreError(error, OperationType.WRITE, `jpc_applications/${item.id}`);
        } catch (diagError) {
          console.error("Firebase diagnostic payload logged:", diagError);
        }
      }

      setProgress(Math.round(((i + 1) / toImport.length) * 100));
    }

    setSuccessCount(ok);
    setFailCount(fail);

    if (ok > 0) {
      await logActivity(
        candidate.id, 
        'Bulk Links Imported', 
        `Successfully imported ${ok} job links in bulk.`, 
        user?.id || null
      );
      showToast(`Successfully imported ${ok} links.`, 'success');
      onSuccess();
    } else {
      showToast('Failed to import any links.', 'error');
    }

    setMode('completed');
  };

  const resetState = () => {
    setMode('input');
    setLinksText('');
    setParsedLinks([]);
    setProgress(0);
    setSuccessCount(0);
    setFailCount(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Helper stats for review step
  const readyCount = parsedLinks.filter(p => p.status === 'ready').length;
  const duplicateExistingCount = parsedLinks.filter(p => p.status === 'duplicate_existing').length;
  const duplicateBatchCount = parsedLinks.filter(p => p.status === 'duplicate_batch').length;
  const invalidCount = parsedLinks.filter(p => p.status === 'invalid').length;
  const selectedCount = parsedLinks.filter(p => p.selected && p.status !== 'invalid').length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        mode === 'review' ? "Review Bulk Links" :
        mode === 'importing' ? "Importing Bulk Links" :
        mode === 'completed' ? "Bulk Import Completed" :
        "Bulk Import Job Links"
      }
      maxWidth="max-w-[620px]"
      footer={
        <div className="flex gap-3 w-full justify-between items-center">
          {mode === 'input' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-3 h-12 bg-bg-tertiary text-text-primary text-sm font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={!linksText.trim()}
                className="px-6 py-3 h-12 bg-accent-blue text-white text-sm font-bold rounded-2xl hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2 flex-[2]"
              >
                <span>Analyze Links</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {mode === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setMode('input')}
                className="px-5 py-3 h-12 bg-bg-tertiary text-text-primary text-sm font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-5 py-3 h-12 bg-bg-tertiary hover:bg-bg-tertiary/80 font-bold text-sm text-text-secondary rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={selectedCount === 0}
                  className="px-6 py-3 h-12 bg-accent-blue text-white text-sm font-bold rounded-2xl hover:bg-accent-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-accent-blue/20 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Import ({selectedCount})</span>
                </button>
              </div>
            </>
          )}

          {mode === 'completed' && (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3 h-12 bg-accent-blue text-white text-sm font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
            >
              Close & Update Tracker
            </button>
          )}
        </div>
      }
    >
      <AnimatePresence mode="wait">
        {mode === 'input' && (
          <motion.div
            key="input-screen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-accent-blue/5 border border-accent-blue/15 rounded-2xl p-4 flex gap-4">
              <div className="w-10 h-10 bg-accent-blue/10 rounded-xl flex items-center justify-center text-accent-blue shrink-0">
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-text-primary">Bulk URL & Link Import</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Paste normal URLs directly (one link per line). We automatically extract the links and detect duplicates.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Paste Links Here</label>
              </div>
              <textarea
                value={linksText}
                onChange={(e) => setLinksText(e.target.value)}
                placeholder="Paste URLs here, one per line. For example:&#10;https://linkedin.com/jobs/view/1234&#10;https://indeed.com/viewjob?jk=5678&#10;https://wellfound.com/jobs/9012"
                className="w-full h-64 bg-bg-tertiary border border-border-primary rounded-2xl p-4 text-xs font-mono text-text-primary focus:border-accent-blue focus:outline-none focus:ring-0 resize-none transition-colors placeholder:text-text-muted/40"
              />
            </div>

            <div className="bg-bg-tertiary rounded-2xl p-4 border border-border-primary/50 text-[11px] text-text-secondary space-y-2">
              <div className="flex items-center gap-2 text-accent-blue">
                <Info className="w-3.5 h-3.5" />
                <span className="font-bold uppercase tracking-wider">Automated Rules:</span>
              </div>
              <ul className="list-disc pl-4 space-y-1 text-text-muted">
                <li>Paste any standard job list URLs directly, one per line.</li>
                <li>Applied Date will be set automatically to <strong>Today ({getEasternDate()})</strong> with status <strong>"Applied"</strong>.</li>
                <li>No Job Titles or manual inputs required.</li>
              </ul>
            </div>
          </motion.div>
        )}

        {mode === 'review' && (
          <motion.div
            key="review-screen"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Header info bar */}
            <div className="flex flex-col gap-4 bg-bg-tertiary/40 border border-border-primary/50 rounded-2xl p-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Target Candidate</span>
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-blue" />
                  {candidate?.full_name}
                  <span className="text-[10px] font-bold text-text-muted uppercase bg-bg-tertiary px-2 py-0.5 rounded border border-border-primary ml-1">
                    {candidate?.job_interest || 'General'}
                  </span>
                </h4>
              </div>
              
              {/* Counter Pill Grid */}
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <div className="px-2.5 py-1 bg-accent-blue/10 border border-accent-blue/20 text-accent-blue rounded-xl flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse" />
                  Ready: {readyCount}
                </div>
                {duplicateExistingCount > 0 && (
                  <div className="px-2.5 py-1 bg-accent-red/10 border border-accent-red/25 text-accent-red rounded-xl flex items-center gap-1.5" title="Previously imported for this candidate">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Dup: {duplicateExistingCount}
                  </div>
                )}
                {duplicateBatchCount > 0 && (
                  <div className="px-2.5 py-1 bg-accent-amber/15 border border-accent-amber/30 text-accent-amber rounded-xl flex items-center gap-1.5" title="Duplicate link found inside the currently pasted block">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Batch Dup: {duplicateBatchCount}
                  </div>
                )}
                {invalidCount > 0 && (
                  <div className="px-2.5 py-1 bg-bg-tertiary border border-border-primary text-text-muted rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Invalid: {invalidCount}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex items-center justify-between text-xs px-1">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-accent-blue hover:underline font-bold"
                >
                  Select All
                </button>
                <span className="text-border-primary">|</span>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-text-muted hover:text-text-primary hover:underline font-medium"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {/* Simple table of URLs */}
            <div className="max-h-[45vh] overflow-y-auto rounded-2xl border border-border-primary bg-bg-secondary shadow-inner">
              <table className="w-full text-left border-collapse table-fixed min-w-full">
                <thead>
                  <tr className="bg-bg-tertiary border-b border-border-primary sticky top-0 z-10 shadow-sm">
                    <th className="w-16 px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Import</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest">Job Link (URL)</th>
                    <th className="w-32 px-4 py-3 text-[10px] font-bold text-text-muted uppercase tracking-widest text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/50">
                  {parsedLinks.map((item) => {
                    return (
                      <tr 
                        key={item.id} 
                        className={cn(
                          "transition-colors",
                          item.selected ? "bg-accent-blue/[0.02]" : "bg-transparent opacity-75 grayscale-[20%]",
                          item.status === 'invalid' && "bg-accent-red/[0.01]"
                        )}
                      >
                        {/* Checkbox select */}
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={item.status !== 'ready'}
                            onChange={(e) => handleUpdateItem(item.id, { selected: e.target.checked })}
                            className="w-4 h-4 rounded text-accent-blue bg-bg-tertiary border-border-primary focus:ring-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                          />
                        </td>

                        {/* URL info */}
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-1.5 max-w-full">
                            <span 
                              className="font-mono text-text-primary truncate max-w-[280px] font-medium"
                              title={item.url}
                            >
                              {item.url}
                            </span>
                            {item.status !== 'invalid' && (
                              <a 
                                href={item.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-text-muted hover:text-accent-blue p-0.5 block transition-colors shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3 text-center text-[10px] font-bold uppercase shrink-0">
                          {item.status === 'ready' && (
                            <span className="px-2.5 py-1 bg-accent-blue/10 text-accent-blue rounded-lg">
                              Ready
                            </span>
                          )}
                          {item.status === 'duplicate_existing' && (
                            <span className="px-2.5 py-1 bg-accent-red/10 text-accent-red rounded-lg" title="Duplicate link previously imported in database">
                              Duplicate
                            </span>
                          )}
                          {item.status === 'duplicate_batch' && (
                            <span className="px-2.5 py-1 bg-accent-amber/15 text-accent-amber rounded-lg" title="Duplicate link listed multiple times in your current paste">
                              Batch Dup
                            </span>
                          )}
                          {item.status === 'invalid' && (
                            <span className="px-2.5 py-1 bg-bg-tertiary text-text-muted rounded-lg" title="Invalid URL line. Cannot import.">
                              Invalid
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Warning when some duplicates are skipped */}
            {(duplicateExistingCount > 0 || duplicateBatchCount > 0) && (
              <div className="bg-accent-amber/10 border border-accent-amber/25 rounded-2xl p-4 flex gap-3 text-xs text-text-secondary">
                <AlertTriangle className="w-5 h-5 text-accent-amber shrink-0" />
                <p>
                  We detected duplicate links in your pasted list. To prevent database clutter, **duplicate entries have been blocked and cannot be selected or imported**.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {mode === 'importing' && (
          <motion.div
            key="importing-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-accent-blue" />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-accent-blue">
                {progress}%
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-base font-bold text-text-primary">Executing Bulk Import</h4>
              <p className="text-sm text-text-muted">Creating Firestore documents for your selected jobs...</p>
            </div>
            <div className="w-64 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
              <div 
                style={{ width: `${progress}%` }}
                className="h-full bg-accent-blue rounded-full transition-all duration-100"
              />
            </div>
          </motion.div>
        )}

        {mode === 'completed' && (
          <motion.div
            key="completed-screen"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="py-12 flex flex-col items-center justify-center text-center space-y-6"
          >
            <div className="w-16 h-16 bg-accent-blue/10 border border-accent-blue/20 rounded-full flex items-center justify-center text-accent-blue">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-bold text-text-primary">Bulk Import Successful!</h4>
              <p className="text-sm text-text-secondary px-6">
                Successfully processed <strong>{successCount}</strong> job entries for <strong>{candidate?.full_name}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-4">
              <div className="bg-bg-tertiary border border-border-primary/50 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Imported Successfully</span>
                <span className="text-2xl font-black text-accent-blue block mt-1">{successCount}</span>
              </div>
              <div className="bg-bg-tertiary border border-border-primary/50 rounded-2xl p-4">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Failed Saves</span>
                <span className={cn("text-2xl font-black block mt-1", failCount > 0 ? "text-accent-red" : "text-text-muted")}>
                  {failCount}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};
