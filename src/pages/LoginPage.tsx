import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { Mail, Lock, User as UserIcon, LogIn, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LoginPage: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const { showToast } = useToast();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isResetting) {
        await resetPassword(formData.email);
        showToast('Password reset email sent! Please check your inbox.', 'success');
        setIsResetting(false);
      } else {
        await login(formData.email, formData.password);
        showToast('Successfully logged in!', 'success');
      }
    } catch (error: any) {
      console.warn('Auth error:', error.message);
      let message = 'Failed to authenticate. Please try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password. Please try again.';
      }
      if (error.code === 'auth/invalid-email') message = 'Invalid email format.';
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-bg-primary overflow-hidden">
      {/* Visual Side */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 relative overflow-hidden bg-black">
        {/* Background Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-bg-primary/90 via-bg-primary/40 to-transparent" />
        
        {/* Team Photo */}
        <img 
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&q=80&w=2070"
          alt="Our Team"
          className="absolute inset-0 w-full h-full object-cover opacity-60 scale-105 hover:scale-100 transition-transform duration-[10s]"
        />

        <div className="absolute inset-0 z-20 p-20 flex flex-col justify-between">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="flex items-center gap-4"
          >
            <img 
              src={theme === 'dark' 
                ? "https://auriic.co/wp-content/uploads/2026/04/Auriic-logo-Header.webp" 
                : "https://auriic.co/wp-content/uploads/2026/05/Auriic_dark_Logo.webp"
              } 
              alt="Auriic Logo" 
              className="h-20 w-auto"
              referrerPolicy="no-referrer"
            />
            <div className="h-8 w-px bg-white/20" />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-white tracking-tight">Auriic</span>
              <span className="text-[8px] font-bold text-white/50 uppercase tracking-[0.3em]">Recruitment OS</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-xl"
          >
            <h1 className="text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] font-heading mb-8">
              Empowering <span className="text-accent-blue">Teams</span> to Shape the Future.
            </h1>
            <p className="text-xl text-white/70 leading-relaxed mb-12">
              Join thousands of recruiters worldwide using Auriic to manage high-growth 
              talent pipelines and build world-class organizations.
            </p>

            <div className="flex flex-wrap gap-8">
              {[
                { label: "10k+", sub: "Active Candidates" },
                { label: "500+", sub: "Global Partners" },
                { label: "99.9%", sub: "Service Uptime" }
              ].map((stat, idx) => (
                <div key={idx} className="flex flex-col">
                  <span className="text-2xl font-bold text-white">{stat.label}</span>
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{stat.sub}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex items-center gap-6">
            <div className="flex -space-x-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-10 h-10 rounded-full border-2 border-bg-primary bg-bg-tertiary overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Team${i+10}`} alt="Team Member" />
                </div>
              ))}
            </div>
            <p className="text-xs text-white/50 font-medium">Trusted by leading recruitment teams globally</p>
          </div>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 lg:p-20 relative bg-bg-primary">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md space-y-10"
        >
          <div className="md:hidden flex justify-center mb-10">
            <img 
              src={theme === 'dark' 
                ? "https://auriic.co/wp-content/uploads/2026/04/Auriic-logo-Header.webp" 
                : "https://auriic.co/wp-content/uploads/2026/05/Auriic_dark_Logo.webp"
              } 
              alt="Auriic Logo" 
              className="h-16 w-auto"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="text-center md:text-left">
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 bg-accent-blue/10 rounded-full mb-4">
              <LogIn className="w-3.5 h-3.5 text-accent-blue" />
              <span className="text-[10px] font-bold text-accent-blue uppercase tracking-widest">Platform Access</span>
            </motion.div>
            <motion.h2 variants={itemVariants} className="text-4xl font-bold text-text-primary tracking-tight font-heading">
              {isResetting ? 'Recover Access' : 'Sign In'}
            </motion.h2>
            <motion.p variants={itemVariants} className="text-text-secondary mt-3">
              {isResetting 
                ? 'Enter your email to receive recovery instructions' 
                : 'Welcome back! Please enter your details to continue.'}
            </motion.p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div variants={itemVariants} className="space-y-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-[0.15em] ml-1 text-inherit">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-blue transition-colors" />
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  placeholder="name@company.com"
                  className="w-full bg-bg-secondary border border-border-primary rounded-2xl pl-12 pr-4 py-4 text-sm text-text-primary focus:outline-none focus:border-accent-blue/50 focus:ring-4 focus:ring-accent-blue/5 transition-all"
                />
              </div>
            </motion.div>

            {!isResetting && (
              <motion.div variants={itemVariants} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-[0.15em]">Password</label>
                  <button 
                    type="button"
                    onClick={() => setIsResetting(true)}
                    className="text-[10px] font-bold text-accent-blue uppercase tracking-widest hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-blue transition-colors" />
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    className="w-full bg-bg-secondary border border-border-primary rounded-2xl pl-12 pr-12 py-4 text-sm text-text-primary focus:outline-none focus:border-accent-blue/50 focus:ring-4 focus:ring-accent-blue/5 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-4 bg-accent-blue text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-xl shadow-accent-blue/20 disabled:opacity-50 mt-4 group"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isResetting ? 'Send Recovery Link' : 'Sign In to Dashboard'}</span>
                  {!isResetting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </>
              )}
            </motion.button>
          </form>

          {isResetting && (
            <motion.div variants={itemVariants} className="text-center">
              <button 
                onClick={() => setIsResetting(false)} 
                className="text-accent-blue font-semibold hover:underline text-sm"
              >
                Back to Login
              </button>
            </motion.div>
          )}

          <motion.div variants={itemVariants} className="pt-8 border-t border-border-primary">
            <p className="text-xs text-center text-text-muted leading-relaxed">
              By signing in, you agree to our <span className="text-text-primary underline cursor-pointer">Terms of Service</span> and <span className="text-text-primary underline cursor-pointer">Privacy Policy</span>.
            </p>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-4 pointer-events-none"
        >
          <p className="text-[10px] font-bold text-text-muted/30 uppercase tracking-[0.4em]">
            Auriic Enterprise • Stable v3.0.1
          </p>
        </motion.div>
      </div>
    </div>
  );
};
