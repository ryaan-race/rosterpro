import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Trash2,
  CalendarCheck,
  AlertCircle,
  XCircle,
  Heart,
  Check
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, isSameDay } from 'date-fns';
import { cn, handleFirestoreError, OperationType } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AvailabilityRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  status: 'available' | 'unavailable' | 'preferred';
  note?: string;
  type: string;
}

export default function Availability() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRange, setIsRange] = useState(false);

  const [formData, setFormData] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'available' as 'available' | 'unavailable' | 'preferred',
    type: 'Any',
    note: ''
  });

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'availability'),
      where('employeeId', '==', user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAvailability(snap.docs.map(d => ({ id: d.id, ...d.data() } as AvailabilityRecord)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'availability');
    });

    return () => unsub();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'availability'), {
        employeeId: user.uid,
        employeeName: user.displayName || user.name || 'Unknown',
        ...formData,
        endDate: isRange ? formData.endDate : formData.startDate,
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'available',
        type: 'Any',
        note: ''
      });
      setIsRange(false);
    } catch (err) {
      console.error("Save availability error:", err);
      alert("Failed to save availability.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'availability', id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const weekStart = startOfWeek(new Date());
  const weekEnd = addDays(weekStart, 14); // Next 2 weeks
  const calendarDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getDayAvailability = (day: Date) => {
    return availability.filter(a => {
      const start = new Date(a.startDate);
      const end = new Date(a.endDate);
      // Strip time for proper comparison
      start.setHours(0,0,0,0);
      end.setHours(0,0,0,0);
      const target = new Date(day);
      target.setHours(0,0,0,0);
      return target >= start && target <= end;
    });
  };

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-10">
        <div>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-none">Shift Availability</h2>
          <p className="text-slate-500 mt-2 font-medium text-xs md:text-sm">Mark your preferred working times and unavailable dates.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center px-8 py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95 w-full md:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Availability
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-black text-slate-900 flex items-center gap-2">
                 <CalendarIcon className="w-4 h-4 text-indigo-600" />
                 Next 14 Days
               </h3>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 divide-x divide-y divide-slate-100 border-b border-slate-100">
               {calendarDays.map((day) => {
                 const dayAvail = getDayAvailability(day);
                 return (
                   <div 
                    key={day.toISOString()} 
                    className={cn(
                      "p-4 min-h-[120px] transition-all hover:bg-slate-50 flex flex-col space-y-2",
                      isSameDay(day, new Date()) && "bg-indigo-50/20"
                    )}
                   >
                     <p className={cn(
                       "text-[10px] font-black uppercase tracking-widest",
                       isSameDay(day, new Date()) ? "text-indigo-600" : "text-slate-400"
                     )}>
                       {format(day, 'EEE')}
                     </p>
                     <p className="text-lg font-black text-slate-900">{format(day, 'd')}</p>
                     <div className="space-y-1">
                       {dayAvail.map(a => (
                         <div 
                          key={a.id} 
                          className={cn(
                            "px-1.5 py-1 rounded text-[8px] font-black uppercase truncate flex items-center gap-1.5 shadow-sm border",
                            a.status === 'available' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            a.status === 'preferred' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            "bg-rose-50 text-rose-700 border-rose-100"
                          )}
                         >
                           {a.status === 'available' && <Check className="w-2.5 h-2.5" />}
                           {a.status === 'preferred' && <Heart className="w-2.5 h-2.5" />}
                           {a.status === 'unavailable' && <XCircle className="w-2.5 h-2.5" />}
                           {a.status === 'unavailable' ? 'Away' : a.type}
                         </div>
                       ))}
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-500" />
              Guidelines
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">Manager will prioritize 'Preferred' slots when building the schedule.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">'Unavailable' dates will block you from being auto-assigned to shifts.</p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-amber-600" />
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed">Changes made after schedule publication must be coordinated with supervisors.</p>
              </li>
            </ul>
          </div>

          <div className="bg-slate-950 p-8 rounded-[2.5rem] text-white shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Clock className="w-24 h-24 rotate-12" />
            </div>
            <h3 className="text-lg font-black tracking-tight mb-4 relative z-10">Your Recent Logs</h3>
            <div className="space-y-4 relative z-10">
              {availability.sort((a,b) => b.startDate.localeCompare(a.startDate)).slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                  <div>
                    <p className="text-xs font-black">
                      {format(new Date(a.startDate), 'MMM dd')}
                      {a.startDate !== a.endDate && ` – ${format(new Date(a.endDate), 'MMM dd')}`}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 truncate max-w-[120px]">
                      {a.status} • {a.note || a.type}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDelete(a.id)}
                    className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {availability.length === 0 && (
                <p className="text-xs font-bold text-slate-500 italic">No availability logs found.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 bg-slate-900 text-white">
                <h3 className="text-xl font-black tracking-tight">Mark Availability</h3>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Help us roster you better</p>
              </div>
              
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date Configuration</label>
                    <button 
                      type="button"
                      onClick={() => setIsRange(!isRange)}
                      className={cn(
                        "text-[9px] font-black uppercase px-3 py-1 rounded-full border transition-all",
                        isRange ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-100 text-slate-500 border-slate-200"
                      )}
                    >
                      {isRange ? "Date Range" : "Single Date"}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isRange ? 'Start' : 'Date'}</label>
                      <input 
                        type="date"
                        required
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                      />
                    </div>
                    {isRange && (
                       <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End</label>
                        <input 
                          type="date"
                          required
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                    <div className="grid grid-cols-3 gap-2">
                       {['available', 'unavailable', 'preferred'].map((s) => (
                         <button
                           key={s}
                           type="button"
                           onClick={() => setFormData({ ...formData, status: s as any })}
                           className={cn(
                             "py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all",
                             formData.status === s 
                               ? "bg-indigo-600 text-white border-indigo-600 shadow-lg" 
                               : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                           )}
                         >
                           {s === 'unavailable' ? 'Away' : s}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Type Preference</label>
                    <select 
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
                    >
                      <option value="Any">Any Shift Type</option>
                      {config.shiftTypes.map(t => (
                        <option key={t.name} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Note (Optional)</label>
                    <textarea 
                      placeholder="e.g. Appointment in the morning..."
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 h-24 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                  >
                    Log Availability
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
