import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Clock, 
  Shield, 
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Bell,
  CalendarRange,
  Zap,
  User as UserIcon,
  Key,
  Users,
  UserPlus,
  Mail,
  Edit
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { cn, getFriendlyAuthErrorMessage } from '../lib/utils';
import { motion } from 'motion/react';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { UserPreferences } from '../types';
import ImageUpload from '../components/ImageUpload';
import { CustomSelect } from '../components/CustomSelect';

const getSecondaryAuth = () => {
  const apps = getApps();
  const secondaryApp = apps.find(app => app.name === 'SecondaryRegistrationApp') || initializeApp(firebaseConfig, 'SecondaryRegistrationApp');
  return getAuth(secondaryApp);
};

export default function Settings() {
  const { user } = useAuth();
  const { config, loading: configLoading } = useConfig();
  const [activeTab, setActiveTab] = useState('account');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  
  const [settings, setSettings] = useState(config);
  const [personalPrefs, setPersonalPrefs] = useState<UserPreferences>({
    shiftReminderMinutes: 60,
    notifyOnLateClockIn: true,
    notifyOnSwapRequest: true,
    notifyOnSwapOffers: true,
    notifyOnManagerComments: true,
    notifyOnScheduleRelease: true,
    notifyOnTimeOffChange: true,
    digestFrequency: 'realtime',
    preferredChannels: {
      email: true,
      inApp: true,
      push: false
    }
  });

  const parsedRole = user?.appData?.role?.toLowerCase() || '';
  const isManager = ['manager', 'admin', 'super_admin'].includes(parsedRole);
  const isPrivileged = ['manager', 'admin', 'super_admin', 'hr'].includes(parsedRole);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('normal');
  const [userFormDept, setUserFormDept] = useState('');
  const [userFormStatus, setUserFormStatus] = useState('Active');
  const [userFormDesignation, setUserFormDesignation] = useState('');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormEmployeeId, setUserFormEmployeeId] = useState('');
  const [userFormJoiningDate, setUserFormJoiningDate] = useState('');
  const [userFormGender, setUserFormGender] = useState('');
  const [userFormAddress, setUserFormAddress] = useState('');
  
  // Edited User states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFormName, setEditFormName] = useState('');
  const [editFormRole, setEditFormRole] = useState('normal');
  const [editFormDept, setEditFormDept] = useState('');
  const [editFormDesignation, setEditFormDesignation] = useState('');
  const [editFormStatus, setEditFormStatus] = useState('Active');
  const [editFormPhone, setEditFormPhone] = useState('');
  const [editFormEmployeeId, setEditFormEmployeeId] = useState('');
  const [editFormAddress, setEditFormAddress] = useState('');
  const [editFormJoiningDate, setEditFormJoiningDate] = useState('');
  const [editFormGender, setEditFormGender] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);
  
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateSuccess, setUserCreateSuccess] = useState(false);
  const [userCreateError, setUserCreateError] = useState('');

  const [resetLoadingSelf, setResetLoadingSelf] = useState<string | null>(null);
  const [resetSuccessEmail, setResetSuccessEmail] = useState('');

  useEffect(() => {
    if (!user || !isPrivileged) return;
    
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
    }, (err) => {
      console.error("Failed to load users in settings:", err);
    });

    return () => unsub();
  }, [user, isPrivileged]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmail || !userFormPassword || !userFormName) {
      setUserCreateError('Please fill in all required fields.');
      return;
    }
    
    setUserCreateLoading(true);
    setUserCreateSuccess(false);
    setUserCreateError('');

    try {
      const secAuth = getSecondaryAuth();
      const userCred = await createUserWithEmailAndPassword(secAuth, userFormEmail, userFormPassword);
      const newUid = userCred.user.uid;
      await secAuth.signOut();

      const newUserData = {
        uid: newUid,
        employeeId: userFormEmployeeId || ('EMP-' + newUid.slice(0, 6).toUpperCase()),
        name: userFormName,
        email: userFormEmail,
        password: userFormPassword,
        role: userFormRole,
        department: userFormDept || 'General',
        status: userFormStatus || 'Active',
        designation: userFormDesignation || '',
        phone: userFormPhone || '',
        address: userFormAddress || '',
        joiningDate: userFormJoiningDate || new Date().toISOString().split('T')[0],
        gender: userFormGender || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newUid), newUserData);

      setUserFormName('');
      setUserFormEmail('');
      setUserFormPassword('');
      setUserFormRole('normal');
      setUserFormDept('');
      setUserFormDesignation('');
      setUserFormPhone('');
      setUserFormEmployeeId('');
      setUserFormJoiningDate('');
      setUserFormGender('');
      setUserFormAddress('');
      
      setUserCreateSuccess(true);
    } catch (err: any) {
      console.error(err);
      setUserCreateError(getFriendlyAuthErrorMessage(err));
    } finally {
      setUserCreateLoading(false);
    }
  };

  const handleSelectEditUser = (u: any) => {
    setEditingUser(u);
    setEditFormName(u.name || '');
    setEditFormRole(u.role || 'normal');
    setEditFormDept(u.department || 'General');
    setEditFormDesignation(u.designation || '');
    setEditFormStatus(u.status || 'Active');
    setEditFormPhone(u.phone || '');
    setEditFormEmployeeId(u.employeeId || '');
    setEditFormAddress(u.address || '');
    setEditFormJoiningDate(u.joiningDate || '');
    setEditFormGender(u.gender || '');
    setEditError('');
    setEditSuccess(false);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);
    setEditError('');
    setEditSuccess(false);
    try {
      const userDocRef = doc(db, 'users', editingUser.uid);
      await updateDoc(userDocRef, {
        name: editFormName,
        role: editFormRole,
        department: editFormDept || 'General',
        designation: editFormDesignation || '',
        status: editFormStatus || 'Active',
        phone: editFormPhone || '',
        employeeId: editFormEmployeeId || '',
        address: editFormAddress || '',
        joiningDate: editFormJoiningDate || '',
        gender: editFormGender || '',
        updatedAt: new Date().toISOString()
      });
      setEditSuccess(true);
      setTimeout(() => {
        setEditSuccess(false);
        setEditingUser(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || 'Failed to update personnel record.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this staff record indefinitely? This action is irreversible.")) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setEditingUser(null);
      alert("Employee record deleted successfully.");
    } catch (err: any) {
      console.error(err);
      alert("Failed to delete record: " + err.message);
    }
  };

  const handleTriggerPasswordReset = async (targetEmail: string, targetUid: string) => {
    setResetLoadingSelf(targetUid);
    setResetSuccessEmail('');
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetSuccessEmail(`Instructions transmitted to ${targetEmail}`);
      alert(`A secure password recovery email has been successfully sent to ${targetEmail}.`);
    } catch (err: any) {
      console.error(err);
      alert('Unable to transmit password reset instructions: ' + getFriendlyAuthErrorMessage(err));
    } finally {
      setResetLoadingSelf(null);
    }
  };

  useEffect(() => {
    if (!configLoading) {
      setSettings(config);
    }
    if (user?.appData?.preferences) {
      setPersonalPrefs({
        shiftReminderMinutes: 60,
        notifyOnLateClockIn: true,
        notifyOnSwapRequest: true,
        notifyOnSwapOffers: true,
        notifyOnManagerComments: true,
        notifyOnScheduleRelease: true,
        notifyOnTimeOffChange: true,
        digestFrequency: 'realtime',
        preferredChannels: {
          email: true,
          inApp: true,
          push: false
        },
        ...user.appData.preferences
      });
    } else {
      // Default from config if no personal prefs
      setPersonalPrefs({
        shiftReminderMinutes: config.notifications?.shiftReminderMinutes || 60,
        notifyOnLateClockIn: config.notifications?.alertOnLateClockIn ?? true,
        notifyOnSwapRequest: config.notifications?.notifyManagerOnSwap ?? true,
        notifyOnSwapOffers: true,
        notifyOnManagerComments: true,
        notifyOnScheduleRelease: true,
        notifyOnTimeOffChange: true,
        digestFrequency: 'realtime',
        preferredChannels: {
          email: true,
          inApp: true,
          push: false
        }
      });
    }
  }, [config, configLoading, user]);

  useEffect(() => {
    // If not manager and tried to access manager tabs, switch back to account
    const managerTabs = ['company', 'shifts', 'roster', 'security'];
    if (!isManager && managerTabs.includes(activeTab)) {
      setActiveTab('account');
    }
    // Strict block for non-privileged personnel trying to access staff setup
    if (activeTab === 'users' && !isPrivileged) {
      setActiveTab('account');
    }
  }, [isManager, isPrivileged, activeTab]);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      if (isManager && (activeTab !== 'account' && activeTab !== 'notifications')) {
        await setDoc(doc(db, 'settings', 'config'), settings);
      }
      
      // Always save personal prefs if we are in account or notification tab (or if it's a manager saving global defaults)
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          preferences: personalPrefs
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/config or users/prefs');
    } finally {
      setSaving(false);
    }
  };

  const addDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newDeptName && !settings.departments.includes(newDeptName)) {
      setSettings({ ...settings, departments: [...settings.departments, newDeptName] });
      setNewDeptName('');
    }
  };

  const removeDepartment = (dept: string) => {
    setSettings({ ...settings, departments: settings.departments.filter(d => d !== dept) });
  };

  const addShiftTemplate = () => {
    const newShifts = [...settings.shiftTypes, { name: 'New Shift', start: '09:00', end: '17:00' }];
    setSettings({ ...settings, shiftTypes: newShifts });
  };

  const removeShiftTemplate = (idx: number) => {
    const newShifts = settings.shiftTypes.filter((_, i) => i !== idx);
    setSettings({ ...settings, shiftTypes: newShifts });
  };

  const handleShiftChange = (idx: number, field: 'name' | 'start' | 'end', val: string) => {
    const newShifts = [...settings.shiftTypes];
    newShifts[idx] = { ...newShifts[idx], [field]: val };
    setSettings({ ...settings, shiftTypes: newShifts });
  };

  if (configLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: 'account', label: 'My Account', icon: UserIcon },
    ...(isManager ? [
      { id: 'company', label: 'Company Profile', icon: Building2 },
      { id: 'shifts', label: 'Shift Config', icon: Clock },
      { id: 'roster', label: 'Roster Rules', icon: CalendarRange },
      { id: 'notifications', label: 'Alert Defaults', icon: Bell },
      { id: 'security', label: 'Safety & Security', icon: Shield },
    ] : [
      { id: 'notifications', label: 'Alerts & Comms', icon: Bell },
    ]),
    ...(isPrivileged ? [
      { id: 'users', label: 'Access Control', icon: Key },
    ] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-900 shadow-sm shrink-0">
            <SettingsIcon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">System Settings</h2>
            <p className="text-slate-500 font-medium text-xs md:text-sm">Configure personal and global application behavior.</p>
          </div>
        </div>
        
        {activeTab !== 'users' && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center justify-center px-6 py-3.5 sm:py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all w-full sm:w-auto",
              success 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : "bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-95"
            )}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
            ) : success ? (
              <CheckCircle2 className="w-4 h-4 mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : success ? 'Settings Saved' : 'Save Changes'}
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Navigation */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 scrollbar-none shrink-0 border-b border-slate-200 dark:border-slate-800 md:border-b-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center px-4 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold transition-all whitespace-nowrap min-w-max",
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm border border-slate-200 dark:border-slate-800"
                  : "text-slate-500 hover:bg-slate-200/50 hover:dark:bg-slate-900/40"
              )}
            >
              <tab.icon className={cn("w-4 h-4 mr-2 md:mr-3 shrink-0", activeTab === tab.id ? "text-indigo-600" : "text-slate-400")} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 shadow-sm p-6 sm:p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
             {activeTab === 'account' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                    <input
                      type="text"
                      disabled
                      value={user?.displayName || ''}
                      className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                    <input
                      type="text"
                      disabled
                      value={user?.email || ''}
                      className="w-full px-5 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-bold opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2rem] space-y-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-sm">
                      <Shield className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Role & Permissions</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{user?.appData?.role || 'Personnel'} Access Level</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Department</p>
                        <p className="text-xs font-bold text-slate-700">{user?.appData?.department || 'Unassigned'}</p>
                    </div>
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee ID</p>
                        <p className="text-xs font-bold text-slate-700">{user?.appData?.employeeId || 'SS-'+user?.uid.slice(0,6).toUpperCase()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'company' && isManager && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Organization Digital Identity (Logo)</label>
                  <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem]">
                    <ImageUpload 
                      onUploadSuccess={(url) => setSettings({ ...settings, companyLogo: url })}
                      initialValue={settings.companyLogo || ''}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                    <input
                      type="text"
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Global System Status</label>
                    <CustomSelect
                      value={settings.systemStatus || 'Normal'}
                      onChange={(val) => setSettings({ ...settings, systemStatus: val as any })}
                      options={['Normal', 'Peak', 'Maintenance']}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Headquarters Address</label>
                    <input
                      type="text"
                      value={settings.companyAddress}
                      onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Contact Hotline</label>
                    <input
                      type="text"
                      value={settings.companyPhone}
                      onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col gap-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Manage Departments</label>
                    <form onSubmit={addDepartment} className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="New department name..."
                        value={newDeptName}
                        onChange={(e) => setNewDeptName(e.target.value)}
                        className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                      />
                      <button 
                        type="submit"
                        className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set<string>(settings.departments || [])).map(dept => (
                      <div key={dept} className="group flex items-center bg-white border border-slate-200 pl-4 pr-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 shadow-sm hover:border-slate-300 transition-all">
                        {dept}
                        <button 
                          onClick={() => removeDepartment(dept)}
                          className="ml-2 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shifts' && isManager && (
              <div className="space-y-8">
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                  <p className="text-xs font-medium text-amber-800 leading-relaxed">
                    Shift duration changes will only apply to new shifts created after scaling. Existing roster will remain unchanged.
                  </p>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Shift Presets</label>
                   </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {settings.shiftTypes.map((type, idx) => (
                       <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                         <div className="flex items-center justify-between">
                            <input 
                              type="text"
                              value={type.name}
                              onChange={(e) => handleShiftChange(idx, 'name', e.target.value)}
                              className="text-xs font-black text-slate-900 uppercase tracking-widest bg-transparent border-none focus:ring-0 p-0 w-2/3"
                            />
                            <button 
                              onClick={() => removeShiftTemplate(idx)}
                              className="text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                         <div className="flex gap-2">
                            <input 
                              type="time" 
                              value={type.start} 
                              onChange={(e) => handleShiftChange(idx, 'start', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs" 
                            />
                            <input 
                              type="time" 
                              value={type.end} 
                              onChange={(e) => handleShiftChange(idx, 'end', e.target.value)}
                              className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs" 
                            />
                         </div>
                       </div>
                     ))}
                     <button 
                      onClick={addShiftTemplate}
                      className="border-2 border-dashed border-slate-200 p-4 rounded-2xl flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-all"
                     >
                       <Plus className="w-5 h-5 mr-2" />
                       <span className="text-xs font-bold">Add Template</span>
                     </button>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'roster' && isManager && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Min Rest Period (Hours)</label>
                    <input
                      type="number"
                      value={settings.rosterRules?.minRestHours || 11}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        rosterRules: { ...settings.rosterRules, minRestHours: parseInt(e.target.value) } 
                      })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                    <p className="text-[9px] text-slate-400 font-medium px-1">Mandatory rest duration between consecutive shifts.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Weekly Hour Cap</label>
                    <input
                      type="number"
                      value={settings.rosterRules?.maxWeeklyHours || 48}
                      onChange={(e) => setSettings({ 
                        ...settings, 
                        rosterRules: { ...settings.rosterRules, maxWeeklyHours: parseInt(e.target.value) } 
                      })}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                    <p className="text-[9px] text-slate-400 font-medium px-1">Maximum allowed working hours per 7-day cycle.</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">Auto-Approve Swaps</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Bypass manager approval for peer shift swaps</p>
                  </div>
                  <button 
                    onClick={() => setSettings({ 
                      ...settings, 
                      rosterRules: { ...settings.rosterRules, autoApproveSwaps: !settings.rosterRules?.autoApproveSwaps } 
                    })}
                    className={cn(
                      "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                      settings.rosterRules?.autoApproveSwaps ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                      settings.rosterRules?.autoApproveSwaps ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-8">
                {/* Personal Settings (Visible to All) */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">My Shift Reminder Window</label>
                    <div className="flex items-center gap-6">
                      <input
                        type="range"
                        min="15"
                        max="240"
                        step="15"
                        value={personalPrefs.shiftReminderMinutes}
                        onChange={(e) => setPersonalPrefs({ 
                          ...personalPrefs, 
                          shiftReminderMinutes: parseInt(e.target.value) 
                        })}
                        className="flex-1 accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="w-24 text-center py-2 bg-slate-900 text-white font-black text-xs rounded-xl">
                        {personalPrefs.shiftReminderMinutes}m before
                      </span>
                    </div>
                  </div>

                  {/* Notification Delivery Schedule */}
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2.5rem] space-y-4">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">Notification Delivery Schedule</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                        Configure the aggregation window for all authorized communications.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(['realtime', 'hourly', 'daily', 'weekly'] as const).map((freq) => {
                        const isActive = personalPrefs.digestFrequency === freq;
                        const descriptions = {
                          realtime: 'Instant Alerts',
                          hourly: 'Hourly Digest',
                          daily: 'Daily Summary',
                          weekly: 'Weekly Summary'
                        };
                        return (
                          <button
                            key={freq}
                            onClick={() => setPersonalPrefs({ ...personalPrefs, digestFrequency: freq })}
                            className={cn(
                              "px-4 py-3 rounded-2xl border text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-1",
                              isActive 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                            )}
                          >
                            <span className="capitalize">{freq === 'realtime' ? 'Real-Time' : freq}</span>
                            <span className={cn("text-[9px] font-medium uppercase tracking-wider", isActive ? "text-indigo-200" : "text-slate-400")}>
                              {descriptions[freq]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Notification Delivery Channels */}
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-[2.5rem] space-y-6">
                    <div className="space-y-1">
                      <p className="text-sm font-black text-slate-900">Notification Delivery Channels</p>
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">
                        Manage routing parameters across active networks.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {(['inApp', 'email', 'push'] as const).map((channel) => {
                        const isActive = personalPrefs.preferredChannels?.[channel] ?? false;
                        const labels = {
                          inApp: 'In-app Notification Feed',
                          email: 'Direct Email Alerts',
                          push: 'Web Browser Push'
                        };
                        const icons = {
                          inApp: Bell,
                          email: Building2,
                          push: Zap
                        };
                        const ChannelIcon = icons[channel];
                        return (
                          <button
                            key={channel}
                            onClick={() => setPersonalPrefs({
                              ...personalPrefs,
                              preferredChannels: {
                                email: personalPrefs.preferredChannels?.email ?? true,
                                inApp: personalPrefs.preferredChannels?.inApp ?? true,
                                push: personalPrefs.preferredChannels?.push ?? false,
                                [channel]: !isActive
                              }
                            })}
                            className={cn(
                              "p-4 rounded-2xl border text-left transition-all flex items-center gap-4",
                              isActive 
                                ? "bg-slate-900 border-slate-950 text-white" 
                                : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-xl flex items-center justify-center",
                              isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                              <ChannelIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-black">{channel === 'inApp' ? 'In-App' : channel === 'email' ? 'Email' : 'Push Notification'}</p>
                              <p className="text-[9px] text-slate-400 font-medium">{labels[channel]}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Late Attendance Alerts</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Receive alerts when you are late for a shift</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnLateClockIn: !personalPrefs.notifyOnLateClockIn 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnLateClockIn ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnLateClockIn ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Exchange Request Alerts</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Receive notifications for new shift swap offers</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnSwapRequest: !personalPrefs.notifyOnSwapRequest 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnSwapRequest ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnSwapRequest ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Swap Request Offers</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Receive notifications about individual trade offers from teammates</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnSwapOffers: !personalPrefs.notifyOnSwapOffers 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnSwapOffers ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnSwapOffers ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Manager Comments on Reports</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Receive alerts when manager adds comments on your audit reports</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnManagerComments: !personalPrefs.notifyOnManagerComments 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnManagerComments ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnManagerComments ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Weekly Shift Schedule Releases</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Alerts immediately when a weekly roster template is launched</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnScheduleRelease: !personalPrefs.notifyOnScheduleRelease 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnScheduleRelease ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnScheduleRelease ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900">Time-off Request Status Changes</p>
                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Instant notifications when leaves are approved or rejected</p>
                      </div>
                      <button 
                        onClick={() => setPersonalPrefs({ 
                          ...personalPrefs, 
                          notifyOnTimeOffChange: !personalPrefs.notifyOnTimeOffChange 
                        })}
                        className={cn(
                          "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                          personalPrefs.notifyOnTimeOffChange ? "bg-indigo-600" : "bg-slate-300"
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                          personalPrefs.notifyOnTimeOffChange ? "translate-x-6" : "translate-x-0"
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Global Defaults (Manager Only) */}
                {isManager && (
                  <div className="pt-8 border-t border-slate-100 space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
                      <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">System Default Config (Global)</h4>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-indigo-900">Default Reminder Window</p>
                          <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-widest">Initial setting for new personnel</p>
                        </div>
                        <input
                          type="number"
                          value={settings.notifications?.shiftReminderMinutes}
                          onChange={(e) => setSettings({ 
                            ...settings, 
                            notifications: { ...settings.notifications, shiftReminderMinutes: parseInt(e.target.value) } 
                          })}
                          className="w-16 px-2 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-center"
                        />
                      </div>
                      <div className="flex items-center justify-between p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem]">
                        <div className="space-y-1">
                          <p className="text-sm font-black text-indigo-900">Global Late Alerts</p>
                          <p className="text-[10px] font-medium text-indigo-600 uppercase tracking-widest">Master toggle for attendance monitoring</p>
                        </div>
                        <button 
                          onClick={() => setSettings({ 
                            ...settings, 
                            notifications: { ...settings.notifications, alertOnLateClockIn: !settings.notifications?.alertOnLateClockIn } 
                          })}
                          className={cn(
                            "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                            settings.notifications?.alertOnLateClockIn ? "bg-indigo-600" : "bg-slate-300"
                          )}
                        >
                          <div className={cn(
                            "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                            settings.notifications?.alertOnLateClockIn ? "translate-x-6" : "translate-x-0"
                          )} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'security' && isManager && (
              <div className="space-y-8">
                <div className="flex items-center justify-between p-6 bg-slate-50 border border-slate-200 rounded-[2rem]">
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-900">Photo Verification</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Require selfie for all attendance logs</p>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, requirePhoto: !settings.requirePhoto })}
                    className={cn(
                      "w-14 h-8 rounded-full transition-all relative flex items-center px-1",
                      settings.requirePhoto ? "bg-indigo-600" : "bg-slate-300"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 bg-white rounded-full shadow-md transition-all transform",
                      settings.requirePhoto ? "translate-x-6" : "translate-x-0"
                    )} />
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Geofencing Radius (Meters)</label>
                  <div className="flex items-center gap-6">
                    <input
                      type="range"
                      min="50"
                      max="2000"
                      step="50"
                      value={settings.attendanceRadius}
                      onChange={(e) => setSettings({ ...settings, attendanceRadius: parseInt(e.target.value) })}
                      className="flex-1 accent-indigo-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="w-20 text-center py-2 bg-slate-900 text-white font-black text-xs rounded-xl">
                      {settings.attendanceRadius}m
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-400 italic">
                    Employees must be within this distance from the office coordinate to check in.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'users' && isPrivileged && (
              <div className="space-y-12 text-left">
                {/* Section 1: User Account Registration */}
                <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm space-y-6">
                  <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <UserPlus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Register New Personnel</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mt-1">Create live database credentials</p>
                    </div>
                  </div>

                  {userCreateSuccess && (
                     <div className="p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-4 text-xs font-bold leading-relaxed">
                       <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                       <div>
                         <span>Account synchronized in active directory! Credentials have been safely initialized.</span>
                         <button 
                           onClick={() => setUserCreateSuccess(false)}
                           className="underline block mt-1 hover:text-emerald-900 text-[10px] font-black uppercase"
                         >
                           Create another user
                         </button>
                       </div>
                     </div>
                  )}

                  {userCreateError && (
                     <div className="p-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-4 text-xs font-bold">
                       <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                       <span>{userCreateError}</span>
                     </div>
                  )}

                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alisha Bose"
                        value={userFormName}
                        onChange={(e) => setUserFormName(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Connection</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. alisha@company.com"
                        value={userFormEmail}
                        onChange={(e) => setUserFormEmail(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Initial Sign-In Password</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Create secure access code (min 6 chars)"
                        value={userFormPassword}
                        onChange={(e) => setUserFormPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                     <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Access Level Role</label>
                      <CustomSelect 
                        value={userFormRole}
                        onChange={(val) => setUserFormRole(val)}
                        options={['normal', 'hr', 'manager', 'admin', 'super_admin']
                          .filter(roleName => {
                            const ROLE_LEVEL: Record<string, number> = {
                              'super_admin': 5,
                              'admin': 4,
                              'manager': 3,
                              'hr': 2,
                              'normal': 1
                            };
                            const myLevel = ROLE_LEVEL[parsedRole] || 1;
                            return ROLE_LEVEL[roleName] <= myLevel;
                          })
                          .map(role => ({
                            value: role,
                            label: role === 'normal' ? 'Normal Employee' : role.toUpperCase().replace('_', ' ')
                          }))}
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                      <CustomSelect 
                        value={userFormDept}
                        onChange={(val) => setUserFormDept(val)}
                        options={[
                          { value: "", label: "Choose Department..." },
                          ...(settings.departments || []).map((dept: any) => ({ value: dept, label: dept }))
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Designation / Designation Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Lead Helpdesk Specialist"
                        value={userFormDesignation}
                        onChange={(e) => setUserFormDesignation(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile / Phone Connection</label>
                      <input
                        type="text"
                        placeholder="e.g. 9876543210"
                        value={userFormPhone}
                        onChange={(e) => setUserFormPhone(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Employment Status</label>
                      <CustomSelect 
                        value={userFormStatus}
                        onChange={(val) => setUserFormStatus(val)}
                        options={[
                          { value: "Active", label: "Active Duty" },
                          { value: "On Leave", label: "On Leave" },
                          { value: "Suspended", label: "Suspended" },
                          { value: "Terminated", label: "Terminated" }
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Custom Employee ID (Optional)</label>
                      <input
                        type="text"
                        placeholder="Auto-generated if left blank"
                        value={userFormEmployeeId}
                        onChange={(e) => setUserFormEmployeeId(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Joining Date</label>
                      <input
                        type="date"
                        value={userFormJoiningDate}
                        onChange={(e) => setUserFormJoiningDate(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Gender Identification</label>
                      <CustomSelect 
                        value={userFormGender}
                        onChange={(val) => setUserFormGender(val)}
                        options={[
                          { value: "", label: "Choose Gender..." },
                          { value: "Male", label: "Male" },
                          { value: "Female", label: "Female" },
                          { value: "Other", label: "Other" },
                          { value: "Prefer Not to Say", label: "Prefer Not to Say" }
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5 text-left md:col-span-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Physical Residential Address</label>
                      <textarea
                        rows={2}
                        placeholder="e.g. 128 Main St, Suite 400, Austin, TX"
                        value={userFormAddress}
                        onChange={(e) => setUserFormAddress(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900 resize-none"
                      />
                    </div>

                    <div className="col-span-full pt-4">
                      <button
                        type="submit"
                        disabled={userCreateLoading}
                        className="w-full bg-[#0c142b] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest py-4.5 rounded-2xl disabled:opacity-40 shadow-xl transition-all duration-300"
                      >
                        {userCreateLoading ? 'Synchronizing Credentials...' : 'Register User'}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Section 2: Credential & Password Recovery Directory */}
                <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Key className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">Access Directory</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono mt-1">Credentials and safety controls</p>
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="Filter directory by name..."
                      value={searchUserTerm}
                      onChange={(e) => setSearchUserTerm(e.target.value)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/15 w-full sm:w-64 font-sans text-slate-900"
                    />
                  </div>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                    {allUsers
                      .filter(u => !searchUserTerm || (u.name || '').toLowerCase().includes(searchUserTerm.toLowerCase()))
                      .map((u) => {
                        const ROLE_LEVEL: Record<string, number> = {
                          'super_admin': 5,
                          'admin': 4,
                          'manager': 3,
                          'hr': 2,
                          'normal': 1
                        };
                        const myLevel = ROLE_LEVEL[parsedRole] || 1;
                        const targetLevel = ROLE_LEVEL[u.role?.toLowerCase() || 'normal'] || 1;
                        const canManageTarget = myLevel >= targetLevel;

                        return (
                          <div key={u.uid} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-slate-100 rounded-2xl bg-slate-50/50 hover:bg-slate-50 transition-all gap-4">
                            <div className="space-y-1 text-left">
                              <p className="text-sm font-black text-slate-900 leading-none">
                                {u.name || 'Anonymous User'}
                                {u.employeeId && (
                                  <span className="ml-2 font-mono text-[9px] text-slate-400 font-black bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">
                                    {u.employeeId}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs font-bold text-indigo-600/80 leading-snug mt-1.5 uppercase tracking-wider">
                                {u.designation || 'Staff Personnel'}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500 mt-2">
                                <span className="font-mono text-slate-400">{u.email}</span>
                                {u.phone && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-400">{u.phone}</span>
                                  </>
                                )}
                                <span>•</span>
                                <span className="font-bold text-slate-600">{u.department || 'General'}</span>
                                <span>•</span>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                                  u.status === 'Active' ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-500"
                                )}>
                                  {u.status || 'Active'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className={cn(
                                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider font-mono",
                                u.role === 'super_admin' ? "bg-purple-100 text-purple-700" :
                                u.role === 'admin' ? "bg-blue-100 text-blue-700" :
                                u.role === 'manager' ? "bg-pink-100 text-pink-700" :
                                u.role === 'hr' ? "bg-indigo-100 text-indigo-700" :
                                "bg-slate-200/55 text-slate-700"
                              )}>
                                {u.role || 'Personnel'}
                              </span>

                              {canManageTarget ? (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectEditUser(u)}
                                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-indigo-50/15 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 active:scale-95 text-slate-700 font-sans shadow-sm"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleTriggerPasswordReset(u.email, u.uid)}
                                    disabled={resetLoadingSelf === u.uid}
                                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 flex items-center gap-1.5 active:scale-95 text-[#4f46e5]/90 font-sans shadow-sm"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                    Reset
                                  </button>
                                </div>
                              ) : (
                                <button
                                  disabled
                                  className="px-4 py-2 bg-slate-100 text-slate-400 text-[9px] font-black uppercase tracking-wider rounded-xl cursor-not-allowed border border-slate-200"
                                  title="Role level bounds: You do not possess higher authorization than this user."
                                >
                                  Protected Code
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {allUsers.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-10 font-bold">Scanning secure user database...</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={() => setEditingUser(null)}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-[110]"
          >
            <div className="bg-[#0c142b] p-8 text-white relative shrink-0">
              <button 
                onClick={() => setEditingUser(null)}
                className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center">
                   <Users className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-black tracking-tight uppercase leading-none">Edit Personnel Credentials</h3>
                  <p className="text-indigo-300 text-[10px] font-mono uppercase tracking-widest mt-2 block">ID Connection: {editingUser.email}</p>
                </div>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-left flex-1">
              {editSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-4 text-xs font-bold leading-relaxed">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Personnel configuration synchronized and committed to roster database.</span>
                </div>
              )}

              {editError && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-4 text-xs font-bold">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editFormName}
                    onChange={(e) => setEditFormName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Employee ID / Badge ID</label>
                  <input
                    type="text"
                    required
                    value={editFormEmployeeId}
                    onChange={(e) => setEditFormEmployeeId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Designation Title</label>
                  <input
                    type="text"
                    value={editFormDesignation}
                    onChange={(e) => setEditFormDesignation(e.target.value)}
                    placeholder="e.g. Senior Network Administrator"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile / Phone Connection</label>
                  <input
                    type="text"
                    value={editFormPhone}
                    onChange={(e) => setEditFormPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                  <CustomSelect
                    value={editFormDept}
                    onChange={(val) => setEditFormDept(val)}
                    options={[
                      { value: "", label: "General / Choose..." },
                      ...(settings.departments || []).map((dept: any) => ({ value: dept, label: dept }))
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Access Level Role</label>
                  <CustomSelect
                    value={editFormRole}
                    onChange={(val) => setEditFormRole(val)}
                    options={['normal', 'hr', 'manager', 'admin', 'super_admin']
                      .filter(roleName => {
                        const ROLE_LEVEL: Record<string, number> = {
                          'super_admin': 5,
                          'admin': 4,
                          'manager': 3,
                          'hr': 2,
                          'normal': 1
                        };
                        const myLevel = ROLE_LEVEL[parsedRole] || 1;
                        return ROLE_LEVEL[roleName] <= myLevel;
                      })
                      .map(role => ({
                        value: role,
                        label: role === 'normal' ? 'Normal Employee' : role.toUpperCase().replace('_', ' ')
                      }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Duty Status</label>
                  <CustomSelect
                    value={editFormStatus}
                    onChange={(val) => setEditFormStatus(val)}
                    options={[
                      { value: "Active", label: "Active Duty" },
                      { value: "On Leave", label: "On Leave" },
                      { value: "Suspended", label: "Suspended" },
                      { value: "Terminated", label: "Terminated" }
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Gender Identification</label>
                  <CustomSelect
                    value={editFormGender}
                    onChange={(val) => setEditFormGender(val)}
                    options={[
                      { value: "", label: "Choose Gender..." },
                      { value: "Male", label: "Male" },
                      { value: "Female", label: "Female" },
                      { value: "Other", label: "Other" },
                      { value: "Prefer Not to Say", label: "Prefer Not to Say" }
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Joining Date</label>
                  <input
                    type="date"
                    value={editFormJoiningDate}
                    onChange={(e) => setEditFormJoiningDate(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5 col-span-full">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Physical Residential Address</label>
                  <input
                    type="text"
                    value={editFormAddress}
                    onChange={(e) => setEditFormAddress(e.target.value)}
                    placeholder="e.g. 52, Park Avenue Sector, Mumbai"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="col-span-full border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUser.uid)}
                    className="w-full sm:w-auto px-6 py-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-250 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                    Delete Employee Record
                  </button>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="w-full sm:w-auto px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-widest rounded-2xl transition-all duration-250"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={editSaving}
                      className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl disabled:opacity-40 shadow-xl shadow-indigo-100 transition-all duration-250"
                    >
                      {editSaving ? 'Synchronizing...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
