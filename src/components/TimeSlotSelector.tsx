import React, { useMemo } from 'react';
import Select from 'react-select';
import { ProxyAvailability } from '../types';
import { sharedSelectStyles } from '../lib/selectStyles';

interface TimeSlot {
  value: string;
  label: string;
}

interface TimeSlotSelectorProps {
  value: string;
  onChange: (value: string) => void;
  availabilities: ProxyAvailability[];
  date: string;
  proxyUserId?: string;
  className?: string;
}

export const TimeSlotSelector: React.FC<TimeSlotSelectorProps> = ({ value, onChange, availabilities, date, proxyUserId, className }) => {
  const options = useMemo(() => {
    if (!date) return [];
    
    return availabilities
      .filter(a => 
        a.slot_start?.startsWith(date) && 
        (proxyUserId ? String(a.proxy_user_id) === proxyUserId : true) &&
        a.slot_status === 'available'
      )
      .map(a => {
        const start = new Date(a.slot_start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
        const end = new Date(a.slot_end).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
        return {
          value: a.slot_start,
          label: `${start} - ${end} EST`
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [availabilities, date, proxyUserId]);

  return (
    <div className={className}>
      <Select
        options={options}
        value={options.find(o => o.value === value) || null}
        onChange={(opt) => onChange(opt ? opt.value : '')}
        styles={sharedSelectStyles}
        placeholder="Select time slot..."
        isClearable
      />
    </div>
  );
};
