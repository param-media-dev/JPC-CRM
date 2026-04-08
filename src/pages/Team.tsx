import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, saveUser, generateId } from '../services/storage';
import { Users, UserPlus, Shield, Mail, Phone, MoreVertical, Edit2, Trash2, X, Save, AlertCircle, ShieldCheck, UserCheck, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { User, UserRole } from '../types';
import { Modal } from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as secondarySignOut, updateProfile } from 'firebase/auth';

const ROLES: { value: UserRole; label: string; icon: any; color: string }[] = [
  { value: 'administrator', label: 'Administrator', icon: ShieldCheck, color: 'text-accent-red' },
  { value: 'jpc_manager', label: 'JPC Manager', icon: Shield, color: 'text-accent-purple' },
  { value: 'jpc_sales', label: 'Sales Team', icon: UserCheck, color: 'text-accent-blue' },
  { value: 'jpc_cs', label: 'Customer Success', icon: UserCheck, color: 'text-accent-teal' },
  { value: 'jpc_resume', label: 'Resume Team', icon: UserCheck, color: 'text-accent-amber' },
  { value: 'jpc_recruiter', label: 'Recruiter', icon: UserCheck, color: 'text-accent-green' },
  { value: 'jpc_marketing', label: 'Marketing', icon: UserCheck, color: 'text-accent-gray' },
];

export const Team: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    role: 'jpc_sales' as UserRole,
    password: '',
  });

  useEffect(() => {
    if (!isAuthReady) return;
    const unsub = subscribeToCollection<User>('jpc_users', (data) => {
      setTeam(data);
      setIsLoading(false);
    });
    return () => unsub();
  }, [isAuthReady]);

  const canManage = (targetRole: UserRole) => {
    if (user?.role === 'administrator') return true;
    if (user?.role === 'jpc_manager' && targetRole !== 'administrator') return true;
    return false;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.display_name) return;
    if (!editingUser && !formData.password) {
      showToast('Password is required for new users', 'error');
      return;
    }

    setIsLoading(true);
    try {
      let userId = editingUser?.id;

      if (!editingUser) {
        // Create Firebase Auth user using a secondary app instance
        // to avoid signing out the current admin
        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const { user: fUser } = await createUserWithEmailAndPassword(
            secondaryAuth, 
            formData.username.includes('@') ? formData.username : `${formData.username}@jpc-crm.com`, 
            formData.password
          );
          await updateProfile(fUser, { displayName: formData.display_name });
          userId = fUser.uid;
          // Sign out from the secondary instance immediately
          await secondarySignOut(secondaryAuth);
        } catch (authError: any) {
          console.error('Auth creation error:', authError);
          let message = 'Failed to create auth account';
          if (authError.code === 'auth/email-already-in-use') {
            message = 'This email is already registered in the system.';
          } else if (authError.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters.';
          } else if (authError.code === 'auth/invalid-email') {
            message = 'Invalid email format.';
          }
          showToast(message, 'error');
          setIsLoading(false);
          return;
        }
      }

      const newUser: User = {
        id: userId || generateId(),
        username: formData.username,
        display_name: formData.display_name,
        role: formData.role,
        created_at: editingUser?.created_at || new Date().toISOString(),
      };

      await setDoc(doc(db, 'jpc_users', String(newUser.id)), newUser);
      showToast(editingUser ? 'User updated' : 'User added', 'success');
      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ username: '', display_name: '', role: 'jpc_sales', password: '' });
    } catch (error) {
      console.error('Save user error:', error);
      showToast('Failed to save user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'jpc_users', String(deletingUser.id)));
      showToast('User removed', 'success');
      setDeletingUser(null);
    } catch (error) {
      console.error('Delete user error:', error);
      showToast('Failed to remove user', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Team Management</h1>
          <p className="text-text-secondary mt-1">Manage your team members and their access levels.</p>
        </div>
        {(user?.role === 'administrator' || user?.role === 'jpc_manager') && (
          <button 
            onClick={() => {
              setEditingUser(null);
              setFormData({ username: '', display_name: '', role: 'jpc_sales' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
          >
            <UserPlus className="w-5 h-5" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Role Groups */}
      <div className="space-y-10">
        {ROLES.map((role) => {
          const roleMembers = team.filter(u => u.role === role.value);
          if (roleMembers.length === 0) return null;

          return (
            <section key={role.value} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <role.icon className={cn("w-5 h-5", role.color)} />
                <h2 className="text-lg font-bold text-text-primary tracking-tight">{role.label}</h2>
                <span className="px-2 py-0.5 bg-bg-secondary border border-border-primary rounded-lg text-[10px] font-bold text-text-muted uppercase">
                  {roleMembers.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {roleMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-bg-secondary rounded-3xl border border-border-primary p-6 shadow-sm hover:shadow-md transition-all group relative"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center text-text-secondary font-bold text-sm">
                        {member.display_name.split(' ').map(n => n[0]).join('')}
                      </div>
                      {canManage(member.role) && member.id !== user?.id && (
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingUser(member);
                              setFormData({
                                username: member.username,
                                display_name: member.display_name,
                                role: member.role,
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-2 text-text-muted hover:text-accent-blue transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeletingUser(member)}
                            className="p-2 text-text-muted hover:text-accent-red transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-text-primary">{member.display_name}</h3>
                      <p className="text-xs text-text-muted mt-1">@{member.username}</p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border-primary flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-accent-green" />
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Active</span>
                      </div>
                      <p className="text-[10px] text-text-muted">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? 'Edit Team Member' : 'Add Team Member'}
      >
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Display Name</label>
              <input 
                type="text" 
                required
                value={formData.display_name}
                onChange={e => setFormData({...formData, display_name: e.target.value})}
                placeholder="e.g. John Doe"
                className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Username / Email</label>
              <input 
                type="text" 
                required
                value={formData.username}
                onChange={e => setFormData({...formData, username: e.target.value})}
                placeholder="e.g. johndoe@example.com"
                className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            {!editingUser && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Password</label>
                <input 
                  type="password" 
                  required
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Role</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 py-3 bg-bg-tertiary text-text-primary font-bold rounded-xl hover:bg-bg-tertiary/80 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 py-3 bg-accent-blue text-white font-bold rounded-xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
            >
              {editingUser ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        title="Confirm Deletion"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-accent-red/10 border border-accent-red/20 rounded-2xl">
            <div className="w-12 h-12 bg-accent-red/20 rounded-full flex items-center justify-center text-accent-red">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-lg">Remove Team Member?</p>
              <p className="text-sm text-text-secondary">
                Are you sure you want to remove <span className="font-bold text-text-primary">{deletingUser?.display_name}</span>? This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setDeletingUser(null)}
              className="flex-1 py-3 bg-bg-tertiary text-text-primary font-bold rounded-xl hover:bg-bg-tertiary/80 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleDelete}
              className="flex-1 py-3 bg-accent-red text-white font-bold rounded-xl hover:bg-accent-red/90 transition-all shadow-lg shadow-accent-red/20"
            >
              Remove Member
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
