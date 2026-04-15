import React, { useEffect, useState, useRef } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    // FIX: Use String(user.id) to match how recipient_id is stored across all pages
    const q = query(
      collection(db, 'jpc_notifications'),
      where('recipient_id', '==', String(user.id)),
      where('read', '==', false)
    );

    return subscribeToQuery<AppNotification>(q, (data) => {
      // Sort newest first
      const sorted = [...data].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Trigger browser push notifications for brand-new arrivals
      if (
        !isInitialLoad.current &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        const prevIds = new Set(prevNotificationsRef.current.map((n) => n.id));
        const newOnes = sorted.filter((n) => !prevIds.has(n.id));

        newOnes.forEach((n) => {
          const isRecent =
            new Date().getTime() - new Date(n.created_at).getTime() < 60000;
          if (isRecent) {
            new Notification('New Placify Alert', {
              body: n.message,
              icon: '/favicon.ico',
            });
          }
        });
      }

      isInitialLoad.current = false;
      prevNotificationsRef.current = sorted;
      setNotifications(sorted);
    }, 'jpc_notifications');
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await Promise.all(notifications.map((n) => markNotificationAsRead(n.id)));
  };

  const unreadCount = notifications.length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 rounded-full hover:bg-bg-tertiary relative transition-colors"
        aria-label="Notifications"
      >
        <Bell className={cn('w-6 h-6', unreadCount > 0 ? 'text-accent-blue' : 'text-text-secondary')} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-accent-red text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-bg-secondary border border-border-primary rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-border-primary flex justify-between items-center">
            <h3 className="font-bold text-text-primary">
              Notifications{unreadCount > 0 && <span className="text-accent-red ml-1">({unreadCount})</span>}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-text-secondary gap-2">
                <Bell className="w-8 h-8 opacity-30" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="p-4 border-b border-border-primary hover:bg-bg-tertiary flex justify-between items-start group transition-colors"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-sm text-text-primary leading-snug">{n.message}</p>
                    <span className="text-xs text-text-secondary mt-1 block">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => handleMarkAsRead(n.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-bg-secondary rounded transition-opacity flex-shrink-0 mt-0.5"
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
