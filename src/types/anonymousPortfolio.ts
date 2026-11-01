export interface AnonymousArtworkImage {
  id: string;
  type: 'sketch' | 'final' | 'revision';
  revisionIndex?: number;
  imageUrl?: string;
  visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  caption: string;
  notes: string;
  uploadedAt: string;
}

/**
 * 6 Mandatory Questions for Student Self-Assessment
 */
export interface StudentSelfEvaluation6Q {
  idea: string; // 1. Ý tưởng của em là gì?
  experiments: string; // 2. Em đã thử nghiệm những cách nào?
  mostSatisfied: string; // 3. Điều em hài lòng nhất?
  biggestChallenge: string; // 4. Khó khăn lớn nhất?
  whatToChange: string; // 5. Nếu làm lại em thay đổi gì?
  needSupport: string; // 6. Em cần giáo viên hỗ trợ điều gì?
}

export interface AnonymousSession {
  id: string;
  teacherId: string;
  teacherName: string;
  lessonTitle: string;
  grade: string;
  topic: string;
  sessionToken: string; // Unguessable high-entropy token (32 chars)
  rubricId?: string;
  rubricTitle?: string;
  isRevoked: boolean; // Teacher can revoke access instantly
  allowSubmissions: boolean;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnonymousPortfolioRecord {
  id: string;
  sessionId: string;
  sessionToken: string;
  teacherId: string;
  portfolioSecretKey: string; // Private student token to view, edit, or delete
  anonymousCode: string; // Purely random, e.g. ART-K92X-M4P1, zero PII, zero mapping table
  lessonTitle: string;
  topic: string;
  grade: string;
  sketchImage: AnonymousArtworkImage;
  finalImage: AnonymousArtworkImage;
  revisions: AnonymousArtworkImage[]; // Multiple revision versions
  selfEvaluation: StudentSelfEvaluation6Q;
  teacherEvaluation?: {
    comment: string;
    guidance: string;
    rubricLevel?: 'needs_support' | 'partially_achieved' | 'achieved' | 'exceeded';
    evaluatedAt?: string;
    teacherName?: string;
  };
  status: 'draft' | 'submitted' | 'evaluated';
  storageLocation: 'demo_sample' | 'local_device' | 'firestore_cloud';
  createdAt: string;
  updatedAt: string;
}

/**
 * Cryptographically random token generators
 */
export function generateUnguessableToken(length: number = 32): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

export function generateAnonymousCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randBlock = (len: number) => {
    const array = new Uint8Array(len);
    window.crypto.getRandomValues(array);
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars[array[i] % chars.length];
    }
    return s;
  };
  return `ART-${randBlock(4)}-${randBlock(4)}`;
}
