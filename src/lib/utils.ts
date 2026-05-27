import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseDateSafe(val: any): Date | null {
  if (val === undefined || val === null) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  // Firestore Timestamp with toDate method
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch (_) {
      return null;
    }
  }
  // Firestore Timestamp serialized as JSON
  if (typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  // String or Number
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDateSafe(date: any) {
  const d = parseDateSafe(date);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTimeSafe(date: any) {
  const d = parseDateSafe(date);
  if (!d) return '--:--';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatLocationValue(location: any): string {
  if (!location) return '';
  if (typeof location === 'string') return location;
  if (typeof location === 'object') {
    if (typeof location.lat === 'number' && typeof location.lng === 'number') {
      return `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`;
    }
    // If it's a Firestore timestamp or some other object, return a safe string or fall back
    try {
      return JSON.stringify(location);
    } catch (_) {
      return 'OBJECT_LOCATION';
    }
  }
  return String(location);
}

export function formatDate(date: Date | string) {
  const d = parseDateSafe(date);
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(date: Date | string) {
  const d = parseDateSafe(date);
  if (!d) return '--:--';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    timestamp: new Date().toISOString()
  };
  console.warn('Firestore Operational Status:', JSON.stringify(errInfo));
}

export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return "An unexpected authentication error occurred.";
  
  const errCode = error.code || (error.message && error.message.includes('auth/') ? 'auth/' + error.message.split('auth/')[1].split(')')[0] : '');
  const message = error.message || String(error);

  switch (errCode) {
    case 'auth/invalid-credential':
      return "Incorrect email address or password. Please verify your credentials and try again.";
    case 'auth/user-not-found':
      return "No registered account found under this email address.";
    case 'auth/wrong-password':
      return "Incorrect password. Please verify your entries and try again.";
    case 'auth/email-already-in-use':
      return "This email address is already registered to another user profile.";
    case 'auth/invalid-email':
      return "Please input a valid email address format (e.g. name@company.com).";
    case 'auth/weak-password':
      return "Password is too weak. Please ensure it is at least 6 characters with letters and numbers.";
    case 'auth/popup-closed-by-user':
      return "The connection popup was closed before completion. Please try again.";
    case 'auth/operation-not-allowed':
      return "This authentication protocol is not enabled. Please contact support.";
    case 'auth/too-many-requests':
      return "Access is temporarily suspended due to consecutive failed sign-in attempts. Please check back shortly.";
    case 'auth/user-disabled':
      return "Your user profile is currently deactivated. Please coordinate with Human Resources.";
    default:
      // Fallback clean parsing of Firebase raw messages
      if (message.includes('auth/invalid-credential') || message.includes('invalid-credential')) {
        return "Incorrect email address or password. Please verify your credentials and try again.";
      }
      if (message.includes('auth/email-already-in-use') || message.includes('email-already-in-use')) {
        return "This email address is already registered to another user profile.";
      }
      if (message.includes('auth/weak-password') || message.includes('weak-password')) {
        return "Password is too weak. Please ensure it is at least 6 characters with letters and numbers.";
      }
      if (message.includes('auth/invalid-email') || message.includes('invalid-email')) {
        return "Please input a valid email address format (e.g. name@company.com).";
      }
      return message.replace('Firebase:', '').replace('Error', '').replace(/[()]/g, '').trim() || "Authentication transaction failed.";
  }
}

export function getRolePermission(rolePermissions: any, roleId: string, permissionKey: string): boolean {
  const role = roleId?.toLowerCase() || 'normal';
  if (rolePermissions && rolePermissions[role]?.[permissionKey] !== undefined) {
    return rolePermissions[role][permissionKey];
  }
  
  // Default values mapping
  if (role === 'super_admin') return true;
  if (role === 'admin') {
    if (permissionKey === 'canDeletePersonnel') return false;
    return true;
  }
  if (role === 'manager') {
    return ['canApproveSwaps', 'canEditReports'].includes(permissionKey);
  }
  if (role === 'hr') {
    return ['canOnboardUsers'].includes(permissionKey);
  }
  return false;
}

export function hasPermission(user: any, config: any, permissionKey: string): boolean {
  const role = user?.appData?.role?.toLowerCase() || 'normal';
  return getRolePermission(config?.rolePermissions, role, permissionKey);
}

export function getAllowedSidebarTabs(user: any, config: any): string[] {
  const role = user?.appData?.role?.toLowerCase() || 'normal';
  const dept = (user?.appData?.department || '').toLowerCase();
  
  // NOC Department overrides:
  // "like NOC Users access only Dashboard, Shifts, Attendance, Time off, Shift Swaps and Work Reports Sidebar allow for NOC Department And Sector."
  if (dept === 'noc' || dept.includes('noc')) {
    return ['dashboard', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports'];
  }

  // Dynamic/Configurable Role-Based sidebar assignment
  if (config?.roleSidebar?.[role] !== undefined) {
    return config.roleSidebar[role];
  }

  // Fallback defaults
  const defaults: Record<string, string[]> = {
    super_admin: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'employees', 'reporting', 'adminhub', 'settings'],
    admin: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'employees', 'reporting', 'adminhub', 'settings'],
    manager: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'employees', 'reporting', 'adminhub', 'settings'],
    hr: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'employees', 'adminhub', 'settings'],
    normal: ['dashboard', 'calendar', 'matrix', 'attendance', 'timeoff', 'swaps', 'reports', 'settings']
  };

  return defaults[role] || defaults['normal'];
}


