import React, { useMemo } from 'react';
import { InterviewRound, ProxyAvailability } from '../types';
import { cn, parseLocalTimeToDate, getEasternDate } from '../lib/utils';
import { Calendar, Clock } from 'lucide-react';

interface SlotVisualizerProps {
  rounds: InterviewRound[];
  availabilities: ProxyAvailability[];
  date: Date;
  proxyId?: string;
}

export const SlotVisualizer: React.FC<SlotVisualizerProps> = ({ rounds, availabilities, date, proxyId }) => {
  const dateStr = useMemo(() => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date), [date]);


  const sortedSlots = useMemo(() => {
    // Combine available slots and booked slots
    const available = availabilities
      .filter(a => 
        (proxyId ? String(a.proxy_user_id) === proxyId : true) &&
        a.slot_start?.startsWith(dateStr) && a.slot_status === 'available')
      .map(a => ({
        id: a.id,
        type: 'available' as const,
        start: a.slot_start,
        end: a.slot_end,
      }));

    const booked = rounds
      .filter(r => 
        (proxyId ? String(r.proxy_user_id) === proxyId : true) &&
        (r.booked_slot_time || r.interview_date)?.startsWith(dateStr) && r.status !== 'cancelled')
      .map(r => ({
        id: r.id,
        type: 'booked' as const,
        start: r.booked_slot_time || r.interview_date || '',
        end: r.booked_slot_end || '',
        roundLabel: r.round_label,
      }));

    return [...available, ...booked].sort((a, b) => a.start.localeCompare(b.start));
  }, [rounds, availabilities, dateStr, proxyId]);

  return (
    <div className="bg-bg-secondary p-6 rounded-3xl border border-border-primary/50 shadow-sm">
      <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-accent-blue" />
        Schedule for {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </h3>
      
      {sortedSlots.length === 0 ? (
        <p className="text-xs text-text-muted italic">No slots scheduled for this day.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sortedSlots.map(slot => (
            <div 
              key={slot.id}
              className={cn(
                "p-4 rounded-2xl border transition-all",
                slot.type === 'available' 
                  ? "bg-accent-green/5 border-accent-green/20" 
                  : "bg-accent-blue/5 border-accent-blue/20"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <Clock className={cn("w-3.5 h-3.5", slot.type === 'available' ? "text-accent-green" : "text-accent-blue")} />
                <span className={cn("text-xs font-bold", slot.type === 'available' ? "text-accent-green" : "text-accent-blue")}>
                  {slot.start && !isNaN(parseLocalTimeToDate(slot.start, 'America/New_York').getTime()) 
                    ? new Intl.DateTimeFormat('en-US', {
                        timeZone: 'America/New_York',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }).format(parseLocalTimeToDate(slot.start, 'America/New_York'))
                    : 'N/A'} EST
                  {' - '}
                  {slot.end && !isNaN(parseLocalTimeToDate(slot.end, 'America/New_York').getTime())
                    ? new Intl.DateTimeFormat('en-US', {
                        timeZone: 'America/New_York',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }).format(parseLocalTimeToDate(slot.end, 'America/New_York'))
                    : 'N/A'} EST
                </span>
              </div>
              <p className={cn("text-[10px] font-black uppercase tracking-widest", slot.type === 'available' ? "text-accent-green/70" : "text-accent-blue/70")}>
                {slot.type === 'available' ? 'Available' : `Booked: ${slot.roundLabel || 'Interview'}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
