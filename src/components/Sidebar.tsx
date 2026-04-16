import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  LayoutDashboard, 
  Trello, 
  Users, 
  Clock, 
  UserX, 
  Shield, 
  LogOut, 
  Sun, 
  Moon,
  Menu,
  X,
  FileText,
  FileEdit,
  Video,
  User as UserIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { subscribeToCollection } from '../services/storage';
import { FollowUp, Candidate } from '../types';

interface SidebarProps {
  currentHash: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentHash, isOpen, setIsOpen }) => {
  const { user, logout, isAuthReady } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [allFollowUps, setAllFollowUps] = useState<FollowUp[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!isAuthReady) return;

    const unsubFollowUps = subscribeToCollection<FollowUp>('jpc_followups', (data) => {
      setAllFollowUps(data);
    });

    const unsubCandidates = subscribeToCollection<Candidate>('jpc_candidates', (data) => {
      setAllCandidates(data);
    });

    return () => {
      unsubFollowUps();
      unsubCandidates();
    };
  }, [isAuthReady]);

  const followUpsCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const personal = user?.role === 'administrator' || user?.role === 'jpc_manager' 
      ? allFollowUps 
      : allFollowUps.filter(f => f.created_by === user?.id);
    return personal.filter(f => !f.done && f.followup_date <= today).length;
  }, [user, allFollowUps]);

  const notInterestedCount = useMemo(() => {
    return allCandidates.filter(c => c.current_stage === 'not_interested').length;
  }, [allCandidates]);

  const navItems = [
    { label: 'Dashboard', hash: '#dashboard', icon: LayoutDashboard, visible: true },
    { label: 'My Profile', hash: `#candidate?id=${user?.candidate_id}`, icon: UserIcon, visible: (user?.role === 'candidate' || user?.role === 'jpc_candidate') && !!user?.candidate_id },
    { 
      label: 'Pipeline', 
      hash: '#pipeline', 
      icon: Trello, 
      visible: user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || user?.role === 'jpc_marketing' || user?.role === 'jpc_marketing_support' || user?.role === 'jpc_sales'
    },
    { label: 'Candidates', hash: '#candidates', icon: Users, visible: user?.role !== 'candidate' && user?.role !== 'jpc_candidate' },
    { 
      label: 'Follow-Ups', 
      hash: '#followups', 
      icon: Clock, 
      visible: user?.role !== 'candidate' && user?.role !== 'jpc_candidate' && user?.role !== 'jpc_lead_gen' && user?.role !== 'jpc_resume' && user?.role !== 'jpc_proxy' && user?.role !== 'jpc_marketing' && user?.role !== 'jpc_marketing_support', 
      badge: followUpsCount 
    },
    { 
      label: 'App Tracker', 
      hash: '#applications', 
      icon: FileText, 
      visible: user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter'
    },
    { 
      label: 'Resume Log', 
      hash: '#resume-log', 
      icon: FileEdit, 
      visible: user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || user?.role === 'jpc_resume' || user?.role === 'jpc_marketing'
    },
    { 
      label: 'Interview Support', 
      hash: '#interviews', 
      icon: Video, 
      visible: user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_cs' || user?.role === 'jpc_recruiter' || user?.role === 'jpc_proxy'
    },
    { 
      label: 'Not Interested', 
      hash: '#not-interested', 
      icon: UserX, 
      visible: (user?.role === 'administrator' || user?.role === 'jpc_manager' || user?.role === 'jpc_sysadmin'),
      badge: notInterestedCount
    },
    { 
      label: 'Team', 
      hash: '#team', 
      icon: Shield, 
      visible: (user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager' || user?.role === 'jpc_marketing')
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-[260px] bg-bg-secondary border-r border-border-primary z-50 transition-transform duration-300 md:translate-x-0 flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Brand Area */}
        <div className="p-6 flex items-center gap-3">
          <img 
            src={theme === 'dark' 
              ? "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-5@4x-scaled.webp" 
              : "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-4@4x-scaled.webp"
            } 
            alt="Placify Logo" 
            className="h-10 w-auto"
            referrerPolicy="no-referrer"
          />
          <div className="hidden">
            <h1 className="font-heading font-bold text-lg leading-none">Placify</h1>
            <span className="text-[10px] uppercase tracking-wider text-text-muted font-bold mt-1 block">
              {user?.role.replace('jpc_', '').replace('_', ' ')}
            </span>
          </div>
          <button 
            className="md:hidden ml-auto p-1 text-text-secondary"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.filter(item => item.visible).map(item => (
            <a
              key={item.hash}
              href={item.hash}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative",
                currentHash.startsWith(item.hash) 
                  ? "bg-accent-blue/10 text-accent-blue" 
                  : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
              )}
            >
              {currentHash.startsWith(item.hash) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-accent-blue rounded-r-full" />
              )}
              <item.icon className="w-5 h-5" />
              <span className="font-medium flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  item.hash === '#not-interested' ? "bg-accent-red/20 text-accent-red" : "bg-accent-amber/20 text-accent-amber"
                )}>
                  {item.badge}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border-primary space-y-4">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-text-secondary hover:bg-bg-tertiary transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="font-medium">Switch to {theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center font-bold text-lg">
              {user?.display_name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-text-primary truncate">{user?.display_name}</p>
              <button 
                onClick={logout}
                className="text-xs text-text-muted hover:text-accent-red transition-colors flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-border-primary flex flex-col items-center gap-2">
            <p className="text-[8px] font-bold text-text-muted uppercase tracking-widest">Powered by</p>
            <img 
              src={theme === 'dark' 
                ? "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-1@4x.webp" 
                : "https://test-wp.param.club/wp-content/uploads/2026/04/Auriic_Logo-_1_-1.webp"
              } 
              alt="Auriic Logo" 
              className="h-5 w-auto opacity-50 hover:opacity-100 transition-opacity"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </aside>
    </>
  );
};
