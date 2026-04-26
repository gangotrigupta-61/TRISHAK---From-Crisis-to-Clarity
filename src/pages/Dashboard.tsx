import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, updateDoc, doc, getDocs, getDoc, serverTimestamp, arrayUnion, addDoc, deleteDoc, or, and } from 'firebase/firestore';
import { auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  ShieldAlert, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  ArrowRight,
  Activity,
  Zap,
  Plus,
  X,
  UserCog,
  ShieldCheck,
  Search,
  Ticket,
  MapPin,
  UserPlus,
  Phone,
  Shield,
  ArrowUpCircle,
  Timer,
  Mail,
  Globe,
  Volume2,
  VolumeX,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatTimestamp, getSeverityColor, getStatusColor, getRoleDisplayName } from '../lib/utils';
import { Incident, UserProfile, UserRole } from '../types';
import { SOS_TYPES, mapOldIncidentType } from '../constants';
import Modal from '../components/Modal';
import IncidentRoomComponent from '../components/IncidentRoomComponent';

function GlobalAlertBanner({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) return null;

  return (
    <motion.div 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-[100] bg-accent-emergency text-white py-3 px-4 shadow-2xl flex items-center justify-center gap-4 glow-red"
    >
      <ShieldAlert className="w-6 h-6 animate-bounce" />
      <span className="font-black text-sm md:text-base uppercase tracking-[0.2em] text-center">
        🚨 GLOBAL ALERT ACTIVE – Immediate Attention Required
      </span>
      <div className="hidden md:flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full text-[10px] font-black">
        {incidents.length} ACTIVE
      </div>
    </motion.div>
  );
}

function CountdownTimer({ targetTime }: { targetTime: any }) {
  const [timeLeft, setTimeLeft] = useState<string>('Calculating...');

  useEffect(() => {
    if (!targetTime) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const target = targetTime?.toMillis ? targetTime.toMillis() : new Date(targetTime).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft('Arriving now');
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  return <span className="font-black tabular-nums">{timeLeft}</span>;
}

function GuestIncidentCard({ incident }: { incident: Incident }) {
  const responders = Object.values(incident.responderDetails || {}).filter(r => r.status === 'responding');
  const earliestArrival = responders.length > 0 
    ? responders.reduce((prev, curr) => {
        const prevTime = prev.estimatedArrivalTime?.toMillis ? prev.estimatedArrivalTime.toMillis() : new Date(prev.estimatedArrivalTime).getTime();
        const currTime = curr.estimatedArrivalTime?.toMillis ? curr.estimatedArrivalTime.toMillis() : new Date(curr.estimatedArrivalTime).getTime();
        return prevTime < currTime ? prev : curr;
      })
    : null;

  return (
    <Link to={`/incident/${incident.id}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "bg-bg-secondary p-8 rounded-[3rem] text-text-primary shadow-2xl relative overflow-hidden border border-card-border transition-all duration-500",
          incident.isGlobal && "animate-pulse-red border-red-500 glow-red"
        )}
      >
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <ShieldAlert className="w-32 h-32" />
        </div>
        
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-accent-emergency rounded-2xl flex items-center justify-center shadow-lg shadow-red-900/20 glow-red">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black tracking-tight transition-colors">Emergency Active</h2>
                  {incident.isGlobal && (
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Globe className="w-3 h-3" /> GLOBAL
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary font-bold uppercase tracking-widest transition-colors">
                  {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type} • {incident.status}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-1">Status</p>
              <span className={cn(
                "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                incident.status === 'reported' ? "bg-red-500/10 text-red-500 border-red-500/30" : "bg-blue-500/10 text-blue-500 border-blue-500/30"
              )}>
                {incident.status}
              </span>
            </div>
          </div>

          <div className="bg-bg-primary p-6 rounded-[2rem] border border-card-border transition-colors">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black text-text-primary opacity-70 uppercase tracking-widest">Help is on the way</h3>
              {earliestArrival && (
                <div className="flex items-center gap-2 text-blue-500">
                  <Timer className="w-4 h-4" />
                  <CountdownTimer targetTime={earliestArrival.estimatedArrivalTime} />
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {responders.length > 0 ? (
                responders.map(r => (
                  <div key={r.uid} className="flex items-center justify-between bg-bg-secondary p-4 rounded-2xl border border-card-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-xs">
                        {r.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-text-primary">{r.name}</p>
                        <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{r.role}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest">ETA</p>
                      <p className="text-sm font-black text-blue-500">{r.eta}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-bg-secondary rounded-full flex items-center justify-center mb-3 animate-pulse border border-card-border">
                    <Clock className="w-6 h-6 text-text-secondary" />
                  </div>
                  <p className="text-sm font-bold text-text-secondary">Waiting for first responder to accept...</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end pt-2">
            <div className="flex items-center gap-2 text-blue-500 text-xs font-black uppercase tracking-widest">
              Enter Incident Room <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function Dashboard() {
  const { profile, guestData, user } = useAuth();
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [incidentError, setIncidentError] = useState<string | null>(null);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignedIncidents, setAssignedIncidents] = useState<Incident[]>([]);
  const [escalatedIncidents, setEscalatedIncidents] = useState<Incident[]>([]);
  const [guestDetails, setGuestDetails] = useState<{ name: string; phone: string } | null>(null);
  const [activeIncidentId, setActiveIncidentId] = useState<string | null>(null);

  const navigate = useNavigate();
  const alertedIncidents = useRef<Set<string>>(new Set());

  // Debug count
  useEffect(() => {
    console.log("Total Active Incidents:", activeIncidents.length);
    console.log("Assigned Incidents:", assignedIncidents.length);
  }, [activeIncidents, assignedIncidents]);

  useEffect(() => {
    if (profile?.role === 'guest' && profile.guestTokenId) {
      const fetchGuestDetails = async () => {
        try {
          // Try guests collection first
          let guestDoc = await getDoc(doc(db, 'guests', profile.guestTokenId));
          if (!guestDoc.exists()) {
            // Fallback to guestTokens
            guestDoc = await getDoc(doc(db, 'guestTokens', profile.guestTokenId));
          }

          if (guestDoc.exists()) {
            const data = guestDoc.data();
            setGuestDetails({
              name: data.name || data.guestName || 'N/A',
              phone: data.phone || data.guestPhone || 'N/A'
            });
          }
        } catch (error) {
          console.error('Error fetching guest details:', error);
          try {
            handleFirestoreError(error, OperationType.GET, `guests/${profile.guestTokenId}`);
          } catch (e) {}
        }
      };
      fetchGuestDetails();
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const currentPath = window.location.pathname;
    const roleRoutes: Record<string, string> = {
      receptionist: '/reception/dashboard',
      security: '/security/dashboard',
      staff: '/staff/dashboard',
      admin: '/admin/dashboard'
    };

    const targetPath = roleRoutes[profile.role];
    
    if (targetPath && currentPath !== targetPath) {
      const isDashboardPath = Object.values(roleRoutes).includes(currentPath);
      if (isDashboardPath || currentPath === '/') {
        navigate(targetPath, { replace: true });
      }
    }
  }, [profile?.role, navigate]);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    let q;
    if (profile?.role === 'guest') {
      // Guests only see their own or global incidents
      q = query(
        collection(db, 'incidents'),
        and(
          where('organizationId', '==', profile.organizationId),
          where('status', 'in', ['reported', 'assigned', 'escalated', 'responding']),
          where('createdAt', '>=', todayStart),
          or(
            where('reporterId', '==', profile.uid),
            where('isGlobal', '==', true)
          )
        ),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } else if (profile?.role === 'security') {
      // Security users only see incidents matching their specialization (once assigned), global alerts, or where they are responders
      q = query(
        collection(db, 'incidents'),
        and(
          where('organizationId', '==', profile.organizationId),
          where('status', 'in', ['reported', 'assigned', 'escalated', 'responding']),
          where('createdAt', '>=', todayStart),
          or(
            and(
              where('assignedTo', '==', 'security'),
              where('securityType', '==', profile.securityType)
            ),
            where('isGlobal', '==', true),
            where('responders', 'array-contains', profile.uid)
          )
        ),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    } else {
      // Staff/Admin see everything in the org
      q = query(
        collection(db, 'incidents'),
        where('organizationId', '==', profile.organizationId),
        where('status', 'in', ['reported', 'assigned', 'escalated', 'responding']),
        where('createdAt', '>=', todayStart),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
    }

    setLoadingIncidents(true);
    setIncidentError(null);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let incidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      
      // Filter for guests: only their own or global
      if (profile?.role === 'guest') {
        incidents = incidents.filter(inc => inc.reporterId === profile.uid || inc.isGlobal);
      }

      // Ensure uniqueness by ID
      const uniqueIncidents = incidents.filter(
        (item, index, self) => index === self.findIndex(i => i.id === item.id)
      );

      setActiveIncidents(uniqueIncidents);
      setLoadingIncidents(false);
      
      // Auto-select active incident for guests
      if (profile?.role === 'guest') {
        const myActive = uniqueIncidents.find(inc => inc.reporterId === profile.uid);
        if (myActive && !activeIncidentId) {
          setActiveIncidentId(myActive.id);
        }
      }

      if (profile) {
        const assigned = uniqueIncidents.filter(inc => 
          inc.responders.includes(profile.uid) || 
          inc.assignedToRoles?.includes(profile.role) ||
          inc.assignedUsers?.includes(profile.uid) ||
          inc.isGlobal === true
        );
        setAssignedIncidents(assigned);

        if (profile.role === 'admin') {
          const escalated = uniqueIncidents.filter(inc => inc.status === 'escalated');
          setEscalatedIncidents(escalated);
        }
      }
    }, (error) => {
      console.error('Error in incidents listener:', error);
      setLoadingIncidents(false);
      setIncidentError('Failed to load incidents. Please check your connection.');
      if (auth.currentUser) {
        try {
          handleFirestoreError(error, OperationType.GET, 'incidents');
        } catch (e) {}
      }
    });

    return () => unsubscribe();
  }, [profile?.organizationId, profile?.role, profile?.uid]);

  // Real-time Users Sync
  useEffect(() => {
    if (!profile?.organizationId || !showUserManagement) return;

    setLoadingUsers(true);
    const q = query(
      collection(db, 'users'), 
      where('organizationId', '==', profile.organizationId),
      orderBy('displayName', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(usersList);
      setLoadingUsers(false);
    }, (error) => {
      console.error('Error syncing users:', error);
      setLoadingUsers(false);
    });

    return () => unsubscribe();
  }, [showUserManagement, profile?.organizationId]);

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user profile? This cannot be undone.')) return;
    
    try {
      // Find the user to check their uniqueId
      const userToDelete = users.find(u => u.uid === userId);
      
      await deleteDoc(doc(db, 'users', userId));
      
      // If they had a role code, reset it
      if (userToDelete?.uniqueId) {
        const q = query(
          collection(db, 'roleCodes'), 
          where('organizationId', '==', profile?.organizationId),
          where('code', '==', userToDelete.uniqueId)
        );
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await updateDoc(d.ref, { 
            status: 'active', 
            assignedTo: null, 
            email: null,
            updatedAt: serverTimestamp() 
          });
        }
      }
      
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user.');
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole
      });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: newRole } : u));
    } catch (error) {
      console.error('Error updating user role:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      } catch (e) {}
    }
  };

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [performingAction, setPerformingAction] = useState<string | null>(null);

  const handleAdminAction = async (incidentId: string, action: 'assign' | 'forward' | 'global', targetRole?: UserRole) => {
    if (!profile || performingAction) return;
    setPerformingAction(action === 'global' ? `${incidentId}-global` : `${incidentId}-${action}`);
    
    try {
      if (action === 'assign' && targetRole) {
        await updateDoc(doc(db, 'incidents', incidentId), {
          status: 'assigned',
          assignedToRoles: arrayUnion(targetRole),
          updatedAt: serverTimestamp()
        });
        
        await addDoc(collection(db, `incidents/${incidentId}/messages`), {
          incidentId,
          senderId: user!.uid,
          senderName: 'TRISHAK System',
          senderRole: 'system',
          text: `ADMIN ACTION: Incident assigned to ${targetRole.toUpperCase()} team.`,
          type: 'system',
          timestamp: serverTimestamp()
        });
      } else if (action === 'forward') {
        await updateDoc(doc(db, 'incidents', incidentId), {
          forwardedToEmergencyServices: true,
          updatedAt: serverTimestamp()
        });
        
        await addDoc(collection(db, `incidents/${incidentId}/messages`), {
          incidentId,
          senderId: user!.uid,
          senderName: 'TRISHAK System',
          senderRole: 'system',
          text: `ADMIN ACTION: EMERGENCY SERVICES NOTIFIED. External dispatch requested.`,
          type: 'system',
          timestamp: serverTimestamp()
        });
      } else if (action === 'global') {
        const incidentRef = doc(db, 'incidents', incidentId);
        await updateDoc(incidentRef, {
          isGlobal: true,
          updatedAt: serverTimestamp()
        });
        
        await addDoc(collection(db, `incidents/${incidentId}/messages`), {
          incidentId,
          senderId: user!.uid,
          senderName: 'TRISHAK System',
          senderRole: 'system',
          text: `ADMIN ACTION: Incident marked as GLOBAL. Visibility expanded to organization.`,
          type: 'system',
          timestamp: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error performing admin action:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `incidents/${incidentId}`);
      } catch (e) {}
    } finally {
      setPerformingAction(null);
    }
  };

  const [togglingDuty, setTogglingDuty] = useState(false);

  const toggleDuty = async () => {
    if (!profile || togglingDuty) return;
    setTogglingDuty(true);
    const newStatus = profile.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        status: newStatus,
        lastDutyChange: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating duty status:', error);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      } catch (e) {}
    } finally {
      setTogglingDuty(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <GlobalAlertBanner incidents={activeIncidents.filter(inc => inc.isGlobal)} />
      
      {activeIncidentId ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
            <h2 className="text-xl font-black text-text-primary tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" /> 
              {profile?.role === 'guest' ? 'Command Center' : 'Command Center'}
            </h2>
            <button 
              onClick={() => setActiveIncidentId(null)}
              className="text-sm font-bold text-text-secondary hover:text-text-primary flex items-center justify-center gap-1 bg-bg-secondary border border-card-border px-4 py-2 rounded-xl transition-all w-full sm:w-auto"
            >
              <X className="w-4 h-4" /> Exit Command Center
            </button>
          </div>
          <div className="bg-bg-secondary rounded-2xl lg:rounded-[2.5rem] lg:border-4 border-text-primary shadow-2xl p-4 lg:p-6 min-h-[500px] lg:min-h-[600px] transition-colors duration-500">
            <IncidentRoomComponent 
              incidentId={activeIncidentId} 
              onBack={() => setActiveIncidentId(null)}
              fullScreenLink={true}
            />
          </div>
        </motion.div>
      ) : (
        <>
          {/* Welcome Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="order-2 lg:order-1">
          <h1 className="text-2xl lg:text-3xl font-black text-text-primary mb-2 transition-colors">
            Hello, {(profile?.role === 'guest' ? (guestData?.name || guestDetails?.name || profile?.displayName || 'Guest') : (profile?.displayName || 'User')).split(' ')[0]}
            {profile?.role !== 'guest' && profile?.role !== 'admin' && (
              <span className={cn(
                "ml-2 text-lg lg:text-xl",
                profile?.role === 'security' ? "text-blue-600" :
                profile?.role === 'staff' ? "text-green-600" :
                profile?.role === 'receptionist' ? "text-purple-600" : ""
              )}>
                ({getRoleDisplayName(profile)})
              </span>
            )}
          </h1>
          <div className="flex flex-wrap gap-2 mt-3">
            {profile?.email && (
              <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-2 rounded-2xl border border-card-border transition-colors">
                <Mail className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary" />
                <span className="text-[10px] lg:text-xs font-bold text-text-primary">{profile.email}</span>
              </div>
            )}
            {profile?.phone && (
              <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-2 rounded-2xl border border-card-border transition-colors">
                <Phone className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary" />
                <span className="text-[10px] lg:text-xs font-bold text-text-primary">{profile.phone}</span>
              </div>
            )}
            {profile?.role !== 'admin' && (
              <>
                <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-2 rounded-2xl border border-card-border transition-colors">
                  <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary" />
                  <span className="text-[10px] lg:text-xs font-bold text-text-primary truncate max-w-[120px]">{profile?.displayName || guestData?.name || guestDetails?.name}</span>
                </div>
                {profile?.uniqueId && (
                  <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-2 rounded-2xl border border-card-border transition-colors">
                    <Ticket className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary" />
                    <span className="text-[10px] lg:text-xs font-bold text-text-primary">ID: {profile.uniqueId}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="text-text-secondary font-medium flex items-center gap-2 mt-3 lg:mt-2 text-xs lg:text-sm">
            <Activity className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-green-500" />
            System Status: <span className="text-green-600 font-bold uppercase tracking-widest text-[10px] lg:text-xs">Operational</span>
          </p>
        </div>
        
        <div className="order-1 lg:order-2 flex flex-col sm:flex-row gap-3 lg:gap-4">
          <Link 
            to="/sos"
            className="bg-accent-emergency hover:bg-red-700 text-white px-6 lg:px-8 py-3.5 lg:py-4 rounded-[1.5rem] lg:rounded-3xl font-black text-sm lg:text-lg shadow-xl shadow-red-200 dark:shadow-red-900/20 flex items-center justify-center gap-3 transition-all active:scale-95 w-full sm:w-auto text-center"
          >
            <ShieldAlert className="w-5 h-5 lg:w-6 lg:h-6" />
            REPORT EMERGENCY
          </Link>

          {profile?.role === 'receptionist' && (
            <Link 
              to="/reception/dashboard"
              className="bg-text-primary hover:opacity-90 text-bg-primary px-6 lg:px-8 py-3.5 lg:py-4 rounded-[1.5rem] lg:rounded-3xl font-black text-sm lg:text-lg shadow-xl shadow-black/10 flex items-center justify-center gap-3 transition-all active:scale-95 w-full sm:w-auto text-center border border-card-border"
            >
              <Ticket className="w-5 h-5 lg:w-6 lg:h-6" />
              RECEPTIONIST DESK
            </Link>
          )}
        </div>
      </div>


      {/* Guest Active Incident Status */}
      {profile?.role === 'guest' && activeIncidents.some(inc => inc.reporterId === profile.uid) && (
        <div className="space-y-4">
          <div className="px-2">
            <h2 className="text-xl font-black text-red-600 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Your Active Emergency
            </h2>
          </div>
          {activeIncidents.filter(inc => inc.reporterId === profile.uid).slice(0, 1).map(incident => (
            <div key={incident.id} onClick={() => setActiveIncidentId(incident.id)} className="cursor-pointer">
              <GuestIncidentCard incident={incident} />
            </div>
          ))}
        </div>
      )}

      {/* Assigned Incidents for Responders */}
      {assignedIncidents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-blue-600 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" /> Your Assignments
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {assignedIncidents.map((incident) => (
              <button 
                key={incident.id} 
                onClick={() => setActiveIncidentId(incident.id)}
                className="w-full text-left"
              >
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className={cn(
                    "p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden group transition-all",
                    incident.isGlobal ? "animate-pulse-red border-4 border-red-400" :
                    incident.status === 'escalated' 
                      ? "bg-red-600 shadow-red-200 animate-pulse border-4 border-white/20" 
                      : "bg-blue-600 shadow-blue-200"
                  )}
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                    {incident.isGlobal ? <Globe className="w-20 h-20" /> : incident.status === 'escalated' ? <AlertTriangle className="w-20 h-20" /> : <Zap className="w-20 h-20" />}
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">
                        {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type}
                      </span>
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full",
                        incident.isGlobal ? "bg-red-500 text-white" : incident.status === 'escalated' ? "bg-white text-red-600" : "bg-white/20"
                      )}>
                        {incident.status}
                      </span>
                      {incident.isGlobal && (
                        <span className="text-[10px] font-black uppercase tracking-widest bg-white text-red-600 px-3 py-1 rounded-full flex items-center gap-1">
                          <Globe className="w-3 h-3" /> GLOBAL
                        </span>
                      )}
                      {incident.securityType && (
                        <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-3 py-1 rounded-full border border-yellow-500 shadow-sm animate-pulse">
                          Security: {incident.securityType}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-black mb-2 truncate">
                      {incident.status === 'escalated' && "🚨 "}{incident.description}
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/80">
                      Open Command Center <ArrowRight className="w-3 h-3" />
                    </div>
                  </div>
                </motion.div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Staff/Security Duty Status */}
      {(profile?.role === 'staff' || profile?.role === 'security' || profile?.role === 'responder') && (
        <div className="bg-bg-secondary p-8 rounded-3xl text-text-primary border border-card-border shadow-2xl relative overflow-hidden transition-all duration-500">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <ShieldAlert className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                profile.status === 'active' 
                  ? "bg-green-500/20 text-green-500 border-green-500/30" 
                  : "bg-text-secondary/20 text-text-secondary border-card-border"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", profile.status === 'active' ? "bg-green-500" : "bg-text-secondary/40")}></div>
                {profile.status === 'active' ? 'On Duty' : 'Off Duty'}
              </div>
              <h2 className="text-2xl font-black tracking-tight transition-colors">
                {profile.role === 'security' ? `${getRoleDisplayName(profile)} Mode` : 
                 profile.role === 'staff' ? 'Staff Duty Status' : 
                 'Responder Mode'}
              </h2>
              <p className="text-text-secondary max-w-md font-medium transition-colors">
                {profile.status === 'active' 
                  ? `You are currently on active duty as ${getRoleDisplayName(profile)}. All high-priority alerts will be routed to your device instantly.`
                  : "You are currently off duty. You will not receive emergency alerts until you check-in."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={toggleDuty}
                disabled={togglingDuty}
                className={cn(
                  "font-black py-4 px-8 rounded-2xl transition-all active:scale-95 text-sm flex items-center gap-2 disabled:opacity-50 shadow-lg",
                  profile.status === 'active' 
                    ? "bg-text-primary text-bg-primary hover:opacity-90" 
                    : "bg-accent-emergency text-white hover:bg-red-700 shadow-red-200 dark:shadow-red-900/20"
                )}
              >
                {togglingDuty && <RefreshCw className="w-4 h-4 animate-spin" />}
                {profile.status === 'active' ? 'GO OFF-DUTY' : 'CHECK-IN FOR DUTY'}
              </button>
              <Link to="/incidents" className="bg-bg-primary text-text-primary font-black py-4 px-8 rounded-2xl hover:bg-card-border transition-all active:scale-95 text-sm border border-card-border">
                VIEW ASSIGNMENTS
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Admin Escalation Section */}
      {profile?.role === 'admin' && escalatedIncidents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-red-600 tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 animate-pulse" /> Critical Escalations
            </h2>
          </div>
          <div className="grid gap-4">
            {escalatedIncidents.map((incident) => (
              <div 
                key={incident.id} 
                className={cn(
                  "bg-white p-6 rounded-[2.5rem] border-2 border-red-100 shadow-xl shadow-red-50 flex flex-col md:flex-row md:items-center gap-6 transition-all",
                  incident.isGlobal && "animate-pulse-red border-red-200 ring-2 ring-red-100 ring-inset"
                )}
              >
                <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-red-200">
                  <ShieldAlert className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 px-3 py-1 rounded-full border border-red-100">
                      {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-40">
                      Reported {formatTimestamp(incident.createdAt)}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-text-primary mb-1 transition-colors">{incident.description}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 relative z-10">
                  {!incident.isGlobal && (
                    <button 
                      onClick={() => handleAdminAction(incident.id, 'global')}
                      disabled={performingAction === `${incident.id}-global`}
                      className="flex items-center gap-2 px-4 py-2 bg-bg-primary hover:bg-text-primary hover:text-bg-primary rounded-2xl transition-all text-text-secondary disabled:opacity-50 group shadow-sm border border-card-border"
                    >
                      {performingAction === `${incident.id}-global` ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Globe className="w-4 h-4" />
                      )}
                      <span className="text-[10px] font-black uppercase tracking-widest">Make it Global</span>
                    </button>
                  )}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 opacity-50">Assign To</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleAdminAction(incident.id, 'assign', 'security')}
                        disabled={performingAction === `${incident.id}-assign`}
                        className="p-3 bg-bg-primary hover:bg-blue-600 hover:text-white rounded-2xl transition-all text-text-secondary group disabled:opacity-50 border border-card-border"
                        title="Assign to Security"
                      >
                        {performingAction === `${incident.id}-assign` ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => handleAdminAction(incident.id, 'assign', 'staff')}
                        disabled={performingAction === `${incident.id}-assign`}
                        className="p-3 bg-bg-primary hover:bg-blue-600 hover:text-white rounded-2xl transition-all text-text-secondary disabled:opacity-50 border border-card-border"
                        title="Assign to Staff"
                      >
                        {performingAction === `${incident.id}-assign` ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <div className="h-10 w-px bg-card-border mx-2 hidden md:block" />
                  <button 
                    onClick={() => handleAdminAction(incident.id, 'forward')}
                    disabled={performingAction === `${incident.id}-forward`}
                    className="flex items-center gap-2 px-6 py-3 bg-accent-emergency hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-emergency/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {performingAction === `${incident.id}-forward` ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                    Dispatch 911
                  </button>
                  <button 
                    onClick={() => setActiveIncidentId(incident.id)}
                    className="p-3 bg-text-primary hover:opacity-80 text-bg-primary rounded-2xl transition-all"
                    title="Open Command Center"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Active Incidents List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl font-black text-text-primary tracking-tight transition-colors">Active Incidents</h2>
            <Link to="/incidents" className="text-[10px] font-black text-accent-emergency hover:underline flex items-center gap-1 transition-colors uppercase tracking-widest">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {loadingIncidents ? (
              <div className="bg-bg-secondary p-12 rounded-3xl border border-card-border flex flex-col items-center justify-center text-center transition-colors">
                <RefreshCw className="text-accent-emergency w-10 h-10 animate-spin mb-4" />
                <p className="text-xs text-text-secondary font-black uppercase tracking-widest opacity-40 transition-colors">Syncing incidents...</p>
              </div>
            ) : incidentError ? (
              <div className="bg-accent-emergency/5 p-12 rounded-3xl border border-accent-emergency/20 flex flex-col items-center justify-center text-center transition-colors">
                <AlertTriangle className="text-accent-emergency w-10 h-10 mb-4" />
                <h3 className="font-black text-text-primary mb-1 transition-colors">Connection Error</h3>
                <p className="text-sm text-text-secondary font-medium transition-colors">{incidentError}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 bg-accent-emergency text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-accent-emergency/20 transition-all active:scale-95"
                >
                  RETRY SYSTEM SYNC
                </button>
              </div>
            ) : activeIncidents.length > 0 ? (
              activeIncidents
                .slice(0, 10)
                .map((incident) => (
                <button 
                  key={incident.id} 
                  onClick={() => setActiveIncidentId(incident.id)}
                  className="w-full text-left"
                >
                  <motion.div 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={cn(
                      "bg-bg-secondary p-5 rounded-3xl border border-card-border shadow-sm hover:shadow-md transition-all flex items-center gap-5",
                      incident.isGlobal && "animate-pulse-red border-accent-emergency/30"
                    )}
                  >
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", getSeverityColor(incident.severity))}>
                      <ShieldAlert className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-bg-primary text-text-secondary rounded-full border border-card-border transition-colors">
                          {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type}
                        </span>
                        <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", getStatusColor(incident.status))}>
                          {incident.status}
                        </span>
                        {incident.isGlobal && (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-accent-emergency text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-accent-emergency/20">
                            <Globe className="w-3 h-3" /> 🌐 GLOBAL
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-text-primary truncate transition-colors uppercase tracking-tight">{incident.description}</h3>
                      <p className="text-[10px] text-text-secondary flex items-center gap-1 mt-1 font-bold italic opacity-60 transition-colors">
                        <Clock className="w-3 h-3 text-accent-emergency" /> 
                        {formatTimestamp(incident.createdAt)}
                      </p>
                    </div>
                    <div className="bg-bg-primary p-2 rounded-full border border-card-border transition-colors">
                      <ArrowRight className="w-5 h-5 text-text-secondary" />
                    </div>
                  </motion.div>
                </button>
              ))
            ) : (
              <div className="bg-bg-secondary p-12 rounded-3xl border border-card-border flex flex-col items-center justify-center text-center transition-colors">
                <div className="bg-bg-primary p-4 rounded-full mb-4 border border-card-border transition-colors">
                  <CheckCircle2 className="text-green-500 w-10 h-10" />
                </div>
                <h3 className="font-black text-text-primary mb-1 transition-colors uppercase tracking-tight">All Clear</h3>
                <p className="text-sm text-text-secondary font-medium transition-colors">No active emergencies at this time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions & AI Insights */}
        <div className="space-y-6">
          {profile?.role === 'admin' && (
            <Link to="/incidents" className="block group">
              <div className="bg-bg-secondary p-6 rounded-3xl border border-card-border hover:border-accent-emergency hover:shadow-xl hover:shadow-accent-emergency/5 transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-accent-emergency/10 p-3 rounded-2xl text-accent-emergency group-hover:bg-accent-emergency group-hover:text-white transition-all">
                    <Shield className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-text-primary group-hover:text-accent-emergency transition-colors">Incident Management</h3>
                    <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest opacity-40">Full Security Log</p>
                  </div>
                </div>
                <p className="text-sm text-text-secondary font-medium mb-4 leading-relaxed opacity-60">
                  Access the complete history of incidents, search through past reports, and manage security assignments across all floors.
                </p>
                <div className="flex items-center gap-2 text-xs font-black text-accent-emergency uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">
                  Launch Explorer <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          )}


        </div>
      </div>

      {/* User Management Modal */}
      <AnimatePresence>
        {showUserManagement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUserManagement(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-bg-secondary rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden flex flex-col max-h-[90vh] border border-card-border"
            >
              <div className="p-8 border-b border-card-border flex items-center justify-between bg-bg-primary/30 backdrop-blur-md transition-colors">
                <div className="flex items-center gap-4">
                  <div className="bg-accent-emergency p-3 rounded-2xl shadow-lg shadow-accent-emergency/20">
                    <UserCog className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-text-primary tracking-tight transition-colors">User Management</h2>
                    <p className="text-sm text-text-secondary font-medium transition-colors">Manage organization roles and permissions.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowUserManagement(false)}
                  className="p-3 hover:bg-bg-primary rounded-2xl transition-all text-text-secondary hover:text-text-primary"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 border-b border-card-border transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5 opacity-40" />
                    <input 
                      type="text" 
                      placeholder="Search users by name or email..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-bg-primary border border-card-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-accent-emergency focus:ring-0 transition-all font-bold text-text-primary placeholder:text-text-secondary/30 transition-colors"
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (!window.confirm('WARNING: This will delete all non-admin user profiles. This cannot be undone. Continue?')) return;
                      setLoadingUsers(true);
                      try {
                        const nonAdmins = users.filter(u => u.role !== 'admin');
                        for (const u of nonAdmins) {
                          await deleteDoc(doc(db, 'users', u.uid));
                        }
                        // Also reset roleCodes
                        const q = query(collection(db, 'roleCodes'), where('organizationId', '==', profile?.organizationId));
                        const snap = await getDocs(q);
                        for (const d of snap.docs) {
                          await updateDoc(d.ref, { status: 'active', assignedTo: null, email: null });
                        }
                        alert('System reset successful. All non-admin logins removed.');
                      } catch (err) {
                        console.error(err);
                        alert('Failed to reset users.');
                      } finally {
                        setLoadingUsers(false);
                      }
                    }}
                    className="bg-accent-emergency/5 text-accent-emergency hover:bg-accent-emergency hover:text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-accent-emergency/10"
                  >
                    Reset System Access
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 transition-colors">
                {loadingUsers ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-accent-emergency border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-40 animate-pulse transition-colors">Loading Personnel...</p>
                  </div>
                ) : filteredUsers.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredUsers.map((user) => (
                      <div key={user.uid} className="bg-bg-primary p-4 rounded-3xl border border-card-border flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-bg-secondary overflow-hidden shrink-0 border border-card-border transition-colors">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-text-secondary opacity-40">
                                <Users className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <div>
                            <h4 className="font-black text-text-primary transition-colors uppercase tracking-tight">{user.displayName}</h4>
                            <p className="text-xs text-text-secondary font-bold opacity-60 transition-colors uppercase tracking-tight">{user.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 opacity-40">Role</span>
                            <select 
                              value={user.role}
                              onChange={(e) => updateUserRole(user.uid, e.target.value as UserRole)}
                              className="bg-bg-secondary border border-card-border rounded-xl px-4 py-2 text-xs font-black text-text-primary focus:border-accent-emergency focus:ring-0 transition-all cursor-pointer uppercase tracking-widest"
                            >
                              <option value="guest">Guest</option>
                              <option value="receptionist">Receptionist</option>
                              <option value="staff">Staff</option>
                              <option value="security">Security</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mt-4 transition-colors",
                            user.status === 'active'
                              ? "bg-green-500/10 text-green-500 border-green-500/20 shadow-sm shadow-green-500/10" 
                              : "bg-text-secondary/10 text-text-secondary border-card-border opacity-50"
                          )}>
                            {user.status === 'active' ? 'On Duty' : 'Off Duty'}
                          </div>
                          {user.role !== 'admin' && (
                            <button
                              onClick={() => deleteUser(user.uid)}
                              className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all mt-4 border border-red-500/10"
                              title="Delete User"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-20">
                    <p className="text-text-secondary font-black uppercase tracking-widest text-[10px] opacity-40">No personnel matching your criteria.</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-bg-primary/50 border-t border-card-border flex items-center justify-between transition-colors">
                <p className="text-[10px] text-text-secondary font-black uppercase tracking-widest opacity-40">
                  Showing {filteredUsers.length} OF {users.length} Personnel
                </p>
                <div className="flex items-center gap-2 text-accent-emergency text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">
                  <ShieldCheck className="w-4 h-4" />
                  SECURE ADMIN AUTHENTICATED
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return null;
}

function ActionButton({ label, icon: Icon }: any) {
  return (
    <button className="flex items-center gap-3 p-3 rounded-2xl hover:bg-bg-primary transition-all text-left group">
      <div className="bg-bg-primary p-2 rounded-xl group-hover:bg-accent-emergency/10 group-hover:text-accent-emergency transition-all border border-card-border">
         <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-bold text-text-primary transition-colors">{label}</span>
    </button>
  );
}

function FacilityItem({ name, status, color = "text-green-600" }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-bg-primary rounded-2xl border border-card-border transition-colors">
      <span className="text-xs font-bold text-text-primary transition-colors">{name}</span>
      <span className={cn("text-[10px] font-black uppercase tracking-widest transition-colors", color)}>{status}</span>
    </div>
  );
}

function ResourceItem({ label, value }: any) {
  return (
    <div className="space-y-1.5 transition-colors">
      <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-widest transition-colors">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-1.5 bg-bg-primary rounded-full overflow-hidden border border-card-border">
        <div className="h-full bg-accent-emergency rounded-full shadow-[0_0_8px_rgba(255,59,59,0.3)] transition-all duration-1000" style={{ width: value }}></div>
      </div>
    </div>
  );
}

function MapIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}
