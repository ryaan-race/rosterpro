import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Send,
  History,
  X,
  ClipboardList,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  updateDoc,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { format, isAfter, subDays } from 'date-fns';
import { cn, hasPermission } from '../lib/utils';
import { Shift, WorkReport } from '../types';

export default function WorkReports() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewingReport, setViewingReport] = useState<WorkReport | null>(null);
  
  const isManager = hasPermission(user, config, 'canEditReports');

  useEffect(() => {
    if (!user) return;

    // Load shifts (recent completed or scheduled ones for the employee)
    const shiftsRef = collection(db, 'shifts');
    let shiftsQuery;
    
    if (isManager) {
      shiftsQuery = query(
        shiftsRef, 
        orderBy('startTime', 'desc'),
        limit(50)
      );
    } else {
      shiftsQuery = query(
        shiftsRef, 
        where('employeeId', '==', user.uid),
        orderBy('startTime', 'desc'),
        limit(20)
      );
    }

    const unsubShifts = onSnapshot(shiftsQuery, (snap) => {
      const shiftData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));
      setShifts(shiftData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    // Load reports
    const reportsRef = collection(db, 'workReports');
    let reportsQuery;
    
    if (isManager) {
      reportsQuery = query(
        reportsRef,
        orderBy('submittedAt', 'desc'),
        limit(100)
      );
    } else {
      reportsQuery = query(
        reportsRef,
        where('employeeId', '==', user.uid),
        orderBy('submittedAt', 'desc')
      );
    }

    const unsubReports = onSnapshot(reportsQuery, (snap) => {
      const reportData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkReport));
      setReports(reportData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'workReports');
    });

    return () => {
      unsubShifts();
      unsubReports();
    };
  }, [user, isManager]);

  const handleSubmitReport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShift || !user) return;

    setSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const reportData = {
      employeeId: user.uid,
      employeeName: user.displayName || 'Unknown',
      shiftId: selectedShift.id,
      shiftDate: selectedShift.startTime,
      shiftType: selectedShift.type,
      tasksCompleted: formData.get('tasks') as string,
      handoverNotes: formData.get('handover') as string,
      issuesEncountered: formData.get('issues') as string,
      submittedAt: new Date().toISOString(),
      status: 'submitted'
    };

    try {
      await addDoc(collection(db, 'workReports'), reportData);
      
      // Also send a notification to managers
      const managersQuery = query(collection(db, 'users'), where('role', 'in', ['manager', 'admin', 'Manager', 'Admin']));
      const managerSnaps = await getDocs(managersQuery);
      
      for (const mDoc of managerSnaps.docs) {
        await addDoc(collection(db, 'notifications'), {
          userId: mDoc.id,
          title: 'New Work Report',
          message: `${user.displayName} submitted a report for ${safeFormat(selectedShift.startTime, 'MMM dd')} ${selectedShift.type} shift.`,
          type: 'work_report',
          read: false,
          createdAt: new Date().toISOString()
        });
      }

      setIsSubmitModalOpen(false);
      setSelectedShift(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'workReports/notifications');
    } finally {
      setSubmitting(false);
    }
  };

  const getReportForShift = (shiftId: string) => {
    return reports.find(r => r.shiftId === shiftId);
  };

  const safeFormat = (dateStr: string | undefined, formatStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, formatStr);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase">Operational Logs</h2>
            <p className="text-slate-500 font-medium text-xs md:text-sm">Document and review daily work throughput across the squad.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Shifts for Reporting */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">Recent Shifts</h3>
          </div>
          
          <div className="space-y-4">
            {shifts.length > 0 ? (
              shifts.map(shift => {
                const report = getReportForShift(shift.id);
                return (
                  <motion.div
                    key={shift.id}
                    layoutId={shift.id}
                    className={cn(
                      "p-5 rounded-[2rem] border-2 transition-all group relative overflow-hidden",
                      report 
                        ? "bg-slate-50 border-slate-100 opacity-80" 
                        : "bg-white border-white shadow-xl shadow-indigo-500/5 hover:border-indigo-200 hover:scale-[1.02]"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">{shift.type} Protocol</p>
                        <h4 className="text-sm font-black text-slate-900 mt-1">{safeFormat(shift.startTime, 'EEEE, MMM dd')}</h4>
                      </div>
                      {report ? (
                        <div className="p-1 px-3 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-1.5 animate-in slide-in-from-right duration-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Logged</span>
                        </div>
                      ) : (
                        <div className="p-1 px-3 bg-amber-50 text-amber-600 rounded-full flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Pending</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 mb-5">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 tracking-tighter">
                          {safeFormat(shift.startTime, 'HH:mm')} - {safeFormat(shift.endTime, 'HH:mm')}
                        </span>
                      </div>
                      <div className="w-1 h-1 bg-slate-200 rounded-full" />
                      <div className="flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-500 tracking-tighter uppercase">{shift.status}</span>
                      </div>
                    </div>

                    {!report ? (
                      <button 
                        onClick={() => {
                          setSelectedShift(shift);
                          setIsSubmitModalOpen(true);
                        }}
                        className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
                      >
                        Submit Report
                      </button>
                    ) : (
                      <button 
                        onClick={() => setViewingReport(report)}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                      >
                        View Log
                      </button>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                 <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-relaxed">No shifts available for reporting.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Report History Feed */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between px-1">
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Output Feed</h3>
             <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filter: Latest 100</span>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {reports.length > 0 ? (
              reports.map(report => (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setViewingReport(report)}
                  className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm">
                          {report.employeeName.charAt(0)}
                       </div>
                       <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{report.employeeName}</h4>
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{report.shiftType} Shift</p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 mt-0.5">{safeFormat(report.shiftDate, 'MMMM dd, yyyy')}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Submission ID: SS-{report.id.slice(0, 6).toUpperCase()}</p>
                       <div className="px-3 py-1 bg-slate-50 text-slate-500 rounded-full text-[8px] font-black uppercase tracking-widest">
                          {safeFormat(report.submittedAt, 'MM/dd HH:mm')}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex gap-4">
                        <div className="w-8 shrink-0 flex flex-col items-center gap-2">
                           <div className="w-6 h-6 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                           </div>
                           <div className="w-px h-full bg-slate-100" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Direct Output</p>
                           <p className="text-xs text-slate-600 leading-relaxed font-medium line-clamp-2">{report.tasksCompleted}</p>
                        </div>
                     </div>
                     
                     {report.issuesEncountered && (
                       <div className="flex gap-4">
                          <div className="w-8 shrink-0 flex flex-col items-center">
                             <div className="w-6 h-6 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center">
                                <AlertCircle className="w-3.5 h-3.5" />
                             </div>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1.5">Anomalies Detected</p>
                             <p className="text-xs text-rose-600/70 leading-relaxed font-medium line-clamp-1">{report.issuesEncountered}</p>
                          </div>
                       </div>
                     )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                     <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                        <History className="w-3 h-3" />
                        Complete Audit Available
                     </p>
                     <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="p-24 text-center bg-white rounded-[3rem] border border-slate-100">
                 <div className="w-16 h-16 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                    <FileText className="w-8 h-8 text-slate-200" />
                 </div>
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-2">System Sync Offline</h3>
                 <p className="text-xs font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">No reports have been submitted for the current audit window. Log your first output to begin synchronization.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submission Modal */}
      <AnimatePresence>
        {isSubmitModalOpen && selectedShift && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsSubmitModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSubmitReport}>
                <div className="p-8 bg-indigo-600 text-white relative">
                   <button 
                     type="button"
                     onClick={() => setIsSubmitModalOpen(false)}
                     className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors"
                   >
                     <X className="w-5 h-5" />
                   </button>
                   <div className="flex items-center gap-4 mb-4">
                      <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-xl">
                         <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black tracking-tight uppercase">Operational Debrief</h3>
                        <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-widest">Logging for {safeFormat(selectedShift.startTime, 'MMM dd, yyyy')}</p>
                      </div>
                   </div>
                </div>

                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Primary Tasks & Throughput</label>
                    <textarea 
                      name="tasks" 
                      required
                      placeholder="List your completed objectives and milestones from this shift..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[150px] resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1">Anomalies & Complications</label>
                      <textarea 
                        name="issues" 
                        placeholder="Any equipment failure, delays, or safety concerns..."
                        className="w-full px-6 py-4 bg-rose-50/30 border border-rose-100 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all min-h-[100px] resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Handover Directives</label>
                      <textarea 
                        name="handover" 
                        placeholder="Critical notes for the incoming shift replacement..."
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all min-h-[100px] resize-none"
                      />
                    </div>
                  </div>
                  
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-[2.5rem] flex gap-4">
                     <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0" />
                     <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed uppercase tracking-tight">
                        Ensure all logs are accurate. Once submitted, these records enter the immutable operational ledger for managerial audit.
                     </p>
                  </div>
                </div>

                <div className="p-8 bg-slate-50 flex gap-4">
                   <button 
                     type="button"
                     onClick={() => setIsSubmitModalOpen(false)}
                     className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                     type="submit"
                     disabled={submitting}
                     className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95 flex items-center justify-center gap-3"
                   >
                     {submitting ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                     ) : (
                        <Send className="w-3.5 h-3.5" />
                     )}
                     Finalize Submission
                   </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Detail View Modal */}
      <AnimatePresence>
        {viewingReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setViewingReport(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[3.5rem] shadow-2xl overflow-hidden"
            >
               <div className="p-10 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white">
                       <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Shift Report Analysis</h3>
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mt-1">Ref ID: {viewingReport.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setViewingReport(null)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors">
                     <X className="w-6 h-6 text-slate-400" />
                  </button>
               </div>

               <div className="p-10 space-y-12 max-h-[60vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Asset Information</p>
                      <p className="text-sm font-black text-slate-900">{viewingReport.employeeName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational Date</p>
                      <p className="text-sm font-black text-slate-900">{safeFormat(viewingReport.shiftDate, 'MMM dd, yyyy')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Protocol Sequence</p>
                      <p className="text-sm font-black text-indigo-600 uppercase">{viewingReport.shiftType}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                           <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Throughput Summary</h4>
                        </div>
                        <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                           <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{viewingReport.tasksCompleted}</p>
                        </div>
                     </div>

                     {viewingReport.issuesEncountered && (
                       <div className="space-y-4">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 bg-rose-500 rounded-full" />
                             <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Anomalies & Blockers</h4>
                          </div>
                          <div className="p-8 bg-rose-50 border border-rose-100 rounded-[2.5rem]">
                             <p className="text-sm text-rose-800 leading-relaxed font-medium whitespace-pre-wrap">{viewingReport.issuesEncountered}</p>
                          </div>
                       </div>
                     )}

                     {viewingReport.handoverNotes && (
                       <div className="space-y-4">
                          <div className="flex items-center gap-3">
                             <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                             <h4 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Sequence Handover Notes</h4>
                          </div>
                          <div className="p-8 bg-indigo-50 border border-indigo-100 rounded-[2.5rem]">
                             <p className="text-sm text-indigo-900 leading-relaxed font-medium whitespace-pre-wrap">{viewingReport.handoverNotes}</p>
                          </div>
                       </div>
                     )}
                  </div>
               </div>

               <div className="p-10 bg-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200">
                        <History className="w-5 h-5 text-slate-400" />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transmission Status</p>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Verified by System Audit</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-3">
                     <button 
                      onClick={() => setViewingReport(null)}
                      className="px-8 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95"
                     >
                        Confirm Receipt
                     </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
