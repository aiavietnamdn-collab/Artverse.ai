/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Firestore Community Data Service
 * Cung cấp toàn bộ các thao tác dữ liệu Firestore thời gian thực cho Thư viện Mĩ thuật & Instant Gallery 2.0
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  increment,
  Unsubscribe
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CommunityArtwork,
  ClassGroup,
  ArtLesson,
  AuditLogEntry,
  ContentReport,
  PositiveReactionKey
} from '../types/communityArt';

// Collection constants
export const ARTWORKS_COLLECTION = 'communityArtworks';
export const CLASSES_COLLECTION = 'communityClasses';
export const LESSONS_COLLECTION = 'communityLessons';
export const AUDIT_LOGS_COLLECTION = 'communityAuditLogs';
export const REPORTS_COLLECTION = 'contentReports';

// ====================================================
// 1. COMMUNITY ARTWORKS OPERATIONS
// ====================================================

/**
 * Subscribes to real-time approved & shared artworks for public gallery exhibition
 */
export function subscribePublicArtworks(
  onUpdate: (artworks: CommunityArtwork[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = ARTWORKS_COLLECTION;
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const list: CommunityArtwork[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as CommunityArtwork), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Tạm chuyển sang dữ liệu cục bộ cho artworks:', error.message);
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Subscribes to artworks accessible by a signed-in teacher or admin.
 * Admin can view all artworks.
 * Regular teacher queries their own managed artworks merged with public approved artworks.
 */
export function subscribeTeacherArtworks(
  teacherId: string,
  isAdmin: boolean,
  onUpdate: (artworks: CommunityArtwork[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = ARTWORKS_COLLECTION;
  try {
    if (isAdmin) {
      const q = query(collection(db, path));
      return onSnapshot(
        q,
        (snapshot) => {
          const list: CommunityArtwork[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ ...(docSnap.data() as CommunityArtwork), id: docSnap.id });
          });
          onUpdate(list);
        },
        (error) => {
          console.warn('Tạm chuyển sang dữ liệu cục bộ cho admin artworks:', error.message);
          onError(error);
        }
      );
    }

    // Regular teacher: Query their own artworks and public approved artworks
    const qTeacher = query(
      collection(db, path),
      where('publishedByTeacherId', '==', teacherId)
    );
    const qPublic = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );

    let teacherArtworks: CommunityArtwork[] = [];
    let publicArtworks: CommunityArtwork[] = [];

    const mergeAndNotify = () => {
      const map = new Map<string, CommunityArtwork>();
      for (const a of publicArtworks) map.set(a.id, a);
      for (const a of teacherArtworks) map.set(a.id, a);
      onUpdate(Array.from(map.values()));
    };

    const unsubTeacher = onSnapshot(
      qTeacher,
      (snap) => {
        teacherArtworks = snap.docs.map(d => ({ ...(d.data() as CommunityArtwork), id: d.id }));
        mergeAndNotify();
      },
      (err) => console.warn('Lỗi lắng nghe tác phẩm giáo viên:', err)
    );

    const unsubPublic = onSnapshot(
      qPublic,
      (snap) => {
        publicArtworks = snap.docs.map(d => ({ ...(d.data() as CommunityArtwork), id: d.id }));
        mergeAndNotify();
      },
      (err) => console.warn('Lỗi lắng nghe tác phẩm công khai:', err)
    );

    return () => {
      unsubTeacher();
      unsubPublic();
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * One-time fetch of public approved artworks
 */
export async function getPublicArtworksFromFirestore(): Promise<CommunityArtwork[]> {
  const path = ARTWORKS_COLLECTION;
  try {
    const q = query(
      collection(db, path),
      where('status', '==', 'approved'),
      where('shareStatus', '==', 'shared')
    );
    const snap = await getDocs(q);
    const list: CommunityArtwork[] = [];
    snap.forEach((d) => list.push({ ...(d.data() as CommunityArtwork), id: d.id }));
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

function stripUndefinedDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => stripUndefinedDeep(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = stripUndefinedDeep(value);
    }
  }
  return cleaned as T;
}

/**
 * Creates an artwork document in Firestore
 */
export async function createCommunityArtworkInFirestore(
  artwork: CommunityArtwork,
  teacherUid?: string
): Promise<void> {
  const safeId = artwork.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;

  const rawPayload: CommunityArtwork = {
    ...artwork,
    id: safeId,
    publishedByTeacherId: teacherUid || auth.currentUser?.uid || 'anonymous_contributor',
    storageLocation: 'firestore_cloud',
    createdAt: artwork.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const payload = stripUndefinedDeep(rawPayload);

  try {
    await setDoc(doc(db, ARTWORKS_COLLECTION, safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates an existing artwork in Firestore (title, description, materials, lesson, etc.)
 */
export async function updateCommunityArtworkInFirestore(
  artworkId: string,
  updates: Partial<CommunityArtwork>
): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;

  try {
    await updateDoc(doc(db, ARTWORKS_COLLECTION, safeId), {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Toggles an artwork to 'hidden' status
 */
export async function hideCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  await updateCommunityArtworkInFirestore(artworkId, { status: 'hidden' });
}

/**
 * Restores an artwork back to 'approved' status
 */
export async function unhideCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  await updateCommunityArtworkInFirestore(artworkId, { status: 'approved' });
}

/**
 * Deletes an artwork permanently from Firestore
 */
export async function deleteCommunityArtworkInFirestore(artworkId: string): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, ARTWORKS_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Adds a positive reaction atomically using Firestore increment(1)
 */
export async function addReactionToArtworkInFirestore(
  artworkId: string,
  reactionKey: PositiveReactionKey
): Promise<void> {
  const safeId = artworkId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${ARTWORKS_COLLECTION}/${safeId}`;
  try {
    await updateDoc(doc(db, ARTWORKS_COLLECTION, safeId), {
      [`reactions.${reactionKey}`]: increment(1),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ====================================================
// 2. CLASS & LESSON MANAGEMENT OPERATIONS
// ====================================================

/**
 * Subscribes to real-time class groups
 */
export function subscribeCommunityClasses(
  onUpdate: (classes: ClassGroup[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = CLASSES_COLLECTION;
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ClassGroup[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ClassGroup), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Tạm chuyển sang dữ liệu cục bộ cho classes:', error.message);
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Subscribes to real-time art lessons
 */
export function subscribeCommunityLessons(
  onUpdate: (lessons: ArtLesson[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = LESSONS_COLLECTION;
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ArtLesson[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ArtLesson), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Tạm chuyển sang dữ liệu cục bộ cho lessons:', error.message);
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Saves (creates or updates) a ClassGroup in Firestore
 */
export async function saveCommunityClassInFirestore(classGroup: ClassGroup): Promise<void> {
  const safeId = classGroup.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    await setDoc(doc(db, CLASSES_COLLECTION, safeId), stripUndefinedDeep({
      ...classGroup,
      id: safeId
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes a class from Firestore
 */
export async function deleteCommunityClassInFirestore(classId: string): Promise<void> {
  const safeId = classId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${CLASSES_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, CLASSES_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Saves (creates or updates) an ArtLesson in Firestore
 */
export async function saveCommunityLessonInFirestore(lesson: ArtLesson): Promise<void> {
  const safeId = lesson.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${LESSONS_COLLECTION}/${safeId}`;
  try {
    await setDoc(doc(db, LESSONS_COLLECTION, safeId), stripUndefinedDeep({
      ...lesson,
      id: safeId
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Deletes an ArtLesson from Firestore
 */
export async function deleteCommunityLessonInFirestore(lessonId: string): Promise<void> {
  const safeId = lessonId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${LESSONS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, LESSONS_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ====================================================
// 3. AUDIT LOGS OPERATIONS
// ====================================================

/**
 * Subscribes to real-time safety audit logs (teachers & admins)
 */
export function subscribeCommunityAuditLogs(
  onUpdate: (logs: AuditLogEntry[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = AUDIT_LOGS_COLLECTION;
  try {
    const q = query(collection(db, path), limit(100));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: AuditLogEntry[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as AuditLogEntry), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Tạm chuyển sang dữ liệu cục bộ cho audit logs:', error.message);
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Creates an audit log record in Firestore
 */
export async function logCommunityAuditInFirestore(entry: AuditLogEntry): Promise<void> {
  const safeId = entry.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${AUDIT_LOGS_COLLECTION}/${safeId}`;
  try {
    await setDoc(doc(db, AUDIT_LOGS_COLLECTION, safeId), {
      ...entry,
      id: safeId,
      createdAtServer: new Date().toISOString()
    });
  } catch (error) {
    // Audit log write failure should be caught without crashing UX
    console.warn('Không thể ghi audit log lên Firestore:', error);
  }
}

// ====================================================
// 4. CONTENT REPORTS OPERATIONS
// ====================================================

/**
 * Subscribes to content reports for moderation
 */
export function subscribeContentReports(
  onUpdate: (reports: ContentReport[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const path = REPORTS_COLLECTION;
  try {
    return onSnapshot(
      collection(db, path),
      (snapshot) => {
        const list: ContentReport[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ContentReport), id: docSnap.id });
        });
        onUpdate(list);
      },
      (error) => {
        console.warn('Tạm chuyển sang dữ liệu cục bộ cho content reports:', error.message);
        onError(error);
      }
    );
  } catch (error: any) {
    onError(error instanceof Error ? error : new Error(String(error)));
    return () => {};
  }
}

/**
 * Creates a content violation report in Firestore
 */
export async function createContentReportInFirestore(report: ContentReport): Promise<void> {
  const safeId = report.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${REPORTS_COLLECTION}/${safeId}`;
  try {
    await setDoc(doc(db, REPORTS_COLLECTION, safeId), {
      ...report,
      id: safeId
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Updates a content report in Firestore
 */
export async function updateContentReportInFirestore(
  reportId: string,
  updates: Partial<ContentReport>
): Promise<void> {
  const safeId = reportId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `${REPORTS_COLLECTION}/${safeId}`;
  try {
    await updateDoc(doc(db, REPORTS_COLLECTION, safeId), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ====================================================
// 5. SEED INITIAL COMMUNITY DATA (Only on explicit confirmation)
// ====================================================

/**
 * Seeds initial classes and lessons if the Firestore collections are currently empty.
 * Returns true if seeded, false if already populated.
 */
export async function seedInitialCommunityDataIfEmpty(
  classes: ClassGroup[],
  lessons: ArtLesson[]
): Promise<boolean> {
  try {
    const classSnap = await getDocs(collection(db, CLASSES_COLLECTION));
    if (classSnap.empty) {
      console.log('Seeding initial community classes...');
      for (const cls of classes) {
        await setDoc(doc(db, CLASSES_COLLECTION, cls.id), cls);
      }
    }

    const lessonSnap = await getDocs(collection(db, LESSONS_COLLECTION));
    if (lessonSnap.empty) {
      console.log('Seeding initial community lessons...');
      for (const les of lessons) {
        await setDoc(doc(db, LESSONS_COLLECTION, les.id), les);
      }
    }

    return classSnap.empty || lessonSnap.empty;
  } catch (error) {
    console.error('Lỗi khởi tạo dữ liệu mẫu lên Firestore:', error);
    return false;
  }
}
