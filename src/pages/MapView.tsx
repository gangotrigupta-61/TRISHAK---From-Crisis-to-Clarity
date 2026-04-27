import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { 
  Navigation, 
  Layers, 
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '../lib/utils';
import CrisisMap from '../components/CrisisMap';

export default function MapView() {
  const { profile } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={cn(
      "flex flex-col gap-4 lg:gap-6 relative transition-all duration-500",
      isFullscreen ? "fixed inset-0 z-200 bg-bg-primary p-4 md:p-10" : "h-[calc(100vh-180px)] lg:h-[calc(100vh-140px)] pb-16 lg:pb-0 font-sans transition-colors duration-500"
    )}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 lg:gap-4 transition-colors">
          <div className="bg-accent-emergency p-2.5 lg:p-3 rounded-xl lg:rounded-2xl shadow-lg shadow-red-500/20">
            <Navigation className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-text-primary tracking-tight transition-colors">Command Map</h1>
            <p className="text-xs lg:text-sm text-text-secondary font-medium tracking-tight flex items-center gap-2 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live Situational Tracking
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-bg-secondary border border-card-border rounded-xl lg:rounded-2xl text-text-secondary font-bold hover:bg-bg-primary transition-all shadow-sm text-xs lg:text-base"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 lg:w-5 lg:h-5" /> : <Maximize2 className="w-4 h-4 lg:w-5 lg:h-5" />}
            <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 relative">
        {profile?.organizationId ? (
          <CrisisMap 
            organizationId={profile.organizationId} 
            height="100%" 
            className="border-none"
            showFloorSelector={true}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 bg-bg-primary rounded-[2.5rem] border-4 border-card-border shadow-xl transition-colors">
             <Layers className="w-16 h-16 text-text-secondary opacity-20 mb-4" />
             <p className="text-text-secondary opacity-50 font-bold uppercase tracking-widest text-center">Awaiting Organization Authorization...</p>
          </div>
        )}
      </div>
    </div>
  );
}
