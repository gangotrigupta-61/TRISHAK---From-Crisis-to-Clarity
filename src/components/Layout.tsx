import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { 
  Home, 
  Map as MapIcon, 
  Shield, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  AlertTriangle,
  User,
  Key,
  Power,
  Clock,
  Sun,
  Moon
} from 'lucide-react';
import { cn, getRoleDisplayName } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import Modal from './Modal';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, user, guestData, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await logout();
    navigate('/login');
  };

  const toggleDutyStatus = async () => {
    if (!profile || isUpdatingStatus) return;
    
    setIsUpdatingStatus(true);
    try {
      const newStatus = profile.status === 'active' ? 'inactive' : 'active';
      if (profile.uniqueId) {
        // ID-based user
        await updateDoc(doc(db, 'roleCodes', profile.uid), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      } else if (user) {
        // Firebase Auth user
        await updateDoc(doc(db, 'users', user.uid), {
          status: newStatus,
          lastDutyChange: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating duty status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const showDutyToggle = profile && ['staff', 'security', 'receptionist'].includes(profile.role);

  const navItems = [
    { label: 'Dashboard', icon: Home, path: '/', roles: ['guest', 'admin'] },
    { label: 'Staff Dashboard', icon: Home, path: '/staff/dashboard', roles: ['staff'] },
    { label: `${getRoleDisplayName(profile)} Dashboard`, icon: Home, path: '/security/dashboard', roles: ['security'] },
    { label: 'SOS', icon: AlertTriangle, path: '/sos', roles: ['guest', 'receptionist', 'staff', 'security', 'admin'] },
    { label: 'Reception', icon: User, path: '/reception/dashboard', roles: ['receptionist'] },
    { label: 'Roles', icon: Key, path: '/admin/roles', roles: ['admin'] },
    { label: 'Map', icon: MapIcon, path: '/map', roles: ['receptionist', 'staff', 'security', 'admin'] },
    { label: 'Incidents', icon: Shield, path: '/incidents', roles: ['receptionist', 'staff', 'security', 'admin'] },
    { label: 'Analytics', icon: BarChart3, path: '/analytics', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    profile && item.roles.includes(profile.role)
  );

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="bg-bg-secondary border-b border-card-border sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="bg-accent-emergency p-1.5 rounded-lg glow-red">
            <Shield className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-text-primary">TRISHAK</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:bg-bg-primary rounded-full transition-all duration-300 hover:rotate-12"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {showDutyToggle && (
            <button
              onClick={toggleDutyStatus}
              disabled={isUpdatingStatus}
              className={cn(
                "hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50",
                profile.status === 'active' 
                  ? "bg-green-600 text-white shadow-green-600/20 hover:bg-green-700" 
                  : "bg-bg-primary text-text-secondary border border-card-border shadow-bg-primary/20 hover:bg-bg-secondary"
              )}
            >
              <Power className={cn("w-3.5 h-3.5", isUpdatingStatus && "animate-pulse")} />
              {profile.status === 'active' ? 'On Duty' : 'Off Duty'}
            </button>
          )}

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-text-secondary hover:bg-bg-primary rounded-full"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          <div className="hidden md:flex items-center gap-3 pl-3 border-l border-card-border">
            <div className="text-right">
              <p className="text-sm font-medium text-text-primary">
                {profile?.role === 'guest' 
                  ? (guestData?.name || profile?.displayName || 'Guest') 
                  : (profile?.displayName || 'User')}
              </p>
              <p className="text-xs text-text-secondary">{getRoleDisplayName(profile)}</p>
            </div>
            <img 
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.role === 'guest' ? (guestData?.name || profile?.displayName || 'Guest') : (profile?.displayName || 'User')}`} 
              alt="Profile" 
              className="w-8 h-8 rounded-full border border-card-border"
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-bg-secondary border-r border-card-border p-4 gap-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                location.pathname === item.path 
                  ? "bg-accent-emergency/10 text-accent-emergency font-semibold" 
                  : "text-text-secondary hover:bg-bg-primary"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
          
          <div className="mt-auto pt-4 border-t border-card-border">
            <button 
              onClick={() => setShowSignOutModal(true)}
              className="flex items-center gap-3 px-4 py-3 w-full text-text-secondary hover:bg-accent-emergency/10 hover:text-accent-emergency rounded-xl transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              className="fixed inset-0 z-[60] bg-bg-primary p-6 flex flex-col gap-4 transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <img 
                    src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                    alt="Profile" 
                    className="w-12 h-12 rounded-full border-2 border-accent-emergency/20"
                  />
                  <div>
                    <p className="font-bold text-text-primary transition-colors">
                      {profile?.role === 'guest' 
                        ? (guestData?.name || profile?.displayName || 'Guest') 
                        : (profile?.displayName || 'User')}
                    </p>
                    <p className="text-xs text-text-secondary font-black uppercase opacity-60 transition-colors tracking-tight">{getRoleDisplayName(profile)}</p>
                  </div>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-bg-secondary border border-card-border rounded-full text-text-primary transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              {showDutyToggle && (
                <button
                  onClick={toggleDutyStatus}
                  disabled={isUpdatingStatus}
                  className={cn(
                    "flex items-center justify-between px-6 py-5 rounded-3xl transition-all mb-2 shadow-2xl border",
                    profile.status === 'active' 
                      ? "bg-green-600 border-green-500/20 text-white shadow-green-500/10" 
                      : "bg-bg-secondary border-card-border text-text-secondary shadow-bg-primary/20"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <Power className={cn("w-6 h-6", isUpdatingStatus && "animate-pulse")} />
                    <div className="text-left">
                      <p className="font-black uppercase tracking-widest text-[10px] opacity-80 transition-colors">Duty Status</p>
                      <p className="text-sm font-black transition-colors">{profile.status === 'active' ? 'ON DUTY' : 'OFF DUTY'}</p>
                    </div>
                  </div>
                  <div className={cn(
                    "w-12 h-6 rounded-full relative transition-all border",
                    profile.status === 'active' ? "bg-white/20 border-white/30" : "bg-bg-primary border-card-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                      profile.status === 'active' ? "right-1" : "left-1"
                    )} />
                  </div>
                </button>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 py-2">
                {filteredNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-4 px-5 py-4 rounded-2xl text-lg font-black tracking-tight transition-all border transition-colors",
                      location.pathname === item.path 
                        ? "bg-accent-emergency text-white border-accent-emergency shadow-xl shadow-accent-emergency/20" 
                        : "text-text-secondary bg-bg-secondary/50 border-card-border hover:bg-bg-secondary"
                    )}
                  >
                    <item.icon className="w-6 h-6" />
                    {item.label}
                  </Link>
                ))}
              </div>

              <button 
                onClick={() => setShowSignOutModal(true)}
                className="mt-auto flex items-center justify-center gap-4 px-5 py-5 w-full text-accent-emergency font-black uppercase tracking-widest text-xs border-2 border-accent-emergency/10 rounded-2xl hover:bg-accent-emergency/5 transition-all"
              >
                <LogOut className="w-6 h-6" />
                Sign Out
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>


      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Confirm Sign Out"
      >
        <div className="space-y-8 text-center py-4 transition-colors">
          <div className="w-20 h-20 bg-accent-emergency/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent-emergency/20 transition-colors">
            <LogOut className="w-10 h-10 text-accent-emergency" />
          </div>
          <p className="text-text-secondary font-bold uppercase tracking-tight text-xs opacity-60 transition-colors">
            Are you sure you want to sign out of TRISHAK?
          </p>
          <div className="flex flex-col sm:flex-row gap-4 transition-colors">
            <button
              onClick={() => setShowSignOutModal(false)}
              className="flex-1 px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-black uppercase tracking-widest text-[10px] border border-card-border hover:bg-bg-secondary hover:text-text-primary transition-all transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 px-6 py-4 rounded-2xl bg-accent-emergency text-white font-black uppercase tracking-widest text-[10px] hover:opacity-90 transition-all shadow-xl shadow-accent-emergency/20 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Modal>

      {/* Mobile Bottom Nav */}
        <nav className="md:hidden bg-bg-secondary border-t border-card-border px-6 py-3 flex items-center justify-between sticky bottom-0 z-30">
        {filteredNavItems.slice(0, 4).map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors duration-200",
              location.pathname === item.path ? "text-accent-emergency" : "text-text-secondary opacity-50"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <footer className="bg-[#05070a] text-white py-12 px-4 border-t border-card-border transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="bg-accent-emergency p-2 rounded-xl glow-red">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-xl tracking-tighter">TRISHAK</h3>
              <p className="text-text-secondary text-[10px] font-black uppercase tracking-widest opacity-40">Crisis Coordination System</p>
            </div>
          </div>
          
          <div className="text-center md:text-right space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-text-secondary opacity-40">
              Created by <span className="text-text-primary opacity-100">Holists</span>
            </p>
            <p className="text-[10px] text-text-secondary/20 font-black uppercase tracking-widest">
              © 2026 TRISHAK. All rights reserved. • v1.0.4
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
