import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, isOfflineOrTokenServiceError, OperationType, testConnection } from '../lib/firebase';
import { isCapacitorNative, isStandalonePWA } from '../lib/platform';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'viewer' | 'teacher' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isFirebaseConnected: boolean;
  isTeacher: boolean;
  isAdmin: boolean;
  verifiedRole: 'viewer' | 'teacher' | 'admin';
  promoteUserToTeacher: (targetUid: string) => Promise<void>;
  demoteUserToViewer: (targetUid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null,
  loginWithGoogle: async () => {},
  logout: async () => {},
  isFirebaseConnected: true,
  isTeacher: false,
  isAdmin: false,
  verifiedRole: 'viewer',
  promoteUserToTeacher: async () => {},
  demoteUserToViewer: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(true);

  // Validate server connection on boot & complete any pending OAuth redirect on iOS PWA/Capacitor
  useEffect(() => {
    testConnection().then((connected) => {
      setIsFirebaseConnected(connected);
    });
    getRedirectResult(auth).catch((err) => {
      console.warn('Redirect auth check:', err?.message || err);
    });
  }, []);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const isBootstrapAdmin = currentUser.email === 'aiavietnam.dn@gmail.com';
        const assignedRole: 'teacher' | 'admin' = isBootstrapAdmin ? 'admin' : 'teacher';
        const fallbackProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || 'giaovien@artverse.edu.vn',
          displayName: currentUser.displayName || (assignedRole === 'admin' ? 'Quản trị viên Hệ thống' : 'Giáo viên Mĩ thuật'),
          photoURL: currentUser.photoURL || undefined,
          role: assignedRole,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Immediately set fallback profile so UI has instant access
        setProfile(fallbackProfile);

        try {
          // Verify token can be refreshed before calling Firestore
          await currentUser.getIdToken();

          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfile;
            if (isBootstrapAdmin && data.role !== 'admin') {
              data.role = 'admin';
              await updateDoc(userDocRef, { role: 'admin', updatedAt: new Date().toISOString() });
            }
            setProfile(data);
          } else {
            await setDoc(userDocRef, fallbackProfile);
            setProfile(fallbackProfile);
          }
        } catch (err: any) {
          if (isOfflineOrTokenServiceError(err)) {
            console.warn('Sử dụng hồ sơ người dùng cục bộ khi ngoại tuyến hoặc dịch vụ Token tạm ngưng.');
            setIsFirebaseConnected(false);
            // If securetoken API is disabled in GCP project, sign out the broken Firebase Auth token
            // so Firestore public queries are not blocked by failed token refresh, while keeping profile active in UI
            const errMsg = err instanceof Error ? err.message : String(err);
            if (errMsg.includes('token-service-api') || errMsg.includes('securetoken.googleapis.com')) {
              try {
                await firebaseSignOut(auth);
                setUser(currentUser);
                setProfile(fallbackProfile);
              } catch {
                // ignore signout error
              }
            }
          } else {
            try {
              handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
            } catch (handledErr: any) {
              console.warn('Không thể đồng bộ hồ sơ người dùng từ Firestore:', handledErr?.message);
            }
          }
        }
      } else {
        setUser((prevUser) => prevUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      setError(null);
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Login error:', err);
      const isPopupUnsupported =
        err?.code === 'auth/operation-not-supported-in-this-environment' ||
        (err?.code === 'auth/popup-blocked' && (isStandalonePWA() || isCapacitorNative()));

      if (isPopupUnsupported) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr: any) {
          setError(redirectErr?.message || 'Lỗi chuyển hướng đăng nhập trên iOS.');
        }
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Hộp thoại đăng nhập đã được đóng lại.');
      } else {
        setError(err.message || 'Lỗi khi đăng nhập bằng Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setError(null);
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Lỗi khi đăng xuất.');
    }
  };

  // Admin User Promotion function
  const promoteUserToTeacher = async (targetUid: string) => {
    if (!isAdmin) {
      throw new Error('Chỉ Quản trị viên mới có quyền bổ nhiệm Giáo viên.');
    }
    const targetRef = doc(db, 'users', targetUid);
    await updateDoc(targetRef, {
      role: 'teacher',
      updatedAt: new Date().toISOString()
    });
  };

  const demoteUserToViewer = async (targetUid: string) => {
    if (!isAdmin) {
      throw new Error('Chỉ Quản trị viên mới có quyền thu hồi vai trò Giáo viên.');
    }
    const targetRef = doc(db, 'users', targetUid);
    await updateDoc(targetRef, {
      role: 'viewer',
      updatedAt: new Date().toISOString()
    });
  };

  const isAdmin = !!user && (profile?.role === 'admin' || user?.email === 'aiavietnam.dn@gmail.com');
  const isTeacher = !!user && (profile?.role === 'teacher' || isAdmin);
  const verifiedRole: 'viewer' | 'teacher' | 'admin' = isAdmin ? 'admin' : isTeacher ? 'teacher' : 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        loginWithGoogle,
        logout,
        isFirebaseConnected,
        isTeacher,
        isAdmin,
        verifiedRole,
        promoteUserToTeacher,
        demoteUserToViewer
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
