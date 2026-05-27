import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Info,
  Clock,
  History,
  FileBadge,
  RefreshCw,
  AlertCircle,
  X,
  Check,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, where, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { Trash2, Edit2 } from 'lucide-react';
import { CustomSelect } from '../components/CustomSelect';
import { Shift, TimeOffRequest } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function TimeOff() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [formLeaveCategory, setFormLeaveCategory] = useState('Annual Leave');

  const isManager = ['manager', 'admin', 'super_admin'].includes(user?.appData?.role?.toLowerCase() || '');

  useEffect(() => {
    if (!user) return;
    
    const q = isManager 
      ? query(collection(db, 'timeOffRequests'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'timeOffRequests'), where('employeeId', '==', user.uid));
      
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeOffRequest)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'timeOffRequests');
    });

    const unsubShifts = onSnapshot(collection(db, 'shifts'), (snap) => {
      setShifts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => {
      unsubscribe();
      unsubShifts();
    };
  }, [user, isManager]);

  const conflicts = useMemo(() => {
    const list: { requestId: string; shiftId: string; date: string; employeeName: string }[] = [];
    
    requests.filter(r => r.status === 'approved').forEach(req => {
      const start = parseISO(req.startDate);
      const end = parseISO(req.endDate);

      const employeeShifts = shifts.filter(s => 
        (s.employeeId === req.employeeId || s.employeeName === req.employeeName) && 
        s.status !== 'canceled'
      );

      employeeShifts.forEach(shift => {
        const shiftDate = parseISO(shift.startTime);
        if (shiftDate >= start && shiftDate <= end) {
          list.push({
            requestId: req.id,
            shiftId: shift.id,
            date: format(shiftDate, 'MMM dd'),
            employeeName: req.employeeName
          });
        }
      });
    });

    return list;
  }, [requests, shifts]);

  const handleSyncProtocol = async () => {
    if (!isManager) return;
    setIsSyncing(true);
    try {
      let canceledCount = 0;
      for (const conflict of conflicts) {
        await updateDoc(doc(db, 'shifts', conflict.shiftId), {
          status: 'canceled',
          updatedAt: new Date().toISOString(),
          notes: `Auto-canceled: Overlaps with approved Time-Off request.`
        });
        canceledCount++;
      }
      alert(`Sync Complete: ${canceledCount} conflicting shifts were neutralized.`);
    } catch (error) {
      console.error("Sync failed:", error);
      alert("Leave synchronization failed.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'timeOffRequests', requestId), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `timeOffRequests/${requestId}`);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(prev => prev === id ? null : prev), 4000);
      return;
    }

    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'timeOffRequests', id));
    } catch (error: any) {
      alert('Delete failed: ' + (error.message || 'Check your permissions'));
      console.error(error);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleEditClick = (req: any) => {
    setEditingRequest(req);
    setFormLeaveCategory(req?.type || 'Annual Leave');
    setIsModalOpen(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reqData = {
      employeeId: editingRequest ? editingRequest.employeeId : (user?.uid || 'anonymous'),
      employeeName: editingRequest ? editingRequest.employeeName : (user?.appData?.name || user?.displayName || 'Unknown'),
      type: formData.get('type'),
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      reason: formData.get('reason'),
      status: editingRequest ? editingRequest.status : 'pending',
      createdAt: editingRequest ? editingRequest.createdAt : new Date().toISOString()
    };
    
    try {
      if (editingRequest) {
        await updateDoc(doc(db, 'timeOffRequests', editingRequest.id), reqData);
      } else {
        await addDoc(collection(db, 'timeOffRequests'), reqData);
      }
      setIsModalOpen(false);
      setEditingRequest(null);
      setActiveTab('active');
    } catch (error) {
      handleFirestoreError(error, editingRequest ? OperationType.UPDATE : OperationType.CREATE, 'timeOffRequests');
    }
  };

  const calculateRequestDays = (startDateStr: string, endDateStr: string) => {
    try {
      const start = new Date(startDateStr);
      const end = new Date(endDateStr);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    } catch (error) {
      return 0;
    }
  };

  const myRequests = useMemo(() => {
    return requests.filter(r => r.employeeId === user?.uid);
  }, [requests, user]);

  const usedAnnual = useMemo(() => {
    return myRequests
      .filter((r: any) => r.status === 'approved' && r.type === 'Annual Leave')
      .reduce((sum, r) => sum + calculateRequestDays(r.startDate, r.endDate), 0);
  }, [myRequests]);

  const usedSick = useMemo(() => {
    return myRequests
      .filter((r: any) => r.status === 'approved' && r.type === 'Sick Leave')
      .reduce((sum, r) => sum + calculateRequestDays(r.startDate, r.endDate), 0);
  }, [myRequests]);

  const usedPersonal = useMemo(() => {
    return myRequests
      .filter((r: any) => r.status === 'approved' && r.type === 'Personal Leave')
      .reduce((sum, r) => sum + calculateRequestDays(r.startDate, r.endDate), 0);
  }, [myRequests]);

  const totalAnnual = 15;
  const totalSick = 5;
  const totalPersonal = 2;

  const remainingAnnual = Math.max(0, totalAnnual - usedAnnual);
  const remainingSick = Math.max(0, totalSick - usedSick);
  const remainingPersonal = Math.max(0, totalPersonal - usedPersonal);

  const policies = [
    { label: 'Annual Leave', available: `${remainingAnnual.toFixed(1)} / ${totalAnnual} Days`, color: 'bg-indigo-500', icon: CalendarIcon },
    { label: 'Sick Leave', available: `${remainingSick.toFixed(1)} / ${totalSick} Days`, color: 'bg-emerald-500', icon: Info },
    { label: 'Personal Leave', available: `${remainingPersonal.toFixed(1)} / ${totalPersonal} Days`, color: 'bg-rose-500', icon: Clock },
  ];

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 md:gap-10">
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
             <h2 className="text-3xl md:text-[2.5rem] font-black text-slate-900 tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600">
              Absence Protocol
            </h2>
            <div className="flex items-center gap-3 mt-3">
               <p className="text-slate-500 font-medium text-sm md:text-lg">Leave Entitlement & Requests</p>
               <span className="w-1.5 h-1.5 bg-slate-300 rounded-full shrink-0" />
               <p className="text-indigo-600 font-black text-[10px] md:text-sm uppercase tracking-widest">{requests.length} Total Logs</p>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
          {isManager && conflicts.length > 0 && (
            <button 
              onClick={handleSyncProtocol}
              disabled={isSyncing}
              className="flex items-center justify-center px-6 py-4 bg-rose-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-xl shadow-rose-100 active:scale-95 w-full sm:w-auto border border-rose-500"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isSyncing && "animate-spin")} />
              Sync Protocol ({conflicts.length})
            </button>
          )}
          <button 
            onClick={() => {
              setEditingRequest(null);
              setFormLeaveCategory('Annual Leave');
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center px-6 md:px-10 py-4 md:py-5 bg-indigo-600 text-white rounded-[1.5rem] md:rounded-[1.8rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] hover:bg-indigo-700 transition-all shadow-[0_20px_40px_-12px_rgba(244,121,32,0.3)] active:scale-95 group shrink-0 w-full xl:w-auto"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-3 group-hover:rotate-90 transition-transform" />
            Initialize Request
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
              <p className="text-xs text-rose-600 font-medium mt-1">There are {conflicts.length} shifts scheduled during approved time-off periods. Sync to neutralize.</p>
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

      {/* Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {policies.map((p) => (
          <div key={p.label} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all border-b-8 shadow-inner" style={{ borderBottomColor: p.color === 'bg-indigo-500' ? '#f47920' : p.color === 'bg-emerald-500' ? '#10b981' : '#f43f5e' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{p.label}</p>
                <p className="text-3xl font-black text-slate-900">{p.available}</p>
              </div>
              <div className={cn("p-2.5 rounded-xl text-white shadow-lg", p.color)}>
                <p.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-8 flex items-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
              <Info className="w-3 h-3 mr-1.5 opacity-50" />
              Next accrual: 12 days
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-8 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
        <div className="flex space-x-8 border-b border-slate-100">
          <button 
            onClick={() => setActiveTab('active')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 relative",
              activeTab === 'active' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            Active Requests
            {activeTab === 'active' && <motion.div layoutId="tab" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-indigo-600" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={cn(
              "pb-4 text-xs font-black uppercase tracking-widest transition-all border-b-2 relative",
              activeTab === 'history' ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-400 hover:text-slate-600"
            )}
          >
            History
            {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-indigo-600" />}
          </button>
        </div>

        <div className="py-6">
          {requests.filter(r => activeTab === 'active' ? r.status === 'pending' : r.status !== 'pending').length > 0 ? (
            <div className="space-y-4">
              {requests.filter(r => activeTab === 'active' ? r.status === 'pending' : r.status !== 'pending').map((req) => (
                <div key={req.id} className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:bg-white hover:shadow-xl group/item">
                  <div className="flex items-center space-x-4 md:space-x-6">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-slate-400">
                      <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-900">{req.startDate} – {req.endDate}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">{req.employeeName} • {req.type} • {req.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between md:justify-end gap-3 md:gap-4 grow">
                    {req.status === 'pending' && (user?.uid === req.employeeId || isManager) && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleEditClick(req)}
                          className="p-3 bg-white text-slate-400 hover:text-indigo-600 rounded-xl transition-all border border-slate-100 shadow-sm"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRequest(req.id)}
                          disabled={deletingId === req.id}
                          className={cn(
                            "h-10 px-3 rounded-xl transition-all shadow-sm border flex items-center justify-center",
                            deletingId === req.id 
                              ? "bg-slate-100 text-slate-300 cursor-wait min-w-[40px]"
                              : confirmDeleteId === req.id
                                ? "bg-rose-600 text-white border-rose-600 shadow-md px-4"
                                : "bg-white text-slate-400 hover:text-rose-600 border-slate-100 min-w-[40px]"
                          )}
                          title={confirmDeleteId === req.id ? "Click again to confirm" : "Delete"}
                        >
                          {confirmDeleteId === req.id ? (
                            <div className="flex items-center gap-1.5">
                               <Trash2 className="w-3 h-3" />
                               <span className="text-[8px] font-black uppercase tracking-tighter">Confirm</span>
                            </div>
                          ) : (
                            <Trash2 className={cn("w-3.5 h-3.5", deletingId === req.id && "animate-spin")} />
                          )}
                        </button>
                      </div>
                    )}
                    {isManager && req.status === 'pending' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(req.id, 'approved')}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(req.id, 'rejected')}
                          className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase shadow-lg shadow-rose-100 hover:bg-rose-700 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                    <span className={cn(
                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm",
                      req.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" : 
                      req.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      "bg-rose-50 text-rose-600 border-rose-100"
                    )}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner group transition-transform hover:scale-110">
                <CalendarIcon className="w-10 h-10 text-slate-200 group-hover:text-indigo-200 transition-colors" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">No {activeTab} requests</h3>
              <p className="text-slate-400 mt-2 max-w-sm mx-auto text-sm font-medium">
                All your {activeTab} absences will appear here.
              </p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-8 px-6 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
              >
                Send New Request
              </button>
            </div>
          )}
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-8 bg-slate-950 text-white flex items-center justify-between border-b border-white/10">
              <div>
                 <h3 className="text-xl font-black tracking-tight uppercase">{editingRequest ? 'Modify Leave Request' : 'Configure Leave'}</h3>
                 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Submit Absence Request</p>
              </div>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingRequest(null);
                }} 
                className="p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="p-8 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Leave Category</label>
                <CustomSelect 
                  value={formLeaveCategory}
                  onChange={(val) => setFormLeaveCategory(val)}
                  options={['Annual Leave', 'Sick Leave', 'Personal Leave']}
                />
                <input type="hidden" name="type" value={formLeaveCategory} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Start Date</label>
                  <input 
                    name="startDate" 
                    type="date" 
                    required 
                    defaultValue={editingRequest?.startDate} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">End Date</label>
                  <input 
                    name="endDate" 
                    type="date" 
                    required 
                    defaultValue={editingRequest?.endDate} 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Reason / Justification</label>
                <textarea 
                  name="reason" 
                  placeholder="e.g. Flight itinerary, scheduled medical procedure..." 
                  rows={3} 
                  required
                  defaultValue={editingRequest?.reason} 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[100px] resize-none" 
                />
              </div>
              <div className="pt-4 flex gap-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingRequest(null);
                  }} 
                  className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                >
                  {editingRequest ? 'Update Request' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Policy card */}
      <div className="bg-indigo-950 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-10 blur-xl">
          <FileBadge className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-lg">
             <FileBadge className="w-6 h-6 text-indigo-300" />
          </div>
          <h3 className="text-2xl font-black mb-4 tracking-tight">Attendance Policy V4.2</h3>
          <p className="text-indigo-100/70 leading-relaxed mb-8 font-medium">
            Our company values work-life balance and fair scheduling. Please review the employee handbook 
            for full details on leave accrual, emergency absences, and holiday pay policies.
          </p>
          <button className="px-8 py-4 bg-white text-indigo-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all shadow-xl active:scale-95">
            Open Handbook (PDF)
          </button>
        </div>
      </div>
    </div>
  );
}
