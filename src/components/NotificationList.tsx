import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { subscribeToQuery, markNotificationAsRead } from '../services/storage';
import { Notification as AppNotification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export const NotificationList: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const prevNotificationsRef = useRef<AppNotification[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'jpc_notifications'), where('recipient_id', '==', String(user.id)), where('read', '==', false));
    return subscribeToQuery<AppNotification>(q, (data) => {
      // Check for new notifications to trigger push
      if (!isInitialLoad.current && 'Notification' in window && Notification.permission === 'granted') {
        const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
        const newNotifications = data.filter(n => !prevIds.has(n.id));
        
        newNotifications.forEach(n => {
          // Don't show push for notifications created more than 1 minute ago
          const isRecent = (new Date().getTime() - new Date(n.created_at).getTime()) < 60000;
          if (isRecent) {
            new Notification('New Placify Alert', {
              body: n.message,
              icon: '/favicon.ico' // fallback icon
            });
          }
        });
      }
      
      isInitialLoad.current = false;
      prevNotificationsRef.current = data;
      setNotifications(data);
    }, 'jpc_notifications');
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
  };

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-full hover:bg-bg-tertiary relative">
        <Bell className="w-6 h-6 text-text-secondary" />
        {notifications.length > 0 && (
          <span className="absolute top-0 right-0 bg-accent-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notifications.length}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-border-primary rounded-xl shadow-lg z-50">
          <div className="p-4 border-b border-border-primary flex justify-between items-center">
            <h3 className="font-bold text-text-primary">Notifications</h3>
            <button onClick={() => setIsOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-text-secondary text-sm">No new notifications</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="p-4 border-b border-border-primary hover:bg-bg-tertiary flex justify-between items-start group">
                  <div>
                    <p className="text-sm text-text-primary">{n.message}</p>
                    <span className="text-xs text-text-secondary">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <button 
                    onClick={() => handleMarkAsRead(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-secondary rounded transition-opacity"
                    title="Mark as read"
                  >
                    <Check className="w-4 h-4 text-accent-green" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
