import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { 
   ArrowRightLeft, 
   Plus, 
   Search, 
   History,
   AlertCircle,
   MoreHorizontal, 
   Trash2, 
   Edit2, 
   User as UserIcon, 
   Repeat, 
   Check
} from 'lucide-react';
import { cn, hasPermission } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, Timestamp, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { CustomSelect } from '../components/CustomSelect';

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

export default function SwapBoard() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [requestRequesterDetails, setRequestRequesterDetails] = useState<any>(null);
  const [openRequests, setOpenRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [formType, setFormType] = useState('Swap');
  const [formTargetEmployeeId, setFormTargetEmployeeId] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'open' | 'history'>('open');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [offeringRequest, setOfferingRequest] = useState<any>(null);
  const [offerMessage, setOfferMessage] = useState('');

  const filteredRequests = openRequests.filter(req => {
    if (activeTab === 'open') {
      return req.status === 'pending' || req.status === 'responded';
    } else {
      return req.status === 'completed' || req.status === 'rejected';
    }
  });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'swapRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOpenRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'swapRequests');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching employees:", error);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!selectedRequest) {
      setRequestRequesterDetails(null);
      return;
    }
    // Update selectedRequest if the document in openRequests changes
    const updated = openRequests.find(r => r.id === selectedRequest.id);
    if (updated && JSON.stringify(updated) !== JSON.stringify(selectedRequest)) {
      setSelectedRequest(updated);
    }

    const requester = employees.find(e => e.id === selectedRequest.requesterId || e.uid === selectedRequest.requesterId);
    if (requester) {
      setRequestRequesterDetails(requester);
    }
  }, [selectedRequest, employees, openRequests]);

  const handlePostShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const reqData = {
      requesterId: selectedEmployeeId || user?.uid || 'anonymous',
      requesterName: selectedEmployeeName || user?.appData?.name || user?.displayName || 'Unknown',
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      department: formData.get('department') as string || config.departments[0],
      type: formData.get('type') as string,
      status: editingRequest ? editingRequest.status : 'pending',
      targetEmployeeId: formData.get('targetEmployeeId') as string || null,
      targetEmployeeName: formData.get('targetEmployeeName') as string || null,
      message: formData.get('message') as string || '',
      createdAt: editingRequest ? editingRequest.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    try {
      if (editingRequest) {
        await updateDoc(doc(db, 'swapRequests', editingRequest.id), reqData);
        if (editingRequest.originalShiftId) {
          await updateDoc(doc(db, 'shifts', editingRequest.originalShiftId), {
            swapStatus: reqData.status === 'completed' ? 'approved' : reqData.status === 'rejected' ? 'declined' : 'pending',
            swapTargetId: reqData.targetEmployeeId,
            swapTargetName: reqData.targetEmployeeName
          });
        }
      } else {
        const docRef = await addDoc(collection(db, 'swapRequests'), reqData);
        
        // Notify target employee if specified
        if (reqData.targetEmployeeId) {
          await createNotification(
            reqData.targetEmployeeId,
            'Direct Shift Request',
            `${reqData.requesterName} has requested you specifically for a ${reqData.type.toLowerCase()} on ${reqData.date}.`,
            'swap_request'
          );
        }
      }
      resetModal();
    } catch (error) {
      handleFirestoreError(error, editingRequest ? OperationType.UPDATE : OperationType.CREATE, 'swapRequests');
    }
  };

  const handleDeleteRequest = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this swap request?')) return;
    
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'swapRequests', id));
    } catch (error: any) {
      alert('Delete failed: ' + (error.message || 'Check your permissions'));
      console.error(error);
    } finally {
      setDeletingId(null);
    }
  };

  const resetModal = () => {
    setIsAddModalOpen(false);
    setEditingRequest(null);
    setSelectedEmployeeId('');
    setSelectedEmployeeName('');
    setFormType('Swap');
    setFormTargetEmployeeId('');
  };

  const handleCreateClick = () => {
    resetModal();
    if (user) {
      setSelectedEmployeeId(user.uid);
      setSelectedEmployeeName(user.appData?.name || user.displayName || '');
    }
    setIsAddModalOpen(true);
  };

  const handleEditClick = (req: any) => {
    setEditingRequest(req);
    setSelectedEmployeeId(req.requesterId);
    setSelectedEmployeeName(req.requesterName);
    setFormType(req.type || 'Swap');
    setFormTargetEmployeeId(req.targetEmployeeId || '');
    setIsAddModalOpen(true);
  };

  const createNotification = async (userId: string, title: string, message: string, type: 'shift_change' | 'swap_request' | 'time_off_approval') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const handleOfferTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !offeringRequest) return;
    try {
      const autoApprove = config.rosterRules?.autoApproveSwaps || false;
      const newStatus = autoApprove ? 'completed' : 'responded';
      
      await updateDoc(doc(db, 'swapRequests', offeringRequest.id), {
        status: newStatus,
        targetEmployeeId: user.uid,
        targetEmployeeName: user.appData?.name || user.displayName || 'Unknown',
        targetMessage: offerMessage,
        updatedAt: new Date().toISOString()
      });

      // Notify requester
      await createNotification(
        offeringRequest.requesterId,
        'New Swap Offer',
        `${user.appData?.name || user.displayName} has offered to ${offeringRequest.type.toLowerCase()} your shift on ${offeringRequest.date}.`,
        'swap_request'
      );

      setIsOfferModalOpen(false);
      setOfferMessage('');
      setOfferingRequest(null);
      
      if (autoApprove) {
        alert(`Trade with ${offeringRequest.requesterName} has been auto-approved!`);
      } else {
        alert(`Offered trade to ${offeringRequest.requesterName}. Waiting for their acceptance.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `swapRequests/${offeringRequest.id}`);
    }
  };

  const handleAcceptOffer = async (requestId: string) => {
    const req = openRequests.find(r => r.id === requestId);
    if (!req || !user) return;
    
    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'accepted',
        updatedAt: new Date().toISOString()
      });

      // Update shift if it exists
      if (req.originalShiftId) {
        await updateDoc(doc(db, 'shifts', req.originalShiftId), {
          swapStatus: 'pending', // requester accepted, still pending manager approval
          swapTargetId: req.targetEmployeeId,
          swapTargetName: req.targetEmployeeName
        });
      }

      // Notify the offerer
      if (req.targetEmployeeId) {
        await createNotification(
          req.targetEmployeeId,
          'Offer Accepted',
          `${user.appData?.name || user.displayName} has accepted your swap offer for ${req.date}. Waiting for manager approval.`,
          'swap_request'
        );
      }

      // Notify managers
      const managers = employees.filter(e => ['manager', 'admin', 'super_admin'].includes(e.role?.toLowerCase() || ''));
      for (const manager of managers) {
        await createNotification(
          manager.id || manager.uid,
          'Swap Awaiting Approval',
          `${req.requesterName} and ${req.targetEmployeeName} have agreed to a swap for ${req.date}.`,
          'swap_request'
        );
      }

      alert("Offer accepted. It has been sent to the manager for final tactical approval.");
      if (selectedRequest?.id === requestId) {
        setSelectedRequest({ ...req, status: 'accepted' });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `swapRequests/${requestId}`);
    }
  };

  const handleStatusUpdate = async (requestId: string, status: 'pending' | 'completed' | 'rejected') => {
    try {
      const req = openRequests.find(r => r.id === requestId);
      await updateDoc(doc(db, 'swapRequests', requestId), { status });
      
      if (req) {
        if (req.originalShiftId) {
          const shiftUpdate: any = {
            swapStatus: status === 'completed' ? 'approved' : status === 'rejected' ? 'declined' : 'pending'
          };
          
          // If manager approves (completed), actually swap the person on the shift
          if (status === 'completed' && req.targetEmployeeId) {
            shiftUpdate.employeeId = req.targetEmployeeId;
            shiftUpdate.employeeName = req.targetEmployeeName;
            shiftUpdate.status = 'swapped';
          }
          
          await updateDoc(doc(db, 'shifts', req.originalShiftId), shiftUpdate);
        }

        // Notify both parties if completed or rejected
        const parties = [req.requesterId, req.targetEmployeeId].filter(id => id);
        for (const partyId of parties) {
          await createNotification(
            partyId!,
            status === 'completed' ? 'Swap Approved' : 'Swap Request Updated',
            `Your swap request for ${req.date} has been ${status === 'completed' ? 'approved' : 'returned to pending'}.`,
            'swap_request'
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `swapRequests/${requestId}`);
    }
  };

  const handleCancelOffer = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'swapRequests', requestId), {
        status: 'pending',
        targetEmployeeId: null,
        targetEmployeeName: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `swapRequests/${requestId}`);
    }
  };

  const isManager = hasPermission(user, config, 'canApproveSwaps');

  return (
    <div className="space-y-12">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-10">
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
             <h2 className="text-3xl md:text-[2.75rem] font-black text-slate-900 tracking-tighter leading-none text-transparent bg-clip-text bg-gradient-to-br from-slate-950 via-slate-800 to-indigo-900">
              Trade Nexus
            </h2>
            <div className="flex items-center gap-3 mt-4">
               <div className="flex -space-x-1">
                 {[1,2,3].map(i => (
                   <div key={i} className="w-5 h-5 rounded-full border-2 border-white bg-slate-200" />
                 ))}
               </div>
               <p className="text-slate-500 font-bold text-base">Network Intelligence</p>
               <span className="w-1.5 h-1.5 bg-indigo-200 rounded-full" />
               <p className="text-indigo-600 font-black text-xs uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">{filteredRequests.length} Active Posts</p>
            </div>
          </motion.div>
          
          <div className="flex p-1.5 bg-slate-50 border border-slate-200/60 rounded-[1.8rem] shadow-inner max-w-xs transition-all hover:border-slate-200">
            <button 
              onClick={() => setActiveTab('open')}
              className={cn(
                "flex-1 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                activeTab === 'open' ? "bg-white text-indigo-600 shadow-xl shadow-indigo-500/10" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Open Market
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300",
                activeTab === 'history' ? "bg-white text-indigo-600 shadow-xl shadow-indigo-500/10" : "text-slate-400 hover:text-slate-600"
              )}
            >
              Log History
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 sm:w-80 group">
             <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
             <input 
                type="text" 
                placeholder="Search requests..."
                className="w-full pl-14 pr-6 py-4 md:py-4.5 bg-white border-2 border-slate-200 rounded-[1.5rem] md:rounded-[1.8rem] text-sm font-black focus:outline-none focus:ring-8 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm group-hover:border-slate-300"
             />
          </div>
          <button 
            onClick={handleCreateClick}
            className="flex items-center justify-center px-6 md:px-10 py-4 md:py-4.5 bg-indigo-600 text-white rounded-[1.5rem] md:rounded-[1.8rem] text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.25em] hover:bg-indigo-700 transition-all shadow-[0_20px_40px_-12px_rgba(244,121,32,0.3)] active:scale-95 group shrink-0"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5 mr-3 group-hover:rotate-90 transition-transform" />
            Post Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredRequests.map((req) => (
          <div key={req.id} className="group relative bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800/60 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 p-8">
            <div className="flex items-start justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-[1.25rem] bg-indigo-600 ring-4 ring-slate-50 dark:ring-slate-950 transition-all duration-500 group-hover:scale-110 group-hover:-rotate-3 shadow-[0_10px_20px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-800/55 flex items-center justify-center text-white font-black text-xl">
                  {req.requesterName.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-slate-950 dark:text-white text-lg leading-tight">{req.requesterName}</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{req.department || req.dept}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(user?.uid === req.requesterId || isManager) && (
                  <div className="flex items-center gap-2 relative z-30">
                    <button 
                      type="button"
                      onClick={() => handleEditClick(req)}
                      className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-850 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-100 dark:hover:border-slate-800"
                      title="Edit Request"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="flex flex-col items-end gap-2">
                  <span className={cn(
                    "px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-xl border-2",
                    req.status === 'completed' && "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30",
                    req.status === 'rejected' && "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30",
                    req.status === 'responded' && "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30",
                    req.status === 'pending' && "bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30"
                  )}>
                    {req.status === 'completed' ? 'COMPLETE' : req.status === 'rejected' ? 'REJECTED' : req.type === 'Cover' ? 'Needs Cover' : 'SWAP'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex flex-col p-5 bg-slate-50 dark:bg-slate-950 rounded-[1.5rem] border border-slate-100 dark:border-slate-800/40 group-hover:bg-indigo-50/50 group-hover:dark:bg-indigo-950/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-3 gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Shift Date</span>
                  <span className="text-sm font-black text-slate-900 group-hover:text-indigo-900 dark:text-white transition-colors uppercase truncate">{req.date}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Timing</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums truncate">{req.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "px-2 py-1 text-[8px] font-black rounded-lg uppercase tracking-widest",
                  req.status === 'pending' && "bg-slate-100 text-slate-500",
                  req.status === 'responded' && "bg-amber-100 text-amber-600",
                  req.status === 'accepted' && "bg-blue-100 text-blue-600",
                  req.status === 'completed' && "bg-emerald-100 text-emerald-600"
                )}>
                  Status: {req.status}
                </span>
                {req.status === 'accepted' && (
                  <span className="text-[8px] font-black text-indigo-600 animate-pulse uppercase tracking-widest">Awaiting Manager</span>
                )}
              </div>
              {req.message && (
                <div className="mt-3 px-4 py-2 bg-indigo-50/50 rounded-xl text-[10px] font-medium text-slate-600 italic border border-indigo-100/50 truncate">
                  "{req.message}"
                </div>
              )}
              {req.targetEmployeeId && req.status === 'pending' && (
                <div className={cn(
                  "mt-3 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-2",
                  user?.uid === req.targetEmployeeId 
                    ? "bg-indigo-600 text-white border-indigo-700 animate-pulse" 
                    : "bg-amber-50 text-amber-700 border-amber-100"
                )}>
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user?.uid === req.targetEmployeeId ? 'DIRECT REQUEST FOR YOU' : `Direct Request for ${req.targetEmployeeName}`}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRequest(req);
                }}
                className="py-4 bg-slate-50 dark:bg-slate-950 dark:text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] hover:bg-white hover:dark:bg-slate-850 hover:shadow-xl border border-slate-100 dark:border-slate-800 transition-all active:scale-95 relative z-10"
              >
                Details
              </button>

               <div className="flex gap-2">
                {isManager && (req.status === 'responded' || req.status === 'accepted') ? (
                  <div className="grid grid-cols-2 gap-1 w-full">
                    <button 
                      onClick={() => handleStatusUpdate(req.id, 'completed')}
                      className="py-4 bg-emerald-600 text-white rounded-2xl text-[8px] font-black uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleStatusUpdate(req.id, 'pending')}
                      className="py-4 bg-rose-600 text-white rounded-2xl text-[8px] font-black uppercase hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 flex items-center justify-center"
                    >
                      Deny
                    </button>
                  </div>
                ) : req.status === 'responded' && req.requesterId === user?.uid ? (
                  <button 
                    onClick={() => handleAcceptOffer(req.id)}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Accept Offer
                  </button>
                ) : req.status === 'pending' && req.requesterId !== user?.uid ? (
                  <button 
                    onClick={() => {
                      setOfferingRequest(req);
                      setIsOfferModalOpen(true);
                    }}
                    className={cn(
                      "w-full py-4 text-white rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-1.5",
                      req.type === 'Cover' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    {req.type === 'Cover' ? <Check className="w-3.5 h-3.5" /> : <Repeat className="w-3.5 h-3.5" />}
                    {req.type === 'Cover' ? 'Accept Shift' : 'Trade'}
                  </button>
                ) : req.status === 'pending' && req.requesterId === user?.uid ? (
                  <div className="w-full py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest rounded-2xl animate-pulse flex items-center justify-center">
                    Yours
                  </div>
                ) : req.status === 'responded' ? (
                  <div className="flex w-full gap-1">
                     <div className="flex-1 text-center text-[7px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-2xl py-4 border border-amber-100 dark:border-amber-900/30 flex items-center justify-center gap-1 truncate">
                        {user?.uid === req.targetEmployeeId ? 'Sent' : 'Recv'}
                     </div>
                     {(user?.uid === req.targetEmployeeId || user?.uid === req.requesterId || isManager) && (
                       <button 
                         onClick={() => handleCancelOffer(req.id)}
                         className="px-2 py-4 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-2xl text-[9px] font-black uppercase border border-amber-100 dark:border-amber-900/30 hover:bg-amber-600 hover:text-white transition-all flex items-center justify-center"
                       >
                         <Plus className="w-3.5 h-3.5 rotate-45" />
                       </button>
                     )}
                  </div>
                ) : (
                  <div className="w-full py-4 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest rounded-2xl flex items-center justify-center gap-1.5 truncate">
                    {req.status.toUpperCase()}
                  </div>
                )}
              </div>

              {(user?.uid === req.requesterId || isManager) && (
                 <button 
                   onClick={(e) => handleDeleteRequest(e, req.id)}
                   className={cn(
                     "col-span-2 py-4 rounded-2xl transition-all duration-300 flex items-center justify-center border-2",
                     deletingId === req.id 
                       ? "bg-slate-100 border-slate-200 text-slate-300 cursor-wait" 
                       : "bg-white border-slate-100 text-rose-500 hover:bg-rose-600 hover:text-white hover:border-rose-600 shadow-sm"
                   )}
                   disabled={deletingId === req.id}
                 >
                   <Trash2 className={cn("w-4 h-4 mr-2", deletingId === req.id && "animate-spin")} />
                   <span className="text-[9px] font-black uppercase tracking-widest">Delete Request</span>
                 </button>
              )}
            </div>
          </div>
        ))}
        
        {filteredRequests.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 flex flex-col items-center justify-center p-20 bg-slate-50/50 rounded-[3rem] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              {activeTab === 'open' ? <ArrowRightLeft className="w-10 h-10 text-slate-300" /> : <History className="w-10 h-10 text-slate-300" />}
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">No {activeTab === 'open' ? 'active' : 'previous'} requests</h3>
            <p className="text-slate-500 font-medium text-center max-w-xs">
              {activeTab === 'open' 
                ? "There are currently no shifts up for trade on the board." 
                : "Your completed and rejected trades will appear here."}
            </p>
          </div>
        )}
        
        {activeTab === 'open' && (
          <button 
            onClick={handleCreateClick}
            className="group border-2 border-dashed border-slate-200 rounded-[2rem] p-10 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:bg-indigo-50/20 transition-all duration-300"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-indigo-100 transition-all shadow-sm">
              <ArrowRightLeft className="w-8 h-8 group-hover:text-indigo-600" />
            </div>
            <p className="font-black text-slate-900 text-lg uppercase tracking-tight">Post a Shift</p>
            <p className="text-xs font-bold mt-2 opacity-60">Can't make it? Let the team know.</p>
          </button>
        )}
      </div>

      {isOfferModalOpen && offeringRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOfferModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-8 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-xl text-slate-900">Offer Swap Trade</h3>
              <button 
                onClick={() => setIsOfferModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            
            <div className="p-6 bg-indigo-50 rounded-[2rem] border border-indigo-100 mb-8 flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg">
                {offeringRequest.requesterName.charAt(0)}
              </div>
              <div>
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Requester</p>
                <p className="text-base font-black text-slate-900">{offeringRequest.requesterName}</p>
                <p className="text-xs font-bold text-slate-500">{offeringRequest.date} • {offeringRequest.time}</p>
              </div>
            </div>

            <form onSubmit={handleOfferTrade} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Message to {offeringRequest.requesterName}</label>
                <textarea 
                  value={offerMessage}
                  onChange={(e) => setOfferMessage(e.target.value)}
                  placeholder="e.g. I can pick up this shift! I'm already in the building today anyway."
                  rows={4}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  type="submit"
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Repeat className="w-4 h-4" />
                  Confirm Trade Offer
                </button>
                <button 
                  type="button"
                  onClick={() => setIsOfferModalOpen(false)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetModal} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h3 className="font-black text-xl text-slate-900 mb-6 text-center">{editingRequest ? 'Edit Swap Request' : 'Post Shift for Exchange'}</h3>
            
            <form onSubmit={handlePostShift} className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Employee</label>
                <div className="space-y-4 p-5 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50 shadow-inner">
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                       <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    </div>
                    <input 
                      type="text"
                      placeholder="Type name to find employee..."
                      className="w-full pl-14 pr-10 py-5 bg-white border-2 border-slate-200 rounded-[1.8rem] text-sm font-black text-slate-800 focus:outline-none focus:ring-8 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-xl"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        if (!term) return;
                        const match = employees.find(emp => emp.name.toLowerCase().includes(term));
                        if (match) {
                          setSelectedEmployeeId(match.id || match.uid);
                          setSelectedEmployeeName(match.name);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      value={selectedEmployeeName}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-1">
                    {employees.sort((a,b) => a.name.localeCompare(b.name)).map(emp => (
                      <button
                        key={emp.id || emp.uid}
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId(emp.id || emp.uid);
                          setSelectedEmployeeName(emp.name);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border",
                          (selectedEmployeeId === (emp.id || emp.uid))
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                            : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Shift Date</label>
                  <input name="date" type="text" placeholder="e.g. May 20" defaultValue={editingRequest?.date} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Department</label>
                  <input name="department" type="text" defaultValue={editingRequest?.department || editingRequest?.dept || config.departments[0]} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Timing</label>
                <input name="time" type="text" placeholder="e.g. 09:00 - 17:00" defaultValue={editingRequest?.time} required className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Request Type</label>
                <CustomSelect 
                  value={formType}
                  onChange={(val) => setFormType(val)}
                  options={[
                    { value: 'Swap', label: 'Swap' },
                    { value: 'Cover', label: 'Cover' }
                  ]}
                />
                <input type="hidden" name="type" value={formType} />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Message (Optional)</label>
                <textarea name="message" placeholder="e.g. Appointment in the morning, need someone to cover my first 2 hours." defaultValue={editingRequest?.message} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all min-h-[100px] resize-none" />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Direct Request (Optional)</label>
                <div className="space-y-2">
                   <CustomSelect 
                     value={formTargetEmployeeId}
                     onChange={(val) => setFormTargetEmployeeId(val)}
                     options={[
                       { value: "", label: "Public Request (Everyone)" },
                       ...employees.filter(e => (e.id || e.uid) !== user?.uid).map(emp => ({
                         value: emp.id || emp.uid,
                         label: emp.name
                       }))
                     ]}
                   />
                   <input type="hidden" name="targetEmployeeId" value={formTargetEmployeeId} />
                   <input 
                     type="hidden" 
                     name="targetEmployeeName" 
                     value={
                       formTargetEmployeeId 
                         ? (employees.find(emp => (emp.id || emp.uid) === formTargetEmployeeId)?.name || '') 
                         : ''
                     } 
                   />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button type="button" onClick={resetModal} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                <button type="submit" className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all">
                  {editingRequest ? 'Update Request' : 'Post Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setSelectedRequest(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500">
            <div className="bg-indigo-600 p-12 text-white text-center relative">
              <div className="absolute top-6 right-6">
                <button onClick={() => setSelectedRequest(null)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <div className="w-28 h-28 mx-auto rounded-[2rem] bg-indigo-500/30 flex items-center justify-center border-2 border-white/20 shadow-xl">
                <span className="text-4xl font-black">{selectedRequest.requesterName.charAt(0)}</span>
              </div>
              <h3 className="text-3xl font-black tracking-tight">{selectedRequest.requesterName}</h3>
              <p className="text-indigo-100/60 text-[10px] font-black uppercase tracking-[0.2em] mt-2">{selectedRequest.department || selectedRequest.dept}</p>
            </div>
            
            <div className="p-10 bg-slate-50/50 space-y-8 max-h-[60vh] overflow-y-auto">
              {selectedRequest.targetEmployeeId && (
                <div className="space-y-4 p-8 bg-indigo-50 border-2 border-indigo-100 rounded-[2.5rem] shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-200/20 blur-3xl -mr-16 -mt-16" />
                  <div className="relative flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 shadow-xl border border-indigo-100 shrink-0 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center text-white font-black text-xl">
                      {selectedRequest.targetEmployeeName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <span className="px-2 py-0.5 bg-indigo-600 text-[8px] font-black text-white uppercase tracking-widest rounded-md mb-2 inline-block">Offer From</span>
                      <h4 className="text-xl font-black text-slate-900 leading-tight">{selectedRequest.targetEmployeeName}</h4>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Willing to {selectedRequest.type === 'Cover' ? 'cover this shift' : 'swap shifts'}</p>
                    </div>
                  </div>
                  {selectedRequest.targetMessage && (
                    <div className="relative mt-4 p-4 bg-white/60 rounded-2xl border border-indigo-100 text-[11px] font-medium text-slate-700 italic">
                      "{selectedRequest.targetMessage}"
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Shift Date</label>
                  <p className="text-sm font-black text-slate-900">{selectedRequest.date}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Request Type</label>
                  <span className="inline-flex px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-lg border border-indigo-100">
                    {selectedRequest.type}
                  </span>
                </div>
              </div>

              {selectedRequest.message && (
                <div className="space-y-2 p-6 bg-white border border-slate-200 rounded-3xl shadow-sm">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Request Message</label>
                   <p className="text-xs font-medium text-slate-600 italic">"{selectedRequest.message}"</p>
                </div>
              )}

              {requestRequesterDetails && (
                <div className="space-y-3 p-6 bg-slate-50 rounded-3xl border border-slate-200/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Information</p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase">Email Address</p>
                        <p className="text-xs font-black text-slate-900">{requestRequesterDetails.email || 'N/A'}</p>
                      </div>
                    </div>
                    {requestRequesterDetails.phone && (
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100">
                          <History className="w-5 h-5 rotate-90" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">Phone Number</p>
                          <p className="text-xs font-black text-slate-900">{requestRequesterDetails.phone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Requested Timing</label>
                <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-center ring-4 ring-slate-100/50">
                  <span className="text-2xl font-black text-indigo-600 tabular-nums">{selectedRequest.time}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-6">
                {selectedRequest.status === 'pending' && selectedRequest.requesterId !== user?.uid && (
                  <button 
                    onClick={() => {
                      setOfferingRequest(selectedRequest);
                      setIsOfferModalOpen(true);
                    }}
                    className={cn(
                      "w-full py-4 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2",
                      selectedRequest.type === 'Cover' ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                    )}
                  >
                    {selectedRequest.type === 'Cover' ? <Check className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                    {selectedRequest.type === 'Cover' ? 'Accept Shift' : 'Offer Trade'}
                  </button>
                )}

                {selectedRequest.status === 'pending' && selectedRequest.targetEmployeeId === user?.uid && (
                   <button 
                    onClick={() => handleAcceptOffer(selectedRequest.id)}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Accept Direct Request
                  </button>
                )}

                {selectedRequest.status === 'responded' && selectedRequest.requesterId === user?.uid && (
                  <button 
                    onClick={() => handleAcceptOffer(selectedRequest.id)}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Confirm Trade Offer
                  </button>
                )}

                {isManager && (selectedRequest.status === 'responded' || selectedRequest.status === 'accepted') && (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => {
                        handleStatusUpdate(selectedRequest.id, 'completed');
                        setSelectedRequest(null);
                      }}
                      className="py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-xl shadow-emerald-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => {
                        handleStatusUpdate(selectedRequest.id, 'pending');
                        setSelectedRequest(null);
                      }}
                      className="py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {selectedRequest.status === 'responded' && (user?.uid === selectedRequest.requesterId || user?.uid === selectedRequest.targetEmployeeId || isManager) && (
                  <button 
                    onClick={() => {
                      handleCancelOffer(selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                    className="w-full py-4 bg-amber-50 text-amber-700 border border-amber-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4 rotate-45" />
                    {user?.uid === selectedRequest.targetEmployeeId ? 'Withdraw Offer' : 'Reject Offer'}
                  </button>
                )}

                {(user?.uid === selectedRequest.requesterId || isManager) && (
                  <button 
                    onClick={(e) => {
                      handleDeleteRequest(e as any, selectedRequest.id);
                      setSelectedRequest(null);
                    }}
                    className="w-full py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Request
                  </button>
                )}
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors font-black flex items-center justify-center gap-2"
                >
                  Dismiss Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-10">
        <h3 className="font-black text-slate-900 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
            Team Members
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
            {employees.length} Staff Found
          </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {employees.length > 0 ? (
            employees.sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
              <button 
                key={emp.id || emp.uid}
                onClick={() => {
                  setSelectedEmployeeId(emp.id || emp.uid);
                  setSelectedEmployeeName(emp.name);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center p-3 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-indigo-100 transition-all group hover:shadow-lg hover:shadow-indigo-500/5 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0 group-hover:scale-110 transition-transform overflow-hidden">
                  {emp.name.charAt(0)}
                </div>
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-black text-slate-900 truncate">{emp.name}</p>
                  <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                    <AlertCircle className="w-2.5 h-2.5" />
                    {emp.phone || 'NO PHONE'}
                  </p>
                </div>
              </button>
            ))
          ) : (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
                <UserIcon className="w-6 h-6" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest">Team not loaded yet</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-indigo-950 rounded-[2rem] p-10 flex items-start space-x-6 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 -mr-32 -mt-32 rounded-full blur-3xl opacity-20" />
        <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
          <AlertCircle className="w-7 h-7 text-indigo-300" />
        </div>
        <div className="max-w-3xl">
          <h4 className="font-black text-xl mb-3 tracking-tight">Shift Transfer Policy</h4>
          <p className="text-sm text-indigo-100/70 leading-relaxed font-medium">
            All shift transfers are legally binding once confirmed. Swaps must be final and approved by ops management 
            at least 24 hours prior to commencement. Please ensure the target employee has matching skills for the department.
          </p>
          <button className="mt-6 text-xs font-black uppercase tracking-widest hover:text-indigo-300 transition-colors">Read Full Terms →</button>
        </div>
      </div>
    </div>
  );
}
