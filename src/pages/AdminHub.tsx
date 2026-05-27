import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldAlert, 
  ShieldCheck, 
  Briefcase, 
  Building2, 
  Trash2, 
  Search, 
  Plus, 
  X, 
  CheckCircle2, 
  Check, 
  AlertCircle, 
  Edit3, 
  Lock, 
  RefreshCw, 
  UserCheck, 
  Award, 
  Smile, 
  ChevronRight, 
  Activity, 
  SlidersHorizontal,
  Mail,
  Eye,
  EyeOff,
  Download,
  Upload,
  Copy,
  KeyRound,
  AlertTriangle,
  Info
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { CustomSelect } from '../components/CustomSelect';
import { PasswordStrengthValidator } from '../components/PasswordStrengthValidator';
import { getFriendlyAuthErrorMessage, getRolePermission, hasPermission } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Secure setup for secondary authentication instance to prevent log-out of the active administrator
const getSecondaryAuthForAdminHub = () => {
  const apps = getApps();
  const secondaryApp = apps.find(app => app.name === 'SecondaryRegistrationApp') || initializeApp(firebaseConfig, 'SecondaryRegistrationApp');
  return getAuth(secondaryApp);
};

export default function AdminHub() {
  const { user } = useAuth();
  const { config, loading: configLoading } = useConfig();
  
  // Navigation inside Admin Hub
  const [activeSubtab, setActiveSubtab] = useState<'users' | 'roles' | 'departments'>('users');
  
  // Data State
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  // Modals & Active Edits State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<string | null>(null);

  // Registration Form State
  const [userFormName, setUserFormName] = useState('');
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState('normal');
  const [userFormDept, setUserFormDept] = useState('');
  const [userFormDesignation, setUserFormDesignation] = useState('');
  const [userFormPhone, setUserFormPhone] = useState('');
  const [userFormEmployeeId, setUserFormEmployeeId] = useState('');
  const [userFormJoiningDate, setUserFormJoiningDate] = useState('');
  const [userFormGender, setUserFormGender] = useState('');
  const [userFormAddress, setUserFormAddress] = useState('');
  const [userFormStatus, setUserFormStatus] = useState('Active');
  const [userFormSkillTags, setUserFormSkillTags] = useState('');
  
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateSuccess, setUserCreateSuccess] = useState(false);
  const [userCreateError, setUserCreateError] = useState('');
  const [showForceSyncOption, setShowForceSyncOption] = useState(false);
  const [appAlert, setAppAlert] = useState<{ show: boolean; title: string; message: string; isConfirm?: boolean; onConfirm?: () => void; type?: 'info' | 'success' | 'warn' | 'error' } | null>(null);

  const triggerAlert = (message: string, title: string = "Notice", type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
    setAppAlert({ show: true, title, message, type });
  };
  const triggerConfirm = (message: string, onConfirm: () => void, title: string = "Confirmation") => {
    setAppAlert({ show: true, title, message, isConfirm: true, onConfirm, type: 'warn' });
  };

  // Diagnostic State
  const [isDiagnosticPanelOpen, setIsDiagnosticPanelOpen] = useState(false);
  const [diagnosticEmail, setDiagnosticEmail] = useState('');
  const [diagnosticPassword, setDiagnosticPassword] = useState('');
  const [diagnosticRole, setDiagnosticRole] = useState('normal');
  const [diagnosticName, setDiagnosticName] = useState('');
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticMsg, setDiagnosticMsg] = useState('');
  const [diagnosticSuccessMsg, setDiagnosticSuccessMsg] = useState('');

  // Editing Form State
  const [editFormName, setEditFormName] = useState('');
  const [editFormEmail, setEditFormEmail] = useState('');
  const [editFormRole, setEditFormRole] = useState('normal');
  const [editFormDept, setEditFormDept] = useState('General');
  const [editFormDesignation, setEditFormDesignation] = useState('');
  const [editFormStatus, setEditFormStatus] = useState('Active');
  const [editFormPhone, setEditFormPhone] = useState('');
  const [editFormEmployeeId, setEditFormEmployeeId] = useState('');
  const [editFormAddress, setEditFormAddress] = useState('');
  const [editFormJoiningDate, setEditFormJoiningDate] = useState('');
  const [editFormGender, setEditFormGender] = useState('');
  const [editFormSkillTags, setEditFormSkillTags] = useState('');
  
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState('');

  // Password overriding states inside user editor
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [oldPasswordRequired, setOldPasswordRequired] = useState(false);
  const [manualOldPassword, setManualOldPassword] = useState('');

  // Password strength validation states
  const [isUserFormPasswordValid, setIsUserFormPasswordValid] = useState(false);
  const [isNewPasswordInputValid, setIsNewPasswordInputValid] = useState(false);

  // Password visibility states
  const [showUserFormPassword, setShowUserFormPassword] = useState(false);
  const [showManualOldPassword, setShowManualOldPassword] = useState(false);
  const [showNewPasswordInput, setShowNewPasswordInput] = useState(false);

  // Recovery link exporter states
  const [generatedRecoveryPack, setGeneratedRecoveryPack] = useState<any | null>(null);
  const [isGeneratingRecovery, setIsGeneratingRecovery] = useState(false);

  // Clear generated pack when managed user shifts
  useEffect(() => {
    setGeneratedRecoveryPack(null);
    setShowUserFormPassword(false);
    setShowManualOldPassword(false);
    setShowNewPasswordInput(false);
  }, [editingUser]);

  // Helper password builder meeting all security conditions
  const generateSecurePassword = () => {
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ"; 
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const specials = "!@#$%^*";
    let pass = "";
    pass += uppers[Math.floor(Math.random() * uppers.length)];
    pass += lowers[Math.floor(Math.random() * lowers.length)];
    pass += digits[Math.floor(Math.random() * digits.length)];
    pass += specials[Math.floor(Math.random() * specials.length)];
    
    const all = uppers + lowers + digits + specials;
    for (let i = 0; i < 8; i++) {
      pass += all[Math.floor(Math.random() * all.length)];
    }
    return pass.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const handleGenerateRecoveryPack = async (userObj: any) => {
    if (!userObj) return;
    setIsGeneratingRecovery(true);
    try {
      const tempPass = generateSecurePassword();
      const email = userObj.email;
      const oldPassword = userObj.password;

      // Update secondary credential sync
      const secAuth = getSecondaryAuthForAdminHub();
      if (oldPassword) {
        try {
          const userCred = await signInWithEmailAndPassword(secAuth, email, oldPassword);
          if (userCred.user) {
            await updatePassword(userCred.user, tempPass);
            await secAuth.signOut();
          }
        } catch (authErr) {
          console.warn("Muted background auth sync: user session may have already expired:", authErr);
        }
      }

      // Update user database document
      const userRef = doc(db, 'users', userObj.uid);
      await updateDoc(userRef, {
        password: tempPass,
        updatedAt: new Date().toISOString()
      });

      // Synchronize state locally
      setEditingUser((prev: any) => prev ? { ...prev, password: tempPass } : null);

      const recoveryUrl = `${window.location.origin}/?action=access-recovery&email=${encodeURIComponent(email)}&tempPass=${encodeURIComponent(tempPass)}`;

      setGeneratedRecoveryPack({
        name: userObj.name,
        email: email,
        tempPassword: tempPass,
        recoveryUrl: recoveryUrl
      });

      triggerAlert(`Bypass temporary password successfully configured in DB. Share recovery transcript below!`, "Setup Configured", "success");
    } catch (err: any) {
      triggerAlert("Failed to build access recovery pack: " + err.message, "Operation Failed", "error");
    } finally {
      setIsGeneratingRecovery(false);
    }
  };

  const handleDownloadRecoveryPack = () => {
    if (!generatedRecoveryPack) return;
    const { name, email, tempPassword, recoveryUrl } = generatedRecoveryPack;
    const body = `=====================================================
SMART ROSTER LOGISTICS - SECURE IDENTITY RECOVERY TICKET
=====================================================
OFFICER NAME: ${name}
EMAIL CONNECTION: ${email}
DATE COMPILED: ${new Date().toISOString()}

TEMPORARY AUTHENTICATION PASS:
Temporary Pass: ${tempPassword}

DIRECT LOGISTICS ACCESS LINK:
Pre-populated verification bypass link:
${recoveryUrl}

INSTRUCTIONS:
1. Open the direct link or input temp credentials to login.
2. Once connected, open Settings profile to change your password immediately.
=====================================================`;

    const blob = new Blob([body], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `AccessRecovery_Ticket_${name.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyToClipboard = () => {
    if (!generatedRecoveryPack) return;
    const text = `Officer Name: ${generatedRecoveryPack.name}
Email: ${generatedRecoveryPack.email}
Temp Password: ${generatedRecoveryPack.tempPassword}
Setup Password Link: ${generatedRecoveryPack.recoveryUrl}`;
    
    navigator.clipboard.writeText(text).then(() => {
      triggerAlert("Recovery Transcript details successfully copied to clipboard.", "Copied", "success");
    }).catch(err => {
      console.error(err);
      triggerAlert("Clipboard exception: " + err.message, "Copy Failed", "error");
    });
  };

  // CSV Import/Export States & Operations
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [csvSuccess, setCsvSuccess] = useState('');
  const [isCsvPanelOpen, setIsCsvPanelOpen] = useState(false);

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return [];
    
    // Parse headers, replace spaces with underscores or just lowercase matches
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
    
    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const row: string[] = [];
      let inQuotes = false;
      let currentField = '';
      
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      row.push(currentField.trim());
      
      const item: Record<string, string> = {};
      headers.forEach((header, index) => {
        let val = row[index] || '';
        val = val.replace(/^["']|["']$/g, '');
        item[header] = val;
      });
      results.push(item);
    }
    return results;
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvError('');
    setCsvSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setCsvError('Zero active records or headers parsed from spreadsheet.');
          setCsvPreview([]);
          return;
        }
        setCsvPreview(parsed);
      } catch (err: any) {
        setCsvError('Failed parsing CSV spreadsheet content: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = async () => {
    if (csvPreview.length === 0) return;
    setCsvImporting(true);
    setCsvError('');
    setCsvSuccess('');
    
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];
    
    const secAuth = getSecondaryAuthForAdminHub();
    
    for (const item of csvPreview) {
      const email = item.email || item.emailaddress || item['email id'] || '';
      const name = item.name || item.fullname || item['full name'] || '';
      const employeeId = item.employeeid || item.empid || item['employee id'] || '';
      const role = item.role || item.clearance || 'normal';
      const department = item.department || item.dept || 'General';
      const designation = item.designation || '';
      const phone = item.phone || item.phonenumber || item['phone number'] || '';
      const address = item.address || '';
      const gender = item.gender || '';
      const password = item.password || 'ShiftSync2026!';
      const joiningDate = item.joiningdate || item['joining date'] || new Date().toISOString().split('T')[0];
      const skillTagsRaw = item.skilltags || item.expertise || item.skills || '';
      const skillTags = skillTagsRaw ? skillTagsRaw.split(';').map((s: string) => s.trim()).filter(Boolean) : [];

      if (!email || !name) {
        failCount++;
        errors.push(`Row missing email/name: ${JSON.stringify(item)}`);
        continue;
      }
      
      try {
        // Step 1: Create in Auth
        const userCred = await createUserWithEmailAndPassword(secAuth, email, password);
        const newUid = userCred.user.uid;
        await secAuth.signOut();
        
        // Step 2: Store in Firestore
        const newUserData = {
          uid: newUid,
          employeeId: employeeId || ('EMP-' + newUid.slice(0, 6).toUpperCase()),
          name,
          email,
          password,
          role,
          department,
          status: 'Active',
          designation,
          phone,
          address,
          joiningDate,
          gender,
          skillTags,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', newUid), newUserData);
        successCount++;
      } catch (err: any) {
        failCount++;
        errors.push(`Email ${email} account generation failed: ${getFriendlyAuthErrorMessage(err)}`);
      }
    }
    
    setCsvImporting(false);
    if (failCount > 0) {
      setCsvError(`Completed imports with issues: ${successCount} successfully onboarded, ${failCount} skipped/failed. Check console log for details. First issue: ${errors[0]}`);
      console.warn("CSV upload details failed errors:", errors);
    } else {
      setCsvSuccess(`Pre-authorized sync completed: ${successCount} staff accounts successfully onboarded!`);
      setCsvFile(null);
      setCsvPreview([]);
    }
  };

  const handleExportCSV = () => {
    try {
      if (filteredUsers.length === 0) {
        triggerAlert("Zero logs match filters to download CSV reports.", "Empty Dataset", "warn");
        return;
      }
      
      const headers = ['Name', 'Email', 'EmployeeId', 'Role', 'Department', 'Designation', 'Phone', 'Address', 'Status', 'JoiningDate', 'SkillTags', 'CreatedAt'];
      const csvRows = [headers.join(',')];
      
      for (const u of filteredUsers) {
        const row = [
          `"${(u.name || '').replace(/"/g, '""')}"`,
          `"${(u.email || '').replace(/"/g, '""')}"`,
          `"${(u.employeeId || '').replace(/"/g, '""')}"`,
          `"${(u.role || '').replace(/"/g, '""')}"`,
          `"${(u.department || 'General').replace(/"/g, '""')}"`,
          `"${(u.designation || '').replace(/"/g, '""')}"`,
          `"${(u.phone || '').replace(/"/g, '""')}"`,
          `"${(u.address || '').replace(/"/g, '""')}"`,
          `"${(u.status || 'Active').replace(/"/g, '""')}"`,
          `"${(u.joiningDate || '').replace(/"/g, '""')}"`,
          `"${(u.skillTags ? u.skillTags.join(';') : '').replace(/"/g, '""')}"`,
          `"${(u.createdAt || '').replace(/"/g, '""')}"`,
        ];
        csvRows.push(row.join(','));
      }
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `shiftsync-audit-personnel-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      triggerAlert("Failed generating export file: " + err.message, "Export Failed", "error");
    }
  };

  // Departments Structuring Form
  const [newDeptName, setNewDeptName] = useState('');
  const [deptSaving, setDeptSaving] = useState(false);
  const [permissionSaving, setPermissionSaving] = useState<string | null>(null);
  const [sidebarSaving, setSidebarSaving] = useState<string | null>(null);
  const [deptSearchText, setDeptSearchText] = useState('');
  const [departmentMappingSaving, setDepartmentMappingSaving] = useState(false);

  // Parse logged-in user privileges
  const loggedInUserRole = user?.appData?.role?.toLowerCase() || '';
  const isPrivileged = ['manager', 'admin', 'super_admin', 'hr'].includes(loggedInUserRole);

  // Fetch users collection
  useEffect(() => {
    if (!user || !isPrivileged) return;
    
    setLoadingUsers(true);
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })));
      setLoadingUsers(false);
    }, (err) => {
      console.error("Failed to load users in Admin Hub:", err);
      setLoadingUsers(false);
    });

    return () => unsub();
  }, [user, isPrivileged]);

  // Handle register user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmail || !userFormPassword) {
      setUserCreateError('Please complete all required fields.');
      return;
    }
    
    setUserCreateLoading(true);
    setUserCreateSuccess(false);
    setUserCreateError('');
    setShowForceSyncOption(false);

    // Default Name if none provided (e.g., kajal.salavane -> Kajal Salavane)
    const finalName = userFormName.trim() || userFormEmail.split('@')[0].split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    try {
      const secAuth = getSecondaryAuthForAdminHub();
      const userCred = await createUserWithEmailAndPassword(secAuth, userFormEmail, userFormPassword);
      const newUid = userCred.user.uid;
      await secAuth.signOut();

      const newUserData = {
        uid: newUid,
        employeeId: userFormEmployeeId || ('EMP-' + newUid.slice(0, 6).toUpperCase()),
        name: finalName,
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
        skillTags: userFormSkillTags ? userFormSkillTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', newUid), newUserData);

      // Clear form states
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
      setUserFormSkillTags('');
      
      setUserCreateSuccess(true);
      setTimeout(() => setUserCreateSuccess(false), 3000);
    } catch (err: any) {
      console.error(err);
      const friendlyErr = getFriendlyAuthErrorMessage(err);
      setUserCreateError(friendlyErr);
      if (err.code === 'auth/email-already-in-use' || String(err).includes('email-already-in-use') || friendlyErr.toLowerCase().includes('already registered') || friendlyErr.toLowerCase().includes('already in use')) {
        setShowForceSyncOption(true);
      }
    } finally {
      setUserCreateLoading(false);
    }
  };

  const handleForceSyncUser = async () => {
    if (!userFormEmail) return;
    setUserCreateLoading(true);
    setUserCreateError('');
    setShowForceSyncOption(false);
    
    // Default Name if none provided
    const finalName = userFormName.trim() || userFormEmail.split('@')[0].split(/[._-]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    try {
      const existingUserDoc = allUsers.find(u => u.email.toLowerCase().trim() === userFormEmail.toLowerCase().trim());
      
      let finalDocUid = '';
      if (existingUserDoc) {
        finalDocUid = existingUserDoc.uid;
      } else {
        finalDocUid = 'ext_sync_' + Math.random().toString(36).substring(2, 9);
      }

      const syncedUserData = {
        uid: finalDocUid,
        employeeId: userFormEmployeeId || ('EMP-' + finalDocUid.slice(0, 6).toUpperCase()),
        name: finalName,
        email: userFormEmail,
        password: userFormPassword || 'ShiftSync2026!',
        role: userFormRole,
        department: userFormDept || 'General',
        status: userFormStatus || 'Active',
        designation: userFormDesignation || '',
        phone: userFormPhone || '',
        address: userFormAddress || '',
        joiningDate: userFormJoiningDate || new Date().toISOString().split('T')[0],
        gender: userFormGender || '',
        skillTags: userFormSkillTags ? userFormSkillTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', finalDocUid), syncedUserData);
      
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
      setUserFormSkillTags('');

      setUserCreateSuccess(true);
      setTimeout(() => setUserCreateSuccess(false), 3000);
      triggerAlert(`Successfully force-synced real-time profile for ${userFormEmail}! They are now part of your directory.`, "Database Synchronized", "success");
    } catch (err: any) {
      console.error(err);
      setUserCreateError("Sync error: " + err.message);
    } finally {
      setUserCreateLoading(false);
    }
  };

  const handleTriggerResetForFormEmail = async () => {
    if (!userFormEmail) return;
    setUserCreateLoading(true);
    try {
      await sendPasswordResetEmail(auth, userFormEmail);
      setUserCreateSuccess(true);
      setUserCreateError('');
      setShowForceSyncOption(false);
      triggerAlert(`A password reset link has been dispatched to ${userFormEmail} so they can recover their password.`, "Reset Linked Emailed", "success");
    } catch (err: any) {
      setUserCreateError("Reset Link transmission error: " + getFriendlyAuthErrorMessage(err));
    } finally {
      setUserCreateLoading(false);
    }
  };

  // Open Edit User modal
  const handleSelectEditUser = (u: any) => {
    setEditingUser(u);
    setEditFormName(u.name || '');
    setEditFormEmail(u.email || '');
    setEditFormRole(u.role || 'normal');
    setEditFormDept(u.department || 'General');
    setEditFormDesignation(u.designation || '');
    setEditFormStatus(u.status || 'Active');
    setEditFormPhone(u.phone || '');
    setEditFormEmployeeId(u.employeeId || '');
    setEditFormAddress(u.address || '');
    setEditFormJoiningDate(u.joiningDate || '');
    setEditFormGender(u.gender || '');
    setEditFormSkillTags(u.skillTags ? u.skillTags.join(', ') : '');
    setEditError('');
    setEditSuccess(false);
    
    // Reset password override states
    setNewPasswordInput('');
    setManualOldPassword('');
    setOldPasswordRequired(false);
  };

  // Update User database details
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setEditSaving(true);
    setEditError('');
    setEditSuccess(false);
    
    try {
      const emailChanged = editFormEmail.toLowerCase().trim() !== editingUser.email.toLowerCase().trim();
      
      if (emailChanged) {
        let oldPassword = editingUser.password || manualOldPassword;
        if (!oldPassword) {
          setOldPasswordRequired(true);
          setEditSaving(false);
          setEditError("Changing the email address requires verifying credentials on Firebase Auth. Please input their current password manually in the security box below or generate a temporary password override first.");
          return;
        }
        
        const secAuth = getSecondaryAuthForAdminHub();
        try {
          // Sign in with the old credentials first
          const userCred = await signInWithEmailAndPassword(secAuth, editingUser.email, oldPassword);
          if (userCred.user) {
            const { updateEmail } = await import('firebase/auth');
            await updateEmail(userCred.user, editFormEmail.trim());
            await secAuth.signOut();
          }
        } catch (authErr: any) {
          console.error("Auth email sync failed:", authErr);
          setOldPasswordRequired(true);
          throw new Error("Unable to authenticate user to update email. Correct current password is required: " + authErr.message);
        }
      }

      const userDocRef = doc(db, 'users', editingUser.uid);
      await updateDoc(userDocRef, {
        name: editFormName,
        email: editFormEmail.trim(),
        role: editFormRole,
        department: editFormDept || 'General',
        designation: editFormDesignation || '',
        status: editFormStatus || 'Active',
        phone: editFormPhone || '',
        employeeId: editFormEmployeeId || '',
        address: editFormAddress || '',
        joiningDate: editFormJoiningDate || '',
        gender: editFormGender || '',
        skillTags: editFormSkillTags ? editFormSkillTags.split(',').map(s => s.trim()).filter(Boolean) : [],
        updatedAt: new Date().toISOString()
      });
      setEditSuccess(true);
      setTimeout(() => {
        setEditSuccess(false);
        setEditingUser(null);
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Failed to update employee details.");
    } finally {
      setEditSaving(false);
    }
  };

  // Delete User Account Completely from Firestore and Firebase Authentication
  const handleDeleteUser = async (uid: string, email: string, password?: string) => {
    if (uid === user?.uid) {
      triggerAlert("Self-deletion is blocked for security purposes. Please contact another system administrator.", "Security Block", "error");
      return;
    }
    
    triggerConfirm(
      `Are you absolutely sure you want to completely delete ${email}'s record from Firestore and Firebase Authentication? Once deleted, you will be able to register another staff account with the exact same email address.`,
      async () => {
        try {
          // Step 1: Attempt to delete from Auth using secondary Auth App instance
          const secAuth = getSecondaryAuthForAdminHub();
          let passwordToUse = password || manualOldPassword;
          if (passwordToUse) {
            try {
              const userCred = await signInWithEmailAndPassword(secAuth, email, passwordToUse);
              if (userCred.user) {
                const { deleteUser } = await import('firebase/auth');
                await deleteUser(userCred.user);
                console.log("Firebase Authentication account successfully deleted.");
              }
            } catch (authErr: any) {
              console.warn("Secondary Auth deletion skipped or user not found/already deleted:", authErr);
            }
          } else {
            console.warn("No stored password found. Directly deleting Firestore record instead.");
          }

          // Step 2: Delete associated attendance and work reports
          try {
            const attendanceQuery = query(collection(db, 'attendance'), where('employeeId', '==', uid));
            const attendanceSnap = await getDocs(attendanceQuery);
            const attendanceDeletes = attendanceSnap.docs.map(d => deleteDoc(d.ref));

            const reportsQuery = query(collection(db, 'workReports'), where('employeeId', '==', uid));
            const reportsSnap = await getDocs(reportsQuery);
            const reportsDeletes = reportsSnap.docs.map(d => deleteDoc(d.ref));

            await Promise.all([...attendanceDeletes, ...reportsDeletes]);
            console.log("Associated attendance and work reports cleaned up successfully.");
          } catch (cleanupErr: any) {
            console.warn("Non-blocking cleanup of associated records encountered some errors:", cleanupErr);
          }

          // Step 3: Delete Firestore Document
          await deleteDoc(doc(db, 'users', uid));
          triggerAlert(`User ${email} and all associated attendance records/work reports completely deleted from the database.`, "Account Deleted", "success");
          setEditingUser(null);
        } catch (err: any) {
          triggerAlert("Failed to delete record: " + err.message, "Deletion Failed", "error");
        }
      },
      "Confirm Deletion"
    );
  };

  // Send Manual Reset Email
  const handleTriggerResetPassword = async (targetEmail: string) => {
    if (!targetEmail) return;
    try {
      await sendPasswordResetEmail(auth, targetEmail);
      triggerAlert(`A secure password recovery notice is on its way to ${targetEmail}.`, "Reset Transmitted", "success");
    } catch (err: any) {
      triggerAlert("Failed to transmit reset correspondence: " + getFriendlyAuthErrorMessage(err), "Reset Failed", "error");
    }
  };

  // Save dynamic permission
  const handleTogglePermission = async (roleId: string, permissionKey: string) => {
    setPermissionSaving(`${roleId}-${permissionKey}`);
    try {
      const currentPermissions = config.rolePermissions || {};
      const currentValue = getRolePermission(config.rolePermissions, roleId, permissionKey);
      
      const rolePerms = {
        ...(currentPermissions[roleId] || {})
      };
      
      rolePerms[permissionKey] = !currentValue;
      
      const newRolePermissions = {
        ...currentPermissions,
        [roleId]: rolePerms
      };
      
      await updateDoc(doc(db, 'settings', 'config'), {
        rolePermissions: newRolePermissions
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to update role permissions: " + err.message);
    } finally {
      setPermissionSaving(null);
    }
  };

  const handleToggleRoleSidebar = async (roleId: string, tabId: string, currentAllowed: boolean) => {
    setSidebarSaving(`${roleId}-${tabId}`);
    try {
      const currentRoleSidebar = config.roleSidebar || {};
      
      // Load current assigned sidebar tabs of this role or fall back to standard defaults if first customization
      let roleTabs = currentRoleSidebar[roleId];
      if (roleTabs === undefined) {
        const defaults: Record<string, string[]> = {
          super_admin: ['dashboard', 'employees', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings', 'reporting', 'adminhub'],
          admin: ['dashboard', 'employees', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings', 'reporting', 'adminhub'],
          manager: ['dashboard', 'employees', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings', 'reporting', 'adminhub'],
          hr: ['dashboard', 'employees', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings', 'adminhub'],
          normal: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings']
        };
        roleTabs = defaults[roleId] || defaults['normal'];
      }

      const updatedTabs = currentAllowed
        ? roleTabs.filter((t: string) => t !== tabId)
        : [...roleTabs, tabId];

      const newRoleSidebar = {
        ...currentRoleSidebar,
        [roleId]: updatedTabs
      };

      await updateDoc(doc(db, 'settings', 'config'), {
        roleSidebar: newRoleSidebar
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to update sidebar assignments: " + err.message);
    } finally {
      setSidebarSaving(null);
    }
  };

  // Save dynamic department mapping for a role
  const handleToggleRoleDepartment = async (roleId: string, deptName: string) => {
    setDepartmentMappingSaving(true);
    try {
      const currentMapping = config.roleDepartments || {};
      const targetDepts = currentMapping[roleId] || [];
      const updatedDepts = targetDepts.includes(deptName)
        ? targetDepts.filter((d: string) => d !== deptName)
        : [...targetDepts, deptName];
      
      const newMapping = {
        ...currentMapping,
        [roleId]: updatedDepts
      };
      
      await updateDoc(doc(db, 'settings', 'config'), {
        roleDepartments: newMapping
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to update role department assignments: " + err.message);
    } finally {
      setDepartmentMappingSaving(false);
    }
  };

  const handleSetAllRoleDepartments = async (roleId: string, depts: string[], assign: boolean) => {
    setDepartmentMappingSaving(true);
    try {
      const currentMapping = config.roleDepartments || {};
      const newMapping = {
        ...currentMapping,
        [roleId]: assign ? depts : []
      };
      
      await updateDoc(doc(db, 'settings', 'config'), {
        roleDepartments: newMapping
      });
    } catch (err: any) {
      console.error(err);
      alert("Failed to update all role department assignments: " + err.message);
    } finally {
      setDepartmentMappingSaving(false);
    }
  };

  // Administrative password override with accurate session sync
  const handleAdminChangePassword = async () => {
    if (!editingUser) return;
    if (!newPasswordInput || newPasswordInput.length < 6) {
      alert("Please enter a valid password (minimum 6 characters) to override.");
      return;
    }
    
    setIsChangingPassword(true);
    setEditError('');
    setEditSuccess(false);
    
    try {
      const email = editingUser.email;
      let oldPassword = editingUser.password || manualOldPassword;
      
      if (!oldPassword) {
        setOldPasswordRequired(true);
        setIsChangingPassword(false);
        setEditError("This user record does not have a synchronized password stored in the database yet. To perform a direct change, please input their current password manually below to confirm and authorize the change, or use the Reset Password Email option.");
        return;
      }
      
      const secAuth = getSecondaryAuthForAdminHub();
      
      // Step 1: Sign in with the old credentials to retrieve the user's session on secAuth
      let userCred;
      try {
        userCred = await signInWithEmailAndPassword(secAuth, email, oldPassword);
      } catch (authErr: any) {
        console.error("Old password login failed:", authErr);
        setOldPasswordRequired(true);
        throw new Error("Unable to establish user session to change password. This is usually caused by incorrect current credentials. Please input the user's current password manually.");
      }
      
      // Step 2: Update password on the authenticated user instance
      if (userCred.user) {
        await updatePassword(userCred.user, newPasswordInput);
        await secAuth.signOut();
      }
      
      // Step 3: Update Firestore with the new password so we stay in sync
      const userRef = doc(db, 'users', editingUser.uid);
      await updateDoc(userRef, {
        password: newPasswordInput,
        updatedAt: new Date().toISOString()
      });
      
      // Sync internal local state for editingUser as well
      setEditingUser((prev: any) => prev ? { ...prev, password: newPasswordInput } : null);
      setNewPasswordInput('');
      setManualOldPassword('');
      setOldPasswordRequired(false);
      setEditSuccess(true);
      alert("Success! Employee password updated and database synchronized perfectly!");
    } catch (err: any) {
      console.error(err);
      setEditError(getFriendlyAuthErrorMessage(err));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Create Department Function
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptName) return;
    
    const cleanDept = newDeptName.trim();
    const existingDepts = config.departments || [];
    
    if (existingDepts.includes(cleanDept)) {
      alert("This department is already configured.");
      return;
    }

    setDeptSaving(true);
    try {
      const updatedDepts = [...existingDepts, cleanDept];
      await updateDoc(doc(db, 'settings', 'config'), { departments: updatedDepts });
      setNewDeptName('');
    } catch (err: any) {
      console.error(err);
      alert("Failed to declare department: " + err.message);
    } finally {
      setDeptSaving(false);
    }
  };

  // Delete Department Function
  const handleDeleteDept = async (deptName: string) => {
    const hasUsers = allUsers.some(u => u.department?.toLowerCase() === deptName.toLowerCase());
    if (hasUsers) {
      alert(`Department "${deptName}" hosts active employees and cannot be pruned right now. Move employees to other sectors first.`);
      return;
    }

    if (!window.confirm(`Prune "${deptName}" from active corporate sectors?`)) return;

    try {
      const updatedDepts = (config.departments || []).filter(d => d !== deptName);
      await updateDoc(doc(db, 'settings', 'config'), { departments: updatedDepts });
    } catch (err: any) {
      console.error(err);
      alert("Failed to prune department: " + err.message);
    }
  };

  // Roles Metadata Configuration
  const ROLES_METADATA = [
    {
      id: 'super_admin',
      name: 'Super Admin',
      level: 5,
      color: 'from-orange-500 to-rose-600',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: ShieldAlert,
      description: 'Supreme architecture administrator with sweeping global capabilities.',
      permissions: [
        'Total system definitions & config overrides',
        'Direct personnel record deletions',
        'Administrative credentials creation & editing',
        'Firestore system security reviews'
      ]
    },
    {
      id: 'admin',
      name: 'Administrator',
      level: 4,
      color: 'from-indigo-500 to-indigo-700',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      icon: ShieldCheck,
      description: 'Operations administrator managing active directories and enterprise logging.',
      permissions: [
        'Corporate roster assignments & directory setup',
        'System wide reporting & custom dashboards',
        'Registering new company staff accounts',
        'Overriding system status modes'
      ]
    },
    {
      id: 'manager',
      name: 'General Manager',
      level: 3,
      color: 'from-sky-500 to-blue-600',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
      icon: Briefcase,
      description: 'Operations field leader matching team schedules and approving operations.',
      permissions: [
        'Shift planner configurations',
        'Time Off requests validation',
        'Directly approve shift exchange/swaps',
        'Audit daily attendance'
      ]
    },
    {
      id: 'hr',
      name: 'Human Resources',
      level: 2,
      color: 'from-emerald-500 to-teal-600',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: Award,
      description: 'HR controller auditing staff listings, work logs, and onboarding details.',
      permissions: [
        'Active company directories analysis',
        'Personnel documentation reviews',
        'Register live staff accounts',
        'Verify attendance log history'
      ]
    },
    {
      id: 'normal',
      name: 'Normal Employee',
      level: 1,
      color: 'from-slate-500 to-slate-700',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: Smile,
      description: 'Enterprise resource logging standard shifts and updating personal schedules.',
      permissions: [
        'Clock-in and clock-out attendance logging',
        'Post shift exchange/swap requests',
        'Review individual shift assignments',
        'Document and file work reports'
      ]
    }
  ];

  // Extract all unique skill tags dynamically
  const availableSkillTags: string[] = Array.from(
    new Set((allUsers as any[]).flatMap(u => (u.skillTags as string[] || [])))
  ).sort() as string[];

  // Filtering user database list
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          u.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (u.skillTags && u.skillTags.some((tag: string) => tag.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesDept = deptFilter === 'all' || u.department?.toLowerCase() === deptFilter.toLowerCase();
    const matchesRole = roleFilter === 'all' || u.role?.toLowerCase() === roleFilter.toLowerCase();
    const matchesStatus = statusFilter === 'all' || u.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesTag = tagFilter === 'all' || (u.skillTags && u.skillTags.includes(tagFilter));

    return matchesSearch && matchesDept && matchesRole && matchesStatus && matchesTag;
  });

  // Calculate Stat Cards
  const totalEmployees = allUsers.length;
  const activeEmployees = allUsers.filter(u => u.status?.toLowerCase() === 'active').length;
  const totalDepts = config.departments?.length || 0;
  const administrativePersonnel = allUsers.filter(u => ['manager', 'admin', 'super_admin', 'hr'].includes(u.role?.toLowerCase() || '')).length;

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[60vh] text-center font-sans">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h3>
        <p className="text-slate-500 text-xs font-bold max-w-sm mt-2">
          Your credentials do not carry sufficient clearance to inspect global administrative controls.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto text-slate-800 font-sans">
      
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-xl md:text-3xl font-black tracking-tight text-slate-900 uppercase">Admin Hub & Controls</h2>
          <p className="text-[10px] md:text-xs font-bold text-indigo-600 uppercase tracking-widest font-mono mt-1">
            Global directories configuration, credential definitions, and live department maps
          </p>
        </div>
        
        {/* Tab Selection */}
        <div className="flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60 self-start md:self-center">
          <button
            onClick={() => { setActiveSubtab('users'); setSelectedRoleForDetail(null); }}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubtab === 'users' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Users Directory
          </button>
          <button
            onClick={() => setActiveSubtab('roles')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubtab === 'roles' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Role Definitions
          </button>
          <button
            onClick={() => setActiveSubtab('departments')}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeSubtab === 'departments' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            Departments
          </button>
        </div>
      </div>

      {/* Corporate Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Total Personnel</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1.5">{totalEmployees}</h4>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Active / On Duty</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1.5">{activeEmployees}</h4>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Corporate Sectors</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1.5">{totalDepts}</h4>
          </div>
        </div>

        <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none font-bold">Privileged Clearance</p>
            <h4 className="text-2xl font-black text-slate-900 mt-1.5">{administrativePersonnel}</h4>
          </div>
        </div>
      </div>

      {/* SUBTAB CONTENT 1: DIRECTORY & USERS LIST */}
      {activeSubtab === 'users' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              {/* Searching Input */}
              <div className="relative flex-1 max-w-lg group">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Query by Name, Email, Employee ID, or Designation..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all text-slate-900 font-sans"
                />
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-40 z-35">
                  <CustomSelect
                    value={deptFilter}
                    onChange={(val) => setDeptFilter(val)}
                    placeholder="Sector / ALL"
                    options={[
                      { value: 'all', label: 'All Departments' },
                      ...(config.departments || []).map(d => ({ value: d, label: d }))
                    ]}
                    classNameButton="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest min-h-[46px]"
                  />
                </div>

                <div className="w-40 z-30">
                  <CustomSelect
                    value={roleFilter}
                    onChange={(val) => setRoleFilter(val)}
                    placeholder="Clearence / ALL"
                    options={[
                      { value: 'all', label: 'All Roles' },
                      { value: 'super_admin', label: 'Super Admin' },
                      { value: 'admin', label: 'Admin' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'hr', label: 'HR Admin' },
                      { value: 'normal', label: 'Normal Employee' }
                    ]}
                    classNameButton="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest min-h-[46px]"
                  />
                </div>

                <div className="w-40 z-25">
                  <CustomSelect
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(val)}
                    placeholder="Status / ALL"
                    options={[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'Active', label: 'Active Duty' },
                      { value: 'On Leave', label: 'On Leave' },
                      { value: 'Suspended', label: 'Suspended' },
                      { value: 'Terminated', label: 'Terminated' }
                    ]}
                    classNameButton="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest min-h-[46px]"
                  />
                </div>

                <div className="w-40 z-20">
                  <CustomSelect
                    value={tagFilter}
                    onChange={(val) => setTagFilter(val)}
                    placeholder="Expertise / ALL"
                    options={[
                      { value: 'all', label: 'All Expertise' },
                      ...availableSkillTags.map(tag => ({ value: tag, label: tag }))
                    ]}
                    classNameButton="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest min-h-[46px]"
                  />
                </div>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-100 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Onboard Employee
                </button>

                <button
                  onClick={() => setIsDiagnosticPanelOpen(!isDiagnosticPanelOpen)}
                  className={`px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border ${
                    isDiagnosticPanelOpen 
                      ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-200' 
                      : 'bg-rose-50 border-rose-150 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${isDiagnosticPanelOpen ? 'animate-spin' : ''}`} />
                  Auth Sync & Reset
                </button>

                <button
                  onClick={() => setIsCsvPanelOpen(!isCsvPanelOpen)}
                  className={`px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer border ${
                    isCsvPanelOpen 
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-500 shadow-md animate-pulse' 
                      : 'bg-slate-50 border-slate-205 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Import Staff File
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Audit Export (CSV)
                </button>
              </div>
            </div>
          </div>

          {/* Collapsible CSV Bulk Onboarding Area */}
          {isCsvPanelOpen && (
            <div className="p-6 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 rounded-3xl space-y-4 animate-fade-in text-left">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Payroll Spreadsheet Bulk Onboarding</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-normal">
                    Upload payroll, roster, or staff profile spreadsheets. Supported columns: <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Name</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Email</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">EmployeeId</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Role</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Department</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Designation</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Phone</code>, <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Expertise</code> (semi-colon separated), <code className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1 py-0.5 rounded font-mono text-indigo-650 dark:text-amber-400 font-bold">Password</code>.
                  </p>
                </div>
                <button 
                  onClick={() => { setIsCsvPanelOpen(false); setCsvPreview([]); setCsvFile(null); }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-4 items-center">
                <label className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-950 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-indigo-500 dark:hover:border-amber-500 hover:bg-slate-50/50 dark:hover:bg-slate-900 transition-colors w-full md:w-fit min-w-[300px] text-center">
                  <Upload className="w-8 h-8 text-indigo-500 dark:text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Choose CSV Spreadsheet</span>
                  <span className="text-[9px] text-slate-400 dark:text-slate-550 mt-0.5 font-bold">Click here to upload file</span>
                  <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleCSVFileChange} 
                    className="hidden" 
                  />
                </label>

                {csvFile && (
                  <div className="flex-1 space-y-2 w-full text-left">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                      <div className="text-xs text-slate-805 dark:text-slate-200 font-sans font-bold">
                        <span>File Selected:</span> <code className="font-mono text-indigo-650 dark:text-amber-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded font-bold">{csvFile.name}</code> (Size: {(csvFile.size / 1024).toFixed(1)} KB)
                      </div>
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      Total records identified for upload: <span className="text-indigo-600 dark:text-amber-400 font-extrabold">{csvPreview.length} items</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleConfirmCSVImport}
                        disabled={csvImporting || csvPreview.length === 0}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-indigo-100"
                      >
                        {csvImporting ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Processing Secure Sync...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Activate bulk accounts ({csvPreview.length})
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => { setCsvFile(null); setCsvPreview([]); setCsvError(''); setCsvSuccess(''); }}
                        className="px-4 py-2 bg-slate-205 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer font-bold"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {csvError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 text-rose-650 dark:text-rose-405 text-xs rounded-xl font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {csvSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl font-bold flex items-center gap-2 animate-bounce">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{csvSuccess}</span>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Auth Diagnostics & Quick Reset Tool */}
          {isDiagnosticPanelOpen && (
            <div className="p-6 bg-slate-50 border border-rose-200 rounded-3xl space-y-5 animate-fade-in text-left">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-black text-rose-950 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    Firebase Auth Sync & Reset Panel (Direct Credentials Fix)
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1 leading-normal">
                    Onboard existing registered email accounts, trigger manual password reset dispatches, or register accounts with just an email & password instantly.
                  </p>
                </div>
                <button 
                  onClick={() => setIsDiagnosticPanelOpen(false)}
                  className="p-1.5 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4 text-slate-400 hover:text-slate-650" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white p-5 border border-slate-200 rounded-2xl">
                {/* 1. Quick Password Reset Email */}
                <div className="space-y-4 pr-0 lg:pr-6 border-b lg:border-b-0 lg:border-r border-slate-100 pb-6 lg:pb-0">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1.5">
                    ⚙️ Action Type A: Instant Password Reset Link
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    If an email (like <span className="font-bold underline text-slate-705">kajal.salavane@myphoneme.com</span>) is already registered in Firebase but they cannot sign in, type her email here. This sends a password reset email immediately. Once they reset and sign in, their Firestore listing is automatically self-provisioned!
                  </p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Email Address</label>
                      <input
                        type="email"
                        placeholder="Enter target email (e.g. kajal.salavane@myphoneme.com)"
                        value={diagnosticEmail}
                        onChange={(e) => setDiagnosticEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:border-rose-500 transition-all font-sans"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!diagnosticEmail) {
                          alert("Please specify the target email address first.");
                          return;
                        }
                        setDiagnosticLoading(true);
                        setDiagnosticMsg('');
                        setDiagnosticSuccessMsg('');
                        try {
                          await sendPasswordResetEmail(auth, diagnosticEmail.trim());
                          setDiagnosticSuccessMsg(`Password reset correlation link successfully sent to ${diagnosticEmail.trim()}! Check spam if not received within 2 minutes.`);
                        } catch (err: any) {
                          setDiagnosticMsg(getFriendlyAuthErrorMessage(err));
                        } finally {
                          setDiagnosticLoading(false);
                        }
                      }}
                      disabled={diagnosticLoading}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5"
                    >
                      {diagnosticLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      Transmit Reset & Recovery Email
                    </button>
                  </div>
                </div>

                {/* 2. Quick Micro-Onboarder */}
                <div className="space-y-4 pl-0 lg:pl-6">
                  <span className="text-[10px] font-black text-indigo-650 uppercase tracking-widest flex items-center gap-1.5">
                    🚀 Action Type B: Quick Onboard with Email & Password Only
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Accelerated onboarding. Specify the email & temporary access password to generate the Firebase authentication and Firestore listing. Default name & profile values are self-provisioned.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Display Name</label>
                      <input
                        type="text"
                        placeholder="Display Name (e.g. Kajal Salavane)"
                        value={diagnosticName}
                        onChange={(e) => setDiagnosticName(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Onboarding Email</label>
                        <input
                          type="email"
                          placeholder="Onboarding Email"
                          value={diagnosticEmail}
                          onChange={(e) => setDiagnosticEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Access Password</label>
                        <input
                          type="password"
                          placeholder="Password (min 6)"
                          value={diagnosticPassword}
                          onChange={(e) => setDiagnosticPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:bg-white focus:border-indigo-500 transition-all font-sans"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Authorized Role</label>
                      <CustomSelect
                        value={diagnosticRole}
                        onChange={(val) => setDiagnosticRole(val)}
                        options={[
                          { value: 'normal', label: 'Normal Employee' },
                          { value: 'hr', label: 'Human Resource (HR)' },
                          { value: 'manager', label: 'General Manager' },
                          { value: 'admin', label: 'Administrator' },
                          { value: 'super_admin', label: 'Super Admin' }
                        ]}
                        classNameButton="px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest min-h-[42px]"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        const email = diagnosticEmail.trim();
                        const pass = diagnosticPassword.trim();
                        const name = diagnosticName.trim() || email.split('@')[0];
                        if (!email || !pass) {
                          alert("Please enter both the onboarding email and the temporary password.");
                          return;
                        }
                        if (pass.length < 6) {
                          alert("Password must be at least 6 characters.");
                          return;
                        }
                        setDiagnosticLoading(true);
                        setDiagnosticMsg('');
                        setDiagnosticSuccessMsg('');
                        try {
                          // Try creating primary authentication account
                          const secAuth = getSecondaryAuthForAdminHub();
                          const userCred = await createUserWithEmailAndPassword(secAuth, email, pass);
                          const newUid = userCred.user.uid;
                          await secAuth.signOut();

                          // Store in Firestore
                          const newUserData = {
                            uid: newUid,
                            employeeId: 'EMP-' + newUid.slice(0, 6).toUpperCase(),
                            name: name,
                            email: email,
                            password: pass,
                            role: diagnosticRole,
                            department: 'General',
                            status: 'Active',
                            designation: 'Staff Associate',
                            phone: '',
                            address: '',
                            joiningDate: new Date().toISOString().split('T')[0],
                            gender: '',
                            skillTags: [],
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                          };
                          await setDoc(doc(db, 'users', newUid), newUserData);
                          setDiagnosticSuccessMsg(`Direct onboarding synchronization complete! ${email} is registered with password and profile created in Firestore successfully.`);
                          setDiagnosticName('');
                          setDiagnosticEmail('');
                          setDiagnosticPassword('');
                        } catch (err: any) {
                          if (err.code === 'auth/email-already-in-use') {
                            setDiagnosticMsg(`Authentication says "${email}" is ALREADY registered in Firebase. To connect them, click "Transmit Reset & Recovery Email" on the left to reset her password, or click the "Force-Onboard Document" button below to bypass this warning and instantly publish her database directory log.`);
                          } else {
                            setDiagnosticMsg("Failed: " + getFriendlyAuthErrorMessage(err));
                          }
                        } finally {
                          setDiagnosticLoading(false);
                        }
                      }}
                      disabled={diagnosticLoading}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-md shadow-emerald-150 flex items-center justify-center gap-1.5"
                    >
                      {diagnosticLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      Onboard User & Pre-Sync Firestore Now
                    </button>
                  </div>
                </div>
              </div>

              {diagnosticMsg && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl font-bold flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div className="space-y-2">
                    <span>{diagnosticMsg}</span>
                    {diagnosticMsg.includes('ALREADY registered') && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm(`Force write a synced Firestore record for ${diagnosticEmail}?`)) return;
                            setDiagnosticLoading(true);
                            try {
                              const placeholderUid = "forced_" + Math.random().toString(36).substring(2, 9);
                              const newUserData = {
                                uid: placeholderUid,
                                employeeId: 'EMP-' + placeholderUid.toUpperCase(),
                                name: diagnosticName || diagnosticEmail.split('@')[0],
                                email: diagnosticEmail.trim(),
                                password: diagnosticPassword || 'ShiftSync2026!',
                                role: diagnosticRole,
                                department: 'General',
                                status: 'Active',
                                designation: 'Staff Associate',
                                phone: '',
                                address: '',
                                joiningDate: new Date().toISOString().split('T')[0],
                                gender: '',
                                skillTags: [],
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString()
                              };
                              await setDoc(doc(db, 'users', placeholderUid), newUserData);
                              setDiagnosticSuccessMsg(`Successfully force-created Firestore database listing for ${diagnosticEmail.trim()}. They will appear on the personnel directory list!`);
                              setDiagnosticMsg('');
                            } catch (err: any) {
                              alert("Force-create error: " + err.message);
                            } finally {
                              setDiagnosticLoading(false);
                            }
                          }}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all"
                        >
                          🛠️ Force-Onboard Document and Ignore Firebase Auth constraint
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {diagnosticSuccessMsg && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl font-bold flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>{diagnosticSuccessMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Directory Listings Table style */}
          <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
            {loadingUsers ? (
              <div className="p-12 text-center text-slate-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                <span className="text-xs font-bold uppercase tracking-wider">Synchronizing system listings...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <h4 className="text-sm font-black text-slate-700 uppercase">No active registrations found</h4>
                <p className="text-xs font-bold text-slate-400 mt-1">Modify your filters or add a new user to expand directory logs</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Staff Personnel</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Custom ID</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Sector (Dept)</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Clearance/Role</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">System Status</th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Admin Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => {
                      const roleMeta = ROLES_METADATA.find(r => r.id === u.role?.toLowerCase()) || ROLES_METADATA[4];
                      return (
                        <motion.tr
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          key={u.uid}
                          className="hover:bg-slate-50/70 transition-all"
                        >
                          {/* Staff details */}
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center font-black text-slate-600 border border-slate-200">
                                {u.name?.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-slate-900 leading-tight">{u.name}</h5>
                                <p className="text-[10px] text-slate-400 font-bold leading-none mt-1">{u.email}</p>
                                {u.designation && (
                                  <p className="text-[9px] text-indigo-500 font-black uppercase tracking-widest mt-1.5">{u.designation}</p>
                                )}
                                {u.skillTags && u.skillTags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {u.skillTags.map((tag: string) => (
                                      <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-250/20 rounded text-[8px] font-black uppercase tracking-wider font-mono">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Employee ID */}
                          <td className="px-6 py-5 text-xs font-mono font-bold text-slate-600">
                            {u.employeeId || 'AUTO-EMP'}
                          </td>

                          {/* Department */}
                          <td className="px-6 py-5">
                            <span className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-wider block w-fit">
                              {u.department || 'General'}
                            </span>
                          </td>

                          {/* Role Pill */}
                          <td className="px-6 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider block w-fit border ${roleMeta.badgeColor}`}>
                              {u.role ? u.role.replace('_', ' ') : 'Normal'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              u.status === 'Active' ? 'bg-emerald-50 text-emerald-700' :
                              u.status === 'On Leave' ? 'bg-amber-50 text-amber-700' :
                              u.status === 'Suspended' ? 'bg-rose-50 text-rose-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'Active' ? 'bg-emerald-500' :
                                u.status === 'On Leave' ? 'bg-amber-500' :
                                u.status === 'Suspended' ? 'bg-rose-500' :
                                'bg-slate-400'
                              }`} />
                              {u.status || 'Active'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleSelectEditUser(u)}
                                title="Edit Profile"
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              
                              <button
                                onClick={() => handleTriggerResetPassword(u.email)}
                                title="Send Password Reset Email"
                                className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-sky-100"
                              >
                                <Lock className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() => handleDeleteUser(u.uid, u.email, u.password)}
                                title="Delete User"
                                disabled={u.uid === user?.uid}
                                className={`p-2 transition-all border border-transparent ${
                                  u.uid === user?.uid 
                                    ? 'opacity-30 cursor-not-allowed text-slate-300' 
                                    : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-100 rounded-xl cursor-pointer'
                                }`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB CONTENT 2: ROLE DEFINITIONS MATRIX */}
      {activeSubtab === 'roles' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* List of Roles as custom detailed expansion cards */}
          <div className="xl:col-span-2 space-y-6">
            <div className="p-6 bg-white border border-slate-200 rounded-3xl">
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Authorization Archetypes</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Inspect role hierarchy levels and adjust assignments below</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROLES_METADATA.map((r) => {
                const activeCount = allUsers.filter(u => u.role?.toLowerCase() === r.id).length;
                const IconComp = r.icon;
                const isSelected = selectedRoleForDetail === r.id;
                
                return (
                  <motion.div
                    whileHover={{ y: -3 }}
                    key={r.id}
                    onClick={() => setSelectedRoleForDetail(r.id)}
                    className={`p-6 bg-white border rounded-[2rem] shadow-sm cursor-pointer transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected ? 'border-indigo-600 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Visual Level Index header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${r.color} text-white flex items-center justify-center`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-950 uppercase leading-none">{r.name}</h4>
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Clearance Level {r.level}</span>
                        </div>
                      </div>
                      
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black ${r.badgeColor} border`}>
                        {activeCount} Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-4">
                      {r.description}
                    </p>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-indigo-600 tracking-widest">
                        View Active Members
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Side detailing panel for Role Member Listing & Quick reassignment */}
          <div className="spacing-y-6">
            <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm min-h-[500px]">
              {selectedRoleForDetail ? (() => {
                const targetRoleMeta = ROLES_METADATA.find(r => r.id === selectedRoleForDetail)!;
                const roleMembers = allUsers.filter(u => u.role?.toLowerCase() === selectedRoleForDetail);
                const IconComponent = targetRoleMeta.icon;
                
                return (
                  <div className="space-y-6 text-left">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${targetRoleMeta.color} text-white flex items-center justify-center shadow-md`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-950 uppercase leading-none">{targetRoleMeta.name}</h3>
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1">Security Matrix Group</p>
                      </div>
                    </div>

                    {/* Visual Permissions Configurator Matrix */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Dynamic Permissions Registry</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Toggle live authorization permissions below</p>
                      </div>

                      <div className="space-y-3">
                        {[
                          {
                            key: 'canApproveSwaps',
                            label: 'Can Approve Swaps',
                            description: 'Direct authorization & validation of shift exchanges and trades.'
                          },
                          {
                            key: 'canEditReports',
                            label: 'Can Edit Reports',
                            description: 'Allows editing, auditing, and deleting submitted weekly shift progress logs.'
                          },
                          {
                            key: 'canDeletePersonnel',
                            label: 'Can Delete Personnel',
                            description: 'Permanent erasure of employee profiles from workspace directories.'
                          },
                          {
                            key: 'canOnboardUsers',
                            label: 'Can Onboard Users',
                            description: 'Clearance to register and set up active corporate logins.'
                          },
                          {
                            key: 'canEditConfig',
                            label: 'Can Edit Global Config',
                            description: 'Updates core administrative settings and roster rules.'
                          },
                          {
                            key: 'canOverrideStatus',
                            label: 'Can Override System Status',
                            description: 'Enables shifting state between Normal, Peak Ops, and Maintenance.'
                          }
                        ].map((perm) => {
                          const isFeatureSaved = getRolePermission(config.rolePermissions, selectedRoleForDetail, perm.key);
                          const isThisSaving = permissionSaving === `${selectedRoleForDetail}-${perm.key}`;

                          return (
                            <div 
                              key={perm.key} 
                              className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-start justify-between gap-4 transition-all hover:bg-slate-100/50"
                            >
                              <div className="space-y-1 text-left">
                                <span className="text-xs font-black text-slate-800 block leading-tight">{perm.label}</span>
                                <span className="text-[10px] text-slate-400 font-medium leading-relaxed block">{perm.description}</span>
                              </div>

                              <button
                                type="button"
                                disabled={isThisSaving}
                                onClick={() => handleTogglePermission(selectedRoleForDetail, perm.key)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  isFeatureSaved ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    isFeatureSaved ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Visual Sidebar Access Configurator */}
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Sidebar Navigation Assignments</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Toggle live navigation permissions for this role</p>
                      </div>

                      <div className="space-y-3">
                        {[
                          { id: 'dashboard', label: 'Dashboard', description: 'Access to the core dashboard metrics and analytics overview.' },
                          { id: 'employees', label: 'Employees', description: 'Directory list of active corporate personnel profiles.' },
                          { id: 'calendar', label: 'Schedule', description: 'Comprehensive calendar-based master roster schematics.' },
                          { id: 'matrix', label: 'Shifts', description: 'Access to the daily/weekly shifts timeline view.' },
                          { id: 'attendance', label: 'Attendance', description: 'Biometric/location based clock-in and attendance logs.' },
                          { id: 'timeoff', label: 'Time Off', description: 'Submission & review of paid leaves and duty off times.' },
                          { id: 'swaps', label: 'Shift Swaps', description: 'Request, answer and manage peer-to-peer shift exchanges.' },
                          { id: 'reports', label: 'Work Reports', description: 'Submitting and auditing weekly shift task logs.' },
                          { id: 'settings', label: 'Settings', description: 'Configure profile identity details and custom theme.' },
                          { id: 'reporting', label: 'Reporting', description: 'Strategic insights and work distribution analytics.' },
                          { id: 'adminhub', label: 'Admin Hub', description: 'Privileged configuration settings and directory directory tools.' },
                        ].map((tabItem) => {
                          const roleSidebarConfig = (config as any).roleSidebar || {};
                          const currentAllowed = roleSidebarConfig[selectedRoleForDetail] !== undefined
                            ? roleSidebarConfig[selectedRoleForDetail].includes(tabItem.id)
                            : // Default values mapping fallback
                              (selectedRoleForDetail === 'super_admin' || selectedRoleForDetail === 'admin' || selectedRoleForDetail === 'manager'
                                ? true
                                : selectedRoleForDetail === 'hr'
                                ? ['dashboard', 'employees', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings', 'adminhub'].includes(tabItem.id)
                                : ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings'].includes(tabItem.id));
                                
                          const isThisSaving = sidebarSaving === `${selectedRoleForDetail}-${tabItem.id}`;

                          return (
                            <div 
                              key={tabItem.id} 
                              className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-start justify-between gap-4 transition-all hover:bg-slate-100/50"
                            >
                              <div className="space-y-1 text-left">
                                <span className="text-xs font-black text-slate-800 block leading-tight">{tabItem.label}</span>
                                <span className="text-[10px] text-slate-400 font-medium leading-relaxed block">{tabItem.description}</span>
                              </div>

                              <button
                                type="button"
                                disabled={isThisSaving}
                                onClick={() => handleToggleRoleSidebar(selectedRoleForDetail, tabItem.id, currentAllowed)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  currentAllowed ? 'bg-indigo-600' : 'bg-slate-300'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    currentAllowed ? 'translate-x-5' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Associated Sectors / Departments (Searchable Multi-Select) */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Associated Departments</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Map active organizational departments to this role</p>
                      </div>

                      {/* Selected Tags Display */}
                      {(() => {
                        const assignedDepts = config.roleDepartments?.[selectedRoleForDetail] || [];
                        return (
                          <div className="space-y-4">
                            {assignedDepts.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-2xl">
                                {assignedDepts.map((d: string) => (
                                  <span 
                                    key={d} 
                                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-700 rounded-full text-[10px] font-bold transition-all shadow-sm"
                                  >
                                    <span>{d}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRoleDepartment(selectedRoleForDetail, d)}
                                      className="p-0.5 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer animate-none"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 border border-dashed border-slate-200 rounded-2xl text-center text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                No operational departments assigned
                              </div>
                            )}

                            {/* Search and Bulk Controls */}
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1 group">
                                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
                                  <input
                                    type="text"
                                    placeholder="Search departments..."
                                    value={deptSearchText}
                                    onChange={(e) => setDeptSearchText(e.target.value)}
                                    className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all text-slate-900"
                                  />
                                  {deptSearchText && (
                                    <button
                                      type="button"
                                      onClick={() => setDeptSearchText('')}
                                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>

                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleSetAllRoleDepartments(selectedRoleForDetail, config.departments || [], true)}
                                    className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border border-slate-200/50"
                                  >
                                    All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetAllRoleDepartments(selectedRoleForDetail, [], false)}
                                    className="px-2.5 py-2 bg-slate-100 hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border border-slate-200/50 hover:border-rose-100"
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>

                              {/* Search Checklist Results */}
                              {(() => {
                                const allDepts = config.departments || [];
                                const filteredDepts = allDepts.filter((d: string) => 
                                  d.toLowerCase().includes(deptSearchText.toLowerCase())
                                );

                                if (filteredDepts.length === 0) {
                                  return (
                                    <div className="py-6 border border-slate-100 rounded-2xl text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">
                                      No matching operational sectors
                                    </div>
                                  );
                                }

                                return (
                                  <div className="border border-slate-200/80 rounded-2xl max-h-[180px] overflow-y-auto divide-y divide-slate-100/60 bg-slate-50/20">
                                    {filteredDepts.map((d: string) => {
                                      const isChecked = assignedDepts.includes(d);
                                      return (
                                        <label 
                                          key={d} 
                                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-slate-100/50 cursor-pointer transition-colors"
                                        >
                                          <span className="text-[11px] font-bold text-slate-700 leading-tight select-none">
                                            {d}
                                          </span>
                                          <div className="flex items-center">
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleRoleDepartment(selectedRoleForDetail, d)}
                                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer accent-indigo-600"
                                            />
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Member Directory listing in this specific role */}
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role Members ({roleMembers.length}):</h4>
                      </div>

                      {roleMembers.length === 0 ? (
                        <div className="p-6 bg-slate-50 border border-slate-200/40 rounded-2xl text-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          No personnel assigned to this access level
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {roleMembers.map((m) => (
                            <div key={m.uid} className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-2xl border border-slate-200/50 flex items-center justify-between gap-3 text-xs">
                              <div>
                                <p className="font-bold text-slate-800 leading-none">{m.name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{m.department || 'No Dept'}</p>
                              </div>
                              <button
                                onClick={() => handleSelectEditUser(m)}
                                className="px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer"
                              >
                                Reassign
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center p-12 text-center h-full text-slate-400">
                  <SlidersHorizontal className="w-12 h-12 text-slate-300 stroke-[1.5] mb-3" />
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Archetype Details Dashboard</h4>
                  <p className="text-[11px] font-bold text-slate-400 max-w-xs mt-1.5">
                    Select any authorization tier from the matrix on the left to review its corresponding permissions index and registered members list.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* SUBTAB CONTENT 3: DEPARTMENTS / SECTORS SCHEMATICS */}
      {activeSubtab === 'departments' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          
          {/* Visual Sector listing cards */}
          <div className="xl:col-span-2 space-y-6 text-left">
            <div className="p-6 bg-white border border-slate-200 rounded-3xl">
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none font-sans">Active Sectors Index</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Review operational departments and user counts currently assigned below.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(config.departments || []).map((dept) => {
                const members = allUsers.filter(u => u.department?.toLowerCase() === dept.toLowerCase());
                
                return (
                  <div key={dept} className="p-6 bg-white border border-slate-200 hover:border-slate-300 rounded-[2rem] shadow-sm transition-all space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase leading-tight">{dept}</h4>
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{members.length} personnel active</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteDept(dept)}
                        title="Remove Empty Operational Sector"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Member directory preview within card */}
                    <div className="pt-3 border-t border-slate-100">
                      {members.length === 0 ? (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider italic">No Active Personnel Host</p>
                      ) : (
                        <div className="flex -space-x-2 overflow-hidden py-1">
                          {members.slice(0, 5).map((m) => (
                            <div 
                              key={m.uid} 
                              title={m.name} 
                              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-indigo-100 border-2 border-white flex items-center justify-center font-black text-[9px] text-slate-600 cursor-pointer"
                            >
                              {m.name?.slice(0, 2).toUpperCase()}
                            </div>
                          ))}
                          {members.length > 5 && (
                            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 border-2 border-white flex items-center justify-center font-black text-[9px]">
                              +{members.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add department controller */}
          <div className="space-y-6 text-left">
            <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase leading-none font-sans">Create Department</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Add new organizational departments</p>
                </div>
              </div>

              <form onSubmit={handleCreateDept} className="space-y-4">
                <div className="space-y-1.5 font-sans">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales & Business Growth"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deptSaving || !newDeptName}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-45 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm mt-2 cursor-pointer font-sans"
                >
                  {deptSaving ? 'Creating Department...' : 'Create Department'}
                </button>
              </form>
            </div>
          </div>

        </div>
      )}


      {/* MODAL WINDOW 1: ADD NEW USER REGISTRATION */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl p-8 max-h-[92vh] overflow-y-auto text-slate-800"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-5 mb-6">
                <div className="text-left">
                  <h3 className="text-xl font-black tracking-tight uppercase leading-none">Register New Staff Account</h3>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest font-mono mt-1.5">Direct synchronisation with auth provider services</p>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status boxes */}
              {userCreateSuccess && (
                <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-4 text-xs font-bold leading-relaxed">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <span>Account synchronized in active directory! Credentials have been safely initialized.</span>
                  </div>
                </div>
              )}

              {userCreateError && (
                <div className="mb-6 p-5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex flex-col gap-3 text-xs font-bold">
                  <div className="flex items-center gap-4">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                    <span>{userCreateError}</span>
                  </div>
                  
                  {showForceSyncOption && (
                    <div className="mt-2 p-4 bg-white/95 border border-amber-200 rounded-xl space-y-3 text-[11px] font-medium text-slate-700 shadow-sm leading-relaxed text-left">
                      <p className="font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 font-sans mb-1 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        Conflict Resolved: Bypass Available
                      </p>
                      <p>
                        This email address is already registered inside Firebase Authentication. You can immediately synchronize their database profile document anyway, or trigger a standard password reset link securely:
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-2 pt-1 font-sans">
                        <button
                          type="button"
                          onClick={handleForceSyncUser}
                          className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer shadow transition-all text-center"
                        >
                          Database Sync: Force Create/Update Profile
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleTriggerResetForFormEmail}
                          className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer shadow transition-all text-center"
                        >
                          Transmit Password Reset Email
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Form details */}
              <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
                <div className="space-y-1.5 text-left">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Name</label>
                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 font-mono bg-slate-100 px-1 py-0.5 rounded">Optional</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Auto-derived from email if empty"
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Temporary Password</label>
                  <div className="relative">
                    <input
                      type={showUserFormPassword ? "text" : "password"}
                      required
                      placeholder="Minimum 6 characters"
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      className="w-full pl-5 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowUserFormPassword(!showUserFormPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-xl focus:outline-none cursor-pointer"
                    >
                      {showUserFormPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <PasswordStrengthValidator 
                    password={userFormPassword} 
                    onValidityChange={setIsUserFormPasswordValid} 
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Authorization Clearance Role</label>
                  <CustomSelect
                    value={userFormRole}
                    onChange={(val) => setUserFormRole(val)}
                    options={[
                      { value: 'normal', label: 'Normal Employee' },
                      { value: 'hr', label: 'Human Resources (HR)' },
                      { value: 'manager', label: 'General Manager' },
                      { value: 'admin', label: 'Administrator' },
                      { value: 'super_admin', label: 'Super Admin' }
                    ]}
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sector (Department)</label>
                  <CustomSelect
                    value={userFormDept}
                    onChange={(val) => setUserFormDept(val)}
                    options={[
                      { value: "", label: "General / Choose..." },
                      ...(config.departments || []).map((dept: any) => ({ value: dept, label: dept }))
                    ]}
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Professional Designation</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead Network Engineer"
                    value={userFormDesignation}
                    onChange={(e) => setUserFormDesignation(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Skill Tags (Comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Network L2, Database Admin, Security"
                    value={userFormSkillTags}
                    onChange={(e) => setUserFormSkillTags(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Direct Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 0199"
                    value={userFormPhone}
                    onChange={(e) => setUserFormPhone(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Custom Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. SS-NOC-009"
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
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900 resize-none font-sans"
                  />
                </div>

                <div className="col-span-full pt-4 flex gap-4 font-sans">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-3 px-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={userCreateLoading || !isUserFormPasswordValid}
                    className="flex-2 py-3 px-6 bg-indigo-600 disabled:opacity-45 disabled:hover:bg-indigo-600 disabled:cursor-not-allowed hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] cursor-pointer"
                  >
                    {userCreateLoading ? 'Creating...' : 'Create Account'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL WINDOW 2: EDIT SYSTEM USER ACCOUNT */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto text-slate-800"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-5 mb-6">
                <div className="text-left">
                  <h3 className="text-xl font-black tracking-tight uppercase leading-none">Modify Personnel Clearance & Info</h3>
                  <p className="text-indigo-600 text-[10px] font-mono uppercase tracking-widest mt-1.5">Direct synchronisation: {editingUser.email}</p>
                </div>
                <button 
                  onClick={() => setEditingUser(null)} 
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status checks */}
              {editSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-3 text-xs font-bold leading-normal">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                  <span>Personnel logs successfully updated and synchronized across servers!</span>
                </div>
              )}

              {editError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-4 text-xs font-bold">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Form editing */}
              <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left pb-2">
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Connection</label>
                  <input
                    type="email"
                    required
                    value={editFormEmail}
                    onChange={(e) => setEditFormEmail(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Authorization Clearance Role</label>
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
                        const myLevel = ROLE_LEVEL[loggedInUserRole] || 1;
                        return ROLE_LEVEL[roleName] <= myLevel;
                      })
                      .map(role => ({
                        value: role,
                        label: role === 'normal' ? 'Normal Employee' : role.toUpperCase().replace('_', ' ')
                      }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sector (Department)</label>
                  <CustomSelect
                    value={editFormDept}
                    onChange={(val) => setEditFormDept(val)}
                    options={[
                      { value: "", label: "General / Choose..." },
                      ...(config.departments || []).map((dept: any) => ({ value: dept, label: dept }))
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Professional Designation</label>
                  <input
                    type="text"
                    value={editFormDesignation}
                    onChange={(e) => setEditFormDesignation(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Skill Tags (Comma-separated)</label>
                  <input
                    type="text"
                    value={editFormSkillTags}
                    onChange={(e) => setEditFormSkillTags(e.target.value)}
                    placeholder="e.g. Network L2, Database Admin, Security"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Direct Contact Phone</label>
                  <input
                    type="tel"
                    value={editFormPhone}
                    onChange={(e) => setEditFormPhone(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Staff ID Override</label>
                  <input
                    type="text"
                    value={editFormEmployeeId}
                    onChange={(e) => setEditFormEmployeeId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Operational Status</label>
                  <CustomSelect
                    value={editFormStatus}
                    onChange={(val) => setEditFormStatus(val)}
                    options={[
                      { value: 'Active', label: 'Active Duty' },
                      { value: 'On Leave', label: 'On Leave' },
                      { value: 'Suspended', label: 'Suspended' },
                      { value: 'Terminated', label: 'Terminated' }
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

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Physical Residential Address</label>
                  <textarea
                    rows={2}
                    value={editFormAddress}
                    onChange={(e) => setEditFormAddress(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-600 transition-all font-sans text-slate-900 resize-none font-sans"
                  />
                </div>

                {/* Account Security Passwords / Dynamic Synchronisation */}
                <div className="col-span-full border-t border-slate-100 pt-6 mt-4">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Account Security Access</h4>
                  
                  <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-6">
                    {/* OPTION A: RESET SYSTEM EMAIL */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-50/80 border border-indigo-250 text-[10px] font-black text-indigo-600 font-mono">A</span>
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Trigger Password Reset Email (Primary Option)</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed pl-7">
                        Transmit a secure password reset email correspondence directly to <strong>{editingUser.email}</strong>. 
                        This operation is immediate and <strong>does not require entering their current password</strong>.
                      </p>
                      <div className="pl-7">
                        <button
                          type="button"
                          onClick={() => handleTriggerResetPassword(editingUser.email)}
                          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-lg hover:shadow-indigo-500/25"
                        >
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          Send Password Reset Email
                        </button>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200" />

                    {/* OPTION B: OVERRIDE DIRECTLY */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 border border-slate-300 text-[10px] font-black text-slate-600 font-mono">B</span>
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Administrative Password Override</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed pl-7">
                        Directly overwrite their login credentials. This is compatible only if the user profile has a synchronized password pre-registered locally.
                      </p>
                      
                      <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {oldPasswordRequired && (
                          <div className="space-y-1.5 col-span-full text-left">
                            <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1">
                              Current Password Required
                            </label>
                            <div className="relative">
                              <input
                                type={showManualOldPassword ? "text" : "password"}
                                placeholder="Enter their current password to authorize session"
                                value={manualOldPassword}
                                onChange={(e) => setManualOldPassword(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-white border border-rose-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-rose-500/10 text-slate-900"
                              />
                              <button
                                type="button"
                                onClick={() => setShowManualOldPassword(!showManualOldPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg focus:outline-none cursor-pointer"
                              >
                                {showManualOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">
                            New Security Password
                          </label>
                          <div className="relative">
                            <input
                              type={showNewPasswordInput ? "text" : "password"}
                              placeholder="Minimum 6 characters"
                              value={newPasswordInput}
                              onChange={(e) => setNewPasswordInput(e.target.value)}
                              className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPasswordInput(!showNewPasswordInput)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg focus:outline-none cursor-pointer"
                            >
                              {showNewPasswordInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <PasswordStrengthValidator 
                            password={newPasswordInput} 
                            onValidityChange={setIsNewPasswordInputValid} 
                          />
                        </div>
                        
                        <div className="flex items-end">
                          <button
                            type="button"
                            disabled={isChangingPassword || !isNewPasswordInputValid}
                            onClick={handleAdminChangePassword}
                            className="w-full h-[42px] px-6 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            {isChangingPassword ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin animate-infinite" />
                                Syncing Access...
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                Override Auth Password
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-slate-200" />

                    {/* OPTION C: ACCOUNT RECOVERY LINK TRIGGER */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 border border-slate-300 text-[10px] font-black text-slate-600 font-mono">C</span>
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">Generate & Export Access Recovery Package</h5>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed pl-7">
                        If the employee has lost access to their corporately registered communication channels, generating an <strong>offline access packet</strong> allows setting a secure temporary bypass credential and exporting a physical instruction memo (`.txt` file).
                      </p>
                      
                      <div className="pl-7 space-y-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={isGeneratingRecovery}
                            onClick={() => handleGenerateRecoveryPack(editingUser)}
                            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 disabled:opacity-50 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-lg text-left"
                          >
                            <KeyRound className="w-3.5 h-3.5 shrink-0" />
                            {isGeneratingRecovery ? "Generating Pack..." : "Generate Recovery Packet"}
                          </button>
                          
                          {generatedRecoveryPack && (
                            <button
                              type="button"
                              onClick={handleDownloadRecoveryPack}
                              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md hover:shadow-lg text-left"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" />
                              Export Recovery Memo (.txt)
                            </button>
                          )}
                        </div>

                        {generatedRecoveryPack && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 bg-white border border-slate-200 rounded-2xl relative space-y-3 text-left shadow-inner overflow-hidden col-span-full"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Compiled Recovery Transcript Details
                              </span>
                              <button
                                type="button"
                                onClick={handleCopyToClipboard}
                                className="text-[9px] font-black uppercase text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer focus:outline-none"
                              >
                                <Copy className="w-3 h-3" />
                                Copy Code
                              </button>
                            </div>
                            
                            <div className="p-3.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-[10px] text-slate-700 space-y-1.5 leading-relaxed overflow-x-auto border-l-4 border-l-indigo-500">
                              <p><strong>Employee:</strong> {generatedRecoveryPack.name} ({generatedRecoveryPack.email})</p>
                              <p><strong>Temporary Pass:</strong> <span className="bg-amber-50 px-1.5 py-0.5 rounded text-amber-800 font-bold border border-amber-200 select-all">{generatedRecoveryPack.tempPassword}</span></p>
                              <p className="truncate"><strong>Direct Setup Link:</strong> <span className="text-indigo-600 select-all select-text">{generatedRecoveryPack.recoveryUrl}</span></p>
                              <p className="text-[9px] text-slate-400 mt-2 font-sans italic">* Temp password configured successfully. Share Link or credential securely with the user.</p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-full pt-6 flex flex-col sm:flex-row gap-4 justify-between border-t border-slate-100 mt-4 font-sans">
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(editingUser.uid, editingUser.email, editingUser.password)}
                    className="w-full sm:w-auto px-5 py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 hover:border-rose-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                  >
                    <Trash2 className="w-4 h-4 shrink-0" />
                    Delete Account
                  </button>

                  <div className="flex gap-4 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="flex-1 sm:flex-none px-5 py-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editSaving}
                      className="flex-1 sm:flex-none px-6 py-3 bg-indigo-600 disabled:opacity-45 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider text-center cursor-pointer shadow-md hover:shadow-indigo-500/20 active:scale-[0.98]"
                    >
                      {editSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* APP-LEVEL CUSTOM NON-BLOCKING DIALOG MODAL */}
      <AnimatePresence>
        {appAlert && appAlert.show && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAppAlert(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 text-left text-slate-800 z-10"
            >
              <div className="flex items-start gap-4">
                {appAlert.type === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />}
                {appAlert.type === 'error' && <AlertCircle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />}
                {appAlert.type === 'warn' && <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />}
                {(!appAlert.type || appAlert.type === 'info') && <Info className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" />}
                <div>
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 leading-none">{appAlert.title}</h4>
                  <p className="text-xs text-slate-600 mt-2 font-medium leading-relaxed">{appAlert.message}</p>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 font-sans pt-1">
                {appAlert.isConfirm ? (
                  <>
                    <button
                      onClick={() => setAppAlert(null)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (appAlert.onConfirm) appAlert.onConfirm();
                        setAppAlert(null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md shadow-rose-200"
                    >
                      Confirm Action
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setAppAlert(null)}
                    className="px-5 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
