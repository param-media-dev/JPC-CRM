import React, { useState, useEffect } from 'react';
import { listFiles, CVFile, handleViewFile } from '../services/fileService';
import { 
  FileText, 
  Search, 
  Download, 
  Calendar, 
  User, 
  Mail, 
  Phone,
  Loader2,
  RefreshCcw,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';

export const CVRepository: React.FC = () => {
  const [files, setFiles] = useState<CVFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const data = await listFiles();
      setFiles(data);
    } catch (error) {
      console.error('Fetch error:', error);
      showToast('Failed to load CV repository', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight font-heading">CV Repository</h1>
          <p className="text-text-secondary mt-1">Centralized storage for all uploaded candidate resumes.</p>
        </div>
        <button 
          onClick={fetchFiles}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-bg-secondary border border-border-primary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary shadow-sm">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Total Resumes</p>
          <p className="text-3xl font-black text-text-primary">{files.length}</p>
        </div>
        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary shadow-sm">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Recent Uploads</p>
          <p className="text-3xl font-black text-accent-blue">
            {files.filter(f => {
              const uploadDate = new Date(f.date.replace(' ', 'T'));
              const today = new Date();
              return today.getTime() - uploadDate.getTime() < 86400000 * 7; // Last 7 days
            }).length}
          </p>
        </div>
        <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary shadow-sm">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Unique Emails</p>
          <p className="text-3xl font-black text-accent-purple">{new Set(files.map(f => f.email)).size}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="relative group">
        <div className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-accent-blue transition-colors">
          <Search className="w-full h-full" />
        </div>
        <input 
          type="text" 
          placeholder="Filter by name, email or filename..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-bg-secondary border border-border-primary rounded-[2rem] pl-14 pr-6 py-5 text-text-primary focus:outline-none focus:border-accent-blue/50 focus:ring-4 focus:ring-accent-blue/5 transition-all shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-bg-secondary rounded-[3rem] border border-border-primary border-dashed">
          <Loader2 className="w-12 h-12 text-accent-blue animate-spin mb-4" />
          <p className="text-text-secondary font-bold font-heading">Accessing Repository...</p>
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mt-2">Connecting to Secure Storage</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredFiles.map((file) => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group relative bg-bg-secondary rounded-[2.5rem] border border-border-primary hover:border-accent-blue/30 transition-all p-8 flex flex-col md:flex-row items-center gap-8 shadow-sm hover:shadow-2xl hover:shadow-accent-blue/5"
              >
                <div className="w-24 h-24 rounded-3xl bg-bg-tertiary flex items-center justify-center relative shrink-0 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <div className="absolute inset-0 bg-accent-blue/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <FileText className="w-10 h-10 text-accent-blue drop-shadow-[0_0_10px_rgba(0,173,140,0.3)]" />
                </div>

                <div className="flex-1 min-w-0 space-y-4 text-center md:text-left">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-text-primary truncate font-heading">{file.name}</h3>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest truncate">{file.title}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Mail className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-xs truncate">{file.email}</span>
                    </div>
                    {file.phone && (
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Phone className="w-3.5 h-3.5 text-text-muted" />
                        <span className="text-xs">{file.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-text-secondary">
                      <Calendar className="w-3.5 h-3.5 text-text-muted" />
                      <span className="text-xs">{new Date(file.date.replace(' ', 'T')).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col gap-3 shrink-0">
                  <button 
                    onClick={() => handleViewFile(file.url, file.title)}
                    className="p-4 bg-accent-blue text-white rounded-2xl hover:brightness-110 transition-all hover:-translate-y-1 shadow-lg shadow-accent-blue/20"
                    title="View Resume"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleViewFile(file.url, file.title)}
                    className="p-4 bg-bg-tertiary text-text-primary rounded-2xl hover:bg-border-primary transition-all hover:-translate-y-1 shadow-sm"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {!isLoading && filteredFiles.length === 0 && (
        <div className="py-20 text-center bg-bg-secondary rounded-[3rem] border border-border-primary border-dashed">
          <p className="text-text-secondary font-bold font-heading">No resumes found</p>
          <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] mt-2">Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
};
