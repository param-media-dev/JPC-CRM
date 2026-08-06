import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useToast } from '../contexts/ToastContext';
import { Plus, Trash2, RotateCcw, Loader2, Save } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const DEFAULT_QUOTES = [
  "Success usually comes to those who are too busy to be looking for it.",
  "Don't limit your challenges. Challenge your limits.",
  "The secret of getting ahead is getting started.",
  "Great things never come from comfort zones.",
  "Dream big and dare to fail.",
  "It always seems impossible until it's done.",
  "Your limitation—it's only your imagination.",
  "Push yourself, because no one else is going to do it for you.",
  "Sometimes later becomes never. Do it now.",
  "Hard work beats talent when talent doesn't work hard."
];

interface ThoughtsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (newQuotes: string[]) => void;
}

export const ThoughtsConfigModal: React.FC<ThoughtsConfigModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<string[]>([]);
  const [newQuote, setNewQuote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      // Load current thoughts from Firestore
      getDoc(doc(db, 'jpc_settings', 'dashboard_thoughts'))
        .then((snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && Array.isArray(data.quotes) && data.quotes.length > 0) {
              setQuotes(data.quotes);
              localStorage.setItem('dashboard_thoughts', JSON.stringify(data.quotes));
              setIsLoading(false);
              return;
            }
          }
          
          // Fallback to local storage or defaults
          const cached = localStorage.getItem('dashboard_thoughts');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setQuotes(parsed);
                setIsLoading(false);
                return;
              }
            } catch (e) {}
          }

          setQuotes(DEFAULT_QUOTES);
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('Could not load thoughts from Firestore:', err);
          const cached = localStorage.getItem('dashboard_thoughts');
          if (cached) {
            try {
              setQuotes(JSON.parse(cached));
            } catch (e) {
              setQuotes(DEFAULT_QUOTES);
            }
          } else {
            setQuotes(DEFAULT_QUOTES);
          }
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuote.trim()) return;
    setQuotes([...quotes, newQuote.trim()]);
    setNewQuote('');
  };

  const handleRemoveQuote = (index: number) => {
    const updated = quotes.filter((_, i) => i !== index);
    setQuotes(updated);
  };

  const handleEditQuote = (index: number, value: string) => {
    const updated = [...quotes];
    updated[index] = value;
    setQuotes(updated);
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Are you sure you want to restore the 10 default motivational thoughts?')) {
      setQuotes(DEFAULT_QUOTES);
      showToast('Default thoughts restored in-editor. Save to sync.', 'info');
    }
  };

  const handleSave = async () => {
    if (quotes.length === 0) {
      showToast('You must have at least one slot or thought of the day.', 'error');
      return;
    }
    
    setIsLoading(true);
    try {
      const dataToSave = {
        quotes: quotes.map(q => q.trim()).filter(Boolean),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.display_name || user?.username || 'anonymous'
      };

      // 1. Save in Firestore
      await setDoc(doc(db, 'jpc_settings', 'dashboard_thoughts'), dataToSave);

      // 2. Cache in local storage
      localStorage.setItem('dashboard_thoughts', JSON.stringify(dataToSave.quotes));

      // 3. Trigger callback to refresh current visible quote on dashboard
      onSaved(dataToSave.quotes);

      showToast('Dashboard thoughts updated successfully!', 'success');
      onClose();
    } catch (err: any) {
      console.error('Failed to save dashboard thoughts:', err);
      showToast('Error saving thoughts to cloud. Check Firestore permissions.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Customize Dashboard Thoughts"
      maxWidth="max-w-[640px]"
      footer={
        <div className="flex w-full items-center justify-between">
          <button
            onClick={handleRestoreDefaults}
            type="button"
            className="flex items-center gap-2 px-3 py-2 text-text-muted hover:text-text-primary text-sm font-semibold transition-colors bg-bg-secondary border border-border-primary rounded-xl"
            disabled={isLoading}
          >
            <RotateCcw className="w-4 h-4" />
            Restore Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors hover:bg-bg-tertiary rounded-xl"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              type="button"
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-accent-blue rounded-xl hover:bg-accent-blue/90 shadow-lg shadow-accent-blue/15 hover:shadow-accent-blue/25 transition-all disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-text-secondary text-sm font-medium">
            These thoughts of the day appear randomly on the Dashboard header. Add, edit, or remove quotes to match your candidate or company objectives.
          </p>
        </div>

        {/* Add new thought */}
        <form onSubmit={handleAddQuote} className="flex gap-2">
          <input
            type="text"
            placeholder="Add a new inspiring thought or quote..."
            value={newQuote}
            onChange={(e) => setNewQuote(e.target.value)}
            className="flex-1 p-2.5 text-sm bg-bg-tertiary rounded-xl border border-border-primary text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="flex items-center gap-1 px-4 py-2.5 text-xs font-bold text-white bg-accent-green rounded-xl hover:bg-accent-green/90 transition-all border border-accent-green/10"
            disabled={isLoading}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>

        {/* Existing Thoughts list */}
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center justify-between">
            <span>Thoughts List ({quotes.length})</span>
          </h4>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-10 text-text-muted space-y-2">
              <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
              <span className="text-sm font-medium">Loading thoughts from cloud...</span>
            </div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-8 text-text-muted border border-dashed border-border-primary rounded-xl">
              <p className="text-sm">No thoughts added yet.</p>
              <p className="text-xs mt-1 text-text-muted/60">Type a thought above to get started.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {quotes.map((quote, index) => (
                <div 
                  key={index} 
                  className="flex items-start gap-2 p-2 bg-bg-tertiary/50 border border-border-primary rounded-xl group transition-all duration-200 hover:border-border-secondary"
                >
                  <textarea
                    value={quote}
                    onChange={(e) => handleEditQuote(index, e.target.value)}
                    className="flex-1 p-1.5 text-sm bg-transparent resize-none border-none text-text-primary focus:outline-none focus:ring-0 placeholder:text-text-muted align-top max-h-[120px]"
                    placeholder="Enter inspiring thought or message..."
                    rows={2}
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => handleRemoveQuote(index)}
                    type="button"
                    className="p-2 text-text-muted hover:text-accent-red hover:bg-bg-secondary rounded-lg transition-all"
                    title="Remove Quote"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
