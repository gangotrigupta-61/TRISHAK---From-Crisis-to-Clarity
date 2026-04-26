import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { auth, googleProvider, db, handleFirestoreError, OperationType } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { signInWithPopup, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { Shield, AlertCircle, CheckCircle2, Info, User, Key, Building2, ShieldCheck, UserCheck, Users, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole } from '../types';
import Modal from '../components/Modal';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'login' | 'guest-id' | 'staff-login' | 'email-setup'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [guestCode, setGuestCode] = useState('');
  const [staffData, setStaffData] = useState({ orgId: '', uniqueId: '' });
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<any>(null);

  useEffect(() => {
    if (pendingProfile?.phone) {
      setPhone(pendingProfile.phone);
    }
  }, [pendingProfile]);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const { isGuestVerified, setGuestVerified, loginWithId, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Handle navigation based on profile updates
  useEffect(() => {
    if (profile && !authLoading) {
      if (profile.role === 'guest' && !isGuestVerified) {
        setStep('guest-id');
      } else {
        const roleRoutes: Record<string, string> = {
          security: '/security/dashboard',
          staff: '/staff/dashboard',
          receptionist: '/reception/dashboard',
          admin: '/admin/dashboard'
        };
        const target = roleRoutes[profile.role] || '/';
        if (window.location.pathname !== target) {
          navigate(target, { replace: true });
        }
      }
    }
  }, [profile, isGuestVerified, navigate, authLoading]);

  const handleSignOut = async () => {
    setShowSignOutModal(false);
    await signOut(auth);
    setStep('login');
    setSelectedRole(null);
  };

  const handleGoBack = async () => {
    setError(null);
    setSelectedRole(null);
    setGuestCode('');
    setStaffData({ orgId: '', uniqueId: '' });
    
    if (auth.currentUser) {
      await signOut(auth);
    }
    
    setStep('login');
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.log('Login popup closed by user');
      } else if (err.code === 'auth/popup-blocked') {
        setError('The login popup was blocked by your browser. Please allow popups for this site and click the button again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error: Please check your internet connection and ensure no ad-blockers are blocking Google Authentication.');
      } else if (err.code === 'auth/internal-error') {
        setError('A Firebase Authentication internal error occurred. This is often due to browser restrictions or configuration mismatch. Please refresh and try again, or check if popups are fully allowed.');
      } else {
        console.error(err);
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (loading) return;
    setSelectedRole(role);
    try {
      if (role === 'guest') {
        setStep('guest-id');
      } else if (['staff', 'security', 'receptionist'].includes(role)) {
        setStep('staff-login');
      } else {
        // Admin flow uses Google Login
        await handleGoogleLogin();
        // After login, if it's a new admin, finalize onboarding
        const user = auth.currentUser;
        if (user) {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists()) {
            await finalizeOnboarding('admin');
          }
        }
      }
    } catch (err: any) {
      console.error("Role selection error:", err);
      setError('An error occurred. Please try again.');
    }
  };

  const finalizeOnboarding = async (role: UserRole, extraData?: any) => {
    const user = auth.currentUser;
    if (!user || loading) return;

    setLoading(true);
    try {
      const profileRef = doc(db, 'users', user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        await updateDoc(profileRef, {
          updatedAt: serverTimestamp(),
          ...extraData
        });
      } else {
        const profileData = {
          uid: user.uid,
          email: user.email || extraData?.email || '',
          displayName: extraData?.displayName || user.displayName || 'Anonymous',
          photoURL: user.photoURL || '',
          role: role,
          status: 'inactive', // Default to Off Duty
          lastDutyChange: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...extraData
        };
        await setDoc(profileRef, profileData);
      }
      
      // Strict role-based routing
      const roleRoutes: Record<string, string> = {
        security: '/security/dashboard',
        staff: '/staff/dashboard',
        receptionist: '/reception/dashboard',
        admin: '/admin/dashboard',
        guest: '/'
      };
      navigate(roleRoutes[role] || '/', { replace: true });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setError('Failed to create profile. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyStaffCredentials = async () => {
    if (verifying || !staffData.orgId || !staffData.uniqueId) {
      if (!staffData.orgId || !staffData.uniqueId) {
        setError('Please enter both Organization ID and Unique ID.');
      }
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      await loginWithId(staffData.orgId, staffData.uniqueId);
      // Navigation is handled by the useEffect watching 'profile'
    } catch (err: any) {
      console.error("Staff verification error:", err);
      // loginWithId/useAuth already handlesFirestoreError if it's a permission issue
      setError(err.message || 'Invalid Organization ID or Unique ID. Please retry.');
    } finally {
      setVerifying(false);
    }
  };

  const verifyGuestCode = async () => {
    if (verifying) return;
    
    // 1. Trim and Normalize Input
    const cleanCode = guestCode.trim().toUpperCase();
    console.log('[GuestVerify] Raw input:', guestCode);
    console.log('[GuestVerify] Cleaned code:', cleanCode);

    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setVerifying(true);
    setError(null);
    
    try {
      console.log('[GuestVerify] Fetching record for code:', cleanCode);
      const user = auth.currentUser;
      console.log('[GuestVerify] Current Auth UID:', user?.uid);
      console.log('[GuestVerify] Current Auth Email:', user?.email);
      
      // 2. Fetch via Document ID
      const guestRef = doc(db, 'guests', cleanCode);
      let guestSnap = await getDoc(guestRef);
      
      let guestData: any = null;
      let guestDocId = '';

      if (guestSnap.exists()) {
        guestDocId = guestSnap.id;
        guestData = guestSnap.data();
        console.log('[GuestVerify] Record found via Document ID:', guestData);
      } else {
        // Fallback: Query by 'code' field
        console.log('[GuestVerify] Not found via Doc ID, trying query by field...');
        try {
          const guestsRef = collection(db, 'guests');
          const q = query(guestsRef, where('code', '==', cleanCode), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            guestDocId = querySnapshot.docs[0].id;
            guestData = querySnapshot.docs[0].data();
            console.log('[GuestVerify] Record found via field query:', guestData);
          }
        } catch (queryError) {
          console.warn('[GuestVerify] Field query failed:', queryError);
        }
      }

      // 3. Handle Not Found
      if (!guestData) {
        console.warn('[GuestVerify] No matching record found for:', cleanCode);
        setError('Invalid Guest ID');
        return;
      }

      // 4. Handle Status Logic (REUSABLE ID LOGIC)
      console.log('[GuestVerify] Record status:', guestData.status);
      
      // We allow 'active' AND 'used'. Only 'expired' or deleted records are blocked.
      if (guestData.status === 'expired') {
        console.warn('[GuestVerify] ID has expired');
        setError('Guest ID has expired. Please contact receptionist.');
        return;
      }

      // 5. Success: Proceed with login
      console.log('[GuestVerify] Validation successful. Finalizing access for user:', auth.currentUser?.uid);
      
      setGuestVerified(true, {
        guestId: cleanCode,
        name: guestData.name,
        phone: guestData.phone
      });

      // 6. Track Session (New Design for Reusable IDs)
      try {
        const sessionRef = doc(collection(db, 'guestSessions'));
        await setDoc(sessionRef, {
          sessionId: sessionRef.id,
          guestId: guestDocId,
          guestCode: cleanCode,
          userId: auth.currentUser?.uid,
          userEmail: auth.currentUser?.email || '',
          timestamp: serverTimestamp(),
          userAgent: navigator.userAgent
        });
        console.log('[GuestVerify] Session tracked:', sessionRef.id);
      } catch (sessionError) {
        console.warn('[GuestVerify] Failed to track session:', sessionError);
      }

      // Update guest status to 'used' (meaning it has been activated at least once)
      // But we don't block subsequent logins based on this.
      const guestUpdate: any = {
        lastUsedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (guestData.status === 'active') {
        guestUpdate.status = 'used';
        // Claim the record for this user
        guestUpdate.usedBy = user?.uid || '';
        guestUpdate.email = user?.email || '';
      } else if (guestData.status === 'used' && !guestData.usedBy) {
        // Migration/fallback: If status is used but usedBy is missing, claim it
        guestUpdate.usedBy = user?.uid || '';
        guestUpdate.email = user?.email || '';
      }

      // Update both collections for consistency
      const tokenRef = doc(db, 'guestTokens', cleanCode);
      try {
        await updateDoc(tokenRef, {
          status: 'used',
          guestId: user?.uid || '',
          usedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn('[GuestVerify] guestTokens update failed:', e);
      }

      await updateDoc(doc(db, 'guests', guestDocId), guestUpdate);

      await finalizeOnboarding('guest', {
        guestTokenId: cleanCode,
        organizationId: guestData.organizationId,
        displayName: guestData.name
      });

    } catch (err: any) {
      console.error("[GuestVerify] Verification Error:", err);
      setError('Verification failed. Please check your connection.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-6 transition-colors duration-500">
      {(loading || authLoading) && (
        <div className="fixed inset-0 bg-bg-primary/80 backdrop-blur-sm z-[200] flex items-center justify-center transition-colors">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-accent-emergency border-t-transparent rounded-full animate-spin"></div>
            <p className="text-text-primary font-black uppercase tracking-widest text-xs">Authenticating...</p>
          </div>
        </div>
      )}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-bg-secondary rounded-3xl shadow-2xl overflow-hidden border border-card-border transition-colors duration-300"
      >
        <div className="bg-accent-emergency p-10 flex flex-col items-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10">
            <Shield className="w-64 h-64 -translate-x-1/2 -translate-y-1/2 absolute" />
          </div>
          
          <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-md mb-6 border border-white/10">
            <Shield className="w-12 h-12 text-white" />
          </div>
          
          <h1 className="text-4xl font-black tracking-tighter mb-2">TRISHAK</h1>
          <p className="text-red-100 text-center font-medium">
            AI-Powered Crisis Orchestration System
          </p>
        </div>

        <div className="p-8 md:p-10">
          <AnimatePresence mode="wait">
            {step === 'login' && (
              <motion.div 
                key="login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-text-primary mb-2 transition-colors">Welcome Back</h2>
                  <p className="text-text-secondary transition-colors">Sign in to access your emergency dashboard</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-accent-emergency p-4 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-sm font-medium">{error}</div>
                    </div>
                    {error.includes('blocked') && (
                      <div className="pl-8 text-[10px] text-accent-emergency opacity-80 font-bold uppercase tracking-wider">
                        Check your browser's address bar for a blocked popup icon
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  <RoleButton 
                    icon={User} 
                    label="Guest / Visitor" 
                    description="Requires verification ID"
                    disabled={loading}
                    onClick={() => handleRoleSelect('guest')} 
                  />
                  <RoleButton 
                    icon={Building2} 
                    label="Receptionist" 
                    description="Manage guest access"
                    disabled={loading}
                    onClick={() => handleRoleSelect('receptionist')} 
                  />
                  <RoleButton 
                    icon={ShieldCheck} 
                    label="Security Team" 
                    description="Emergency responder"
                    disabled={loading}
                    onClick={() => handleRoleSelect('security')} 
                  />
                  <RoleButton 
                    icon={Users} 
                    label="Staff Member" 
                    description="Facility employee"
                    disabled={loading}
                    onClick={() => handleRoleSelect('staff')} 
                  />
                  <RoleButton 
                    icon={UserCheck} 
                    label="Administrator" 
                    description="System management"
                    disabled={loading}
                    onClick={() => handleRoleSelect('admin')} 
                  />
                </div>
              </motion.div>
            )}

            {step === 'staff-login' && (
              <motion.div 
                key="staff-login"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-text-primary mb-2 transition-colors">{selectedRole?.toUpperCase()} Login</h2>
                  <p className="text-text-secondary transition-colors">Sign in with Google and enter your credentials</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-accent-emergency p-4 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-sm font-medium">{error}</div>
                    </div>
                  </div>
                )}

                {!auth.currentUser ? (
                  <div className="space-y-4">
                    <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                      <p className="text-xs text-blue-500 font-medium leading-relaxed">
                        <strong>Step 1:</strong> Sign in with Google to secure your staff session.
                      </p>
                    </div>
                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full bg-bg-secondary border-2 border-card-border text-text-primary font-bold py-4 px-6 rounded-2xl hover:bg-bg-primary transition-all flex items-center justify-center gap-3 shadow-md group"
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" referrerPolicy="no-referrer" />
                      Continue with Google
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center border border-green-500/30 overflow-hidden">
                        {auth.currentUser.photoURL ? (
                          <img src={auth.currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Signed in as</p>
                        <p className="text-xs font-bold text-green-600 truncate">{auth.currentUser.displayName}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                        <input 
                          type="text"
                          value={staffData.orgId}
                          onChange={(e) => setStaffData({ ...staffData, orgId: e.target.value.toUpperCase() })}
                          placeholder="Organization ID"
                          className="w-full bg-bg-primary border-2 border-card-border rounded-2xl pl-12 pr-4 py-4 font-bold focus:border-accent-emergency focus:ring-0 transition-all text-text-primary"
                        />
                      </div>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                        <input 
                          type="text"
                          value={staffData.uniqueId}
                          onChange={(e) => setStaffData({ ...staffData, uniqueId: e.target.value.toUpperCase() })}
                          placeholder="Unique ID (e.g. RE123)"
                          className="w-full bg-bg-primary border-2 border-card-border rounded-2xl pl-12 pr-4 py-4 font-bold focus:border-accent-emergency focus:ring-0 transition-all text-text-primary"
                        />
                      </div>
                    </div>

                    <button
                      onClick={verifyStaffCredentials}
                      disabled={verifying || !staffData.orgId || !staffData.uniqueId}
                      className="w-full bg-accent-emergency text-white font-bold py-4 px-6 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                    >
                      {verifying ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        'Validate Identity'
                      )}
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleGoBack}
                  className="w-full text-text-secondary text-sm font-bold hover:text-text-primary transition-all"
                >
                  Go Back
                </button>
              </motion.div>
            )}

            {step === 'guest-id' && (
              <motion.div 
                key="guest-id"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-text-primary mb-2 transition-colors">Guest Verification</h2>
                  <p className="text-text-secondary transition-colors">Please sign in and enter your 6-digit ID</p>
                </div>

                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-accent-emergency p-4 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div className="text-sm font-medium">{error}</div>
                    </div>
                  </div>
                )}

                {!auth.currentUser ? (
                  <div className="space-y-4">
                    <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                      <p className="text-xs text-blue-500 font-medium leading-relaxed">
                        <strong>Step 1:</strong> Sign in with Google to secure your guest session.
                      </p>
                    </div>
                    <button
                      onClick={handleGoogleLogin}
                      disabled={loading}
                      className="w-full bg-bg-secondary border-2 border-card-border text-text-primary font-bold py-4 px-6 rounded-2xl hover:bg-bg-primary transition-all flex items-center justify-center gap-3 shadow-md group"
                    >
                      <img src="https://www.google.com/favicon.ico" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="Google" referrerPolicy="no-referrer" />
                      Continue with Google
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bg-secondary flex items-center justify-center border border-green-500/30 overflow-hidden">
                        {auth.currentUser.photoURL ? (
                          <img src={auth.currentUser.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Signed in as</p>
                        <p className="text-xs font-bold text-green-600 truncate">{auth.currentUser.displayName}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1 opacity-50">Step 2: Enter Guest ID</label>
                      <div className="relative">
                        <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary w-5 h-5" />
                        <input 
                          type="text"
                          maxLength={6}
                          value={guestCode}
                          onChange={(e) => setGuestCode(e.target.value.toUpperCase())}
                          placeholder="6-DIGIT CODE"
                          className="w-full bg-bg-primary border-2 border-card-border rounded-2xl pl-12 pr-4 py-4 font-black tracking-[0.5em] text-center text-xl focus:border-accent-emergency focus:ring-0 transition-all text-text-primary"
                        />
                      </div>
                    </div>

                    <button
                      onClick={verifyGuestCode}
                      disabled={verifying || guestCode.length !== 6}
                      className="w-full bg-accent-emergency text-white font-bold py-4 px-6 rounded-2xl hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
                    >
                      {verifying ? (
                        <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                      ) : (
                        'Verify & Access'
                      )}
                    </button>
                  </div>
                )}

                <button 
                  onClick={handleGoBack}
                  className="w-full text-text-secondary text-sm font-bold hover:text-text-primary transition-all"
                >
                  Go Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-bg-primary/50 p-6 border-t border-card-border flex items-center gap-3 transition-colors">
          <Info className="text-text-secondary w-5 h-5 shrink-0 opacity-50" />
          <p className="text-xs text-text-secondary leading-relaxed transition-colors">
            {step === 'guest-id' 
              ? "Your ID links you to the facility's security network for your safety."
              : "By signing in, you agree to the emergency protocols and data privacy guidelines."}
          </p>
        </div>
      </motion.div>
      
      <footer className="mt-12 py-8 border-t border-card-border text-center w-full max-w-md mx-auto transition-colors">
        <p className="text-sm font-black text-text-secondary uppercase tracking-widest opacity-50">
          Created by <span className="text-text-primary opacity-100">Holists</span>
        </p>
        <p className="text-xs text-text-secondary mt-1 font-medium opacity-40">
          TRISHAK Crisis Coordination System • v1.0.4
        </p>
      </footer>

      {/* Sign Out Confirmation Modal */}
      <Modal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Confirm Sign Out"
      >
        <div className="space-y-6">
          <p className="text-text-secondary font-medium transition-colors">
            Are you sure you want to sign out?
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowSignOutModal(false)}
              className="flex-1 px-6 py-4 rounded-2xl bg-bg-primary text-text-secondary font-bold hover:bg-card-border transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 px-6 py-4 rounded-2xl bg-accent-emergency text-white font-bold hover:opacity-90 transition-all shadow-lg shadow-red-500/20"
            >
              Sign Out
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function RoleButton({ icon: Icon, label, description, onClick, disabled }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-4 p-4 bg-bg-secondary border-2 border-card-border rounded-2xl hover:border-accent-emergency hover:bg-accent-emergency/5 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed w-full shadow-sm"
    >
      <div className="bg-bg-primary p-3 rounded-xl group-hover:bg-accent-emergency/10 group-hover:text-accent-emergency transition-all border border-card-border group-hover:border-accent-emergency/20">
        <Icon className="w-6 h-6 text-text-secondary group-hover:text-accent-emergency transition-colors" />
      </div>
      <div>
        <p className="font-bold text-text-primary transition-colors">{label}</p>
        <p className="text-xs text-text-secondary font-medium transition-colors">{description}</p>
      </div>
    </button>
  );
}
