export type UserRole = 'manager' | 'employee' | 'admin' | 'super_admin' | 'normal' | 'hr';

export interface User {
  uid: string;
  employeeId?: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  phone?: string;
  designation?: string;
  address?: string;
  joiningDate?: string;
  avatarUrl?: string;
  avatar?: string;
  skillTags?: string[];
  preferences?: UserPreferences;
  createdAt: string;
}

export interface UserPreferences {
  shiftReminderMinutes: number;
  notifyOnLateClockIn: boolean;
  notifyOnSwapRequest: boolean;
  notifyOnSwapOffers?: boolean;
  notifyOnManagerComments?: boolean;
  notifyOnScheduleRelease?: boolean;
  notifyOnTimeOffChange?: boolean;
  digestFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  preferredChannels?: {
    email: boolean;
    inApp: boolean;
    push: boolean;
  };
  theme?: 'light' | 'dark' | 'system';
}

export type ShiftStatus = 'scheduled' | 'completed' | 'swapped' | 'canceled';
export type ShiftType = 'Morning' | 'Evening' | 'Night' | 'Overtime' | 'Week off' | 'Comp off' | 'Leave';

export interface Shift {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePhone?: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  type: ShiftType;
  department: string;
  notes?: string;
  location?: string;
  swapRequestId?: string;
  swapRequesterId?: string;
  swapRequesterName?: string;
  swapTargetId?: string;
  swapTargetName?: string;
  swapStatus?: 'pending' | 'approved' | 'declined';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  timestamp: string;
  type: 'check-in' | 'check-out' | 'break-start' | 'break-end';
  photoUrl: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}

export type RequestStatus = 'pending' | 'offered' | 'accepted' | 'approved' | 'declined' | 'completed' | 'rejected' | 'responded';

export interface SwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterAvatar?: string;
  date: string;
  time: string;
  department: string;
  dept?: string;
  type: 'Swap' | 'Cover';
  message?: string;
  status: RequestStatus;
  targetEmployeeId?: string;
  targetEmployeeName?: string;
  targetMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: RequestStatus;
  createdAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  shiftId: string;
  clockIn: string;
  clockOut?: string;
  location?: string;
}

export interface WeekOffPreference {
  id: string;
  employeeId: string;
  employeeName: string;
  days: string[];
  specificDates?: string[];
  status: 'pending' | 'approved' | 'rejected';
  reason?: string;
  requestedAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'shift_change' | 'swap_request' | 'time_off_approval' | 'work_report';
  createdAt: string;
}

export interface WorkReport {
  id: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftDate: string;
  shiftType: string;
  tasksCompleted: string;
  handoverNotes?: string;
  issuesEncountered?: string;
  submittedAt: string;
  status: 'draft' | 'submitted' | 'reviewed';
  managerComments?: string;
}
