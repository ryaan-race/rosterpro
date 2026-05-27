/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { sendPasswordResetEmail, updatePassword } from 'firebase/auth';
import { auth } from './lib/firebase';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { ConfigProvider, useConfig } from './components/ConfigProvider';
import { ThemeProvider } from './components/ThemeProvider';
import Shell from './components/Shell';
import CalendarView from './pages/CalendarView';
import SwapBoard from './pages/SwapBoard';
import Attendance from './pages/Attendance';
import Employees from './pages/Employees';
import Reporting from './pages/Reporting';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import WorkReports from './pages/WorkReports';
import WeekOff from './pages/WeekOff';
import TimeOff from './pages/TimeOff';
import AdminHub from './pages/AdminHub';
import { LogIn, Repeat, Calendar as CalendarIcon, ShieldCheck, Zap, Layout, Eye, EyeOff, CheckCircle2, Mail, Lock, Sparkles } from 'lucide-react';
import { getFriendlyAuthErrorMessage, getAllowedSidebarTabs } from './lib/utils';
import { PasswordStrengthValidator } from './components/PasswordStrengthValidator';

function ProtectedApp() {
  const { user, loading: authLoading, signIn, signInWithEmail, signUpWithEmail } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const [currentTab, setCurrentTab] = useState('dashboard');

  // Auth form states
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'normal' | 'manager' | 'admin' | 'super_admin'>('normal');
  const [dept, setDept] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');

  // Recovery link wizard state variables
  const [isUrlRecoveryActive, setIsUrlRecoveryActive] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryTempPass, setRecoveryTempPass] = useState('');
  const [recoveryPasswordVisible, setRecoveryPasswordVisible] = useState(false);

  // Session temporary password helper
  const [showDirectPassReset, setShowDirectPassReset] = useState(() => {
    return sessionStorage.getItem('tempBypassActive') === 'true';
  });
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isResettingDirect, setIsResettingDirect] = useState(false);
  const [directResetDone, setDirectResetDone] = useState(false);
  const [directResetError, setDirectResetError] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [isDirectResetPasswordValid, setIsDirectResetPasswordValid] = useState(false);

  // URL extraction effect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const emailParam = params.get('email');
    const tempPassParam = params.get('tempPass');
    
    if (action === 'access-recovery' && emailParam && tempPassParam) {
      setIsUrlRecoveryActive(true);
      setRecoveryEmail(emailParam);
      setRecoveryTempPass(tempPassParam);
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setResetError('Email address is required.');
      return;
    }
    setSubmitting(true);
    setResetError('');
    setResetSuccess('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSuccess('Recovery instructions transmitted successfully! Please check your email inbox.');
      setResetEmail('');
    } catch (err: any) {
      console.error(err);
      setResetError(getFriendlyAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (config?.departments && config.departments.length > 0 && !dept) {
      setDept(config.departments[0]);
    }
  }, [config, dept]);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name || !dept) {
      setErrorMsg('Please populate all fields.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);
    try {
      await signUpWithEmail(email, password, name, role, dept);
      setSuccessMsg("Account initialized successfully! Logging you in...");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(getFriendlyAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await signIn();
    } catch (err: any) {
      console.warn("Google Sign-In caught error:", err);
      const errMsg = err?.message || String(err);
      if (err?.code === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
        setErrorMsg("The Google Authentication signature popup was blocked by your browser. Please allow popups for this site, or open this application in a direct browser tab using the 'Open in New Tab' arrow button on the top-right of the preview window.");
      } else if (err?.code === 'auth/cancelled-popup-request' || errMsg.includes('cancelled-popup-request') || errMsg.includes('popup-closed-by-user')) {
        setErrorMsg("The external authorization window was closed before registration could complete. Please try signing in again.");
      } else if (errMsg.includes('Pending promise was never set')) {
        setErrorMsg("Browser environment conflict detected. Please reopen this application in a direct browser tab (using the 'Open in new tab' button at the top-right of your preview frame) and try accessing again.");
      } else {
        setErrorMsg("Failed to connect via Google/Gmail: " + (err?.message || String(err)));
      }
    }
  };

  const loading = authLoading || configLoading;

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
        <div className="flex flex-col items-center relative z-10">
          <div className="w-20 h-20 bg-slate-900 rounded-[2.5rem] border border-slate-800 flex items-center justify-center shadow-2xl relative group mb-10 overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-transparent animate-pulse" />
             <div className="w-3 h-3 bg-indigo-500 rounded-full animate-ping" />
          </div>
          <div className="space-y-3 text-center">
             <h3 className="text-white text-xl font-black tracking-[0.3em] uppercase">Initializing</h3>
             <p className="text-slate-500 font-black text-[10px] uppercase tracking-[0.2em]">Syncing Matrix Protocols...</p>
          </div>
          <div className="mt-12 w-64 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
             <motion.div 
               initial={{ width: "0%" }}
               animate={{ width: "100%" }}
               transition={{ duration: 3, repeat: Infinity }}
               className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(244,121,32,0.6)]"
             />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen w-screen flex flex-col lg:flex-row bg-slate-950 overflow-x-hidden overflow-y-auto lg:overflow-hidden selection:bg-indigo-500 selection:text-white">
        <div className="flex-1 p-6 md:p-16 flex flex-col justify-center relative min-h-screen lg:min-h-0">
          {/* Enhanced Premium Deep Space Ambient Shimmer */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-indigo-950/20 via-slate-950/45 to-transparent pointer-events-none" />
          <div className="absolute top-1/4 left-1/3 w-[520px] h-[520px] bg-indigo-500/5 rounded-full blur-[130px] animate-pulse pointer-events-none" style={{ animationDuration: '9s' }} />
          <div className="absolute bottom-1/3 right-1/4 w-[420px] h-[420px] bg-blue-500/5 rounded-full blur-[110px] animate-pulse pointer-events-none" style={{ animationDuration: '14s' }} />
          {/* Luxury micro star structural grid */}
          <div className="absolute inset-0 opacity-20 mix-blend-screen pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse_at_center, rgba(255,255,255,0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          
          <div className="max-w-xl mx-auto w-full relative z-10">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-6 mb-12"
            >
              <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center shadow-[0_0_35px_rgba(79,70,229,0.45)] relative group overflow-hidden border border-indigo-400/25">
                <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent z-10" />
                {config.companyLogo ? (
                   <img src={config.companyLogo} alt="Logo" className="w-full h-full object-cover relative z-10" referrerPolicy="no-referrer" />
                ) : (
                   <ShieldCheck className="w-8 h-8 text-white group-hover:scale-110 transition-transform relative z-10" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="font-black text-4xl tracking-tight text-white leading-none uppercase">{config.companyName}</span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] font-mono">Cognitive Command System</span>
                </div>
              </div>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-6xl font-black text-white tracking-tight mb-6 leading-[0.95]"
            >
              Elite Roster <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-indigo-500 to-indigo-300">Intelligence.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 mb-10 leading-relaxed font-medium text-base max-w-lg"
            >
              A high-performance command center for unified workforce logistics, secure biometric attendance tunnels, and automated roster scheduling.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-4 bg-slate-900/35 backdrop-blur-2xl border border-slate-800/80 rounded-[2rem] p-8 shadow-[0_25px_60px_rgba(0,0,0,0.5)] border-t border-t-indigo-500/25 relative"
            >
              <div className="flex items-center justify-between gap-3 mb-8 border-b border-slate-800/60 pb-5">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-[0.15em] text-indigo-400 font-mono">
                    Officer Authentication Tunnel
                  </span>
                </div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest font-mono select-none px-2.5 py-1 bg-slate-950/50 rounded-lg border border-slate-800/50">SECURE_SSL</span>
              </div>

              {isUrlRecoveryActive ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setErrorMsg('');
                    setSubmitting(true);
                    try {
                      sessionStorage.setItem('tempBypassActive', 'true');
                      await signInWithEmail(recoveryEmail, recoveryTempPass);
                      window.history.replaceState({}, document.title, window.location.origin);
                      setIsUrlRecoveryActive(false);
                      setShowDirectPassReset(true);
                    } catch (err: any) {
                      console.error("Recovery login failed:", err);
                      setErrorMsg(getFriendlyAuthErrorMessage(err) + " - Please verify that this recovery link is still valid or request a fresh pack from your system administrator.");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] rounded-xl font-bold leading-normal text-left">
                    🔑 Security Notice: You are accessing the system via an administratively authorized direct recovery connection.
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Security Email Address</label>
                    <input
                      type="email"
                      readOnly
                      value={recoveryEmail}
                      className="w-full px-4 py-3 bg-slate-950/60 border border-slate-800/60 rounded-2xl text-xs font-bold text-slate-400 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Temporary Access Password</label>
                    <div className="relative">
                      <input
                        type={recoveryPasswordVisible ? "text" : "password"}
                        readOnly
                        value={recoveryTempPass}
                        className="w-full pl-4 pr-10 py-3 bg-slate-950/65 border border-slate-800/60 rounded-2xl text-xs font-bold text-slate-400 focus:outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setRecoveryPasswordVisible(!recoveryPasswordVisible)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-350 focus:outline-none cursor-pointer"
                      >
                        {recoveryPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-bold">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer font-bold"
                    >
                      {submitting ? 'Unlocking Session...' : 'Authenticate & Reset Password'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setIsUrlRecoveryActive(false);
                        window.history.replaceState({}, document.title, window.location.origin);
                      }}
                      className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Exit Access Recovery
                    </button>
                  </div>
                </form>
              ) : forgotPassword ? (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 font-mono">Security Email Address</label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="officer@company.com"
                        value={resetEmail}
                        onChange={e => setResetEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {resetSuccess && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl font-bold leading-relaxed">
                      {resetSuccess}
                    </div>
                  )}

                  {resetError && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-bold leading-relaxed">
                      {resetError}
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full relative overflow-hidden group/btn flex items-center justify-center py-4 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/35 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer font-bold"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                      {submitting ? 'Transmitting Reset...' : 'Transmit Recovery Email'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPassword(false);
                        setResetSuccess('');
                        setResetError('');
                      }}
                      className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      Back to Authentication
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleEmailSignIn} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 font-mono">Secure Email Address</label>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        required
                        placeholder="officer@company.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-inner"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 font-mono">Access Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotPassword(true);
                          setResetSuccess('');
                          setResetError('');
                        }}
                        className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-350 transition-all focus:outline-none cursor-pointer"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative group/input">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type="password"
                        required
                        placeholder="••••••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-slate-950/80 border border-slate-800/80 rounded-2xl text-xs font-medium text-white placeholder-slate-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all shadow-inner font-mono"
                      />
                    </div>
                  </div>
                  
                  {errorMsg && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-bold leading-relaxed">
                      {errorMsg}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full relative overflow-hidden group/btn flex items-center justify-center py-4 bg-indigo-600 hover:bg-indigo-550 border border-indigo-500/35 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_40px_rgba(79,70,229,0.5)] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                    <LogIn className="w-4 h-4 mr-2 group-hover/btn:translate-x-0.5 transition-transform" />
                    {submitting ? 'Authenticating...' : 'Sign In To Control Center'}
                  </button>
                </form>
              )}

              <div className="flex items-center gap-4 my-7 text-center select-none">
                <div className="flex-1 border-t border-slate-800/60" />
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500 font-mono whitespace-nowrap">Secure Direct Gmail Bypass</span>
                <div className="flex-1 border-t border-slate-800/60" />
              </div>

              <button
                onClick={handleGoogleSignIn}
                type="button"
                className="w-full flex items-center justify-center gap-3.5 py-4 bg-slate-950 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-[0.15em] rounded-2xl active:scale-[0.98] transition-all text-center cursor-pointer shadow-[0_5px_15px_rgba(0,0,0,0.3)] relative group/bypass"
              >
                <div className="relative flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 absolute group-hover/bypass:scale-110 transition-transform" />
                  <ShieldCheck className="w-4 h-4 text-indigo-400 animate-ping opacity-35" />
                </div>
                <span>Direct Google/Gmail Access</span>
              </button>
            </motion.div>
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-slate-950 relative p-16 flex-col justify-end overflow-hidden">
          {/* Selector 5 Background */}
          <div className="absolute inset-0">
             {/* Animated Deep Radial Shimmer */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_75%)] z-10 pointer-events-none" />
             <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[180px] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }} />
             
             {/* Selector 4: Double Gradient & Mesh Overlay */}
             <div className="absolute bottom-0 left-0 w-full h-[800px] bg-gradient-to-t from-indigo-950/20 via-indigo-900/5 to-transparent z-10 pointer-events-none" />
             <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:32px_32px]" />
             
             {/* Abstract Grid Elements */}
             <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 gap-px opacity-25">
                {[...Array(144)].map((_, i) => (
                   <div 
                     key={i} 
                     className="border-[0.5px] border-slate-900/60 relative overflow-hidden group"
                   >
                     {/* Random light accents at intersection nodes */}
                     {i % 19 === 0 && (
                       <span className="absolute top-0 left-0 w-1.5 h-1.5 bg-indigo-500/40 rounded-full blur-[2px] animate-ping" style={{ animationDelay: `${i * 100}ms` }} />
                     )}
                   </div>
                ))}
             </div>
          </div>

          <div className="relative z-10 max-w-lg">
             <div className="grid grid-cols-1 gap-24">
                <motion.div 
                   initial={{ opacity: 0, x: 40 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: 0.4 }}
                   className="space-y-6"
                >
                   <div className="w-14 h-14 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl flex items-center justify-center text-indigo-400">
                      <Zap className="w-7 h-7" />
                   </div>
                   <div>
                      <h3 className="text-white font-black text-3xl tracking-tight leading-none mb-4">Neural Scheduling</h3>
                      <p className="text-slate-400 text-lg leading-relaxed">Automated cognitive loops for conflict-free roster generation and real-time load balancing.</p>
                   </div>
                </motion.div>

                <motion.div 
                   initial={{ opacity: 0, x: 40 }}
                   animate={{ opacity: 1, x: 0 }}
                   transition={{ delay: 0.5 }}
                   className="space-y-6"
                >
                   <div className="w-14 h-14 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl flex items-center justify-center text-indigo-400">
                      <Repeat className="w-7 h-7" />
                   </div>
                   <div>
                      <h3 className="text-white font-black text-3xl tracking-tight leading-none mb-4">Swap Protocols</h3>
                      <p className="text-slate-400 text-lg leading-relaxed">Frictionless peer-to-peer exchange of shifts with triple-encryption verification.</p>
                   </div>
                </motion.div>
             </div>
          </div>
          
          <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full" />
        </div>
      </div>
    );
  }

  const allowedTabs = getAllowedSidebarTabs(user, config);
  const activeTab = allowedTabs.includes(currentTab) 
    ? currentTab 
    : (allowedTabs.includes('dashboard') ? 'dashboard' : (allowedTabs[0] || 'dashboard'));

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard onTabChange={setCurrentTab} />;
      case 'matrix': return <Dashboard onTabChange={setCurrentTab} initialViewMode="matrix" />;
      case 'calendar': return <CalendarView />;
      case 'swaps': return <SwapBoard />;
      case 'attendance': return <Attendance />;
      case 'weekoff': return <WeekOff />;
      case 'timeoff': return <TimeOff />;
      case 'employees': return <Employees />;
      case 'reporting': return <Reporting />;
      case 'reports': return <WorkReports />;
      case 'settings': return <Settings />;
      case 'adminhub': return <AdminHub />;
      default: return <Dashboard onTabChange={setCurrentTab} />;
    }
  };

  return (
    <>
      <Shell currentTab={activeTab} onTabChange={setCurrentTab}>
        {renderContent()}
      </Shell>

      {showDirectPassReset && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-[2rem] p-8 shadow-2xl relative text-left"
          >
            <div className="space-y-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mb-2">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">Configure Permanent Credentials</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Access Recovery Protocol Activated</p>
              
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                You have authenticated using a secure administrative temporary password override. For ongoing safety, please establish your personalized permanent password now.
              </p>

              {directResetDone ? (
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span>Credentials updated successfully! Your roster control profile is fully secured.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.removeItem('tempBypassActive');
                      setShowDirectPassReset(false);
                    }}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-md cursor-pointer text-center"
                  >
                    Enter Command Hub
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!resetNewPassword || !isDirectResetPasswordValid) return;
                    setIsResettingDirect(true);
                    setDirectResetError('');
                    try {
                      const currentUser = auth.currentUser;
                      if (!currentUser) throw new Error("No active authenticated session detected. Please sign in again.");
                      
                      // 1. Update Firebase Auth password
                      await updatePassword(currentUser, resetNewPassword);
                      
                      // 2. Also keep user document synchronized in Firestore
                      const { doc, updateDoc } = await import('firebase/firestore');
                      const { db } = await import('./lib/firebase');
                      const userRef = doc(db, 'users', currentUser.uid);
                      await updateDoc(userRef, {
                        password: resetNewPassword,
                        updatedAt: new Date().toISOString()
                      });

                      setDirectResetDone(true);
                    } catch (err: any) {
                      console.error("Direct change failed:", err);
                      setDirectResetError(getFriendlyAuthErrorMessage(err) + " - If the session has expired, please log out and sign in with the temporary password again.");
                    } finally {
                      setIsResettingDirect(false);
                    }
                  }}
                  className="space-y-4 pt-2"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Establish New Password</label>
                    <div className="relative">
                      <input
                        type={showResetNewPassword ? "text" : "password"}
                        required
                        placeholder="Configure strong access code"
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all text-slate-950 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-650 focus:outline-none cursor-pointer"
                      >
                        {showResetNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrengthValidator 
                      password={resetNewPassword} 
                      onValidityChange={setIsDirectResetPasswordValid} 
                    />
                  </div>

                  {directResetError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-bold">
                      {directResetError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        sessionStorage.removeItem('tempBypassActive');
                        setShowDirectPassReset(false);
                      }}
                      className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all cursor-pointer text-center"
                    >
                      Remind Me Later
                    </button>
                    <button
                      type="submit"
                      disabled={isResettingDirect || !isDirectResetPasswordValid}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-550 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-center"
                    >
                      {isResettingDirect ? "Saving Code..." : "Secured Commit"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfigProvider>
          <ProtectedApp />
        </ConfigProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
