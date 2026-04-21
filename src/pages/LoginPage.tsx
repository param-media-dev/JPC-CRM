import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutGrid, ShieldCheck, LogIn, Mail, Lock, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { login, signup, resetPassword } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    displayName: ''
  });

  React.useEffect(() => {
    if (window.location.hash === '#signup') {
      setIsSignup(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isResetting) {
        showToast('Password reset is managed by the system administrator.', 'info');
        setIsResetting(false);
      } else if (isSignup) {
        showToast('Signup is restricted. Please contact the administrator for access.', 'info');
      } else {
        // Use email as username for the WP login endpoint if necessary, 
        // or just pass as username assuming the API handles it.
        await login(formData.email, formData.password);
        showToast('Successfully logged in!', 'success');
      }
    } catch (error: any) {
      console.warn('Auth error:', error.message);
      showToast(error.message || 'Failed to authenticate. Please check your credentials.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-row items-center justify-center gap-6 mx-auto mb-6"
          >
            <img 
              src={theme === 'dark' 
                ? "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-5@4x-scaled.webp" 
                : "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-4@4x-scaled.webp"
              } 
              alt="Placify Logo" 
              className="h-20 w-auto"
              referrerPolicy="no-referrer"
            />
            <div className="w-px h-16 bg-border-primary hidden sm:block"></div>
            <div className="flex flex-col items-start justify-center">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1.5 ml-1">Powered by</span>
              <img 
                src={theme === 'dark' 
                  ? "https://test-wp.param.club/wp-content/uploads/2026/04/Asset-1@4x.webp" 
                  : "https://test-wp.param.club/wp-content/uploads/2026/04/Auriic_Logo-_1_-1.webp"
                } 
                alt="Auriic Logo" 
                className="h-12 w-auto opacity-90"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold text-text-primary tracking-tight font-heading hidden"
          >
            Placify
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-text-secondary mt-2"
          >
            Job Placement Customer Relationship Management
          </motion.p>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-bg-secondary p-8 rounded-3xl border border-border-primary shadow-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-text-primary text-center">
                {isResetting ? 'Reset Password' : isSignup ? 'Create Account' : 'Sign In'}
              </h2>
              
              {isSignup && !isResetting && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input 
                      type="text" 
                      required
                      value={formData.displayName}
                      onChange={e => setFormData({...formData, displayName: e.target.value})}
                      placeholder="John Doe"
                      className="w-full bg-bg-tertiary border border-border-primary rounded-xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Username or Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                  <input 
                    type="text" 
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="name@example.com"
                    className="w-full bg-bg-tertiary border border-border-primary rounded-xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                  />
                </div>
              </div>

              {!isResetting && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-widest">Password</label>
                    {!isSignup && (
                      <button 
                        type="button"
                        onClick={() => setIsResetting(true)}
                        className="text-[10px] font-bold text-accent-blue uppercase tracking-widest hover:underline"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                    <input 
                      type="password" 
                      required
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      placeholder="••••••••"
                      className="w-full bg-bg-tertiary border border-border-primary rounded-xl pl-12 pr-4 py-3 text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-accent-blue text-white font-bold rounded-2xl hover:bg-accent-blue/90 transition-all shadow-lg shadow-accent-blue/20 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  {isResetting ? 'Send Reset Link' : isSignup ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>

            <div className="text-center space-y-2">
              {isResetting && (
                <button 
                  type="button"
                  onClick={() => setIsResetting(false)}
                  className="text-sm font-medium text-accent-blue hover:underline"
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-sm text-text-muted">
            Authorized Personnel Only
          </p>
        </motion.div>
      </div>
    </div>
  );
};
