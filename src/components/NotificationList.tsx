import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import { apiService } from '../services/apiService';
import { Notification as AppNotification } from '../types';

export const NotificationList: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const prevNotificationsRef = useRef<AppNotification[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    // Request notification permission on mount
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(e => console.warn('Notification permission request failed:', e));
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      // API currently does not have a /notifications endpoint
      // Disabling call to prevent 404 errors
      /*
      try {
        const data = await apiService.getCollection('notifications', { recipient_id: String(user.id), read: '0' });
        // ... rest of logic
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
      */
      setNotifications([]);
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    // API endpoint doesn't exist yet
    setNotifications(prev => prev.filter(n => n.id !== id));
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
        <div className="absolute right-0 mt-2 w-80 bg-bg-secondary border border-border-primary rounded-xl shadow-lg z-50">
          <div className="p-4 border-b border-border-primary flex justify-between items-center">
            <h3 className="font-bold text-text-primary">Notifications</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={async () => {
                  try {
                    if ('Notification' in window && Notification.permission === 'default') {
                      await Notification.requestPermission();
                    }
                  } catch (error) {
                    console.warn('Push notifications are not supported in this context:', error);
                  }
                  
                  // Mock notification since endpoint is missing
                  const mockId = Math.random().toString(36).substring(7);
                  setNotifications(prev => [{
                    id: mockId,
                    recipient_id: String(user?.id),
                    sender_id: 'system',
                    type: 'system_alert',
                    message: `Test notification at ${new Date().toLocaleTimeString()}`,
                    read: false,
                    created_at: new Date().toISOString()
                  }, ...prev]);
                }}
                className="text-xs px-2 py-1 bg-accent-blue text-white rounded hover:bg-accent-blue/90 transition-colors"
              >
                Test
              </button>
              <button onClick={() => setIsOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors"><X className="w-4 h-4" /></button>
            </div>
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
