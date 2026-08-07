import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { Sidebar } from './components/Sidebar';
import { isProxyUser } from './services/interviewService';
import { AddCandidateModal } from './components/AddCandidateModal';
import { NotificationList } from './components/NotificationList';
import { SLAMonitor } from './components/SLAMonitor';
import { MigrationExecutor } from './MigrationExecutor';
import { migrateAllChecklists, testConnection, autoAssignFaizToCandidates } from './services/storage';
import { Plus, Menu } from 'lucide-react';

// Lazy load pages
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const CandidateDashboard = lazy(() => import('./pages/CandidateDashboard').then(m => ({ default: m.CandidateDashboard })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Pipeline = lazy(() => import('./pages/Pipeline').then(m => ({ default: m.Pipeline })));
const Candidates = lazy(() => import('./pages/Candidates').then(m => ({ default: m.Candidates })));
const CandidateDetail = lazy(() => import('./pages/CandidateDetail').then(m => ({ default: m.CandidateDetail })));
const FollowUps = lazy(() => import('./pages/FollowUps').then(m => ({ default: m.FollowUps })));
const NotInterested = lazy(() => import('./pages/NotInterested').then(m => ({ default: m.NotInterested })));
const NotEligible = lazy(() => import('./pages/NotEligible').then(m => ({ default: m.NotEligible })));
const Team = lazy(() => import('./pages/Team').then(m => ({ default: m.Team })));
const Receipt = lazy(() => import('./pages/Receipt').then(m => ({ default: m.Receipt })));
const AppTracker = lazy(() => import('./pages/AppTracker').then(m => ({ default: m.AppTracker })));
const ResumeLogBook = lazy(() => import('./pages/ResumeLogBook').then(m => ({ default: m.ResumeLogBook })));
const RTRLogBook = lazy(() => import('./pages/RTRLogBook').then(m => ({ default: m.RTRLogBook })));
const ResumePrepLog = lazy(() => import('./pages/ResumePrepLog').then(m => ({ default: m.ResumePrepLog })));
const TargetDashboard = lazy(() => import('./pages/TargetDashboard').then(m => ({ default: m.TargetDashboard })));
const CVRepository = lazy(() => import('./pages/CVRepository').then(m => ({ default: m.CVRepository })));
const FeatureAnnouncements = lazy(() => import('./pages/FeatureAnnouncements').then(m => ({ default: m.FeatureAnnouncements })));
const InterviewSupportDashboard = lazy(() => import('./pages/InterviewSupport/Dashboard').then(m => ({ default: m.InterviewSupportDashboard })));
const ProxyDashboard = lazy(() => import('./pages/InterviewSupport/ProxyDashboard').then(m => ({ default: m.ProxyDashboard })));
const BookingPage = lazy(() => import('./pages/InterviewSupport/BookingPage').then(m => ({ default: m.BookingPage })));
const CRMDashboard = lazy(() => import('./pages/CRMDashboard').then(m => ({ default: m.CRMDashboard })));

const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center p-20">
    <div className="w-10 h-10 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
  </div>
);

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
        autoAssignFaizToCandidates().catch(console.error);
      }
    }
  }, [isAuthReady, user]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
          <p className="text-xs text-text-secondary font-medium animate-pulse">Loading application...</p>
        </div>
      </div>
    );
  }


  const isBookingPage = currentHash.startsWith('#book-interview');

  if (!user && !isBookingPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <LoginPage />
      </Suspense>
    );
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
      case '#crm-dashboard':
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs') return <Dashboard />;
        return <CRMDashboard />;
      case '#pipeline': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_marketing' && user?.role !== 'jpc_marketing_support' && user?.role !== 'jpc_sales' && user?.role !== 'jpc_resume') return <Dashboard />;
        return <Pipeline />;
      case '#candidates': 
        return <Candidates />;
      case '#candidate': return <CandidateDetail />;
      case '#followups': 
        return <FollowUps />;
      case '#not-interested': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_lead_gen' && user?.role !== 'jpc_sales') return <Dashboard />;
        return <NotInterested />;
      case '#not-eligible': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_lead_gen' && user?.role !== 'jpc_sales') return <Dashboard />;
        return <NotEligible />;
      case '#team': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_marketing' && user?.role !== 'jpc_cs') return <Dashboard />;
        return <Team />;
      case '#receipt': return <Receipt />;
      case '#applications': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <AppTracker />;
      case '#resume-log': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <ResumeLogBook />;
      case '#resume-prep-log': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <ResumePrepLog />;
      case '#rtr-log': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <RTRLogBook />;
      case '#target-dashboard':
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs') return <Dashboard />;
        return <TargetDashboard />;
      case '#cv-repository':
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <CVRepository />;
      case '#feature-alerts':
        return <FeatureAnnouncements />;
      case '#interviews': 
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && user?.role !== 'jpc_recruiter' && !isProxyUser(user) && user?.role !== 'jpc_marketing') return <Dashboard />;
        return <InterviewSupportDashboard />;
      case '#interviews-proxy':
        if (user?.role !== 'administrator' && user?.role !== 'jpc_sysadmin' && user?.role !== 'jpc_manager' && user?.role !== 'jpc_cs' && !isProxyUser(user)) return <Dashboard />;
        return <ProxyDashboard />;
      default:
        if (hash.startsWith('#book-interview')) {
          return <BookingPage />;
        }
        return <Dashboard />;
    }
  };

  const isReceiptPage = currentHash.startsWith('#receipt');
  // isBookingPage is already declared above

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {!isReceiptPage && !isBookingPage && (
        <Sidebar 
          currentHash={currentHash} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
        />
      )}
      
      <main className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${(!isReceiptPage && !isBookingPage) ? 'md:ml-[260px]' : ''}`}>
        {!isReceiptPage && !isBookingPage && (
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
            
            <div className="flex items-center gap-4 ml-auto">
              <NotificationList />
              {user?.role !== 'candidate' && (
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 hover:-translate-y-0.5 transition-all shadow-[0_4px_12px_rgba(0,173,140,0.3)] ring-1 ring-white/10"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Add Candidate</span>
                </button>
              )}
            </div>
          </header>
        )}

        <div className={`p-6 md:p-10 max-w-7xl mx-auto w-full flex-1 ${isReceiptPage ? 'p-0 md:p-0 max-w-none' : ''}`}>
          <Suspense fallback={<PageLoader />}>
            {renderPage()}
          </Suspense>
        </div>
      </main>

      <SLAMonitor />
      <MigrationExecutor />
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