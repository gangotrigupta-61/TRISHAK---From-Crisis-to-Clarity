import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { safeStringify, safeParse } from '../lib/utils';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  isGuestVerified: boolean;
  guestData: { guestId: string; name: string; phone: string } | null;
  setGuestVerified: (verified: boolean, data?: { guestId: string; name: string; phone: string } | null) => void;
  loginWithId: (orgId: string, uniqueId: string) => Promise<any>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  isGuestVerified: false,
  guestData: null,
  setGuestVerified: () => {},
  loginWithId: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isGuestVerified, setIsGuestVerified] = useState(false);
  const [guestData, setGuestData] = useState<{ guestId: string; name: string; phone: string } | null>(null);

  const setGuestVerified = (verified: boolean, data: { guestId: string; name: string; phone: string } | null = null) => {
    setIsGuestVerified(verified);
    setGuestData(data);
    if (verified && data) {
      sessionStorage.setItem('guest_verified', 'true');
      sessionStorage.setItem('guest_data', safeStringify(data));
    } else {
      sessionStorage.removeItem('guest_verified');
      sessionStorage.removeItem('guest_data');
    }
  };

  const loginWithId = async (orgId: string, uniqueId: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'roleCodes'),
        where('organizationId', '==', orgId),
        where('code', '==', uniqueId)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        throw new Error('Invalid Organization ID or Unique ID');
      }
      
      const roleDoc = snapshot.docs[0];
      const roleData = roleDoc.data();

      // Ensure user is authenticated with Google
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in with Google first to secure your session.');
      }

      // Link this Google UID to the roleCode for security rules
      try {
        await updateDoc(doc(db, 'roleCodes', roleDoc.id), {
          assignedTo: currentUser.uid,
          status: 'active',
          lastLogin: serverTimestamp()
        });
      } catch (e: any) {
        if (e.code === 'permission-denied') {
          handleFirestoreError(e, OperationType.WRITE, `roleCodes/${roleDoc.id}`);
        }
        throw e;
      }

      // Also create/update a user profile for security rules to work
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        uid: currentUser.uid,
        displayName: roleData.name || currentUser.displayName || 'Staff Member',
        email: currentUser.email || '',
        role: roleData.role,
        securityType: roleData.securityType || null,
        organizationId: roleData.organizationId,
        uniqueId: roleData.code,
        status: roleData.status || 'inactive',
        updatedAt: serverTimestamp()
      }, { merge: true });

      localStorage.setItem('staff_session', safeStringify({ orgId, uniqueId }));
      
      setLoading(false);
      return roleData;
    } catch (err: any) {
      setLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      localStorage.removeItem('staff_session');
      setProfile(null);
      setUser(null);
      setLoading(false);
    } catch (err) {
      console.error('Logout error:', err);
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check session storage for guest verification
    const verified = sessionStorage.getItem('guest_verified') === 'true';
    const data = sessionStorage.getItem('guest_data');
    if (verified && data) {
      setIsGuestVerified(true);
      setGuestData(safeParse(data, null));
    }

    let unsubscribeProfile: (() => void) | null = null;
    let unsubscribeStaff: (() => void) | null = null;

    const setupStaffListener = (orgId: string, uniqueId: string) => {
      if (unsubscribeStaff) unsubscribeStaff();
      
      if (!orgId || !uniqueId) {
        setLoading(false);
        setIsAuthReady(true);
        return;
      }

      const q = query(
        collection(db, 'roleCodes'),
        where('organizationId', '==', orgId),
        where('code', '==', uniqueId),
        limit(1)
      );

      unsubscribeStaff = onSnapshot(q, async (snapshot) => {
        if (!snapshot.empty) {
          const roleDoc = snapshot.docs[0];
          const roleData = roleDoc.data();
          const currentUser = auth.currentUser;
          const staffProfile = {
            uid: currentUser?.uid || roleDoc.id,
            email: currentUser?.email || '',
            displayName: roleData.name || 'Staff Member',
            photoURL: currentUser?.photoURL || '',
            phone: roleData.phone,
            role: roleData.role,
            securityType: roleData.securityType,
            status: roleData.status || 'inactive',
            organizationId: roleData.organizationId,
            uniqueId: roleData.code
          } as UserProfile;
          
          // Sync with users collection for security rules only if needed
          if (currentUser) {
            const userRef = doc(db, 'users', currentUser.uid);
            try {
              // Deep comparison check would be expensive, so we'll just check if basic fields are set
              // and skip if we just did it. But since this is small, we'll just ensure we don't
              // trigger another check immediately by comparing with current profile if it exists.
              const shouldSync = !profile || 
                               profile.role !== staffProfile.role || 
                               profile.organizationId !== staffProfile.organizationId ||
                               profile.uniqueId !== staffProfile.uniqueId;

              if (shouldSync) {
                await setDoc(userRef, {
                  uid: currentUser.uid,
                  email: currentUser.email || '',
                  displayName: staffProfile.displayName,
                  photoURL: currentUser.photoURL || '',
                  role: staffProfile.role,
                  securityType: staffProfile.securityType || null,
                  organizationId: staffProfile.organizationId,
                  uniqueId: staffProfile.uniqueId,
                  status: staffProfile.status,
                  updatedAt: serverTimestamp()
                }, { merge: true });
              }
            } catch (e) {
              console.error("Failed to sync staff profile to users collection:", e);
              // Only call handleFirestoreError for specific permission issues during WRITE
              if (e instanceof Error && e.message.includes('permission')) {
                try {
                  handleFirestoreError(e, OperationType.WRITE, `users/${currentUser.uid}`);
                } catch {}
              }
            }
          }
          
          setProfile(staffProfile);
        } else {
          setProfile(null);
          localStorage.removeItem('staff_session');
        }
        setLoading(false);
        setIsAuthReady(true);
      }, (err) => {
        // Only log and report if authenticated, otherwise it's just a timing issue
        if (auth.currentUser) {
          console.error("Staff listener error:", err);
          try {
            handleFirestoreError(err, OperationType.LIST, 'roleCodes');
          } catch {}
        }
        setLoading(false);
        setIsAuthReady(true);
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const staffSession = localStorage.getItem('staff_session');
      
      try {
        if (staffSession) {
          const session = safeParse(staffSession, null);
          if (session) {
            const { orgId, uniqueId } = session;
            
            if (firebaseUser) {
              setUser(firebaseUser);
              setupStaffListener(orgId, uniqueId);
              return;
            } else {
              // No firebase user but staff session exists - wait for auth
              setUser(null);
              setLoading(false);
              setIsAuthReady(true);
              return;
            }
          }
        }

        setUser(firebaseUser);
        
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }

        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              setProfile(docSnap.data() as UserProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
            setIsAuthReady(true);
          }, (error) => {
            console.error("Profile listener error:", error);
            // Report more details if possible
            if (error.code === 'permission-denied') {
              try {
                handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
              } catch {}
            }
            // Don't set profile to null immediately on error (could be transient network issue)
            setLoading(false);
            setIsAuthReady(true);
          });
        } else {
          setProfile(null);
          setLoading(false);
          setIsAuthReady(true);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
        setLoading(false);
        setIsAuthReady(true);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
      if (unsubscribeStaff) unsubscribeStaff();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, isGuestVerified, guestData, setGuestVerified, loginWithId, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
