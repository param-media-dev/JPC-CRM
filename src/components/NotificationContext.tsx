import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToCollection, markNotificationAsRead } from '../services/storage';
import { Notification as AppNotification } from '../types';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isInitialLoad = useRef(true);
  const prevIdsRef = useRef<Set<string>>(new Set());

  // Global toast popup state for new notifications
  const [popups, setPopups] = useState<AppNotification[]>([]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to ENTIRE collection — filter in JS to avoid Firestore rule query issues
    const unsub = subscribeToCollection<AppNotification>('jpc_notifications', (all) => {
      const mine = all
        .filter(n => String(n.recipient_id) === String(user.id) && n.read === false)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Show popup toast for brand-new notifications
      if (!isInitialLoad.current) {
        const newOnes = mine.filter(n => !prevIdsRef.current.has(n.id));
        if (newOnes.length > 0) {
          setPopups(prev => [...prev, ...newOnes]);
          // Auto-dismiss each popup after 5 seconds
          newOnes.forEach(n => {
            setTimeout(() => {
              setPopups(prev => prev.filter(p => p.id !== n.id));
            }, 5000);
          });

          // Browser notification if permission granted
          if ('Notification' in window && Notification.permission === 'granted') {
            newOnes.forEach(n => {
              const isRecent = new Date().getTime() - new Date(n.created_at).getTime() < 60000;
              if (isRecent) {
                new Notification('New Placify Alert', { body: n.message, icon: '/favicon.ico' });
              }
            });
          }
        }
      }

      isInitialLoad.current = false;
      prevIdsRef.current = new Set(mine.map(n => n.id));
      setNotifications(mine);
    });

    return unsub;
  }, [user]);

  const markAsRead = useCallback(async (id: string) => {
    await markNotificationAsRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await Promise.all(notifications.map(n => markNotificationAsRead(n.id)));
  }, [notifications]);

  const dismissPopup = (id: string) => {
    setPopups(prev => prev.filter(p => p.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount: notifications.length, markAsRead, markAllAsRead }}>
      {children}

      {/* Live Popup Toasts — top-right corner */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {popups.map(popup => (
          <div
            key={popup.id}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border border-accent-blue/30 bg-bg-secondary min-w-[300px] max-w-sm animate-slide-in"
            style={{ animation: 'slideInRight 0.3s ease' }}
          >
            <div className="w-2 h-2 rounded-full bg-accent-blue mt-1.5 flex-shrink-0 animate-pulse" />
            <div className="flex-1">
              <p className="text-xs font-bold text-accent-blue uppercase tracking-wider mb-0.5">New Notification</p>
              <p className="text-sm text-text-primary leading-snug">{popup.message}</p>
            </div>
            <button
              onClick={() => dismissPopup(popup.id)}
              className="text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100%); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
