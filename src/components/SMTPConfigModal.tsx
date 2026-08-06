import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useToast } from '../contexts/ToastContext';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const SMTPConfigModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState({ host: '', port: 587, secure: false, user: '', pass: '', from_name: '', from_email: '' });
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 1. Try local storage cache first for instant loading
      const cached = localStorage.getItem('smtp_settings');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.host) {
            setSettings(parsed);
          }
        } catch (e) {}
      }

      // 2. Load from client-side authenticated Firestore
      getDoc(doc(db, 'jpc_settings', 'smtp_settings')).then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.host) {
            setSettings(data as any);
            localStorage.setItem('smtp_settings', JSON.stringify(data));
            return;
          }
        }
        // 3. Backend custom server fallback
        fetch('/api/smtp/settings')
          .then(res => res.json())
          .then(data => {
            if (data && data.host) {
              setSettings(data);
              localStorage.setItem('smtp_settings', JSON.stringify(data));
            }
          })
          .catch(() => {});
      }).catch((err) => {
        console.warn('Client-side Firestore SMTP read omitted/failed, using API fallback:', err);
        fetch('/api/smtp/settings')
          .then(res => res.json())
          .then(data => {
            if (data && data.host) {
              setSettings(data);
              localStorage.setItem('smtp_settings', JSON.stringify(data));
            }
          })
          .catch(() => {});
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // 1. Store in local storage first
      localStorage.setItem('smtp_settings', JSON.stringify(settings));

      // 2. Store in client-side Firestore
      try {
        await setDoc(doc(db, 'jpc_settings', 'smtp_settings'), settings);
      } catch (err) {
        console.warn('Client-side Firestore write failed, using local/server fallbacks:', err);
      }

      // 3. Write via API (which handles local state caching in backend)
      await fetch('/api/smtp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      showToast('SMTP settings saved!', 'success');
      onClose();
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, test_email: testEmail })
      });
      if (!response.ok) throw new Error(await response.text());
      showToast('Test email sent!', 'success');
    } catch (e) {
      showToast('Failed to send test email', 'error');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="SMTP Settings">
      <div className="space-y-4">
        {[
          { label: 'Host', key: 'host', type: 'text' },
          { label: 'Port', key: 'port', type: 'number' },
          { label: 'User', key: 'user', type: 'text' },
          { label: 'Password', key: 'pass', type: 'password' },
          { label: 'From Name', key: 'from_name', type: 'text' },
          { label: 'From Email', key: 'from_email', type: 'email' },
        ].map(field => (
          <div key={field.key} className="space-y-1">
            <label className="text-xs font-bold text-text-muted uppercase">{field.label}</label>
            <input 
              type={field.type}
              value={settings[field.key as Exclude<keyof typeof settings, 'secure'>] as string | number}
              onChange={e => {
                const val = field.type === 'number' ? (parseInt(e.target.value, 10) || 0) : e.target.value;
                setSettings({...settings, [field.key]: val});
              }}
              className="w-full p-2 bg-bg-tertiary rounded-lg border border-border-primary"
            />
          </div>
        ))}
        <label className="flex items-center gap-2">
            <input type="checkbox" checked={settings.secure} onChange={e => setSettings({...settings, secure: e.target.checked})} />
            <span className="text-sm">Secure (SSL/TLS)</span>
        </label>
        
        <div className="pt-4 border-t border-border-primary space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase">Test Email</label>
            <div className="flex gap-2">
                <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} className="w-full p-2 bg-bg-tertiary rounded-lg border border-border-primary" />
                <button onClick={handleTest} className="px-4 bg-accent-blue text-white rounded-lg font-bold" disabled={isLoading}>Test</button>
            </div>
        </div>
        
        <button onClick={handleSave} className="w-full py-3 bg-accent-blue text-white rounded-xl font-bold" disabled={isLoading}>
          {isLoading ? <Loader2 className="animate-spin" /> : 'Save Settings'}
        </button>
      </div>
    </Modal>
  );
};
