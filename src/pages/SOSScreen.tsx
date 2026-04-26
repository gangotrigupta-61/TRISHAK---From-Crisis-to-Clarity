import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ShieldAlert, 
  MapPin,
  Navigation,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { IncidentType, IncidentSeverity } from '../types';
import { SOS_TYPES } from '../constants';

export default function SOSScreen() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [severity, setSeverity] = useState<IncidentSeverity>('high');
  const [description, setDescription] = useState('');
  const [floor, setFloor] = useState('1');
  const [zone, setZone] = useState('A');
  const [location, setLocation] = useState<{ lat: number; lng: number; address: string }>({
    lat: 0,
    lng: 0,
    address: 'Detecting location...'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionState | 'unknown'>('unknown');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  useEffect(() => {
    let watchId: number | null = null;

    const startTracking = () => {
      if (navigator.geolocation) {
        setIsTracking(true);
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            setLocation(prev => ({
              ...prev,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              address: 'Main Lobby, Floor 1' // Mocking address for demo
            }));
          },
          (err) => {
            console.error('Location tracking error:', err);
            setIsTracking(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
    };

    // Check permission status if supported
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        setPermissionStatus(result.state);
        if (result.state === 'granted') {
          startTracking();
        }
        result.onchange = () => {
          setPermissionStatus(result.state);
          if (result.state === 'granted') {
            startTracking();
          } else {
            setIsTracking(false);
          }
        };
      });
    } else {
      // Fallback for browsers that don't support permissions API
      startTracking();
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const requestPermission = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermissionStatus('granted');
          setLocation(prev => ({
            ...prev,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: 'Main Lobby, Floor 1'
          }));
        },
        (err) => {
          console.error('Permission request failed:', err);
          setPermissionStatus('denied');
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSubmit = async () => {
    if (!selectedType || !user) return;
    
    setLoading(true);
    
    // Try to get one last high-accuracy fix
    let finalLocation = { ...location };
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { 
          enableHighAccuracy: true, 
          timeout: 3000 
        });
      });
      finalLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        address: location.address // Keep the existing address or update if we had a reverse geocoder
      };
    } catch (e) {
      console.warn('Final location fix failed, using last known:', e);
    }

    try {
      // Determine specialized security type based on incident type
      const securityTypes: Record<string, string> = {
        'medical': 'medical',
        'theft': 'theft',
        'fire': 'fire',
        'other': 'other'
      };
      const securityType = securityTypes[selectedType] || 'other';

      const incidentData = {
        type: selectedType,
        severity,
        status: 'reported',
        securityType: securityType, // Auto-assign specialized type
        organizationId: profile?.organizationId,
        reporterId: user.uid,
        reporterName: profile?.displayName || 'Unknown Guest',
        reporterRole: profile?.role || 'guest',
        location: {
          ...finalLocation,
          floor,
          zone,
          // Map zone to approximate lat/lng percentages (0-100) for the mock map if no real GPS
          lat: finalLocation.lat || (20 + (zone.charCodeAt(0) % 5) * 15),
          lng: finalLocation.lng || (20 + (parseInt(floor) % 5) * 15)
        },
        description: description || `Emergency ${selectedType} reported.`,
        triggeredBy: user.uid,
        triggeredByRole: profile?.role || 'guest',
        alertsSent: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        responders: []
      };

      const docRef = await addDoc(collection(db, 'incidents'), incidentData);
      
      // Add initial system message
      await addDoc(collection(db, `incidents/${docRef.id}/messages`), {
        incidentId: docRef.id,
        senderId: user.uid,
        senderName: 'TRISHAK System',
        senderRole: 'system',
        text: `Incident reported: ${selectedType.toUpperCase()}. Responders are being notified.`,
        type: 'system',
        timestamp: serverTimestamp()
      });

      navigate(`/incident/${docRef.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to report incident. Please try again.');
      try {
        handleFirestoreError(err, OperationType.CREATE, 'incidents');
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 px-4 md:px-0 transition-colors duration-500">
      <div className="mb-6 md:mb-8 transition-colors">
        <h1 className="text-2xl md:text-3xl font-black text-text-primary mb-2 transition-colors">Emergency SOS</h1>
        <p className="text-sm md:text-base text-text-secondary font-medium transition-colors">Select the type of emergency to alert responders immediately.</p>
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 border-2 border-red-500/20 rounded-2xl flex items-center gap-4 transition-colors"
        >
          <div className="bg-accent-emergency p-2 rounded-xl text-white">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-accent-emergency">Report Failed</p>
            <p className="text-xs text-text-secondary">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-xs font-black text-accent-emergency hover:underline"
          >
            DISMISS
          </button>
        </motion.div>
      )}

      {permissionStatus === 'denied' && (
    <div className="mb-6 p-4 md:p-6 bg-red-500/10 border-2 border-red-500/20 rounded-3xl flex flex-col md:flex-row items-start md:items-center gap-4 shadow-sm transition-colors"
    >
      <div className="bg-accent-emergency p-3 rounded-2xl text-white shadow-lg shadow-red-500/20 shrink-0">
        <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
      </div>
      <div className="flex-1">
        <p className="text-base font-black text-text-primary uppercase tracking-wider transition-colors">Location Access Denied</p>
        <p className="text-sm text-text-secondary font-medium leading-relaxed transition-colors">Please enable location permissions in your browser settings to ensure responders can find you quickly.</p>
      </div>
      <button 
        onClick={requestPermission}
        className="w-full md:w-auto bg-accent-emergency hover:opacity-90 text-white px-6 py-3 rounded-2xl text-xs font-black shadow-lg shadow-red-500/20 transition-all active:scale-95 shrink-0"
      >
        ENABLE NOW
      </button>
    </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4"
          >
            {SOS_TYPES.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSelectedType(item.id);
                  setStep(2);
                }}
                className={cn(
                  "flex md:flex-col items-center gap-4 md:gap-0 md:justify-center p-5 md:p-8 rounded-[2rem] border-2 transition-all duration-300 group",
                  selectedType === item.id 
                    ? "bg-accent-emergency/5 border-accent-emergency shadow-xl shadow-red-500/10 ring-2 ring-accent-emergency/10" 
                    : "bg-bg-secondary border-card-border hover:border-accent-emergency/50 hover:bg-bg-primary"
                )}
              >
                <div className={cn(
                  "w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center md:mb-4 transition-transform group-hover:scale-110 shadow-lg shrink-0",
                  item.bg
                )}>
                  <item.icon className="text-white w-7 h-7 md:w-10 md:h-10" />
                </div>
                <div className="flex flex-col items-start md:items-center">
                  <span className="font-black text-lg md:text-xl text-text-primary group-hover:text-accent-emergency transition-colors uppercase tracking-tight">{item.label}</span>
                  <span className="md:hidden text-xs text-text-secondary font-bold uppercase tracking-widest mt-0.5 opacity-50">Report Incident</span>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="bg-bg-secondary p-6 rounded-3xl border border-card-border shadow-sm transition-colors duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-2xl shadow-lg",
                    SOS_TYPES.find(t => t.id === selectedType)?.bg
                  )}>
                    {(() => {
                      const Icon = SOS_TYPES.find(t => t.id === selectedType)?.icon;
                      return Icon ? <Icon className="text-white w-6 h-6" /> : null;
                    })()}
                  </div>
                  <div>
                    <h2 className="font-bold text-xl text-text-primary capitalize transition-colors">{selectedType} Incident</h2>
                    <p className="text-sm text-text-secondary transition-colors">Confirm details below</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStep(1)}
                  className="text-sm font-bold text-accent-emergency hover:underline opacity-80"
                >
                  Change Type
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-text-primary mb-3 uppercase tracking-wider opacity-60">Severity Level</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['low', 'medium', 'high', 'critical'] as IncidentSeverity[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        className={cn(
                          "py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all border-2",
                          severity === s 
                            ? "bg-accent-emergency border-accent-emergency text-white shadow-md shadow-red-500/20" 
                            : "bg-bg-primary border-card-border text-text-secondary hover:bg-bg-secondary"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-primary mb-3 uppercase tracking-wider opacity-60">Description (Optional)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Briefly describe the situation..."
                    className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 focus:border-accent-emergency focus:ring-0 transition-all min-h-[120px] text-text-primary placeholder:text-text-secondary/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-3 uppercase tracking-wider opacity-60">Floor</label>
                    <select
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 focus:border-accent-emergency focus:ring-0 transition-all font-bold text-text-primary appearance-none"
                    >
                      {['1', '2', '3', '4', '5', 'B1', 'B2'].map(f => (
                        <option key={f} value={f}>Floor {f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-3 uppercase tracking-wider opacity-60">Zone / Area</label>
                    <select
                      value={zone}
                      onChange={(e) => setZone(e.target.value)}
                      className="w-full bg-bg-primary border-2 border-card-border rounded-2xl p-4 focus:border-accent-emergency focus:ring-0 transition-all font-bold text-text-primary appearance-none"
                    >
                      {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(z => (
                        <option key={z} value={z}>Zone {z}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className={cn(
                  "p-6 rounded-[2.5rem] border-2 flex flex-col gap-4 transition-all duration-500",
                  isTracking 
                    ? "bg-accent-emergency/5 border-accent-emergency/20 shadow-inner" 
                    : "bg-bg-primary border-card-border"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-xl shadow-sm transition-colors",
                        isTracking ? "bg-accent-emergency text-white animate-pulse" : "bg-bg-secondary text-text-secondary border border-card-border"
                      )}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest opacity-50">Live Location Tracking</p>
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", isTracking ? "bg-green-500" : "bg-text-secondary opacity-30")} />
                          <span className="text-xs font-bold text-text-secondary">{isTracking ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (navigator.geolocation) {
                          setLocation(prev => ({ ...prev, address: 'Updating location...' }));
                          navigator.geolocation.getCurrentPosition(
                            (pos) => {
                              setLocation(prev => ({
                                ...prev,
                                lat: pos.coords.latitude,
                                lng: pos.coords.longitude,
                                address: 'Main Lobby, Floor 1' // Mocking address for demo
                              }));
                            },
                            (err) => {
                              console.error(err);
                              setLocation(prev => ({ ...prev, address: 'Location error' }));
                            },
                            { enableHighAccuracy: true }
                          );
                        }
                      }}
                      className="p-3 hover:bg-bg-secondary hover:shadow-md rounded-2xl transition-all text-text-secondary hover:text-accent-emergency bg-bg-secondary/50 border border-card-border"
                      title="Force Refresh"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-text-primary p-8 rounded-[2rem] border-4 border-accent-emergency/20 shadow-2xl relative overflow-hidden group/loc transition-colors duration-500">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover/loc:opacity-10 transition-opacity">
                      <MapPin className="w-24 h-24 text-accent-emergency" />
                    </div>
                    <p className="text-[10px] font-black text-accent-emergency uppercase tracking-[0.2em] mb-2 opacity-80 transition-colors">Verified Emergency Location</p>
                    <p className="text-3xl md:text-4xl font-black text-bg-primary leading-tight tracking-tight mb-4 relative z-10 transition-colors">
                      {location.address}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] font-black text-text-secondary uppercase tracking-widest bg-bg-primary/5 p-2 px-3 rounded-lg inline-flex border border-card-border/10 transition-colors">
                      <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-accent-emergency rounded-full" /> LAT: {location.lat.toFixed(6)}</span>
                      <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-accent-emergency rounded-full" /> LNG: {location.lng.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-accent-emergency hover:opacity-90 text-white font-black text-xl py-6 rounded-3xl shadow-xl shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldAlert className="w-8 h-8" />
                  SEND EMERGENCY ALERT
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
