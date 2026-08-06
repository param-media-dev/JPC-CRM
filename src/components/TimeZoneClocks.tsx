import React, { useState, useEffect } from 'react';
import { Clock, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface ZoneInfo {
  label: string;
  zone: string;
  color: string;
}

const ZONES: ZoneInfo[] = [
  { label: 'Eastern Time', zone: 'America/New_York', color: 'text-accent-blue' },
  { label: 'Central Time', zone: 'America/Chicago', color: 'text-accent-purple' },
  { label: 'Mountain Time', zone: 'America/Denver', color: 'text-accent-amber' },
  { label: 'Pacific Time', zone: 'America/Los_Angeles', color: 'text-accent-teal' },
];

export const TimeZoneClocks: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {ZONES.map((zone, idx) => (
        <motion.div
          key={zone.zone}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="bg-bg-secondary border border-border-primary rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${zone.color.replace('text-', 'bg-')} animate-pulse`} />
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest leading-none">
                {zone.label}
              </p>
            </div>
            <p className="text-xl font-mono font-black text-text-primary tracking-tight">
              {time.toLocaleTimeString('en-US', { 
                timeZone: zone.zone, 
                hour12: true, 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </p>
            <p className="text-[9px] text-text-muted font-bold">
              {time.toLocaleDateString('en-US', { 
                timeZone: zone.zone, 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl bg-opacity-10 group-hover:scale-110 transition-transform ${zone.color.replace('text-', 'bg-')}`}>
            <Clock className={`w-4 h-4 ${zone.color}`} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};
