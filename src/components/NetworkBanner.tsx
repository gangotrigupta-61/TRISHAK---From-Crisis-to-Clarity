import { useNetwork } from '../hooks/useNetwork';
import { WifiOff, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function NetworkBanner() {
  const isOnline = useNetwork();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="bg-red-600 text-white overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-wider">
            <WifiOff className="w-4 h-4 animate-pulse" />
            <span>You are offline. Reconnecting to TRISHAK...</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
