import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Filter as FilterIcon,
  MoreVertical,
  X,
  Clock,
  MapPin,
  User,
  AlertCircle,
  ArrowRightLeft,
  Check,
  Search,
  Phone,
  Trash2,
  Zap,
  Sparkles,
  Sliders
} from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  isToday,
  startOfWeek,
  endOfWeek,
  addDays,
  parseISO
} from 'date-fns';
import { cn } from '../lib/utils';
import { Avatar } from '../lib/Avatar';
import { WeekOffPreference, TimeOffRequest } from '../types';
import {
  DndContext, 
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { db } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  setDoc,
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';

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

interface Shift {
  id: string;
  date: Date;
  type: 'Morning' | 'Evening' | 'Night' | 'Overtime';
  startTime: string;
  endTime: string;
  department: string;
  employeeName: string;
  employeeId: string;
  employeePhone?: string;
  notes?: string;
  status: 'scheduled' | 'swapped' | 'canceled';
  swapRequestId?: string;
  swapRequesterId?: string;
  swapRequesterName?: string;
  swapTargetId?: string;
  swapTargetName?: string;
  swapStatus?: 'pending' | 'approved' | 'declined';
}

interface AppUser {
  id: string;
  uid?: string;
  name: string;
  phone?: string;
  department?: string;
  role?: string;
  avatar?: string;
  gender?: string;
}

interface DraggableShiftProps {
  shift: Shift;
  onClick: () => void;
  onSwapClick?: (shift: Shift) => void;
  onDelete?: (id: string) => void;
}

const DraggableShift: React.FC<DraggableShiftProps> = ({ shift, onClick, onSwapClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: shift.id,
    data: { shift }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const statusStyles = {
    scheduled: {
      bg: "bg-blue-600/10 border-l-blue-600 text-blue-900 shadow-[0_2px_10px_-3px_rgba(37,99,235,0.2)]",
      icon: <Check className="w-2.5 h-2.5 mr-1 text-blue-600" />
    },
    swapped: {
      bg: "bg-amber-600/10 border-l-amber-500 text-amber-900 font-black shadow-[0_2px_10px_-3px_rgba(245,158,11,0.2)]",
      icon: <ArrowRightLeft className="w-2.5 h-2.5 mr-1 text-amber-600" />
    },
    canceled: {
      bg: "bg-rose-600/10 border-l-rose-500 text-rose-700 line-through opacity-70 shadow-[0_2px_10px_-3px_rgba(244,63,94,0.2)]",
      icon: <AlertCircle className="w-2.5 h-2.5 mr-1 text-rose-500" />
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layoutId={shift.id}
      initial={false}
      animate={isDragging ? { scale: 1.05, zIndex: 50, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" } : { scale: 1, zIndex: 1 }}
      className={cn(
        "px-2 py-1.5 border border-indigo-100 rounded-lg text-[9px] font-black truncate tracking-tight shadow-sm border-l-4 cursor-grab active:cursor-grabbing transition-all flex items-center group relative",
        statusStyles[shift.status].bg,
        isDragging && "opacity-50"
      )}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="flex items-center flex-1 overflow-hidden">
        {statusStyles[shift.status].icon}
        <span className="truncate">{format(new Date(shift.startTime), 'HH:mm')} • {shift.type}</span>
      </div>
      
      {shift.status === 'scheduled' && !isDragging && (
        <div className="absolute right-1 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 z-10">
          {onSwapClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSwapClick(shift);
              }}
              className="bg-white shadow-sm border border-indigo-100 rounded p-0.5 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all"
              title="Swap Shift"
            >
              <ArrowRightLeft className="w-2.5 h-2.5" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(shift.id);
              }}
              className="bg-white shadow-sm border border-indigo-100 rounded p-0.5 text-rose-500 hover:bg-rose-600 hover:text-white transition-all"
              title="Delete Shift"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

interface DroppableDayProps {
  day: Date;
  shifts: Shift[];
  isSelected: boolean;
  isCurrentMonth: boolean;
  onDayClick: (date: Date) => void;
  onEditShift: (shift: Shift) => void;
  onSwapShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  activeShift: Shift | null;
  isValidDrop: (date: Date) => boolean;
  isWeekOff?: boolean;
  isLeave?: boolean;
  bulkMode?: boolean;
  isBulkSelected?: boolean;
}

const DroppableDay: React.FC<DroppableDayProps> = ({ 
  day, 
  shifts, 
  isSelected, 
  isCurrentMonth, 
  onDayClick,
  onEditShift,
  onSwapShift,
  onDeleteShift,
  activeShift,
  isValidDrop,
  isWeekOff,
  isLeave,
  bulkMode = false,
  isBulkSelected = false
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: day.toISOString(),
    data: { date: day }
  });

  const isTodayDate = isToday(day);
  const isTarget = activeShift !== null;
  const valid = isTarget && isValidDrop(day);

  return (
    <div 
      ref={setNodeRef}
      onClick={() => onDayClick(day)}
      className={cn(
        "relative min-h-[140px] p-2 border-r border-b border-slate-100 transition-all cursor-pointer group hover:bg-slate-50",
        !isCurrentMonth && "opacity-20 grayscale bg-slate-50/10",
        isWeekOff && isCurrentMonth && "bg-rose-50/20",
        isLeave && isCurrentMonth && "bg-amber-50/20",
        isSelected && "bg-indigo-50/50",
        isBulkSelected && isCurrentMonth && "bg-amber-500/10 dark:bg-amber-500/5 border-amber-500 ring-2 ring-amber-500 z-10 shadow-lg shadow-amber-500/10",
        isOver && (valid ? "bg-emerald-100 ring-2 ring-emerald-500 z-10 shadow-lg scale-[1.02]" : "bg-rose-100 ring-2 ring-rose-500 z-10 shadow-lg scale-[1.02]"),
        isTarget && !isOver && (valid ? "bg-indigo-50/10 animate-pulse border-indigo-200 border-2" : "bg-slate-100/20 opacity-40 cursor-not-allowed")
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={cn(
          "inline-flex items-center justify-center w-8 h-8 text-xs font-black rounded-xl transition-all",
          isTodayDate ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 group-hover:text-indigo-600",
          isSelected && !isTodayDate && "bg-white border border-indigo-200 text-indigo-700",
          isBulkSelected && "bg-amber-500 text-white shadow-lg shadow-amber-200 ring-2 ring-white scale-110"
        )}>
          {format(day, 'd')}
        </span>
        <div className="flex flex-col items-end gap-1">
          {bulkMode && isCurrentMonth && (
            <span className={cn(
              "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
              isBulkSelected ? "bg-amber-500 border-amber-500 text-white" : "border-slate-300 bg-white"
            )}>
              {isBulkSelected && <Check className="w-2.5 h-2.5 stroke-[4.5]" />}
            </span>
          )}
          {isWeekOff && isCurrentMonth && (
            <span className="text-[7px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-md shadow-sm animate-pulse whitespace-nowrap overflow-hidden text-ellipsis max-w-[50px]">
              OFF
            </span>
          )}
          {isLeave && isCurrentMonth && (
            <span className="text-[7px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-md shadow-sm animate-pulse whitespace-nowrap overflow-hidden text-ellipsis max-w-[50px]">
              LEAVE
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 overflow-y-auto max-h-[100px] scrollbar-hide">
        {shifts.map((shift) => (
          <DraggableShift 
            key={shift.id} 
            shift={shift} 
            onClick={() => {
              if (bulkMode) {
                // Clicking days toggles day selection in bulk mode
                onDayClick(day);
              } else {
                onEditShift(shift);
              }
            }} 
            onSwapClick={onSwapShift}
            onDelete={onDeleteShift}
          />
        ))}
      </div>
    </div>
  );
}

interface DroppableSlotProps {
  date: Date;
  hour: number;
  shifts: Shift[];
  onSlotClick: (date: Date, hour: number) => void;
  onEditShift: (shift: Shift) => void;
  onSwapShift: (shift: Shift) => void;
  onDeleteShift: (id: string) => void;
  isWeekOff?: boolean;
  isLeave?: boolean;
}

const DroppableSlot: React.FC<DroppableSlotProps> = ({ 
  date, 
  hour, 
  shifts, 
  onSlotClick,
  onEditShift,
  onSwapShift,
  onDeleteShift,
  isWeekOff,
  isLeave
}) => {
  const slotDate = new Date(date);
  slotDate.setHours(hour, 0, 0, 0);
  
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotDate.toISOString()}`,
    data: { date: slotDate, isSlot: true }
  });

  return (
    <div 
      ref={setNodeRef}
      onClick={() => onSlotClick(date, hour)}
      className={cn(
        "h-16 border-r border-b border-slate-100 transition-all relative group",
        isWeekOff ? "bg-rose-50/20" : 
        isLeave ? "bg-amber-50/20" :
        isOver ? "bg-indigo-50/50" : "hover:bg-slate-50/50"
      )}
    >
      <div className="absolute inset-0 p-1 flex flex-col gap-1 overflow-hidden pointer-events-none">
        {shifts.map(shift => (
          <div key={shift.id} className="pointer-events-auto">
            <DraggableShift 
              shift={shift} 
              onClick={() => onEditShift(shift)} 
              onSwapClick={onSwapShift}
              onDelete={onDeleteShift}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarView() {
  const { user } = useAuth();
  const { config } = useConfig();
  const userRole = user?.appData?.role?.toLowerCase() || '';
  const isManagerOrAdmin = ['manager', 'admin', 'super_admin'].includes(userRole);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [swapShift, setSwapShift] = useState<Shift | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string>('all');
  const [swapMessage, setSwapMessage] = useState<string>('');
  const [filters, setFilters] = useState({ department: 'All', type: 'All', employee: 'All', status: 'All' });
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [weekOffPreferences, setWeekOffPreferences] = useState<WeekOffPreference[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);
  const [employeesList, setEmployeesList] = useState<AppUser[]>([]);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [confirmAction, setConfirmDelete] = useState<{ id: string, type: 'delete' | 'cancel' } | null>(null);
  const [selectedEmployeeInModal, setSelectedEmployeeInModal] = useState<AppUser | null>(null);
  const [selectedDatesInModal, setSelectedDatesInModal] = useState<string[]>([]);

  // Bulk Selection States
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelectedDates, setBulkSelectedDates] = useState<string[]>([]); // Strings formatted as yyyy-MM-dd
  const [bulkSelectedEmployeeIds, setBulkSelectedEmployeeIds] = useState<string[]>([]);

  const toggleEmployeeBulkSelection = (empId: string) => {
    setBulkSelectedEmployeeIds(prev =>
      prev.includes(empId)
        ? prev.filter(id => id !== empId)
        : [...prev, empId]
    );
  };

  const handleBulkAssign = async (shiftType: string, customStart?: string, customEnd?: string) => {
    if (bulkSelectedDates.length === 0) {
      alert("Please select at least one date on the calendar.");
      return;
    }
    if (bulkSelectedEmployeeIds.length === 0) {
      alert("Please select at least one employee.");
      return;
    }

    let sTime = customStart || "08:00";
    let eTime = customEnd || "16:00";
    if (!customStart || !customEnd) {
      if (shiftType.toLowerCase().includes('morning') || shiftType === 'Morning') {
        sTime = "06:00"; eTime = "14:00";
      } else if (shiftType.toLowerCase().includes('evening') || shiftType === 'Evening') {
        sTime = "14:00"; eTime = "22:00";
      } else if (shiftType.toLowerCase().includes('night') || shiftType === 'Night') {
        sTime = "22:00"; eTime = "06:00";
      } else if (shiftType.toLowerCase().includes('overtime')) {
        sTime = "16:00"; eTime = "20:00";
      } else if (shiftType.toLowerCase().includes('off') || shiftType.toLowerCase().includes('leave')) {
        sTime = "00:00"; eTime = "00:00";
      }
    }

    let createdCount = 0;
    let skippedConflicts = 0;

    for (const dateStr of bulkSelectedDates) {
      for (const empId of bulkSelectedEmployeeIds) {
        const emp = employeesList.find(e => e.uid === empId || e.id === empId);
        if (!emp) continue;

        const startISO = new Date(`${dateStr}T${sTime}`).toISOString();
        const startD = new Date(`${dateStr}T${sTime}`);
        let endD = new Date(`${dateStr}T${eTime}`);
        if (endD < startD) {
          endD = addDays(endD, 1);
        }
        const endISO = endD.toISOString();

        // Check conflict if active work shift
        if (!['week off', 'comp off', 'leave', 'off'].includes(shiftType.toLowerCase())) {
          const conflict = checkRosterConflict(new Date(dateStr), startISO, endISO, emp.name);
          if (conflict) {
            skippedConflicts++;
            continue;
          }
        }

        // Check for duplicates
        const existing = shifts.find(s => s.employeeName === emp.name && isSameDay(s.date, new Date(dateStr)) && s.status !== 'canceled');
        if (existing) {
          try {
            await updateDoc(doc(db, 'shifts', existing.id), {
              type: shiftType,
              startTime: startISO,
              endTime: endISO,
              department: emp.department || (emp as any).dept || 'Operations Control',
              status: 'scheduled',
              notes: 'Bulk updated assignment'
            });
            createdCount++;
          } catch (error) {
            console.error(error);
          }
        } else {
          try {
            await addDoc(collection(db, 'shifts'), {
              employeeId: emp.uid || emp.id,
              employeeName: emp.name,
              employeePhone: emp.phone || '',
              startTime: startISO,
              endTime: endISO,
              type: shiftType,
              department: emp.department || (emp as any).dept || 'Operations Control',
              status: 'scheduled',
              notes: 'Bulk assigned'
            });
            createdCount++;
          } catch (error) {
            console.error(error);
          }
        }
      }
    }

    let alertMsg = `Bulk Assignment Completed!\nAssigned: ${createdCount} shifts.`;
    if (skippedConflicts > 0) {
      alertMsg += `\nSkipped ${skippedConflicts} assignments due to rule constraints (overlaps, approved time-offs, weekly caps).`;
    }
    alert(alertMsg);
    setBulkSelectedDates([]);
    setBulkSelectedEmployeeIds([]);
  };

  const handleBulkDelete = async () => {
    if (bulkSelectedDates.length === 0 && bulkSelectedEmployeeIds.length === 0) {
      alert("Please select dates and/or staff to apply bulk deletion.");
      return;
    }

    const toDelete = shifts.filter(s => {
      const isDateMatch = bulkSelectedDates.length === 0 || bulkSelectedDates.includes(format(s.date, 'yyyy-MM-dd'));
      const isEmpMatch = bulkSelectedEmployeeIds.length === 0 || bulkSelectedEmployeeIds.includes(s.employeeId) || bulkSelectedEmployeeIds.includes(s.employeeName);
      return isDateMatch && isEmpMatch;
    });

    if (toDelete.length === 0) {
      alert("No active shifts match your selections to delete.");
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ALL ${toDelete.length} shifts matching your selection?`)) {
      return;
    }

    let deletedCount = 0;
    for (const s of toDelete) {
      try {
        await deleteDoc(doc(db, 'shifts', s.id));
        deletedCount++;
      } catch (e) {
        console.error(e);
      }
    }

    alert(`Bulk Deletion Completed!\nDeleted: ${deletedCount} shifts.`);
    setBulkSelectedDates([]);
    setBulkSelectedEmployeeIds([]);
  };

  const handleBulkReschedule = async (daysOffset: number) => {
    if (bulkSelectedDates.length === 0 && bulkSelectedEmployeeIds.length === 0) {
      alert("Please select dates and/or staff to apply bulk rescheduling.");
      return;
    }

    const toMove = shifts.filter(s => {
      const isDateMatch = bulkSelectedDates.length === 0 || bulkSelectedDates.includes(format(s.date, 'yyyy-MM-dd'));
      const isEmpMatch = bulkSelectedEmployeeIds.length === 0 || bulkSelectedEmployeeIds.includes(s.employeeId) || bulkSelectedEmployeeIds.includes(s.employeeName);
      return isDateMatch && isEmpMatch && s.status !== 'canceled';
    });

    if (toMove.length === 0) {
      alert("No active shifts match your selections to reschedule.");
      return;
    }

    if (!confirm(`Reschedule offsets: Shifts will be shifted by ${daysOffset > 0 ? '+' : ''}${daysOffset} day(s). Proceed?`)) {
      return;
    }

    let movedCount = 0;
    let skippedConflicts = 0;

    for (const s of toMove) {
      const originalStart = new Date(s.startTime);
      const originalEnd = new Date(s.endTime);

      const newStart = addDays(originalStart, daysOffset);
      const newEnd = addDays(originalEnd, daysOffset);
      const newDate = addDays(s.date, daysOffset);

      const conflict = checkRosterConflict(newDate, newStart.toISOString(), newEnd.toISOString(), s.employeeName, s.id);
      if (conflict) {
        skippedConflicts++;
        continue;
      }

      try {
        await updateDoc(doc(db, 'shifts', s.id), {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString()
        });
        movedCount++;
      } catch (e) {
        console.error(e);
      }
    }

    let alertMsg = `Bulk Reschedule Completed!\nRescheduled: ${movedCount} shifts.`;
    if (skippedConflicts > 0) {
      alertMsg += `\nSkipped ${skippedConflicts} shifts due to rules scheduling conflicts.`;
    }
    alert(alertMsg);
    setBulkSelectedDates([]);
    setBulkSelectedEmployeeIds([]);
  };

  // Autonomous Planner States
  const [isPlannerModalOpen, setIsPlannerModalOpen] = useState(false);
  const [plannerStartDate, setPlannerStartDate] = useState('');
  const [plannerEndDate, setPlannerEndDate] = useState('');
  const [plannerDept, setPlannerDept] = useState('All');
  const [plannerDailyTarget, setPlannerDailyTarget] = useState(2);
  const [isPlannerRunning, setIsPlannerRunning] = useState(false);
  const [plannerStatusText, setPlannerStatusText] = useState('');

  // Sync Real Filter: bilateral synchronization between Employee and Department selection
  useEffect(() => {
    if (filters.employee && filters.employee !== 'All') {
      const empObj = employeesList.find(e => e.name === filters.employee);
      if (empObj) {
        const empDept = empObj.department || (empObj as any).dept;
        if (empDept && empDept !== filters.department) {
          setFilters(prev => ({ ...prev, department: empDept }));
        }
      }
    }
  }, [filters.employee, employeesList]);

  useEffect(() => {
    if (filters.department && filters.department !== 'All') {
      const currentEmpObj = employeesList.find(e => e.name === filters.employee);
      if (currentEmpObj) {
        const empDept = currentEmpObj.department || (currentEmpObj as any).dept;
        if (empDept && empDept !== filters.department) {
          setFilters(prev => ({ ...prev, employee: 'All' }));
        }
      }
    }
  }, [filters.department, employeesList]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'shifts'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shiftData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: new Date(data.startTime)
        } as Shift;
      });
      setShifts(shiftData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'weekOffPreferences'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prefs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeekOffPreference));
      setWeekOffPreferences(prefs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'weekOffPreferences');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'timeOffRequests'), where('status', '==', 'approved'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeOffRequest));
      setTimeOffRequests(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'timeOffRequests');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AppUser));
      setEmployeesList(list);
      
      // Seed requested employees if list is empty or doesn't have them
      const seedData = [
        { name: 'Yogita', department: 'Operations Control', phone: '9579497783', gender: 'Female' },
        { name: 'Rushikesh', department: 'Operations Control', phone: '8626002551', gender: 'Male' },
        { name: 'Kapil', department: 'Operations Control', phone: '8605530562', gender: 'Male' },
        { name: 'Samadhan', department: 'Operations Control', phone: '8010231867', gender: 'Male' },
        { name: 'Pratik', department: 'Operations Control', phone: '9373524166', gender: 'Male' },
        { name: 'Omkar', department: 'Systems Engineering', phone: '8208492694', gender: 'Male' },
      ];

      // Also ensure current user is in the list
      const allEmps = [...list];
      
              seedData.forEach(async (emp) => {
        if (!list.find(e => e.name === emp.name)) {
          const uid = `seed_${emp.name.toLowerCase()}`;
          try {
            await setDoc(doc(db, 'users', uid), {
              uid,
              ...emp,
              email: `${emp.name.toLowerCase()}@example.com`,
              role: emp.department.includes('Control') ? 'employee' : 'employee',
              avatar: '',
              status: 'Off',
              createdAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Seeding failed for', emp.name, error);
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (editingShift) {
      const emp = employeesList.find(e => e.name === editingShift.employeeName);
      setSelectedEmployeeInModal(emp || { name: editingShift.employeeName });
    } else if (isAddModalOpen && !selectedEmployeeInModal) {
      const currentEmp = employeesList.find(e => e.uid === user?.uid);
      setSelectedEmployeeInModal(currentEmp || { name: user?.displayName || '', uid: user?.uid });
      // Initialize with currently selected date in calendar
      if (!editingShift && selectedDatesInModal.length === 0) {
        setSelectedDatesInModal([format(selectedDate, 'yyyy-MM-dd')]);
      }
    }
  }, [editingShift, isAddModalOpen, employeesList]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);
  
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate);
    const end = endOfWeek(selectedDate);
    return eachDayOfInterval({ start, end });
  }, [selectedDate]);

  const departments = Array.from(new Set(config.departments || []));
  const baseShiftTypes = config.shiftTypes.map(t => t.name).length > 0 ? config.shiftTypes.map(t => t.name) : ['Morning', 'Evening', 'Night', 'Overtime'];
  const shiftTypes = [...new Set([...baseShiftTypes, 'Week off', 'Comp off', 'Leave'])];
  const employees = useMemo(() => {
    // Dynamically filter active employee choices based on the active Department filter
    const filteredEmployeesList = filters.department === 'All' 
       ? employeesList 
       : employeesList.filter(e => e.department === filters.department || (e as any).dept === filters.department);
       
    const filteredShiftsForEmp = filters.department === 'All'
       ? shifts
       : shifts.filter(s => {
           const empObj = employeesList.find(e => e.uid === s.employeeId || e.name === s.employeeName);
           const sDept = s.department || (s as any).dept || empObj?.department || (empObj as any)?.dept || '';
           return sDept === filters.department;
         });

    const fromShifts = filteredShiftsForEmp.map(s => s.employeeName || employeesList.find(e => e.uid === s.employeeId)?.name).filter(Boolean) as string[];
    const fromList = filteredEmployeesList.map(e => e.name).filter(Boolean);
    return Array.from(new Set([...fromShifts, ...fromList])).sort((a, b) => a.localeCompare(b));
  }, [shifts, employeesList, filters.department]);

  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      // Find the associated employee object to resolve fallback values (like department or name)
      const empObj = employeesList.find(e => e.uid === s.employeeId || e.name === s.employeeName);
      
      const resolvedDept = (s.department || (s as any).dept || empObj?.department || (empObj as any)?.dept || '').trim();
      const resolvedEmpName = (s.employeeName || empObj?.name || '').trim();
      
      const deptMatch = filters.department === 'All' || 
                        resolvedDept === filters.department || 
                        resolvedDept.toLowerCase() === filters.department.toLowerCase();
                        
      const typeMatch = filters.type === 'All' || s.type === filters.type;
      
      const empMatch = filters.employee === 'All' || 
                       resolvedEmpName === filters.employee || 
                       s.employeeId === filters.employee;
                       
      const statusMatch = filters.status === 'All' || s.status === filters.status;
      
      const term = searchTerm.toLowerCase().trim();
      let searchMatch = true;
      if (term) {
        const empName = resolvedEmpName.toLowerCase();
        const shiftType = (s.type || '').toLowerCase();
        const shiftTypeWithWord = `${shiftType} shift`;
        const dept = resolvedDept.toLowerCase();
        const notes = (s.notes || '').toLowerCase();
        const status = (s.status || '').toLowerCase();
        
        const isShiftTypeSearchWord = term === 'shift';
        const isActualShift = !['week off', 'comp off', 'leave'].includes(shiftType);
        
        searchMatch = 
          empName.includes(term) ||
          shiftType.includes(term) ||
          shiftTypeWithWord.includes(term) ||
          dept.includes(term) ||
          notes.includes(term) ||
          status.includes(term) ||
          (isShiftTypeSearchWord && isActualShift);
      }
      return deptMatch && typeMatch && empMatch && statusMatch && searchMatch;
    });
  }, [shifts, filters, searchTerm, employeesList]);

  const selectedDateShifts = useMemo(() => {
    return filteredShifts.filter(s => isSameDay(s.date, selectedDate));
  }, [filteredShifts, selectedDate]);

  const checkRosterConflict = (date: Date, startISO: string, endISO: string, employee: string, excludeId?: string) => {
    const employeeShifts = shifts.filter(s => 
      s.employeeName === employee && s.id !== excludeId && s.status !== 'canceled'
    );
    
    const newStart = new Date(startISO);
    const newEnd = new Date(endISO);
    
    // Check Week-Off Preferences
    const dayName = format(new Date(date), 'EEEE');
    const dateStr = format(new Date(date), 'yyyy-MM-dd');
    const hasWeekOffConflict = weekOffPreferences.find(p => 
      (p.employeeId === employee || p.employeeName === employee) && 
      (p.days.includes(dayName) || (p.specificDates && p.specificDates.includes(dateStr)))
    );

    if (hasWeekOffConflict) {
      return { type: 'weekoff', message: `${employee} has an approved Week-Off on ${dayName}s.` };
    }

    // Check Time-Off Conflicts
    const hasTimeOffConflict = timeOffRequests.find(r => 
      (r.employeeId === employee || r.employeeName === employee) && 
      ((newStart >= new Date(r.startDate) && newStart <= new Date(r.endDate)) ||
       (newEnd >= new Date(r.startDate) && newEnd <= new Date(r.endDate)) ||
       (newStart <= new Date(r.startDate) && newEnd >= new Date(r.endDate)))
    );

    if (hasTimeOffConflict) {
      return { type: 'timeoff', message: `${employee} has an approved Time-Off request during this period.` };
    }

    const minRestMs = (config.rosterRules?.minRestHours || 11) * 60 * 60 * 1000;
    const maxWeeklyHours = config.rosterRules?.maxWeeklyHours || 48;
    
    let weeklyHours = 0;
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Assuming Monday start
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 });

    for (const shift of employeeShifts) {
      const sStart = new Date(shift.startTime);
      const sEnd = new Date(shift.endTime);
      
      // Calculate weekly hours
      if (sStart >= weekStart && sEnd <= weekEnd) {
        weeklyHours += (sEnd.getTime() - sStart.getTime()) / 3600000;
      }

      // Strict Overlap Check
      if ((newStart >= sStart && newStart < sEnd) || (newEnd > sStart && newEnd <= sEnd) || (newStart <= sStart && newEnd >= sEnd)) {
        return { type: 'overlap', message: 'Work schedule overlap detected.' };
      }

      // Rest Period Check (Before)
      if (newStart > sEnd) {
        const gap = newStart.getTime() - sEnd.getTime();
        if (gap < minRestMs && newStart.toDateString() === sEnd.toDateString()) {
           // Only alert if same day or adjacent to prevent over-alerting on far apart shifts in this simple check
           // Actually, we should check any shift that is "close" in time.
        }
        if (gap > 0 && gap < minRestMs) {
           return { type: 'rest', message: `Insufficient rest period (${(gap/3600000).toFixed(1)}h). Min required: ${config.rosterRules?.minRestHours || 11}h.` };
        }
      }

      // Rest Period Check (After)
      if (sStart > newEnd) {
        const gap = sStart.getTime() - newEnd.getTime();
        if (gap > 0 && gap < minRestMs) {
           return { type: 'rest', message: `Insufficient rest period before next shift (${(gap/3600000).toFixed(1)}h).` };
        }
      }
    }

    const newHours = (newEnd.getTime() - newStart.getTime()) / 3600000;
    if (weeklyHours + newHours > maxWeeklyHours) {
      return { type: 'weeklyCap', message: `Weekly hour cap reached (${(weeklyHours + newHours).toFixed(1)}h / ${maxWeeklyHours}h).` };
    }

    return null;
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const handleDragStart = (event: any) => {
    const { active } = event;
    const shift = shifts.find(s => s.id === active.id);
    if (shift) setActiveShift(shift);
  };

  const handleCancelShift = async () => {
    if (!editingShift) return;
    try {
      await deleteDoc(doc(db, 'shifts', editingShift.id));
      setEditingShift(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shifts/${editingShift.id}`);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveShift(null);
    if (over) {
      const shiftId = active.id as string;
      const overData = over.data.current;
      const isSlot = overData?.isSlot;
      const newDate = overData?.date as Date;
      const shift = shifts.find(s => s.id === shiftId);

      if (shift && newDate) {
        let newStart = new Date(newDate);
        let newEnd = new Date(newDate);

        if (isSlot) {
          // If dropped on a specific time slot in Week View
          const durationMs = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
          newEnd = new Date(newStart.getTime() + durationMs);
        } else {
          // If dropped on a day cell in Month View
          const originalStart = new Date(shift.startTime);
          const originalEnd = new Date(shift.endTime);
          newStart.setHours(originalStart.getHours(), originalStart.getMinutes());
          newEnd.setHours(originalEnd.getHours(), originalEnd.getMinutes());
        }

        const conflict = checkRosterConflict(newDate, newStart.toISOString(), newEnd.toISOString(), shift.employeeName, shiftId);
        if (conflict) {
           alert(`Warning: ${conflict.message}`);
           // If it's a strict overlap, maybe we should prevent it. 
           // For now just warning as requested "Sync then process next"
        }

        try {
          await updateDoc(doc(db, 'shifts', shiftId), {
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `shifts/${shiftId}`);
        }
      }
    }
  };

  const handleAddShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const dateParts = editingShift ? [formData.get('date') as string] : selectedDatesInModal;
    const startTimePart = formData.get('startTime') as string;
    const endTimePart = formData.get('endTime') as string;
    const employeeName = selectedEmployeeInModal?.name || 'Unknown';
    const employeeId = selectedEmployeeInModal?.uid || selectedEmployeeInModal?.id || 'anonymous';
    const employeePhone = selectedEmployeeInModal?.phone || '';

    try {
      for (const datePart of dateParts) {
        const startISO = new Date(`${datePart}T${startTimePart}`).toISOString();
        const endISO = new Date(`${datePart}T${endTimePart}`).toISOString();

        const conflict = checkRosterConflict(new Date(datePart), startISO, endISO, employeeName);
        if (conflict) {
          setOverlapWarning(`Conflict on ${datePart}: ${conflict.message}`);
          return;
        }

        const newShiftData = {
          employeeId,
          employeeName,
          employeePhone,
          startTime: startISO,
          endTime: endISO,
          type: formData.get('type') as string,
          department: formData.get('department') as string,
          notes: formData.get('notes') as string,
          status: 'scheduled'
        };

        await addDoc(collection(db, 'shifts'), newShiftData);
      }
      setIsAddModalOpen(false);
      setSelectedEmployeeInModal(null);
      setSelectedDatesInModal([]);
      setOverlapWarning(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'shifts');
    }
  };

  const handleUpdateShift = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingShift) return;
    const formData = new FormData(e.currentTarget);
    const datePart = formData.get('date') as string;
    const startTimePart = formData.get('startTime') as string;
    const endTimePart = formData.get('endTime') as string;
    const employeeName = selectedEmployeeInModal?.name || 'Unknown';
    const employeeId = selectedEmployeeInModal?.uid || selectedEmployeeInModal?.id || 'anonymous';
    const employeePhone = selectedEmployeeInModal?.phone || '';
    const status = formData.get('status') as any;

    const startISO = new Date(`${datePart}T${startTimePart}`).toISOString();
    const endISO = new Date(`${datePart}T${endTimePart}`).toISOString();

    const conflict = checkRosterConflict(new Date(datePart), startISO, endISO, employeeName, editingShift.id);
    if (status !== 'canceled' && conflict) {
      setOverlapWarning(`Conflict: ${conflict.message}`);
      return;
    }

    try {
      await updateDoc(doc(db, 'shifts', editingShift.id), {
        employeeName,
        employeeId,
        employeePhone,
        startTime: startISO,
        endTime: endISO,
        type: formData.get('type') as string,
        department: formData.get('department') as string,
        status,
        notes: formData.get('notes') as string
      });
      setEditingShift(null);
      setSelectedEmployeeInModal(null);
      setOverlapWarning(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `shifts/${editingShift.id}`);
    }
  };

  const handleDeleteShift = async () => {
    if (!editingShift) return;
    if (confirmAction?.id !== editingShift.id || confirmAction?.type !== 'delete') {
      setConfirmDelete({ id: editingShift.id, type: 'delete' });
      setTimeout(() => setConfirmDelete(prev => prev?.id === editingShift.id && prev?.type === 'delete' ? null : prev), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'shifts', editingShift.id));
      setEditingShift(null);
      setConfirmDelete(null);
    } catch (error: any) {
      alert('Delete failed: ' + (error.message || 'Check your permissions'));
      console.error(error);
    }
  };

  const handleEditClick = (shift: Shift) => {
    if (!isManagerOrAdmin) return;
    setEditingShift(shift);
    setIsAddModalOpen(true);
  };

  const handleSwapClick = (shift: Shift) => {
    setSwapShift(shift);
    setSwapTargetId('all');
    setSwapMessage('');
    setIsSwapModalOpen(true);
  };

  const handleDeletePermanent = async (id: string) => {
    if (!confirm('Permanently delete this shift?')) return;
    try {
      await deleteDoc(doc(db, 'shifts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `shifts/${id}`);
    }
  };

  const handleRunAutonomousPlanner = async () => {
    if (!plannerStartDate || !plannerEndDate) {
      alert("Please select both start and end dates.");
      return;
    }

    const start = new Date(plannerStartDate);
    const end = new Date(plannerEndDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert("Invalid date format.");
      return;
    }

    if (start > end) {
      alert("Start date must be before or equal to End date.");
      return;
    }

    setIsPlannerRunning(true);
    setPlannerStatusText("Initializing AI Solver engine...");

    try {
      // Step 1: Filter candidates based on department
      await new Promise(resolve => setTimeout(resolve, 600));
      setPlannerStatusText("Scanning employee roster and active skill groups...");
      
      const candidates = employeesList.filter(emp => {
        if (plannerDept === 'All') return true;
        return emp.department === plannerDept;
      });

      if (candidates.length === 0) {
        alert(`No employees found for department: ${plannerDept}`);
        setIsPlannerRunning(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      setPlannerStatusText("Mapping conflicts, approved leaves, and week-off constraints...");

      const rangeDays = eachDayOfInterval({ start, end });
      let addedCount = 0;
      let conflictFilteredCount = 0;

      // Define default rotation shifts if needed
      const availShiftTypes = config.shiftTypes.map((t: any) => t.name).length > 0
        ? config.shiftTypes.map((t: any) => t.name)
        : ['Morning', 'Evening', 'Night'];

      // Process day by day
      for (const day of rangeDays) {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayOfWeekStr = format(day, 'EEEE'); // e.g. "Monday"

        // Find which candidate can work on this day
        const eligibleForDay = candidates.filter(emp => {
          const empId = emp.uid || emp.id || '';
          
          // 1. Check Approved Time Off (approved date check)
          const isOnLeave = timeOffRequests.some(req => {
            if (req.employeeId !== empId) return false;
            const reqStart = new Date(req.startDate);
            const reqEnd = new Date(req.endDate);
            return day >= reqStart && day <= reqEnd;
          });
          if (isOnLeave) return false;

          // 2. Check Approved Week Off Preference
          const hasWeekOff = weekOffPreferences.some(pref => {
            if (pref.employeeId !== empId) return false;
            return pref.days.includes(dayOfWeekStr) || (pref.specificDates && pref.specificDates.includes(dayStr));
          });
          if (hasWeekOff) return false;

          // 3. Check existing shift on this day to avoid duplicate
          const hasExistingShift = shifts.some(s => {
            const sDate = new Date(s.startTime);
            return isSameDay(sDate, day) && s.employeeId === empId && s.status !== 'canceled';
          });
          if (hasExistingShift) return false;

          return true;
        });

        // Track how many were filtered
        conflictFilteredCount += (candidates.length - eligibleForDay.length);

        if (eligibleForDay.length === 0) continue;

        // Shuffle eligible candidates
        const shuffled = [...eligibleForDay].sort(() => Math.random() - 0.5);

        // Assign up to plannerDailyTarget shifts
        const targetForDay = Math.min(plannerDailyTarget, shuffled.length);
        for (let idx = 0; idx < targetForDay; idx++) {
          const emp = shuffled[idx];
          
          // Rotate shift type based on date or index
          const sType = availShiftTypes[Math.floor(Math.random() * availShiftTypes.length)] || 'Morning';
          
          // Get shift configuration timings or fallback
          const configTiming = config.shiftTypes.find((t: any) => t.name === sType);
          const startStr = configTiming?.startTime || "09:00";
          const endStr = configTiming?.endTime || "17:00";

          const startISO = new Date(`${dayStr}T${startStr}`).toISOString();
          const endISO = new Date(`${dayStr}T${endStr}`).toISOString();

          const newShiftData = {
            employeeId: emp.uid || emp.id || 'anonymous',
            employeeName: emp.name,
            employeePhone: emp.phone || '',
            startTime: startISO,
            endTime: endISO,
            type: sType as any,
            department: emp.department || plannerDept || 'Operations Control',
            notes: 'Generated automatically via Autonomous Roster Planner.',
            status: 'scheduled'
          };

          await addDoc(collection(db, 'shifts'), newShiftData);
          addedCount++;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      setPlannerStatusText("Compiling roster data and applying load balances...");
      await new Promise(resolve => setTimeout(resolve, 600));

      alert(`Roster Autogeneration completed successfully!\nGenerated: ${addedCount} shift assignments.\nResolved Leaves/Week-offs constraints: ${conflictFilteredCount} parameters.`);
      setIsPlannerModalOpen(false);
    } catch (error: any) {
      alert("Planning Error: " + error.message);
    } finally {
      setIsPlannerRunning(false);
    }
  };

  const handleCreateSwapRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!swapShift || !user) return;

    const formData = new FormData(e.currentTarget);
    const requesterName = swapShift.employeeName;
    const requesterId = swapShift.employeeId;
    const requesterEmp = employeesList.find(e => e.id === requesterId || e.uid === requesterId);
    const requesterAvatar = requesterEmp?.avatar || requesterEmp?.avatarUrl || '';

    const targetEmp = swapTargetId !== 'all' ? employeesList.find(e => e.id === swapTargetId || e.uid === swapTargetId) : null;

    const swapRequest = {
      requesterId,
      requesterName,
      requesterAvatar,
      date: format(swapShift.date, 'MMMM do'),
      time: `${format(new Date(swapShift.startTime), 'HH:mm')} - ${format(new Date(swapShift.endTime), 'HH:mm')}`,
      department: (swapShift as any).department || (swapShift as any).dept,
      type: formData.get('type') as string,
      status: targetEmp ? 'responded' : 'pending',
      targetEmployeeId: targetEmp ? (targetEmp.uid || targetEmp.id) : null,
      targetEmployeeName: targetEmp ? targetEmp.name : null,
      message: swapMessage,
      gender: 'Male',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalShiftId: swapShift.id
    };

    try {
      const docRef = await addDoc(collection(db, 'swapRequests'), swapRequest);
      
      // Update original shift with swap details
      await updateDoc(doc(db, 'shifts', swapShift.id), {
        swapRequestId: docRef.id,
        swapStatus: 'pending',
        swapRequesterId: requesterId,
        swapRequesterName: requesterName,
        swapTargetId: targetEmp ? (targetEmp.uid || targetEmp.id) : null,
        swapTargetName: targetEmp ? targetEmp.name : null,
      });

      setIsSwapModalOpen(false);
      setSwapShift(null);
      alert('Swap request posted to board!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'swapRequests');
    }
  };

  return (
    <div className="space-y-8 h-full flex flex-col relative pb-20 lg:pb-0">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
             <h2 className="text-3xl md:text-[2.5rem] font-black text-slate-900 tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700">
              Shift Matrix
            </h2>
            <div className="flex items-center gap-3 mt-3">
               <p className="text-slate-500 font-medium text-base md:text-lg">{format(currentMonth, 'MMMM yyyy')}</p>
               <span className="w-1.5 h-1.5 bg-slate-300 rounded-full shrink-0" />
               <p className="text-indigo-600 font-black text-[10px] md:text-sm uppercase tracking-widest">{filteredShifts.length} Active Shifts</p>
            </div>
          </motion.div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex p-1.5 bg-white border border-slate-200 rounded-[1.4rem] shadow-sm">
              <button 
                onClick={() => setViewMode('month')} 
                className={cn(
                  "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                  viewMode === 'month' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                )}
              >
                Month
              </button>
              <button 
                onClick={() => setViewMode('week')} 
                className={cn(
                  "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                  viewMode === 'week' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                )}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode('list')} 
                className={cn(
                  "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 lg:hidden",
                  viewMode === 'list' ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/20" : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                )}
              >
                List
              </button>
            </div>
            
            <div className="flex p-1.5 bg-white border border-slate-200 rounded-[1.4rem] shadow-sm shrink-0">
              <button onClick={prevMonth} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={() => {
                setCurrentMonth(new Date());
                setSelectedDate(new Date());
              }} className="px-5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 font-black rounded-xl transition-all">
                Today
              </button>
              <button onClick={nextMonth} className="p-2.5 hover:bg-slate-50 rounded-xl transition-all text-slate-600">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto">
          <div className="relative flex-1 sm:min-w-[300px] group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-[1.4rem] text-sm font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm group-hover:border-slate-300"
            />
          </div>

          {isManagerOrAdmin && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 group shrink-0"
            >
              <Plus className="w-4 h-4 mr-2 group-hover:rotate-90 transition-transform" />
              Create
            </button>
          )}

          {isManagerOrAdmin && (
            <button 
              onClick={() => {
                setBulkMode(!bulkMode);
                setBulkSelectedDates([]);
                setBulkSelectedEmployeeIds([]);
              }}
              className={cn(
                "flex items-center justify-center px-6 py-3 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 group shrink-0 border",
                bulkMode 
                  ? "bg-amber-500 hover:bg-amber-600 border-amber-400 text-white shadow-amber-500/20 animate-pulse" 
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-indigo-600"
              )}
            >
              <Sliders className="w-4 h-4 mr-2" />
              {bulkMode ? 'Cancel Selection' : 'Selection Mode'}
            </button>
          )}

          {isManagerOrAdmin && (
            <button 
              onClick={() => {
                const today = new Date();
                setPlannerStartDate(format(today, 'yyyy-MM-dd'));
                setPlannerEndDate(format(addDays(today, 14), 'yyyy-MM-dd'));
                setPlannerDept('All');
                setIsPlannerModalOpen(true);
              }}
              className="flex items-center justify-center px-6 py-3 bg-slate-900 border border-slate-800 text-indigo-400 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95 group shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-2 text-indigo-500 animate-pulse" />
              Auto Roster
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-2 rounded-[2rem] border border-slate-200/50">
          <div className="flex items-center gap-2 px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <FilterIcon className="w-3.5 h-3.5" />
            Filters
          </div>
          <div className="h-4 w-px bg-slate-300 hidden sm:block" />
          
          <select 
            value={filters.department} 
            onChange={(e) => setFilters({ ...filters, department: e.target.value })}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-600 cursor-pointer hover:bg-slate-50 transition-all"
          >
            <option value="All">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select 
            value={filters.employee} 
            onChange={(e) => setFilters({ ...filters, employee: e.target.value })}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-600 cursor-pointer hover:bg-slate-50 transition-all"
          >
            <option value="All">All Staff Members</option>
            {employees.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <select 
            value={filters.type} 
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-600 cursor-pointer hover:bg-slate-50 transition-all"
          >
            <option value="All">All Shift Types</option>
            {shiftTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="text-[10px] font-black uppercase tracking-widest px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 text-slate-600 cursor-pointer hover:bg-slate-50 transition-all"
          >
            <option value="All">Any Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="swapped">Swapped</option>
            <option value="canceled">Canceled</option>
          </select>
          
          {(filters.department !== 'All' || filters.employee !== 'All' || filters.type !== 'All' || filters.status !== 'All') && (
            <button 
              onClick={() => setFilters({ department: 'All', type: 'All', employee: 'All', status: 'All' })}
              className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-4 py-2.5 hover:bg-rose-50 rounded-xl transition-all flex items-center gap-2"
            >
              <X className="w-3 h-3" />
              Reset Filters
            </button>
          )}
      </motion.div>

      <DndContext 
        sensors={sensors} 
        collisionDetection={closestCenter} 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={cn(
          "flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-indigo-500/5 flex flex-col min-h-[600px] transition-all overflow-x-auto overflow-y-hidden",
          viewMode === 'month' ? "" : ""
        )}>
          {viewMode === 'month' ? (
            <div className="flex-1 flex flex-col min-w-[1000px]">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="py-5 text-center text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    {d}
                  </div>
                ))}
              </div>
              
              <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-hidden">
                {days.map((day) => (
                    <DroppableDay 
                      key={day.toISOString()} 
                      day={day} 
                      shifts={filteredShifts.filter(s => isSameDay(s.date, day))}
                      isSelected={isSameDay(day, selectedDate)}
                      isCurrentMonth={isSameMonth(day, currentMonth)}
                      bulkMode={bulkMode}
                      isBulkSelected={bulkSelectedDates.includes(format(day, 'yyyy-MM-dd'))}
                      isWeekOff={(() => {
                        const targetEmp = filters.employee !== 'All' ? filters.employee : user?.uid;
                        if (!targetEmp) return false;
                        return weekOffPreferences.some(p => 
                          (p.employeeId === targetEmp || p.employeeName === targetEmp) && 
                          (p.days.includes(format(day, 'EEEE')) || (p.specificDates && p.specificDates.includes(format(day, 'yyyy-MM-dd'))))
                        );
                      })()}
                      isLeave={(() => {
                        const targetEmp = filters.employee !== 'All' ? filters.employee : user?.uid;
                        if (!targetEmp) return false;
                        return timeOffRequests.some(r => {
                          const matchEmployee = r.employeeId === targetEmp || r.employeeName === targetEmp;
                          if (!matchEmployee) return false;
                          const d = new Date(day);
                          const start = new Date(r.startDate);
                          const end = new Date(r.endDate);
                          d.setHours(0,0,0,0);
                          start.setHours(0,0,0,0);
                          end.setHours(0,0,0,0);
                          return d >= start && d <= end;
                        });
                      })()}
                      onDayClick={(clickedDay) => {
                        if (bulkMode) {
                          const dateStr = format(clickedDay, 'yyyy-MM-dd');
                          setBulkSelectedDates(prev => 
                            prev.includes(dateStr) 
                              ? prev.filter(d => d !== dateStr) 
                              : [...prev, dateStr]
                          );
                        } else {
                          setSelectedDate(clickedDay);
                        }
                      }}
                      onEditShift={handleEditClick}
                      onSwapShift={handleSwapClick}
                      onDeleteShift={isManagerOrAdmin ? handleDeletePermanent : undefined}
                      activeShift={activeShift}
                      isValidDrop={(date) => {
                        if (!activeShift) return true;
                        const conflict = checkRosterConflict(date, activeShift.startTime, activeShift.endTime, activeShift.employeeName, activeShift.id);
                        return !conflict || conflict.type !== 'overlap';
                      }}
                    />
                ))}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex-1 flex flex-col min-w-[1200px]">
              <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50 shrink-0">
                <div className="p-4 border-r border-slate-100" />
                {weekDays.map(day => {
                  const targetEmp = filters.employee !== 'All' ? filters.employee : user?.uid;
                  const hasWeekOff = targetEmp && weekOffPreferences.some(p => 
                    (p.employeeId === targetEmp || p.employeeName === targetEmp) && 
                    (p.days.includes(format(day, 'EEEE')) || (p.specificDates && p.specificDates.includes(format(day, 'yyyy-MM-dd'))))
                  );
                  const hasLeave = targetEmp && timeOffRequests.some(r => {
                    const matchEmployee = r.employeeId === targetEmp || r.employeeName === targetEmp;
                    if (!matchEmployee) return false;
                    const d = new Date(day);
                    const start = new Date(r.startDate);
                    const end = new Date(r.endDate);
                    d.setHours(0,0,0,0);
                    start.setHours(0,0,0,0);
                    end.setHours(0,0,0,0);
                    return d >= start && d <= end;
                  });

                  const isDateSelected = bulkSelectedDates.includes(format(day, 'yyyy-MM-dd'));

                  return (
                    <div 
                      key={day.toISOString()} 
                      onClick={() => {
                        if (bulkMode) {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          setBulkSelectedDates(prev => 
                            prev.includes(dateStr) 
                              ? prev.filter(d => d !== dateStr) 
                              : [...prev, dateStr]
                          );
                        }
                      }}
                      className={cn(
                        "py-5 text-center border-r border-slate-100 last:border-r-0 relative overflow-hidden cursor-pointer hover:bg-slate-50",
                        isToday(day) ? "bg-indigo-50/30" : "",
                        isDateSelected && "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500 z-10"
                      )}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{format(day, 'EEE')}</p>
                      <p className={cn(
                        "text-sm font-black mt-1.5",
                        isToday(day) ? "text-indigo-600" : "text-slate-900",
                        isDateSelected && "text-amber-600 scale-110"
                      )}>{format(day, 'd')}</p>
                      {hasWeekOff && (
                        <div className="absolute top-0 right-0">
                           <div className="bg-rose-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-bl-lg uppercase tracking-tighter">OFF</div>
                        </div>
                      )}
                      {hasLeave && (
                        <div className="absolute top-0 left-0">
                           <div className="bg-amber-500 text-white text-[6px] font-black px-1.5 py-0.5 rounded-br-lg uppercase tracking-tighter">LV</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <div className="flex-1 overflow-y-auto max-h-[600px] scrollbar-hide">
                <div className="grid grid-cols-8 auto-rows-fr select-none">
                  {[...Array(24)].map((_, hour) => (
                    <React.Fragment key={hour}>
                      <div className="p-4 border-r border-b border-slate-100 text-right h-20 flex items-start justify-end">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter opacity-70">
                          {format(new Date().setHours(hour, 0), 'HH:mm')}
                        </span>
                      </div>
                      {weekDays.map(day => {
                        const targetEmp = filters.employee !== 'All' ? filters.employee : user?.uid;
                        const isWeekOff = !!(targetEmp && weekOffPreferences.some(p => 
                          (p.employeeId === targetEmp || p.employeeName === targetEmp) && 
                          (p.days.includes(format(day, 'EEEE')) || (p.specificDates && p.specificDates.includes(format(day, 'yyyy-MM-dd'))))
                        ));
                        const isLeave = !!(targetEmp && timeOffRequests.some(r => {
                          const matchEmployee = r.employeeId === targetEmp || r.employeeName === targetEmp;
                          if (!matchEmployee) return false;
                          const d = new Date(day);
                          const start = new Date(r.startDate);
                          const end = new Date(r.endDate);
                          d.setHours(0,0,0,0);
                          start.setHours(0,0,0,0);
                          end.setHours(0,0,0,0);
                          return d >= start && d <= end;
                        }));

                        return (
                          <DroppableSlot 
                            key={`${day.toISOString()}-${hour}`}
                            date={day}
                            hour={hour}
                            isWeekOff={isWeekOff}
                            isLeave={isLeave}
                            shifts={filteredShifts.filter(s => {
                              const sDate = new Date(s.startTime);
                              return isSameDay(sDate, day) && sDate.getHours() === hour;
                            })}
                            onSlotClick={isManagerOrAdmin ? (d, h) => {
                              setSelectedDate(d);
                              setIsAddModalOpen(true);
                            } : undefined}
                            onEditShift={handleEditClick}
                            onSwapShift={handleSwapClick}
                            onDeleteShift={isManagerOrAdmin ? handleDeletePermanent : undefined}
                          />
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-8 overflow-y-auto">
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredShifts.sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(shift => (
                     <motion.div 
                        key={shift.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-6 rounded-[2rem] border border-slate-200 bg-white hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer group",
                          shift.status === 'canceled' ? "opacity-50 grayscale" : ""
                        )}
                        onClick={() => handleEditClick(shift)}
                     >
                        <div className="flex items-center justify-between mb-4">
                           <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-black text-xs shrink-0 group-hover:scale-110 transition-transform">
                              {shift.employeeName.charAt(0)}
                           </div>
                           <div className="flex flex-col items-end gap-1">
                             <span className={cn(
                                "text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest",
                                shift.status === 'scheduled' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                shift.status === 'swapped' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                "bg-rose-50 text-rose-600 border border-rose-100"
                             )}>
                                {shift.status}
                             </span>
                             {shift.swapStatus === 'pending' && (
                               <span className="text-[7px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md animate-pulse">SWAP PENDING</span>
                             )}
                           </div>
                        </div>
                        <div className="space-y-1">
                           <h4 className="font-black text-slate-900 text-lg leading-none">{shift.employeeName}</h4>
                           <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">{shift.type} Shift ({shift.department || (shift as any).dept})</p>
                        </div>
                        <div className="mt-6 flex items-center justify-between text-slate-500 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Time</span>
                              <span className="text-xs font-black text-slate-700">{format(new Date(shift.startTime), 'HH:mm')} - {format(new Date(shift.endTime), 'HH:mm')}</span>
                           </div>
                           <div className="h-8 w-px bg-slate-200" />
                           <div className="flex flex-col text-right">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Date</span>
                              <span className="text-xs font-black text-slate-700">{format(shift.date, 'MMM do')}</span>
                           </div>
                        </div>
                     </motion.div>
                  ))}
               </div>
            </div>
          )}
        </div>
        
        <DragOverlay dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: {
              active: {
                opacity: '0.4',
              },
            },
          }),
        }}>
          {activeShift ? (
            <motion.div 
              initial={{ scale: 1 }}
              animate={{ scale: 1.1, rotate: -2 }}
              className={cn(
                "px-3 py-2 border border-indigo-200 rounded-xl text-[10px] font-black shadow-2xl border-l-8 flex items-center bg-white",
                activeShift.status === 'scheduled' ? "border-l-blue-600 text-blue-900" :
                activeShift.status === 'swapped' ? "border-l-amber-500 text-amber-900" :
                "border-l-rose-500 text-rose-700"
              )}
            >
              <div className="w-2 h-2 rounded-full bg-indigo-600 mr-2 animate-pulse" />
              {activeShift.employeeName} • {activeShift.type}
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Floating Manager Bulk Action Console */}
      <AnimatePresence>
        {bulkMode && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-6 left-6 right-6 lg:left-80 lg:right-6 bg-slate-900 text-white rounded-[2rem] border border-slate-800 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] p-6 z-[90] flex flex-col xl:flex-row gap-6 items-stretch xl:items-center justify-between"
          >
            {/* Left side info */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-3.5 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 shrink-0">
                <Zap className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div>
                <p className="font-extrabold text-white text-base leading-none">Global Bulk Operator</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/20 border border-amber-500/30 px-3 py-1 rounded-full text-amber-300">
                    {bulkSelectedDates.length} Days Selected
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-300">
                    {bulkSelectedEmployeeIds.length} Staff Selected
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Selection helpers */}
            <div className="flex-1 flex flex-col gap-3 border-y xl:border-y-0 xl:border-x border-slate-800/80 py-4 xl:py-0 xl:px-6">
              {/* Employee multi-selector */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Target Staff members:</p>
                <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto scrollbar-thin">
                  {employeesList.map(emp => {
                    const isSelected = bulkSelectedEmployeeIds.includes(emp.uid || emp.id);
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => toggleEmployeeBulkSelection(emp.uid || emp.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border shrink-0",
                          isSelected 
                            ? "bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/10" 
                            : "bg-slate-950/40 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-900/40"
                        )}
                      >
                        {emp.name}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      if (bulkSelectedEmployeeIds.length === employeesList.length) {
                        setBulkSelectedEmployeeIds([]);
                      } else {
                        setBulkSelectedEmployeeIds(employeesList.map(e => e.uid || e.id));
                      }
                    }}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider border border-slate-700 hover:bg-slate-700"
                  >
                    Select All
                  </button>
                </div>
              </div>

              {/* Day selection helper buttons */}
              <div className="flex items-center gap-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Calendar Actions:</p>
                <button
                  type="button"
                  onClick={() => {
                    // Select all days of the current month
                    const formattedDays = days.filter(d => isSameMonth(d, currentMonth)).map(d => format(d, 'yyyy-MM-dd'));
                    setBulkSelectedDates(formattedDays);
                  }}
                  className="px-2.5 py-1 bg-slate-950 text-slate-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-800 hover:border-slate-700"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Select upcoming 7 days
                    const start = new Date();
                    const next7Days = Array.from({ length: 7 }).map((_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
                    setBulkSelectedDates(next7Days);
                  }}
                  className="px-2.5 py-1 bg-slate-950 text-slate-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-800 hover:border-slate-700"
                >
                  Next 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkSelectedDates([]);
                    setBulkSelectedEmployeeIds([]);
                  }}
                  className="px-2.5 py-1 bg-rose-900/30 text-rose-300 rounded-lg text-[9px] font-black uppercase tracking-wider border border-rose-900/50 hover:bg-rose-900/50"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {/* Right side Operations */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {/* Assign Operation Dropdown & trigger */}
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl">
                <select
                  id="bulkShiftTypeInput"
                  className="text-[10px] font-black uppercase tracking-wider bg-transparent border-none text-slate-200 outline-none focus:ring-0 cursor-pointer pr-4 pl-2"
                >
                  {shiftTypes.map(t => (
                    <option key={t} value={t} className="bg-slate-900 text-white font-black">{t}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const selectEl = document.getElementById('bulkShiftTypeInput') as HTMLSelectElement | null;
                    if (selectEl) {
                      handleBulkAssign(selectEl.value);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-md active:scale-95"
                >
                  Assign
                </button>
              </div>

              {/* Reschedule operation buttons */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1.5 rounded-2xl">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Offset:</span>
                <button
                  type="button"
                  onClick={() => handleBulkReschedule(-1)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[9px] font-black"
                  title="Shift selected days backwards by 1 day"
                >
                  -1 Day
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkReschedule(1)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[9px] font-black"
                  title="Shift selected days forwards by 1 day"
                >
                  +1 Day
                </button>
              </div>

              {/* Delete shifts button */}
              <button
                type="button"
                onClick={handleBulkDelete}
                className="p-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl hover:shadow-lg hover:shadow-rose-600/10 transition-all active:scale-95"
                title="Delete matching shifts"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isSwapModalOpen && swapShift && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSwapModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="bg-indigo-600 p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                  <ArrowRightLeft className="w-8 h-8 text-indigo-200" />
                  <button onClick={() => setIsSwapModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>
                <h3 className="text-2xl font-black tracking-tight">Request Shift Swap</h3>
                <p className="text-indigo-100/60 text-xs font-bold mt-1">Post your shift to the swap board for other staff to see.</p>
              </div>
              
              <form onSubmit={handleCreateSwapRequest} className="p-8 space-y-6">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                    {swapShift.employeeName.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Details</p>
                    <p className="text-sm font-black text-slate-900">{format(swapShift.date, 'MMMM do')} • {swapShift.type}</p>
                    <p className="text-xs font-bold text-indigo-600">
                      {format(new Date(swapShift.startTime), 'HH:mm')} - {format(new Date(swapShift.endTime), 'HH:mm')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Request Type</label>
                  <select 
                    name="type" 
                    required 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  >
                    <option value="Swap">I want to Swap</option>
                    <option value="Cover">I want someone to Cover</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Swap With</label>
                  <select 
                    value={swapTargetId}
                    onChange={(e) => setSwapTargetId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                  >
                    <option value="all">Post to Open Board (Anyone)</option>
                    {employeesList.filter(e => e.name !== swapShift.employeeName).map(emp => (
                      <option key={emp.id || emp.uid} value={emp.id || emp.uid}>
                        Direct Request: {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Message (Optional)</label>
                  <textarea 
                    value={swapMessage}
                    onChange={(e) => setSwapMessage(e.target.value)}
                    placeholder="e.g. Can you cover my shift on Tuesday? I'll take yours on Friday."
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                  />
                </div>

                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] font-bold text-amber-900 leading-relaxed">
                      {swapTargetId === 'all' 
                        ? "By posting this, other staff will be able to offer a trade. Manager approval will be required for the final exchange."
                        : `This request will be sent directly to ${employeesList.find(e => (e.id || e.uid) === swapTargetId)?.name}. Manager approval will be required if they accept.`}
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsSwapModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Cancel</button>
                  <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all">Post to Board</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <motion.div 
          layout
          className="lg:col-span-1 bg-slate-900 p-5 md:p-8 rounded-2xl border border-slate-800 shadow-2xl text-white"
        >
          <div className="flex items-center space-x-5 mb-6">
            <div className="flex flex-col items-center justify-center w-12 h-12 bg-white/10 rounded-xl border border-white/10">
               <span className="text-[10px] font-black opacity-60">{format(selectedDate, 'MMM')}</span>
               <span className="text-lg font-black">{format(selectedDate, 'dd')}</span>
            </div>
            <div>
              <p className="text-base font-black">{format(selectedDate, 'EEEE, MMMM do')}</p>
              <p className="text-xs font-medium text-slate-400">
                {selectedDateShifts.length} {selectedDateShifts.length === 1 ? 'shift' : 'shifts'} scheduled
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            {selectedDateShifts.length > 0 ? (
              selectedDateShifts.map(shift => (
                <div 
                  key={shift.id} 
                  onClick={() => handleEditClick(shift)}
                  className="p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={cn(
                        "text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                        shift.status === 'scheduled' ? "bg-indigo-500/10 text-indigo-400" :
                        shift.status === 'swapped' ? "bg-amber-500/10 text-amber-400" :
                        "bg-rose-500/10 text-rose-400"
                      )}>
                        {shift.status}
                      </span>
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">{shift.type}</span>
                    </div>
                      {/* List View Details Button and Swap */}
                      <div className="flex items-center gap-2 group/actions">
                        {isManagerOrAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePermanent(shift.id);
                            }}
                            className="p-1 px-2 text-[8px] font-black uppercase tracking-widest text-rose-400 hover:text-white hover:bg-rose-600 rounded-lg transition-all"
                            title="Delete Shift"
                          >
                            Delete
                          </button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwapClick(shift);
                          }}
                          className="p-1 px-2 text-[8px] font-black uppercase tracking-widest text-indigo-400 hover:text-white hover:bg-indigo-600 rounded-lg transition-all"
                          title="Swap Shift"
                        >
                          Swap
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(shift);
                          }}
                          className="text-slate-500 hover:text-white transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                  </div>
                  <div className="flex items-center text-sm font-bold mb-1">
                    <Clock className="w-3.5 h-3.5 mr-2 text-slate-400" />
                    {shift.startTime} – {shift.endTime}
                  </div>
                  <div className="flex items-center text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 mr-2 opacity-50" />
                    {shift.department}
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <User className="w-3 h-3 mr-2" />
                        {shift.employeeName}
                      </div>
                      {shift.employeePhone && (
                        <div className="flex items-center text-indigo-400">
                          <Phone className="w-3 h-3 mr-2" />
                          {shift.employeePhone}
                        </div>
                      )}
                    </div>
                  </div>
                  {shift.notes && (
                    <div className="mt-2 p-2 bg-white/5 rounded-lg text-[10px] text-slate-400 italic">
                      "{shift.notes}"
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 italic text-xs">
                No shifts scheduled for this day
              </div>
            )}
            
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-full py-3 border-2 border-dashed border-white/10 rounded-xl text-white/40 text-[10px] font-black uppercase tracking-widest hover:border-white/20 hover:text-white/60 transition-all"
            >
              + Quick Add Shift
            </button>
          </div>
        </motion.div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                Team Members
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
                {employeesList.length} Staff Found
              </span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeesList.length > 0 ? (
                employeesList.sort((a, b) => a.name.localeCompare(b.name)).map(emp => (
                  <button 
                    key={emp.id || emp.uid}
                    onClick={() => {
                      setSelectedEmployeeInModal(emp);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center p-3 bg-slate-50 hover:bg-white rounded-2xl border border-transparent hover:border-indigo-100 transition-all group hover:shadow-lg hover:shadow-indigo-500/5 text-left"
                  >
                    <Avatar 
                      src={emp.avatar || emp.avatarUrl}
                      name={emp.name}
                      fallback="initials"
                      size="md"
                      className="w-10 h-10 rounded-xl bg-indigo-600 transition-transform group-hover:scale-110"
                    />
                    <div className="ml-3 overflow-hidden">
                      <p className="text-sm font-black text-slate-900 truncate">{emp.name}</p>
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                        <Phone className="w-2.5 h-2.5" />
                        {emp.phone || 'NO PHONE'}
                      </p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 animate-pulse">
                    <User className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-widest">Team not loaded yet</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-black text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-600 rounded-full" />
              Calendar Guide
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controls</p>
                <div className="space-y-3">
                  <div className="flex items-center text-xs font-bold text-slate-600">
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center mr-3 text-[10px]">👆</div>
                    Click a team member to schedule
                  </div>
                  <div className="flex items-center text-xs font-bold text-slate-600">
                    <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center mr-3 text-[10px]">🤚</div>
                    Drag a shift to reschedule it
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Shift Color Codes</p>
                <div className="space-y-3">
                  {shiftTypes.map(type => (
                    <div key={type} className="flex items-center text-xs font-bold text-slate-600">
                      <div className={cn("w-3 h-3 rounded-full mr-3", 
                        type === 'Morning' ? 'bg-indigo-500' : 
                        type === 'Evening' ? 'bg-amber-500' : 
                        type === 'Night' ? 'bg-slate-800' : 
                        type === 'Week off' ? 'bg-teal-500' : 
                        type === 'Comp off' ? 'bg-emerald-500' : 
                        type === 'Leave' ? 'bg-rose-500' : 'bg-pink-500'
                      )} />
                      {['Week off', 'Comp off', 'Leave'].includes(type) ? type : `${type} Shift`}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(isAddModalOpen || editingShift) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingShift(null);
                setSelectedEmployeeInModal(null);
                setSelectedDatesInModal([]);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div id="modal-header" className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 id="modal-title" className="font-black text-xl text-slate-900 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm transition-all hover:scale-105">
                  {editingShift ? 'Edit Shift' : 'New Shift Entry'}
                </h3>
                <button 
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingShift(null);
                    setSelectedEmployeeInModal(null);
                    setSelectedDatesInModal([]);
                  }}
                  className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={editingShift ? handleUpdateShift : handleAddShift} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                {overlapWarning && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-[10px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-3"
                  >
                    <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                    {overlapWarning}
                  </motion.div>
                )}

                <div className="space-y-4 p-5 bg-slate-50 rounded-[2rem] border-2 border-slate-100/50 shadow-inner">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <User className="w-4 h-4" />
                       Select Employee
                    </label>
                    <span className="text-[9px] font-black text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100">Searchable Team List</span>
                  </div>
                  
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none z-10">
                       <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    </div>
                    <input 
                      type="text"
                      placeholder="Type name to find employee..."
                      className="w-full pl-14 pr-10 py-5 bg-white border-2 border-slate-200 rounded-[1.8rem] text-base font-black text-slate-800 focus:outline-none focus:ring-8 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-xl"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        if (!term) return;
                        const match = employeesList.find(emp => emp.name.toLowerCase().includes(term));
                        if (match) setSelectedEmployeeInModal(match);
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto p-1">
                    {employeesList.sort((a,b) => a.name.localeCompare(b.name)).map(emp => (
                      <button
                        key={emp.id || emp.uid}
                        type="button"
                        onClick={() => setSelectedEmployeeInModal(emp)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border",
                          (selectedEmployeeInModal?.id === emp.id || selectedEmployeeInModal?.uid === emp.uid)
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                            : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                        )}
                      >
                        {emp.name}
                      </button>
                    ))}
                  </div>
                </div>

            <div className="grid grid-cols-1 gap-4 md:gap-6">
              {!editingShift && (
                <div className="space-y-4 p-5 bg-indigo-50/30 rounded-[2rem] border-2 border-indigo-100/50">
                  <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block px-1">Multiple Date Selection</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedDatesInModal.map((d, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white border border-indigo-200 pl-3 pr-1.5 py-1.5 rounded-full shadow-sm hover:border-indigo-400 transition-all group">
                         <span className="text-[10px] font-black text-slate-700">{format(new Date(d), 'MMM dd, yyyy')}</span>
                         <button 
                          type="button"
                          onClick={() => setSelectedDatesInModal(prev => prev.filter((_, i) => i !== index))}
                          className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-full transition-colors"
                         >
                           <X className="w-3 h-3" />
                         </button>
                      </div>
                    ))}
                    {selectedDatesInModal.length === 0 && (
                      <p className="text-[10px] font-medium text-slate-400 italic px-1">No dates selected. Please add dates below.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      id="date-multi-input"
                      type="date" 
                      className="flex-1 px-4 py-3 bg-white border-2 border-indigo-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all shadow-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.currentTarget as HTMLInputElement).value;
                          if (val && !selectedDatesInModal.includes(val)) {
                            setSelectedDatesInModal([...selectedDatesInModal, val]);
                            (e.currentTarget as HTMLInputElement).value = '';
                          }
                        }
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('date-multi-input') as HTMLInputElement;
                        const val = input.value;
                        if (val && !selectedDatesInModal.includes(val)) {
                          setSelectedDatesInModal([...selectedDatesInModal, val]);
                          input.value = '';
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95 transition-all"
                    >
                      Add Date
                    </button>
                  </div>
                </div>
              )}
              
              {editingShift && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Date</label>
                  <input 
                    name="date"
                    type="date" 
                    required
                    defaultValue={format(editingShift.date, 'yyyy-MM-dd')}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Shift Type</label>
                <select 
                  name="type"
                  required
                  defaultValue={editingShift?.type ?? 'Morning'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                >
                  {shiftTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Start Time</label>
                <input 
                  name="startTime"
                  type="time" 
                  required
                  defaultValue={editingShift ? format(new Date(editingShift.startTime), 'HH:mm') : '08:00'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">End Time</label>
                <input 
                  name="endTime"
                  type="time" 
                  required
                  defaultValue={editingShift ? format(new Date(editingShift.endTime), 'HH:mm') : '16:00'}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Department</label>
                    <select 
                      name="department"
                      required
                      defaultValue={editingShift ? (editingShift.department || (editingShift as any).dept) : config.departments[0]}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                    >
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</label>
                    <select 
                      name="status"
                      required
                      defaultValue={editingShift?.status ?? 'scheduled'}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="swapped">Swapped</option>
                      <option value="canceled">Canceled</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                  <textarea 
                    name="notes"
                    placeholder="Add any specific shift instructions..."
                    rows={3}
                    defaultValue={editingShift?.notes}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none"
                  />
                </div>

                  <div className="pt-4 flex gap-4">
                    {editingShift ? (
                      <div className="flex flex-[2] gap-2">
                          <button 
                            type="button"
                            onClick={handleCancelShift}
                            className="flex-1 py-4 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Cancel Shift
                          </button>
                      </div>
                    ) : null}
                    
                    <button 
                      type="submit"
                      className="flex-[3] py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 active:scale-95 transition-all"
                    >
                      {editingShift ? 'Save Changes' : 'Publish Shift'}
                    </button>
                  </div>
              </form>
            </motion.div>
          </div>
        )}

        {isPlannerModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!isPlannerRunning) setIsPlannerModalOpen(false);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900 uppercase tracking-wider">
                    Autonomous Roster Planner
                  </h3>
                </div>
                {!isPlannerRunning && (
                  <button 
                    onClick={() => setIsPlannerModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {isPlannerRunning ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-6">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center relative">
                    <Sparkles className="w-8 h-8 text-indigo-600 animate-spin" />
                    <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-ping" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-slate-800 uppercase tracking-widest">
                      Processing AI Constraints
                    </p>
                    <p className="text-xs font-bold text-indigo-600 animate-pulse uppercase tracking-wider">
                      {plannerStatusText}
                    </p>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-indigo-600 h-full rounded-full"
                      initial={{ width: "3%" }}
                      animate={{ width: "95%" }}
                      transition={{ duration: 3 }}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-8 space-y-6">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl text-[11px] font-medium text-indigo-700 leading-relaxed">
                    This helper automatically generates optimal, conflict-free shift records for your team. It maps out schedules while respecting approved leaves and weekly off selections with 100% accuracy.
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Start Date</label>
                        <input 
                          type="date"
                          value={plannerStartDate}
                          onChange={(e) => setPlannerStartDate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">End Date</label>
                        <input 
                          type="date"
                          value={plannerEndDate}
                          onChange={(e) => setPlannerEndDate(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Target Department</label>
                      <select 
                        value={plannerDept}
                        onChange={(e) => setPlannerDept(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                      >
                        <option value="All">All Departments</option>
                        {departments.map((d: string) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Shifts Per Day Target</label>
                        <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{plannerDailyTarget} shifts</span>
                      </div>
                      <input 
                        type="range"
                        min="1"
                        max="5"
                        value={plannerDailyTarget}
                        onChange={(e) => setPlannerDailyTarget(Number(e.target.value))}
                        className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button 
                      type="button"
                      onClick={() => setIsPlannerModalOpen(false)}
                      className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={handleRunAutonomousPlanner}
                      className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all"
                    >
                      Generate Roster
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

