import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { AlertCircle, Globe, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Persist these across component remounts (navigation)
const globalPlayedAlerts = new Set<string>();
let globalIsFirstCheck = true;

export default function GlobalAlertBanner() {
  const { profile } = useAuth();
  const [globalIncidents, setGlobalIncidents] = useState<any[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!profile?.organizationId) return;

    const q = query(
      collection(db, 'incidents'),
      where('organizationId', '==', profile.organizationId),
      where('isGlobal', '==', true),
      where('status', 'in', ['reported', 'assigned', 'forwarded', 'investigating'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // On first load of the APP (not just component), mark existing as already played
      if (globalIsFirstCheck) {
        incidents.forEach((inc: any) => globalPlayedAlerts.add(inc.id));
        globalIsFirstCheck = false;
      } else {
        // Only trigger sound for NEW incidents that were not previously seen in this session
        incidents.forEach((incident: any) => {
          if (!globalPlayedAlerts.has(incident.id)) {
            // One-time alert sound (Emergency Siren/Beep)
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.7;
            audio.play().catch(e => console.error('Audio play failed:', e));
            globalPlayedAlerts.add(incident.id);
          }
        });
      }

      setGlobalIncidents(incidents);
      if (incidents.length > 0) {
        // Re-show banner if new global incidents appear
        setDismissed(false);
      }
    }, (err) => {
      console.error('Error in global alert listener:', err);
    });

    return () => unsubscribe();
  }, [profile?.organizationId]);

  if (globalIncidents.length === 0 || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="bg-red-600 text-white overflow-hidden relative z-50 ring-4 ring-red-600 ring-inset"
      >
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center p-1.5 bg-white/20 rounded-lg animate-pulse">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black uppercase tracking-widest whitespace-nowrap">
                  🚨 GLOBAL ALERT ACTIVE
                </span>
                <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 bg-white text-red-600 rounded-full text-[10px] font-black uppercase">
                  <Globe className="w-3 h-3" />
                  Serious Incident
                </div>
              </div>
              <p className="text-xs font-medium text-white/90 truncate">
                {globalIncidents.length} Emergency {globalIncidents.length === 1 ? 'incident' : 'incidents'} requires immediate attention.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setDismissed(true)}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Animated scanning line */}
        <motion.div 
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-1/3 skew-x-12"
        />
      </motion.div>
    </AnimatePresence>
  );
}
