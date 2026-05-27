import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  parseISO, 
  isSameMonth, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { 
  Coffee, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  X, 
  Trash2,
  AlertCircle,
  User,
  Info,
  ChevronRight,
  RefreshCw,
  ChevronLeft
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { cn } from '../lib/utils';
import { WeekOffPreference, User as Employee, Shift } from '../types';

const DAYS_OF_WEEK = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
];

export default function WeekOff() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<WeekOffPreference[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [reason, setReason] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.appData?.role?.toLowerCase() || '');

  useEffect(() => {
    if (!user) return;

    // Load preferences
    const q = isManager 
      ? query(collection(db, 'weekOffPreferences'), orderBy('requestedAt', 'desc'))
      : query(collection(db, 'weekOffPreferences'), where('employeeId', '==', user.uid), orderBy('requestedAt', 'desc'));

    const unsubPrefs = onSnapshot(q, (snap) => {
      const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeekOffPreference));
      setPreferences(p);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'weekOffPreferences');
    });

    // Load shifts for sync detection
    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    // Load employees for management view
    if (isManager) {
      const unsubEmp = onSnapshot(collection(db, 'users'), (snap) => {
        setEmployees(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Employee)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
      return () => {
        unsubPrefs();
        unsubShifts();
        unsubEmp();
      };
    }

    return () => {
        unsubPrefs();
        unsubShifts();
    };
  }, [user, isManager]);

  const conflicts = useMemo(() => {
    const list: { prefId: string; shiftId: string; date: string; employeeName: string }[] = [];
    
    preferences.filter(p => p.status === 'approved').forEach(pref => {
      const employeeShifts = shifts.filter(s => 
        (s.employeeId === pref.employeeId || s.employeeName === pref.employeeName) && 
        s.status !== 'canceled'
      );

      employeeShifts.forEach(shift => {
        const shiftDate = parseISO(shift.startTime);
        const dayName = format(shiftDate, 'EEEE');
        const dateStr = format(shiftDate, 'yyyy-MM-dd');
        
        const isRecurringConflict = pref.days.includes(dayName);
        const isSpecificConflict = pref.specificDates?.includes(dateStr);

        if (isRecurringConflict || isSpecificConflict) {
          list.push({
            prefId: pref.id,
            shiftId: shift.id,
            date: format(shiftDate, 'MMM dd'),
            employeeName: pref.employeeName
          });
        }
      });
    });

    return list;
  }, [preferences, shifts]);

  const handleSyncProtocol = async () => {
    if (!isManager) return;
    setIsSyncing(true);
    try {
      let canceledCount = 0;
      for (const conflict of conflicts) {
        await updateDoc(doc(db, 'shifts', conflict.shiftId), {
          status: 'canceled',
          updatedAt: new Date().toISOString(),
          notes: `Auto-canceled: Conflicts with approved Week-Off protocol.`
        });
        canceledCount++;
      }
      alert(`Sync Complete: ${canceledCount} conflicting shifts were neutralized.`);
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Protocol synchronization failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (selectedDays.length === 0 && selectedDates.length === 0)) return;

    try {
      await addDoc(collection(db, 'weekOffPreferences'), {
        employeeId: user.uid,
        employeeName: user.displayName || user.appData?.name || 'Unknown',
        days: selectedDays,
        specificDates: selectedDates,
        status: 'pending',
        reason,
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      setIsModalOpen(false);
      setSelectedDays([]);
      setSelectedDates([]);
      setReason('');
      alert('Week off preference submitted for review.');
    } catch (error) {
      console.error("Error submitting preference:", error);
      alert('Failed to submit preference.');
    }
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'weekOffPreferences', id), {
        status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this preference?')) return;
    try {
      await deleteDoc(doc(db, 'weekOffPreferences', id));
    } catch (error) {
      console.error("Error deleting preference:", error);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const toggleDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-none">Week Off Matrix</h2>
          <p className="text-slate-500 mt-2 font-medium text-xs md:text-sm">Tap any date on the calendar below to request a specific off-day, or use the "New Protocol" button for recurring cycles.</p>
        </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {isManager && conflicts.length > 0 && (
              <button 
                onClick={handleSyncProtocol}
                disabled={isSyncing}
                className="flex items-center justify-center px-6 py-3.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 active:scale-95 w-full sm:w-auto border border-rose-500"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
                Sync Protocol ({conflicts.length})
              </button>
            )}
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 w-full md:w-auto font-sans"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Protocol Request
            </button>
          </div>
      </div>

      {conflicts.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 border-2 border-rose-100 rounded-[2rem] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-rose-900 uppercase tracking-widest">Protocol Deviation Detected</h4>
              <p className="text-xs text-rose-600 font-medium mt-1">There are {conflicts.length} shifts scheduled on approved week-off days. Sync to neutralize.</p>
            </div>
          </div>
          {isManager && (
            <button 
              onClick={handleSyncProtocol}
              className="px-6 py-3 bg-white text-rose-600 border border-rose-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all"
            >
              Apply Correction
            </button>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Protocol Calendar Viewer */}
        <div className="lg:col-span-8 order-2 lg:order-1">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Protocol Calendar</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Visualizing approved off-day cycles.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[120px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
                >
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-center py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayName = format(day, 'EEEE');
                const isSameMo = isSameMonth(day, currentMonth);
                const today = isToday(day);
                
                const approvedPrefs = preferences.filter(p => 
                  p.status === 'approved' && 
                  (isManager || p.employeeId === user?.uid)
                );

                const dayOffs = approvedPrefs.filter(p => 
                  p.days.includes(dayName) || (p.specificDates && p.specificDates.includes(dateStr))
                );

                return (
                  <div
                    key={i}
                    onClick={() => {
                      if (isSameMo) {
                        setSelectedDates([dateStr]);
                        setIsModalOpen(true);
                      }
                    }}
                    className={cn(
                      "min-h-[100px] p-3 rounded-2xl border transition-all relative group cursor-pointer",
                      !isSameMo ? "bg-slate-50 opacity-20 pointer-events-none" : "bg-white border-slate-100 hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 hover:z-10",
                      today && "ring-2 ring-indigo-500 ring-offset-2"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-black",
                        today ? "text-indigo-600 underline decoration-2 underline-offset-4" : "text-slate-400"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {isSameMo && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="w-3 h-3 text-indigo-400" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2 space-y-1">
                      {dayOffs.map((off, idx) => (
                        <div 
                          key={idx}
                          className="px-2 py-1 bg-rose-50 text-rose-600 rounded-lg text-[8px] font-black uppercase tracking-tight flex items-center gap-1 border border-rose-100"
                        >
                          <div className="w-1 h-1 bg-rose-400 rounded-full" />
                          <span className="truncate">{off.employeeName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Info & Log Panel */}
        <div className="lg:col-span-4 space-y-8 order-1 lg:order-2">
          {/* Current Protocol Card */}
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
              <Coffee className="w-24 h-24" />
            </div>
            
            <div className="relative z-10">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Personal Tracker</span>
               <h3 className="text-2xl font-black mt-2 mb-6 tracking-tight">Your Next Offs</h3>
               
               {preferences.some(p => p.status === 'approved' && p.employeeId === user?.uid) ? (
                 <div className="space-y-4">
                   <div className="flex flex-wrap gap-2">
                     {preferences.find(p => p.status === 'approved' && p.employeeId === user?.uid)?.days.map(day => (
                       <span key={day} className="px-3 py-1 bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10">
                         {day}
                       </span>
                     ))}
                     {preferences.find(p => p.status === 'approved' && p.employeeId === user?.uid)?.specificDates?.map(date => (
                       <span key={date} className="px-3 py-1 bg-indigo-500/20 text-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-400/30">
                         {format(parseISO(date), 'MMM dd')}
                       </span>
                     ))}
                   </div>
                   <div className="pt-4 border-t border-white/10">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1 italic">Authorized Schedule</p>
                      <p className="text-xs text-white/60 font-medium">Your shifts are automatically neutralized on these dates.</p>
                   </div>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                     <p className="text-xs text-indigo-200 font-medium leading-relaxed">No off-day protocol detected for your account. System defaults apply.</p>
                   </div>
                   <button 
                      onClick={() => setIsModalOpen(true)}
                      className="text-[10px] font-black text-white uppercase tracking-widest flex items-center hover:text-indigo-400 transition-colors"
                   >
                     Configure Now <ChevronRight className="w-3 h-3 ml-1" />
                   </button>
                 </div>
               )}
            </div>
          </div>

          {/* Mini Requests Feed */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                 <Clock className="w-4 h-4 text-indigo-600" />
                 Log Feed
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{preferences.length}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {preferences.slice(0, 10).map((pref) => (
                <motion.div 
                  key={pref.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border",
                      pref.status === 'approved' && "bg-emerald-50 text-emerald-600 border-emerald-100",
                      pref.status === 'pending' && "bg-amber-50 text-amber-600 border-amber-100",
                      pref.status === 'rejected' && "bg-rose-50 text-rose-600 border-rose-100"
                    )}>
                      {pref.status}
                    </div>
                    {(isManager || pref.employeeId === user?.uid) && (
                      <button 
                        onClick={() => handleDelete(pref.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest truncate">{pref.employeeName}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pref.days.map(day => (
                        <span key={day} className="text-[9px] font-bold text-slate-900">{day.slice(0, 3)}</span>
                      ))}
                      {pref.specificDates?.map(date => (
                        <span key={date} className="text-[9px] font-medium text-slate-400">{format(parseISO(date), 'MM/dd')}</span>
                      ))}
                    </div>
                  </div>

                  {isManager && pref.status === 'pending' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                      <button 
                        onClick={() => handleStatusUpdate(pref.id, 'approved')}
                        className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(pref.id, 'rejected')}
                        className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95"
                      >
                        Deny
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}

              {!loading && preferences.length === 0 && (
                <div className="py-12 px-6 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                   <Coffee className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                   <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No Logs Found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preference Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 bg-slate-950 text-white flex items-center justify-between border-b border-white/10">
                <div>
                   <h3 className="text-xl font-black tracking-tight uppercase">Protocol Configuration</h3>
                   <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Submit Off-Day Preferences</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Specific Dates</label>
                    <div className="flex items-center gap-4">
                      <button 
                        type="button" 
                        onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[100px] text-center">
                        {format(currentMonth, 'MMMM yyyy')}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <div key={i} className="text-center text-[9px] font-black text-slate-400 p-2">{day}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, i) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isSelected = selectedDates.includes(dateStr);
                        const isSameMo = isSameMonth(day, currentMonth);
                        const today = isToday(day);
                        
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleDate(day)}
                            className={cn(
                              "relative aspect-square flex flex-col items-center justify-center rounded-xl text-[10px] font-bold transition-all",
                              !isSameMo && "opacity-20",
                              isSelected ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : 
                              today ? "bg-indigo-50 text-indigo-600" :
                              "hover:bg-white"
                            )}
                          >
                            {format(day, 'd')}
                            {isSelected && (
                              <div className="absolute bottom-1 w-1 h-1 bg-white rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Recurring Off-Days</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                          selectedDays.includes(day)
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                            : "bg-slate-50 border-transparent text-slate-400 hover:border-slate-200"
                        )}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Reason / Justification</label>
                  <textarea 
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Personal commitments, family schedule, etc."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-[1.8rem] text-sm font-bold focus:outline-none focus:ring-8 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all min-h-[120px] resize-none"
                  />
                </div>

                <div className="p-6 bg-amber-50 rounded-[1.8rem] border border-amber-200 flex gap-4">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-amber-100">
                    <Info className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-[10px] font-black text-amber-900/60 leading-relaxed uppercase tracking-tight">
                    This selection is a preference and subject to operational requirements. Final scheduling rights remain with the command center.
                  </p>
                </div>

                <div className="flex gap-4 pt-4">
                   <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Abort
                  </button>
                  <button 
                    type="submit"
                    className="flex-2 py-4 bg-indigo-600 text-white rounded-[1.8rem] text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                  >
                    Commit Configuration
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

