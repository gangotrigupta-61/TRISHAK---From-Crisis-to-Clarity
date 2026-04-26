import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, or, and } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { 
  MapPin, 
  Navigation, 
  X,
  HelpCircle,
  Maximize2
} from 'lucide-react';
import { cn, getSeverityColor } from '../lib/utils';
import { Incident } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { SOS_TYPES, mapOldIncidentType } from '../constants';
import { Link } from 'react-router-dom';

interface CrisisMapProps {
  organizationId: string;
  height?: string;
  className?: string;
  showFloorSelector?: boolean;
}

export default function CrisisMap({ organizationId, height = "400px", className, showFloorSelector = true }: CrisisMapProps) {
  const { profile } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [floor, setFloor] = useState('1');

  const getIncidentIcon = (type: string) => {
    const normalizedType = mapOldIncidentType(type);
    const sosType = SOS_TYPES.find(t => t.id === normalizedType);
    return sosType ? sosType.icon : HelpCircle;
  };

  useEffect(() => {
    if (!organizationId) return;

    let q;
    const commonStatuses = ['reported', 'responding', 'assigned', 'escalated'];
    
    if (profile?.role === 'guest') {
      q = query(
        collection(db, 'incidents'),
        and(
          where('organizationId', '==', organizationId),
          where('status', 'in', commonStatuses),
          or(
            where('reporterId', '==', profile.uid),
            where('isGlobal', '==', true)
          )
        )
      );
    } else {
      q = query(
        collection(db, 'incidents'),
        where('organizationId', '==', organizationId),
        where('status', 'in', commonStatuses)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setIncidents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Incident)));
    }, (error) => {
      console.error('Error in map incidents listener:', error);
    });

    return () => unsubscribe();
  }, [organizationId, profile?.role, profile?.uid]);

  return (
    <div 
      className={cn(
        "bg-bg-primary rounded-[2.5rem] border-4 border-card-border shadow-xl relative overflow-hidden group/map transition-colors duration-500",
        className
      )}
      style={{ height }}
    >
      {/* Mock Map Background */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 transition-opacity group-hover/map:opacity-30 invert dark:invert-0"></div>
      
      {/* Mock Building Layout */}
      <div className="absolute inset-4 md:inset-8 border-2 border-card-border rounded-[2rem] bg-bg-secondary/40 backdrop-blur-sm grid grid-cols-4 grid-rows-3 gap-2 md:gap-4 p-4 md:p-8 transition-colors duration-300">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="border border-card-border/50 rounded-xl bg-bg-primary/30 flex items-center justify-center text-[8px] md:text-[10px] font-black text-text-secondary opacity-30 uppercase tracking-widest transition-colors">
            {floor}-{String.fromCharCode(65 + i)}
          </div>
        ))}
      </div>

      {/* Incident Markers */}
      {incidents.filter(inc => !inc.location.floor || inc.location.floor === floor).map((incident) => {
        const Icon = getIncidentIcon(incident.type);
        const isSelected = selectedIncident?.id === incident.id;
        
        // Deterministic position based on ID if lat/lng are missing or defaults
        const posX = incident.location.lng && incident.location.lng !== 0 ? incident.location.lng : (20 + (incident.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 60));
        const posY = incident.location.lat && incident.location.lat !== 0 ? incident.location.lat : (20 + (incident.id.split('').reduce((acc, char) => acc + char.charCodeAt(0) * 2, 0) % 60));

        return (
          <motion.button
            key={incident.id}
            initial={{ scale: 0 }}
            animate={{ 
              scale: isSelected ? 1.4 : 1,
              zIndex: isSelected ? 50 : 10
            }}
            whileHover={{ scale: isSelected ? 1.5 : 1.2 }}
            onClick={() => setSelectedIncident(incident)}
            className={cn(
              "absolute w-8 h-8 md:w-10 md:h-10 rounded-full border-2 md:border-4 shadow-xl flex items-center justify-center transition-all",
              isSelected ? "border-text-primary ring-4 ring-accent-emergency/30" : "border-text-primary",
              getSeverityColor(incident.severity)
            )}
            style={{ 
              left: `${posX}%`, 
              top: `${posY}%` 
            }}
          >
            <Icon className={cn("w-4 h-4 md:w-5 md:h-5", incident.severity === 'medium' ? 'text-black' : 'text-white')} />
            {incident.severity === 'critical' && (
              <div className="absolute -inset-2 bg-red-500 rounded-full animate-ping opacity-20"></div>
            )}
            {isSelected && (
              <div className="absolute -inset-4 border-2 border-dashed border-accent-emergency rounded-full animate-[spin_8s_linear_infinite] opacity-50"></div>
            )}
          </motion.button>
        );
      })}

      {/* Floor Selector Overlay */}
      {showFloorSelector && (
        <div className="absolute top-4 right-4 bg-bg-secondary/90 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-card-border flex gap-1 z-20 transition-colors">
          {['1', '2', '3'].map((f) => (
            <button
              key={f}
              onClick={() => setFloor(f)}
              className={cn(
                "w-8 h-8 rounded-xl text-[10px] font-black transition-all",
                floor === f ? "bg-accent-emergency text-white" : "text-text-secondary hover:bg-bg-primary"
              )}
            >
              F{f}
            </button>
          ))}
        </div>
      )}

      {/* Legend Mini */}
      <div className="absolute bottom-4 left-4 bg-bg-secondary/80 backdrop-blur-sm px-3 py-2 rounded-xl border border-card-border hidden md:flex items-center gap-4 z-20 transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-emergency"></div>
          <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">Critical</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500"></div>
          <span className="text-[8px] font-black text-text-secondary uppercase tracking-widest">High</span>
        </div>
      </div>

      {/* Fullscreen Link */}
      <Link 
        to="/map" 
        className="absolute top-4 left-4 p-2 bg-bg-secondary/90 backdrop-blur-md rounded-xl shadow-lg border border-card-border text-text-secondary hover:text-accent-emergency transition-all z-20"
        title="Open Full Map"
      >
        <Maximize2 className="w-4 h-4" />
      </Link>

      {/* Incident Detail Overlay */}
      <AnimatePresence>
        {selectedIncident && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-4 left-4 right-4 bg-bg-secondary p-4 rounded-3xl shadow-2xl border border-card-border flex flex-col gap-3 z-50 transition-colors duration-300"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn("p-1.5 rounded-lg", getSeverityColor(selectedIncident.severity))}>
                  {(() => {
                    const Icon = getIncidentIcon(selectedIncident.type);
                    return <Icon className={cn("w-4 h-4", selectedIncident.severity === 'medium' ? 'text-black' : 'text-white')} />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black text-text-primary uppercase tracking-widest">
                      {SOS_TYPES.find(t => t.id === mapOldIncidentType(selectedIncident.type))?.label || selectedIncident.type}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter border border-white/20",
                      getSeverityColor(selectedIncident.severity)
                    )}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                  <h3 className="font-bold text-text-secondary text-[10px] truncate max-w-[180px]">
                    {selectedIncident.description}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link 
                  to={`/incident/${selectedIncident.id}`}
                  className="bg-accent-emergency text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                >
                  Incident Room <Navigation className="w-3 h-3" />
                </Link>
                <button 
                  onClick={() => setSelectedIncident(null)} 
                  className="p-2 bg-bg-primary rounded-xl hover:bg-bg-secondary text-text-secondary transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1 px-1">
              <MapPin className="w-3 h-3 text-text-secondary opacity-50" />
              <p className="text-[9px] text-text-secondary opacity-50 font-bold uppercase tracking-widest">{selectedIncident.location.address}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
