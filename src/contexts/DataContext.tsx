import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { Candidate, FollowUp, Notification, ResumeChangeRequest, InterviewRequest, Application } from '../types';
import { useAuth } from './AuthContext';

interface DataContextType {
  candidates: Candidate[];
  followUps: FollowUp[];
  notifications: Notification[];
  resumeRequests: ResumeChangeRequest[];
  interviews: InterviewRequest[];
  applications: Application[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  exportData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, isAuthReady } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [resumeRequests, setResumeRequests] = useState<ResumeChangeRequest[]>([]);
  const [interviews, setInterviews] = useState<InterviewRequest[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [
        candidatesData, 
        followUpsData, 
        interviewsData, 
        appsData
      ] = await Promise.all([
        apiService.getCandidates(),
        apiService.getFollowups({ done: 0 }),
        apiService.getInterviews(),
        apiService.getApplications()
      ]);

      setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      setFollowUps(Array.isArray(followUpsData) ? followUpsData : []);
      setInterviews(Array.isArray(interviewsData) ? interviewsData : []);
      setApplications(Array.isArray(appsData) ? appsData : []);
      
      // Notifications and Resume requests might need specific endpoints or filters
      // For now, setting empty or mock if not in API summary
      setNotifications([]);
      setResumeRequests([]);

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthReady && user) {
      refreshData();
    }
  }, [isAuthReady, user, refreshData]);

  const exportData = () => {
    const data = {
      candidates,
      followUps,
      notifications,
      resumeRequests,
      interviews,
      applications,
      exportDate: new Date().toISOString(),
      user: user?.display_name
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jpc_crm_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <DataContext.Provider value={{ 
      candidates, 
      followUps, 
      notifications, 
      resumeRequests, 
      interviews, 
      applications, 
      isLoading,
      refreshData,
      exportData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
