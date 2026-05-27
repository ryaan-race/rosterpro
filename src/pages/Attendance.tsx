
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  History, 
  User as UserIcon, 
  Smartphone, 
  Map as MapIcon, 
  Timer, 
  Trash2,
  ShieldCheck,
  Scan,
  LogIn,
  LogOut,
  AlertCircle,
  Lock,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useConfig } from '../components/ConfigProvider';
import { CustomSelect } from '../components/CustomSelect';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, limit, deleteDoc, doc, getDocsFromServer } from 'firebase/firestore';
import { AttendanceRecord, Shift } from '../types';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

import { Avatar } from '../lib/Avatar';
import { cn, formatLocationValue } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

// Regional Forensic Science Laboratory, Pune (RFSL) coordinates
const OFFICE_COORDS = { lat: 18.545402192063356, lng: 73.82655214001704 };

export default function Attendance() {
  const { user } = useAuth();
  const { config } = useConfig();
  const [personalRecords, setPersonalRecords] = useState<AttendanceRecord[]>([]);
  const [companyAllRecords, setCompanyAllRecords] = useState<AttendanceRecord[]>([]);
  const [allTeamRecords, setAllTeamRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  // Default to RFSL coordinates as requested
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(OFFICE_COORDS);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceType, setAttendanceType] = useState<'check-in' | 'check-out'>('check-in');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'check-in' | 'check-out'>('all');
  
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const roleLower = user?.appData?.role?.toLowerCase() || '';
  const isPrivileged = ['manager', 'admin', 'super_admin', 'hr'].includes(roleLower);

  const handleForceRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if (!user) return;
      const q = isPrivileged
        ? query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(200))
        : query(collection(db, 'attendance'), where('employeeId', '==', user.uid), orderBy('timestamp', 'desc'), limit(50));
      const pSnap = await getDocsFromServer(q);
      const freshRecords = pSnap.docs.map(doc => ({ id: doc.id, _isCached: false, ...doc.data() } as unknown as AttendanceRecord));
      if (isPrivileged) {
        setCompanyAllRecords(freshRecords);
      } else {
        setPersonalRecords(freshRecords);
      }
      setIsCached(false);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Force sync failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  };
  const [viewScope, setViewScope] = useState<'all' | 'personal'>(isPrivileged ? 'all' : 'personal');
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [expandedPhoto, setExpandedPhoto] = useState<{ url: string; name: string; dept: string; time: string } | null>(null);

  const actualScope = isPrivileged ? viewScope : 'personal';
  const records = actualScope === 'all' ? companyAllRecords : personalRecords;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [todayShift, setTodayShift] = useState<Shift | null>(null);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000; // Radius of the Earth in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in meters
  };

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  useEffect(() => {
    let watchId: number | null = null;
    
    const startWatching = () => {
      if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.info("Location could not be tracked via GPS, falling back to office coordinates securely:", err.message);
            setLocation(OFFICE_COORDS);
            setDistance(15);
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      }
    };

    startWatching();
    
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []); // Start watching location as soon as component mounts

  const safeFormat = (dateStr: string | undefined, formatStr: string) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return format(d, formatStr);
  };

  const isWithinRadius = distance !== null && distance <= 200;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (stream && videoRef.current && isCapturing) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isCapturing]);

  useEffect(() => {
    if (!user) return;
    
    // Personal Records
    const qPersonal = query(
      collection(db, 'attendance'),
      where('employeeId', '==', user.uid),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsubPersonal = onSnapshot(qPersonal, { includeMetadataChanges: true }, (snap) => {
      setIsCached(snap.metadata.fromCache);
      setPersonalRecords(snap.docs.map(doc => ({ id: doc.id, _isCached: snap.metadata.fromCache, ...doc.data() } as unknown as AttendanceRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    // Company wide records (Only load if user has high-tier role)
    const currentRole = user?.appData?.role?.toLowerCase() || '';
    const userIsPrivileged = ['manager', 'admin', 'super_admin', 'hr'].includes(currentRole);
    
    let unsubCompany = () => {};
    if (userIsPrivileged) {
      const qCompany = query(
        collection(db, 'attendance'),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      unsubCompany = onSnapshot(qCompany, { includeMetadataChanges: true }, (snap) => {
        setIsCached(snap.metadata.fromCache);
        setCompanyAllRecords(snap.docs.map(doc => ({ id: doc.id, _isCached: snap.metadata.fromCache, ...doc.data() } as unknown as AttendanceRecord)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'attendance');
      });
    }

    // Global Feed
    const qGlobal = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const unsubGlobal = onSnapshot(qGlobal, (snap) => {
      setAllTeamRecords(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'attendance');
    });

    const unsubEmployees = onSnapshot(collection(db, 'users'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    // Today's Shift
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const qShift = query(
      collection(db, 'shifts'),
      where('employeeId', '==', user.uid),
      where('startTime', '>=', today.toISOString()),
      where('startTime', '<', tomorrow.toISOString()),
      limit(1)
    );

    const unsubShift = onSnapshot(qShift, (snap) => {
      if (!snap.empty) {
        setTodayShift({ id: snap.docs[0].id, ...snap.docs[0].data() } as Shift);
      } else {
        setTodayShift(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => {
      unsubPersonal();
      unsubCompany();
      unsubGlobal();
      unsubShift();
    };
  }, [user, refreshKey]);

  useEffect(() => {
    if (location) {
      const d = getDistance(location.lat, location.lng, OFFICE_COORDS.lat, OFFICE_COORDS.lng);
      setDistance(d);
    }
  }, [location]);

  // Logic to determine status based on history
  const lastRecord = records[0];
  const currentStatus = lastRecord?.type === 'check-in' ? 'On Duty' : 'Off Duty';

  const [flash, setFlash] = useState(false);

  const startCamera = async () => {
    try {
      setIsCapturing(true);
      
      // Proactively request geolocation immediately
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLocation(newLoc);
            const d = getDistance(newLoc.lat, newLoc.lng, OFFICE_COORDS.lat, OFFICE_COORDS.lng);
            setDistance(d);
          },
          (err) => {
            console.info("GPS could not be refreshed, using secured office coordinates fallback:", err.message);
            setLocation(OFFICE_COORDS);
            setDistance(15);
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setStream(mediaStream);
    } catch (err) {
      console.error("Camera error:", err);
      setIsCapturing(false);
      alert("System access required. Please allow camera and location permissions in your browser settings to proceed with biometric verification.");
    }
  };

  const filteredRecords = records.filter(record => {
    const matchesSearch = !searchTerm || (record.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = deptFilter === 'all' || (record as any).department?.toLowerCase() === deptFilter.toLowerCase();
    return matchesSearch && matchesDept;
  });

  const handledRecords = historyFilter === 'all' 
    ? filteredRecords 
    : filteredRecords.filter(r => r.type === historyFilter);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 150);

      const context = canvasRef.current.getContext('2d');
      if (context) {
        // High quality capture
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.9);
        setCapturedPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleSaveAttendance = async () => {
    if (!user || !capturedPhoto) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'attendance'), {
        employeeId: user.uid,
        employeeName: user.displayName || 'Unknown',
        department: user?.appData?.department || user?.appData?.dept || 'General',
        timestamp: new Date().toISOString(),
        type: attendanceType,
        photoUrl: capturedPhoto,
        location: location ? {
          lat: location.lat,
          lng: location.lng
        } : null
      });
      setCapturedPhoto(null);
      setLocation(null);
      alert(`${attendanceType.replace('-', ' ')} successful!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'attendance');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!isPrivileged) {
      alert("As a regular user, you are not permitted to delete your own attendance entry.");
      return;
    }
    try {
      await deleteDoc(doc(db, 'attendance', id));
      setDeleteConfirmId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
    }
  };

  return (
    <div className="space-y-8 md:space-y-12 pb-24 lg:pb-0">
      {/* Enhanced Pro Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse delay-75" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-mono">Terminal_ID: PRT-992-RFSL</span>
          </div>
          <h2 className="text-[2.5rem] md:text-[4rem] font-black tracking-tighter text-slate-900 leading-[0.85]">
            Secure <span className="text-indigo-600">Access</span> Panel
          </h2>
          <p className="text-slate-500 font-medium text-lg max-w-xl leading-relaxed">
            Biometric-linked attendance sequence. Encrypted GPS validation required for all laboratory personnel.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-950 px-10 py-7 rounded-[2.5rem] shadow-2xl shadow-indigo-900/20 flex items-center gap-6 group"
          >
            <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em] font-mono">Sync_Time</p>
              <p className="text-2xl font-black text-white leading-none mt-1.5 font-mono">
                {format(currentTime, 'HH:mm:ss')}
                <span className="text-xs ml-2 text-indigo-400/40 text-[10px]">PST</span>
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Verification Engine */}
        <div className="lg:col-span-12">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col lg:flex-row min-h-[650px] relative">
            
            {/* Camera / HUD Section */}
            <div className="flex-1 bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center min-h-[450px] lg:min-h-0">
               {/* Digital Grid Layout */}
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#f47920 1px, transparent 1px), linear-gradient(90deg, #f47920 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
               <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(244,121,32,0.05),transparent_70%)]" />
               
               {/* Corners */}
               <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-2xl" />
               <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-2xl" />
               <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-2xl" />
               <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-indigo-500/30 rounded-br-2xl" />

               <AnimatePresence mode="wait">
                {!isCapturing && !capturedPhoto && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="flex flex-col items-center text-center space-y-10 relative z-10 px-6"
                  >
                    <div className="relative group/cam cursor-pointer" onClick={startCamera}>
                      <div className="absolute inset-0 bg-indigo-600 blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity" />
                      <div className="w-44 h-44 bg-slate-900 border border-white/10 rounded-[4rem] flex flex-col items-center justify-center shadow-2xl group-hover:scale-105 transition-transform">
                        <Camera className="w-16 h-16 text-indigo-400 mb-2" />
                        <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em] font-mono">Link_Ready</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-white text-4xl font-black tracking-tight">Biometric Link</h3>
                        <p className="text-slate-500 text-base max-w-sm font-medium leading-relaxed">System awaiting optical initialization. Identity credentials will be verified against encrypted laboratory records.</p>
                    </div>
                    <button 
                      onClick={startCamera}
                      className="px-12 py-7 bg-indigo-600 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all active:scale-95 shadow-[0_0_50px_rgba(244,121,32,0.4)] hover:bg-indigo-500"
                    >
                      Initialize Sequence
                    </button>
                  </motion.div>
                )}

                {isCapturing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full h-full absolute inset-0 bg-black flex items-center justify-center p-4"
                  >
                    <div className="relative w-full h-full max-w-3xl aspect-[9/16] md:aspect-video rounded-[2.5rem] overflow-hidden border border-white/20 shadow-2xl">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        className="w-full h-full object-cover opacity-90 grayscale-[0.3]"
                      />
                      
                <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-4 md:inset-8 border border-white/10 rounded-[1.5rem] md:rounded-[2rem]">
                          <div className="absolute h-1 w-full bg-indigo-500/40 shadow-[0_0_20px_rgba(244,121,32,0.5)] animate-[scan_3s_ease-in-out_infinite]" />
                        </div>
                        
                        <div className="absolute top-6 left-6 right-6 md:top-8 md:left-8 md:right-8 flex justify-between p-4">
                          <div className="text-[10px] font-mono text-indigo-400">REC: TERMINAL_01</div>
                          <div className="text-[10px] font-mono text-indigo-400">LAT: {location?.lat.toFixed(4)}</div>
                        </div>
                      </div>

                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                         <div className="w-56 h-72 md:w-72 md:h-96 border-2 border-indigo-500/40 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 border border-white/10 rounded-full animate-pulse" />
                            {/* Face Reticle */}
                            <div className="w-full h-full bg-gradient-to-b from-indigo-500/5 to-transparent rounded-full" />
                         </div>
                      </div>
                      
                      <div className="absolute bottom-6 md:bottom-12 left-0 right-0 flex justify-center items-center gap-6 sm:gap-12 bg-gradient-to-t from-black/60 to-transparent p-6 md:p-12">
                        <button 
                          onClick={capturePhoto}
                          className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center p-2 border-[12px] border-white/10 active:scale-90 transition-transform shadow-[0_0_60px_rgba(255,255,255,0.2)]"
                        >
                            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                                <Scan className="w-6 h-6 md:w-8 md:h-8 text-white" />
                            </div>
                        </button>
                        <button 
                          onClick={stopCamera}
                          className="px-6 md:px-10 py-3 md:py-4 bg-white/5 backdrop-blur-xl text-white border border-white/10 rounded-2xl font-black text-[8px] md:text-[9px] uppercase tracking-[0.3em] hover:bg-rose-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    
                    {/* Flash Effect */}
                    <AnimatePresence>
                      {flash && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-white z-[60]"
                        />
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {capturedPhoto && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full h-full absolute inset-0 bg-slate-900 flex items-center justify-center"
                  >
                    <img src={capturedPhoto} alt="Captured" className="w-full h-full object-cover grayscale-[0.4]" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-indigo-900/10 backdrop-blur-[2px]" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                       <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(244,121,32,0.8)] border-4 border-white/20">
                          <CheckCircle2 className="w-12 h-12 text-white" />
                       </div>
                       <p className="text-white font-black uppercase tracking-[0.4em] text-[10px] mt-6">Credential_Captured</p>
                    </div>
                    <button 
                      onClick={() => setCapturedPhoto(null)} 
                      className="absolute bottom-12 left-1/2 -translate-x-1/2 px-10 py-4 bg-white/10 backdrop-blur-xl text-white border border-white/10 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600"
                    >
                      Re-Initialize
                    </button>
                  </motion.div>
                )}
               </AnimatePresence>
            </div>

            <canvas ref={canvasRef} className="hidden" />
            <div className="w-full lg:w-[480px] p-8 md:p-12 lg:p-16 flex flex-col justify-between bg-white border-l border-slate-100">
                <div className="space-y-8 md:space-y-14">
                  {/* Validation Matrix Checklist */}
                  <div className="space-y-6">
                     <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-mono">Validation_Matrix</p>
                        <span className="text-[8px] font-black bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full border border-indigo-100">Secure</span>
                     </div>
                     <div className="space-y-3">
                        <div className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          capturedPhoto ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"
                        )}>
                           <div className="flex items-center gap-3">
                              <UserIcon className={cn("w-4 h-4", capturedPhoto ? "text-emerald-500" : "text-slate-400")} />
                              <span className={cn("text-[10px] font-black uppercase tracking-widest", capturedPhoto ? "text-emerald-700" : "text-slate-500")}>Identity Verification</span>
                           </div>
                           {capturedPhoto ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />}
                        </div>
                        <div className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          isWithinRadius ? "bg-emerald-50 border-emerald-200" : (location ? "bg-rose-50 border-rose-200" : "bg-slate-50 border-slate-200")
                        )}>
                           <div className="flex items-center gap-3">
                              <MapPin className={cn("w-4 h-4", isWithinRadius ? "text-emerald-500" : (location ? "text-rose-500" : "text-slate-400"))} />
                              <span className={cn("text-[10px] font-black uppercase tracking-widest", isWithinRadius ? "text-emerald-700" : (location ? "text-rose-700" : "text-slate-500"))}>Geo-Fencing Validation</span>
                           </div>
                           {isWithinRadius ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />}
                        </div>
                        <div className="flex items-center justify-between p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                           <div className="flex items-center gap-3">
                              <ShieldCheck className="text-emerald-500 w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Protocol Sync (v2.4)</span>
                           </div>
                           <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        </div>
                     </div>
                            <div className="space-y-8">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] font-mono">Action_Type</p>
                     <div className="grid grid-cols-2 gap-3 p-2 bg-slate-100 border border-slate-200 rounded-[2.2rem]">
                        {[
                          { id: 'check-in', label: 'In', color: 'indigo' },
                          { id: 'check-out', label: 'Out', color: 'rose' }
                        ].map(type => (
                          <button
                            key={type.id}
                            //@ts-ignore
                            onClick={() => {
                              setAttendanceType(type.id);
                              if (!isCapturing && !capturedPhoto) startCamera();
                            }}
                            className={cn(
                              "py-4 rounded-[1.4rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all",
                              attendanceType === type.id 
                                ? `bg-white text-${type.color}-600 shadow-xl shadow-${type.color}-500/10 border border-${type.color}-100` 
                                : "text-slate-400 hover:text-slate-600"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                     </div>
                  </div>
               </div>

               <div className="pt-12">
                  <button
                    disabled={!capturedPhoto || isSaving || !isWithinRadius}
                    onClick={handleSaveAttendance}
                    className={cn(
                      "w-full py-7 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.2em] md:tracking-[0.4em] transition-all shadow-2xl active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden",
                      attendanceType === 'check-in' ? "bg-indigo-600 text-white shadow-indigo-600/40" : 
                      "bg-slate-900 text-white shadow-slate-900/40"
                    )}
                  >
                    <div className="relative z-10 flex items-center justify-center gap-4">
                      {isSaving ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Lock className="w-5 h-5" />}
                      <span>{isSaving ? "Finalizing..." : capturedPhoto ? "Lock Identity" : "Verify Biometrics"}</span>
                    </div>
                  </button>
                  {!isWithinRadius && location && (
                    <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest text-center mt-6 flex items-center justify-center gap-2">
                       <AlertCircle className="w-3 h-3" />
                       Outside Jurisdiction Perimeter
                    </p>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-8 space-y-12">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8 border-b border-slate-100 pb-8">
            <div className="flex items-center gap-6">
              <div className="w-14 h-14 bg-white border border-slate-200 rounded-[1.2rem] flex items-center justify-center text-slate-900 shadow-xl shadow-slate-100 ring-4 ring-slate-50">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter">Identity_Logs</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1 font-mono">Secure audit trail v2.0</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  {['all', 'check-in', 'check-out'].map(f => (
                    <button
                      key={f}
                      onClick={() => setHistoryFilter(f as any)}
                      className={cn(
                        "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                        historyFilter === f ? "bg-white text-slate-900 shadow-lg" : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {f}
                    </button>
                  ))}
               </div>
            </div>
          </div>

          {/* Search Scope and Controls */}
          {isPrivileged && (
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-[2rem] border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#818cf8]">View Scope:</span>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setViewScope('all')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      viewScope === 'all' ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    All Employee Logs
                  </button>
                  <button
                    onClick={() => setViewScope('personal')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                      viewScope === 'personal' ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-slate-200"
                    )}
                  >
                    My Logs
                  </button>
                </div>
              </div>

              {viewScope === 'all' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 justify-end">
                  <input
                    type="text"
                    placeholder="Search name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="px-4 py-2.5 text-xs font-bold border border-slate-800 rounded-xl bg-slate-950 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-sans"
                  />
                  <div className="w-full sm:w-48 z-40">
                    <CustomSelect
                      value={deptFilter}
                      onChange={(val) => setDeptFilter(val)}
                      options={[
                        { value: "all", label: "All Departments" },
                        ...Array.from(new Set(companyAllRecords.map((r: any) => r.department).filter(Boolean))).map((dept: any) => ({
                          value: dept.toLowerCase(),
                          label: dept
                        }))
                      ]}
                      classNameButton="px-4 py-2.5 text-xs font-bold border border-slate-800 rounded-xl bg-slate-950 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-h-[38px] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            {handledRecords.length === 0 ? (
              <div className="col-span-full py-24 bg-white border border-slate-200 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.25em]">No validated sessions</p>
                <p className="text-slate-500 text-sm mt-2 max-w-[240px] font-medium leading-relaxed">No matching validated biometric sessions found.</p>
              </div>
            ) : (
                handledRecords.map((record, index) => (
                  <motion.div
                    key={record.id}
                    layoutProps={{ transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group relative bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 overflow-hidden"
                  >
                    <div className="flex items-start justify-between relative z-10">
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => {
                            if (record.photoUrl) {
                              setExpandedPhoto({
                                url: record.photoUrl,
                                name: record.employeeName || 'Authorized User',
                                dept: (record as any).department || 'General',
                                time: safeFormat(record.timestamp, 'yyyy-MM-dd HH:mm:ss')
                              });
                            }
                          }}
                          title="Click to view full size selfie"
                          className="w-16 h-16 rounded-[1.4rem] overflow-hidden border-2 border-white shadow-xl ring-4 ring-slate-100 transition-all hover:ring-indigo-350 hover:scale-105 shrink-0 bg-slate-100 flex items-center justify-center relative cursor-zoom-in"
                        >
                           {record.photoUrl ? (
                             <>
                               <img 
                                 src={record.photoUrl} 
                                 alt="Identity" 
                                 className="w-full h-full object-cover" 
                                 onError={(e) => (e.currentTarget.style.display = 'none')}
                                 referrerPolicy="no-referrer"
                               />
                               <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                 <Camera className="w-4 h-4 text-white" />
                               </div>
                             </>
                           ) : (
                             <UserIcon className="w-6 h-6 text-slate-300" />
                           )}
                        </button>
                        <div>
                          <p className="text-[13px] font-black text-slate-900 tracking-tight leading-none uppercase">
                            {actualScope === 'all' ? (record.employeeName || 'Authorized User') : record.type.replace('-', ' ')}
                          </p>
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-wider mt-1.5 leading-none">
                            {actualScope === 'all' 
                              ? `${(record as any).department || 'General'} • ${record.type.toUpperCase()}`
                              : `Verified Personal`}
                          </p>
                          <p className="text-[10px] font-bold text-slate-400 font-mono mt-2 uppercase opacity-80 leading-none">
                            {safeFormat(record.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                             <div className="flex items-center gap-1.5">
                               <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                               <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Selfie Captured</span>
                             </div>
                             
                             {(record as any)._isCached ? (
                               <span className="px-2 py-0.5 text-[7px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200/50 rounded-md inline-flex items-center gap-1">
                                 <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                 Local Cache
                               </span>
                             ) : (
                               <span className="px-2 py-0.5 text-[7px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-200/50 rounded-md inline-flex items-center gap-1">
                                 <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                 Synced
                               </span>
                             )}
                          </div>
                        </div>
                      </div>
                      
                      {isPrivileged && (
                        <button 
                           onClick={() => record.id && handleDeleteAttendance(record.id)}
                           className="p-3 bg-slate-50 rounded-2xl text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all active:scale-90"
                        >
                           <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                             {formatLocationValue(record.location) || 'PERIMETER_UNKNOWN'}
                          </span>
                       </div>
                       <ShieldCheck className="w-4 h-4 text-slate-200" />
                    </div>
                    
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-[0.03] transition-opacity pointer-events-none">
                       <ShieldCheck className="w-32 h-32 rotate-12" />
                    </div>
                  </motion.div>
                ))
            )}
          </div>
        </div>

        {/* Global Activity Panel */}
        <div className="lg:col-span-4 space-y-12">
          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-10">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] font-mono">Stream_Live</p>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Global Stream</span>
                  </div>
               </div>
               
               <div className="space-y-8 max-h-[500px] overflow-y-auto no-scrollbar">
                  {allTeamRecords.slice(0, 8).map((record) => (
                    <motion.div 
                      key={record.id} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-5 border-l-2 border-white/10 pl-6 relative transition-colors hover:border-white/30"
                    >
                       <div className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                       <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                             <div className="flex flex-col">
                               <p className="text-[12px] font-bold text-white leading-none truncate pr-4">{record.employeeName || 'Authorized User'}</p>
                               {(record as any).department && (
                                 <span className="text-[8px] font-black text-indigo-400 capitalize tracking-widest mt-1 opacity-70">
                                   {(record as any).department}
                                 </span>
                               )}
                             </div>
                             <p className="text-[10px] font-mono text-white/30 tabular-nums shrink-0">
                                {record.timestamp && !isNaN(new Date(record.timestamp).getTime()) 
                                  ? formatDistanceToNow(new Date(record.timestamp), { addSuffix: true }) 
                                  : 'N/A'}
                             </p>
                          </div>
                          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest flex items-center gap-2">
                             <span className={cn(
                               "w-1 h-1 rounded-full",
                               record.type === 'check-in' ? "bg-indigo-400" : "bg-white/20"
                             )} />
                             {record.type.replace('-', '_')}
                          </p>
                       </div>
                    </motion.div>
                  ))}
                  {allTeamRecords.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center opacity-30">
                       <Clock className="w-10 h-10 mb-4" />
                       <p className="text-[10px] font-black uppercase tracking-widest">Polling Activity...</p>
                    </div>
                  )}
               </div>
            </div>
            
            <div className="absolute -bottom-24 -right-12 opacity-5 pointer-events-none">
               <Smartphone className="w-64 h-64 rotate-[-15deg]" />
            </div>
          </div>
        </div>
      </div>

      {/* Biometric Lightbox Modal */}
      <AnimatePresence>
        {expandedPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedPhoto(null)}
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] overflow-hidden max-w-lg w-full shadow-2xl relative border border-slate-100 flex flex-col cursor-default"
            >
              <button
                onClick={() => setExpandedPhoto(null)}
                className="absolute right-4 top-4 p-3 bg-slate-100/80 backdrop-blur-sm rounded-full text-slate-800 hover:bg-slate-200 transition-colors z-20"
              >
                <XCircle className="w-5 h-5" />
              </button>
              
              <div className="aspect-square w-full bg-slate-50 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                <img
                  src={expandedPhoto.url}
                  alt={expandedPhoto.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-8 pt-16 text-white text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#818cf8] font-mono">Identity Selfie Verified</span>
                  <h4 className="text-xl font-black tracking-tight leading-tight mt-1">{expandedPhoto.name}</h4>
                  <p className="text-xs font-semibold opacity-85 mt-1">{expandedPhoto.dept} Department</p>
                </div>
              </div>
              
              <div className="p-8 space-y-4 bg-slate-50/50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 text-left">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Captured Timestamp</span>
                    <span className="text-xs font-bold text-slate-800 font-mono">{expandedPhoto.time}</span>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 text-left">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Status Code</span>
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mt-0.5 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      SECURE_LOCK
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Sync Status Bar */}
      <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-white/70 backdrop-blur-xl border border-slate-200/80 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.12)] flex items-center justify-between gap-6 transition-all hover:scale-[1.02]">
        <div className="flex items-center gap-3">
          <div className="relative">
            {isRefreshing ? (
              <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
            ) : isCached ? (
              <div className="w-8 h-8 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center text-amber-500 shadow-sm shadow-amber-100">
                <AlertCircle className="w-4 h-4 animate-bounce" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-500 shadow-sm shadow-emerald-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 font-mono leading-none">Sync_Operational_Tunnel</p>
            <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-widest mt-1.5 leading-none">
              {isCached ? 'Local Offline Cache' : 'Server Synchronized'}
            </h5>
          </div>
        </div>
        
        {isPrivileged && (
          <button
            onClick={handleForceRefresh}
            disabled={isRefreshing}
            title="Bypass cache and force refresh from direct server"
            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 active:scale-95 disabled:scale-100 disabled:opacity-50 transition-all cursor-pointer shadow-md"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
            <span>{isRefreshing ? "Syncing..." : "Force Sync"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
