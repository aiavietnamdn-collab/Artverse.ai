import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  AnonymousSession, 
  AnonymousPortfolioRecord, 
  generateUnguessableToken, 
  generateAnonymousCode 
} from '../types/anonymousPortfolio';

// ====================================================
// 1. TEACHER ANONYMOUS SESSION MANAGEMENT
// ====================================================

export async function createTeacherSession(
  lessonTitle: string,
  grade: string,
  topic: string,
  instructions: string,
  rubricTitle?: string
): Promise<AnonymousSession> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Vui lòng đăng nhập giáo viên để khởi tạo phiên nộp bài ẩn danh.');
  }

  const sessionId = `session-${Date.now()}-${generateUnguessableToken(8)}`;
  const sessionToken = generateUnguessableToken(32); // High entropy, unguessable, no class index or serial number

  const sessionData: AnonymousSession = {
    id: sessionId,
    teacherId: currentUser.uid,
    teacherName: currentUser.displayName || 'Giáo viên Mĩ thuật',
    lessonTitle: lessonTitle.trim(),
    grade: grade.trim(),
    topic: topic.trim(),
    sessionToken,
    rubricTitle: rubricTitle || 'Rubric đánh giá Mĩ thuật GDPT 2018',
    isRevoked: false,
    allowSubmissions: true,
    instructions: instructions.trim() || 'Học sinh tham gia ẩn danh, không ghi tên hoặc trường lớp.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const path = `anonymousSessions/${sessionId}`;
  try {
    await setDoc(doc(db, 'anonymousSessions', sessionId), sessionData);
    return sessionData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getTeacherSessions(): Promise<AnonymousSession[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = 'anonymousSessions';
  try {
    const q = query(collection(db, 'anonymousSessions'), where('teacherId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as AnonymousSession);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function revokeTeacherSession(sessionId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập giáo viên.');

  const path = `anonymousSessions/${sessionId}`;
  try {
    const sessionRef = doc(db, 'anonymousSessions', sessionId);
    await setDoc(sessionRef, { isRevoked: true, allowSubmissions: false, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTeacherSession(sessionId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập giáo viên.');

  const path = `anonymousSessions/${sessionId}`;
  try {
    await deleteDoc(doc(db, 'anonymousSessions', sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function findSessionByToken(token: string): Promise<AnonymousSession | null> {
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const path = 'anonymousSessions';
  try {
    const q = query(collection(db, 'anonymousSessions'), where('sessionToken', '==', cleanToken));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const session = snapshot.docs[0].data() as AnonymousSession;
    return session;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ====================================================
// 2. ANONYMOUS STUDENT PORTFOLIO SUBMISSION & CRUD
// ====================================================

export async function submitAnonymousPortfolio(
  session: AnonymousSession,
  sketch: { caption: string; notes: string; visualType: any; imageUrl?: string },
  finalWork: { caption: string; notes: string; visualType: any; imageUrl?: string },
  selfEvaluation: {
    idea: string;
    experiments: string;
    mostSatisfied: string;
    biggestChallenge: string;
    whatToChange: string;
    needSupport: string;
  }
): Promise<AnonymousPortfolioRecord> {
  if (session.isRevoked || !session.allowSubmissions) {
    throw new Error('Mã tham gia này đã bị giáo viên thu hồi hoặc phiên nộp bài đã đóng.');
  }

  const portfolioId = `anon-port-${Date.now()}-${generateUnguessableToken(6)}`;
  const anonymousCode = generateAnonymousCode(); // e.g. ART-K92X-M4P1
  const portfolioSecretKey = generateUnguessableToken(24); // Secret client access key for student

  const record: AnonymousPortfolioRecord = {
    id: portfolioId,
    sessionId: session.id,
    sessionToken: session.sessionToken,
    teacherId: session.teacherId,
    portfolioSecretKey,
    anonymousCode,
    lessonTitle: session.lessonTitle,
    topic: session.topic,
    grade: session.grade,
    sketchImage: {
      id: `img-sk-${Date.now()}`,
      type: 'sketch',
      caption: sketch.caption || 'Phác thảo cấu trúc ý tưởng ban đầu',
      notes: sketch.notes || '',
      visualType: sketch.visualType || 'pastel',
      imageUrl: sketch.imageUrl,
      uploadedAt: new Date().toISOString(),
    },
    finalImage: {
      id: `img-fn-${Date.now()}`,
      type: 'final',
      caption: finalWork.caption || 'Tác phẩm hoàn thiện',
      notes: finalWork.notes || '',
      visualType: finalWork.visualType || 'clay',
      imageUrl: finalWork.imageUrl,
      uploadedAt: new Date().toISOString(),
    },
    revisions: [],
    selfEvaluation: {
      idea: selfEvaluation.idea.trim(),
      experiments: selfEvaluation.experiments.trim(),
      mostSatisfied: selfEvaluation.mostSatisfied.trim(),
      biggestChallenge: selfEvaluation.biggestChallenge.trim(),
      whatToChange: selfEvaluation.whatToChange.trim(),
      needSupport: selfEvaluation.needSupport.trim(),
    },
    status: 'submitted',
    storageLocation: 'firestore_cloud',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const path = `anonymousPortfolios/${portfolioId}`;
  try {
    await setDoc(doc(db, 'anonymousPortfolios', portfolioId), record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAnonymousPortfolioByStudent(
  record: AnonymousPortfolioRecord,
  secretKey: string
): Promise<void> {
  if (record.portfolioSecretKey !== secretKey) {
    throw new Error('Mã bảo mật chỉnh sửa không hợp lệ.');
  }

  const updatedRecord = {
    ...record,
    updatedAt: new Date().toISOString(),
  };

  const path = `anonymousPortfolios/${record.id}`;
  try {
    await setDoc(doc(db, 'anonymousPortfolios', record.id), updatedRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAnonymousPortfolioByStudent(
  portfolioId: string,
  secretKey: string,
  actualSecretKey: string
): Promise<void> {
  if (secretKey !== actualSecretKey) {
    throw new Error('Mã bảo mật để xóa không trùng khớp.');
  }

  const path = `anonymousPortfolios/${portfolioId}`;
  try {
    await deleteDoc(doc(db, 'anonymousPortfolios', portfolioId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ====================================================
// 3. TEACHER REVIEW & EVALUATION OPERATIONS
// ====================================================

export async function getTeacherAnonymousPortfolios(): Promise<AnonymousPortfolioRecord[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = 'anonymousPortfolios';
  try {
    const q = query(collection(db, 'anonymousPortfolios'), where('teacherId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as AnonymousPortfolioRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function evaluateAnonymousPortfolioByTeacher(
  portfolioId: string,
  comment: string,
  guidance: string,
  rubricLevel?: 'needs_support' | 'partially_achieved' | 'achieved' | 'exceeded'
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập giáo viên.');

  const path = `anonymousPortfolios/${portfolioId}`;
  try {
    const evaluationPayload = {
      teacherEvaluation: {
        comment: comment.trim(),
        guidance: guidance.trim(),
        rubricLevel,
        evaluatedAt: new Date().toISOString(),
        teacherName: currentUser.displayName || 'Giáo viên Mĩ thuật',
      },
      status: 'evaluated',
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'anonymousPortfolios', portfolioId), evaluationPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAnonymousPortfolioByTeacher(portfolioId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập giáo viên.');

  const path = `anonymousPortfolios/${portfolioId}`;
  try {
    await deleteDoc(doc(db, 'anonymousPortfolios', portfolioId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
