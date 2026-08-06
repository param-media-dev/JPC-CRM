import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { uploadFile } from '../services/fileService';
import { addResumeSubstitutionRequest } from '../services/storage';
import { InterviewSupportRequest } from '../types';

interface ResumeSubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: InterviewSupportRequest;
}

export const ResumeSubstitutionModal: React.FC<ResumeSubstitutionModalProps> = ({ 
  isOpen, 
  onClose, 
  request 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [substitutionType, setSubstitutionType] = useState<'new_resume' | 'na'>('new_resume');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (substitutionType === 'na') {
      onClose();
      return;
    }
    
    if (!selectedFile) return;
    setIsUploading(true);
    try {
      // 1. Upload the file to get URL
      const resumeUrl = await uploadFile(selectedFile);
      
      // 2. Save substitution request to Firestore
      await addResumeSubstitutionRequest({
        interview_request_id: request.id,
        candidate_id: request.candidate_id,
        new_resume_url: resumeUrl,
        new_resume_filename: selectedFile.name,
        status: 'pending'
      });

      showToast('New resume uploaded and sent to proxy team!', 'success');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Failed to upload and send resume.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Use Other Resume"
      footer={
        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-text-secondary font-bold"
            disabled={isUploading}
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={(substitutionType === 'new_resume' && !selectedFile) || isUploading}
            className="px-6 py-2 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 disabled:opacity-50 transition-all shadow-lg shadow-accent-blue/20"
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (substitutionType === 'na' ? 'Close' : 'Submit to Proxy Team')}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <p className="text-sm text-text-secondary">
          Select option for this interview resume substitution.
        </p>

        <div className="space-y-3">
          <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-bg-tertiary">
            <input 
              type="radio" 
              name="sub-type" 
              value="new_resume" 
              checked={substitutionType === 'new_resume'}
              onChange={() => setSubstitutionType('new_resume')}
            />
            <span className="font-bold text-text-primary">Use new resume</span>
          </label>
          <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-bg-tertiary">
            <input 
              type="radio" 
              name="sub-type" 
              value="na" 
              checked={substitutionType === 'na'}
              onChange={() => setSubstitutionType('na')}
            />
            <span className="font-bold text-text-primary">N/A (No substitution)</span>
          </label>
        </div>

        {substitutionType === 'new_resume' && (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border-primary rounded-3xl p-8 flex flex-col items-center justify-center hover:border-accent-blue hover:bg-accent-blue/5 transition-all cursor-pointer group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx"
            />
            {selectedFile ? (
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-accent-blue" />
                <span className="font-bold text-text-primary">{selectedFile.name}</span>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}>
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 bg-bg-tertiary rounded-2xl flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-text-muted" />
                </div>
                <p className="font-bold text-text-primary">Click to select resume</p>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
