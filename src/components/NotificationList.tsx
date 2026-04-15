import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck, BellOff } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { cn } from '../lib/utils';

export const NotificationList: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Request browser notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeLabel: Record<string, { label: string; color: string }> = {
    system_alert:   { label: 'Alert',          color: 'text-accent-amber  bg-accent-amber/10  border-accent-amber/20'  },
    resume_request: { label: 'Resume',          color: 'text-accent-blue   bg-accent-blue/10   border-accent-blue/20'   },
    target_not_met: { label: 'Target',          color: 'text-accent-red    bg-accent-red/10    border-accent-red/20'    },
  };

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell Button ── */}
      <button
        onClick={() => setIsOpen(p => !p)}
        className={cn(
          'relative p-2 rounded-full transition-all duration-200',
          isOpen ? 'bg-accent-blue/10 text-accent-blue' : 'hover:bg-bg-tertiary text-text-secondary'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Ping animation when there are notifications */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-accent-red opacity-40 animate-ping" />
        )}
      </button>

      {/* ── Sliding Panel ── */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 bg-bg-secondary border border-border-primary rounded-2xl shadow-2xl z-50 overflow-hidden"
          style={{ animation: 'dropIn 0.2s ease' }}
        >

          {/* Header */}
          <div className="px-5 py-4 border-b border-border-primary flex items-center justify-between bg-bg-tertiary/50">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-accent-blue" />
              <h3 className="font-bold text-text-primary text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold bg-accent-red/10 text-accent-red border border-accent-red/20 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 text-xs text-accent-blue hover:text-accent-blue/80 font-medium transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[420px] overflow-y-auto divide-y divide-border-primary">
            {notifications.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-text-secondary gap-3">
                <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center">
                  <BellOff className="w-6 h-6 opacity-40" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-text-muted mt-0.5">No new notifications</p>
                </div>
              </div>
            ) : (
              notifications.map(n => {
                const tag = typeLabel[n.type] ?? { label: n.type, color: 'text-text-secondary bg-bg-tertiary border-border-primary' };
                return (
                  <div
                    key={n.id}
                    className="group px-5 py-4 hover:bg-bg-tertiary/60 transition-colors flex gap-3 items-start"
                  >
                    {/* Dot */}
                    <div className="w-2 h-2 rounded-full bg-accent-blue mt-1.5 flex-shrink-0" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Type tag */}
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border inline-block mb-1', tag.color)}>
                        {tag.label}
                      </span>
                      <p className="text-sm text-text-primary leading-snug">{n.message}</p>
                      <p className="text-[11px] text-text-muted mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Mark as read button */}
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1.5 rounded-lg hover:bg-accent-blue/10 text-text-secondary hover:text-accent-blue transition-all mt-0.5"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-border-primary bg-bg-tertiary/30 text-center">
              <p className="text-xs text-text-muted">Hover a notification to mark it as read</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
};
