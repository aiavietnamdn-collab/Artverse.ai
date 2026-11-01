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
  ArtPlanGenerated, 
  ArtRubricTemplate, 
  ArtPortfolioRecord 
} from '../types/artverse';

export interface PersistedLessonPlanDoc {
  id: string;
  ownerId: string;
  title: string;
  grade: string;
  level: 'primary' | 'secondary';
  textbook: string;
  topic: string;
  durationPeriods: number;
  learningObjectives: string;
  materialsAndEquipment: string;
  studentAudienceAndNotes: string;
  status: 'draft' | 'approved';
  rawPlanData: ArtPlanGenerated;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedRubricDoc {
  id: string;
  ownerId: string;
  title: string;
  grade: string;
  topic: string;
  productType: string;
  evaluationMode: 'weighted' | 'qualitative';
  rawRubricData: ArtRubricTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface PersistedPortfolioDoc {
  id: string;
  ownerId: string;
  studentCode: string;
  studentPseudonym: string;
  classGroup: string;
  topic: string;
  title: string;
  executionDate: string;
  timePeriod: string;
  studentWrittenIdea: string;
  status: 'draft' | 'verified';
  rawPortfolioData: ArtPortfolioRecord;
  createdAt: string;
  updatedAt: string;
}

// ====================================================
// 1. LESSON PLAN FIRESTORE OPERATIONS
// ====================================================

export async function saveLessonPlanToFirestore(plan: ArtPlanGenerated): Promise<PersistedLessonPlanDoc> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Vui lòng đăng nhập để lưu kế hoạch bài dạy vào cơ sở dữ liệu đám mây.');
  }

  const planId = plan.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `lessonPlans/${planId}`;

  const docPayload: PersistedLessonPlanDoc = {
    id: planId,
    ownerId: currentUser.uid,
    title: (plan.input.topicTitle || 'Kế hoạch bài dạy Mĩ thuật').slice(0, 256),
    grade: plan.input.grade.slice(0, 32),
    level: plan.input.schoolLevel,
    textbook: plan.input.textbook.slice(0, 128),
    topic: plan.input.topicTitle.slice(0, 256),
    durationPeriods: plan.input.durationPeriods || 2,
    learningObjectives: plan.input.learningObjectives.slice(0, 2048),
    materialsAndEquipment: plan.input.materialsAndEquipment.slice(0, 2048),
    studentAudienceAndNotes: plan.input.studentAudienceAndNotes.slice(0, 2048),
    status: plan.approvalStatus === 'approved' ? 'approved' : 'draft',
    rawPlanData: plan,
    createdAt: plan.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'lessonPlans', planId), docPayload);
    return docPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getTeacherLessonPlans(): Promise<PersistedLessonPlanDoc[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = 'lessonPlans';
  try {
    const q = query(collection(db, 'lessonPlans'), where('ownerId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as PersistedLessonPlanDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteLessonPlanFromFirestore(planId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập.');

  const path = `lessonPlans/${planId}`;
  try {
    await deleteDoc(doc(db, 'lessonPlans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ====================================================
// 2. RUBRIC FIRESTORE OPERATIONS
// ====================================================

export async function saveRubricToFirestore(rubric: ArtRubricTemplate): Promise<PersistedRubricDoc> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Vui lòng đăng nhập để lưu Rubric vào cơ sở dữ liệu đám mây.');
  }

  const rubricId = rubric.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `rubrics/${rubricId}`;

  const docPayload: PersistedRubricDoc = {
    id: rubricId,
    ownerId: currentUser.uid,
    title: rubric.title.slice(0, 256),
    grade: rubric.grade.slice(0, 32),
    topic: rubric.topic.slice(0, 256),
    productType: rubric.productType.slice(0, 128),
    evaluationMode: rubric.evaluationMode,
    rawRubricData: rubric,
    createdAt: rubric.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'rubrics', rubricId), docPayload);
    return docPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getTeacherRubrics(): Promise<PersistedRubricDoc[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = 'rubrics';
  try {
    const q = query(collection(db, 'rubrics'), where('ownerId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as PersistedRubricDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deleteRubricFromFirestore(rubricId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập.');

  const path = `rubrics/${rubricId}`;
  try {
    await deleteDoc(doc(db, 'rubrics', rubricId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ====================================================
// 3. PORTFOLIO FIRESTORE OPERATIONS (Non-identifying)
// ====================================================

export async function savePortfolioToFirestore(portfolio: ArtPortfolioRecord): Promise<PersistedPortfolioDoc> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Vui lòng đăng nhập để lưu hồ sơ học sinh vào cơ sở dữ liệu đám mây.');
  }

  // Enforce privacy: studentCode must be non-identifying code formatted HS-...
  let studentCode = portfolio.studentCode.trim();
  if (!/^HS-[a-zA-Z0-9_-]+$/.test(studentCode)) {
    studentCode = `HS-${studentCode.replace(/[^a-zA-Z0-9_-]/g, '') || 'ANON-01'}`;
  }

  const portfolioId = portfolio.id.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `portfolios/${portfolioId}`;

  const docPayload: PersistedPortfolioDoc = {
    id: portfolioId,
    ownerId: currentUser.uid,
    studentCode: studentCode.slice(0, 64),
    studentPseudonym: portfolio.studentPseudonym.slice(0, 64),
    classGroup: portfolio.classGroup.slice(0, 32),
    topic: portfolio.topic.slice(0, 256),
    title: portfolio.title.slice(0, 256),
    executionDate: portfolio.executionDate.slice(0, 64),
    timePeriod: portfolio.timePeriod.slice(0, 64),
    studentWrittenIdea: portfolio.studentWrittenIdea.slice(0, 2048),
    status: portfolio.rubricResult.isTeacherVerified ? 'verified' : 'draft',
    rawPortfolioData: {
      ...portfolio,
      studentCode,
      storageType: 'persistent_mock', // mark as saved
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'portfolios', portfolioId), docPayload);
    return docPayload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getTeacherPortfolios(): Promise<PersistedPortfolioDoc[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) return [];

  const path = 'portfolios';
  try {
    const q = query(collection(db, 'portfolios'), where('ownerId', '==', currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as PersistedPortfolioDoc);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function deletePortfolioFromFirestore(portfolioId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Vui lòng đăng nhập.');

  const path = `portfolios/${portfolioId}`;
  try {
    await deleteDoc(doc(db, 'portfolios', portfolioId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
