import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { LoginPage } from './pages/LoginPage';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Pipeline } from './pages/Pipeline';
import { Candidates } from './pages/Candidates';
import { CandidateDetail } from './pages/CandidateDetail';
import { FollowUps } from './pages/FollowUps';
import { NotInterested } from './pages/NotInterested';
import { Team } from './pages/Team';
import { Receipt } from './pages/Receipt';
import { AppTracker } from './pages/AppTracker';
import { ResumeLogBook } from './pages/ResumeLogBook';
import { InterviewSupport } from './pages/InterviewSupport';
import { AddCandidateModal } from './components/AddCandidateModal';
import { NotificationList } from './components/NotificationList';
import { seedData } from './services/seeding';
import { migrateAllChecklists, testConnection } from './services/storage';
import { Plus, Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading, isAuthReady } = useAuth();
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthReady) {
      testConnection();
    }
  }, [isAuthReady]);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#dashboard');
      window.scrollTo(0, 0);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      if (user.role === 'candidate' && user.candidate_id) {
        const targetHash = `#candidate?id=${user.candidate_id}`;
        if (window.location.hash !== targetHash) {
          window.location.hash = targetHash;
        }
      }
      
      // Only run maintenance tasks for administrators
      if (user.role === 'administrator' || user.role === 'jpc_sysadmin') {
        migrateAllChecklists().catch(console.error);
      }
    }
  }, [isAuthReady, user]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderPage = () => {
    const hash = currentHash.split('?')[0];
    
    if (user?.role === 'candidate' || user?.role === 'jpc_candidate') {
      switch (hash) {
        case '#dashboard': return <CandidateDashboard />;
        case '#candidate': return <CandidateDetail />;
        case '#receipt': return <Receipt />;
        default: return <CandidateDashboard />;
      }
    }

    switch (hash) {
      case '#dashboard': 
        return <Dashboard />;
      case '#pipeline': 
        if (user?.role === 'candidate') return <CandidateDetail />;
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_marketing' && user?.role !== 'jpc_marketing_support' && user?.role !== 'jpc_sales') return <Dashboard />;
        return <Pipeline />;
      case '#candidates': 
        if (user?.role === 'candidate') return <CandidateDetail />;
        return <Candidates />;
      case '#candidate': return <CandidateDetail />;
      case '#followups': 
        if (user?.role === 'candidate') return <CandidateDetail />;
        return <FollowUps />;
      case '#not-interested': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager') return <Dashboard />;
        return <NotInterested />;
      case '#team': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <Team />;
      case '#receipt': return <Receipt />;
      case '#applications': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter') return <Dashboard />;
        return <AppTracker />;
      case '#resume-log': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <ResumeLogBook />;
      case '#interviews': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_proxy') return <Dashboard />;
        return <InterviewSupport />;
      default: 
        if (user?.role === 'candidate') return <CandidateDetail />;
        return <Dashboard />;
    }
  };

  const isReceiptPage = currentHash.startsWith('#receipt');

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {!isReceiptPage && (
        <Sidebar 
          currentHash={currentHash} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />
      )}
      
      <main className={`flex-1 flex flex-col min-h-screen ${!isReceiptPage ? 'md:ml-[260px]' : ''}`}>
        {!isReceiptPage && (
          <header className="h-16 border-b border-border-primary bg-bg-secondary/50 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between">
            <button 
              className="md:hidden p-2 text-text-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center gap-4 ml-auto">
              <NotificationList />
              {user?.role !== 'candidate' && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Add Candidate</span>
                </button>
              )}
            </div>
          </header>
        )}

        <div className={`p-6 md:p-10 max-w-7xl mx-auto w-full flex-1 ${isReceiptPage ? 'p-0 md:p-0 max-w-none' : ''}`}>
          {renderPage()}
        </div>
      </main>

      <AddCandidateModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}