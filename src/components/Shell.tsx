import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { 
  Activity,
  Cpu,
  Calendar, 
  Repeat, 
  Users, 
  BarChart3, 
  LogOut, 
  Bell,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  ShieldCheck,
  Shield,
  Layout,
  LayoutGrid,
  Settings,
  Coffee,
  Plane,
  FileText,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { useTheme } from './ThemeProvider';
import { cn, getAllowedSidebarTabs } from '../lib/utils';
import { db, onSnapshotSafe, onQuotaExceededChange } from '../lib/firebase';
import { collection, query, where, doc, updateDoc, orderBy, addDoc } from 'firebase/firestore';
import { Avatar } from '../lib/Avatar';
import ImageUpload from './ImageUpload';

interface SidebarItemProps {
  key?: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick: () => void;
  badge?: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { type: 'spring', stiffness: 350, damping: 28 }
  }
};

function SidebarItem({ icon: Icon, label, active, onClick, badge }: SidebarItemProps) {
  return (
    <motion.button
      variants={itemVariants}
      onClick={onClick}
      className={cn(
        "flex items-center w-full px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-[1rem] group mb-1.5 relative overflow-hidden text-left cursor-pointer",
        active 
          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/25" 
          : "text-slate-300 hover:bg-slate-900/60 hover:text-white"
      )}
    >
      <div className={cn(
        "w-6.5 h-6.5 rounded-lg flex items-center justify-center mr-4 transition-all shrink-0",
        active ? "bg-white/20 text-white" : "bg-slate-900 group-hover:bg-slate-800 text-slate-400 group-hover:text-slate-200"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="font-bold tracking-wider truncate mr-2">{label}</span>
      {badge ? (
        <span className="ml-auto bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg shadow-rose-500/25 shrink-0">
          {badge}
        </span>
      ) : null}
      
      {active && (
        <motion.div 
          layoutId="active-nav"
          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
          initial={false}
        />
      )}
    </motion.button>
  );
}

export default function Shell({ children, currentTab, onTabChange }: { 
  children: React.ReactNode; 
  currentTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { user, logout } = useAuth();
  const { config } = useConfig();
  
  const { theme, toggleTheme } = useTheme();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingSwapsCount, setPendingSwapsCount] = useState(0);
  const [pendingTimeOffCount, setPendingTimeOffCount] = useState(0);
  const [pendingWeekOffCount, setPendingWeekOffCount] = useState(0);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isQuotaActive, setIsQuotaActive] = useState(false);

  React.useEffect(() => {
    return onQuotaExceededChange((exceeded) => {
      setIsQuotaActive(exceeded);
    });
  }, []);

  const companyName = config.companyName;

  React.useEffect(() => {
    if (!user) return;

    // Notifications
    const notifQuery = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubNotif = onSnapshotSafe<any>(
      notifQuery, 
      (notifs) => {
        setNotifications(notifs);
        setUnreadNotifications(notifs.filter(n => !n.read).length);
      },
      (err) => console.error("Notification sync failure:", err),
      `notifs_${user.uid}`
    );

    // Pending Swaps for badge
    const swapsQuery = query(collection(db, 'swapRequests'), where('status', '==', 'pending'));
    const unsubSwaps = onSnapshotSafe<any>(
      swapsQuery, 
      (swaps) => setPendingSwapsCount(swaps.length),
      (err) => console.error("Swap sync failure:", err),
      'pending_swaps'
    );

    // Pending TimeOff for badge
    const timeOffQuery = query(collection(db, 'timeOffRequests'), where('status', '==', 'pending'));
    const unsubTimeOff = onSnapshotSafe<any>(
      timeOffQuery,
      (reqs) => setPendingTimeOffCount(reqs.length),
      (err) => console.error("TimeOff sync failure:", err),
      'pending_timeoff'
    );

    // Pending WeekOff for badge
    const weekOffQuery = query(collection(db, 'weekOffPreferences'), where('status', '==', 'pending'));
    const unsubWeekOff = onSnapshotSafe<any>(
      weekOffQuery,
      (prefs) => setPendingWeekOffCount(prefs.length),
      (err) => console.error("WeekOff sync failure:", err),
      'pending_weekoff'
    );

    return () => {
      unsubNotif();
      unsubSwaps();
      unsubTimeOff();
      unsubWeekOff();
    };
  }, [user]);

  const [userShiftsForReminder, setUserShiftsForReminder] = useState<any[]>([]);

  // Sync scheduled shifts for reminder
  React.useEffect(() => {
    if (!user) return;

    const shiftsQuery = query(
      collection(db, 'shifts'),
      where('employeeId', '==', user.uid),
      where('status', '==', 'scheduled')
    );

    const unsub = onSnapshotSafe<any>(
      shiftsQuery, 
      (shifts) => {
        setUserShiftsForReminder(shifts);
      }, 
      (err) => console.error("Reminders shift sync error:", err),
      `user_shifts_${user.uid}`
    );

    return () => unsub();
  }, [user]);

  // Run checking logic reactively based on time ticks, shifts, and notifications
  React.useEffect(() => {
    if (!user || userShiftsForReminder.length === 0) return;

    const checkUpcomingShifts = async () => {
      const now = new Date();
      // 30 minutes threshold with tiny window to prevent double notifications or missing slots
      const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
      
      const shiftsToNotify = userShiftsForReminder.filter(shift => {
        const shiftStart = new Date(shift.startTime);
        // starts within next 30 minutes, and hasn't started yet
        return shiftStart <= thirtyMinutesFromNow && shiftStart > now;
      });

      for (const shift of shiftsToNotify) {
        // Look up notifications to see if already notified
        const alreadyNotified = notifications.some(
          n => n.shiftId === shift.id || (n.title === "Upcoming Shift Reminder" && n.message.includes(shift.type) && n.createdAt.startsWith(shift.startTime.substring(0, 10)))
        );

        if (!alreadyNotified) {
          try {
            const shiftStart = new Date(shift.startTime);
            const formattedTime = format(shiftStart, 'hh:mm a');
            await addDoc(collection(db, 'notifications'), {
              userId: user.uid,
              title: "Upcoming Shift Reminder",
              message: `Your upcoming ${shift.type} shift starts in 30 minutes at ${formattedTime}. Prepare for clock-in protocols.`,
              read: false,
              type: 'shift_change',
              shiftId: shift.id,
              createdAt: new Date().toISOString()
            });
            console.log(`Triggered shift reminder for ${shift.id}`);
          } catch (err) {
            console.error("Error creating shift reminder notification:", err);
          }
        }
      }
    };

    // Run first
    checkUpcomingShifts();

    // Check periodically every 20 seconds
    const intervalId = setInterval(checkUpcomingShifts, 20000);
    return () => clearInterval(intervalId);
  }, [user, userShiftsForReminder, notifications]);

  const markAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      for (const n of unread) {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };
  const handleAvatarUpdate = async (url: string) => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        avatar: url,
        avatarUrl: url,
        updatedAt: new Date().toISOString()
      });
      // Note: Auth state will update via AuthProvider as it listens to 'users' collection
    } catch (err) {
      console.error("Profile update failed:", err);
      alert("Failed to update profile image.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const userRole = user?.appData?.role?.toLowerCase();
  const allowedTabs = getAllowedSidebarTabs(user, config);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Layout },
    { id: 'calendar', label: 'Schedule', icon: Calendar },
    { id: 'matrix', label: 'Shifts', icon: LayoutGrid },
    { id: 'attendance', label: 'Attendance', icon: ShieldCheck },
    { id: 'timeoff', label: 'Time Off', icon: Plane, badge: pendingTimeOffCount },
    { id: 'swaps', label: 'Shift Swaps', icon: Repeat, badge: pendingSwapsCount },
    { id: 'reports', label: 'Work Reports', icon: FileText },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'reporting', label: 'Reporting', icon: BarChart3 },
    { id: 'adminhub', label: 'Admin Hub', icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ].filter(item => allowedTabs.includes(item.id));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 bg-slate-950 z-50 w-72 transform transition-all duration-500 lg:relative lg:translate-x-0 overflow-y-auto flex flex-col shadow-2xl lg:shadow-none border-r border-slate-900 no-print",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex flex-col items-center justify-center space-y-4 relative border-b border-slate-900/40">
          <button className="absolute right-4 top-4 lg:hidden p-2 text-slate-400 hover:text-white transition-colors" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg relative group overflow-hidden">
               <div className="absolute inset-0 bg-gradient-to-br from-white/25 to-transparent z-10" />
               {config.companyLogo ? (
                 <img src={config.companyLogo} alt="Logo" className="w-full h-full object-cover relative z-10" referrerPolicy="no-referrer" />
               ) : (
                 <Cpu className="w-6 h-6 relative z-20 group-hover:scale-110 transition-transform duration-300" />
               )}
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="font-sans text-[14px] tracking-widest text-white uppercase block font-black">ROSTERS</span>
              <span className="text-[10px] font-bold font-['Verdana'] text-center text-indigo-500 uppercase tracking-widest leading-none mt-1.5 block">Smart Workforce</span>
            </div>
          </div>
        </div>

        <motion.nav 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex-1 px-4 py-4 space-y-1 block"
        >
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={currentTab === item.id}
              badge={item.badge}
              onClick={() => {
                onTabChange(item.id);
                setSidebarOpen(false);
              }}
            />
          ))}
        </motion.nav>

        <div className="p-6 space-y-6">

          <div className="flex items-center p-4 bg-slate-900/50 rounded-[1.5rem] border border-slate-800 group cursor-pointer hover:bg-slate-950 transition-all" onClick={() => setIsProfileModalOpen(true)}>
            <Avatar 
              src={user?.appData?.avatar || user?.appData?.avatarUrl || user?.photoURL} 
              name={user?.displayName || 'User'}
              fallback="initials"
              size="lg"
              className="bg-slate-900 border-2 border-slate-800 group-hover:border-indigo-600 transition-all"
            />
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-sm font-black text-white truncate leading-none mb-1.5">{user?.displayName}</p>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest truncate">{userRole || 'Personnel'}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="flex items-center w-full px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] text-rose-500 hover:bg-rose-500/10 rounded-[1.2rem] transition-all border border-transparent hover:border-rose-500/20 group"
          >
            <LogOut className="w-4 h-4 mr-4 group-hover:translate-x-1 transition-transform" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative print:overflow-visible">
        <header className="h-16 md:h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.02)] z-30 no-print">
          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 md:p-3 text-slate-600 hover:bg-slate-50 rounded-xl md:rounded-2xl transition-all border border-transparent hover:border-slate-100"
            >
              <Menu className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="flex items-center gap-2 md:gap-3">
               <span className="w-1 md:w-1.5 h-4 md:h-6 bg-indigo-600 rounded-full" />
               <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight truncate max-w-[200px] sm:max-w-none uppercase">
                {menuItems.find(i => i.id === currentTab)?.label || 'Dashboard'}
               </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-8">
            <div className="hidden xl:flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-[1.2rem] shadow-inner">
               <button className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-white rounded-xl shadow-lg shadow-indigo-500/10 border border-indigo-100 transition-all">Quick Switch</button>
               <button 
                onClick={() => setIsSupportModalOpen(true)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-all"
               >
                Support
               </button>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Premium single Switch theme button with refined dark mode visibility */}
              <button
                onClick={toggleTheme}
                className="relative group p-2 md:p-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/80 rounded-xl md:rounded-[1.1rem] transition-all border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-amber-400 flex items-center justify-center cursor-pointer shadow-sm min-w-[40px] min-h-[40px] md:min-w-[48px] md:min-h-[48px]"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
              >
                <div className="relative w-4.5 h-4.5 md:w-5 md:h-5 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={theme}
                      initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute inset-0 flex items-center justify-center animate-fade-in"
                    >
                      {theme === 'dark' ? (
                        <Sun className="w-full h-full text-amber-400 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-300" />
                      ) : (
                        <Moon className="w-full h-full text-slate-400 group-hover:text-indigo-600 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-300" />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </button>

              <div className="relative">
                <button 
                  className="relative group p-2 md:p-3 hover:bg-indigo-50 rounded-xl md:rounded-[1.1rem] transition-all border border-transparent hover:border-indigo-100"
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                >
                  <div className="relative">
                    <Bell className="w-4.5 h-4.5 md:w-5 md:h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    {unreadNotifications > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 md:w-2.5 h-2 md:h-2.5 bg-rose-500 rounded-full border-2 border-white animate-bounce"></span>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setIsNotificationsOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-200 z-[70] overflow-hidden"
                      >
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                          <h3 className="font-black text-sm text-slate-900 uppercase tracking-widest">Intelligence Feed</h3>
                          <button onClick={markAllAsRead} className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest">Clear All</button>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {notifications.length > 0 ? (
                            notifications.map((n) => (
                              <div 
                                key={n.id} 
                                className={cn(
                                  "p-5 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer relative group",
                                  !n.read && "bg-indigo-50/30"
                                )}
                                onClick={() => markAsRead(n.id)}
                              >
                                {!n.read && <div className="absolute left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-full" />}
                                <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">{n.title}</p>
                                <p className="text-xs font-medium text-slate-600 leading-relaxed">{n.message}</p>
                                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-widest">{format(new Date(n.createdAt), 'MMM dd, HH:mm')}</p>
                              </div>
                            ))
                          ) : (
                            <div className="p-12 text-center">
                               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">System Silent</p>
                            </div>
                          )}
                        </div>
                        <div className="p-4 bg-slate-50 text-center">
                           <button onClick={() => setIsNotificationsOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600">Dismiss Overlay</button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="h-6 md:h-8 w-px bg-slate-100 hidden sm:block" />
              
              <div className="flex items-center gap-2 md:gap-4 group cursor-pointer pl-1 md:pl-2" onClick={() => setIsProfileModalOpen(true)}>
                <div className="text-right hidden sm:block">
                  <p className="text-xs md:text-sm font-black text-slate-900 leading-none group-hover:text-indigo-600 transition-colors uppercase tracking-tight truncate max-w-[150px] sm:max-w-[200px]">{user?.displayName}</p>
                  <p className="text-[8px] md:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 opacity-70">User Profile</p>
                </div>
                <Avatar 
                  src={user?.appData?.avatar || user?.appData?.avatarUrl || user?.photoURL}
                  name={user?.displayName || 'U'}
                  fallback="initials"
                  className="w-8 h-8 md:w-11 md:h-11 shadow-xl shadow-indigo-600/20 group-hover:scale-110 transition-transform bg-indigo-600 text-white font-black text-[10px] md:text-xs"
                />
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-slate-50/50 pb-20 lg:pb-0 print:bg-white print:pb-0">
          {isQuotaActive && (
            <div className="bg-amber-500/10 border border-amber-500/20 px-6 py-4 flex items-center justify-between gap-4 font-sans max-w-7xl mx-auto rounded-3xl mt-4 md:mt-6 text-amber-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-sm shrink-0 animate-pulse">!</div>
                <div className="text-xs font-semibold leading-relaxed">
                  <span className="font-extrabold uppercase tracking-widest mr-2 bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px]">[ Live Sync Paused ]</span>
                  Firebase database daily free reads limit has been exceeded. ShiftSync has automatically activated healthy **Client-Side Storage Fallback Caching**! You can access, view, and read your schedules beautifully.
                </div>
              </div>
            </div>
          )}
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto p-4 md:p-8 print:p-0 print:max-w-none"
          >
            {children}
          </motion.div>
        </section>

        {/* Mobile Bottom Navigation - Visible on LG screens hidden */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-50 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.5)] backdrop-blur-xl bg-white/90 dark:bg-slate-950/90 no-print">
            {menuItems.slice(0, 3).map((item) => (
                <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={cn(
                        "flex flex-col items-center justify-center gap-1 transition-all relative px-1 flex-1",
                        currentTab === item.id ? "text-indigo-650 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"
                    )}
                >
                    <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                        currentTab === item.id 
                          ? "bg-indigo-600 dark:bg-amber-500 text-white dark:text-slate-950 shadow-lg shadow-indigo-500/30 dark:shadow-amber-500/20 -translate-y-1.5 scale-105" 
                          : "bg-transparent"
                    )}>
                        <item.icon className={cn("w-4.5 h-4.5", currentTab === item.id ? "stroke-[2.5]" : "stroke-[1.5]")} />
                    </div>
                    <span className={cn(
                        "text-[7.5px] font-black uppercase tracking-wider transition-all",
                        currentTab === item.id ? "opacity-100 visible" : "opacity-0 invisible h-0"
                    )}>
                        {item.label.split(' ')[1] || item.label}
                    </span>
                    {item.badge ? (
                        <span className="absolute top-0 right-2 w-4.5 h-4.5 bg-rose-500 text-white text-[8px] flex items-center justify-center rounded-full border-2 border-white dark:border-slate-950 font-black">
                            {item.badge}
                        </span>
                    ) : null}
                </button>
            ))}
            <button
                onClick={() => setSidebarOpen(true)}
                className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 px-1 flex-1"
            >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-850">
                    <Menu className="w-4.5 h-4.5" />
                </div>
                <span className="text-[7.5px] font-black uppercase tracking-wider">More</span>
            </button>
            <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to log out of ShiftSync?")) {
                    logout();
                  }
                }}
                className="flex flex-col items-center justify-center gap-1 text-rose-500 dark:text-rose-400 px-1 flex-1"
            >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                    <LogOut className="w-4.5 h-4.5" />
                </div>
                <span className="text-[7.5px] font-black uppercase tracking-wider">Exit</span>
            </button>
        </nav>

        <footer className="h-10 md:h-12 bg-slate-950 border-t border-slate-900 flex items-center justify-between px-4 md:px-8 text-white shrink-0 z-30 hidden lg:flex no-print">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Secure Network: <span className="text-emerald-500">OPTIMAL</span></p>
            </div>
            <div className="hidden sm:block h-3 w-px bg-slate-800" />
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 hidden md:block">Sync latency: <span className="text-slate-300">14ms</span></p>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2 text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
               <ShieldCheck className="w-3 md:w-3.5 h-3 md:h-3.5 text-indigo-500" />
               <span className="hidden sm:inline">Encrypted Gateway Verified</span>
            </div>
            <span className="text-[8px] md:text-[9px] font-black text-indigo-400 border border-indigo-400/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase tracking-widest hidden sm:block">v.RFSL-2.4</span>
          </div>
        </footer>
      </main>

      <AnimatePresence>
        {isSupportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsSupportModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-slate-900 p-8 text-white text-center relative">
                <button 
                  onClick={() => setIsSupportModalOpen(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                   <Activity className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">Squad Support</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Operational Assistance</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600">
                         <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentation</p>
                        <p className="text-xs font-bold text-slate-900 leading-tight mt-0.5">Access Operating Procedures</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                   </div>

                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-emerald-600">
                         <MessageSquare className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Chat</p>
                        <p className="text-xs font-bold text-slate-900 leading-tight mt-0.5">Connect with Fleet Control</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                   </div>

                   <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-rose-600">
                         <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Emergency</p>
                        <p className="text-xs font-bold text-slate-900 leading-tight mt-0.5">Signal Critical Incident</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                   </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <p className="text-[9px] font-bold text-slate-400 text-center uppercase tracking-widest leading-relaxed">
                    {config.companyName} Support Protocol v2.4<br/>
                    All sessions are logged for audit compliance.
                  </p>
                </div>

                <button 
                  onClick={() => setIsSupportModalOpen(false)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-100"
                >
                  Close Console
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 text-white text-center relative">
                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="w-24 h-24 mx-auto rounded-[2rem] bg-white/20 p-1 backdrop-blur-md mb-4 border border-white/30 shadow-2xl overflow-hidden flex items-center justify-center">
                  <div className="w-full h-full rounded-[1.8rem] bg-indigo-500 overflow-hidden flex items-center justify-center">
                    <Avatar 
                      src={user?.appData?.avatar || user?.appData?.avatarUrl || user?.photoURL}
                      name={user?.displayName || 'User'}
                      fallback="initials"
                      size="xl"
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-black tracking-tight">{user?.displayName}</h3>
                <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-widest mt-1">User Settings</p>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Profile Identity</label>
                  <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                    <ImageUpload 
                      onUploadSuccess={handleAvatarUpdate}
                      initialValue={user?.appData?.avatar || user?.appData?.avatarUrl || ''}
                    />
                  </div>
                </div>

                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed uppercase tracking-tight">
                    Update your profile image to stay verified across the workforce network.
                  </p>
                </div>

                <button 
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
