import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { subscribeToCollection } from '../services/storage';
import { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

export const NotificationList: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToCollection<Notification>('jpc_notifications', (data) => {
      setNotifications(data.filter(n => n.recipient_id === user.id && !n.read));
    });
  }, [user]);

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
                <div key={n.id} className="p-4 border-b border-border-primary hover:bg-bg-tertiary">
                  <p className="text-sm text-text-primary">{n.message}</p>
                  <span className="text-xs text-text-secondary">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
