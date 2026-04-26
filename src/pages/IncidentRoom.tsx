import { useParams, useNavigate } from 'react-router-dom';
import IncidentRoomComponent from '../components/IncidentRoomComponent';
import { motion } from 'motion/react';
import { Zap } from 'lucide-react';

export default function IncidentRoom() {
  const { id } = useParams();
  const navigate = useNavigate();

  if (!id) return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6 transition-colors duration-500">
      <div className="bg-bg-secondary p-12 rounded-[2.5rem] border border-card-border shadow-2xl text-center max-w-md">
        <h2 className="text-2xl font-black text-text-primary mb-2">Incident Not Found</h2>
        <p className="text-text-secondary mb-6">The incident you're looking for doesn't exist or you don't have permission to view it.</p>
        <button 
          onClick={() => navigate('/dashboard')}
          className="bg-text-primary text-bg-primary px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-primary p-3 md:p-8 transition-colors duration-500">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: -0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight flex items-center gap-3 transition-colors">
              <div className="bg-accent-emergency p-2 rounded-xl shadow-lg shadow-red-500/20">
                <Zap className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              Command Center
            </h1>
            <p className="text-xs md:text-sm text-text-secondary font-medium mt-1">Real-time emergency reports hub.</p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto bg-bg-secondary border border-card-border text-text-secondary px-6 py-3 rounded-2xl font-bold hover:bg-bg-primary transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Dashboard
          </button>
        </motion.div>

        <div className="bg-bg-secondary rounded-[2rem] md:rounded-[2.5rem] border-4 border-text-primary shadow-2xl shadow-black/20 p-4 md:p-8 min-h-[500px] md:min-h-[700px] transition-colors duration-500 glass-card">
          <IncidentRoomComponent 
            incidentId={id} 
            onBack={() => navigate('/dashboard')}
            fullScreenLink={false}
          />
        </div>
      </div>
    </div>
  );
}
