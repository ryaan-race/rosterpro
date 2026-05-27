
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, onSnapshotDocSafe } from '../lib/firebase';
import { doc } from 'firebase/firestore';

interface AppConfig {
  companyName: string;
  companyLogo?: string;
  companyAddress: string;
  companyPhone: string;
  departments: string[];
  shiftTypes: { name: string; start: string; end: string }[];
  attendanceRadius: number;
  requirePhoto: boolean;
  rosterRules: {
    minRestHours: number;
    maxWeeklyHours: number;
    autoApproveSwaps: boolean;
  };
  notifications: {
    shiftReminderMinutes: number;
    alertOnLateClockIn: boolean;
    notifyManagerOnSwap: boolean;
  };
  systemStatus: 'Normal' | 'Peak' | 'Maintenance';
}

interface ConfigContextType {
  config: AppConfig;
  loading: boolean;
}

const defaultConfig: AppConfig = {
  companyName: 'ShiftSync',
  companyLogo: '',
  companyAddress: 'One Pulse Plaza, Technopark',
  companyPhone: '+1 (800) 555-0199',
  departments: [
    'Service Delivery / IT Operations',
    'IT Infrastructure',
    'Business Analysis / PMO',
    'System & Storage Management',
    'Network & Security',
    'IT Support Services',
    'System Administration',
    'Network Operations',
    'Database Administration',
    'IT Helpdesk Support',
    'Application Support Services',
    'Linux & Network Operations Center (NOC)'
  ],
  shiftTypes: [
    { name: 'Alpha (Morning)', start: '08:00', end: '16:00' },
    { name: 'Bravo (Evening)', start: '16:00', end: '00:00' },
    { name: 'Charlie (Night)', start: '00:00', end: '08:00' }
  ],
  attendanceRadius: 500,
  requirePhoto: true,
  rosterRules: {
    minRestHours: 11,
    maxWeeklyHours: 48,
    autoApproveSwaps: false
  },
  notifications: {
    shiftReminderMinutes: 60,
    alertOnLateClockIn: true,
    notifyManagerOnSwap: true
  },
  systemStatus: 'Normal'
};

const ConfigContext = createContext<ConfigContextType>({
  config: defaultConfig,
  loading: true,
});

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshotDocSafe<AppConfig>(
      doc(db, 'settings', 'config'),
      (data) => {
        setConfig(data);
        setLoading(false);
      },
      (error) => {
        console.error("Config fetch error:", error);
        setLoading(false);
      },
      'app_config'
    );

    return () => unsub();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => useContext(ConfigContext);
