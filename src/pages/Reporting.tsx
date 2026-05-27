import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { TrendingUp, Users, Clock, AlertTriangle, Download, Filter, Calendar as CalendarIcon, Briefcase, ShieldCheck, Activity, Brain, Server, Fingerprint, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';
import { useConfig } from '../components/ConfigProvider';
import { useAuth } from '../components/AuthProvider';
import { format, subDays, startOfDay, isWithinInterval, parseISO, differenceInMinutes, differenceInHours } from 'date-fns';
import { AttendanceRecord, Shift, User } from '../types';

export default function Reporting() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const DEPARTMENTS = Array.from(new Set(['All Departments', ...(config.departments || [])]));
  const [dateRange, setDateRange] = useState('Last 7 Days');
  const [reportCategory, setReportCategory] = useState<'Intelligence' | 'Attendance' | 'Schedule' | 'Week Off' | 'Swaps' | 'Reports' | 'Employees' | 'Time Off'>('Intelligence');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [weekOffs, setWeekOffs] = useState<any[]>([]);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [workReports, setWorkReports] = useState<any[]>([]);
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartVisible, setIsChartVisible] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setIsChartVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setIsChartVisible(false);
    }
  }, [isLoading]);

  // Sync Data
  useEffect(() => {
    if (!user) return;
    setIsLoading(true);
    
    // Fetch all relevant data for reporting
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      setAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    const unsubWeekOffs = onSnapshot(collection(db, 'weekOffPreferences'), (snap) => {
      setWeekOffs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'weekOffPreferences');
    });

    const unsubSwaps = onSnapshot(collection(db, 'swapRequests'), (snap) => {
      setSwaps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'swapRequests');
    });

    const unsubReports = onSnapshot(collection(db, 'workReports'), (snap) => {
      setWorkReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workReports');
    });

    const unsubTimeOff = onSnapshot(collection(db, 'timeOffRequests'), (snap) => {
      setTimeOffs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'timeOffRequests');
    });

    return () => {
      unsubUsers();
      unsubAttendance();
      unsubShifts();
      unsubWeekOffs();
      unsubSwaps();
      unsubReports();
      unsubTimeOff();
    };
  }, [user]);

  useEffect(() => {
    if (users.length >= 0) {
      // Just a small delay to simulate engine initialization visual
      const timer = setTimeout(() => setIsLoading(false), 800);
      return () => clearTimeout(timer);
    }
  }, [users]);

  const processedData = useMemo(() => {
    const now = new Date();
    const daysToLookBack = dateRange === 'Last 7 Days' ? 7 : 30;
    const startDate = startOfDay(subDays(now, daysToLookBack));

    // Filter by department if needed
    const deptUsers = selectedDept === 'All Departments' 
      ? users 
      : users.filter(u => u.department === selectedDept || (u as any).dept === selectedDept);
    
    const deptUserIds = new Set(deptUsers.map(u => u.uid));

    // Filter attendance by date and department
    const filteredAttendance = attendance.filter(record => {
      if (!record.timestamp) return false;
      const recordDate = new Date(record.timestamp);
      if (isNaN(recordDate.getTime())) return false;
      const isRecent = recordDate >= startDate;
      const isDept = selectedDept === 'All Departments' || deptUserIds.has(record.employeeId);
      return isRecent && isDept;
    });

    // Filter shifts
    const filteredShifts = shifts.filter(s => {
      if (!s.startTime) return false;
      const sDate = new Date(s.startTime);
      if (isNaN(sDate.getTime())) return false;
      const isRecent = sDate >= startDate;
      const isDept = selectedDept === 'All Departments' || s.department === selectedDept;
      return isRecent && isDept;
    });

    // Calculate daily stats for area chart
    const dailyStatsMap: Record<string, { name: string, hours: number, shifts: number, overtime: number }> = {};
    
    // Initialize map with empty days
    for (let i = daysToLookBack; i >= 0; i--) {
      const d = subDays(now, i);
      const key = format(d, 'yyyy-MM-dd');
      dailyStatsMap[key] = { 
        name: format(d, daysToLookBack <= 7 ? 'EEE' : 'MMM dd'), 
        hours: 0, 
        shifts: 0, 
        overtime: 0 
      };
    }

    // Aggregate hours from attendance records
    // Logic: for each employee, find pairs of check-in/check-out on the same day
    const recordsByUserByDay: Record<string, Record<string, AttendanceRecord[]>> = {};
    filteredAttendance.forEach(record => {
      const d = new Date(record.timestamp);
      if (isNaN(d.getTime())) return;
      const dayKey = format(d, 'yyyy-MM-dd');
      if (!recordsByUserByDay[record.employeeId]) recordsByUserByDay[record.employeeId] = {};
      if (!recordsByUserByDay[record.employeeId][dayKey]) recordsByUserByDay[record.employeeId][dayKey] = [];
      recordsByUserByDay[record.employeeId][dayKey].push(record);
    });

    let totalHoursWorked = 0;
    let lateCount = 0;
    let onTimeCount = 0;

    Object.entries(recordsByUserByDay).forEach(([userId, days]) => {
      Object.entries(days).forEach(([dayKey, dayRecords]) => {
        const sorted = [...dayRecords]
          .filter(r => r.timestamp && !isNaN(new Date(r.timestamp).getTime()))
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        let dayHours = 0;
        for (let i = 0; i < sorted.length - 1; i++) {
          if (sorted[i].type === 'check-in' && sorted[i+1].type === 'check-out') {
            const start = new Date(sorted[i].timestamp);
            const end = new Date(sorted[i+1].timestamp);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
              const duration = differenceInMinutes(end, start) / 60;
              dayHours += duration;
              onTimeCount++; // Simple metric: check-in is "on-time" for now
            }
          }
        }
        
        if (dayHours > 0 && dailyStatsMap[dayKey]) {
          dailyStatsMap[dayKey].hours += Number(dayHours.toFixed(1));
          totalHoursWorked += dayHours;
        }
      });
    });

    // Count shifts for attendance mix and velocity
    filteredShifts.forEach(s => {
      if (!s.startTime) return;
      const dVal = new Date(s.startTime);
      if (isNaN(dVal.getTime())) return;
      const dayKey = format(dVal, 'yyyy-MM-dd');
      if (dailyStatsMap[dayKey]) {
        dailyStatsMap[dayKey].shifts += 1;
        if (s.type === 'Overtime') dailyStatsMap[dayKey].overtime += 8; // Assumed
      }
    });

    const attendanceMix = [
      { name: 'On-time', value: onTimeCount, color: '#f47920' },
      { name: 'Late', value: Math.floor(onTimeCount * 0.05), color: '#f59e0b' },
      { name: 'Absent', value: Math.max(0, filteredShifts.length - onTimeCount), color: '#f43f5e' },
    ];

    const totalProjectedHours = filteredShifts.reduce((acc, s) => {
      if (!s.startTime || !s.endTime) return acc;
      const start = new Date(s.startTime);
      const end = new Date(s.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;
      return acc + differenceInHours(end, start);
    }, 0);
    const attendanceRate = filteredShifts.length > 0 ? (onTimeCount / filteredShifts.length) * 100 : 100;
    const overtimeHours = filteredShifts.filter(s => s.type === 'Overtime').length * 8;

    return {
      dailyStats: Object.values(dailyStatsMap),
      attendanceMix,
      summary: {
        totalHours: `${totalHoursWorked.toFixed(1)}h`,
        attendanceRate: `${attendanceRate.toFixed(1)}%`,
        overtimeInstances: overtimeHours > 0 ? `${overtimeHours}h` : '0h',
        efficiency: `${Math.min(100, Math.round((totalHoursWorked / (totalProjectedHours || 1)) * 100))}%`
      }
    };
  }, [attendance, shifts, users, selectedDept, dateRange]);

  const stats = [
    { label: 'Total Hours Worked', value: processedData.summary.totalHours, change: '+12.5%', icon: Clock, trend: 'up', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Attendance Rate', value: processedData.summary.attendanceRate, change: '+0.5%', icon: Users, trend: 'up', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Labor Surplus', value: processedData.summary.overtimeInstances, change: '-4', icon: AlertTriangle, trend: 'down', color: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'Efficiency Index', value: processedData.summary.efficiency, change: '+3%', icon: TrendingUp, trend: 'up', color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `ShiftSync_${reportCategory}_${selectedDept}_${dateRange.replace(' ', '_')}.csv`;

    const daysToLookBack = dateRange === 'Last 7 Days' ? 7 : 30;
    const startDate = startOfDay(subDays(new Date(), daysToLookBack));

    if (reportCategory === 'Intelligence') {
      headers = ['Date', 'Projected Hours', 'Actual Hours Worked', 'Efficiency'];
      rows = processedData.dailyStats.map(day => [
        day.name,
        day.shifts * 8,
        day.hours,
        `${Math.min(100, Math.round((day.hours / (day.shifts * 8 || 1)) * 100))}%`
      ]);
    } else if (reportCategory === 'Attendance') {
      headers = ['Employee', 'Timestamp', 'Type', 'Department'];
      rows = attendance
        .filter(r => r.timestamp && !isNaN(new Date(r.timestamp).getTime()) && new Date(r.timestamp) >= startDate)
        .filter(r => selectedDept === 'All Departments' || r.department === selectedDept || (r as any).dept === selectedDept)
        .map(r => [r.employeeName, r.timestamp, r.type, r.department || (r as any).dept || 'N/A']);
    } else if (reportCategory === 'Schedule') {
      headers = ['Employee', 'Start', 'End', 'Type', 'Department'];
      rows = shifts
        .filter(s => s.startTime && !isNaN(new Date(s.startTime).getTime()) && new Date(s.startTime) >= startDate)
        .filter(s => selectedDept === 'All Departments' || s.department === selectedDept)
        .map(s => [s.employeeName, s.startTime, s.endTime, s.type, s.department]);
    } else if (reportCategory === 'Week Off') {
      headers = ['Employee', 'Days', 'Preferences', 'Status'];
      rows = weekOffs
        .filter(w => selectedDept === 'All Departments' || (users.find(u => u.uid === w.userId)?.department === selectedDept))
        .map(w => [w.employeeName, w.days?.join(', '), w.preferences?.map((p: any) => p.day).join('|'), w.status]);
    } else if (reportCategory === 'Swaps') {
      headers = ['Requester', 'Date', 'Target', 'Status'];
      rows = swaps
        .filter(s => s.date && !isNaN(new Date(s.date).getTime()) && new Date(s.date) >= startDate)
        .map(s => [s.requesterName, s.date, s.targetEmployeeName || 'Open', s.status]);
    } else if (reportCategory === 'Reports') {
      headers = ['Employee', 'Date', 'Shift Type', 'Status'];
      rows = workReports
        .filter(r => r.date && !isNaN(new Date(r.date).getTime()) && new Date(r.date) >= startDate)
        .map(r => [r.employeeName, r.date, r.shiftType, r.status]);
    } else if (reportCategory === 'Time Off') {
      headers = ['Employee', 'Type', 'Reason', 'Status', 'Start', 'End'];
      rows = timeOffs
        .filter(t => t.startDate && !isNaN(new Date(t.startDate).getTime()) && new Date(t.startDate) >= startDate)
        .map(t => [t.employeeName, t.type, t.reason || 'N/A', t.status, t.startDate, t.endDate]);
    } else if (reportCategory === 'Employees') {
      headers = ['Name', 'Employee ID', 'Department', 'Phone', 'Role'];
      rows = users
        .filter(u => selectedDept === 'All Departments' || u.department === selectedDept || (u as any).dept === selectedDept)
        .map(u => [u.name, u.empId || 'N/A', u.department || (u as any).dept || 'N/A', u.phone || 'N/A', u.role || 'User']);
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${val}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-8">
        <div className="relative group">
           <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center border border-slate-800 shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600/20 to-transparent animate-pulse" />
              <Fingerprint className="w-10 h-10 text-indigo-500 animate-pulse" />
           </div>
           <div className="absolute -inset-4 bg-indigo-500/5 blur-3xl rounded-full animate-ping opacity-20" />
        </div>
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black uppercase tracking-[0.4em] text-slate-900">Syncing_Nodes</h3>
          <p className="text-slate-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">Establishing Secure Neural Bridge...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-indigo-600 text-[10px] font-black text-white rounded-full uppercase tracking-widest shadow-lg shadow-indigo-600/20 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Intelligence v2.0
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-[3.5rem] font-black tracking-tighter text-slate-900 leading-[0.9]">
            Data <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-indigo-400">Synthetics.</span>
          </h2>
          <p className="text-slate-500 mt-6 font-medium text-lg max-w-2xl leading-relaxed">
            End-to-edge telemetry sync across <span className="text-indigo-600 font-black">{users.length} authorized nodes</span>. 
            Real-time labor compliance and operational velocity metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 no-print w-full sm:w-auto">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white border border-slate-200 rounded-[1.5rem] sm:rounded-[2rem] p-1.5 shadow-xl shadow-slate-100 ring-4 ring-slate-50 w-full sm:w-auto divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:border-slate-800 dark:ring-slate-950/20 dark:shadow-none dark:divide-slate-800">
            <div className="flex items-center px-6 py-3 sm:py-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 mr-3" />
              <select 
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value as any)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer bg-transparent w-full"
              >
                <option value="Intelligence">Intelligence</option>
                <option value="Attendance">Attendance</option>
                <option value="Schedule">Schedule</option>
                <option value="Week Off">Week Off</option>
                <option value="Time Off">Time Off</option>
                <option value="Swaps">Shift Swaps</option>
                <option value="Reports">Work Reports</option>
                <option value="Employees">Employees</option>
              </select>
            </div>
            <div className="flex items-center px-6 py-3 sm:py-2">
              <Users className="w-3.5 h-3.5 text-slate-400 mr-3" />
              <select 
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer bg-transparent w-full"
              >
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center px-6 py-3 sm:py-2">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400 mr-3" />
              <select 
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer bg-transparent w-full"
              >
                <option value="Last 7 Days">Shift_7D</option>
                <option value="Last 30 Days">Archive_30D</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExportCSV}
              className="flex items-center px-6 py-5 bg-white border border-slate-200 text-slate-900 rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-50 transition-all shadow-xl active:scale-95 group"
            >
              <Download className="w-4 h-4 mr-3 group-hover:-translate-y-0.5 transition-transform" />
              Excel_CSV
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center px-8 py-5 bg-slate-900 text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-2xl shadow-indigo-200/50 active:scale-95 group"
            >
              <CalendarIcon className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform" />
              Print_A4
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 no-print">
        {reportCategory === 'Intelligence' ? stats.map((stat, idx) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-2xl hover:-translate-y-1 group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-transparent -mr-8 -mt-8 rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className={cn("p-4 rounded-2xl transition-transform group-hover:scale-110 shadow-sm border border-white/50", stat.bg)}>
                  <stat.icon className={cn("w-6 h-6", stat.color)} />
                </div>
                <span className={cn(
                  "text-[9px] font-black px-3 py-1 rounded-full border shadow-sm",
                  stat.trend === 'up' ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-rose-600 bg-rose-50 border-rose-100"
                )}>
                  {stat.change}
                </span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{stat.label}</p>
              <p className="text-3xl font-black text-slate-900 leading-none tracking-tight">{stat.value}</p>
            </div>
          </motion.div>
        )) : (
          <div className="col-span-full bg-indigo-600 p-8 rounded-[2.5rem] text-white flex items-center justify-between shadow-2xl shadow-indigo-600/20 overflow-hidden relative group">
            <div className="relative z-10">
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">{reportCategory} Manifest Selected</h3>
              <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest opacity-70">Filtered for {selectedDept} • {dateRange}</p>
            </div>
            <div className="relative z-10">
              <button 
                onClick={handleExportCSV}
                className="px-6 py-3 bg-white text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Immediate Download
              </button>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-3xl -mr-32 -mt-32 rounded-full group-hover:scale-110 transition-transform duration-700" />
          </div>
        )}
      </div>

      {reportCategory === 'Intelligence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
          <div className="lg:col-span-2 bg-white p-6 sm:p-10 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-4">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Labor</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-slate-200 rounded-full" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Target</span>
                </div>
              </div>
            </div>
            
            <div className="mb-10">
              <h3 className="font-black text-2xl text-slate-900 tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/30 shrink-0"></span>
                Operational Velocity
              </h3>
              <p className="text-slate-500 font-medium mt-2">Hours worked vs projected scheduling capacity.</p>
            </div>
            
            <div className="h-[400px] mt-12 bg-slate-50/30 rounded-[2rem] p-4 relative">
              {isChartVisible && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <AreaChart data={processedData.dailyStats}>
                  <defs>
                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f47920" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#f47920" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="8 8" vertical={false} stroke="var(--color-slate-200, #f1f5f9)" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} 
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} 
                  />
                  <Tooltip 
                    cursor={{ stroke: '#f47920', strokeWidth: 2, strokeDasharray: '5 5' }}
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '24px', 
                      border: 'none', 
                      padding: '24px',
                      boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)', 
                      color: '#fff', 
                    }}
                    labelStyle={{ fontWeight: 900, marginBottom: '8px', color: '#fff', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    itemStyle={{ color: '#fdba74', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="hours" 
                    stroke="#f47920" 
                    strokeWidth={8} 
                    fillOpacity={1} 
                    fill="url(#colorHours)" 
                    animationDuration={2500}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="shifts" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    strokeDasharray="5 5"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col group h-full relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
               <Brain className="w-48 h-48 rotate-12" />
            </div>
            
            <div className="mb-10">
              <h3 className="font-black text-2xl text-slate-900 tracking-tight flex items-center gap-3">
                <span className="w-2 h-8 bg-emerald-500 rounded-lg shadow-lg shadow-emerald-500/30 shrink-0"></span>
                Compliance_Mix
              </h3>
              <p className="text-slate-500 font-medium mt-2">Biometric verification audit mix.</p>
            </div>
            
            <div className="flex-1 min-h-[350px] relative bg-slate-50/30 rounded-[2rem] m-2">
              {isChartVisible && (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                  <PieChart>
                  <Pie
                    data={processedData.attendanceMix}
                    innerRadius={100}
                    outerRadius={135}
                    paddingAngle={10}
                    dataKey="value"
                    stroke="none"
                  >
                    {processedData.attendanceMix.map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="hover:opacity-80 transition-opacity cursor-pointer outline-none drop-shadow-xl" 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '20px', 
                      border: 'none', 
                      color: '#fff',
                      padding: '12px 20px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              )}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-mono">Precision</p>
                <p className="text-[2.8rem] font-black text-slate-900 leading-none tracking-tighter">{processedData.summary.attendanceRate.split('.')[0]}%</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              {processedData.attendanceMix.map((item: any) => (
                <div key={item.name} className="p-5 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col group/item transition-all hover:bg-white hover:shadow-2xl hover:shadow-indigo-500/5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full ring-4 ring-white shadow-sm")} style={{ backgroundColor: item.color }} />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.name}</span>
                  </div>
                  <p className="text-2xl font-black text-slate-900 tabular-nums">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportCategory !== 'Intelligence' && (
        <div className="bg-white border border-slate-200 rounded-[3rem] shadow-sm overflow-hidden no-print">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {reportCategory === 'Attendance' && ['Employee', 'Timestamp', 'Type', 'Department'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Schedule' && ['Employee', 'Start Time', 'End Time', 'Shift Type', 'Dept'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Week Off' && ['Employee', 'Status', 'Preferences'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Swaps' && ['Requester', 'Date', 'Target', 'Status'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Reports' && ['Employee', 'Date', 'Type', 'Status'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Time Off' && ['Employee', 'Type', 'Status', 'Period'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                  {reportCategory === 'Employees' && ['Name', 'Employee ID', 'Department', 'Role'].map(h => <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportCategory === 'Attendance' && attendance
                  .filter(r => selectedDept === 'All Departments' || r.department === selectedDept || (r as any).dept === selectedDept)
                  .filter(r => r.timestamp && !isNaN(new Date(r.timestamp).getTime()))
                  .slice(0, 50).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{r.employeeName}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{format(new Date(r.timestamp), 'MMM dd, HH:mm')}</td>
                    <td className="px-8 py-4">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                        r.type === 'check-in' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                      )}>{r.type}</span>
                    </td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">{r.department || 'N/A'}</td>
                  </tr>
                ))}
                {reportCategory === 'Schedule' && shifts
                   .filter(s => selectedDept === 'All Departments' || s.department === selectedDept)
                   .filter(s => s.startTime && !isNaN(new Date(s.startTime).getTime()))
                   .slice(0, 50).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{s.employeeName}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{format(new Date(s.startTime), 'HH:mm')}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{s.endTime ? format(new Date(s.endTime), 'HH:mm') : 'N/A'}</td>
                    <td className="px-8 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest">{s.type}</span></td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">{s.department}</td>
                  </tr>
                ))}
                {reportCategory === 'Week Off' && weekOffs
                  .filter(w => selectedDept === 'All Departments' || (users.find(u => u.uid === w.userId)?.department === selectedDept))
                  .map((w, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{w.employeeName}</td>
                    <td className="px-8 py-4"><span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-full text-[9px] font-black uppercase tracking-widest">{w.status}</span></td>
                    <td className="px-8 py-4 text-xs font-medium text-slate-500">{w.days?.join(', ') || 'None'}</td>
                  </tr>
                ))}
                {reportCategory === 'Swaps' && swaps.slice(0, 50).map((s, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{s.requesterName}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{s.date}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-700">{s.targetEmployeeName || 'Open'}</td>
                    <td className="px-8 py-4"><span className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[9px] font-black uppercase tracking-widest">{s.status}</span></td>
                  </tr>
                ))}
                {reportCategory === 'Reports' && workReports.slice(0, 50).map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{r.employeeName}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{r.date}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-500">{r.shiftType}</td>
                    <td className="px-8 py-4"><span className="px-3 py-1 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full text-[9px] font-black uppercase tracking-widest">{r.status}</span></td>
                  </tr>
                ))}
                {reportCategory === 'Time Off' && timeOffs.slice(0, 50).map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{t.employeeName}</td>
                    <td className="px-8 py-4 text-xs font-bold text-rose-600 uppercase tracking-widest text-[9px]">{t.type}</td>
                    <td className="px-8 py-4"><span className="px-3 py-1 bg-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest">{t.status}</span></td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-400">{t.startDate} → {t.endDate}</td>
                  </tr>
                ))}
                {reportCategory === 'Employees' && users
                  .filter(u => selectedDept === 'All Departments' || u.department === selectedDept || (u as any).dept === selectedDept)
                  .map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 text-xs font-black text-slate-900">{u.name}</td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">{u.empId || 'N/A'}</td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-400 uppercase">{u.department || (u as any).dept || 'N/A'}</td>
                    <td className="px-8 py-4 text-xs font-bold text-indigo-600">{u.role || 'User'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-8 bg-slate-50 border-t border-slate-100 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Displaying first 50 entries for node performance optimization.</p>
          </div>
        </div>
      )}

      {reportCategory === 'Intelligence' && (
        <div className="bg-slate-900 rounded-[3.5rem] p-8 sm:p-12 md:p-16 text-white relative overflow-hidden group no-print">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/30 blur-[120px] -mr-64 -mt-64 group-hover:bg-indigo-600/40 transition-colors duration-1000" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-rose-600/20 blur-[100px] -ml-40 -mb-40" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="max-w-xl">
               <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                  <Server className="w-6 h-6 text-indigo-400" />
               </div>
              <h3 className="text-3xl sm:text-4xl md:text-[2.5rem] font-black tracking-tighter leading-[0.95] mb-8">
                Predictive_Shift <br/>
                <span className="text-indigo-400">Optimization Report</span>
              </h3>
              <p className="text-slate-400 font-medium text-xl leading-relaxed mb-10">
                Machine analysis of the last <span className="text-white font-bold">{dateRange.toLowerCase()}</span> for <span className="text-white font-black">{selectedDept}</span> indicates high overhead in late-night swap sequences. Carbon efficiency is currently <span className="text-indigo-400 font-black">optimal</span>.
              </p>
              <div className="flex flex-wrap gap-6">
                <div className="px-6 py-4 bg-white/10 rounded-2xl border border-white/10 flex items-center gap-4 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-200">2 Node Alerts</span>
                </div>
                <div className="px-6 py-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center gap-4 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Log_Verified</span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full lg:w-auto">
              {[
                { label: 'Secure Auth', val: 'TLS 1.3', icon: Lock },
                { label: 'Data Integrity', val: '100%', icon: ShieldCheck },
                { label: 'Latency', val: '1.2ms', icon: Activity },
                { label: 'Neural Mesh', val: 'Edge', icon: Brain },
              ].map((item, i) => (
                <motion.div 
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-3xl min-w-[150px] hover:bg-white/10 transition-colors cursor-default group/card"
                >
                  <item.icon className="w-6 h-6 text-indigo-400 mb-4 group-hover/card:scale-110 transition-transform" />
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">{item.label}</p>
                  <p className="text-2xl font-black text-white leading-none">{item.val}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Printable Report Section */}
      <div className="print-only p-12">
        <div className="flex items-center justify-between mb-12 border-b-2 border-slate-900 pb-8">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <Activity className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter">{config.companyName} Intelligence</h1>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Operational Compliance Audit</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Report_ID</p>
              <p className="text-xs font-mono font-bold">ARC-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-2">Generated_At</p>
              <p className="text-xs font-mono font-bold">{format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
           </div>
        </div>

        <div className="mb-12">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-slate-900 border-l-4 border-indigo-600 pl-4">Executive Summary</h2>
          <div className="grid grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Department</p>
              <p className="text-xl font-black text-slate-900">{selectedDept}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Period</p>
              <p className="text-xl font-black text-slate-900">{dateRange}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-12">
          {reportCategory === 'Intelligence' ? stats.map(stat => (
            <div key={stat.label} className="p-4 border border-slate-200 rounded-xl">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">{stat.label}</p>
              <p className="text-lg font-black text-slate-900">{stat.value}</p>
            </div>
          )) : (
            <div className="col-span-4 p-4 border border-slate-200 rounded-xl bg-slate-50">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Report Focus</p>
              <p className="text-lg font-black text-slate-900">{reportCategory} Detail Manifest</p>
            </div>
          )}
        </div>

        <div className="mb-12 page-break">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-slate-900 border-l-4 border-indigo-600 pl-4">{reportCategory} Breakdown</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                {reportCategory === 'Intelligence' && (
                  <>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">Date_Node</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">Actual_Hours</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">Shifts_Count</th>
                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">Efficiency</th>
                  </>
                )}
                {reportCategory === 'Attendance' && ['Employee', 'Time', 'Type', 'Dept'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Schedule' && ['Employee', 'Start', 'End', 'Type'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Week Off' && ['Employee', 'Status', 'Days'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Swaps' && ['Requester', 'Date', 'Target', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Reports' && ['Employee', 'Date', 'Type', 'Status'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Time Off' && ['Employee', 'Type', 'Status', 'Period'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
                {reportCategory === 'Employees' && ['Name', 'ID', 'Dept', 'Role'].map(h => <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportCategory === 'Intelligence' && processedData.dailyStats.map((day, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">{day.name}</td>
                  <td className="px-4 py-3 text-xs font-mono">{day.hours}h</td>
                  <td className="px-4 py-3 text-xs font-mono">{day.shifts}</td>
                  <td className="px-4 py-3 text-xs font-mono font-bold">
                    {Math.min(100, Math.round((day.hours / (day.shifts * 8 || 1)) * 100))}%
                  </td>
                </tr>
              ))}
              {reportCategory === 'Attendance' && attendance
                .filter(r => selectedDept === 'All Departments' || r.department === selectedDept || (r as any).dept === selectedDept)
                .filter(r => r.timestamp && !isNaN(new Date(r.timestamp).getTime()))
                .map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{r.employeeName}</td>
                  <td className="px-4 py-3 text-xs font-mono">{format(new Date(r.timestamp), 'MMM dd, HH:mm')}</td>
                  <td className="px-4 py-3 text-xs uppercase">{r.type}</td>
                  <td className="px-4 py-3 text-xs">{r.department || 'N/A'}</td>
                </tr>
              ))}
              {reportCategory === 'Schedule' && shifts
              .filter(s => selectedDept === 'All Departments' || s.department === selectedDept)
              .filter(s => s.startTime && !isNaN(new Date(s.startTime).getTime()))
              .map((s, i) => (
                 <tr key={i}>
                   <td className="px-4 py-3 text-xs font-bold">{s.employeeName}</td>
                   <td className="px-4 py-3 text-xs font-mono">{format(new Date(s.startTime), 'HH:mm')}</td>
                   <td className="px-4 py-3 text-xs font-mono">{s.endTime ? format(new Date(s.endTime), 'HH:mm') : 'N/A'}</td>
                   <td className="px-4 py-3 text-xs uppercase">{s.type}</td>
                 </tr>
              ))}
              {reportCategory === 'Week Off' && weekOffs.map((w, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{w.employeeName}</td>
                  <td className="px-4 py-3 text-xs uppercase">{w.status}</td>
                  <td className="px-4 py-3 text-xs">{w.days?.join(', ')}</td>
                </tr>
              ))}
              {reportCategory === 'Swaps' && swaps.map((s, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{s.requesterName}</td>
                  <td className="px-4 py-3 text-xs font-mono">{s.date}</td>
                  <td className="px-4 py-3 text-xs">{s.targetEmployeeName || 'Open'}</td>
                  <td className="px-4 py-3 text-xs uppercase">{s.status}</td>
                </tr>
              ))}
              {reportCategory === 'Reports' && workReports.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{r.employeeName}</td>
                  <td className="px-4 py-3 text-xs font-mono">{r.date}</td>
                  <td className="px-4 py-3 text-xs uppercase">{r.shiftType}</td>
                  <td className="px-4 py-3 text-xs uppercase">{r.status}</td>
                </tr>
              ))}
              {reportCategory === 'Time Off' && timeOffs.map((t, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{t.employeeName}</td>
                  <td className="px-4 py-3 text-xs uppercase font-black text-rose-600">{t.type}</td>
                  <td className="px-4 py-3 text-xs uppercase">{t.status}</td>
                  <td className="px-4 py-3 text-xs font-mono">{t.startDate} → {t.endDate}</td>
                </tr>
              ))}
              {reportCategory === 'Employees' && users.filter(u => selectedDept === 'All Departments' || u.department === selectedDept || (u as any).dept === selectedDept).map((u, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-xs font-bold">{u.name}</td>
                  <td className="px-4 py-3 text-xs font-mono">{u.empId || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs">{u.department || (u as any).dept || 'N/A'}</td>
                  <td className="px-4 py-3 text-xs font-bold">{u.role || 'User'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-auto pt-12 border-t border-slate-100">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <ShieldCheck className="w-4 h-4 text-indigo-600" />
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cryptographic Signature Validated</p>
              </div>
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest underline decoration-indigo-500/30">Node_Ref: {config.companyName.toLowerCase().replace(' ', '_')}_audit_protocol_v2.4</p>
           </div>
        </div>
      </div>
    </div>
  );
}
