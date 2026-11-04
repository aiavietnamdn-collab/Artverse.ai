import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  signInWithCustomToken,
  signInWithGoogle,
  logOut,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { getApiUrl } from '../lib/platform';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string; // Public-safe alias for students
  alias?: string;
  nickname?: string;
  needsAliasSetup?: boolean;
  photoURL?: string;
  role: 'admin' | 'teacher' | 'student' | 'viewer';
  classCode?: string;
  classGroupId?: string;
  className?: string;
  grade?: string;
  studentCode?: string;
  status?: 'active' | 'locked';
  schoolName?: string;
  gradeLevel?: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface StudentLoginResult {
  success: boolean;
  error?: string;
  code?: string;
  profile?: UserProfile;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthReady: boolean;
  isAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
  verifiedRole: 'admin' | 'teacher' | 'student' | 'viewer';
  isStudentLoginModalOpen: boolean;
  setIsStudentLoginModalOpen: (open: boolean) => void;
  isNicknameOnboardingModalOpen?: boolean;
  setIsNicknameOnboardingModalOpen: (open: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  loginStudentWithPin: (
    classCode: string,
    studentCode: string,
    pin: string
  ) => Promise<StudentLoginResult>;
  updateStudentAlias: (
    alias: string
  ) => Promise<{ success: boolean; error?: string; suggestions?: string[]; profile?: UserProfile }>;
  updateStudentNickname: (
    nickname: string
  ) => Promise<{ success: boolean; error?: string; suggestions?: string[]; profile?: UserProfile }>;
  logout: () => Promise<void>;
  getValidBearerToken: () => Promise<string | null>;
}

const STUDENT_SESSION_STORAGE_KEY = 'artverse_student_session_v1';

interface StoredStudentSession {
  token: string;
  profile: UserProfile;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  isAdmin: false,
  isTeacher: false,
  isStudent: false,
  verifiedRole: 'viewer',
  isStudentLoginModalOpen: false,
  setIsStudentLoginModalOpen: () => {},
  isNicknameOnboardingModalOpen: false,
  setIsNicknameOnboardingModalOpen: () => {},
  loginWithGoogle: async () => {},
  loginStudentWithPin: async () => ({ success: false }),
  updateStudentAlias: async () => ({ success: false }),
  updateStudentNickname: async () => ({ success: false }),
  logout: async () => {},
  getValidBearerToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [studentSessionToken, setStudentSessionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isStudentLoginModalOpen, setIsStudentLoginModalOpen] = useState<boolean>(false);
  const [isNicknameOnboardingModalOpen, setIsNicknameOnboardingModalOpen] = useState<boolean>(false);

  // Restore persisted student session on mount & verify with backend (/api/student-auth/me)
  const restoreStudentSession = useCallback(async (): Promise<UserProfile | null> => {
    try {
      const raw = localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredStudentSession;
      if (!parsed?.token || !parsed?.profile) return null;

      setStudentSessionToken(parsed.token);
      setProfile(parsed.profile);

      const res = await fetch(getApiUrl('/api/student-auth/me'), {
        headers: {
          Authorization: `Bearer ${parsed.token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.student) {
          const publicAlias = data.student.alias || data.student.displayName;
          const verifiedProfile: UserProfile = {
            uid: data.student.uid,
            email: '',
            displayName: publicAlias,
            alias: publicAlias,
            needsAliasSetup: Boolean(data.student.needsAliasSetup),
            role: 'student',
            classCode: data.student.classCode,
            classGroupId: data.student.classGroupId,
            className: data.student.className,
            grade: data.student.grade || data.student.className,
            studentCode: data.student.studentCode,
            status: data.student.status,
            createdAt: data.student.createdAt || parsed.profile.createdAt,
            lastLoginAt: data.student.lastLoginAt || parsed.profile.lastLoginAt,
          };
          localStorage.setItem(
            STUDENT_SESSION_STORAGE_KEY,
            JSON.stringify({ token: parsed.token, profile: verifiedProfile })
          );
          setProfile(verifiedProfile);
          return verifiedProfile;
        }
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
        setStudentSessionToken(null);
        setProfile(null);
        return null;
      }
      return parsed.profile;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const tokenResult = await currentUser.getIdTokenResult();
          if (tokenResult.claims?.role === 'student') {
            const restored = await restoreStudentSession();
            if (restored) {
              setLoading(false);
              setIsAuthReady(true);
              return;
            }
          }
        } catch {
          // continue
        }

        const isBootstrapAdmin =
          currentUser.email === 'aiavietnam.dn@gmail.com' && currentUser.emailVerified;

        const defaultRole: UserProfile['role'] = isBootstrapAdmin ? 'admin' : 'viewer';
        const fallbackProfile: UserProfile = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Người dùng Artverse',
          photoURL: currentUser.photoURL || '',
          role: defaultRole,
          createdAt: new Date().toISOString(),
        };

        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const existingProfile = userSnap.data() as UserProfile;
            if (isBootstrapAdmin && existingProfile.role !== 'admin') {
              const upgradedProfile: UserProfile = { ...existingProfile, role: 'admin' };
              await setDoc(userRef, { role: 'admin' }, { merge: true });
              setProfile(upgradedProfile);
            } else {
              let resolvedProfile = existingProfile;
              if (existingProfile.role === 'viewer' && currentUser.email) {
                try {
                  const idToken = await currentUser.getIdToken();
                  const roleRes = await fetch(getApiUrl('/api/auth/resolve-role'), {
                    headers: { Authorization: `Bearer ${idToken}` },
                  });
                  if (roleRes.ok) {
                    const roleData = await roleRes.json();
                    if (roleData.role === 'teacher' || roleData.role === 'admin') {
                      resolvedProfile = { ...existingProfile, role: roleData.role };
                    }
                  }
                } catch {
                  // ignore
                }
              }
              setProfile(resolvedProfile);
            }
          } else {
            let assignedRole: UserProfile['role'] = isBootstrapAdmin ? 'admin' : 'viewer';
            try {
              const idToken = await currentUser.getIdToken();
              const roleRes = await fetch(getApiUrl('/api/auth/resolve-role'), {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              if (roleRes.ok) {
                const roleData = await roleRes.json();
                if (roleData.role === 'teacher' || roleData.role === 'admin') {
                  assignedRole = roleData.role;
                }
              }
            } catch {
              // ignore
            }

            const newProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: currentUser.displayName || 'Người dùng Artverse',
              photoURL: currentUser.photoURL || '',
              role: assignedRole,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, {
              ...newProfile,
              role: assignedRole === 'admin' ? 'admin' : 'viewer',
            });
            setProfile(newProfile);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
          setProfile(fallbackProfile);
        }
      } else {
        const restoredStudent = await restoreStudentSession();
        if (!restoredStudent) {
          setProfile(null);
        }
      }
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, [restoreStudentSession]);

  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
      setStudentSessionToken(null);
      await signInWithGoogle();
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loginStudentWithPin = async (
    classCode: string,
    studentCode: string,
    pin: string
  ): Promise<StudentLoginResult> => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/student-auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classCode: classCode.trim().toUpperCase(),
          studentCode: studentCode.trim().toUpperCase(),
          pin: pin.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        return {
          success: false,
          error:
            data.error ||
            'Mã lớp, mã học sinh hoặc mã PIN chưa đúng. Em hãy kiểm tra lại thẻ đăng nhập nhé!',
          code: data.code,
        };
      }

      if (data.customToken) {
        try {
          await signInWithCustomToken(auth, data.customToken);
        } catch {
          // fallback to signed student session token
        }
      }

      const publicAlias = data.student.alias || data.student.displayName;
      const studentProfile: UserProfile = {
        uid: data.student.uid,
        email: '',
        displayName: publicAlias,
        alias: publicAlias,
        needsAliasSetup: Boolean(data.student.needsAliasSetup),
        role: 'student',
        classCode: data.student.classCode,
        classGroupId: data.student.classGroupId,
        className: data.student.className,
        grade: data.student.grade || data.student.className,
        studentCode: data.student.studentCode,
        status: data.student.status || 'active',
        createdAt: data.student.createdAt || new Date().toISOString(),
        lastLoginAt: data.student.lastLoginAt || new Date().toISOString(),
      };

      if (data.studentSessionToken) {
        setStudentSessionToken(data.studentSessionToken);
        localStorage.setItem(
          STUDENT_SESSION_STORAGE_KEY,
          JSON.stringify({
            token: data.studentSessionToken,
            profile: studentProfile,
          })
        );
      }

      setProfile(studentProfile);
      setIsStudentLoginModalOpen(false);
      return {
        success: true,
        profile: studentProfile,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || 'Không thể kết nối máy chủ đăng nhập. Em vui lòng thử lại nhé!',
      };
    } finally {
      setLoading(false);
    }
  };

  const getValidBearerToken = useCallback(async (): Promise<string | null> => {
    if (studentSessionToken && profile?.role === 'student') {
      return studentSessionToken;
    }
    try {
      const raw = localStorage.getItem(STUDENT_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredStudentSession;
        if (parsed?.token) {
          return parsed.token;
        }
      }
    } catch {
      // ignore
    }

    const activeUser = auth.currentUser || user;
    if (activeUser && typeof activeUser.getIdToken === 'function') {
      try {
        return await activeUser.getIdToken();
      } catch {
        return (
          (activeUser as any)?.stsTokenManager?.accessToken ||
          (activeUser as any)?.accessToken ||
          null
        );
      }
    }
    return null;
  }, [studentSessionToken, profile, user]);

  const updateStudentAlias = useCallback(
    async (alias: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const token = await getValidBearerToken();
        if (!token) {
          return { success: false, error: 'Phiên đăng nhập học sinh không hợp lệ.' };
        }
        const res = await fetch(getApiUrl('/api/student-auth/set-alias'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ alias: alias.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          return { success: false, error: data.error || 'Không thể lưu bí danh.' };
        }
        if (data.student && profile) {
          const nextProfile: UserProfile = {
            ...profile,
            displayName: data.student.alias || data.student.displayName,
            alias: data.student.alias || data.student.displayName,
            needsAliasSetup: false,
          };
          const nextToken = data.studentSessionToken || token;
          setStudentSessionToken(nextToken);
          setProfile(nextProfile);
          localStorage.setItem(
            STUDENT_SESSION_STORAGE_KEY,
            JSON.stringify({ token: nextToken, profile: nextProfile })
          );
          localStorage.setItem('artverse_anon_nickname', nextProfile.displayName);
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Lỗi kết nối khi lưu bí danh.' };
      }
    },
    [getValidBearerToken, profile]
  );

  const logout = async () => {
    try {
      setLoading(true);
      localStorage.removeItem(STUDENT_SESSION_STORAGE_KEY);
      setStudentSessionToken(null);
      if (auth.currentUser) {
        await logOut();
      }
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin =
    profile?.role === 'admin' ||
    (user?.email === 'aiavietnam.dn@gmail.com' && Boolean(user?.emailVerified));
  const isTeacher = isAdmin || profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';
  const verifiedRole: 'admin' | 'teacher' | 'student' | 'viewer' = isAdmin
    ? 'admin'
    : isTeacher
      ? 'teacher'
      : isStudent
        ? 'student'
        : 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: profile
          ? { ...profile, nickname: profile.nickname || profile.alias || profile.displayName }
          : null,
        loading,
        isAuthReady,
        isAdmin,
        isTeacher,
        isStudent,
        verifiedRole,
        isStudentLoginModalOpen,
        setIsStudentLoginModalOpen,
        isNicknameOnboardingModalOpen,
        setIsNicknameOnboardingModalOpen,
        loginWithGoogle,
        loginStudentWithPin,
        updateStudentAlias,
        updateStudentNickname: updateStudentAlias,
        logout,
        getValidBearerToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
