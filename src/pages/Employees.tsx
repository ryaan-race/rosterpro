import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  MapPin, 
  MoreHorizontal,
  Mail,
  Phone,
  Repeat,
  ExternalLink,
  Edit3,
  ShieldCheck
} from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType, cn, getFriendlyAuthErrorMessage } from '../lib/utils';
import { collection, onSnapshot, query, setDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { Trash2, User as UserIcon, Camera, Image, Eye, EyeOff } from 'lucide-react';
import { Avatar } from '../lib/Avatar';
import ImageUpload from '../components/ImageUpload';
import { CustomSelect } from '../components/CustomSelect';
import { getApps, initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const getSecondaryAuth = () => {
  const apps = getApps();
  const secondaryApp = apps.find(app => app.name === 'SecondaryRegistrationApp') || initializeApp(firebaseConfig, 'SecondaryRegistrationApp');
  return getAuth(secondaryApp);
};

const PRESET_EMPLOYEES = [
  { name: 'Krushna B', designation: 'Service Delivery Manager', phone: '9823621143' },
  { name: 'Vishnu B', designation: 'Infrastructure Manager', phone: '8088262831' },
  { name: 'Kaajal S', designation: 'Business Analyst', phone: '7559231252' },
  { name: 'RajeshV', designation: 'System / Storage Manager', phone: '9794544664' },
  { name: 'Nikhil M', designation: 'Network Administrator (L2)', phone: '7588645359' },
  { name: 'Satish B', designation: 'Senior Helpdesk Manager', phone: '8505945668' },
  { name: 'Anup J', designation: 'Helpdesk Manager', phone: '8956357564' },
  { name: 'Yogesh H', designation: 'System Administrator (L1)', phone: '7020055229' },
  { name: 'Mandar D', designation: 'System Administrator (L1)', phone: '8600796867' },
  { name: 'Sumeet N', designation: 'Network Administrator (L1)', phone: '8149936104' },
  { name: 'Shubham S', designation: 'Database Administrator (L1)', phone: '7350395024' },
  { name: 'Shraddha', designation: 'Helpdesk Support', phone: '7972605446' },
  { name: 'Sundhya', designation: 'Helpdesk Support', phone: '8483056377' },
  { name: 'Bhakti', designation: 'Application Support', phone: '8180018824' },
  { name: 'Nandini', designation: 'Application Support', phone: '9579943055' },
  { name: 'Apoorva', designation: 'Application Support', phone: '8999199307' },
  { name: 'Yogita', designation: 'Linux Administrator / NOC Team', phone: '9579497783' },
  { name: 'Rushikesh', designation: 'Linux Administrator / NOC Team', phone: '8626002551' },
  { name: 'Kapil', designation: 'Linux Administrator / NOC Team', phone: '8605530562' },
  { name: 'Samadhan', designation: 'Linux Administrator / NOC Team', phone: '8010231867' },
  { name: 'Pratik', designation: 'Linux Administrator / NOC Team', phone: '9373524166' },
  { name: 'Omkar', designation: 'Linux Administrator / NOC Team', phone: '8208492694' }
];

const DESIGNATIONS = [
  'Service Delivery Manager',
  'Infrastructure Manager',
  'Business Analyst',
  'System / Storage Manager',
  'Network Administrator (L2)',
  'Senior Helpdesk Manager',
  'Helpdesk Manager',
  'System Administrator (L1)',
  'Network Administrator (L1)',
  'Database Administrator (L1)',
  'Helpdesk Support',
  'Application Support',
  'Linux Administrator / NOC Team'
];

const DESIGNATION_DEPTS: Record<string, string> = {
  'Service Delivery Manager': 'Service Delivery / IT Operations',
  'Infrastructure Manager': 'IT Infrastructure',
  'Business Analyst': 'Business Analysis / PMO',
  'System / Storage Manager': 'System & Storage Management',
  'Network Administrator (L2)': 'Network & Security',
  'Senior Helpdesk Manager': 'IT Support Services',
  'Helpdesk Manager': 'IT Support Services',
  'System Administrator (L1)': 'System Administration',
  'Network Administrator (L1)': 'Network Operations',
  'Database Administrator (L1)': 'Database Administration',
  'Helpdesk Support': 'IT Helpdesk Support',
  'Application Support': 'Application Support Services',
  'Linux Administrator / NOC Team': 'Linux & Network Operations Center (NOC)'
};

const getDesignationStyle = (designation: string) => {
  const lower = (designation || '').toLowerCase();
  if (lower.includes('manager')) {
    return 'text-indigo-600 bg-indigo-50/70 border-indigo-200/50';
  }
  if (lower.includes('administrator') || lower.includes('admin') || lower.includes('analyst')) {
    return 'text-sky-600 bg-sky-50/70 border-sky-200/50';
  }
  if (lower.includes('support')) {
    return 'text-rose-600 bg-rose-50/70 border-rose-200/50';
  }
  return 'text-slate-600 bg-slate-50 border-slate-200';
};

export default function Employees() {
  const { user: currentUser } = useAuth();
  const { config } = useConfig();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const [viewingEmployee, setViewingEmployee] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const globalDepartments = Array.from(new Set(['All Departments', ...(config.departments || [])]));
  const companyName = config.companyName;

  const userRoleLower = currentUser?.appData?.role?.toLowerCase() || '';
  const isManager = ['manager', 'admin', 'super_admin'].includes(userRoleLower);
  const isHrOrAdmin = ['hr', 'admin', 'super_admin'].includes(userRoleLower);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEmployees(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'attendance'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAttendance(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });
    return () => unsubscribe();
  }, [currentUser]);

  const calculatedHoursAndStats = React.useMemo(() => {
    const recordsByUserByDay: Record<string, Record<string, any[]>> = {};
    attendance.forEach(record => {
      if (!record.timestamp || !record.employeeId) return;
      const d = new Date(record.timestamp);
      if (isNaN(d.getTime())) return;
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dayKey = `${year}-${month}-${day}`;
      
      const empId = record.employeeId;
      if (!recordsByUserByDay[empId]) recordsByUserByDay[empId] = {};
      if (!recordsByUserByDay[empId][dayKey]) recordsByUserByDay[empId][dayKey] = [];
      recordsByUserByDay[empId][dayKey].push(record);
    });

    const calculatedHoursByEmp: Record<string, number> = {};
    let totalSum = 0;

    Object.entries(recordsByUserByDay).forEach(([empId, days]) => {
      let empTotal = 0;
      Object.entries(days).forEach(([dayKey, dayRecords]) => {
        const sorted = [...dayRecords]
          .filter(r => r.timestamp && !isNaN(new Date(r.timestamp).getTime()))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].type === 'check-in' && sorted[i+1].type === 'check-out') {
            const start = new Date(sorted[i].timestamp);
            const end = new Date(sorted[i+1].timestamp);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
              if (diffHours > 0) {
                empTotal += diffHours;
              }
            }
          }
        }
      });
      calculatedHoursByEmp[empId] = Number(empTotal.toFixed(1));
      totalSum += empTotal;
    });

    return {
      hoursByEmp: calculatedHoursByEmp,
      totalSum: Number(totalSum.toFixed(1))
    };
  }, [attendance]);

  const [newEmployeeAvatar, setNewEmployeeAvatar] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [selectedDesignation, setSelectedDesignation] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formRole, setFormRole] = useState('normal');
  const [formStatus, setFormStatus] = useState('Active');
  const [showPassword, setShowPassword] = useState(false);

  const handleEditClick = (emp: any) => {
    setEditingEmployee(emp);
    setEmployeeName(emp.name || '');
    setNewEmployeeAvatar(emp.avatar || emp.avatarUrl || '');
    setFormStatus(emp.status || 'Active');
    const isPreset = DESIGNATIONS.includes(emp.designation);
    if (emp.designation && !isPreset) {
      setSelectedDesignation('custom');
      setCustomDesignation(emp.designation);
    } else {
      setSelectedDesignation(emp.designation || DESIGNATIONS[0]);
      setCustomDesignation('');
    }
    setFormDept(emp.department || emp.dept || config.departments[0]);
    setFormRole((emp.role || 'normal').toLowerCase());
    setIsAddModalOpen(true);
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 4000);
      return;
    }

    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'users', id));
    } catch (error: any) {
      alert('Delete failed: ' + (error.message || 'Check your permissions'));
      console.error(error);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const name = formData.get('name') as string;
    const gender = formData.get('gender') as string;
    
    // Use existing UID if editing, otherwise create auth user first
    let uid = editingEmployee?.uid;
    const password = formData.get('password') as string;

    if (!uid) {
      if (!password) {
        alert('Password is required to create a new user.');
        return;
      }
      setIsSyncing(true);
      try {
        const secAuth = getSecondaryAuth();
        const userCred = await createUserWithEmailAndPassword(secAuth, email, password);
         uid = userCred.user.uid;
        await secAuth.signOut();
      } catch (authError: any) {
        setIsSyncing(false);
        alert('Authentication Account Creation Failed: ' + getFriendlyAuthErrorMessage(authError));
        console.error(authError);
        return;
      }
    }

    const designationSelectValue = formData.get('designationSelect') as string;
    const finalDesignation = designationSelectValue === 'custom'
      ? (formData.get('designationCustom') as string || '')
      : (designationSelectValue || '');
    
    const empData: any = {
      uid: uid,
      employeeId: formData.get('employeeId') as string,
      name: name,
      email: email,
      role: formRole,
      department: formData.get('department') as string,
      designation: finalDesignation,
      avatar: newEmployeeAvatar,
      status: formData.get('status') as string || (editingEmployee?.status || 'Active'),
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      joiningDate: formData.get('joiningDate') as string || (editingEmployee?.joiningDate || new Date().toISOString().split('T')[0]),
      updatedAt: new Date().toISOString(),
      createdAt: editingEmployee?.createdAt || new Date().toISOString()
    };

    if (password) {
      empData.password = password;
    } else if (editingEmployee?.password) {
      empData.password = editingEmployee.password;
    }

    try {
      await setDoc(doc(db, 'users', uid), empData);
      setIsAddModalOpen(false);
      setEditingEmployee(null);
      setNewEmployeeAvatar('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'All Departments' || (emp.department || emp.dept) === departmentFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none">{companyName} Workforce</h2>
          <p className="text-slate-500 mt-2 font-medium">Manage human capital, tactical roles, and operational assignments for {companyName}.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => {
              setEditingEmployee(null);
              setEmployeeName('');
              setNewEmployeeAvatar('');
              setFormStatus('Active');
              const firstDesig = DESIGNATIONS[0];
              setSelectedDesignation(firstDesig);
              setCustomDesignation('');
              setFormDept(DESIGNATION_DEPTS[firstDesig] || config.departments[0]);
              const isMgr = firstDesig.toLowerCase().includes('manager') || firstDesig.toLowerCase().includes('coordinator');
              setFormRole(isMgr ? 'manager' : 'normal');
              setIsAddModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {isHrOrAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Workforce Size</span>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{employees.length}</p>
            </div>
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-xl flex items-center justify-between text-white md:bg-gradient-to-br md:from-slate-900 md:to-indigo-950">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Sum of All Working Hours</span>
              <p className="text-3xl font-black text-white tracking-tight">{calculatedHoursAndStats.totalSum} hrs</p>
            </div>
            <div className="p-4 bg-white/10 border border-white/10 rounded-2xl text-indigo-400">
              <Repeat className="w-5 h-5 text-indigo-300" />
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 border border-slate-200/60 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Restricted Privacy Control</span>
              <p className="text-sm font-bold text-slate-900 mt-1">HR & Admin Access Only</p>
            </div>
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row gap-4 md:gap-6 bg-slate-50/30">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search staff..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-white border border-slate-200 rounded-xl text-xs md:text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center w-full sm:w-64 z-30">
            <CustomSelect 
              value={departmentFilter}
              onChange={(val) => setDepartmentFilter(val)}
              options={globalDepartments}
              placeholder="All Departments"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">ID</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Employee</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Designation</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Department</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Status</th>
                {isHrOrAdmin && (
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">Total Hours</th>
                )}
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <span className="inline-flex items-center text-[10px] font-mono font-black tracking-wider text-slate-700 px-2.5 py-1.5 bg-slate-100 border border-slate-200/60 rounded-xl shadow-sm transition-all duration-300 group-hover:bg-indigo-50 group-hover:border-indigo-100 group-hover:text-indigo-600">
                      {emp.employeeId || '---'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center space-x-4">
                      <Avatar 
                        src={emp.avatar || emp.avatarUrl} 
                        name={emp.name}
                        fallback="initials"
                        size="lg"
                        className="bg-indigo-50 border-2 border-white shadow-sm group-hover:scale-110 transition-all duration-500"
                      />
                      <div>
                        <p className="font-black text-slate-900 text-sm leading-tight">{emp.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "inline-flex items-center text-[10px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-tight shadow-sm/5 transition-all duration-300",
                      getDesignationStyle(emp.designation)
                    )}>
                      {emp.designation || 'Staff Personnel'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-black text-slate-500 uppercase tracking-widest">
                    {emp.department || emp.dept}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center">
                      <div className={cn(
                        "w-2 h-2 rounded-full mr-2",
                        emp.status === 'Active' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                        emp.status === 'On Shift' ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse" :
                        emp.status === 'On Leave' ? "bg-amber-400" : 
                        emp.status === 'Deactivated' ? "bg-slate-400" :
                        emp.status === 'Terminated' ? "bg-rose-500" :
                        "bg-slate-300"
                      )} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">{emp.status}</span>
                    </div>
                  </td>
                  {isHrOrAdmin && (
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center text-xs font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        {calculatedHoursAndStats.hoursByEmp[emp.uid || emp.id] || 0} hrs
                      </span>
                    </td>
                  )}
                  <td className="px-8 py-5 text-right flex items-center justify-end gap-2">
                    <button 
                      onClick={() => {
                        setViewingEmployee(emp);
                        setIsViewModalOpen(true);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEditClick(emp)}
                      className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-slate-100 hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    {emp.status !== 'Deactivated' && (
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'users', emp.uid), { status: 'Deactivated', updatedAt: new Date().toISOString() });
                          } catch (err) {
                            alert("Failed to deactivate.");
                          }
                        }}
                        className="inline-flex items-center space-x-2 px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-rose-100 hover:bg-rose-600 hover:text-white transition-all active:scale-95"
                        title="Deactivate Employee"
                      >
                         <ShieldCheck className="w-3 h-3" />
                         <span>Deactivate</span>
                      </button>
                    )}
                    <button 
                      onClick={() => handleDeleteEmployee(emp.id || emp.uid, emp.name)}
                      className={cn(
                        "inline-flex items-center space-x-2 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all active:scale-95",
                        confirmDeleteId === (emp.id || emp.uid)
                          ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                          : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100"
                      )}
                      title={confirmDeleteId === (emp.id || emp.uid) ? "Click again to confirm delete" : "Delete Employee"}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{confirmDeleteId === (emp.id || emp.uid) ? 'Confirm' : 'Delete'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredEmployees.map((emp) => (
            <div key={emp.id} className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar 
                    src={emp.avatar || emp.avatarUrl}
                    name={emp.name}
                    fallback="initials"
                    size="lg"
                    className="bg-indigo-50 border-2 border-white shadow-sm"
                  />
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-tight">{emp.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 items-center">
                      <span className={cn(
                        "inline-flex items-center text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-tight shadow-sm/5",
                        getDesignationStyle(emp.designation)
                      )}>
                        {emp.designation || 'Staff Personnel'}
                      </span>
                      {isHrOrAdmin && (
                        <span className="inline-flex items-center text-[9px] font-black font-mono px-2 py-0.5 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 uppercase tracking-tight">
                          {calculatedHoursAndStats.hoursByEmp[emp.uid || emp.id] || 0}h worked
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">{emp.email}</p>
                  </div>
                </div>
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  emp.status === 'Active' ? "bg-emerald-500" :
                  emp.status === 'On Shift' ? "bg-indigo-500 animate-pulse" :
                  emp.status === 'On Leave' ? "bg-amber-400" : 
                  emp.status === 'Deactivated' ? "bg-slate-400" :
                  emp.status === 'Terminated' ? "bg-rose-500" :
                  "bg-slate-300"
                )} />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Department</p>
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight truncate">{emp.department || emp.dept}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button 
                  onClick={() => {
                    setViewingEmployee(emp);
                    setIsViewModalOpen(true);
                  }}
                  className="py-2.5 bg-slate-50 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-3 h-3" />
                  Details
                </button>
                  <button 
                    onClick={() => handleEditClick(emp)}
                    className="py-2.5 bg-slate-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-200 flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit
                  </button>
                  {emp.status !== 'Deactivated' && (
                    <button 
                      onClick={async () => {
                        try {
                          await updateDoc(doc(db, 'users', emp.uid), { status: 'Deactivated', updatedAt: new Date().toISOString() });
                        } catch (err) {
                          alert("Failed to deactivate.");
                        }
                      }}
                      className="py-2.5 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-rose-200 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      Deactivate
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteEmployee(emp.id || emp.uid, emp.name)}
                    className={cn(
                      "py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center justify-center gap-2 transition-all",
                      confirmDeleteId === (emp.id || emp.uid)
                        ? "bg-rose-600 text-white border-rose-600 animate-pulse"
                        : "bg-slate-50 text-slate-400 border-slate-200"
                    )}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmDeleteId === (emp.id || emp.uid) ? 'Confirm' : 'Delete'}
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {isViewModalOpen && viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsViewModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="bg-slate-950 p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
              
              <div className="flex flex-col items-center relative z-10">
                <Avatar 
                  src={viewingEmployee.avatar || viewingEmployee.avatarUrl}
                  name={viewingEmployee.name}
                  fallback="initials"
                  className="w-28 h-28 rounded-3xl bg-white p-1 shadow-2xl mb-4"
                />
                <h3 className="text-2xl font-black tracking-tight">{viewingEmployee.name}</h3>
                <p className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">{viewingEmployee.designation || 'Staff Personnel'} • {viewingEmployee.department || viewingEmployee.dept}</p>
                
                <div className="flex gap-2 mt-6">
                   <div className={cn(
                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-2",
                    viewingEmployee.status === 'Active' ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"
                   )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", viewingEmployee.status === 'Active' ? "bg-emerald-400" : "bg-slate-400")} />
                    {viewingEmployee.status}
                   </div>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-8 bg-white">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Employee ID</p>
                    <p className="text-sm font-bold text-slate-900">{viewingEmployee.employeeId || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Designation</p>
                    <span className={cn(
                      "inline-flex items-center text-[11px] font-black px-3 py-1 rounded-xl border uppercase tracking-tight shadow-sm/5",
                      getDesignationStyle(viewingEmployee.designation)
                    )}>
                      {viewingEmployee.designation || 'Staff Personnel'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email</p>
                    <p className="text-sm font-bold text-slate-900">{viewingEmployee.email}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mobile Number</p>
                    <p className="text-sm font-bold text-slate-900">{viewingEmployee.phone || 'N/A'}</p>
                  </div>
                  {isHrOrAdmin && (
                    <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                      <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">Total Worked</p>
                      <p className="text-sm font-black text-indigo-950 font-mono">
                        {calculatedHoursAndStats.hoursByEmp[viewingEmployee.uid || viewingEmployee.id] || 0} hrs
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Joining Date</p>
                    <p className="text-sm font-bold text-slate-900">{viewingEmployee.joiningDate || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</p>
                    <p className="text-sm font-bold text-slate-900 leading-relaxed">{viewingEmployee.address || 'No address provided'}</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => setIsViewModalOpen(false)}
                  className="w-full py-4 bg-slate-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                >
                  Close Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => {
            setIsAddModalOpen(false);
            setEditingEmployee(null);
            setShowPassword(false);
          }} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-xl text-slate-900 mb-6">{editingEmployee ? 'Edit Team Member' : 'Add New Team Member'}</h3>
            
            <ImageUpload 
              initialValue={newEmployeeAvatar}
              onUploadSuccess={(url) => setNewEmployeeAvatar(url)}
              className="mb-8"
              label="Staff Identification Photo"
            />

            <form onSubmit={handleAddEmployee} className="space-y-6">
              {/* Row 1 / Child 1: Full Name & Employee ID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Full Name</label>
                  <input 
                    name="name" 
                    type="text" 
                    required 
                    placeholder="e.g. John Doe"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Employee ID</label>
                  <input 
                    name="employeeId" 
                    type="text" 
                    required
                    placeholder="EMP-001" 
                    defaultValue={editingEmployee?.employeeId} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                  />
                </div>
              </div>

              {/* Row 2 / Child 2: Email & Mobile Number */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                  <input 
                    name="email" 
                    type="email" 
                    required 
                    placeholder="john@example.com" 
                    defaultValue={editingEmployee?.email} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Mobile Number</label>
                  <input 
                    name="phone" 
                    type="tel" 
                    required 
                    placeholder="+91 98XXX XXXXX" 
                    defaultValue={editingEmployee?.phone} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                  />
                </div>
              </div>

              {!editingEmployee && (
                <div className="space-y-1 bg-slate-50/50 p-4 border border-dashed border-slate-200 rounded-2xl">
                  <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-1">Initial Access Password</label>
                  <div className="relative group/input">
                    <input 
                      name="password" 
                      type={showPassword ? "text" : "password"} 
                      required={!editingEmployee} 
                      placeholder="Create secure access key (min 6 chars)" 
                      minLength={6}
                      className="w-full pl-5 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm font-sans" 
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer"
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold px-1 mt-1">This user will use their email and this password to log in.</p>
                </div>
              )}

              {/* Row 3 / Child 3: Joining Date & Employment Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Joining Date</label>
                  <input 
                    name="joiningDate" 
                    type="date" 
                    defaultValue={editingEmployee?.joiningDate || new Date().toISOString().split('T')[0]} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Employment Status</label>
                  <CustomSelect 
                    value={formStatus}
                    onChange={(val) => setFormStatus(val)}
                    options={['Active', 'On Leave', 'Deactivated', 'Terminated', 'On Shift', 'Off']}
                  />
                  <input type="hidden" name="status" value={formStatus} />
                </div>
              </div>

               {/* Row 4 / Child 4: Address (Full Width) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Address</label>
                <input 
                  name="address" 
                  type="text"
                  placeholder="Residency street address" 
                  defaultValue={editingEmployee?.address || ''} 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                />
              </div>

               {/* Row 5 / Child 5: Designation & Department selects */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Designation select container */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Designation Category</label>
                  <CustomSelect 
                    value={selectedDesignation}
                    onChange={(val) => {
                       setSelectedDesignation(val);
                       if (val !== 'custom') {
                         const directDept = DESIGNATION_DEPTS[val];
                         if (directDept) {
                           setFormDept(directDept);
                         }
                         const isMgr = val.toLowerCase().includes('manager') || val.toLowerCase().includes('coordinator');
                         setFormRole(isMgr ? 'manager' : 'normal');
                       }
                    }}
                    options={[
                      ...DESIGNATIONS.map(title => ({ value: title, label: title })),
                      { value: 'custom', label: 'Other / Custom Designation...' }
                    ]}
                  />
                  <input type="hidden" name="designationSelect" value={selectedDesignation} />

                   {selectedDesignation === 'custom' && (
                    <div className="space-y-1 pt-1.5">
                      <label className="text-[9px] font-black text-indigo-500 uppercase tracking-widest px-1">Type Custom Designation</label>
                      <input 
                        name="designationCustom" 
                        type="text" 
                        required
                        placeholder="e.g. Solution Architect" 
                        value={customDesignation} 
                         onChange={(e) => {
                           const val = e.target.value;
                           setCustomDesignation(val);
                           const isMgr = val.toLowerCase().includes('manager') || val.toLowerCase().includes('coordinator');
                           setFormRole(isMgr ? 'manager' : 'normal');
                         }}
                        className="w-full px-5 py-4 bg-white border border-indigo-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" 
                      />
                    </div>
                  )}
                </div>

                 {/* Department select container */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                  <CustomSelect 
                    value={formDept}
                    onChange={(val) => setFormDept(val)}
                    options={globalDepartments.filter(d => d !== 'All Departments')}
                  />
                  <input type="hidden" name="department" value={formDept} />
                </div>
              </div>

               {/* System Access Role selector */}
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">System Access Role</label>
                <CustomSelect 
                  value={formRole}
                  onChange={(val) => setFormRole(val)}
                  options={[
                    { value: 'normal', label: 'Normal User (Only Shift Read, Punch In/Out, Request Leave)' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'super_admin', label: 'Super Admin' }
                  ]}
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEmployee(null);
                    setShowPassword(false);
                  }} 
                  className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100"
                >
                  {editingEmployee ? 'Update' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
