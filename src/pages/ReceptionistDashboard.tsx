import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  setDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query, 
  where, 
  onSnapshot, 
  serverTimestamp, 
  orderBy,
  limit,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { 
  UserPlus, 
  Ticket, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Users,
  ShieldAlert,
  MapPin,
  ArrowRight,
  X,
  UserCog,
  Zap,
  Trash2,
  Mail,
  Globe,
  Shield,
  AlertTriangle,
  Phone,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Guest, Incident } from '../types';
import { SOS_TYPES, mapOldIncidentType } from '../constants';
import { cn, formatTimestamp, getSeverityColor, getStatusColor } from '../lib/utils';
import Modal from '../components/Modal';

export default function ReceptionistDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(true);
  const [activeIncidents, setActiveIncidents] = useState<Incident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [escalatedIncidents, setEscalatedIncidents] = useState<Incident[]>([]);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [tokenToDelete, setTokenToDelete] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityModalIncidentId, setSecurityModalIncidentId] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState(profile?.phone || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setUpdatingProfile(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        phone: phoneInput,
        updatedAt: serverTimestamp()
      });
      setIsProfileModalOpen(false);
      setToast({ message: 'Profile updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setToast({ message: 'Failed to update profile', type: 'error' });
    } finally {
      setUpdatingProfile(false);
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
      setToast({ 
        message: `You are now ${newStatus === 'active' ? 'On Duty' : 'Off Duty'}`, 
        type: 'success' 
      });
    } catch (error) {
      console.error('Error updating duty status:', error);
      setToast({ message: 'Failed to update duty status', type: 'error' });
    } finally {
      setTogglingDuty(false);
    }
  };

  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalModalIncidentId, setGlobalModalIncidentId] = useState<string | null>(null);
  const [isTogglingGlobal, setIsTogglingGlobal] = useState(false);
  const [performingAction, setPerformingAction] = useState<string | null>(null);

  const handleToggleGlobal = async (incidentId: string) => {
    if (!profile || isTogglingGlobal) return;
    setIsTogglingGlobal(true);
    
    try {
      const incidentRef = doc(db, 'incidents', incidentId);
      await updateDoc(incidentRef, {
        isGlobal: true,
        updatedAt: serverTimestamp()
      });

      // Add system message
      await addDoc(collection(db, `incidents/${incidentId}/messages`), {
        incidentId,
        senderId: profile.uid,
        senderName: 'TRISHAK System',
        senderRole: 'system',
        text: `AUDIT: ${profile.displayName} (Receptionist) marked this incident as GLOBAL. It is now visible to the entire organization.`,
        type: 'system',
        timestamp: serverTimestamp()
      });

      setToast({ message: 'Incident is now GLOBAL', type: 'success' });
      setShowGlobalModal(false);
      setGlobalModalIncidentId(null);
    } catch (error) {
      console.error('Error toggling global state:', error);
      setToast({ message: 'Failed to update incident', type: 'error' });
    } finally {
      setIsTogglingGlobal(false);
    }
  };

  const handleAdminAction = async (incidentId: string, action: 'assign' | 'forward', targetRole?: any, securityType?: string) => {
    if (!profile || performingAction) return;
    setPerformingAction(`${incidentId}-${action}`);
    
    try {
      if (action === 'assign' && targetRole) {
        let assignedUserIds: string[] = [];
        
        // If assigning to security specialized, fetch matching users
        if (targetRole === 'security' && securityType) {
          const usersRef = collection(db, 'users');
          const q = query(
            usersRef,
            where('role', '==', 'security'),
            where('securityType', '==', securityType),
            where('status', '==', 'active'),
            where('organizationId', '==', profile.organizationId)
          );
          const snapshot = await getDocs(q);
          assignedUserIds = snapshot.docs.map(doc => doc.id);
        }

        const updateData: any = {
          status: 'assigned',
          assignedTo: targetRole,
          assignedToRoles: arrayUnion(targetRole),
          updatedAt: serverTimestamp()
        };

        if (securityType) {
          updateData.securityType = securityType;
          if (assignedUserIds.length > 0) {
            updateData.assignedUsers = assignedUserIds;
          }
        }

        await updateDoc(doc(db, 'incidents', incidentId), updateData);

        // Add system message
        const specializedSuffix = securityType ? ` (${securityType.toUpperCase()} specialists: ${assignedUserIds.length} users)` : '';
        await addDoc(collection(db, `incidents/${incidentId}/messages`), {
          incidentId,
          senderId: user!.uid,
          senderName: 'TRISHAK System',
          senderRole: 'system',
          text: `AUDIT: ${profile.displayName} (Receptionist) assigned incident to ${targetRole.toUpperCase()}${specializedSuffix}.`,
          type: 'system',
          timestamp: serverTimestamp()
        });
      } else if (action === 'forward') {
        await updateDoc(doc(db, 'incidents', incidentId), {
          status: 'escalated',
          assignedToRoles: arrayUnion('admin'),
          updatedAt: serverTimestamp()
        });

        // Add system message
        await addDoc(collection(db, `incidents/${incidentId}/messages`), {
          incidentId,
          senderId: user!.uid,
          senderName: 'TRISHAK System',
          senderRole: 'system',
          text: `AUDIT: ${profile.displayName} (Receptionist) escalated incident to Admin/Command Center.`,
          type: 'system',
          timestamp: serverTimestamp()
        });
      }
      setToast({ message: `Incident ${action === 'assign' ? 'assigned' : 'escalated'} successfully`, type: 'success' });
    } catch (error) {
      console.error('Error performing admin action:', error);
      setToast({ message: 'Action failed. Please try again.', type: 'error' });
    } finally {
      setPerformingAction(null);
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!profile?.organizationId) return;

    // Guests Query
    const guestsQuery = query(
      collection(db, 'guests'),
      where('organizationId', '==', profile.organizationId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    setLoadingGuests(true);
    const unsubscribeGuests = onSnapshot(guestsQuery, (snapshot) => {
      setGuests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest)));
      setLoadingGuests(false);
    }, (error) => {
      console.error('Error in guests listener:', error);
      setLoadingGuests(false);
    });

    // Active Incidents Query
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const incidentsQuery = query(
      collection(db, 'incidents'),
      where('organizationId', '==', profile.organizationId),
      where('status', 'in', ['reported', 'assigned', 'escalated', 'responding']),
      where('createdAt', '>=', todayStart),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    setLoadingIncidents(true);
    const unsubscribeIncidents = onSnapshot(incidentsQuery, (snapshot) => {
      const incidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident));
      setActiveIncidents(incidents);
      setLoadingIncidents(false);
      
      const escalated = incidents.filter(inc => inc.status === 'escalated');
      setEscalatedIncidents(escalated);
    }, (error) => {
      console.error('Error in incidents listener:', error);
      setLoadingIncidents(false);
    });

    return () => {
      unsubscribeGuests();
      unsubscribeIncidents();
    };
  }, [user, profile?.organizationId]);

  const generateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.organizationId || !guestName || !guestPhone) return;
    setGenerating(true);
    
    try {
      // Generate a random 6-digit alphanumeric code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Valid for 24 hours

      const tokenRef = doc(db, 'guestTokens', code);
      const tokenSnap = await getDoc(tokenRef);
      
      if (tokenSnap.exists() && tokenSnap.data().status === 'active') {
        // Collision with active token! Rare, but let's retry.
        setGenerating(false);
        return generateToken(e);
      }

      await setDoc(tokenRef, {
        code,
        guestName,
        guestPhone,
        receptionistId: user.uid,
        organizationId: profile.organizationId,
        status: 'active',
        createdAt: serverTimestamp(),
        expiresAt: expiresAt
      });

      // Also create record in 'guests' collection as requested
      await setDoc(doc(db, 'guests', code), {
        guestId: code,
        code: code, // Add code field for explicit search compatibility
        name: guestName,
        phone: guestPhone,
        organizationId: profile.organizationId,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // Send SMS via Twilio backend
      try {
        await fetch('/api/send-guest-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: guestName,
            phone: guestPhone,
            guestId: code
          })
        });
      } catch (smsErr) {
        console.error('Failed to trigger guest SMS:', smsErr);
        // We don't block the UI for SMS failure as the record is already saved
      }

      setLastGenerated(code);
      setGuestName('');
      setGuestPhone('');
      setShowTokenForm(false);
      setTimeout(() => setLastGenerated(null), 15000); // Hide after 15s
    } catch (error) {
      console.error('Error generating token:', error);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setToast({ message: 'Copy failed', type: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!tokenToDelete) return;
    
    try {
      // Delete from both collections
      await deleteDoc(doc(db, 'guestTokens', tokenToDelete));
      await deleteDoc(doc(db, 'guests', tokenToDelete));
      setToast({ message: 'Guest ID deleted successfully', type: 'success' });
    } catch (error) {
      console.error('Error deleting token:', error);
      setToast({ message: 'Failed to delete. Try again.', type: 'error' });
    } finally {
      setShowDeleteModal(false);
      setTokenToDelete(null);
    }
  };

  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return (
      <div className="flex flex-col">
        <span className="text-text-primary font-bold transition-colors">{date.toLocaleDateString()}</span>
        <span className="text-[10px] text-text-secondary opacity-40 transition-colors uppercase font-black tabular-nums">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-0 py-6 md:py-10 space-y-8 relative transition-colors duration-500">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 right-8 z-50 px-6 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-3",
              toast.type === 'success' ? "bg-green-600 text-white" : "bg-accent-emergency text-white"
            )}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Critical Escalations Section (Copied from Admin) */}
      <AnimatePresence>
        {escalatedIncidents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 px-2">
              <AlertTriangle className="w-5 h-5 text-accent-emergency animate-pulse" />
              <h2 className="text-xl font-black text-accent-emergency uppercase tracking-widest transition-colors">Critical Escalations</h2>
              <span className="ml-auto bg-accent-emergency text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {escalatedIncidents.length} URGENT
              </span>
            </div>
            
            <div className="grid gap-4">
              {escalatedIncidents.map((incident) => (
                <div key={incident.id} className="bg-bg-secondary p-6 rounded-[2.5rem] border-2 border-accent-emergency/20 shadow-xl shadow-accent-emergency/5 flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden group transition-colors">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <ShieldAlert className="w-24 h-24 text-accent-emergency" />
                  </div>

                  <div className="w-16 h-16 bg-accent-emergency rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-accent-emergency/20">
                    <ShieldAlert className="w-8 h-8 text-white" />
                  </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest bg-accent-emergency/10 text-accent-emergency px-3 py-1 rounded-full border border-accent-emergency/20">
                          {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-50">
                          {formatTimestamp(incident.createdAt)}
                        </span>
                        {incident.securityType && (
                          <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-400 text-black px-3 py-1 rounded-full border border-yellow-500 shadow-sm animate-pulse ml-1">
                            {incident.securityType}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-black text-text-primary leading-tight transition-colors">{incident.description}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 relative z-10 shrink-0">
                      <div className="flex bg-bg-primary/50 p-1 rounded-2xl border border-card-border">
                        {!incident.isGlobal && (
                          <button 
                            onClick={() => {
                              setGlobalModalIncidentId(incident.id);
                              setShowGlobalModal(true);
                            }}
                            className="p-2.5 hover:bg-bg-secondary hover:text-accent-emergency hover:shadow-sm rounded-xl transition-all text-text-secondary opacity-50 hover:opacity-100"
                            title="Make it Global"
                          >
                            <Globe className="w-4 h-4" />
                          </button>
                        )}
                        {incident.isGlobal && (
                          <div className="p-2.5 text-accent-emergency" title="Global Alert Active">
                            <Globe className="w-4 h-4 animate-pulse" />
                          </div>
                        )}
                        
                        <div className="w-px h-6 bg-card-border my-auto mx-1" />

                        <button 
                          onClick={() => handleAdminAction(incident.id, 'assign', 'staff')}
                          disabled={performingAction === `${incident.id}-assign`}
                          className="p-2.5 hover:bg-bg-secondary hover:text-blue-500 hover:shadow-sm rounded-xl transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                          title="Assign to Staff"
                        >
                          <Users className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => {
                            setSecurityModalIncidentId(incident.id);
                            setShowSecurityModal(true);
                          }}
                          disabled={performingAction?.startsWith(incident.id)}
                          className="p-2.5 hover:bg-bg-secondary hover:text-accent-emergency hover:shadow-sm rounded-xl transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                          title="Assign to Security"
                        >
                          <Shield className="w-4 h-4" />
                        </button>

                        <button 
                          onClick={() => handleAdminAction(incident.id, 'forward')}
                          disabled={performingAction === `${incident.id}-forward`}
                          className="p-2.5 hover:bg-bg-secondary hover:text-amber-500 hover:shadow-sm rounded-xl transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                          title="Escalate to Command Center"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      </div>

                      <Link 
                        to={`/incident/${incident.id}`}
                        className="p-3 bg-text-primary text-bg-primary rounded-2xl transition-all shadow-lg hover:opacity-80"
                        title="Open Control Room"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </Link>
                    </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 transition-colors">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-text-primary tracking-tight transition-colors">
            Hello, {(profile?.displayName || 'Receptionist').split(' ')[0]}
          </h1>
          <div className="flex flex-wrap gap-2 lg:gap-4 mt-3 lg:mt-2">
            <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-1.5 lg:py-2 rounded-2xl border border-card-border transition-colors">
              <Users className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary opacity-50 transition-colors" />
              <span className="text-[10px] lg:text-xs font-bold text-text-primary transition-colors">{profile?.displayName}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-1.5 lg:py-2 rounded-2xl border border-card-border transition-colors">
                <Phone className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary opacity-50 transition-colors" />
                <span className="text-[10px] lg:text-xs font-bold text-text-primary transition-colors">{profile.phone}</span>
              </div>
            )}
            {profile?.uniqueId && (
              <div className="flex items-center gap-2 bg-bg-secondary px-3 lg:px-4 py-1.5 lg:py-2 rounded-2xl border border-card-border transition-colors">
                <Ticket className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-text-secondary opacity-50 transition-colors" />
                <span className="text-[10px] lg:text-xs font-bold text-text-primary transition-colors">ID: {profile.uniqueId}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-3 lg:gap-4">
          <button
            onClick={() => {
              setPhoneInput(profile?.phone || '');
              setIsProfileModalOpen(true);
            }}
            className="p-3 lg:p-4 bg-bg-secondary border border-card-border rounded-[1.25rem] lg:rounded-2xl text-text-primary hover:bg-bg-primary transition-all shadow-sm flex items-center justify-center gap-2 font-bold text-xs"
            title="Update Profile"
          >
            <UserCog className="w-4 h-4 lg:w-5 lg:h-5" />
            <span>Profile</span>
          </button>

          {!showTokenForm && (
            <button
              onClick={() => setShowTokenForm(true)}
              className="flex items-center justify-center gap-2 lg:gap-3 bg-accent-emergency text-white px-4 lg:px-8 py-3 lg:py-4 rounded-[1.25rem] lg:rounded-2xl font-bold hover:bg-accent-emergency/90 transition-all shadow-lg shadow-accent-emergency/10 text-xs lg:text-sm"
            >
              <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
              <span>Register Guest</span>
            </button>
          )}
        </div>
      </div>

      {/* Duty Status Toggle */}
      {profile && (
        <div className="bg-bg-secondary p-6 lg:p-8 rounded-2xl lg:rounded-3xl text-text-primary border border-card-border shadow-2xl relative overflow-hidden transition-colors">
          <div className="absolute top-0 right-0 p-8 opacity-5 hidden md:block pointer-events-none transition-colors">
            <UserCircle className="w-32 h-32" />
          </div>
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 lg:gap-8 transition-colors">
            <div className="space-y-3 lg:space-y-4">
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors",
                profile.status === 'active' 
                  ? "bg-green-500/10 text-green-500 border-green-500/20" 
                  : "bg-text-secondary/10 text-text-secondary border-card-border"
              )}>
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", profile.status === 'active' ? "bg-green-500" : "bg-text-secondary")}></div>
                {profile.status === 'active' ? 'On Duty' : 'Off Duty'}
              </div>
              <h2 className="text-xl lg:text-2xl font-black tracking-tight transition-colors">Receptionist Duty Status</h2>
              <p className="text-text-secondary max-w-md font-medium text-xs lg:text-base leading-relaxed opacity-60 transition-colors">
                {profile.status === 'active' 
                  ? "You are currently on active duty. You can register guests and manage incidents."
                  : "You are currently off duty. Please check-in to start managing guests and emergencies."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 transition-colors">
              <button 
                onClick={toggleDuty}
                disabled={togglingDuty}
                className={cn(
                  "font-black py-3.5 lg:py-4 px-6 lg:px-8 rounded-xl lg:rounded-2xl transition-all active:scale-95 text-xs lg:text-sm flex items-center justify-center gap-2 disabled:opacity-50 w-full lg:w-auto",
                  profile.status === 'active' 
                    ? "bg-text-primary text-bg-primary hover:opacity-90" 
                    : "bg-accent-emergency text-white hover:bg-accent-emergency/90 shadow-lg shadow-accent-emergency/20"
                )}
              >
                {togglingDuty && <RefreshCw className="w-4 h-4 animate-spin" />}
                {profile.status === 'active' ? 'GO OFF-DUTY' : 'CHECK-IN FOR DUTY'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showTokenForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-bg-secondary p-8 rounded-[2.5rem] border border-card-border shadow-xl overflow-hidden transition-colors"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-text-primary transition-colors">Guest Details</h2>
              <button 
                onClick={() => setShowTokenForm(false)}
                className="p-2 hover:bg-bg-primary rounded-xl transition-all text-text-secondary opacity-50 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={generateToken} className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 transition-colors">Guest Full Name</label>
                <input 
                  type="text" 
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter guest's full name"
                  className="w-full bg-bg-primary border border-card-border rounded-2xl px-6 py-4 text-sm focus:border-accent-emergency focus:ring-0 transition-all font-medium text-text-primary placeholder:text-text-secondary/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 transition-colors">Guest Phone Number</label>
                <input 
                  type="tel" 
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Enter guest's phone number"
                  className="w-full bg-bg-primary border border-card-border rounded-2xl px-6 py-4 text-sm focus:border-accent-emergency focus:ring-0 transition-all font-medium text-text-primary placeholder:text-text-secondary/30"
                />
              </div>
              <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 transition-colors">
                <button
                  type="button"
                  onClick={() => setShowTokenForm(false)}
                  className="sm:hidden px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-bold hover:bg-bg-secondary transition-all border border-card-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generating}
                  className="flex items-center justify-center gap-3 bg-accent-emergency text-white px-10 py-4 rounded-2xl font-bold hover:bg-accent-emergency/90 transition-all shadow-lg shadow-accent-emergency/10 disabled:opacity-50 w-full sm:w-auto"
                >
                  {generating ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Zap className="w-5 h-5" />
                  )}
                  Generate Secure Guest ID
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastGenerated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-accent-emergency p-8 rounded-3xl text-white shadow-2xl shadow-accent-emergency/20 flex flex-col items-center text-center relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none transition-colors">
              <Ticket className="w-64 h-64 -translate-x-1/2 -translate-y-1/2 absolute" />
            </div>
            
            <p className="text-white/80 font-bold uppercase tracking-widest text-xs mb-4">New Guest ID Generated</p>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-6xl font-black tracking-[0.2em]">{lastGenerated}</span>
              <button 
                onClick={() => copyToClipboard(lastGenerated, 'last-generated')}
                className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
              >
                {copiedId === 'last-generated' ? (
                  <Check className="w-6 h-6 text-green-400" />
                ) : (
                  <Copy className="w-6 h-6" />
                )}
              </button>
            </div>
            <p className="text-sm text-white/80 max-w-xs transition-colors font-medium">
              Provide this code to the guest. It will expire in 24 hours or after first use.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Active Incidents List (Copied from Admin) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="bg-bg-secondary p-2 rounded-xl border border-card-border transition-colors">
                <ShieldAlert className="w-5 h-5 text-text-secondary opacity-70" />
              </div>
              <h2 className="text-xl font-black text-text-primary tracking-tight transition-colors">Active Incidents</h2>
            </div>
            <Link to="/incidents" className="text-sm font-bold text-accent-emergency hover:underline flex items-center gap-1 transition-colors">
              Incident Log <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-4">
            {loadingIncidents ? (
              <div className="bg-bg-secondary p-12 rounded-3xl border border-card-border flex flex-col items-center justify-center text-center transition-colors">
                <RefreshCw className="text-accent-emergency w-10 h-10 animate-spin mb-4" />
                <p className="text-sm text-text-secondary font-bold transition-colors uppercase tracking-widest opacity-40">Syncing incidents...</p>
              </div>
            ) : activeIncidents.length > 0 ? (
              activeIncidents
                .slice(0, 10)
                .map((incident) => (
                  <motion.div 
                    key={incident.id}
                    whileHover={{ scale: 1.01 }}
                    className={cn(
                      "bg-bg-secondary p-6 rounded-3xl border border-card-border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6",
                      incident.isGlobal && "animate-pulse-red border-accent-emergency/30 ring-2 ring-accent-emergency/10 ring-inset"
                    )}
                  >
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg", getSeverityColor(incident.severity))}>
                      <ShieldAlert className="w-7 h-7 text-white" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Link to={`/incident/${incident.id}`} className="block group">
                        <div className="flex items-center gap-2 mb-1">
                          {incident.isGlobal && (
                            <span className="text-[9px] font-black uppercase tracking-widest bg-accent-emergency text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm shadow-accent-emergency/20">
                              🌐 GLOBAL
                            </span>
                          )}
                          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-bg-primary text-text-secondary rounded-full border border-card-border transition-colors">
                            {SOS_TYPES.find(t => t.id === mapOldIncidentType(incident.type))?.label || incident.type}
                          </span>
                          <span className={cn("text-[9px] font-black uppercase tracking-widest transition-colors", getStatusColor(incident.status))}>
                            {incident.status}
                          </span>
                        </div>
                        <h3 className="font-bold text-text-primary truncate group-hover:text-accent-emergency transition-colors uppercase tracking-tight">{incident.description}</h3>
                        <p className="text-[10px] text-text-secondary flex items-center gap-1 mt-1 font-bold italic opacity-60 transition-colors">
                          <Clock className="w-3 h-3 text-accent-emergency" /> {formatTimestamp(incident.createdAt)}
                        </p>
                      </Link>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 bg-bg-primary/50 p-1 rounded-xl border border-card-border transition-colors">
                      {!incident.isGlobal && (
                        <button 
                          onClick={() => {
                            setGlobalModalIncidentId(incident.id);
                            setShowGlobalModal(true);
                          }}
                          className="p-2 hover:bg-bg-secondary hover:text-accent-emergency rounded-lg transition-all text-text-secondary opacity-50 hover:opacity-100"
                          title="Make it Global"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </button>
                      )}
                      
                      <button 
                        onClick={() => handleAdminAction(incident.id, 'assign', 'staff')}
                        disabled={performingAction?.startsWith(incident.id)}
                        className="p-2 hover:bg-bg-secondary hover:text-blue-500 rounded-lg transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                        title="Assign to Staff"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => {
                          setSecurityModalIncidentId(incident.id);
                          setShowSecurityModal(true);
                        }}
                        disabled={performingAction?.startsWith(incident.id)}
                        className="p-2 hover:bg-bg-secondary hover:text-accent-emergency rounded-lg transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                        title="Assign to Security"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>

                      <button 
                        onClick={() => handleAdminAction(incident.id, 'forward')}
                        disabled={performingAction?.startsWith(incident.id)}
                        className="p-2 hover:bg-bg-secondary hover:text-amber-500 rounded-lg transition-all text-text-secondary opacity-50 hover:opacity-100 disabled:opacity-20"
                        title="Escalate to Admin"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>

                      <Link 
                        to={`/incident/${incident.id}`}
                        className="p-2 bg-text-primary text-bg-primary rounded-lg transition-all shadow-sm hover:opacity-80"
                        title="Open Control Room"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                ))
            ) : (
              <div className="bg-bg-secondary p-12 rounded-3xl border-2 border-dashed border-card-border flex flex-col items-center justify-center text-center transition-colors">
                <div className="bg-bg-primary p-4 rounded-full mb-4 border border-card-border transition-colors">
                  <CheckCircle2 className="text-text-secondary w-10 h-10 opacity-30" />
                </div>
                <h3 className="font-bold text-text-primary mb-1 transition-colors">All Clear</h3>
                <p className="text-sm text-text-secondary opacity-60 transition-colors">No active emergencies at this time.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tokens */}
        <div className="lg:col-span-3 bg-bg-secondary rounded-3xl border border-card-border shadow-sm overflow-hidden transition-colors">
          <div className="p-6 border-b border-card-border flex items-center justify-between transition-colors">
            <div className="flex items-center gap-3">
              <div className="bg-bg-primary p-2 rounded-xl border border-card-border transition-colors">
                <Ticket className="w-5 h-5 text-text-secondary opacity-70 transition-colors" />
              </div>
              <h2 className="font-bold text-text-primary transition-colors">Recent Guest IDs</h2>
            </div>
            <span className="text-xs font-bold text-text-secondary opacity-40 uppercase tracking-widest transition-colors">Last 20 entries</span>
          </div>

          <div className="hidden md:block overflow-x-auto transition-colors">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-primary/50 transition-colors">
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Guest Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Email</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Code</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60">Created</th>
                  <th className="px-6 py-4 text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-60 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border transition-colors">
                {loadingGuests ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center transition-colors">
                      <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 text-accent-emergency animate-spin" />
                        <p className="text-sm text-text-secondary font-bold transition-colors opacity-40 uppercase tracking-widest">Loading records...</p>
                      </div>
                    </td>
                  </tr>
                ) : guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-bg-primary/50 transition-colors group">
                    <td className="px-6 py-4 transition-colors">
                        <div className="flex flex-col gap-1 transition-colors">
                          <span className="font-bold text-text-primary text-sm transition-colors">{guest.name || 'N/A'}</span>
                          <span className="text-[10px] text-text-secondary font-bold opacity-40 uppercase transition-colors">{guest.phone || 'N/A'}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 transition-colors">
                      {guest.email ? (
                        <div className="flex items-center gap-1.5 text-blue-500 group/email transition-colors">
                          <Mail className="w-3.5 h-3.5 opacity-60" />
                          <span className="text-xs font-bold transition-colors">{guest.email}</span>
                          <button 
                            onClick={() => copyToClipboard(guest.email!, guest.id + '-email')}
                            className={cn(
                              "transition-all p-1 hover:bg-blue-500/10 rounded text-blue-500",
                              copiedId === guest.id + '-email' ? "opacity-100" : "opacity-0 group-hover/email:opacity-100"
                            )}
                            title="Copy Email"
                          >
                            {copiedId === guest.id + '-email' ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-secondary italic opacity-30 transition-colors">Email not linked yet</span>
                      )}
                    </td>
                    <td className="px-6 py-4 transition-colors">
                      <div className="flex items-center gap-2 transition-colors">
                        <span className="font-black text-text-primary tracking-wider font-mono bg-bg-primary px-2 py-1 rounded-lg border border-card-border transition-colors">{guest.guestId}</span>
                        <button 
                          onClick={() => copyToClipboard(guest.guestId, guest.id)}
                          className="p-1.5 hover:bg-bg-primary rounded-lg transition-all text-text-secondary opacity-40 hover:opacity-100 hover:text-accent-emergency transition-colors"
                          title="Copy Code"
                        >
                          {copiedId === guest.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 transition-colors">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors",
                        guest.status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                        guest.status === 'used' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        "bg-text-secondary/10 text-text-secondary border-card-border"
                      )}>
                        {guest.status === 'active' ? <Clock className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {guest.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 transition-colors">
                      {formatDateTime(guest.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right transition-colors">
                      <button
                        onClick={() => {
                          setTokenToDelete(guest.id);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 bg-accent-emergency/10 text-accent-emergency rounded-xl transition-all hover:bg-accent-emergency/20 opacity-20 group-hover:opacity-100"
                        title="Delete Guest ID"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {guests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center transition-colors">
                      <div className="flex flex-col items-center gap-3 transition-colors">
                        <AlertCircle className="w-8 h-8 text-text-secondary opacity-20 transition-colors" />
                        <p className="text-sm text-text-secondary font-bold transition-colors opacity-40 uppercase tracking-widest">No guest records</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-card-border transition-colors">
            {loadingGuests ? (
              <div className="p-8 text-center transition-colors">
                 <RefreshCw className="w-8 h-8 text-accent-emergency animate-spin mx-auto mb-2" />
                 <p className="text-xs text-text-secondary font-bold uppercase tracking-widest transition-colors opacity-40">Syncing Records...</p>
              </div>
            ) : guests.map((guest) => (
              <div key={guest.id} className="p-5 space-y-4 hover:bg-bg-primary transition-all group">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1 transition-colors">
                    <span className="font-black text-text-primary transition-colors">{guest.name || 'N/A'}</span>
                    <span className="text-xs text-text-secondary font-bold opacity-40 transition-colors uppercase">{guest.phone || 'N/A'}</span>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors",
                    guest.status === 'active' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                    guest.status === 'used' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                    "bg-text-secondary/10 text-text-secondary border-card-border"
                  )}>
                    {guest.status}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 bg-bg-primary p-3 rounded-2xl border border-card-border transition-colors">
                   <div className="flex flex-col transition-colors">
                      <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-40 transition-colors">Guest Code</span>
                      <span className="font-black text-text-primary tracking-widest transition-colors">{guest.guestId}</span>
                   </div>
                   <button 
                      onClick={() => copyToClipboard(guest.guestId, guest.id)}
                      className="p-3 bg-bg-secondary hover:bg-bg-primary rounded-xl transition-all text-text-secondary opacity-60 hover:opacity-100 shadow-sm border border-card-border transition-colors"
                    >
                      {copiedId === guest.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-primary" />}
                    </button>
                </div>

                <div className="flex items-center justify-between text-[10px] transition-colors">
                   <div className="flex items-center gap-2 transition-colors">
                      <Clock className="w-3 h-3 text-accent-emergency opacity-60" />
                      <span className="text-text-secondary font-bold opacity-40 transition-colors">Issued {formatDateTime(guest.createdAt)}</span>
                   </div>
                   <button
                      onClick={() => {
                        setTokenToDelete(guest.id);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-accent-emergency font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                </div>
              </div>
            ))}
            {guests.length === 0 && !loadingGuests && (
              <div className="p-20 text-center transition-colors">
                 <Ticket className="w-12 h-12 text-text-secondary opacity-10 mx-auto mb-4 transition-colors" />
                 <p className="text-xs text-text-secondary font-bold uppercase tracking-widest leading-loose opacity-40 transition-colors">No guests registered<br/>Check back later</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats & Info */}
        <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-2 gap-8 space-y-6 lg:space-y-0 transition-colors">
          <div className="bg-bg-secondary p-6 sm:p-8 rounded-[2rem] text-text-primary border border-card-border shadow-xl transition-colors relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Users className="w-48 h-48 text-accent-emergency" />
            </div>
            <div className="flex items-center gap-3 mb-6 relative z-10 transition-colors">
              <div className="bg-bg-primary p-2 rounded-xl border border-card-border transition-colors">
                <Users className="w-5 h-5 text-accent-emergency transition-colors" />
              </div>
              <h2 className="font-bold transition-colors">Guest Stats</h2>
            </div>
            
            <div className="space-y-6 relative z-10 transition-colors">
              <div className="flex items-center justify-between transition-colors">
                <span className="text-text-secondary text-sm opacity-50 transition-colors">Active Tokens</span>
                <span className="text-2xl font-black transition-colors">{guests.filter(t => t.status === 'active').length}</span>
              </div>
              <div className="flex items-center justify-between transition-colors">
                <span className="text-text-secondary text-sm opacity-50 transition-colors">Verified Today</span>
                <span className="text-2xl font-black transition-colors">{guests.filter(t => t.status === 'used').length}</span>
              </div>
              <div className="h-px bg-card-border transition-colors" />
              <p className="text-xs text-text-secondary leading-relaxed opacity-40 transition-colors font-medium">
                Verified guests are linked to your account for security auditing and crisis coordination.
              </p>
            </div>
          </div>

          <div className="bg-bg-secondary p-6 rounded-3xl border border-card-border shadow-sm transition-colors">
            <h3 className="text-sm font-black text-text-primary uppercase tracking-widest mb-4 transition-colors">Security Protocol</h3>
            <ul className="space-y-3 transition-colors">
              <ProtocolStep number="1" text="Verify guest's physical identity at the desk." />
              <ProtocolStep number="2" text="Generate a unique 6-digit ID." />
              <ProtocolStep number="3" text="Instruct guest to enter the ID on their device." />
              <ProtocolStep number="4" text="Confirm 'Used' status in your dashboard." />
            </ul>
          </div>
        </div>
      </div>

      {/* Profile Update Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Update Profile"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-6 transition-colors">
          <div className="space-y-2 transition-colors">
            <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 opacity-60 transition-colors">Phone Number</label>
            <div className="relative transition-colors">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary opacity-40 w-5 h-5 transition-colors" />
              <input 
                type="tel"
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+1234567890"
                className="w-full bg-bg-primary border-2 border-card-border rounded-2xl pl-12 pr-4 py-4 font-bold focus:border-accent-emergency focus:ring-0 transition-all text-text-primary placeholder:text-text-secondary/30"
              />
            </div>
            <p className="text-[10px] text-text-secondary font-bold opacity-40 px-1 transition-colors uppercase tracking-tight">Required for emergency SMS and voice alerts.</p>
          </div>

          <div className="flex gap-3 transition-colors">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="flex-1 px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-bold hover:bg-bg-secondary transition-all border border-card-border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updatingProfile}
              className="flex-1 px-6 py-4 rounded-2xl bg-accent-emergency text-white font-bold hover:bg-accent-emergency/90 transition-all disabled:opacity-50 shadow-lg shadow-accent-emergency/20"
            >
              {updatingProfile ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setTokenToDelete(null);
        }}
        title="Delete Guest ID"
      >
        <div className="space-y-6 transition-colors">
          <p className="text-text-primary font-bold leading-relaxed transition-colors tracking-tight">
            This action cannot be undone. Are you sure you want to delete this guest ID?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 transition-colors">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setTokenToDelete(null);
              }}
              className="flex-1 px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-bold hover:bg-bg-secondary transition-all border border-card-border"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="flex-1 px-6 py-4 rounded-2xl bg-accent-emergency text-white font-bold hover:bg-accent-emergency/90 transition-all shadow-lg shadow-accent-emergency/20"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

      {/* Global Confirmation Modal */}
      <Modal
        isOpen={showGlobalModal}
        onClose={() => {
          setShowGlobalModal(false);
          setGlobalModalIncidentId(null);
        }}
        title="Broadcast as Global?"
      >
        <div className="space-y-6 transition-colors">
          <div className="bg-accent-emergency/10 p-6 rounded-3xl border border-accent-emergency/20 flex items-center gap-4 transition-colors">
            <div className="w-12 h-12 bg-accent-emergency rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-accent-emergency/20 transition-colors">
               <Globe className="w-6 h-6 text-white animate-pulse transition-colors" />
            </div>
            <div>
              <p className="text-accent-emergency font-black text-sm uppercase tracking-tight transition-colors">Organization-wide Alert</p>
              <p className="text-accent-emergency text-xs font-bold opacity-60 transition-colors">This will make the incident visible to EVERY user in the organization.</p>
            </div>
          </div>

          <p className="text-text-primary font-bold leading-relaxed px-1 transition-colors tracking-tight">
            Marking this as <span className="font-black text-accent-emergency">GLOBAL</span> will prioritize it on all Staff, Security, and Admin dashboards instantly.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 transition-colors">
            <button
              onClick={() => {
                setShowGlobalModal(false);
                setGlobalModalIncidentId(null);
              }}
              className="flex-1 px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-bold hover:bg-bg-secondary transition-all border border-card-border uppercase text-[10px] tracking-widest"
            >
              Cancel
            </button>
            <button
              onClick={() => globalModalIncidentId && handleToggleGlobal(globalModalIncidentId)}
              disabled={isTogglingGlobal}
              className="flex-1 px-6 py-4 rounded-2xl bg-text-primary text-bg-primary font-black hover:opacity-90 transition-all shadow-lg flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
            >
              {isTogglingGlobal ? <RefreshCw className="w-4 h-4 animate-spin transition-colors" /> : <Globe className="w-4 h-4 transition-colors" />}
              Make Global
            </button>
          </div>
        </div>
      </Modal>

      {/* Security Type Selection Modal */}
      <Modal
        isOpen={showSecurityModal}
        onClose={() => {
          setShowSecurityModal(false);
          setSecurityModalIncidentId(null);
        }}
        title="Dispatch Security"
        className="max-w-lg"
      >
        <div className="space-y-8 transition-colors">
          <div className="grid grid-cols-2 gap-6 transition-colors">
            {SOS_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  if (securityModalIncidentId) {
                    handleAdminAction(securityModalIncidentId, 'assign', 'security', type.id);
                  }
                  setShowSecurityModal(false);
                  setSecurityModalIncidentId(null);
                }}
                className="flex flex-col items-center justify-center gap-5 p-8 rounded-[2rem] bg-bg-secondary border border-card-border hover:shadow-2xl hover:border-text-primary/50 transition-all group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none transition-colors">
                  <type.icon className="w-20 h-20 text-text-primary" />
                </div>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 relative z-10 transition-colors",
                  type.bg
                )}>
                  <type.icon className="w-8 h-8 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-black uppercase tracking-[0.1em] text-text-primary relative z-10 transition-colors">{type.label}</span>
              </button>
            ))}
          </div>

          <div className="pt-4 text-center transition-colors">
            <button
              onClick={() => {
                setShowSecurityModal(false);
                setSecurityModalIncidentId(null);
              }}
              className="text-text-secondary font-black hover:text-text-primary transition-all text-xs uppercase tracking-widest opacity-40 hover:opacity-100"
            >
              Cancel dispatch
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ProtocolStep({ number, text }: { number: string, text: string }) {
  return (
    <li className="flex gap-3 transition-colors group">
      <span className="flex-shrink-0 w-5 h-5 bg-bg-primary text-text-secondary border border-card-border rounded-full flex items-center justify-center text-[10px] font-black group-hover:text-accent-emergency group-hover:border-accent-emergency/30 transition-all">{number}</span>
      <p className="text-[10px] text-text-secondary font-bold opacity-60 group-hover:opacity-100 transition-opacity leading-relaxed">{text}</p>
    </li>
  );
}
