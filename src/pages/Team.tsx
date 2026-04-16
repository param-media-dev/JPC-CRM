import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToCollection, saveUser, generateId } from '../services/storage';
import { Users, UserPlus, Shield, Mail, Phone, MoreVertical, Edit2, Trash2, X, Save, AlertCircle, ShieldCheck, UserCheck, Lock, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { User, UserRole } from '../types';
import { Modal } from '../components/Modal';
import { useToast } from '../contexts/ToastContext';
import { deleteDoc, doc, setDoc, getDocs, collection, writeBatch, query, where } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, signOut as secondarySignOut, updateProfile, createUserWithEmailAndPassword } from 'firebase/auth';

const ROLES: { value: UserRole; label: string; icon: any; color: string }[] = [
  { value: 'administrator', label: 'Administrator', icon: ShieldCheck, color: 'text-accent-red' },
  { value: 'jpc_sysadmin', label: 'System Admin', icon: ShieldCheck, color: 'text-accent-red' },
  { value: 'jpc_manager', label: 'Placify Manager', icon: Shield, color: 'text-accent-purple' },
  { value: 'jpc_lead_gen', label: 'Lead Generation', icon: UserPlus, color: 'text-accent-amber' },
  { value: 'jpc_sales', label: 'Sales Team', icon: UserCheck, color: 'text-accent-blue' },
  { value: 'jpc_cs', label: 'Customer Success', icon: UserCheck, color: 'text-accent-teal' },
  { value: 'jpc_resume', label: 'Resume Team', icon: UserCheck, color: 'text-accent-amber' },
  { value: 'jpc_recruiter', label: 'Recruiter', icon: UserCheck, color: 'text-accent-green' },
  { value: 'jpc_marketing', label: 'Marketing Leader (TL)', icon: Shield, color: 'text-accent-gray' },
  { value: 'jpc_marketing_support', label: 'Marketing Support', icon: UserCheck, color: 'text-accent-gray' },
  { value: 'jpc_proxy', label: 'Proxy Team', icon: UserCheck, color: 'text-accent-blue' },
  { value: 'jpc_candidate', label: 'Candidate User', icon: UserCheck, color: 'text-accent-teal' },
];

export const Team: React.FC = () => {
  const { user, isAuthReady } = useAuth();
  const { showToast } = useToast();
  const [team, setTeam] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    role: 'jpc_sales' as UserRole,
    password: '',
    leader_id: '' as string | number | null,
    calendly_link: '',
    candidate_id: '',
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
    if (user?.role === 'administrator' || user?.role === 'jpc_sysadmin') return true;
    if (user?.role === 'jpc_manager' && targetRole !== 'administrator' && targetRole !== 'jpc_sysadmin') return true;
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
      const email = formData.username.includes('@') ? formData.username : `${formData.username}@placify-crm.com`;
      
      // Local validation for duplicate username in Firestore
      const isDuplicate = team.some(u => 
        u.username.toLowerCase() === formData.username.toLowerCase() && 
        (!editingUser || u.id !== editingUser.id)
      );

      if (isDuplicate) {
        showToast('A team member with this username already exists.', 'error');
        setIsLoading(false);
        return;
      }

      let userId = editingUser?.id;

      if (!editingUser) {
        // Create Firebase Auth user using a secondary app instance
        // This allows creating a user without logging out the current admin
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryTeam');
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const { user: fUser } = await createUserWithEmailAndPassword(
            secondaryAuth, 
            email, 
            formData.password
          );
          await updateProfile(fUser, { displayName: formData.display_name });
          
          userId = fUser.uid;
          
          const newUser: User = {
            id: userId,
            username: formData.username,
            display_name: formData.display_name,
            email: email,
            role: formData.role,
            leader_id: formData.role === 'jpc_recruiter' ? formData.leader_id : null,
            calendly_link: formData.role === 'jpc_proxy' ? formData.calendly_link : null,
            candidate_id: formData.role === 'jpc_candidate' ? formData.candidate_id : null,
            created_at: new Date().toISOString(),
          };

          await setDoc(doc(db, 'jpc_users', String(newUser.id)), newUser);
          await secondarySignOut(secondaryAuth);
          
          setGeneratedPassword(formData.password);
          showToast('Team member account created successfully!', 'success');
        } catch (authError: any) {
          console.error('Auth creation error:', authError);
          let message = 'Failed to create team member account';
          
          if (authError.code === 'auth/email-already-in-use') {
            // Try to find if this user already exists in Firestore
            const usersSnap = await getDocs(query(collection(db, 'jpc_users'), where('email', '==', email)));
            
            if (!usersSnap.empty) {
              const existingUser = usersSnap.docs[0].data() as User;
              
              // Update their role and details
              const updatedUser: User = {
                ...existingUser,
                username: formData.username,
                display_name: formData.display_name,
                role: formData.role,
                leader_id: formData.role === 'jpc_recruiter' ? formData.leader_id : null,
                calendly_link: formData.role === 'jpc_proxy' ? formData.calendly_link : null,
                candidate_id: formData.role === 'jpc_candidate' ? formData.candidate_id : null,
              };

              await setDoc(doc(db, 'jpc_users', String(existingUser.id)), updatedUser);
              showToast('Existing account updated with new role!', 'success');
              setIsLoading(false);
              setIsModalOpen(false);
              setEditingUser(null);
              setFormData({ username: '', display_name: '', role: 'jpc_sales', password: '', leader_id: null, calendly_link: '', candidate_id: '' });
              return;
            } else {
              message = 'This email is already registered. Please use a different email or contact support.';
            }
          } else if (authError.code === 'auth/weak-password') {
            message = 'Password should be at least 6 characters.';
          }
          showToast(message, 'error');
          setIsLoading(false);
          return;
        }
      } else {
        const updatedUser: User = {
          ...editingUser,
          username: formData.username,
          display_name: formData.display_name,
          email: email,
          role: formData.role,
          leader_id: formData.role === 'jpc_recruiter' ? formData.leader_id : null,
          calendly_link: formData.role === 'jpc_proxy' ? formData.calendly_link : null,
          candidate_id: formData.role === 'jpc_candidate' ? formData.candidate_id : null,
        };
        await setDoc(doc(db, 'jpc_users', String(updatedUser.id)), updatedUser);
        showToast('User updated', 'success');
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setFormData({ username: '', display_name: '', role: 'jpc_sales', password: '', leader_id: null, calendly_link: '', candidate_id: '' });
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

  const resetDatabase = async () => {
    if (user?.role !== 'administrator') return;
    
    setIsLoading(true);
    try {
      const collectionsToClear = [
        'jpc_candidates',
        'jpc_payments',
        'jpc_promises',
        'jpc_qc_checklist',
        'jpc_followups',
        'jpc_activity_logs',
        'jpc_applications',
        'jpc_notifications',
        'jpc_report_logs',
        'jpc_resume_requests',
        'jpc_interviews'
      ];

      for (const collName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collName));
        
        // Process in batches of 500 to avoid Firestore limits
        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
        console.log(`Cleared collection: ${collName}`);
      }

      showToast('Database reset successfully. All data except team members has been removed.', 'success');
      setIsResetModalOpen(false);
    } catch (error) {
      console.error('Reset database error:', error);
      showToast('Failed to reset database. Check console for details.', 'error');
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
      {/* Password Modal */}
      <AnimatePresence>
        {generatedPassword && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary border border-border-primary rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-accent-green/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="w-8 h-8 text-accent-green" />
                </div>
                <h3 className="text-2xl font-bold text-text-primary mb-2">Account Created!</h3>
                <p className="text-text-secondary mb-8">Share these credentials with the new team member. They can now log in directly.</p>
                
                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary text-left">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Login Email</p>
                    <p className="text-sm font-mono text-text-primary">{formData.username.includes('@') ? formData.username : `${formData.username}@placify-crm.com`}</p>
                  </div>
                  <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary text-left relative group">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Password</p>
                    <p className="text-sm font-mono text-text-primary">{generatedPassword}</p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword!);
                        showToast('Password copied!', 'success');
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-accent-blue transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      const signupUrl = window.location.origin;
                      const email = formData.username.includes('@') ? formData.username : `${formData.username}@placify-crm.com`;
                      const message = `Hello, your Placify account is ready!\n\nLogin at: ${signupUrl}\nEmail: ${email}\nPassword: ${generatedPassword}\n\nPlease change your password after logging in.`;
                      navigator.clipboard.writeText(message);
                      showToast('Full message copied to clipboard!', 'success');
                    }}
                    className="w-full py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
                  >
                    <Copy className="w-5 h-5" />
                    Copy Full Invite
                  </button>
                  <button 
                    onClick={() => setGeneratedPassword(null)}
                    className="w-full py-4 bg-bg-tertiary text-text-primary font-bold rounded-2xl hover:bg-bg-tertiary/80 transition-all"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Team Management</h1>
          <p className="text-text-secondary mt-1">Manage your team members and their access levels.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin') && (
            <button 
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-accent-red/10 text-accent-red border border-accent-red/20 font-bold rounded-2xl hover:bg-accent-red/20 transition-all"
            >
              <Trash2 className="w-5 h-5" />
              Reset Database
            </button>
          )}
          {(user?.role === 'administrator' || user?.role === 'jpc_sysadmin' || user?.role === 'jpc_manager') && (
            <button 
              onClick={() => {
                setEditingUser(null);
                setFormData({ username: '', display_name: '', role: 'jpc_sales', password: '', leader_id: null, calendly_link: '', candidate_id: '' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20"
            >
              <UserPlus className="w-5 h-5" />
              Add Team Member
            </button>
          )}
        </div>
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
                                password: '',
                                leader_id: member.leader_id || null,
                                calendly_link: member.calendly_link || '',
                                candidate_id: member.candidate_id || '',
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
                      {member.role === 'jpc_recruiter' && member.leader_id && (
                        <p className="text-[10px] font-bold text-accent-blue uppercase mt-2">
                          TL: {team.find(u => String(u.id) === String(member.leader_id))?.display_name || 'Unknown'}
                        </p>
                      )}
                      {member.role === 'jpc_marketing' && (
                        <p className="text-[10px] font-bold text-accent-green uppercase mt-2">
                          Cluster: {team.filter(u => String(u.leader_id) === String(member.id)).length} Recruiters
                        </p>
                      )}
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
            {formData.role === 'jpc_proxy' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Calendly Booking Link</label>
                <input 
                  type="url" 
                  value={formData.calendly_link}
                  onChange={e => setFormData({...formData, calendly_link: e.target.value})}
                  placeholder="https://calendly.com/your-name"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                />
                <p className="text-[10px] text-text-muted italic px-1">This will be shared with candidates for direct slot selection.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Role</label>
              <select 
                value={formData.role}
                onChange={e => setFormData({...formData, role: e.target.value as UserRole, leader_id: null})}
                className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            {formData.role === 'jpc_candidate' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Candidate ID (Optional)</label>
                <input 
                  type="text" 
                  value={formData.candidate_id}
                  onChange={e => setFormData({...formData, candidate_id: e.target.value})}
                  placeholder="e.g. CAND-123"
                  className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                />
                <p className="text-[10px] text-text-muted italic px-1">Link this user to a specific candidate profile to show their dashboard.</p>
              </div>
            )}
            {formData.role === 'jpc_recruiter' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Marketing Leader (TL)</label>
                <select 
                  value={formData.leader_id || ''}
                  onChange={e => setFormData({...formData, leader_id: e.target.value})}
                  className="w-full bg-bg-tertiary border border-border-primary rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors appearance-none"
                  required
                >
                  <option value="">Select Marketing Leader</option>
                  {team.filter(u => u.role === 'jpc_marketing').map(u => (
                    <option key={u.id} value={u.id}>{u.display_name}</option>
                  ))}
                </select>
              </div>
            )}
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

      {/* Database Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="CRITICAL: Reset Database"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-accent-red/10 border border-accent-red/20 rounded-2xl">
            <div className="w-12 h-12 bg-accent-red/20 rounded-full flex items-center justify-center text-accent-red">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-text-primary text-lg">Wipe All Data?</p>
              <p className="text-sm text-text-secondary">
                This will delete <span className="font-bold text-text-primary">ALL</span> candidates, interviews, logs, and payments. 
                Only team members will be kept. This action is <span className="font-bold text-accent-red underline">IRREVERSIBLE</span>.
              </p>
            </div>
          </div>

          <div className="p-4 bg-bg-tertiary rounded-2xl border border-border-primary">
            <p className="text-xs text-text-muted font-medium">The following will be deleted:</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {['Candidates', 'Interviews', 'Activity Logs', 'Payments', 'Promises', 'Follow-ups', 'Notifications', 'Applications', 'Resume Requests'].map(item => (
                <li key={item} className="text-[10px] text-text-secondary flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-text-muted" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setIsResetModalOpen(false)}
              className="flex-1 py-3 bg-bg-tertiary text-text-primary font-bold rounded-xl hover:bg-bg-tertiary/80 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={resetDatabase}
              className="flex-1 py-3 bg-accent-red text-white font-bold rounded-xl hover:bg-accent-red/90 transition-all shadow-lg shadow-accent-red/20"
            >
              Yes, Reset Everything
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
