import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { DataProvider } from './contexts/DataContext';
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
import { SLAMonitor } from './components/SLAMonitor';
import { migrateAllChecklists, testConnection } from './services/storage';
import { Plus, Menu } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading, isAuthReady } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) {
      testConnection();
    }
  }, [isAuthReady, user]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (isAuthReady && user) {
      if (user.role === 'candidate' && user.candidate_id) {
        const targetPath = `/candidate/${user.candidate_id}`;
        if (location.pathname !== targetPath) {
          navigate(targetPath);
        }
      }
      
      if (user.role === 'administrator' || user.role === 'jpc_sysadmin') {
        migrateAllChecklists().catch(console.error);
      }
    }
  }, [isAuthReady, user, location.pathname, navigate]);

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

  const isReceiptPage = location.pathname.startsWith('/receipt');

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {!isReceiptPage && (
        <Sidebar 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />
      )}
      
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${!isReceiptPage ? 'md:ml-[260px]' : ''}`}>
        {!isReceiptPage && (
          <header className="h-20 border-b border-border-primary bg-bg-primary/80 backdrop-blur-xl sticky top-0 z-30 px-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                className="md:hidden p-2.5 text-text-secondary bg-bg-secondary hover:text-text-primary hover:bg-bg-tertiary rounded-xl transition-all shadow-sm ring-1 ring-border-primary"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="hidden md:block">
                <h2 className="text-xl font-bold font-heading text-text-primary tracking-tight">Welcome back!</h2>
                <p className="text-xs text-text-secondary font-medium">Ready to place some great candidates?</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 ml-auto">
              <NotificationList />
              {user?.role !== 'candidate' && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 hover:-translate-y-0.5 transition-all shadow-[0_4px_12px_rgba(0,173,140,0.3)] ring-1 ring-white/10"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden xs:inline text-xs sm:text-sm">Add New</span>
                </button>
              )}
            </div>
          </header>
        )}

        <div className={`p-6 md:p-10 max-w-7xl mx-auto w-full flex-1 ${isReceiptPage ? 'p-0 md:p-0 max-w-none' : ''}`}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/candidates" element={<Candidates />} />
            <Route path="/candidate/:id" element={<CandidateDetail />} />
            <Route path="/followups" element={<FollowUps />} />
            <Route path="/not-interested" element={<NotInterested />} />
            <Route path="/team" element={<Team />} />
            <Route path="/receipt" element={<Receipt />} />
            <Route path="/applications" element={<AppTracker />} />
            <Route path="/resume-log" element={<ResumeLogBook />} />
            <Route path="/interviews" element={<InterviewSupport />} />
            <Route path="/" element={<Dashboard />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </main>

      <SLAMonitor />
      <AddCandidateModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          // No reload needed, state should refresh
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <DataProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </DataProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
