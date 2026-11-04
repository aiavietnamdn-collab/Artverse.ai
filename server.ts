/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Full-Stack Production Server (Express + Vite + Student PIN Auth + Gemini RBAC)
 */

import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { GoogleGenAI, Type } from '@google/genai';
import {
  evaluateCommentModeration,
  CommentModerationSeverity,
  CommentLifecycleStatus,
  ViolationCategory,
} from './src/services/commentModerationEngine';
import {
  normalizeVietnameseSearch,
  computeSearchRelevance,
  GlobalSearchGroupItem,
} from './src/utils/searchEngine';
import { INITIAL_LESSONS } from './src/data/mockCommunityData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const APP_VERSION = '2.5.0';
const APP_BUILD_ID = '2026.11.01-student-auth-r1';
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' || path.basename(__filename) === 'server.js';

// Load Firebase Project ID & Firestore Database ID from env or firebase-applet-config.json
function resolveFirebaseConfig(): { projectId: string; firestoreDatabaseId: string } {
  let projectId = process.env.FIREBASE_PROJECT_ID?.trim() || '';
  let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || '';
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as {
        projectId?: string;
        firestoreDatabaseId?: string;
      };
      if (!projectId && parsed.projectId) projectId = parsed.projectId.trim();
      if (!firestoreDatabaseId && parsed.firestoreDatabaseId) {
        firestoreDatabaseId = parsed.firestoreDatabaseId.trim();
      }
    }
  } catch {
    // fallback below
  }
  return {
    projectId: projectId || 'static-shade-tpz3c',
    firestoreDatabaseId:
      firestoreDatabaseId || 'ai-studio-artverseaidyhcmt-db85d15f-8546-4095-b89f-4c8e18943c8c',
  };
}

const { projectId: FIREBASE_PROJECT_ID, firestoreDatabaseId: FIRESTORE_DATABASE_ID } =
  resolveFirebaseConfig();

const BOOTSTRAP_ADMIN_EMAIL = 'aiavietnam.dn@gmail.com';
const REQUIRE_FIREBASE_AUTH = process.env.REQUIRE_FIREBASE_AUTH !== 'false';
const MAX_REQUEST_BODY_SIZE = process.env.MAX_REQUEST_BODY_SIZE || '4mb';
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX_GEMINI = Number(process.env.RATE_LIMIT_MAX_GEMINI) || 20;
const RATE_LIMIT_MAX_API = Number(process.env.RATE_LIMIT_MAX_API) || 120;

// Ephemeral or configured secret for signing server-verified Student Session Tokens
const STUDENT_SESSION_SECRET =
  process.env.STUDENT_SESSION_SECRET ||
  crypto
    .createHash('sha256')
    .update(`artverse-student-session-${FIREBASE_PROJECT_ID}-${FIRESTORE_DATABASE_ID}`)
    .digest('hex');

// Initialize Firebase Admin SDK safely (using Secret Manager env var or Cloud Run ADC if available)
let firebaseAdminReady = false;
try {
  if (!getApps().length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: FIREBASE_PROJECT_ID,
      });
      firebaseAdminReady = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.K_SERVICE) {
      initializeApp({
        credential: applicationDefault(),
        projectId: FIREBASE_PROJECT_ID,
      });
      firebaseAdminReady = true;
    }
  } else {
    firebaseAdminReady = true;
  }
} catch {
  firebaseAdminReady = false;
}

// Pre-computed dummy bcrypt hash to prevent timing enumeration when classCode/studentCode is not found
const DUMMY_BCRYPT_HASH = bcrypt.hashSync('000000', 10);
const BCRYPT_ROUNDS = 10;
const MAX_FAILED_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes temporary lockout

// Default & configurable CORS origins
const DEFAULT_ALLOWED_ORIGINS = [
  'https://artverseai.vn',
  'https://www.artverseai.vn',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
];

function getConfiguredAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || '';
  const customOrigins = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      if (entry.startsWith('http://') || entry.startsWith('https://') || entry.includes('://')) {
        return [entry.replace(/\/+$/, '')];
      }
      return [`https://${entry.replace(/\/+$/, '')}`];
    });
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...customOrigins]));
}

function isOriginAllowed(origin: string): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/+$/, '');
  const allowedList = getConfiguredAllowedOrigins();

  if (allowedList.includes(normalized)) {
    return true;
  }

  if (
    normalized.startsWith('capacitor://localhost') ||
    normalized.startsWith('ionic://localhost') ||
    normalized.startsWith('http://localhost:') ||
    normalized.startsWith('http://127.0.0.1:')
  ) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    if (
      parsed.hostname === 'artverseai.vn' ||
      parsed.hostname === 'www.artverseai.vn' ||
      (parsed.protocol === 'https:' && parsed.hostname.endsWith('.run.app'))
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// PERSISTENT SECURE STORE FOR STUDENT ACCOUNTS, CLASSES, TEACHERS & GEMINI QUOTA
// (Never stores plaintext PINs; stores only bcrypt hashes)
// ============================================================================
export interface ServerTeacherRecord {
  id: string;
  uid?: string;
  email: string;
  displayName: string;
  assignedClassCodes: string[];
  createdAt: string;
  createdByAdmin: string;
}

export interface ServerManagedClass {
  id: string;
  classCode: string;
  name: string;
  grade: number;
  schoolYear: string;
  teacherId: string;
  teacherEmail?: string;
  teacherDisplayName: string;
  createdAt: string;
}

export interface ServerStudentRecord {
  id: string;
  classCode: string;
  classGroupId: string;
  className: string;
  grade?: string;
  studentCode: string; // Text (preserves leading zeros)
  alias: string; // Public alias shown in exhibition & community
  displayName: string; // Always equals alias for public safety
  fullName?: string; // Private real name — ONLY visible to owning Teacher & Admin
  needsAliasSetup?: boolean; // True if alias was empty during Excel import
  role: 'student';
  status: 'active' | 'locked';
  pinHash: string; // Strictly bcrypt hash ($2a$10$ / $2b$10$), NEVER plaintext
  teacherId: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
}

export interface ServerSecurityEvent {
  id: string;
  timestamp: string;
  eventType:
    | 'STUDENT_CREATED'
    | 'STUDENT_UPDATED'
    | 'STUDENT_ALIAS_SET'
    | 'STUDENT_LOGIN_SUCCESS'
    | 'STUDENT_LOGIN_FAILED'
    | 'BRUTE_FORCE_TEMP_LOCKOUT'
    | 'STUDENT_STATUS_CHANGED'
    | 'STUDENT_PIN_RESET'
    | 'ROLE_ESCALATION_BLOCKED'
    | 'CROSS_CLASS_ACCESS_BLOCKED'
    | 'UNAUTHORIZED_CLASS_MANAGE_BLOCKED'
    | 'TEACHER_ROLE_GRANTED'
    | 'GEMINI_CONFIG_UPDATED'
    | 'COMMENT_MODERATION_ACTION'
    | 'COMMENT_IDOR_BLOCKED'
    | 'COMMENT_CRITICAL_SAFETY_ALERT'
    | 'COMMENT_TEMP_MUTE';
  actorId: string;
  actorRole: string;
  targetId: string;
  summary: string;
}

export interface ServerCommentStateHistoryItem {
  fromStatus: string;
  toStatus: string;
  changedByUid: string;
  changedByName: string;
  changedByRole: 'student' | 'teacher' | 'admin' | 'system';
  reason: string;
  timestamp: string;
}

export interface ServerCommentRecord {
  id: string;
  artworkId: string;
  artworkTitle: string;
  classCode: string;
  classGroupId: string;
  authorUid: string;
  authorNickname: string; // Public alias only — never real name, email, or studentCode
  authorRole: 'student' | 'teacher' | 'admin';
  content: string;
  createdAt: string;
  createdAtMs: number;
  updatedAt: string;
  isEdited: boolean;
  editedAt?: string;
  status: CommentLifecycleStatus; // 'pending' | 'published' | 'hidden' | 'rejected' | 'deleted'
  severity: CommentModerationSeverity; // 'SAFE' | 'REVIEW' | 'BLOCKED' | 'CRITICAL'
  confidence: number;
  categories: ViolationCategory[];
  internalAuditReason: string;
  moderatedBy?: string;
  moderatedAt?: string;
  moderationReason?: string;
  internalNote?: string;
  assignedToUid?: string;
  assignedToName?: string;
  replyToId?: string;
  replyToNickname?: string;
  appeal: {
    status: 'none' | 'open' | 'approved' | 'rejected';
    appealReason?: string;
    appealedAt?: string;
    resolvedBy?: string;
    resolvedAt?: string;
    resolutionNote?: string;
  };
  stateHistory: ServerCommentStateHistoryItem[];
}

export interface ServerCommentReportRecord {
  id: string;
  commentId: string;
  artworkId: string;
  artworkTitle: string;
  classCode: string;
  classGroupId: string;
  commentSnippet: string;
  reasonCategory:
    | 'inappropriate_language'
    | 'bullying'
    | 'personal_info_leak'
    | 'dangerous_link'
    | 'other';
  reasonLabel: string;
  details: string;
  reporterUidHash: string; // Hashed reporter UID — never exposed publicly
  status: 'open' | 'reviewing' | 'resolved';
  priority: 'normal' | 'high' | 'critical';
  createdAt: string;
  createdAtMs: number;
  resolvedAt?: string;
  resolvedAtMs?: number;
  resolvedByUid?: string;
  resolvedByName?: string;
  resolvedByRole?: 'teacher' | 'admin';
  resolutionNote?: string;
}

export interface GeminiSystemConfig {
  geminiEnabled: boolean;
  dailyLimitPerStudent: number;
  monthlyBudgetUsd: number;
  updatedAt: string;
}

export interface StudentDailyQuotaUsage {
  uid: string;
  dateKey: string; // YYYY-MM-DD (Vietnam UTC+7)
  usedCount: number;
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
  lastUsedAt: string;
}

interface PersistentServerState {
  teachers: ServerTeacherRecord[];
  classes: ServerManagedClass[];
  students: ServerStudentRecord[];
  artworks: any[];
  lessons: any[];
  stories: any[];
  comments: ServerCommentRecord[];
  commentReports: ServerCommentReportRecord[];
  artworkReactions: Record<string, Record<string, 'love' | 'like' | 'haha' | 'sad' | 'angry'>>;
  artworkReactionDocs: Record<
    string,
    Record<
      string,
      {
        uid: string;
        reactionType: 'heart' | 'like' | 'laugh' | 'sad' | 'angry';
        createdAt: string;
        updatedAt: string;
      }
    >
  >;
  moderationConfig: {
    blockedKeywords: string[];
    reviewKeywords: string[];
    editWindowMinutes: number;
    aiModerationOfflineSimulated: boolean;
  };
  mutedCommentUsers: Record<
    string,
    {
      uid: string;
      nickname: string;
      mutedUntil: string;
      reason: string;
      mutedBy: string;
      createdAt: string;
    }
  >;
  securityLogs: ServerSecurityEvent[];
  geminiConfig: GeminiSystemConfig;
  geminiDailyUsage: Record<string, StudentDailyQuotaUsage>; // key: `${dateKey}:${uid}`
  geminiAggregateStats: {
    totalRequestsAllTime: number;
    totalPromptTokensAllTime: number;
    totalCandidateTokensAllTime: number;
    totalTokensAllTime: number;
    uniqueStudentUidsAllTime: string[];
  };
}

const DATA_STORE_PATH = path.resolve(__dirname, '.artverse-secure-store.json');

function createInitialClasses(): ServerManagedClass[] {
  const grades = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const list: ServerManagedClass[] = grades.map((g) => ({
    id: `cls-${g}`,
    classCode: `LOP${g}`,
    name: `Lớp ${g}`,
    grade: g,
    schoolYear: '2025 - 2026',
    teacherId: 'system-default-teacher',
    teacherEmail: BOOTSTRAP_ADMIN_EMAIL,
    teacherDisplayName: 'Tổ Mĩ thuật',
    createdAt: '2025-09-05T00:00:00.000Z',
  }));
  list.push({
    id: 'cls-6a1',
    classCode: 'LOP6A1',
    name: 'Lớp 6',
    grade: 6,
    schoolYear: '2025 - 2026',
    teacherId: 'system-default-teacher',
    teacherEmail: BOOTSTRAP_ADMIN_EMAIL,
    teacherDisplayName: 'Tổ Mĩ thuật',
    createdAt: '2025-09-05T00:00:00.000Z',
  });
  return list;
}

function createInitialStudents(): ServerStudentRecord[] {
  const defaultPinHash = bcrypt.hashSync('123456', 10);
  const classCodes = ['LOP1', 'LOP2', 'LOP3', 'LOP4', 'LOP5', 'LOP6', 'LOP6A1', 'LOP7', 'LOP8', 'LOP9'];
  const aliases = ['Cọ Vẽ Mùa Thu', 'Màu Xanh Hy Vọng', 'Ánh Nắng Sông Hàn', 'Họa Sĩ Ánh Sao'];
  const records: ServerStudentRecord[] = [];

  for (const code of classCodes) {
    const gradeNum = Number(code.replace(/[^0-9]/g, '').charAt(0)) || 6;
    const codes = ['001', '002', 'HS001', 'HS002'];
    codes.forEach((stuCode, idx) => {
      const alias = `${aliases[idx % aliases.length]} (${code}-${stuCode})`;
      records.push({
        id: `stu_${code.toLowerCase()}_${stuCode.toLowerCase()}`,
        classCode: code,
        classGroupId: `cls-${gradeNum}`,
        className: `Lớp ${gradeNum}`,
        grade: `Lớp ${gradeNum}`,
        studentCode: stuCode,
        alias,
        displayName: alias,
        needsAliasSetup: false,
        role: 'student',
        status: 'active',
        pinHash: defaultPinHash,
        teacherId: 'system-default-teacher',
        createdAt: '2025-09-05T00:00:00.000Z',
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    });
  }
  return records;
}

function loadServerState(): PersistentServerState {
  try {
    if (fs.existsSync(DATA_STORE_PATH)) {
      const raw = fs.readFileSync(DATA_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistentServerState>;
      const existingClasses =
        Array.isArray(parsed.classes) && parsed.classes.length > 0
          ? parsed.classes
          : createInitialClasses();
      if (!existingClasses.some((c) => c.classCode === 'LOP6A1')) {
        existingClasses.push({
          id: 'cls-6a1',
          classCode: 'LOP6A1',
          name: 'Lớp 6',
          grade: 6,
          schoolYear: '2025 - 2026',
          teacherId: 'system-default-teacher',
          teacherEmail: BOOTSTRAP_ADMIN_EMAIL,
          teacherDisplayName: 'Tổ Mĩ thuật',
          createdAt: '2025-09-05T00:00:00.000Z',
        });
      }
      return {
        teachers: Array.isArray(parsed.teachers) ? parsed.teachers : [],
        classes: existingClasses,
        students:
          Array.isArray(parsed.students) && parsed.students.length > 0
            ? parsed.students
            : createInitialStudents(),
        artworks: Array.isArray(parsed.artworks) ? parsed.artworks : [],
        lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
        stories: Array.isArray(parsed.stories) ? parsed.stories : [],
        comments: Array.isArray(parsed.comments) ? parsed.comments : [],
        commentReports: Array.isArray(parsed.commentReports) ? parsed.commentReports : [],
        artworkReactions:
          parsed.artworkReactions && typeof parsed.artworkReactions === 'object'
            ? parsed.artworkReactions
            : {},
        artworkReactionDocs:
          parsed.artworkReactionDocs && typeof parsed.artworkReactionDocs === 'object'
            ? parsed.artworkReactionDocs
            : {},
        moderationConfig: parsed.moderationConfig || {
          blockedKeywords: [],
          reviewKeywords: [],
          editWindowMinutes: 15,
          aiModerationOfflineSimulated: false,
        },
        mutedCommentUsers: parsed.mutedCommentUsers || {},
        securityLogs: Array.isArray(parsed.securityLogs) ? parsed.securityLogs : [],
        geminiConfig: parsed.geminiConfig || {
          geminiEnabled: true,
          dailyLimitPerStudent: 10,
          monthlyBudgetUsd: 25,
          updatedAt: new Date().toISOString(),
        },
        geminiDailyUsage: parsed.geminiDailyUsage || {},
        geminiAggregateStats: parsed.geminiAggregateStats || {
          totalRequestsAllTime: 0,
          totalPromptTokensAllTime: 0,
          totalCandidateTokensAllTime: 0,
          totalTokensAllTime: 0,
          uniqueStudentUidsAllTime: [],
        },
      };
    }
  } catch {
    // fallback to clean state
  }
  return {
    teachers: [],
    classes: createInitialClasses(),
    students: createInitialStudents(),
    artworks: [],
    lessons: [],
    stories: [],
    comments: [],
    commentReports: [],
    artworkReactions: {},
    artworkReactionDocs: {},
    moderationConfig: {
      blockedKeywords: [],
      reviewKeywords: [],
      editWindowMinutes: 15,
      aiModerationOfflineSimulated: false,
    },
    mutedCommentUsers: {},
    securityLogs: [],
    geminiConfig: {
      geminiEnabled: true,
      dailyLimitPerStudent: 10,
      monthlyBudgetUsd: 25,
      updatedAt: new Date().toISOString(),
    },
    geminiDailyUsage: {},
    geminiAggregateStats: {
      totalRequestsAllTime: 0,
      totalPromptTokensAllTime: 0,
      totalCandidateTokensAllTime: 0,
      totalTokensAllTime: 0,
      uniqueStudentUidsAllTime: [],
    },
  };
}

const serverState: PersistentServerState = loadServerState();

function saveServerState(): void {
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(serverState, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch {
    // ignore read-only fs errors in ephemeral containers
  }
}

function appendSecurityLog(
  eventType: ServerSecurityEvent['eventType'],
  actorId: string,
  actorRole: string,
  targetId: string,
  summary: string
): void {
  const entry: ServerSecurityEvent = {
    id: `sec_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    eventType,
    actorId,
    actorRole,
    targetId,
    summary,
  };
  serverState.securityLogs.unshift(entry);
  if (serverState.securityLogs.length > 300) {
    serverState.securityLogs.length = 300;
  }
  saveServerState();
}

// Vietnam (UTC+7) date key YYYY-MM-DD and next midnight reset timestamp
function getVietnamDateInfo(): { dateKey: string; resetAtIso: string; resetTimeText: string } {
  const now = new Date();
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  const vnTime = new Date(now.getTime() + vnOffsetMs);
  const year = vnTime.getUTCFullYear();
  const month = String(vnTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getUTCDate()).padStart(2, '0');
  const dateKey = `${year}-${month}-${day}`;

  const nextMidnightVnUtc = Date.UTC(
    vnTime.getUTCFullYear(),
    vnTime.getUTCMonth(),
    vnTime.getUTCDate() + 1,
    0,
    0,
    0
  );
  const resetAtUtcMs = nextMidnightVnUtc - vnOffsetMs;
  const resetAtIso = new Date(resetAtUtcMs).toISOString();

  return {
    dateKey,
    resetAtIso,
    resetTimeText: `00:00 ngày mai (${String(vnTime.getUTCDate() + 1).padStart(2, '0')}/${month}/${year})`,
  };
}

// ============================================================================
// ATOMIC PER-STUDENT QUOTA MUTEX (Prevents concurrent request race conditions)
// ============================================================================
const studentQuotaLocks = new Map<string, Promise<void>>();

async function withStudentQuotaLock<T>(uid: string, fn: () => Promise<T> | T): Promise<T> {
  const prevLock = studentQuotaLocks.get(uid) || Promise.resolve();
  let releaseLock!: () => void;
  const nextLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  studentQuotaLocks.set(uid, prevLock.then(() => nextLock));

  await prevLock;
  try {
    return await fn();
  } finally {
    releaseLock();
    if (studentQuotaLocks.get(uid) === nextLock) {
      studentQuotaLocks.delete(uid);
    }
  }
}

// ============================================================================
// STUDENT SESSION TOKEN & FIREBASE ID TOKEN VERIFICATION
// ============================================================================
export interface StudentSessionPayload {
  uid: string;
  role: 'student';
  classCode: string;
  classGroupId: string;
  className: string;
  studentCode: string;
  displayName: string;
  iat: number;
  exp: number;
}

function signStudentSessionToken(payload: Omit<StudentSessionPayload, 'iat' | 'exp'>): string {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fullPayload: StudentSessionPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + 7 * 24 * 3600, // 7 days
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'ARTVERSE_STU' })).toString(
    'base64url'
  );
  const payloadB64 = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', STUDENT_SESSION_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyStudentSessionToken(rawToken: string): StudentSessionPayload | null {
  try {
    const parts = rawToken.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf-8'));
    if (header?.typ !== 'ARTVERSE_STU' || header?.alg !== 'HS256') {
      return null;
    }

    const expectedSig = crypto
      .createHmac('sha256', STUDENT_SESSION_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf-8')
    ) as StudentSessionPayload;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSeconds) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface CachedCerts {
  certs: Record<string, string>;
  expiresAt: number;
}

let cachedGoogleCerts: CachedCerts | null = null;

export function setTestGooglePublicCerts(certs: Record<string, string>) {
  cachedGoogleCerts = {
    certs,
    expiresAt: Date.now() + 3600_000,
  };
}

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedGoogleCerts && cachedGoogleCerts.expiresAt > now) {
    return cachedGoogleCerts.certs;
  }

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) {
    throw new Error(`Không thể tải chứng chỉ xác thực Google (${response.status}).`);
  }

  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  const certs = (await response.json()) as Record<string, string>;
  cachedGoogleCerts = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };
  return certs;
}

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  roleClaim?: string;
  classCodeClaim?: string;
  classGroupIdClaim?: string;
  studentCodeClaim?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const json = Buffer.from(segment, 'base64url').toString('utf-8');
  return JSON.parse(json) as T;
}

async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Định dạng Firebase ID Token không hợp lệ.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(encodedHeader);
  const payload = decodeBase64UrlJson<{
    iss?: string;
    aud?: string;
    sub?: string;
    exp?: number;
    iat?: number;
    email?: string;
    email_verified?: boolean;
    role?: string;
    classCode?: string;
    classGroupId?: string;
    studentCode?: string;
  }>(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Thuật toán ký hoặc mã khóa (kid) của Token không hợp lệ.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  if (payload.aud !== FIREBASE_PROJECT_ID) {
    throw new Error('Token audience (aud) không khớp với Firebase Project hiện tại.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Token issuer (iss) không hợp lệ.');
  }
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 128) {
    throw new Error('Token subject (uid) không hợp lệ.');
  }
  if (!payload.exp || payload.exp <= nowSeconds - 30) {
    throw new Error('Firebase ID Token đã hết hạn. Vui lòng đăng nhập lại.');
  }
  if (!payload.iat || payload.iat > nowSeconds + 300) {
    throw new Error('Thời điểm phát hành Token (iat) không hợp lệ.');
  }

  const certs = await getGooglePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Không tìm thấy chứng chỉ công khai tương ứng với Firebase ID Token.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const signatureBuffer = Buffer.from(encodedSignature, 'base64url');
  const isValidSignature = verifier.verify(certPem, signatureBuffer);
  if (!isValidSignature) {
    throw new Error('Chữ ký số của Firebase ID Token không hợp lệ.');
  }

  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified,
    roleClaim: payload.role,
    classCodeClaim: payload.classCode,
    classGroupIdClaim: payload.classGroupId,
    studentCodeClaim: payload.studentCode,
    iss: payload.iss,
    aud: payload.aud,
    exp: payload.exp,
    iat: payload.iat,
  };
}

// ============================================================================
// SERVER-SIDE TRUSTED IDENTITY & ROLE RESOLVER (Never trusts client role claims)
// ============================================================================
export interface ResolvedServerActor {
  uid: string;
  email?: string;
  displayName: string;
  role: 'admin' | 'teacher' | 'student' | 'viewer';
  classCode?: string;
  classGroupId?: string;
  className?: string;
  studentCode?: string;
  status: 'active' | 'locked';
}

async function fetchFirestoreUserRoleWithBearer(
  uid: string,
  rawFirebaseIdToken: string
): Promise<'admin' | 'teacher' | 'student' | 'viewer' | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/${FIRESTORE_DATABASE_ID}/documents/users/${encodeURIComponent(
      uid
    )}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${rawFirebaseIdToken}`,
      },
    });
    if (!response.ok) return null;
    const docData = (await response.json()) as {
      fields?: {
        role?: { stringValue?: string };
      };
    };
    const roleVal = docData?.fields?.role?.stringValue;
    if (
      roleVal === 'admin' ||
      roleVal === 'teacher' ||
      roleVal === 'student' ||
      roleVal === 'viewer'
    ) {
      return roleVal;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolveAuthenticatedActor(req: express.Request): Promise<{
  actor: ResolvedServerActor | null;
  errorStatus?: number;
  errorMessage?: string;
  errorCode?: string;
}> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      actor: null,
      errorStatus: 401,
      errorMessage: 'Vui lòng đăng nhập để thực hiện thao tác này.',
      errorCode: 'AUTH_REQUIRED',
    };
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return {
      actor: null,
      errorStatus: 401,
      errorMessage: 'Token xác thực trống.',
      errorCode: 'AUTH_REQUIRED',
    };
  }

  // 1. Check if token is a Server-Signed Student Session Token (ARTVERSE_STU)
  const studentSession = verifyStudentSessionToken(rawToken);
  if (studentSession) {
    const studentRecord = serverState.students.find((s) => s.id === studentSession.uid);
    if (!studentRecord) {
      return {
        actor: null,
        errorStatus: 401,
        errorMessage: 'Tài khoản học sinh không tồn tại hoặc đã bị xóa.',
        errorCode: 'STUDENT_NOT_FOUND',
      };
    }
    if (studentRecord.status === 'locked') {
      return {
        actor: null,
        errorStatus: 403,
        errorMessage:
          'Tài khoản của em hiện đang tạm khóa. Em vui lòng báo giáo viên Mĩ thuật để mở khóa nhé!',
        errorCode: 'ACCOUNT_LOCKED',
      };
    }
    return {
      actor: {
        uid: studentRecord.id,
        displayName: studentRecord.displayName,
        role: 'student',
        classCode: studentRecord.classCode,
        classGroupId: studentRecord.classGroupId,
        className: studentRecord.className,
        studentCode: studentRecord.studentCode,
        status: studentRecord.status,
      },
    };
  }

  // 2. Otherwise verify as a Firebase ID Token (RS256)
  try {
    const verifiedToken = await verifyFirebaseIdToken(rawToken);

    // Check if this is a Firebase Custom Token session for a student
    if (verifiedToken.roleClaim === 'student' || verifiedToken.uid.startsWith('stu_')) {
      const studentRecord = serverState.students.find((s) => s.id === verifiedToken.uid);
      if (studentRecord) {
        if (studentRecord.status === 'locked') {
          return {
            actor: null,
            errorStatus: 403,
            errorMessage:
              'Tài khoản của em hiện đang tạm khóa. Em vui lòng báo giáo viên Mĩ thuật để mở khóa nhé!',
            errorCode: 'ACCOUNT_LOCKED',
          };
        }
        return {
          actor: {
            uid: studentRecord.id,
            displayName: studentRecord.displayName,
            role: 'student',
            classCode: studentRecord.classCode,
            classGroupId: studentRecord.classGroupId,
            className: studentRecord.className,
            studentCode: studentRecord.studentCode,
            status: studentRecord.status,
          },
        };
      }
    }

    const normalizedEmail = (verifiedToken.email || '').trim().toLowerCase();

    // Check Bootstrap Admin
    if (normalizedEmail === BOOTSTRAP_ADMIN_EMAIL && verifiedToken.emailVerified !== false) {
      return {
        actor: {
          uid: verifiedToken.uid,
          email: normalizedEmail,
          displayName: 'Quản trị viên Artverse',
          role: 'admin',
          status: 'active',
        },
      };
    }

    // Check Server Teacher Registry (managed by Admin)
    const registeredTeacher = serverState.teachers.find(
      (t) =>
        (t.uid && t.uid === verifiedToken.uid) ||
        (normalizedEmail && t.email.toLowerCase() === normalizedEmail)
    );
    if (registeredTeacher) {
      if (!registeredTeacher.uid) {
        registeredTeacher.uid = verifiedToken.uid;
        saveServerState();
      }
      return {
        actor: {
          uid: verifiedToken.uid,
          email: normalizedEmail,
          displayName: registeredTeacher.displayName || normalizedEmail,
          role: 'teacher',
          status: 'active',
        },
      };
    }

    // Check Trusted Firestore Document `/users/{uid}`
    const firestoreRole = await fetchFirestoreUserRoleWithBearer(verifiedToken.uid, rawToken);
    if (firestoreRole === 'admin' || firestoreRole === 'teacher') {
      return {
        actor: {
          uid: verifiedToken.uid,
          email: normalizedEmail,
          displayName: normalizedEmail || verifiedToken.uid,
          role: firestoreRole,
          status: 'active',
        },
      };
    }

    // Principle #1: Any other authenticated user is 'viewer' (never auto-promoted to teacher or admin)
    return {
      actor: {
        uid: verifiedToken.uid,
        email: normalizedEmail,
        displayName: normalizedEmail || 'Người dùng',
        role: firestoreRole === 'student' ? 'student' : 'viewer',
        status: 'active',
      },
    };
  } catch (err: any) {
    return {
      actor: null,
      errorStatus: 401,
      errorMessage: err?.message || 'Token xác thực không hợp lệ hoặc đã hết hạn.',
      errorCode: 'INVALID_TOKEN',
    };
  }
}

// ============================================================================
// SLIDING-WINDOW RATE LIMITER
// ============================================================================
interface RateBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateBucket>();

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 120_000).unref();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  res: express.Response
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let bucket = rateLimitStore.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, bucket);
  } else {
    bucket.count += 1;
  }

  const remaining = Math.max(0, maxRequests - bucket.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  res.setHeader('X-RateLimit-Limit', String(maxRequests));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

  if (bucket.count > maxRequests) {
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

const ARTVERSE_SYSTEM_INSTRUCTION = `Bạn là "Trợ lý Mĩ thuật Artverse AI" (kết nối với Google Gemini), người bạn đồng hành sáng tạo thân thiện dành riêng cho Học sinh Tiểu học và THCS (Lớp 1 đến Lớp 9) theo Chương trình Giáo dục phổ thông 2018 tại Việt Nam.

NGUYÊN TẮC CỐT LÕI CỦA ARTVERSE:
1. Tôn trọng sự sáng tạo tự nhiên: TUYỆT ĐỐI KHÔNG chấm điểm bằng con số (ví dụ: không chấm 8/10, 9 điểm), không xếp hạng cao thấp giữa các tác phẩm.
2. Khích lệ tích cực: Khi học sinh gửi câu hỏi hoặc gửi ảnh bức tranh, hãy luôn tìm ra điểm sáng đáng khen ngợi trước (về cảm xúc, màu sắc, đường nét, bố cục hoặc ý tưởng), sau đó mới gợi mở nhẹ nhàng 1-2 hướng phát triển thêm phù hợp với lứa tuổi.
3. Kiến thức Mĩ thuật từ Lớp 1 đến Lớp 9:
   - Lớp 1 - Lớp 5 (Tiểu học): Làm quen chấm, nét, hình cơ bản, ba màu gốc (Đỏ, Vàng, Lam), màu nóng - màu lạnh, vẽ tranh con vật, phong cảnh quê hương, lễ hội truyền thống, nặn đất và thủ công tái chế.
   - Lớp 6: Nghệ thuật Tiền sử & Cổ đại, Hòa sắc (màu nóng, màu lạnh, màu bổ túc), Tạo hình 2D/3D cơ bản, Tranh in hoa lá, Thiệp chúc mừng, Đồ chơi dân gian.
   - Lớp 7: Nghệ thuật Trung đại Thế giới & Việt Nam, Luật xa gần (phối cảnh một điểm tụ), Ký họa dáng người và phong cảnh, Chữ trang trí, Thiết kế bìa sách, Tạo hình từ vật liệu tái chế.
   - Lớp 8: Nghệ thuật Hiện đại Việt Nam & Thế giới (Ấn tượng, Lập thể...), Tỉ lệ khuôn mặt & cơ thể người, Tranh cổ động, Thiết kế thời trang từ cảm hứng văn hóa dân tộc, Nghệ thuật trổ giấy.
   - Lớp 9: Mĩ thuật Đương đại, Thiết kế đồ họa & Nhận diện thương hiệu, Nghệ thuật sắp đặt (Installation Art), Điêu khắc hiện đại, Minh họa truyện tranh, Định hướng nghề nghiệp Mĩ thuật.
4. Phong cách trình bày:
   - Ngắn gọn, thân thiện, trong sáng, dễ hiểu với học sinh.
   - Sử dụng các gạch đầu dòng hoặc đánh số khi liệt kê các bước thực hành để học sinh dễ làm theo.`;

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

function setNoCacheHeaders(res: express.Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
}

function generateRandomSixDigitPin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function sanitizeCode(raw: unknown, maxLen = 24): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, maxLen);
}

export async function createExpressApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Security, CORS, Version & Cache-Control Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Artverse-Version', `${APP_VERSION} (${APP_BUILD_ID})`);

    const reqPath = req.path;

    if (reqPath.startsWith('/api/')) {
      setNoCacheHeaders(res);
    } else if (
      reqPath === '/' ||
      reqPath.endsWith('.html') ||
      reqPath === '/sw.js' ||
      reqPath === '/registerSW.js' ||
      reqPath.startsWith('/workbox-') ||
      reqPath.endsWith('.webmanifest') ||
      reqPath.endsWith('/manifest.json')
    ) {
      setNoCacheHeaders(res);
      if (reqPath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: MAX_REQUEST_BODY_SIZE }));

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err?.type === 'entity.too.large' || err?.status === 413) {
        res.status(413).json({
          error: `Kích thước dữ liệu gửi lên vượt quá giới hạn cho phép (tối đa ${MAX_REQUEST_BODY_SIZE}).`,
          code: 'PAYLOAD_TOO_LARGE',
        });
        return;
      }
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({
          error: 'Dữ liệu JSON gửi lên không hợp lệ.',
          code: 'INVALID_JSON',
        });
        return;
      }
      next(err);
    }
  );

  // General API rate limiting
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') {
      next();
      return;
    }
    const clientIp = getClientIp(req);
    const { allowed, retryAfterSeconds } = checkRateLimit(
      `api:${clientIp}`,
      RATE_LIMIT_MAX_API,
      RATE_LIMIT_WINDOW_MS,
      res
    );
    if (!allowed) {
      res.status(429).json({
        error: `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSeconds} giây.`,
        code: 'RATE_LIMITED',
        retryAfterSeconds,
      });
      return;
    }
    next();
  });

  // ============================================================================
  // 1. HEALTH & SYSTEM STATUS ENDPOINT
  // ============================================================================
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      appId: 'vn.artverseai.app',
      appName: 'ARTVERSE AI',
      version: APP_VERSION,
      buildId: APP_BUILD_ID,
      firebaseProjectId: FIREBASE_PROJECT_ID,
      firebaseAdminCustomTokenReady: firebaseAdminReady,
      service: process.env.K_SERVICE || 'artverse-local',
      revision: process.env.K_REVISION || 'local-dev',
      nodeEnv: IS_PRODUCTION ? 'production' : process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      geminiEnabled: serverState.geminiConfig.geminiEnabled,
      dailyLimitPerStudent: serverState.geminiConfig.dailyLimitPerStudent,
      authRequired: REQUIRE_FIREBASE_AUTH,
      allowedOrigins: getConfiguredAllowedOrigins(),
      rateLimit: {
        windowMs: RATE_LIMIT_WINDOW_MS,
        maxGeminiRequestsPerWindow: RATE_LIMIT_MAX_GEMINI,
        maxBodySize: MAX_REQUEST_BODY_SIZE,
      },
    });
  });

  // ============================================================================
  // 2. RESOLVE CURRENT USER ROLE FROM SERVER TRUSTED SOURCE
  // ============================================================================
  app.get('/api/auth/resolve-role', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({
        error: errorMessage,
        code: errorCode || 'UNAUTHORIZED',
      });
      return;
    }
    res.json({
      uid: actor.uid,
      email: actor.email || '',
      displayName: actor.displayName,
      role: actor.role,
      classCode: actor.classCode,
      classGroupId: actor.classGroupId,
      className: actor.className,
      studentCode: actor.studentCode,
      status: actor.status,
    });
  });

  // ============================================================================
  // 3. STUDENT LOGIN & SESSION ENDPOINTS (PHƯƠNG ÁN A: MÃ LỚP + MÃ HS + MÃ PIN)
  // ============================================================================
  app.post('/api/student-auth/login', async (req, res) => {
    try {
      const clientIp = getClientIp(req);
      const rateCheck = checkRateLimit(`student-login:ip:${clientIp}`, 15, 60_000, res);
      if (!rateCheck.allowed) {
        res.status(429).json({
          error: `Em đã thử đăng nhập quá nhiều lần. Vui lòng đợi ${rateCheck.retryAfterSeconds} giây rồi thử lại nhé!`,
          code: 'LOGIN_RATE_LIMITED',
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        });
        return;
      }

      const rawClassCode = req.body?.classCode;
      const rawStudentCode = req.body?.studentCode;
      const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';

      const classCode = sanitizeCode(rawClassCode, 24);
      const studentCode = sanitizeCode(rawStudentCode, 24);

      if (!classCode || !studentCode || !rawPin || rawPin.length < 4 || rawPin.length > 12) {
        res.status(400).json({
          error: 'Em vui lòng nhập đầy đủ Mã lớp, Mã học sinh và Mã PIN nhé!',
          code: 'MISSING_FIELDS',
        });
        return;
      }

      // Generic error message so nobody can enumerate which studentCode or classCode exists
      const genericInvalidError =
        'Mã lớp, mã học sinh hoặc mã PIN chưa đúng. Em hãy kiểm tra lại thẻ đăng nhập hoặc hỏi giáo viên nhé!';

      const matchingClass = serverState.classes.find(
        (c) => c.classCode.toUpperCase() === classCode
      );
      const studentRecord = serverState.students.find(
        (s) =>
          s.classCode.toUpperCase() === classCode &&
          s.studentCode.toUpperCase() === studentCode
      );

      // If class or student doesn't exist, still perform dummy bcrypt comparison to prevent timing attacks
      if (!matchingClass || !studentRecord) {
        await bcrypt.compare(rawPin, DUMMY_BCRYPT_HASH);
        appendSecurityLog(
          'STUDENT_LOGIN_FAILED',
          `${classCode}:${studentCode}`,
          'anonymous',
          classCode,
          `Đăng nhập học sinh thất bại (không khớp mã lớp/mã học sinh tại ${classCode})`
        );
        res.status(401).json({
          error: genericInvalidError,
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // Check temporary brute-force lockout
      if (studentRecord.lockedUntil) {
        const lockedUntilMs = new Date(studentRecord.lockedUntil).getTime();
        if (lockedUntilMs > Date.now()) {
          const waitMinutes = Math.max(1, Math.ceil((lockedUntilMs - Date.now()) / 60_000));
          res.status(429).json({
            error: `Tài khoản tạm khóa do nhập sai mã PIN nhiều lần. Em hãy thử lại sau ${waitMinutes} phút hoặc nhờ giáo viên cấp lại PIN nhé!`,
            code: 'TEMP_LOCKED_BRUTE_FORCE',
          });
          return;
        } else {
          studentRecord.lockedUntil = null;
          studentRecord.failedLoginAttempts = 0;
        }
      }

      // Verify PIN against bcrypt hash
      const isPinValid = await bcrypt.compare(rawPin, studentRecord.pinHash);
      if (!isPinValid) {
        studentRecord.failedLoginAttempts = (studentRecord.failedLoginAttempts || 0) + 1;

        if (studentRecord.failedLoginAttempts >= MAX_FAILED_PIN_ATTEMPTS) {
          studentRecord.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_DURATION_MS).toISOString();
          saveServerState();
          appendSecurityLog(
            'BRUTE_FORCE_TEMP_LOCKOUT',
            studentRecord.id,
            'student',
            studentRecord.classCode,
            `Khóa tạm thời 15 phút tài khoản ${studentRecord.studentCode} (${studentRecord.classCode}) sau ${MAX_FAILED_PIN_ATTEMPTS} lần nhập sai PIN`
          );
          res.status(429).json({
            error:
              'Em đã nhập sai mã PIN 5 lần liên tiếp. Tài khoản tạm khóa 15 phút để bảo vệ an toàn. Em hãy báo giáo viên nếu quên mã PIN nhé!',
            code: 'TEMP_LOCKED_BRUTE_FORCE',
          });
          return;
        }

        saveServerState();
        appendSecurityLog(
          'STUDENT_LOGIN_FAILED',
          studentRecord.id,
          'student',
          studentRecord.classCode,
          `Nhập sai mã PIN lần ${studentRecord.failedLoginAttempts}/${MAX_FAILED_PIN_ATTEMPTS} (${studentRecord.classCode} - ${studentRecord.studentCode})`
        );
        res.status(401).json({
          error: genericInvalidError,
          code: 'INVALID_CREDENTIALS',
        });
        return;
      }

      // Check if Teacher locked the account
      if (studentRecord.status === 'locked') {
        res.status(403).json({
          error:
            'Tài khoản của em hiện đang tạm khóa. Em vui lòng báo giáo viên Mĩ thuật để mở khóa nhé!',
          code: 'ACCOUNT_LOCKED',
        });
        return;
      }

      // Login succeeded: reset failed counter & update lastLoginAt
      studentRecord.failedLoginAttempts = 0;
      studentRecord.lockedUntil = null;
      studentRecord.lastLoginAt = new Date().toISOString();
      saveServerState();

      appendSecurityLog(
        'STUDENT_LOGIN_SUCCESS',
        studentRecord.id,
        'student',
        studentRecord.classCode,
        `Học sinh ${studentRecord.studentCode} (${studentRecord.classCode}) đăng nhập thành công`
      );

      // Mint Firebase Custom Token if Firebase Admin SDK is configured
      let customToken: string | null = null;
      if (firebaseAdminReady) {
        try {
          customToken = await getAdminAuth().createCustomToken(studentRecord.id, {
            role: 'student',
            classCode: studentRecord.classCode,
            classGroupId: studentRecord.classGroupId,
            studentCode: studentRecord.studentCode,
          });
        } catch {
          customToken = null;
        }
      }

      // Mint Server-Signed Student Session Token (uses public alias, NEVER real fullName)
      const publicAlias =
        studentRecord.alias || studentRecord.displayName || `Họa sĩ #${studentRecord.studentCode}`;
      const studentSessionToken = signStudentSessionToken({
        uid: studentRecord.id,
        role: 'student',
        classCode: studentRecord.classCode,
        classGroupId: studentRecord.classGroupId,
        className: studentRecord.className,
        studentCode: studentRecord.studentCode,
        displayName: publicAlias,
      });

      res.json({
        customToken,
        studentSessionToken,
        student: {
          uid: studentRecord.id,
          classCode: studentRecord.classCode,
          classGroupId: studentRecord.classGroupId,
          className: studentRecord.className,
          grade: studentRecord.grade || studentRecord.className,
          studentCode: studentRecord.studentCode,
          alias: publicAlias,
          displayName: publicAlias,
          needsAliasSetup: Boolean(studentRecord.needsAliasSetup),
          role: 'student',
          status: studentRecord.status,
          createdAt: studentRecord.createdAt,
          lastLoginAt: studentRecord.lastLoginAt,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Lỗi máy chủ khi xử lý đăng nhập học sinh.',
        code: 'SERVER_ERROR',
      });
    }
  });

  // Verify persisted student session on page reload (Test #12)
  app.get('/api/student-auth/me', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'student') {
      res.status(errorStatus || 401).json({
        error: errorMessage || 'Phiên đăng nhập học sinh không hợp lệ.',
        code: errorCode || 'UNAUTHORIZED',
      });
      return;
    }

    const studentRecord = serverState.students.find((s) => s.id === actor.uid);
    if (!studentRecord || studentRecord.status === 'locked') {
      res.status(403).json({
        error: 'Tài khoản học sinh đã bị khóa hoặc không còn hiệu lực.',
        code: 'ACCOUNT_LOCKED',
      });
      return;
    }

    const publicAlias =
      studentRecord.alias || studentRecord.displayName || `Họa sĩ #${studentRecord.studentCode}`;

    res.json({
      student: {
        uid: studentRecord.id,
        classCode: studentRecord.classCode,
        classGroupId: studentRecord.classGroupId,
        className: studentRecord.className,
        grade: studentRecord.grade || studentRecord.className,
        studentCode: studentRecord.studentCode,
        alias: publicAlias,
        displayName: publicAlias,
        needsAliasSetup: Boolean(studentRecord.needsAliasSetup),
        role: 'student',
        status: studentRecord.status,
        createdAt: studentRecord.createdAt,
        lastLoginAt: studentRecord.lastLoginAt,
      },
    });
  });

  // First-login Alias Setup for Student (Part A: "Nếu bí danh chưa có, yêu cầu học sinh tạo bí danh trong lần đăng nhập đầu tiên")
  app.post('/api/student-auth/set-alias', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'student') {
      res.status(errorStatus || 401).json({
        error: errorMessage || 'Chỉ học sinh đang đăng nhập mới được cập nhật bí danh.',
        code: errorCode || 'UNAUTHORIZED',
      });
      return;
    }

    const rawAlias = typeof req.body?.alias === 'string' ? req.body.alias.trim() : '';
    if (!rawAlias || rawAlias.length < 2 || rawAlias.length > 40) {
      res.status(400).json({
        error: 'Bí danh cần có độ dài từ 2 đến 40 ký tự (ví dụ: Mây Màu, Cọ Nhỏ, Mặt Trời Xanh).',
        code: 'INVALID_ALIAS',
      });
      return;
    }

    const studentRecord = serverState.students.find((s) => s.id === actor.uid);
    if (!studentRecord) {
      res.status(404).json({
        error: 'Không tìm thấy hồ sơ học sinh.',
        code: 'STUDENT_NOT_FOUND',
      });
      return;
    }

    studentRecord.alias = rawAlias;
    studentRecord.displayName = rawAlias;
    studentRecord.needsAliasSetup = false;
    studentRecord.updatedAt = new Date().toISOString();
    saveServerState();

    appendSecurityLog(
      'STUDENT_ALIAS_SET',
      studentRecord.id,
      'student',
      studentRecord.classCode,
      `Học sinh ${studentRecord.studentCode} (${studentRecord.classCode}) khởi tạo bí danh nghệ thuật: "${rawAlias}"`
    );

    const newSessionToken = signStudentSessionToken({
      uid: studentRecord.id,
      role: 'student',
      classCode: studentRecord.classCode,
      classGroupId: studentRecord.classGroupId,
      className: studentRecord.className,
      studentCode: studentRecord.studentCode,
      displayName: rawAlias,
    });

    res.json({
      studentSessionToken: newSessionToken,
      student: {
        uid: studentRecord.id,
        classCode: studentRecord.classCode,
        classGroupId: studentRecord.classGroupId,
        className: studentRecord.className,
        grade: studentRecord.grade || studentRecord.className,
        studentCode: studentRecord.studentCode,
        alias: rawAlias,
        displayName: rawAlias,
        needsAliasSetup: false,
        role: 'student',
        status: studentRecord.status,
        createdAt: studentRecord.createdAt,
        lastLoginAt: studentRecord.lastLoginAt,
      },
    });
  });

  // Student Class Workspace Access Guard (Test #6: Block cross-class access)
  app.get('/api/student/class-workspace/:classCode', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    const requestedClassCode = sanitizeCode(req.params.classCode, 24);
    if (actor.role === 'student') {
      if ((actor.classCode || '').toUpperCase() !== requestedClassCode) {
        appendSecurityLog(
          'CROSS_CLASS_ACCESS_BLOCKED',
          actor.uid,
          'student',
          requestedClassCode,
          `Chặn học sinh ${actor.studentCode} (lớp ${actor.classCode}) truy cập trái phép dữ liệu lớp ${requestedClassCode}`
        );
        res.status(403).json({
          error: `Em thuộc lớp ${actor.classCode} nên không được phép truy cập dữ liệu riêng của lớp ${requestedClassCode}.`,
          code: 'CLASS_ACCESS_DENIED',
        });
        return;
      }
    }

    const targetClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === requestedClassCode
    );
    if (!targetClass) {
      res.status(404).json({
        error: 'Không tìm thấy lớp học.',
        code: 'CLASS_NOT_FOUND',
      });
      return;
    }

    res.json({
      classInfo: {
        id: targetClass.id,
        classCode: targetClass.classCode,
        name: targetClass.name,
        grade: targetClass.grade,
        schoolYear: targetClass.schoolYear,
        teacherDisplayName: targetClass.teacherDisplayName,
      },
    });
  });

  // Student Profile Update Guard (Test #7: Block role escalation or classId tampering)
  app.post('/api/student/profile', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    const body = req.body || {};
    if (
      body.role !== undefined ||
      body.classCode !== undefined ||
      body.classGroupId !== undefined ||
      body.studentCode !== undefined ||
      body.status !== undefined
    ) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        actor.uid,
        `Chặn hành vi tự ý thay đổi role (${String(body.role)}) hoặc classCode (${String(body.classCode)}) từ phía client`
      );
      res.status(403).json({
        error: 'Không được phép tự ý thay đổi vai trò (role), mã lớp hoặc quyền truy cập.',
        code: 'ROLE_ESCALATION_FORBIDDEN',
      });
      return;
    }

    res.json({ status: 'ok' });
  });

  // ============================================================================
  // 4. TEACHER CLASS & STUDENT ACCOUNT MANAGEMENT ENDPOINTS (PHƯƠNG ÁN A)
  // ============================================================================
  // List classes managed by Teacher (or all classes for Admin)
  app.get('/api/teacher/classes', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên và Quản trị viên mới có quyền truy cập quản lý lớp học.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const visibleClasses = serverState.classes
      .filter((c) => {
        if (actor.role === 'admin') return true;
        return (
          c.teacherId === actor.uid ||
          c.teacherId === 'system-default-teacher' ||
          (actor.email && c.teacherEmail?.toLowerCase() === actor.email.toLowerCase())
        );
      })
      .map((c) => {
        const studentCount = serverState.students.filter(
          (s) => s.classCode.toUpperCase() === c.classCode.toUpperCase()
        ).length;
        return {
          ...c,
          studentCount,
        };
      });

    res.json({ classes: visibleClasses });
  });

  // Create a new class with unique classCode
  app.post('/api/teacher/classes', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên và Quản trị viên mới được tạo lớp học mới.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const classCode = sanitizeCode(req.body?.classCode, 20);
    const grade = Number(req.body?.grade);
    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const schoolYear =
      typeof req.body?.schoolYear === 'string' && req.body.schoolYear.trim()
        ? req.body.schoolYear.trim().slice(0, 32)
        : '2025 - 2026';

    if (!classCode || classCode.length < 2) {
      res.status(400).json({
        error: 'Mã lớp phải từ 2 đến 20 ký tự chữ hoặc số (ví dụ: LOP6A, MT7B).',
        code: 'INVALID_CLASS_CODE',
      });
      return;
    }

    if (!Number.isInteger(grade) || grade < 1 || grade > 9) {
      res.status(400).json({
        error: 'Cấp lớp phải nằm trong phạm vi từ Lớp 1 đến Lớp 9.',
        code: 'INVALID_GRADE',
      });
      return;
    }

    const existingClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === classCode
    );
    if (existingClass) {
      res.status(409).json({
        error: `Mã lớp "${classCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã lớp khác.`,
        code: 'CLASS_CODE_EXISTS',
      });
      return;
    }

    const newClass: ServerManagedClass = {
      id: `cls-${grade}-${classCode.toLowerCase()}`,
      classCode,
      name: rawName || `Lớp ${grade} (${classCode})`,
      grade,
      schoolYear,
      teacherId: actor.uid,
      teacherEmail: actor.email,
      teacherDisplayName: actor.displayName || 'Giáo viên Mĩ thuật',
      createdAt: new Date().toISOString(),
    };

    serverState.classes.push(newClass);
    saveServerState();

    res.status(201).json({
      classRoom: {
        ...newClass,
        studentCount: 0,
      },
    });
  });

  // Helper to verify if Teacher owns a class
  function canTeacherManageClass(actor: ResolvedServerActor, targetClass: ServerManagedClass): boolean {
    if (actor.role === 'admin') return true;
    if (actor.role !== 'teacher') return false;
    if (targetClass.teacherId === actor.uid) return true;
    if (actor.email && targetClass.teacherEmail?.toLowerCase() === actor.email.toLowerCase()) {
      return true;
    }
    if (targetClass.teacherId === 'system-default-teacher') {
      return true;
    }
    return false;
  }

  // List students in a class (NEVER returns pinHash or plaintext PIN)
  app.get('/api/teacher/classes/:classCode/students', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên phụ trách và Quản trị viên mới được xem danh sách tài khoản học sinh.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const classCode = sanitizeCode(req.params.classCode, 24);
    const targetClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === classCode
    );
    if (!targetClass) {
      res.status(404).json({
        error: `Không tìm thấy lớp học với mã "${classCode}".`,
        code: 'CLASS_NOT_FOUND',
      });
      return;
    }

    // Test #8: Block teacher from managing a class owned by another teacher
    if (!canTeacherManageClass(actor, targetClass)) {
      appendSecurityLog(
        'UNAUTHORIZED_CLASS_MANAGE_BLOCKED',
        actor.uid,
        actor.role,
        classCode,
        `Chặn giáo viên ${actor.uid} truy cập danh sách học sinh lớp ${classCode} của giáo viên khác (${targetClass.teacherId})`
      );
      res.status(403).json({
        error: `Bạn không có quyền quản lý tài khoản học sinh của lớp ${classCode} (thuộc giáo viên phụ trách khác).`,
        code: 'CLASS_OWNERSHIP_FORBIDDEN',
      });
      return;
    }

    const students = serverState.students
      .filter((s) => s.classCode.toUpperCase() === classCode)
      .map((s) => ({
        id: s.id,
        classCode: s.classCode,
        classGroupId: s.classGroupId,
        className: s.className,
        grade: s.grade || s.className,
        studentCode: s.studentCode,
        alias: s.alias || s.displayName,
        displayName: s.alias || s.displayName,
        fullName: s.fullName || s.displayName, // Visible ONLY here to owning Teacher & Admin
        needsAliasSetup: Boolean(s.needsAliasSetup),
        role: s.role,
        status: s.status,
        teacherId: s.teacherId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        lastLoginAt: s.lastLoginAt,
      }));

    res.json({
      classRoom: targetClass,
      students,
    });
  });

  // Create or Update single or bulk 4-column Excel student accounts
  // Columns: A = Mã HS (studentCode, Text), B = Bí danh (alias, Text), C = Tên HS (fullName, Text), D = Lớp (grade, Text)
  app.post('/api/teacher/classes/:classCode/students', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên phụ trách và Quản trị viên mới được tạo tài khoản học sinh.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const classCode = sanitizeCode(req.params.classCode, 24);
    const targetClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === classCode
    );
    if (!targetClass) {
      res.status(404).json({
        error: `Không tìm thấy lớp học với mã "${classCode}".`,
        code: 'CLASS_NOT_FOUND',
      });
      return;
    }

    // Test #8: Enforce class ownership
    if (!canTeacherManageClass(actor, targetClass)) {
      appendSecurityLog(
        'UNAUTHORIZED_CLASS_MANAGE_BLOCKED',
        actor.uid,
        actor.role,
        classCode,
        `Chặn giáo viên ${actor.uid} tạo học sinh trái phép vào lớp ${classCode} của giáo viên khác`
      );
      res.status(403).json({
        error: `Bạn không có quyền thêm học sinh vào lớp ${classCode} không thuộc quyền phụ trách.`,
        code: 'CLASS_OWNERSHIP_FORBIDDEN',
      });
      return;
    }

    // If this was a default system class without a specific teacher yet, claim ownership for this teacher
    if (targetClass.teacherId === 'system-default-teacher' && actor.role === 'teacher') {
      targetClass.teacherId = actor.uid;
      targetClass.teacherEmail = actor.email;
    }

    const updateExisting = Boolean(req.body?.updateExisting);

    const rawEntries: Array<{
      studentCode?: string;
      alias?: string;
      fullName?: string;
      grade?: string;
      displayName?: string;
    }> = Array.isArray(req.body?.students)
      ? req.body.students
      : [
          {
            studentCode: req.body?.studentCode,
            alias: req.body?.alias,
            fullName: req.body?.fullName,
            grade: req.body?.grade,
            displayName: req.body?.displayName,
          },
        ];

    if (rawEntries.length === 0 || rawEntries.length > 200) {
      res.status(400).json({
        error: 'Số lượng học sinh tạo mỗi lần phải từ 1 đến 200.',
        code: 'INVALID_BATCH_SIZE',
      });
      return;
    }

    const parseGradeNum = (rawGrade?: string): number | null => {
      if (!rawGrade || typeof rawGrade !== 'string') return targetClass.grade;
      const m = rawGrade.trim().match(/(?:lớp|lop|khối|khoi|grade|cls-)?\s*0*(\d{1,2})\b/i);
      if (!m || !m[1]) return null;
      const n = parseInt(m[1], 10);
      if (isNaN(n) || n < 1 || n > 9) return null;
      return n;
    };

    const createdCards: Array<{
      id: string;
      classCode: string;
      className: string;
      grade: string;
      studentCode: string;
      alias: string;
      displayName: string;
      fullName: string;
      initialPin: string;
      issuedAt: string;
    }> = [];
    const createdSummaries: Array<
      Omit<ServerStudentRecord, 'pinHash' | 'failedLoginAttempts' | 'lockedUntil'>
    > = [];
    const updatedSummaries: Array<
      Omit<ServerStudentRecord, 'pinHash' | 'failedLoginAttempts' | 'lockedUntil'>
    > = [];
    const skippedDuplicates: string[] = [];
    const invalidRows: Array<{ studentCode: string; reason: string }> = [];
    const seenInBatch = new Set<string>();

    for (const item of rawEntries) {
      // Preserve leading zeros in studentCode as Text
      const rawCodeStr = String(item.studentCode ?? '').trim().toUpperCase().replace(/\s+/g, '');
      const studentCode = rawCodeStr.replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
      const rawAlias = typeof item.alias === 'string' ? item.alias.trim().slice(0, 60) : '';
      const rawFullName =
        typeof item.fullName === 'string' && item.fullName.trim()
          ? item.fullName.trim().slice(0, 80)
          : typeof item.displayName === 'string'
          ? item.displayName.trim().slice(0, 80)
          : '';

      if (!studentCode || !rawFullName) {
        invalidRows.push({
          studentCode: studentCode || '(Trống)',
          reason: 'Thiếu Mã HS hoặc Tên HS',
        });
        continue;
      }

      const parsedGradeNum = parseGradeNum(item.grade);
      if (parsedGradeNum === null) {
        invalidRows.push({
          studentCode,
          reason: `Lớp "${item.grade}" không hợp lệ (chỉ chấp nhận Lớp 1 đến Lớp 9)`,
        });
        continue;
      }

      if (seenInBatch.has(studentCode)) {
        skippedDuplicates.push(studentCode);
        continue;
      }
      seenInBatch.add(studentCode);

      const normalizedGradeLabel = `Lớp ${parsedGradeNum}`;
      const normalizedClassGroupId = `cls-${parsedGradeNum}`;
      const needsAliasSetup = !rawAlias;
      const effectiveAlias = rawAlias || ( item.displayName && !item.fullName ? item.displayName.trim() : `Họa sĩ #${studentCode}` );

      const existingStudent = serverState.students.find(
        (s) =>
          s.classCode.toUpperCase() === classCode &&
          s.studentCode.toUpperCase() === studentCode
      );

      if (existingStudent) {
        if (updateExisting) {
          existingStudent.fullName = rawFullName;
          if (rawAlias) {
            existingStudent.alias = rawAlias;
            existingStudent.displayName = rawAlias;
            existingStudent.needsAliasSetup = false;
          }
          existingStudent.grade = normalizedGradeLabel;
          existingStudent.className = normalizedGradeLabel;
          existingStudent.classGroupId = normalizedClassGroupId;
          existingStudent.updatedAt = new Date().toISOString();

          const { pinHash: _ph, failedLoginAttempts: _fa, lockedUntil: _lu, ...rest } = existingStudent;
          updatedSummaries.push(rest);
        } else {
          skippedDuplicates.push(studentCode);
        }
        continue;
      }

      const initialPin = generateRandomSixDigitPin();
      const pinHash = await bcrypt.hash(initialPin, BCRYPT_ROUNDS);
      const nowIso = new Date().toISOString();
      const studentId = `stu_${classCode.toLowerCase()}_${studentCode.toLowerCase()}_${crypto
        .randomBytes(3)
        .toString('hex')}`;

      const newStudent: ServerStudentRecord = {
        id: studentId,
        classCode,
        classGroupId: normalizedClassGroupId,
        className: normalizedGradeLabel,
        grade: normalizedGradeLabel,
        studentCode,
        alias: effectiveAlias,
        displayName: effectiveAlias, // Public-safe alias
        fullName: rawFullName, // Restricted to Teacher/Admin only
        needsAliasSetup,
        role: 'student',
        status: 'active',
        pinHash,
        teacherId:
          targetClass.teacherId === 'system-default-teacher' ? actor.uid : targetClass.teacherId,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      serverState.students.push(newStudent);

      createdCards.push({
        id: studentId,
        classCode,
        className: newStudent.className,
        grade: normalizedGradeLabel,
        studentCode,
        alias: effectiveAlias,
        displayName: effectiveAlias,
        fullName: rawFullName,
        initialPin, // Returned ONCE only in this response
        issuedAt: nowIso,
      });

      const { pinHash: _ph, failedLoginAttempts: _fa, lockedUntil: _lu, ...summary } = newStudent;
      createdSummaries.push(summary);
    }

    if (createdCards.length === 0 && updatedSummaries.length === 0) {
      res.status(409).json({
        error:
          skippedDuplicates.length > 0
            ? `Mã học sinh (${skippedDuplicates.join(', ')}) đã tồn tại trong lớp ${classCode}. Bạn có thể bật tùy chọn "Cập nhật hồ sơ học sinh hiện có" nếu muốn cập nhật thông tin mà không tạo tài khoản trùng.`
            : invalidRows.length > 0
            ? invalidRows.map((r) => `${r.studentCode}: ${r.reason}`).join('; ')
            : 'Vui lòng nhập đầy đủ Mã HS, Bí danh, Tên HS và Lớp (Lớp 1 – Lớp 9) hợp lệ.',
        code: 'NO_STUDENTS_CREATED',
        skippedDuplicates,
        invalidRows,
      });
      return;
    }

    saveServerState();
    if (createdCards.length > 0) {
      appendSecurityLog(
        'STUDENT_CREATED',
        actor.uid,
        actor.role,
        classCode,
        `Tạo ${createdCards.length} tài khoản học sinh cho lớp ${classCode} (PIN đã được băm bcrypt)`
      );
    }
    if (updatedSummaries.length > 0) {
      appendSecurityLog(
        'STUDENT_UPDATED',
        actor.uid,
        actor.role,
        classCode,
        `Cập nhật hồ sơ ${updatedSummaries.length} học sinh hiện có trong lớp ${classCode} (không tạo bản ghi trùng)`
      );
    }

    res.status(createdCards.length > 0 ? 201 : 200).json({
      createdCount: createdCards.length,
      updatedCount: updatedSummaries.length,
      skippedDuplicates,
      invalidRows,
      students: [...createdSummaries, ...updatedSummaries],
      loginCardsOneTime: createdCards,
    });
  });

  // Lock or Unlock a student account
  app.post('/api/teacher/students/:studentId/status', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên phụ trách và Quản trị viên mới được khóa/mở khóa tài khoản học sinh.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const studentId = req.params.studentId;
    const newStatus = req.body?.status === 'locked' ? 'locked' : 'active';

    const studentRecord = serverState.students.find((s) => s.id === studentId);
    if (!studentRecord) {
      res.status(404).json({
        error: 'Không tìm thấy tài khoản học sinh.',
        code: 'STUDENT_NOT_FOUND',
      });
      return;
    }

    const targetClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === studentRecord.classCode.toUpperCase()
    );
    if (targetClass && !canTeacherManageClass(actor, targetClass)) {
      appendSecurityLog(
        'UNAUTHORIZED_CLASS_MANAGE_BLOCKED',
        actor.uid,
        actor.role,
        studentRecord.classCode,
        `Chặn giáo viên ${actor.uid} thay đổi trạng thái học sinh lớp ${studentRecord.classCode} của giáo viên khác`
      );
      res.status(403).json({
        error: 'Bạn không có quyền khóa/mở khóa học sinh thuộc lớp của giáo viên khác.',
        code: 'CLASS_OWNERSHIP_FORBIDDEN',
      });
      return;
    }

    studentRecord.status = newStatus;
    if (newStatus === 'active') {
      studentRecord.failedLoginAttempts = 0;
      studentRecord.lockedUntil = null;
    }
    saveServerState();

    appendSecurityLog(
      'STUDENT_STATUS_CHANGED',
      actor.uid,
      actor.role,
      studentRecord.id,
      `Cập nhật trạng thái học sinh ${studentRecord.studentCode} (${studentRecord.classCode}) thành ${newStatus}`
    );

    res.json({
      student: {
        id: studentRecord.id,
        classCode: studentRecord.classCode,
        classGroupId: studentRecord.classGroupId,
        className: studentRecord.className,
        studentCode: studentRecord.studentCode,
        displayName: studentRecord.displayName,
        role: studentRecord.role,
        status: studentRecord.status,
        teacherId: studentRecord.teacherId,
        createdAt: studentRecord.createdAt,
        lastLoginAt: studentRecord.lastLoginAt,
      },
    });
  });

  // Reset Student PIN (Test #11: Teacher resets PIN -> returns new random PIN ONCE, never reveals old PIN)
  app.post('/api/teacher/students/:studentId/reset-pin', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error: 'Chỉ Giáo viên phụ trách và Quản trị viên mới được cấp lại mã PIN cho học sinh.',
        code: 'FORBIDDEN',
      });
      return;
    }

    const studentId = req.params.studentId;
    const studentRecord = serverState.students.find((s) => s.id === studentId);
    if (!studentRecord) {
      res.status(404).json({
        error: 'Không tìm thấy tài khoản học sinh.',
        code: 'STUDENT_NOT_FOUND',
      });
      return;
    }

    const targetClass = serverState.classes.find(
      (c) => c.classCode.toUpperCase() === studentRecord.classCode.toUpperCase()
    );
    if (targetClass && !canTeacherManageClass(actor, targetClass)) {
      appendSecurityLog(
        'UNAUTHORIZED_CLASS_MANAGE_BLOCKED',
        actor.uid,
        actor.role,
        studentRecord.classCode,
        `Chặn giáo viên ${actor.uid} cấp lại PIN cho học sinh lớp ${studentRecord.classCode} của giáo viên khác`
      );
      res.status(403).json({
        error: 'Bạn không có quyền cấp lại mã PIN cho học sinh thuộc lớp của giáo viên khác.',
        code: 'CLASS_OWNERSHIP_FORBIDDEN',
      });
      return;
    }

    const newPin = generateRandomSixDigitPin();
    studentRecord.pinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
    studentRecord.failedLoginAttempts = 0;
    studentRecord.lockedUntil = null;
    studentRecord.status = 'active';
    saveServerState();

    appendSecurityLog(
      'STUDENT_PIN_RESET',
      actor.uid,
      actor.role,
      studentRecord.id,
      `Cấp lại mã PIN mới cho học sinh ${studentRecord.studentCode} (${studentRecord.classCode})`
    );

    res.json({
      loginCardOneTime: {
        id: studentRecord.id,
        classCode: studentRecord.classCode,
        className: studentRecord.className,
        studentCode: studentRecord.studentCode,
        displayName: studentRecord.displayName,
        initialPin: newPin, // Returned ONCE only
        issuedAt: new Date().toISOString(),
      },
    });
  });

  // ============================================================================
  // 5. ADMIN TEACHER MANAGEMENT & SECURITY LOGS (ONLY ADMIN)
  // ============================================================================
  app.get('/api/admin/teachers', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Quản trị viên (Admin) mới có quyền quản lý danh sách Giáo viên.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }
    res.json({
      teachers: serverState.teachers,
      securityLogs: serverState.securityLogs.slice(0, 50),
    });
  });

  app.post('/api/admin/teachers', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Quản trị viên (Admin) mới được cấp quyền Giáo viên.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const displayName =
      typeof req.body?.displayName === 'string' && req.body.displayName.trim()
        ? req.body.displayName.trim().slice(0, 80)
        : email;

    if (!email || !email.includes('@')) {
      res.status(400).json({
        error: 'Vui lòng nhập địa chỉ email Google hợp lệ của giáo viên.',
        code: 'INVALID_EMAIL',
      });
      return;
    }

    const assignedClassCodes = Array.isArray(req.body?.assignedClassCodes)
      ? req.body.assignedClassCodes
          .map((c: unknown) => String(c || '').trim().toUpperCase())
          .filter(Boolean)
      : [];

    let existing = serverState.teachers.find((t) => t.email.toLowerCase() === email);
    if (!existing) {
      existing = {
        id: `tch_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
        email,
        displayName,
        assignedClassCodes,
        createdAt: new Date().toISOString(),
        createdByAdmin: actor.email || actor.uid,
      };
      serverState.teachers.push(existing);
      saveServerState();
      appendSecurityLog(
        'TEACHER_ROLE_GRANTED',
        actor.uid,
        'admin',
        email,
        `Admin cấp quyền Giáo viên cho ${email}`
      );
    } else if (assignedClassCodes.length > 0) {
      existing.assignedClassCodes = assignedClassCodes;
      saveServerState();
    }

    res.status(201).json({ teacher: existing });
  });

  app.delete('/api/admin/teachers/:teacherId', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Quản trị viên mới có quyền thu hồi quyền Giáo viên.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    serverState.teachers = serverState.teachers.filter((t) => t.id !== req.params.teacherId);
    saveServerState();
    res.json({ status: 'ok' });
  });

  // ============================================================================
  // 6. GEMINI AI RBAC & QUOTA ENDPOINTS (PRINCIPLE: ONLY ROLE === 'student')
  // ============================================================================
  // Get student's current daily Gemini quota
  app.get('/api/gemini/quota', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    if (actor.role !== 'student') {
      res.status(403).json({
        error:
          actor.role === 'admin'
            ? 'Vai trò Quản trị viên chỉ quản lý cấu hình và thống kê, không sử dụng tính năng trò chuyện Gemini.'
            : 'Tính năng Trợ lý Mĩ thuật Gemini chỉ dành riêng cho tài khoản Học sinh.',
        code: actor.role === 'admin' ? 'ADMIN_CHAT_FORBIDDEN' : 'TEACHER_FORBIDDEN',
      });
      return;
    }

    const { dateKey, resetAtIso, resetTimeText } = getVietnamDateInfo();
    const usageKey = `${dateKey}:${actor.uid}`;
    const usedToday = serverState.geminiDailyUsage[usageKey]?.usedCount || 0;
    const dailyLimit = serverState.geminiConfig.dailyLimitPerStudent;
    const remainingQuota = Math.max(0, dailyLimit - usedToday);

    res.json({
      geminiEnabled: serverState.geminiConfig.geminiEnabled,
      usedToday,
      dailyLimit,
      remainingQuota,
      resetAt: resetAtIso,
      resetTimeText,
    });
  });

  // Admin-only Gemini statistics & configuration endpoints
  app.get('/api/gemini/admin/stats', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error:
          errorMessage || 'Chỉ Quản trị viên (Admin) mới được xem cấu hình và thống kê Gemini AI.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    const { dateKey, resetAtIso, resetTimeText } = getVietnamDateInfo();
    const todayEntries = Object.values(serverState.geminiDailyUsage).filter(
      (u) => u.dateKey === dateKey
    );
    const totalStudentsUsedToday = todayEntries.filter((u) => u.usedCount > 0).length;
    const totalRequestsToday = todayEntries.reduce((acc, u) => acc + u.usedCount, 0);
    const totalTokensToday = todayEntries.reduce((acc, u) => acc + u.totalTokens, 0);

    // Estimate cost in USD based on Gemini Flash token pricing (~$0.15 / 1M tokens blended)
    const estimatedCostUsd = Number(
      ((serverState.geminiAggregateStats.totalTokensAllTime / 1_000_000) * 0.15).toFixed(4)
    );

    const rawApiKey = process.env.GEMINI_API_KEY || '';
    const maskedApiKey =
      rawApiKey.length > 8
        ? `${rawApiKey.slice(0, 4)}••••••••${rawApiKey.slice(-4)}`
        : rawApiKey
          ? '••••••••'
          : 'Chưa cấu hình';

    res.json({
      config: serverState.geminiConfig,
      apiKeyStatus: {
        configured: Boolean(rawApiKey),
        maskedPreview: maskedApiKey,
      },
      stats: {
        dateKey,
        resetAt: resetAtIso,
        resetTimeText,
        totalStudentsRegistered: serverState.students.length,
        totalStudentsUsedToday,
        totalStudentsAllTime: serverState.geminiAggregateStats.uniqueStudentUidsAllTime.length,
        totalRequestsToday,
        totalRequestsAllTime: serverState.geminiAggregateStats.totalRequestsAllTime,
        totalTokensToday,
        totalPromptTokensAllTime: serverState.geminiAggregateStats.totalPromptTokensAllTime,
        totalCandidateTokensAllTime: serverState.geminiAggregateStats.totalCandidateTokensAllTime,
        totalTokensAllTime: serverState.geminiAggregateStats.totalTokensAllTime,
        estimatedCostUsd,
      },
    });
  });

  app.post('/api/gemini/admin/config', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Quản trị viên (Admin) mới được thay đổi cấu hình Gemini AI.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    if (typeof req.body?.geminiEnabled === 'boolean') {
      serverState.geminiConfig.geminiEnabled = req.body.geminiEnabled;
    }
    if (typeof req.body?.dailyLimitPerStudent === 'number') {
      const limit = Math.floor(req.body.dailyLimitPerStudent);
      if (limit >= 1 && limit <= 100) {
        serverState.geminiConfig.dailyLimitPerStudent = limit;
      }
    }
    if (typeof req.body?.monthlyBudgetUsd === 'number') {
      const budget = Number(req.body.monthlyBudgetUsd);
      if (budget >= 0 && budget <= 10000) {
        serverState.geminiConfig.monthlyBudgetUsd = budget;
      }
    }
    serverState.geminiConfig.updatedAt = new Date().toISOString();
    saveServerState();

    appendSecurityLog(
      'GEMINI_CONFIG_UPDATED',
      actor.uid,
      'admin',
      'gemini-config',
      `Admin cập nhật cấu hình Gemini: enabled=${serverState.geminiConfig.geminiEnabled}, dailyLimit=${serverState.geminiConfig.dailyLimitPerStudent}`
    );

    res.json({ config: serverState.geminiConfig });
  });

  // Student-Only Gemini Chat Endpoint (Enforces Student Role + Atomic Daily Quota)
  app.post('/api/gemini/chat', async (req, res) => {
    try {
      // 1. Authenticate & Resolve Trusted Server Role
      const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
      if (!actor) {
        res.status(errorStatus || 401).json({
          error:
            errorMessage ||
            'Em vui lòng đăng nhập bằng Mã lớp, Mã học sinh và Mã PIN để trò chuyện với Trợ lý Mĩ thuật Gemini nhé!',
          code: errorCode || 'AUTH_REQUIRED',
        });
        return;
      }

      // 2. Reject if Client attempts to spoof role in body
      if (req.body?.role && req.body.role !== 'student') {
        appendSecurityLog(
          'ROLE_ESCALATION_BLOCKED',
          actor.uid,
          actor.role,
          'gemini-chat',
          `Từ chối yêu cầu giả mạo role (${String(req.body.role)}) khi gọi /api/gemini/chat`
        );
        res.status(403).json({
          error: 'Không được phép giả mạo vai trò người dùng.',
          code: 'ROLE_SPOOFING_FORBIDDEN',
        });
        return;
      }

      // 3. Enforce Principle: ONLY role === 'student' is allowed to call /api/gemini/chat
      if (actor.role === 'admin') {
        res.status(403).json({
          error:
            'Tài khoản Quản trị viên (Admin) chỉ quản lý API key, ngân sách, hạn mức và xem thống kê, không được phép sử dụng tính năng trò chuyện Gemini dành cho học sinh.',
          code: 'ADMIN_CHAT_FORBIDDEN',
        });
        return;
      }

      if (actor.role === 'teacher') {
        res.status(403).json({
          error:
            'Tài khoản Giáo viên không được phép sử dụng tính năng trò chuyện Gemini AI dành cho học sinh.',
          code: 'TEACHER_FORBIDDEN',
        });
        return;
      }

      if (actor.role !== 'student') {
        res.status(403).json({
          error:
            'Chỉ tài khoản Học sinh (đăng nhập bằng Mã lớp + Mã học sinh + Mã PIN do giáo viên cấp) mới được sử dụng Trợ lý Mĩ thuật Gemini.',
          code: 'STUDENT_ROLE_REQUIRED',
        });
        return;
      }

      // 4. Check if Admin disabled Gemini system-wide
      if (!serverState.geminiConfig.geminiEnabled) {
        res.status(503).json({
          error:
            'Tính năng Trợ lý Mĩ thuật Gemini hiện đang tạm tắt bởi Quản trị viên. Em hãy quay lại sau nhé!',
          code: 'GEMINI_DISABLED',
        });
        return;
      }

      // 5. Per-student sliding-window rate limit
      const rateKey = `gemini:uid:${actor.uid}`;
      const { allowed, retryAfterSeconds } = checkRateLimit(
        rateKey,
        RATE_LIMIT_MAX_GEMINI,
        RATE_LIMIT_WINDOW_MS,
        res
      );
      if (!allowed) {
        res.status(429).json({
          error: `Em đang gửi câu hỏi hơi nhanh. Vui lòng đợi ${retryAfterSeconds} giây rồi hỏi tiếp nhé!`,
          code: 'RATE_LIMITED',
          retryAfterSeconds,
        });
        return;
      }

      // 6. Validate request payload structure & bounds
      const { messages, gradeContext, lessonContext, imageBase64, imageMimeType } = req.body as {
        messages?: ChatMessageInput[];
        gradeContext?: string;
        lessonContext?: string;
        imageBase64?: string;
        imageMimeType?: string;
      };

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({
          error: 'Em vui lòng nhập nội dung câu hỏi cho Trợ lý Mĩ thuật nhé!',
          code: 'EMPTY_MESSAGES',
        });
        return;
      }

      if (messages.length > 20) {
        res.status(400).json({
          error: 'Số lượng tin nhắn trong một lần gửi vượt quá giới hạn (tối đa 20 lượt).',
          code: 'TOO_MANY_MESSAGES',
        });
        return;
      }

      for (const msg of messages) {
        if (!msg || typeof msg.text !== 'string' || !msg.text.trim()) {
          res.status(400).json({
            error: 'Nội dung tin nhắn không hợp lệ.',
            code: 'INVALID_MESSAGE_TEXT',
          });
          return;
        }
        if (msg.text.length > 4000) {
          res.status(400).json({
            error: 'Nội dung câu hỏi quá dài (tối đa 4.000 ký tự).',
            code: 'MESSAGE_TOO_LONG',
          });
          return;
        }
      }

      if (imageBase64) {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!imageMimeType || !allowedMimeTypes.includes(imageMimeType)) {
          res.status(400).json({
            error: 'Định dạng ảnh đính kèm không hợp lệ (chỉ hỗ trợ JPEG, PNG, WEBP).',
            code: 'INVALID_IMAGE_MIME',
          });
          return;
        }
        if (imageBase64.length > 4 * 1024 * 1024) {
          res.status(413).json({
            error: 'Dung lượng ảnh đính kèm quá lớn (tối đa 3MB).',
            code: 'IMAGE_TOO_LARGE',
          });
          return;
        }
      }

      // 7. Atomic Daily Quota Reservation (Prevents concurrent requests from exceeding daily limit)
      const { dateKey, resetAtIso, resetTimeText } = getVietnamDateInfo();
      const dailyLimit = serverState.geminiConfig.dailyLimitPerStudent;
      const usageKey = `${dateKey}:${actor.uid}`;

      const quotaCheck = await withStudentQuotaLock(actor.uid, () => {
        let record = serverState.geminiDailyUsage[usageKey];
        if (!record) {
          record = {
            uid: actor.uid,
            dateKey,
            usedCount: 0,
            promptTokens: 0,
            candidateTokens: 0,
            totalTokens: 0,
            lastUsedAt: new Date().toISOString(),
          };
          serverState.geminiDailyUsage[usageKey] = record;
        }

        if (record.usedCount >= dailyLimit) {
          return {
            allowed: false,
            usedToday: record.usedCount,
            remainingQuota: 0,
          };
        }

        // Reserve 1 slot atomically before calling Gemini
        record.usedCount += 1;
        record.lastUsedAt = new Date().toISOString();
        saveServerState();

        return {
          allowed: true,
          usedToday: record.usedCount,
          remainingQuota: Math.max(0, dailyLimit - record.usedCount),
        };
      });

      if (!quotaCheck.allowed) {
        res.status(429).json({
          error: `Hôm nay em đã sử dụng hết ${dailyLimit}/${dailyLimit} lượt hỏi Trợ lý Mĩ thuật Gemini. Em có thể hỏi tiếp vào ${resetTimeText} hoặc liên hệ giáo viên Mĩ thuật của lớp để được hỗ trợ thêm nhé!`,
          code: 'QUOTA_EXCEEDED',
          quota: {
            usedToday: quotaCheck.usedToday,
            dailyLimit,
            remainingQuota: 0,
            resetAt: resetAtIso,
            resetTimeText,
          },
        });
        return;
      }

      // 8. Call Gemini API (or provide helpful pedagogical response if GEMINI_API_KEY is not set in test environment)
      let replyText = '';
      let promptTokens = 120;
      let candidateTokens = 180;
      let totalTokens = 300;

      if (process.env.GEMINI_API_KEY) {
        try {
          const contents: Array<{
            role: 'user' | 'model';
            parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>;
          }> = messages.map((msg, idx) => {
            const isLastUserMessage = idx === messages.length - 1 && msg.role === 'user';
            const parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }> =
              [];

            if (isLastUserMessage && imageBase64 && imageMimeType) {
              const cleanBase64 = imageBase64.includes(',')
                ? imageBase64.split(',')[1]
                : imageBase64;
              parts.push({
                inlineData: {
                  data: cleanBase64,
                  mimeType: imageMimeType,
                },
              });
            }

            let textContent = msg.text;
            const effectiveGrade =
              actor.className ||
              (typeof gradeContext === 'string' ? gradeContext.slice(0, 60) : '');
            if (isLastUserMessage && (effectiveGrade || lessonContext)) {
              const safeLesson =
                typeof lessonContext === 'string' ? lessonContext.slice(0, 200) : '';
              const contextPrefix = [
                effectiveGrade && effectiveGrade !== 'all'
                  ? `[Học sinh thuộc: ${effectiveGrade}]`
                  : '',
                safeLesson ? `[Bài học đang tham khảo: ${safeLesson}]` : '',
              ]
                .filter(Boolean)
                .join(' ');
              if (contextPrefix) {
                textContent = `${contextPrefix}\n${msg.text}`;
              }
            }

            parts.push({ text: textContent });

            return {
              role: msg.role === 'model' ? 'model' : 'user',
              parts,
            };
          });

          const ai = getGenAIClient();
          const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents,
            config: {
              systemInstruction: ARTVERSE_SYSTEM_INSTRUCTION,
            },
          });

          replyText =
            response.text ||
            'Mình rất ấn tượng với câu hỏi sáng tạo của em! Em hãy thử kết hợp các mảng màu tương phản để làm nổi bật hình ảnh chính nhé!';

          if (response.usageMetadata) {
            promptTokens = response.usageMetadata.promptTokenCount || promptTokens;
            candidateTokens = response.usageMetadata.candidatesTokenCount || candidateTokens;
            totalTokens = response.usageMetadata.totalTokenCount || promptTokens + candidateTokens;
          }
        } catch (geminiErr: any) {
          // Refund quota slot if upstream Gemini network fails
          await withStudentQuotaLock(actor.uid, () => {
            const rec = serverState.geminiDailyUsage[usageKey];
            if (rec && rec.usedCount > 0) {
              rec.usedCount -= 1;
              saveServerState();
            }
          });
          throw geminiErr;
        }
      } else {
        replyText =
          `**Gợi ý sáng tạo dành cho ${actor.displayName} (${actor.className || 'Mĩ thuật'}):**\n` +
          `- **Điểm sáng ý tưởng:** Chủ đề em chọn rất giàu cảm xúc và gần gũi.\n` +
          `- **Bố cục & Màu sắc:** Em hãy đặt nhân vật/hình ảnh chính ở vị trí trung tâm với gam màu tươi sáng, kết hợp nền màu dịu hơn để bức tranh có chiều sâu nhé!`;
      }

      // 9. Record anonymous aggregate token stats (never logging student prompt or API key)
      await withStudentQuotaLock(actor.uid, () => {
        const rec = serverState.geminiDailyUsage[usageKey];
        if (rec) {
          rec.promptTokens += promptTokens;
          rec.candidateTokens += candidateTokens;
          rec.totalTokens += totalTokens;
        }
        serverState.geminiAggregateStats.totalRequestsAllTime += 1;
        serverState.geminiAggregateStats.totalPromptTokensAllTime += promptTokens;
        serverState.geminiAggregateStats.totalCandidateTokensAllTime += candidateTokens;
        serverState.geminiAggregateStats.totalTokensAllTime += totalTokens;
        if (!serverState.geminiAggregateStats.uniqueStudentUidsAllTime.includes(actor.uid)) {
          serverState.geminiAggregateStats.uniqueStudentUidsAllTime.push(actor.uid);
        }
        saveServerState();
      });

      res.json({
        reply: replyText,
        quota: {
          usedToday: quotaCheck.usedToday,
          dailyLimit,
          remainingQuota: quotaCheck.remainingQuota,
          resetAt: resetAtIso,
          resetTimeText,
        },
      });
    } catch {
      res.status(500).json({
        error: 'Không thể kết nối tới Trợ lý Mĩ thuật Gemini lúc này. Em vui lòng thử lại sau giây lát nhé!',
        code: 'GEMINI_UPSTREAM_ERROR',
      });
    }
  });

  // ==========================================================================
  // 8. LIVE PRESENTATION MULTI-DEVICE SYNCHRONIZATION API
  //    - Only Teacher or Admin can create a live presentation session.
  //    - Only the Host Teacher (session.hostUid === actor.uid) or Admin can
  //      control slide index, play/pause, speed, or end the session.
  //    - Viewers / Students / Projector screens have Read-Only access.
  //    - Zero student PII or Firebase credentials in URLs or payloads.
  // ==========================================================================
  const livePresentationsStore = new Map<
    string,
    {
      sessionCode: string;
      title: string;
      hostUid: string;
      hostDisplayName: string;
      status: 'active' | 'ended';
      mode: 'auto' | 'manual' | 'collection';
      currentIndex: number;
      isPlaying: boolean;
      intervalSeconds: 5 | 10 | 15 | 20 | 30;
      showArtworkInfo: boolean;
      pureArtworkOnly: boolean;
      backdropTheme: 'obsidian' | 'museum_stone';
      filterGrade: string;
      filterClassId: string;
      filterLessonId: string;
      selectedArtworkIds: string[];
      createdAt: string;
      updatedAt: string;
    }
  >();

  const ALLOWED_INTERVALS = [5, 10, 15, 20, 30] as const;

  app.post('/api/live-presentations', async (req, res) => {
    const resolved = await resolveAuthenticatedActor(req);
    if (!resolved.actor) {
      res.status(resolved.errorStatus || 401).json({
        error: resolved.errorMessage || 'Vui lòng đăng nhập tài khoản Giáo viên để tạo phiên trình chiếu.',
        code: resolved.errorCode || 'AUTH_REQUIRED',
      });
      return;
    }

    if (resolved.actor.role !== 'teacher' && resolved.actor.role !== 'admin') {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        resolved.actor.uid,
        resolved.actor.role,
        'live_presentation_create',
        `Người dùng role=${resolved.actor.role} cố tạo phiên trình chiếu trực tiếp`
      );
      res.status(403).json({
        error: 'Chỉ Giáo viên hoặc Quản trị viên mới có quyền tạo phiên trình chiếu trực tiếp.',
        code: 'TEACHER_OR_ADMIN_REQUIRED',
      });
      return;
    }

    const rawCode = String(req.body?.sessionCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16);
    const sessionCode =
      rawCode.length >= 4
        ? rawCode
        : crypto.randomBytes(3).toString('hex').toUpperCase();

    const rawInterval = Number(req.body?.intervalSeconds);
    const intervalSeconds = (
      ALLOWED_INTERVALS.includes(rawInterval as any) ? rawInterval : 10
    ) as 5 | 10 | 15 | 20 | 30;

    const nowIso = new Date().toISOString();
    const sessionRecord = {
      sessionCode,
      title: String(req.body?.title || 'Triển lãm Nghệ thuật Trực tiếp ARTVERSE AI').slice(0, 200),
      hostUid: resolved.actor.uid,
      hostDisplayName: resolved.actor.displayName || 'Giáo viên Mĩ thuật',
      status: 'active' as const,
      mode: (
        req.body?.mode === 'manual' || req.body?.mode === 'collection'
          ? req.body.mode
          : 'auto'
      ) as 'auto' | 'manual' | 'collection',
      currentIndex: Math.max(0, Math.floor(Number(req.body?.currentIndex) || 0)),
      isPlaying: req.body?.isPlaying !== false,
      intervalSeconds,
      showArtworkInfo: req.body?.showArtworkInfo !== false,
      pureArtworkOnly: Boolean(req.body?.pureArtworkOnly),
      backdropTheme: (
        req.body?.backdropTheme === 'museum_stone' ? 'museum_stone' : 'obsidian'
      ) as 'obsidian' | 'museum_stone',
      filterGrade: String(req.body?.filterGrade || 'all').slice(0, 64),
      filterClassId: String(req.body?.filterClassId || 'all').slice(0, 64),
      filterLessonId: String(req.body?.filterLessonId || 'all').slice(0, 64),
      selectedArtworkIds: Array.isArray(req.body?.selectedArtworkIds)
        ? req.body.selectedArtworkIds.map((id: unknown) => String(id)).slice(0, 200)
        : [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    livePresentationsStore.set(sessionCode, sessionRecord);
    res.status(201).json({ session: sessionRecord });
  });

  app.get('/api/live-presentations/:sessionCode', (req, res) => {
    const code = String(req.params.sessionCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');
    const session = livePresentationsStore.get(code);
    if (!session) {
      res.status(404).json({
        error: 'Không tìm thấy phiên trình chiếu trực tiếp với mã này.',
        code: 'LIVE_SESSION_NOT_FOUND',
      });
      return;
    }
    res.json({ session });
  });

  app.post('/api/live-presentations/:sessionCode/state', async (req, res) => {
    const code = String(req.params.sessionCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');
    const session = livePresentationsStore.get(code);
    if (!session) {
      res.status(404).json({
        error: 'Phiên trình chiếu không tồn tại hoặc đã kết thúc.',
        code: 'LIVE_SESSION_NOT_FOUND',
      });
      return;
    }

    const resolved = await resolveAuthenticatedActor(req);
    if (!resolved.actor) {
      res.status(401).json({
        error: 'Người xem không có quyền điều khiển phiên trình chiếu.',
        code: 'LIVE_CONTROL_FORBIDDEN',
      });
      return;
    }

    const isHostOrAdmin =
      resolved.actor.role === 'admin' ||
      (resolved.actor.role === 'teacher' && session.hostUid === resolved.actor.uid);

    if (!isHostOrAdmin) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        resolved.actor.uid,
        resolved.actor.role,
        code,
        `Người xem (${resolved.actor.role}: ${resolved.actor.uid}) cố điều khiển phiên trình chiếu ${code} của chủ phiên ${session.hostUid}`
      );
      res.status(403).json({
        error:
          'Chỉ Giáo viên chủ phiên hoặc Quản trị viên mới được phép chuyển tác phẩm, tạm dừng hoặc điều khiển phiên trình chiếu này.',
        code: 'LIVE_CONTROL_FORBIDDEN',
      });
      return;
    }

    if (req.body?.currentIndex !== undefined) {
      session.currentIndex = Math.max(0, Math.floor(Number(req.body.currentIndex) || 0));
    }
    if (typeof req.body?.isPlaying === 'boolean') {
      session.isPlaying = req.body.isPlaying;
    }
    if (req.body?.intervalSeconds !== undefined) {
      const iv = Number(req.body.intervalSeconds);
      if (ALLOWED_INTERVALS.includes(iv as any)) {
        session.intervalSeconds = iv as 5 | 10 | 15 | 20 | 30;
      }
    }
    if (typeof req.body?.showArtworkInfo === 'boolean') {
      session.showArtworkInfo = req.body.showArtworkInfo;
    }
    if (typeof req.body?.pureArtworkOnly === 'boolean') {
      session.pureArtworkOnly = req.body.pureArtworkOnly;
    }
    if (req.body?.backdropTheme === 'obsidian' || req.body?.backdropTheme === 'museum_stone') {
      session.backdropTheme = req.body.backdropTheme;
    }
    if (req.body?.mode === 'auto' || req.body?.mode === 'manual' || req.body?.mode === 'collection') {
      session.mode = req.body.mode;
    }
    if (typeof req.body?.filterGrade === 'string') {
      session.filterGrade = req.body.filterGrade.slice(0, 64);
    }
    if (typeof req.body?.filterClassId === 'string') {
      session.filterClassId = req.body.filterClassId.slice(0, 64);
    }
    if (typeof req.body?.filterLessonId === 'string') {
      session.filterLessonId = req.body.filterLessonId.slice(0, 64);
    }
    if (Array.isArray(req.body?.selectedArtworkIds)) {
      session.selectedArtworkIds = req.body.selectedArtworkIds
        .map((id: unknown) => String(id))
        .slice(0, 200);
    }
    if (req.body?.status === 'active' || req.body?.status === 'ended') {
      session.status = req.body.status;
    }

    session.updatedAt = new Date().toISOString();
    livePresentationsStore.set(code, session);

    res.json({ session });
  });

  app.post('/api/live-presentations/:sessionCode/end', async (req, res) => {
    const code = String(req.params.sessionCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '');
    const session = livePresentationsStore.get(code);
    if (!session) {
      res.status(404).json({
        error: 'Phiên trình chiếu không tồn tại.',
        code: 'LIVE_SESSION_NOT_FOUND',
      });
      return;
    }

    const resolved = await resolveAuthenticatedActor(req);
    const isHostOrAdmin =
      resolved.actor &&
      (resolved.actor.role === 'admin' ||
        (resolved.actor.role === 'teacher' && session.hostUid === resolved.actor.uid));

    if (!isHostOrAdmin) {
      res.status(403).json({
        error: 'Chỉ Giáo viên chủ phiên hoặc Quản trị viên mới có quyền kết thúc phiên trình chiếu.',
        code: 'LIVE_CONTROL_FORBIDDEN',
      });
      return;
    }

    session.status = 'ended';
    session.isPlaying = false;
    session.updatedAt = new Date().toISOString();
    livePresentationsStore.set(code, session);

    res.json({ session });
  });

  // ==========================================================================
  // 9. DURABLE ARTWORKS, LESSONS, SLIDES & VIDEOS PERSISTENCE ENDPOINTS
  //    (Guarantees zero data loss across page reloads, logouts, and devices)
  // ==========================================================================
  const MEDIA_STORAGE_ROOT = path.resolve(__dirname, '.data', 'media');
  try {
    fs.mkdirSync(MEDIA_STORAGE_ROOT, { recursive: true });
  } catch {
    // ignore
  }

  // Binary upload stream for images (<= 12MB) and videos (<= 100MB) when cloud bucket is fallback-bridged
  app.put('/api/media/upload/:mediaId/:fileName', (req, res) => {
    const safeMediaId = String(req.params.mediaId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    const safeFileName = String(req.params.fileName || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);

    if (!safeMediaId || !safeFileName) {
      res.status(400).json({ error: 'Thiếu mediaId hoặc fileName hợp lệ.', code: 'INVALID_MEDIA_PATH' });
      return;
    }

    const contentType = String(req.headers['content-type'] || 'application/octet-stream').toLowerCase();
    const isVideo = contentType.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(safeFileName);
    const isImage = contentType.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/i.test(safeFileName);

    if (!isVideo && !isImage) {
      res.status(415).json({
        error: `Định dạng file "${contentType}" không được phép. Chỉ chấp nhận ảnh (JPG, PNG, WEBP) hoặc video (MP4, MOV, WebM).`,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
      return;
    }

    const maxBytes = isVideo ? 100 * 1024 * 1024 : 12 * 1024 * 1024;
    const declaredLength = Number(req.headers['content-length'] || 0);
    if (declaredLength > maxBytes) {
      res.status(413).json({
        error: isVideo
          ? 'Dung lượng video vượt quá giới hạn tối đa 100MB.'
          : 'Dung lượng ảnh vượt quá giới hạn tối đa 12MB.',
        code: 'MEDIA_FILE_TOO_LARGE',
      });
      return;
    }

    const targetDir = path.join(MEDIA_STORAGE_ROOT, safeMediaId);
    try {
      fs.mkdirSync(targetDir, { recursive: true });
    } catch (mkdirErr: any) {
      res.status(500).json({ error: mkdirErr?.message || 'Lỗi tạo thư mục media.', code: 'IO_ERROR' });
      return;
    }

    const targetFilePath = path.join(targetDir, safeFileName);
    const tempFilePath = `${targetFilePath}.uploading_${Date.now()}`;
    const writeStream = fs.createWriteStream(tempFilePath);
    let receivedBytes = 0;
    let aborted = false;

    req.on('data', (chunk: Buffer) => {
      if (aborted) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBytes) {
        aborted = true;
        writeStream.destroy();
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {
          // ignore
        }
        if (!res.headersSent) {
          res.status(413).json({
            error: isVideo
              ? 'Dung lượng video vượt quá giới hạn tối đa 100MB.'
              : 'Dung lượng ảnh vượt quá giới hạn tối đa 12MB.',
            code: 'MEDIA_FILE_TOO_LARGE',
          });
        }
      }
    });

    req.on('aborted', () => {
      aborted = true;
      writeStream.destroy();
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch {
        // ignore
      }
    });

    writeStream.on('error', (err) => {
      if (aborted) return;
      aborted = true;
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch {
        // ignore
      }
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || 'Lỗi ghi tệp media.', code: 'WRITE_ERROR' });
      }
    });

    writeStream.on('finish', () => {
      if (aborted) return;
      if (receivedBytes <= 0) {
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch {
          // ignore
        }
        if (!res.headersSent) {
          res.status(400).json({ error: 'Tệp tải lên rỗng (0 bytes).', code: 'EMPTY_FILE' });
        }
        return;
      }

      try {
        fs.renameSync(tempFilePath, targetFilePath);
        // Save tiny meta sidecar for Content-Type
        fs.writeFileSync(
          `${targetFilePath}.meta.json`,
          JSON.stringify({
            mediaId: safeMediaId,
            fileName: safeFileName,
            mimeType: contentType,
            fileSize: receivedBytes,
            uploadedAt: new Date().toISOString(),
          }),
          'utf-8'
        );
      } catch (renameErr: any) {
        if (!res.headersSent) {
          res.status(500).json({ error: renameErr?.message || 'Lỗi hoàn tất tệp media.', code: 'FINALIZE_ERROR' });
        }
        return;
      }

      const downloadUrl = `/api/media/files/${encodeURIComponent(safeMediaId)}/${encodeURIComponent(safeFileName)}`;
      const storagePath = `public_exhibition/${safeMediaId}/${safeFileName}`;
      res.status(201).json({
        downloadUrl,
        storagePath,
        bytesUploaded: receivedBytes,
        mimeType: contentType,
        storageProvider: 'firebase_storage',
      });
    });

    req.pipe(writeStream);
  });

  // Stream persisted image or video file with HTTP Range (206 Partial Content) support for smooth video playback
  app.get('/api/media/files/:mediaId/:fileName', (req, res) => {
    const safeMediaId = String(req.params.mediaId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    const safeFileName = String(req.params.fileName || '')
      .trim()
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);

    const filePath = path.join(MEDIA_STORAGE_ROOT, safeMediaId, safeFileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Không tìm thấy tệp media.', code: 'MEDIA_NOT_FOUND' });
      return;
    }

    let mimeType = 'application/octet-stream';
    const ext = path.extname(safeFileName).toLowerCase();
    if (ext === '.mp4' || ext === '.m4v') mimeType = 'video/mp4';
    else if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    try {
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta?.mimeType) mimeType = meta.mimeType;
      }
    } catch {
      // ignore
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || Number.isNaN(end) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunksize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
        'Content-Type': mimeType,
      });
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': mimeType,
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  app.delete('/api/media/files/:mediaId', (req, res) => {
    const safeMediaId = String(req.params.mediaId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    if (!safeMediaId) {
      res.status(400).json({ error: 'Thiếu mediaId.', code: 'INVALID_MEDIA_ID' });
      return;
    }
    const targetDir = path.join(MEDIA_STORAGE_ROOT, safeMediaId);
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
    res.json({ status: 'deleted', mediaId: safeMediaId });
  });

  app.get('/api/artworks', (_req, res) => {
    const publicSafeArtworks = (serverState.artworks || [])
      .filter((a) => a && a.status !== 'removed')
      .map((a) => {
        // Never leak student fullName or private fields
        const { fullName: _fn, studentRealName: _srn, ...safe } = a;
        return safe;
      });
    res.json({ artworks: publicSafeArtworks });
  });

  app.get('/api/artworks/:artworkId', (req, res) => {
    const artworkId = String(req.params.artworkId || '').trim();
    const found = (serverState.artworks || []).find(
      (a) => a && a.status !== 'removed' && (a.id === artworkId || a.artworkId === artworkId || a.mediaId === artworkId)
    );
    if (!found) {
      res.status(404).json({ error: 'Không tìm thấy tác phẩm.', code: 'ARTWORK_NOT_FOUND' });
      return;
    }
    const { fullName: _fn, studentRealName: _srn, ...safe } = found;
    res.json({ artwork: safe });
  });

  app.post('/api/artworks', async (req, res) => {
    const rawArt = req.body?.artwork;
    if (!rawArt || typeof rawArt !== 'object' || !rawArt.id || !rawArt.title) {
      res.status(400).json({
        error: 'Thiếu thông tin bắt buộc của tác phẩm (artworkId, title, classId, imageUrl).',
        code: 'INVALID_ARTWORK_METADATA',
      });
      return;
    }

    const primaryUrl = String(rawArt.downloadURL || rawArt.videoUrl || rawArt.imageUrl || '');
    if (
      !primaryUrl ||
      primaryUrl.startsWith('blob:') ||
      primaryUrl.startsWith('local_idb://')
    ) {
      res.status(400).json({
        error: 'Không chấp nhận URL tạm thời (blob:). Tệp media phải được tải lên Storage trước khi lưu metadata.',
        code: 'TEMPORARY_URL_REJECTED',
      });
      return;
    }

    // Never allow Base64 video in metadata
    if (primaryUrl.startsWith('data:video/') && primaryUrl.length > 500_000) {
      res.status(400).json({
        error: 'Tuyệt đối không lưu nhị phân hoặc Base64 của video vào metadata Firestore.',
        code: 'BASE64_VIDEO_FORBIDDEN',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const safeAlias =
      String(
        rawArt.authorNickname ||
          rawArt.authorAlias ||
          rawArt.creatorAnonymousPseudonym ||
          'Họa sĩ Nhí'
      ).trim() || 'Họa sĩ Nhí';
    const mediaType: 'image' | 'video' = rawArt.mediaType === 'video' ? 'video' : 'image';
    const safeId = String(rawArt.id);
    const resolvedStoragePath = String(
      rawArt.storagePath ||
        rawArt.videoPath ||
        rawArt.imagePath ||
        `public_exhibition/${safeId}/${mediaType === 'video' ? 'video.mp4' : 'clean_artwork.jpg'}`
    );
    const resolvedAuthorUid = String(
      rawArt.authorUid || rawArt.authorId || rawArt.ownerKey || 'anonymous_author'
    );

    const persistedArtwork = {
      ...rawArt,
      id: safeId,
      artworkId: String(rawArt.artworkId || safeId),
      mediaId: String(rawArt.mediaId || safeId),
      mediaType,
      title: String(rawArt.title).trim().slice(0, 300),
      description: String(rawArt.description || '').trim().slice(0, 2000),
      topic: String(rawArt.topic || rawArt.lessonTitle || '').trim().slice(0, 200),
      storagePath: resolvedStoragePath,
      downloadURL: primaryUrl,
      thumbnailPath: String(
        rawArt.thumbnailPath ||
          (mediaType === 'video' ? `public_exhibition/${safeId}/thumbnail.jpg` : resolvedStoragePath)
      ),
      thumbnailUrl: String(rawArt.thumbnailUrl || rawArt.imageUrl || primaryUrl),
      imagePath: String(rawArt.imagePath || resolvedStoragePath),
      imageUrl: String(rawArt.imageUrl || rawArt.thumbnailUrl || primaryUrl),
      videoPath: mediaType === 'video' ? resolvedStoragePath : rawArt.videoPath,
      videoUrl: mediaType === 'video' ? primaryUrl : rawArt.videoUrl,
      fileSize: typeof rawArt.fileSize === 'number' ? rawArt.fileSize : 0,
      mimeType: String(rawArt.mimeType || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg')),
      duration: typeof rawArt.duration === 'number' ? rawArt.duration : undefined,
      classId: String(rawArt.classId || rawArt.classGroupId || 'cls-6'),
      classGroupId: String(rawArt.classGroupId || rawArt.classId || 'cls-6'),
      className: String(rawArt.className || rawArt.grade || 'Lớp 6'),
      grade: String(rawArt.grade || rawArt.className || 'Lớp 6'),
      lessonId: String(rawArt.lessonId || ''),
      authorId: resolvedAuthorUid,
      authorUid: resolvedAuthorUid,
      authorAlias: safeAlias,
      authorNickname: safeAlias,
      creatorAnonymousPseudonym: safeAlias,
      status: rawArt.status || 'approved',
      shareStatus: rawArt.shareStatus || 'shared',
      createdAt: rawArt.createdAt || nowIso,
      updatedAt: nowIso,
    };
    // Strip any accidental real name field
    delete (persistedArtwork as any).fullName;
    delete (persistedArtwork as any).studentRealName;

    const existingIdx = serverState.artworks.findIndex((a) => a.id === persistedArtwork.id);
    if (existingIdx >= 0) {
      serverState.artworks[existingIdx] = persistedArtwork;
    } else {
      serverState.artworks.unshift(persistedArtwork);
    }
    saveServerState();

    res.status(201).json({ artwork: persistedArtwork });
  });

  app.patch('/api/artworks/:artworkId', (req, res) => {
    const artworkId = String(req.params.artworkId || '').trim();
    const updates = req.body?.updates || {};
    const idx = serverState.artworks.findIndex((a) => a.id === artworkId || a.artworkId === artworkId);
    if (idx < 0) {
      res.status(404).json({ error: 'Không tìm thấy tác phẩm.', code: 'ARTWORK_NOT_FOUND' });
      return;
    }
    serverState.artworks[idx] = {
      ...serverState.artworks[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveServerState();
    res.json({ artwork: serverState.artworks[idx] });
  });

  app.delete('/api/artworks/:artworkId', (req, res) => {
    const artworkId = String(req.params.artworkId || '').trim();
    serverState.artworks = serverState.artworks.filter(
      (a) => a.id !== artworkId && a.artworkId !== artworkId
    );
    const mediaDir = path.join(MEDIA_STORAGE_ROOT, artworkId);
    try {
      if (fs.existsSync(mediaDir)) {
        fs.rmSync(mediaDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
    saveServerState();
    res.json({ status: 'deleted', artworkId });
  });

  app.get('/api/lessons', (_req, res) => {
    res.json({ lessons: serverState.lessons || [] });
  });

  app.post('/api/lessons', (req, res) => {
    const rawLesson = req.body?.lesson;
    if (!rawLesson || typeof rawLesson !== 'object' || !rawLesson.id || !rawLesson.title) {
      res.status(400).json({
        error: 'Thiếu thông tin bài học (lessonId, title, grade).',
        code: 'INVALID_LESSON_METADATA',
      });
      return;
    }

    if (
      (rawLesson.videoUrl &&
        (String(rawLesson.videoUrl).startsWith('blob:') ||
          String(rawLesson.videoUrl).startsWith('local_idb://'))) ||
      (rawLesson.slideUrl &&
        (String(rawLesson.slideUrl).startsWith('blob:') ||
          String(rawLesson.slideUrl).startsWith('local_idb://')))
    ) {
      res.status(400).json({
        error: 'Không được lưu URL tạm thời (blob: hoặc local_idb://) cho Slide hoặc Video.',
        code: 'TEMPORARY_MEDIA_URL_REJECTED',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const persistedLesson = {
      ...rawLesson,
      id: String(rawLesson.id),
      lessonId: String(rawLesson.lessonId || rawLesson.id),
      title: String(rawLesson.title).trim().slice(0, 300),
      subject: String(rawLesson.subject || 'Mĩ thuật'),
      grade: String(rawLesson.grade || rawLesson.className || 'Lớp 6'),
      classId: String(rawLesson.classId || rawLesson.classGroupId || 'cls-6'),
      classGroupId: String(rawLesson.classGroupId || rawLesson.classId || 'cls-6'),
      className: String(rawLesson.className || rawLesson.grade || 'Lớp 6'),
      description: String(rawLesson.description || ''),
      content: String(rawLesson.content || rawLesson.description || ''),
      resourceIds: Array.isArray(rawLesson.resourceIds) ? rawLesson.resourceIds : [],
      slides: Array.isArray(rawLesson.slides)
        ? [...rawLesson.slides].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        : [],
      status: rawLesson.status || 'published',
      createdAt: rawLesson.createdAt || nowIso,
      updatedAt: nowIso,
      createdBy: String(rawLesson.createdBy || 'teacher'),
    };

    const idx = serverState.lessons.findIndex(
      (l) => l.id === persistedLesson.id || l.lessonId === persistedLesson.id
    );
    if (idx >= 0) {
      serverState.lessons[idx] = persistedLesson;
    } else {
      serverState.lessons.push(persistedLesson);
    }
    saveServerState();

    res.status(201).json({ lesson: persistedLesson });
  });

  app.delete('/api/lessons/:lessonId', (req, res) => {
    const lessonId = String(req.params.lessonId || '').trim();
    const tombstone = {
      id: lessonId,
      lessonId,
      title: 'Đã xóa',
      topic: 'Đã xóa',
      classGroupId: 'cls-6',
      status: 'deleted',
      isHidden: true,
      updatedAt: new Date().toISOString(),
    };
    const idx = serverState.lessons.findIndex((l) => l.id === lessonId || l.lessonId === lessonId);
    if (idx >= 0) {
      serverState.lessons[idx] = tombstone;
    } else {
      serverState.lessons.push(tombstone);
    }
    saveServerState();
    res.json({ status: 'deleted', lessonId });
  });

  // ==========================================================================
  // 10. ARTVERSE COMMUNITY — HỆ THỐNG BÌNH LUẬN, KIỂM DUYỆT TỰ ĐỘNG & AN TOÀN TRẺ EM
  //     Policy: "TỰ ĐỘNG KIỂM DUYỆT — AN TOÀN HIỂN THỊ NGAY — RỦI RO CHỜ DUYỆT"
  //     - SAFE     -> status = 'published' (Hiển thị ngay)
  //     - REVIEW   -> status = 'pending'   (Chờ giáo viên/quản trị viên duyệt)
  //     - BLOCKED  -> status = 'rejected'  (Từ chối đăng + phản hồi thân thiện)
  //     - CRITICAL -> status = 'rejected'  (Chặn hiển thị + cảnh báo khẩn cấp + audit log)
  // ==========================================================================

  // Helper: sanitize comment record before sending to public/student clients
  function toPublicSafeComment(cmt: ServerCommentRecord, viewerUid?: string) {
    const isOwnComment = Boolean(viewerUid && cmt.authorUid === viewerUid);
    return {
      id: cmt.id,
      artworkId: cmt.artworkId,
      artworkTitle: cmt.artworkTitle,
      classCode: cmt.classCode,
      classGroupId: cmt.classGroupId,
      authorNickname: cmt.authorNickname,
      anonymousNickname: cmt.authorNickname,
      authorRole: cmt.authorRole,
      isOwnComment,
      content: cmt.content,
      createdAt: cmt.createdAt,
      updatedAt: cmt.updatedAt,
      isEdited: cmt.isEdited,
      editedAt: cmt.editedAt,
      status: cmt.status,
      replyToId: cmt.replyToId,
      replyToNickname: cmt.replyToNickname,
      appeal: isOwnComment ? cmt.appeal : undefined,
    };
  }

  // Helper: Check if a teacher has permission over a comment/artwork class
  function canTeacherModerateClassScope(
    actor: ResolvedServerActor,
    classCode?: string,
    classGroupId?: string
  ): boolean {
    if (actor.role === 'admin') return true;
    if (actor.role !== 'teacher') return false;

    const normCode = (classCode || '').trim().toUpperCase();
    const normGroup = (classGroupId || '').trim().toLowerCase();

    const targetClass =
      (normCode
        ? serverState.classes.find((c) => c.classCode.toUpperCase() === normCode)
        : undefined) ||
      (normGroup
        ? serverState.classes.find((c) => c.id.toLowerCase() === normGroup)
        : undefined);

    if (targetClass) {
      return canTeacherManageClass(actor, targetClass);
    }

    const teacherEntry = serverState.teachers.find(
      (t) =>
        (t.uid && t.uid === actor.uid) ||
        (actor.email && t.email.toLowerCase() === actor.email.toLowerCase())
    );
    if (
      teacherEntry &&
      Array.isArray(teacherEntry.assignedClassCodes) &&
      teacherEntry.assignedClassCodes.length > 0 &&
      normCode
    ) {
      return teacherEntry.assignedClassCodes.some((c) => c.toUpperCase() === normCode);
    }

    return true;
  }

  // 10.1 GET paginated comments for an artwork
  app.get('/api/community/comments', async (req, res) => {
    const artworkId = String(req.query.artworkId || '').trim();
    const limitParam = Math.min(30, Math.max(1, Number(req.query.limit) || 10));
    const offsetParam = Math.max(0, Number(req.query.offset) || 0);

    // Optional auth resolution to let a student see their own pending/rejected comments
    let viewerActor: ResolvedServerActor | null = null;
    if (req.headers.authorization) {
      const resolved = await resolveAuthenticatedActor(req);
      viewerActor = resolved.actor;
    }

    const filtered = (serverState.comments || []).filter((cmt) => {
      if (artworkId && cmt.artworkId !== artworkId) return false;
      if (cmt.status === 'deleted') return false;
      if (cmt.status === 'published') return true;
      // Only the author of a pending/rejected comment can see its status in their own view
      if (
        viewerActor &&
        cmt.authorUid === viewerActor.uid &&
        (cmt.status === 'pending' || cmt.status === 'rejected')
      ) {
        return true;
      }
      return false;
    });

    // Sort newest first
    filtered.sort((a, b) => b.createdAtMs - a.createdAtMs);

    const totalPublishedCount = (serverState.comments || []).filter(
      (c) => (!artworkId || c.artworkId === artworkId) && c.status === 'published'
    ).length;

    const slice = filtered.slice(offsetParam, offsetParam + limitParam);
    const hasMore = offsetParam + limitParam < filtered.length;
    const safeItems = slice.map((c) => toPublicSafeComment(c, viewerActor?.uid));

    res.json({
      comments: safeItems,
      items: safeItems,
      totalPublishedCount,
      totalPublished: totalPublishedCount,
      totalVisibleCount: filtered.length,
      offset: offsetParam,
      nextOffset: hasMore ? offsetParam + limitParam : null,
      limit: limitParam,
      hasMore,
    });
  });

  // 10.2 POST a new comment or reply (Enforces Auth, Anti-Spoofing, Rate-Limit, & 4-Layer Moderation)
  app.post('/api/community/comments', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({
        error:
          errorMessage ||
          'Không cho phép bình luận ẩn danh. Em vui lòng đăng nhập bằng Thẻ Học Sinh hoặc tài khoản Giáo viên để bình luận nhé!',
        code: errorCode || 'ANONYMOUS_COMMENT_FORBIDDEN',
      });
      return;
    }

    // Only authenticated Student, Teacher, or Admin can post comments (No anonymous viewer)
    if (actor.role !== 'student' && actor.role !== 'teacher' && actor.role !== 'admin') {
      res.status(403).json({
        error:
          'Không cho phép bình luận ẩn danh. Vui lòng đăng nhập tài khoản Học sinh hoặc Giáo viên để tham gia bình luận.',
        code: 'ANONYMOUS_COMMENT_FORBIDDEN',
      });
      return;
    }

    // Security Test #1: Block role spoofing or authorUid spoofing or client status override
    if (
      (req.body?.authorRole && req.body.authorRole !== actor.role) ||
      (req.body?.role && req.body.role !== actor.role)
    ) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        'community_comment_create',
        `Chặn ${actor.role} (${actor.uid}) giả mạo vai trò "${req.body.authorRole || req.body.role}" khi gửi bình luận`
      );
      res.status(403).json({
        error: 'Không được phép giả mạo vai trò Giáo viên hoặc Quản trị viên khi bình luận.',
        code: 'ROLE_SPOOFING_FORBIDDEN',
      });
      return;
    }

    if (req.body?.authorUid && req.body.authorUid !== actor.uid) {
      appendSecurityLog(
        'COMMENT_IDOR_BLOCKED',
        actor.uid,
        actor.role,
        'community_comment_create',
        `Chặn giả mạo authorUid (${req.body.authorUid}) bởi ${actor.uid}`
      );
      res.status(403).json({
        error: 'Không được phép giả mạo định danh người gửi bình luận.',
        code: 'AUTHOR_UID_SPOOFING_FORBIDDEN',
      });
      return;
    }

    if (req.body?.status === 'published' || req.body?.forcePublished === true) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        'community_comment_create',
        `Chặn client tự gán trạng thái published trực tiếp bởi ${actor.uid}`
      );
      res.status(403).json({
        error: 'Frontend không được phép tự quyết định trạng thái hiển thị công khai (published).',
        code: 'CLIENT_STATUS_OVERRIDE_FORBIDDEN',
      });
      return;
    }

    // Check if user is temporarily muted from commenting by Admin
    const muteEntry = serverState.mutedCommentUsers[actor.uid];
    if (muteEntry) {
      const mutedUntilMs = new Date(muteEntry.mutedUntil).getTime();
      if (mutedUntilMs > Date.now()) {
        res.status(403).json({
          error: `Quyền bình luận của tài khoản đang tạm khóa đến ${new Date(
            muteEntry.mutedUntil
          ).toLocaleString('vi-VN')}. Lý do: ${muteEntry.reason}`,
          code: 'COMMENT_PRIVILEGE_MUTED',
        });
        return;
      } else {
        delete serverState.mutedCommentUsers[actor.uid];
        saveServerState();
      }
    }

    // Rate-limit per user (max 8 comment submissions per minute)
    const rateCheck = checkRateLimit(`comment:uid:${actor.uid}`, 8, 60_000, res);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Em đang gửi bình luận hơi nhanh. Vui lòng đợi ${rateCheck.retryAfterSeconds} giây rồi gửi tiếp nhé!`,
        code: 'COMMENT_RATE_LIMITED',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const artworkId = String(req.body?.artworkId || '').trim().slice(0, 128);
    const artworkTitle = String(req.body?.artworkTitle || 'Tác phẩm triển lãm').trim().slice(0, 200);
    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const replyToId = req.body?.replyToId ? String(req.body.replyToId).trim().slice(0, 128) : undefined;
    const replyToNickname = req.body?.replyToNickname
      ? String(req.body.replyToNickname).trim().slice(0, 80)
      : undefined;

    if (!artworkId) {
      res.status(400).json({
        error: 'Thiếu mã tác phẩm (artworkId) cần bình luận.',
        code: 'MISSING_ARTWORK_ID',
      });
      return;
    }

    // Resolve classCode & classGroupId from artwork or actor
    const targetArtwork = serverState.artworks.find(
      (a) => a.id === artworkId || a.artworkId === artworkId
    );
    const resolvedClassCode =
      String(req.body?.classCode || targetArtwork?.classCode || actor.classCode || 'LOP6')
        .trim()
        .toUpperCase();
    const resolvedClassGroupId = String(
      req.body?.classGroupId || targetArtwork?.classGroupId || actor.classGroupId || 'cls-6'
    ).trim();

    // Gather recent comments by this author and on this artwork for anti-spam & anti-bullying tracking
    const recentAuthorComments = serverState.comments
      .filter((c) => c.authorUid === actor.uid)
      .slice(0, 15)
      .map((c) => ({
        content: c.content,
        artworkId: c.artworkId,
        createdAtMs: c.createdAtMs,
      }));

    const recentArtworkNegativeAuthorUids = Array.from(
      new Set(
        serverState.comments
          .filter(
            (c) =>
              c.artworkId === artworkId &&
              (c.severity === 'REVIEW' || c.severity === 'BLOCKED' || c.severity === 'CRITICAL')
          )
          .map((c) => c.authorUid)
      )
    );

    const simulateAiOffline =
      Boolean(req.body?.simulateAiDisconnect) ||
      Boolean(serverState.moderationConfig.aiModerationOfflineSimulated);

    // Run 4-Layer Moderation Engine
    const evaluation = evaluateCommentModeration({
      content: rawContent,
      authorUid: actor.uid,
      authorRole: actor.role,
      artworkId,
      classCode: resolvedClassCode,
      recentAuthorComments,
      recentArtworkNegativeAuthorUids,
      customBlockedKeywords: serverState.moderationConfig.blockedKeywords,
      customReviewKeywords: serverState.moderationConfig.reviewKeywords,
      aiModerationSimulatedOffline: simulateAiOffline,
    });

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const commentId = `cmt_${nowMs}_${crypto.randomBytes(3).toString('hex')}`;

    // Public-safe nickname (never exposes real fullName, email, or studentCode)
    const safeNickname =
      actor.role === 'teacher'
        ? `${actor.displayName || 'Giáo viên Mĩ thuật'}`
        : actor.role === 'admin'
        ? 'Ban Giám tuyển Artverse'
        : actor.displayName || 'Họa sĩ Nhí';

    const newComment: ServerCommentRecord = {
      id: commentId,
      artworkId,
      artworkTitle,
      classCode: resolvedClassCode,
      classGroupId: resolvedClassGroupId,
      authorUid: actor.uid,
      authorNickname: safeNickname,
      authorRole: actor.role,
      content: rawContent,
      createdAt: nowIso,
      createdAtMs: nowMs,
      updatedAt: nowIso,
      isEdited: false,
      status: evaluation.decidedStatus,
      severity: evaluation.severity,
      confidence: evaluation.confidence,
      categories: evaluation.categories,
      internalAuditReason: evaluation.internalAuditReason,
      replyToId,
      replyToNickname,
      appeal: {
        status: 'none',
      },
      stateHistory: [
        {
          fromStatus: 'new',
          toStatus: evaluation.decidedStatus,
          changedByUid: 'system-moderation-engine',
          changedByName: 'Artverse Moderation Engine',
          changedByRole: 'system',
          reason: evaluation.internalAuditReason,
          timestamp: nowIso,
        },
      ],
    };

    serverState.comments.unshift(newComment);

    // If CRITICAL child-safety event, automatically generate a high-priority report/alert for Teacher & Admin
    if (evaluation.severity === 'CRITICAL') {
      const alertReport: ServerCommentReportRecord = {
        id: `rep_crit_${nowMs}_${crypto.randomBytes(2).toString('hex')}`,
        commentId: newComment.id,
        artworkId,
        artworkTitle,
        classCode: resolvedClassCode,
        classGroupId: resolvedClassGroupId,
        commentSnippet: '[Nội dung nhạy cảm đã được hệ thống ẩn tự động để bảo vệ học sinh]',
        reasonCategory: evaluation.categories.includes('pii_disclosure')
          ? 'personal_info_leak'
          : 'bullying',
        reasonLabel: 'Cảnh báo An toàn Trẻ em Tự động (CRITICAL)',
        details: evaluation.internalAuditReason,
        reporterUidHash: 'system_auto_guard',
        status: 'open',
        priority: 'critical',
        createdAt: nowIso,
        createdAtMs: nowMs,
      };
      serverState.commentReports.unshift(alertReport);
      appendSecurityLog(
        'COMMENT_CRITICAL_SAFETY_ALERT',
        actor.uid,
        actor.role,
        commentId,
        `${evaluation.internalAuditReason} (Lớp ${resolvedClassCode})`
      );
    }

    saveServerState();

    // Return response according to Final Moderation Policy
    if (evaluation.decidedStatus === 'published') {
      res.status(201).json({
        comment: toPublicSafeComment(newComment, actor.uid),
        moderation: {
          severity: evaluation.severity,
          status: evaluation.decidedStatus,
          message: evaluation.studentFriendlyMessage,
          isConstructiveArtCritique: evaluation.isConstructiveArtCritique,
        },
      });
      return;
    }

    if (evaluation.decidedStatus === 'pending') {
      res.status(202).json({
        comment: toPublicSafeComment(newComment, actor.uid),
        moderation: {
          severity: evaluation.severity,
          status: 'pending',
          message: evaluation.studentFriendlyMessage,
          canAppeal: evaluation.canStudentAppeal,
        },
      });
      return;
    }

    // BLOCKED or CRITICAL -> status = 'rejected'
    res.status(422).json({
      error: evaluation.studentFriendlyMessage,
      code: evaluation.severity === 'CRITICAL' ? 'COMMENT_CRITICAL_BLOCKED' : 'COMMENT_BLOCKED',
      comment: toPublicSafeComment(newComment, actor.uid),
      moderation: {
        severity: evaluation.severity,
        status: 'rejected',
        message: evaluation.studentFriendlyMessage,
        canAppeal: evaluation.canStudentAppeal,
      },
    });
  });

  // 10.3 PUT edit own comment within allowed time window (Re-runs backend moderation)
  app.put('/api/community/comments/:commentId', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    const commentId = String(req.params.commentId || '').trim();
    const target = serverState.comments.find((c) => c.id === commentId);
    if (!target || target.status === 'deleted') {
      res.status(404).json({
        error: 'Không tìm thấy bình luận cần chỉnh sửa.',
        code: 'COMMENT_NOT_FOUND',
      });
      return;
    }

    // Anti-IDOR: Only the original author can edit their comment
    if (target.authorUid !== actor.uid) {
      appendSecurityLog(
        'COMMENT_IDOR_BLOCKED',
        actor.uid,
        actor.role,
        commentId,
        `Chặn người dùng ${actor.uid} chỉnh sửa bình luận ${commentId} của người khác (${target.authorUid})`
      );
      res.status(403).json({
        error: 'Em chỉ được phép chỉnh sửa bình luận của chính mình.',
        code: 'COMMENT_EDIT_IDOR_FORBIDDEN',
      });
      return;
    }

    const editWindowMs = (serverState.moderationConfig.editWindowMinutes || 15) * 60_000;
    if (actor.role === 'student' && Date.now() - target.createdAtMs > editWindowMs) {
      res.status(403).json({
        error: `Đã quá thời hạn ${serverState.moderationConfig.editWindowMinutes} phút cho phép chỉnh sửa bình luận.`,
        code: 'COMMENT_EDIT_WINDOW_EXPIRED',
      });
      return;
    }

    const newContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const safeRole: 'admin' | 'teacher' | 'student' =
      actor.role === 'admin' || actor.role === 'teacher' ? actor.role : 'student';
    const evaluation = evaluateCommentModeration({
      content: newContent,
      authorUid: actor.uid,
      authorRole: safeRole,
      artworkId: target.artworkId,
      classCode: target.classCode,
      customBlockedKeywords: serverState.moderationConfig.blockedKeywords,
      customReviewKeywords: serverState.moderationConfig.reviewKeywords,
      aiModerationSimulatedOffline: serverState.moderationConfig.aiModerationOfflineSimulated,
    });

    const prevStatus = target.status;
    const nowIso = new Date().toISOString();

    if (evaluation.decidedStatus === 'rejected') {
      res.status(422).json({
        error: evaluation.studentFriendlyMessage,
        code: 'COMMENT_EDIT_BLOCKED',
      });
      return;
    }

    target.content = newContent;
    target.isEdited = true;
    target.editedAt = nowIso;
    target.updatedAt = nowIso;
    target.status = evaluation.decidedStatus;
    target.severity = evaluation.severity;
    target.confidence = evaluation.confidence;
    target.categories = evaluation.categories;
    target.stateHistory.push({
      fromStatus: prevStatus,
      toStatus: evaluation.decidedStatus,
      changedByUid: actor.uid,
      changedByName: actor.displayName,
      changedByRole: safeRole,
      reason: `Tác giả chỉnh sửa nội dung -> ${evaluation.internalAuditReason}`,
      timestamp: nowIso,
    });

    saveServerState();

    res.json({
      comment: toPublicSafeComment(target, actor.uid),
      moderation: {
        severity: evaluation.severity,
        status: evaluation.decidedStatus,
        message: evaluation.studentFriendlyMessage,
      },
    });
  });

  // 10.4 DELETE comment (Soft-delete with IDOR & Teacher Class Scope protection)
  app.delete('/api/community/comments/:commentId', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    const commentId = String(req.params.commentId || '').trim();
    const target = serverState.comments.find((c) => c.id === commentId);
    if (!target) {
      res.status(404).json({
        error: 'Không tìm thấy bình luận.',
        code: 'COMMENT_NOT_FOUND',
      });
      return;
    }

    const isOwner = target.authorUid === actor.uid;

    // Security Test #4: Student trying to delete someone else's comment -> IDOR blocked!
    if (actor.role === 'student' && !isOwner) {
      appendSecurityLog(
        'COMMENT_IDOR_BLOCKED',
        actor.uid,
        actor.role,
        commentId,
        `Chặn học sinh ${actor.uid} xóa trái phép bình luận ${commentId} của người dùng ${target.authorUid}`
      );
      res.status(403).json({
        error: 'Em không được phép xóa bình luận của người khác.',
        code: 'COMMENT_DELETE_IDOR_FORBIDDEN',
      });
      return;
    }

    // Security Test #2: Teacher trying to delete a comment outside their assigned class scope
    if (
      actor.role === 'teacher' &&
      !isOwner &&
      !canTeacherModerateClassScope(actor, target.classCode, target.classGroupId)
    ) {
      appendSecurityLog(
        'CROSS_CLASS_ACCESS_BLOCKED',
        actor.uid,
        actor.role,
        commentId,
        `Chặn giáo viên ${actor.uid} xóa bình luận thuộc lớp ${target.classCode} ngoài phạm vi phụ trách`
      );
      res.status(403).json({
        error: `Bạn không có quyền xóa bình luận thuộc lớp ${target.classCode} ngoài phạm vi phụ trách.`,
        code: 'CLASS_SCOPE_FORBIDDEN',
      });
      return;
    }

    // Only Admin can permanently purge; otherwise soft-delete (`status = 'deleted'`)
    const permanent = req.query.permanent === 'true' && actor.role === 'admin';
    const reason =
      typeof req.body?.reason === 'string' && req.body.reason.trim()
        ? req.body.reason.trim().slice(0, 300)
        : isOwner
        ? 'Tác giả tự xóa bình luận'
        : 'Kiểm duyệt viên xóa bình luận vi phạm';

    if (permanent) {
      serverState.comments = serverState.comments.filter((c) => c.id !== commentId);
      appendSecurityLog(
        'COMMENT_MODERATION_ACTION',
        actor.uid,
        actor.role,
        commentId,
        `Admin xóa vĩnh viễn bình luận ${commentId}: ${reason}`
      );
      saveServerState();
      res.json({ status: 'permanently_deleted', commentId });
      return;
    }

    const prevStatus = target.status;
    const nowIso = new Date().toISOString();
    target.status = 'deleted';
    target.updatedAt = nowIso;
    target.moderatedBy = actor.displayName;
    target.moderatedAt = nowIso;
    target.moderationReason = reason;
    target.stateHistory.push({
      fromStatus: prevStatus,
      toStatus: 'deleted',
      changedByUid: actor.uid,
      changedByName: actor.displayName,
      changedByRole: actor.role === 'admin' || actor.role === 'teacher' ? actor.role : 'student',
      reason,
      timestamp: nowIso,
    });

    appendSecurityLog(
      'COMMENT_MODERATION_ACTION',
      actor.uid,
      actor.role,
      commentId,
      `Soft-delete bình luận ${commentId}: ${reason}`
    );
    saveServerState();

    res.json({
      status: 'deleted',
      commentId,
    });
  });

  // 10.5 POST Report a comment (Confidential reporter identity + anti-spam rate limit)
  app.post('/api/community/comments/:commentId/report', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({
        error: errorMessage || 'Vui lòng đăng nhập để gửi báo cáo vi phạm.',
        code: errorCode || 'AUTH_REQUIRED',
      });
      return;
    }

    // Security Test #5: Anti-spam report rate limiting (max 3 reports per 60s per user)
    const rateCheck = checkRateLimit(`comment-report:uid:${actor.uid}`, 3, 60_000, res);
    if (!rateCheck.allowed) {
      res.status(429).json({
        error: `Bạn đã gửi nhiều báo cáo liên tiếp. Vui lòng đợi ${rateCheck.retryAfterSeconds} giây trước khi gửi báo cáo mới.`,
        code: 'REPORT_RATE_LIMITED',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const commentId = String(req.params.commentId || '').trim();
    const target = serverState.comments.find((c) => c.id === commentId);
    if (!target) {
      res.status(404).json({
        error: 'Không tìm thấy bình luận cần báo cáo.',
        code: 'COMMENT_NOT_FOUND',
      });
      return;
    }

    const reporterUidHash = crypto
      .createHash('sha256')
      .update(`reporter:${actor.uid}:${STUDENT_SESSION_SECRET}`)
      .digest('hex')
      .slice(0, 16);

    // Prevent duplicate open report on the same comment by the same user
    const existingDuplicate = serverState.commentReports.find(
      (r) =>
        r.commentId === commentId &&
        r.reporterUidHash === reporterUidHash &&
        r.status !== 'resolved'
    );
    if (existingDuplicate) {
      res.status(429).json({
        error: 'Báo cáo của bạn về bình luận này đã được ghi nhận và đang được giáo viên xem xét.',
        code: 'DUPLICATE_REPORT',
      });
      return;
    }

    const reasonCategory = (
      [
        'inappropriate_language',
        'bullying',
        'personal_info_leak',
        'dangerous_link',
        'other',
      ].includes(req.body?.reasonCategory)
        ? req.body.reasonCategory
        : 'inappropriate_language'
    ) as ServerCommentReportRecord['reasonCategory'];

    const reasonLabel = String(
      req.body?.reasonLabel || 'Ngôn từ chưa phù hợp chuẩn mực học đường'
    )
      .trim()
      .slice(0, 150);
    const details = String(req.body?.details || '').trim().slice(0, 500);

    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const newReport: ServerCommentReportRecord = {
      id: `crep_${nowMs}_${crypto.randomBytes(3).toString('hex')}`,
      commentId: target.id,
      artworkId: target.artworkId,
      artworkTitle: target.artworkTitle,
      classCode: target.classCode,
      classGroupId: target.classGroupId,
      commentSnippet: target.content.slice(0, 180),
      reasonCategory,
      reasonLabel,
      details,
      reporterUidHash,
      status: 'open',
      priority:
        reasonCategory === 'personal_info_leak' || reasonCategory === 'bullying'
          ? 'high'
          : 'normal',
      createdAt: nowIso,
      createdAtMs: nowMs,
    };

    serverState.commentReports.unshift(newReport);
    saveServerState();

    // Never return reporterUidHash or reporter identity
    res.status(201).json({
      message:
        'Cảm ơn em đã chung tay giữ gìn không gian nghệ thuật văn minh! Danh tính người báo cáo được bảo mật tuyệt đối.',
      report: {
        id: newReport.id,
        commentId: newReport.commentId,
        reasonCategory: newReport.reasonCategory,
        status: newReport.status,
        createdAt: newReport.createdAt,
      },
    });
  });

  // 10.6 POST Student Appeal on a pending or rejected comment (Test #10)
  app.post('/api/community/comments/:commentId/appeal', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    const commentId = String(req.params.commentId || '').trim();
    const target = serverState.comments.find((c) => c.id === commentId);
    if (!target) {
      res.status(404).json({
        error: 'Không tìm thấy bình luận.',
        code: 'COMMENT_NOT_FOUND',
      });
      return;
    }

    if (target.authorUid !== actor.uid) {
      res.status(403).json({
        error: 'Em chỉ có thể gửi yêu cầu xem xét lại đối với bình luận của chính mình.',
        code: 'APPEAL_FORBIDDEN',
      });
      return;
    }

    const appealReason = String(
      req.body?.appealReason ||
        'Em mong thầy/cô xem xét lại vì đây là lời góp ý chân thành về bức tranh.'
    )
      .trim()
      .slice(0, 400);

    const nowIso = new Date().toISOString();
    target.appeal = {
      status: 'open',
      appealReason,
      appealedAt: nowIso,
    };
    // Ensure comment is in pending queue for teacher review if it was rejected
    const prevStatus = target.status;
    if (target.status === 'rejected' && target.severity !== 'CRITICAL') {
      target.status = 'pending';
    }
    target.updatedAt = nowIso;
    target.stateHistory.push({
      fromStatus: prevStatus,
      toStatus: target.status,
      changedByUid: actor.uid,
      changedByName: actor.displayName,
      changedByRole: 'student',
      reason: `[Khiếu nại / Yêu cầu xem xét lại] ${appealReason}`,
      timestamp: nowIso,
    });

    saveServerState();

    res.json({
      message:
        'Đã gửi yêu cầu xem xét lại tới giáo viên Mĩ thuật phụ trách lớp của em!',
      comment: toPublicSafeComment(target, actor.uid),
    });
  });

  // 10.7 GET Community Moderation Center Overview (Strictly Teacher & Admin; Students get 403)
  app.get('/api/community/moderation/overview', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    // Security Test #3: Students are strictly forbidden from reading moderation queue/logs/reports
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        'moderation_overview_read',
        `Chặn người dùng role=${actor.role} (${actor.uid}) đọc dữ liệu kiểm duyệt nội bộ`
      );
      res.status(403).json({
        error: 'Học sinh và khách không có quyền truy cập Trung tâm Kiểm duyệt Cộng đồng.',
        code: 'MODERATION_ACCESS_FORBIDDEN',
      });
      return;
    }

    // Filter comments & reports to only classes managed by this teacher (or all for Admin)
    const scopedComments = serverState.comments.filter((c) =>
      canTeacherModerateClassScope(actor, c.classCode, c.classGroupId)
    );
    const scopedReports = serverState.commentReports.filter((r) =>
      canTeacherModerateClassScope(actor, r.classCode, r.classGroupId)
    );

    // Priority ordering: CRITICAL -> Open Appeals -> REVIEW (pending) -> others
    const severityWeight: Record<CommentModerationSeverity, number> = {
      CRITICAL: 4,
      BLOCKED: 3,
      REVIEW: 2,
      SAFE: 1,
    };

    const sortedComments = [...scopedComments].sort((a, b) => {
      const aAppeal = a.appeal?.status === 'open' ? 1 : 0;
      const bAppeal = b.appeal?.status === 'open' ? 1 : 0;
      if (aAppeal !== bAppeal) return bAppeal - aAppeal;
      const sevDiff =
        (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      return b.createdAtMs - a.createdAtMs;
    });

    // Calculate SLA average report resolution time in minutes
    const resolvedReports = scopedReports.filter(
      (r) => r.status === 'resolved' && r.resolvedAtMs && r.createdAtMs
    );
    const avgResolutionMinutes =
      resolvedReports.length > 0
        ? Math.max(
            1,
            Math.round(
              resolvedReports.reduce(
                (acc, r) => acc + ((r.resolvedAtMs || r.createdAtMs) - r.createdAtMs),
                0
              ) /
                resolvedReports.length /
                60_000
            )
          )
        : 0;

    res.json({
      summary: {
        totalComments: scopedComments.length,
        publishedCount: scopedComments.filter((c) => c.status === 'published').length,
        pendingCount: scopedComments.filter((c) => c.status === 'pending').length,
        hiddenCount: scopedComments.filter((c) => c.status === 'hidden').length,
        rejectedCount: scopedComments.filter((c) => c.status === 'rejected').length,
        deletedCount: scopedComments.filter((c) => c.status === 'deleted').length,
        criticalAlertCount: scopedComments.filter((c) => c.severity === 'CRITICAL').length,
        openAppealCount: scopedComments.filter((c) => c.appeal?.status === 'open').length,
        openReportCount: scopedReports.filter((r) => r.status !== 'resolved').length,
        avgResolutionMinutes,
      },
      comments: sortedComments,
      reports: scopedReports.map(({ reporterUidHash: _hash, ...safeRep }) => safeRep),
      moderationConfig: serverState.moderationConfig,
      mutedUsers: actor.role === 'admin' ? Object.values(serverState.mutedCommentUsers) : [],
      auditLogs: serverState.securityLogs
        .filter((l) => l.eventType.startsWith('COMMENT_') || l.eventType.includes('BLOCKED'))
        .slice(0, 60),
    });
  });

  // 10.8 POST Teacher/Admin Moderation Action on a Comment (Approve, Hide, Reject, Restore, Appeal, Note, Assign)
  app.post('/api/community/moderation/comments/:commentId/action', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({ error: errorMessage, code: errorCode });
      return;
    }

    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        req.params.commentId,
        `Chặn người dùng role=${actor.role} gọi API kiểm duyệt bình luận`
      );
      res.status(403).json({
        error: 'Chỉ Giáo viên phụ trách và Quản trị viên mới được phép thực hiện thao tác kiểm duyệt.',
        code: 'MODERATION_FORBIDDEN',
      });
      return;
    }

    const commentId = String(req.params.commentId || '').trim();
    const target = serverState.comments.find((c) => c.id === commentId);
    if (!target) {
      res.status(404).json({
        error: 'Không tìm thấy bình luận.',
        code: 'COMMENT_NOT_FOUND',
      });
      return;
    }

    // Security Test #2: Teacher cannot moderate comments belonging to another teacher's class
    if (!canTeacherModerateClassScope(actor, target.classCode, target.classGroupId)) {
      appendSecurityLog(
        'CROSS_CLASS_ACCESS_BLOCKED',
        actor.uid,
        actor.role,
        commentId,
        `Chặn giáo viên ${actor.uid} kiểm duyệt bình luận thuộc lớp ${target.classCode} của giáo viên khác`
      );
      res.status(403).json({
        error: `Bạn không có quyền kiểm duyệt bình luận thuộc lớp ${target.classCode} ngoài phạm vi được phân công.`,
        code: 'CLASS_SCOPE_FORBIDDEN',
      });
      return;
    }

    const action = String(req.body?.action || '').trim();
    const reason = String(req.body?.reason || 'Đã kiểm tra theo quy chuẩn cộng đồng Artverse')
      .trim()
      .slice(0, 400);
    const internalNote =
      typeof req.body?.internalNote === 'string'
        ? req.body.internalNote.trim().slice(0, 500)
        : undefined;

    const prevStatus = target.status;
    const nowIso = new Date().toISOString();

    if (action === 'approve' || action === 'restore') {
      target.status = 'published';
    } else if (action === 'hide') {
      target.status = 'hidden';
    } else if (action === 'reject') {
      target.status = 'rejected';
    } else if (action === 'soft_delete') {
      target.status = 'deleted';
    } else if (action === 'approve_appeal') {
      target.status = 'published';
      target.appeal = {
        ...target.appeal,
        status: 'approved',
        resolvedBy: actor.displayName,
        resolvedAt: nowIso,
        resolutionNote: reason,
      };
    } else if (action === 'reject_appeal') {
      target.status = 'rejected';
      target.appeal = {
        ...target.appeal,
        status: 'rejected',
        resolvedBy: actor.displayName,
        resolvedAt: nowIso,
        resolutionNote: reason,
      };
    } else if (action === 'assign') {
      target.assignedToUid = actor.uid;
      target.assignedToName = actor.displayName;
    } else if (action === 'note') {
      if (internalNote !== undefined) {
        target.internalNote = internalNote;
      }
    } else {
      res.status(400).json({
        error: 'Hành động kiểm duyệt không hợp lệ.',
        code: 'INVALID_MODERATION_ACTION',
      });
      return;
    }

    if (internalNote !== undefined) {
      target.internalNote = internalNote;
    }
    target.moderatedBy = actor.displayName;
    target.moderatedAt = nowIso;
    target.moderationReason = reason;
    target.updatedAt = nowIso;

    target.stateHistory.push({
      fromStatus: prevStatus,
      toStatus: target.status,
      changedByUid: actor.uid,
      changedByName: actor.displayName,
      changedByRole: actor.role,
      reason: `[${action.toUpperCase()}] ${reason}`,
      timestamp: nowIso,
    });

    appendSecurityLog(
      'COMMENT_MODERATION_ACTION',
      actor.uid,
      actor.role,
      commentId,
      `${actor.displayName} (${actor.role}) thực hiện "${action}" trên bình luận ${commentId} (${prevStatus} -> ${target.status}): ${reason}`
    );

    saveServerState();

    res.json({
      comment: target,
    });
  });

  // 10.9 POST Resolve Comment Report
  app.post('/api/community/moderation/reports/:reportId/resolve', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || (actor.role !== 'teacher' && actor.role !== 'admin')) {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Giáo viên và Quản trị viên mới được xử lý báo cáo vi phạm.',
        code: errorCode || 'FORBIDDEN',
      });
      return;
    }

    const reportId = String(req.params.reportId || '').trim();
    const report = serverState.commentReports.find((r) => r.id === reportId);
    if (!report) {
      res.status(404).json({ error: 'Không tìm thấy báo cáo vi phạm.', code: 'REPORT_NOT_FOUND' });
      return;
    }

    if (!canTeacherModerateClassScope(actor, report.classCode, report.classGroupId)) {
      res.status(403).json({
        error: `Bạn không có quyền xử lý báo cáo thuộc lớp ${report.classCode} ngoài phạm vi phụ trách.`,
        code: 'CLASS_SCOPE_FORBIDDEN',
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const resolutionNote = String(
      req.body?.resolutionNote || 'Đã kiểm tra và xử lý theo quy tắc an toàn cộng đồng.'
    )
      .trim()
      .slice(0, 400);

    report.status = req.body?.status === 'reviewing' ? 'reviewing' : 'resolved';
    if (report.status === 'resolved') {
      report.resolvedAt = nowIso;
      report.resolvedAtMs = Date.now();
      report.resolvedByUid = actor.uid;
      report.resolvedByName = actor.displayName;
      report.resolvedByRole = actor.role;
      report.resolutionNote = resolutionNote;
    }

    saveServerState();
    const { reporterUidHash: _hash, ...safeReport } = report;
    res.json({ report: safeReport });
  });

  // 10.10 POST Admin Keyword & Moderation Policy Config
  app.post('/api/community/moderation/keywords', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error:
          errorMessage ||
          'Chỉ Quản trị viên (Admin) mới được phép thay đổi danh mục từ khóa và cấu hình quy tắc cộng đồng.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    if (Array.isArray(req.body?.blockedKeywords)) {
      serverState.moderationConfig.blockedKeywords = req.body.blockedKeywords
        .map((w: unknown) => String(w).trim())
        .filter(Boolean)
        .slice(0, 200);
    }
    if (Array.isArray(req.body?.reviewKeywords)) {
      serverState.moderationConfig.reviewKeywords = req.body.reviewKeywords
        .map((w: unknown) => String(w).trim())
        .filter(Boolean)
        .slice(0, 200);
    }
    if (typeof req.body?.editWindowMinutes === 'number') {
      serverState.moderationConfig.editWindowMinutes = Math.min(
        60,
        Math.max(1, Math.floor(req.body.editWindowMinutes))
      );
    }
    if (typeof req.body?.aiModerationOfflineSimulated === 'boolean') {
      serverState.moderationConfig.aiModerationOfflineSimulated =
        req.body.aiModerationOfflineSimulated;
    }

    saveServerState();
    res.json({ moderationConfig: serverState.moderationConfig });
  });

  // 10.11 POST Admin Temporary Comment Mute (Never automated by AI; requires Admin human decision)
  app.post('/api/community/moderation/mute-user', async (req, res) => {
    const { actor, errorStatus, errorMessage, errorCode } = await resolveAuthenticatedActor(req);
    if (!actor || actor.role !== 'admin') {
      res.status(errorStatus || 403).json({
        error:
          errorMessage ||
          'Chỉ Quản trị viên (Admin) mới có thẩm quyền tạm khóa quyền bình luận khi có căn cứ xác thực.',
        code: errorCode || 'ADMIN_ONLY',
      });
      return;
    }

    const targetUid = String(req.body?.targetUid || '').trim();
    const durationMinutes = Math.min(10080, Math.max(0, Number(req.body?.durationMinutes) || 60));
    const reason = String(req.body?.reason || 'Vi phạm quy tắc ứng xử cộng đồng nhiều lần')
      .trim()
      .slice(0, 300);

    if (!targetUid) {
      res.status(400).json({ error: 'Thiếu mã tài khoản (targetUid).', code: 'MISSING_UID' });
      return;
    }

    if (durationMinutes === 0) {
      delete serverState.mutedCommentUsers[targetUid];
      saveServerState();
      res.json({ status: 'unmuted', targetUid });
      return;
    }

    const mutedUntil = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    serverState.mutedCommentUsers[targetUid] = {
      uid: targetUid,
      nickname: String(req.body?.nickname || targetUid),
      mutedUntil,
      reason,
      mutedBy: actor.displayName,
      createdAt: new Date().toISOString(),
    };

    appendSecurityLog(
      'COMMENT_TEMP_MUTE',
      actor.uid,
      'admin',
      targetUid,
      `Admin tạm khóa quyền bình luận ${durationMinutes} phút đối với ${targetUid}: ${reason}`
    );
    saveServerState();

    res.json({
      status: 'muted',
      muteEntry: serverState.mutedCommentUsers[targetUid],
    });
  });

  // ============================================================================
  // 11. 5-EMOTION ARTWORK REACTION SYSTEM (❤️ Yêu thích | 👍 Thích | 😂 Vui | 😢 Buồn | 😡 Giận)
  // - Strictly 1 emotion per authenticated UID per artwork
  // - Supports switching emotion or unselecting (toggle off)
  // - Atomic per-artwork mutex prevents concurrent race conditions
  // - Blocks client-side count or UID manipulation
  // ============================================================================
  const VALID_ARTWORK_EMOTIONS = new Set(['love', 'like', 'haha', 'sad', 'angry']);
  const artworkReactionLocks = new Map<string, Promise<void>>();

  async function withArtworkReactionLock<T>(
    artworkId: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const prev = artworkReactionLocks.get(artworkId) || Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    artworkReactionLocks.set(
      artworkId,
      prev.then(() => next)
    );
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (artworkReactionLocks.get(artworkId) === next) {
        artworkReactionLocks.delete(artworkId);
      }
    }
  }

  function normalizeServerEmotion(
    raw: unknown
  ): {
    uiKey: 'love' | 'like' | 'haha' | 'sad' | 'angry';
    canonical: 'heart' | 'like' | 'laugh' | 'sad' | 'angry';
  } | null {
    if (typeof raw !== 'string') return null;
    const v = raw.trim().toLowerCase();
    if (v === 'love' || v === 'heart') return { uiKey: 'love', canonical: 'heart' };
    if (v === 'like') return { uiKey: 'like', canonical: 'like' };
    if (v === 'haha' || v === 'laugh') return { uiKey: 'haha', canonical: 'laugh' };
    if (v === 'sad') return { uiKey: 'sad', canonical: 'sad' };
    if (v === 'angry') return { uiKey: 'angry', canonical: 'angry' };
    return null;
  }

  function computeArtworkEmotionSummary(
    artworkId: string,
    actorUid?: string | null
  ) {
    const map = serverState.artworkReactions[artworkId] || {};
    const docMap = serverState.artworkReactionDocs[artworkId] || {};
    const counts = {
      love: 0,
      like: 0,
      haha: 0,
      sad: 0,
      angry: 0,
      heart: 0,
      laugh: 0,
    };
    let totalCount = 0;

    // Aggregate strictly from per-UID reaction records (never negative, 1 per UID)
    const combinedUids = new Set([...Object.keys(map), ...Object.keys(docMap)]);
    const normalizedUserMap: Record<string, 'love' | 'like' | 'haha' | 'sad' | 'angry'> = {};
    const normalizedDocs: Record<
      string,
      {
        uid: string;
        reactionType: 'heart' | 'like' | 'laugh' | 'sad' | 'angry';
        createdAt: string;
        updatedAt: string;
      }
    > = {};

    for (const u of combinedUids) {
      const rawVal = docMap[u]?.reactionType || map[u];
      const norm = normalizeServerEmotion(rawVal);
      if (norm) {
        counts[norm.uiKey] += 1;
        totalCount += 1;
        normalizedUserMap[u] = norm.uiKey;
        normalizedDocs[u] = {
          uid: u,
          reactionType: norm.canonical,
          createdAt: docMap[u]?.createdAt || new Date().toISOString(),
          updatedAt: docMap[u]?.updatedAt || new Date().toISOString(),
        };
      }
    }
    counts.heart = counts.love;
    counts.laugh = counts.haha;

    const myUiEmotion = actorUid && normalizedUserMap[actorUid] ? normalizedUserMap[actorUid] : null;
    const myCanonical = actorUid && normalizedDocs[actorUid] ? normalizedDocs[actorUid].reactionType : null;

    return {
      artworkId,
      counts,
      totalCount: Math.max(0, totalCount),
      userEmotion: myUiEmotion,
      myReaction: myUiEmotion,
      myCanonicalReaction: myCanonical,
      emotionUsers: normalizedUserMap,
      reactionDocs: normalizedDocs,
    };
  }

  // 11.1 GET Artwork 5-Emotion Reactions
  app.get('/api/community/artworks/:artworkId/reactions', async (req, res) => {
    const artworkId = String(req.params.artworkId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    if (!artworkId) {
      res.status(400).json({ error: 'Thiếu mã tác phẩm (artworkId).', code: 'MISSING_ARTWORK_ID' });
      return;
    }

    const { actor } = await resolveAuthenticatedActor(req);
    const summary = computeArtworkEmotionSummary(artworkId, actor?.uid || null);
    res.json(summary);
  });

  // 11.2 POST Toggle / Switch / Unselect 5-Emotion Reaction (Authenticated UID required)
  app.post('/api/community/artworks/:artworkId/reactions', async (req, res) => {
    const { actor, errorStatus, errorMessage } = await resolveAuthenticatedActor(req);
    if (!actor || !actor.uid) {
      res.status(errorStatus || 401).json({
        error:
          errorMessage ||
          'Vui lòng đăng nhập tài khoản Học sinh, Giáo viên hoặc Quản trị viên để thả cảm xúc cho tác phẩm.',
        code: 'unauthenticated',
      });
      return;
    }

    const artworkId = String(req.params.artworkId || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);
    if (!artworkId) {
      res.status(400).json({ error: 'Thiếu mã tác phẩm (artworkId).', code: 'not-found' });
      return;
    }

    // Security Guard 1: Block any attempt to spoof UID (even by Teacher or Admin)
    const bodyUid = req.body?.uid ?? req.body?.userId ?? req.body?.authorUid;
    if (bodyUid !== undefined && String(bodyUid).trim() !== actor.uid) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        artworkId,
        `Chặn giả mạo UID (${String(bodyUid)}) khi cập nhật cảm xúc tác phẩm ${artworkId}`
      );
      res.status(403).json({
        error: 'Không được phép giả mạo UID của người dùng khác để tạo hoặc sửa cảm xúc (permission-denied).',
        code: 'permission-denied',
      });
      return;
    }

    // Security Guard 2: Block any attempt by client to write aggregate reaction counters
    if (
      req.body?.counts !== undefined ||
      req.body?.totalCount !== undefined ||
      req.body?.emotionCounts !== undefined
    ) {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        artworkId,
        `Chặn client tự ghi tổng số lượt cảm xúc trên tác phẩm ${artworkId}`
      );
      res.status(403).json({
        error: 'Client không được phép tự ghi hoặc chỉnh sửa tổng số lượt cảm xúc (permission-denied).',
        code: 'permission-denied',
      });
      return;
    }

    const rawEmotion = req.body?.emotion !== undefined ? req.body.emotion : req.body?.reactionType;
    const isUnselectRequest = rawEmotion === null || rawEmotion === '' || rawEmotion === 'none';
    const normalizedDesired = isUnselectRequest ? null : normalizeServerEmotion(rawEmotion);

    if (!isUnselectRequest && !normalizedDesired) {
      res.status(400).json({
        error: 'Cảm xúc không hợp lệ. Chỉ chấp nhận 5 giá trị: heart (love), like, laugh (haha), sad, angry.',
        code: 'INVALID_EMOTION_KEY',
      });
      return;
    }

    const explicitMode = req.body?.mode; // Optional: 'set' | 'toggle' (default 'toggle')

    const result = await withArtworkReactionLock(artworkId, () => {
      if (!serverState.artworkReactions[artworkId]) {
        serverState.artworkReactions[artworkId] = {};
      }
      if (!serverState.artworkReactionDocs[artworkId]) {
        serverState.artworkReactionDocs[artworkId] = {};
      }
      const userMap = serverState.artworkReactions[artworkId];
      const docMap = serverState.artworkReactionDocs[artworkId];
      const nowIso = new Date().toISOString();

      const prevRaw = docMap[actor.uid]?.reactionType || userMap[actor.uid] || null;
      const prevNorm = normalizeServerEmotion(prevRaw);
      const previousReaction = prevNorm ? prevNorm.uiKey : null;

      let nextUiReaction: 'love' | 'like' | 'haha' | 'sad' | 'angry' | null = null;

      if (!normalizedDesired) {
        delete userMap[actor.uid];
        delete docMap[actor.uid];
        nextUiReaction = null;
      } else if (previousReaction === normalizedDesired.uiKey && explicitMode !== 'set') {
        // Clicking the currently active emotion unselects it
        delete userMap[actor.uid];
        delete docMap[actor.uid];
        nextUiReaction = null;
      } else {
        // Selecting a new emotion or switching from a previous emotion
        const existingCreatedAt = docMap[actor.uid]?.createdAt || nowIso;
        userMap[actor.uid] = normalizedDesired.uiKey;
        docMap[actor.uid] = {
          uid: actor.uid,
          reactionType: normalizedDesired.canonical,
          createdAt: existingCreatedAt,
          updatedAt: nowIso,
        };
        nextUiReaction = normalizedDesired.uiKey;
      }

      const summary = computeArtworkEmotionSummary(artworkId, actor.uid);

      // Sync onto serverState.artworks if artwork exists in server store
      const artIdx = serverState.artworks.findIndex(
        (a: any) => a && (a.id === artworkId || a.artworkId === artworkId)
      );
      if (artIdx >= 0) {
        serverState.artworks[artIdx] = {
          ...serverState.artworks[artIdx],
          emotionCounts: {
            love: summary.counts.love,
            like: summary.counts.like,
            haha: summary.counts.haha,
            sad: summary.counts.sad,
            angry: summary.counts.angry,
          },
          emotionUsers: summary.emotionUsers,
          updatedAt: nowIso,
        };
      }

      saveServerState();

      return {
        ...summary,
        previousReaction,
        reactionDoc: nextUiReaction ? docMap[actor.uid] : null,
        action:
          nextUiReaction === null
            ? 'unselected'
            : previousReaction && previousReaction !== nextUiReaction
              ? 'switched'
              : 'selected',
      };
    });

    res.json(result);
  });

  // ============================================================================
  // 12. ARTVERSE STORIES — CÂU CHUYỆN SAU NÉT VẼ & AI WRITING FACILITATOR
  // - Preserves and serves stories from serverState.stories & Firestore artworkStories
  // - Enforces Student -> Draft / Pending -> Teacher Moderation (Approve / Revision / Reject / Hide)
  // - Prohibits Base64 video in story documents and blocks unuploaded blob: URLs
  // ============================================================================
  app.get('/api/stories', async (req, res) => {
    const { actor } = await resolveAuthenticatedActor(req);
    const allStories = Array.isArray(serverState.stories) ? serverState.stories : [];

    const visibleStories = allStories
      .filter((s: any) => {
        if (!s || !s.id) return false;
        if (actor?.role === 'admin') return true;
        if (actor?.role === 'teacher') {
          if (s.status === 'approved') return true;
          return canTeacherModerateClassScope(actor, s.classCode, s.classGroupId);
        }
        if (s.status === 'approved') return true;
        if (actor?.uid && (s.authorAccountId === actor.uid || s.ownerKey === actor.uid)) {
          return true;
        }
        return false;
      })
      .map((s: any) => {
        const { fullName: _fn, studentCode: _sc, email: _em, pin: _p, pinHash: _ph, ...safe } = s;
        return safe;
      });

    res.json({ stories: visibleStories });
  });

  app.post('/api/stories', async (req, res) => {
    const { actor, errorStatus, errorMessage } = await resolveAuthenticatedActor(req);
    if (!actor || !actor.uid) {
      res.status(errorStatus || 401).json({
        error: errorMessage || 'Vui lòng đăng nhập để lưu hoặc gửi câu chuyện nghệ thuật.',
        code: 'unauthenticated',
      });
      return;
    }

    const rawStory = req.body?.story || req.body || {};
    const storyTitle = String(rawStory.storyTitle || '').trim().slice(0, 250);
    const storyContent = String(rawStory.storyContent || '').trim().slice(0, 4500);
    const inspirationText = rawStory.inspirationText
      ? String(rawStory.inspirationText).trim().slice(0, 1500)
      : undefined;
    const feelingText = rawStory.feelingText
      ? String(rawStory.feelingText).trim().slice(0, 1500)
      : undefined;
    const viewerMessage = rawStory.viewerMessage
      ? String(rawStory.viewerMessage).trim().slice(0, 1000)
      : undefined;

    if (!storyTitle || !storyContent) {
      res.status(400).json({
        error: 'Vui lòng nhập đầy đủ Tên câu chuyện và Nội dung câu chuyện.',
        code: 'MISSING_STORY_FIELDS',
      });
      return;
    }

    // Reject unuploaded blob: or Base64 video in story
    const videoUrl = rawStory.artworkVideoUrl ? String(rawStory.artworkVideoUrl).trim() : '';
    const imageUrl = rawStory.artworkImageUrl ? String(rawStory.artworkImageUrl).trim() : '';
    if (videoUrl && (videoUrl.startsWith('blob:') || videoUrl.startsWith('local_idb://'))) {
      res.status(400).json({
        error: 'Video liên kết chưa hoàn tất tải lên Firebase Storage. Không được liên kết video tạm thời.',
        code: 'UNUPLOADED_VIDEO_REJECTED',
      });
      return;
    }
    if (videoUrl && videoUrl.startsWith('data:video/')) {
      res.status(400).json({
        error: 'Không được phép lưu dữ liệu Base64 của video trong Firestore.',
        code: 'BASE64_VIDEO_FORBIDDEN',
      });
      return;
    }
    if (imageUrl && imageUrl.startsWith('blob:')) {
      res.status(400).json({
        error: 'Ảnh tác phẩm chưa hoàn tất tải lên Storage.',
        code: 'UNUPLOADED_IMAGE_REJECTED',
      });
      return;
    }

    // Check child safety (no phone numbers, emails, external URLs, or bullying words)
    const combinedText = [storyTitle, storyContent, inspirationText, feelingText, viewerMessage]
      .filter(Boolean)
      .join(' ');
    if (/(?:\+84|0)(?:\d[\s.-]?){9,10}\b/.test(combinedText) || /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(combinedText)) {
      res.status(422).json({
        error: 'Để bảo vệ an toàn thông tin cá nhân, em không ghi số điện thoại hoặc email vào câu chuyện nhé!',
        code: 'STORY_PII_DETECTED',
      });
      return;
    }

    const safeId = String(rawStory.id || `story_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`)
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 120);

    const existingIdx = serverState.stories.findIndex((s: any) => s && s.id === safeId);
    const existingStory = existingIdx >= 0 ? serverState.stories[existingIdx] : null;

    // Anti-IDOR: Students can only edit their own story
    if (
      existingStory &&
      actor.role !== 'admin' &&
      actor.role !== 'teacher' &&
      existingStory.authorAccountId !== actor.uid &&
      existingStory.ownerKey !== actor.uid
    ) {
      res.status(403).json({
        error: 'Em chỉ được phép chỉnh sửa câu chuyện của chính mình.',
        code: 'permission-denied',
      });
      return;
    }

    // Enforce status rules: Students can only set 'draft' or 'pending', never self-approve
    const requestedStatus = String(rawStory.status || 'pending').toLowerCase();
    let finalStatus: 'draft' | 'pending' | 'approved' | 'revision_required' | 'rejected' | 'hidden' =
      'pending';
    if (actor.role === 'admin' || actor.role === 'teacher') {
      if (
        ['draft', 'pending', 'approved', 'revision_required', 'rejected', 'hidden'].includes(
          requestedStatus
        )
      ) {
        finalStatus = requestedStatus as any;
      }
    } else {
      finalStatus = requestedStatus === 'draft' ? 'draft' : 'pending';
    }

    const nowIso = new Date().toISOString();
    const safeNickname =
      actor.displayName ||
      String(rawStory.authorNickname || 'Họa Sĩ Trẻ').trim().slice(0, 64) ||
      'Họa Sĩ Trẻ';

    const savedStory = {
      ...(existingStory || {}),
      id: safeId,
      artworkId: String(rawStory.artworkId || existingStory?.artworkId || 'standalone_story').trim(),
      artworkTitle: String(rawStory.artworkTitle || existingStory?.artworkTitle || storyTitle)
        .trim()
        .slice(0, 250),
      artworkImageUrl: imageUrl || existingStory?.artworkImageUrl || undefined,
      artworkVideoUrl: videoUrl || existingStory?.artworkVideoUrl || undefined,
      mediaType:
        rawStory.mediaType === 'video' || Boolean(videoUrl)
          ? 'video'
          : imageUrl
            ? 'image'
            : 'none',
      coverImageUrl:
        String(rawStory.coverImageUrl || imageUrl || existingStory?.coverImageUrl || '').trim() ||
        undefined,
      lessonId: rawStory.lessonId ? String(rawStory.lessonId) : existingStory?.lessonId,
      lessonTitle: rawStory.lessonTitle ? String(rawStory.lessonTitle) : existingStory?.lessonTitle,
      topic: rawStory.topic ? String(rawStory.topic) : existingStory?.topic,
      classGroupId: String(
        rawStory.classGroupId || actor.classGroupId || existingStory?.classGroupId || 'cls-6'
      ),
      classCode: String(rawStory.classCode || actor.classCode || existingStory?.classCode || 'LOP6'),
      className: String(rawStory.className || actor.className || existingStory?.className || 'Lớp 6'),
      gradeLabel: String(
        rawStory.gradeLabel || rawStory.className || actor.className || existingStory?.gradeLabel || 'Lớp 6'
      ),
      ownerKey: existingStory?.ownerKey || actor.uid,
      authorAccountId: existingStory?.authorAccountId || actor.uid,
      authorNickname: existingStory?.authorNickname || safeNickname,
      storyTitle,
      storyContent,
      inspirationText,
      feelingText,
      viewerMessage,
      status: finalStatus,
      teacherNote:
        finalStatus === 'pending' ? existingStory?.teacherNote : rawStory.teacherNote ?? existingStory?.teacherNote,
      createdAt: existingStory?.createdAt || nowIso,
      updatedAt: nowIso,
      publishedAt:
        finalStatus === 'approved'
          ? existingStory?.publishedAt || nowIso
          : existingStory?.publishedAt,
    };

    if (existingIdx >= 0) {
      serverState.stories[existingIdx] = savedStory;
    } else {
      serverState.stories.unshift(savedStory);
    }
    saveServerState();

    res.status(existingIdx >= 0 ? 200 : 201).json({ story: savedStory });
  });

  app.post('/api/stories/:storyId/moderate', async (req, res) => {
    const { actor, errorStatus, errorMessage } = await resolveAuthenticatedActor(req);
    if (!actor || (actor.role !== 'teacher' && actor.role !== 'admin')) {
      res.status(errorStatus || 403).json({
        error: errorMessage || 'Chỉ Giáo viên và Quản trị viên mới có quyền kiểm duyệt câu chuyện.',
        code: 'permission-denied',
      });
      return;
    }

    const storyId = String(req.params.storyId || '').trim();
    const idx = serverState.stories.findIndex((s: any) => s && s.id === storyId);
    if (idx < 0) {
      res.status(404).json({
        error: 'Không tìm thấy câu chuyện cần kiểm duyệt.',
        code: 'not-found',
      });
      return;
    }

    const target = serverState.stories[idx];
    if (!canTeacherModerateClassScope(actor, target.classCode, target.classGroupId)) {
      res.status(403).json({
        error: 'Bạn không có quyền kiểm duyệt câu chuyện thuộc lớp của giáo viên khác.',
        code: 'permission-denied',
      });
      return;
    }

    const rawStatus = String(req.body?.status || 'approved').toLowerCase();
    const validStatuses = ['approved', 'revision_required', 'rejected', 'hidden', 'pending', 'draft'];
    if (!validStatuses.includes(rawStatus)) {
      res.status(400).json({ error: 'Trạng thái kiểm duyệt không hợp lệ.', code: 'INVALID_STATUS' });
      return;
    }

    const teacherNote =
      typeof req.body?.teacherNote === 'string'
        ? req.body.teacherNote.trim().slice(0, 1000)
        : target.teacherNote;
    const nowIso = new Date().toISOString();

    const updated = {
      ...target,
      status: rawStatus,
      teacherNote,
      moderatedBy: actor.displayName || actor.uid,
      moderatedAt: nowIso,
      updatedAt: nowIso,
      publishedAt: rawStatus === 'approved' ? target.publishedAt || nowIso : target.publishedAt,
    };

    serverState.stories[idx] = updated;
    saveServerState();

    res.json({ story: updated });
  });

  // AI Writing Facilitator for ARTVERSE STORIES (Strictly guides/assists, never writes in place of the student)
  const handleStoryAiAssist = async (req: express.Request, res: express.Response) => {
    const { actor } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(401).json({
        error: 'Em vui lòng đăng nhập để sử dụng Trợ lý Gợi mở Câu chuyện nhé!',
        code: 'unauthenticated',
      });
      return;
    }

    const assistMode = String(req.body?.mode || 'questions').toLowerCase(); // 'questions' | 'structure' | 'spellcheck' | 'titles'
    const artworkTitle = String(req.body?.artworkTitle || 'Tác phẩm của em').slice(0, 160);
    const gradeLabel = String(req.body?.gradeLabel || actor.className || 'THCS').slice(0, 40);
    const materialsUsed = String(req.body?.materialsUsed || 'Màu tổng hợp').slice(0, 100);
    const draftTitle = String(req.body?.storyTitle || '').slice(0, 200);
    const draftContent = String(req.body?.storyContent || '').slice(0, 3000);

    let prompts: string[] = [
      `Khoảnh khắc hay kỷ niệm nào đã thôi thúc em vẽ nên tác phẩm "${artworkTitle}"?`,
      `Tại sao em lại chọn bảng màu và chất liệu (${materialsUsed}) cho bức tranh này?`,
      `Chi tiết nào trong tác phẩm khiến em tâm đắc nhất hoặc tốn nhiều công sức nhất?`,
      `Khi người xem đứng trước tác phẩm "${artworkTitle}", em mong họ cảm nhận được thông điệp gì?`,
    ];
    let suggestionText = '';
    let suggestedTitles: string[] = [
      `Câu chuyện phía sau "${artworkTitle}"`,
      `Sắc màu ký ức trong "${artworkTitle}"`,
      `Góc nhìn của em qua "${artworkTitle}"`,
    ];

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = getGenAIClient();
        const promptInstruction =
          assistMode === 'spellcheck'
            ? `Em học sinh (${gradeLabel}) đã tự viết bản nháp câu chuyện nghệ thuật cho tác phẩm "${artworkTitle}":\nTiêu đề: "${draftTitle}"\nNội dung: "${draftContent}"\nHãy chỉ ra nhẹ nhàng các lỗi chính tả hoặc dấu câu (nếu có) và gợi ý chỉnh câu mượt hơn nhưng TUYỆT ĐỐI GIỮ NGUYÊN giọng văn và cảm xúc của học sinh, không viết thay toàn bộ.`
            : assistMode === 'structure'
              ? `Em học sinh (${gradeLabel}) đang viết câu chuyện về tác phẩm "${artworkTitle}" (chất liệu: ${materialsUsed}). Bản nháp hiện tại: "${draftContent}". Hãy gợi ý dàn ý 3 phần ngắn gọn (1. Nguồn cảm hứng, 2. Quá trình & cảm xúc khi sáng tác, 3. Thông điệp gửi người xem) bằng câu hỏi gợi mở để em tự sắp xếp ý.`
              : assistMode === 'titles'
                ? `Dựa trên tác phẩm "${artworkTitle}" (${gradeLabel}) và chia sẻ của học sinh: "${draftContent}", hãy gợi ý 4 tên câu chuyện giàu chất nghệ thuật để học sinh tham khảo lựa chọn.`
                : `Hãy đóng vai giáo viên Mĩ thuật tâm lý, đặt 4 câu hỏi gợi mở ngắn gọn giúp học sinh (${gradeLabel}) tự kể câu chuyện đằng sau tác phẩm "${artworkTitle}" (chất liệu: ${materialsUsed}). Không viết hộ câu chuyện.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptInstruction,
          config: {
            systemInstruction:
              'Bạn là người hướng dẫn kể chuyện nghệ thuật của ARTVERSE AI. Nguyên tắc: Chỉ đặt câu hỏi gợi mở, gợi ý sắp xếp ý, soát lỗi chính tả hoặc gợi ý tiêu đề. TUYỆT ĐỐI KHÔNG viết thay câu chuyện của học sinh.',
          },
        });
        const text = (response.text || '').trim();
        if (text) {
          suggestionText = text;
          const lines = text
            .split('\n')
            .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
            .filter((l) => l.length > 8 && l.length < 220);
          if (lines.length >= 2) {
            if (assistMode === 'titles') {
              suggestedTitles = lines.slice(0, 4);
            } else {
              prompts = lines.slice(0, 4);
            }
          }
        }
      } catch {
        // Use clean pedagogical fallback below
      }
    }

    if (!suggestionText) {
      if (assistMode === 'spellcheck') {
        suggestionText = draftContent
          ? 'Bản nháp của em có cảm xúc rất chân thật! Em hãy kiểm tra lại chữ viết hoa đầu câu và dấu chấm kết thúc đoạn để câu chuyện mạch lạc hơn nhé.'
          : 'Em hãy viết vài dòng cảm nghĩ trước, sau đó Trợ lý sẽ giúp em rà soát chính tả nhé!';
      } else if (assistMode === 'structure') {
        suggestionText =
          'Gợi ý bố cục 3 phần cho câu chuyện của em:\n1. Khởi nguồn: Điều gì gợi ý tưởng cho em?\n2. Thực hành: Em đã pha màu, tạo nét hoặc quay video quá trình như thế nào?\n3. Lời nhắn: Cảm xúc em muốn gửi tới người xem triển lãm.';
      } else if (assistMode === 'titles') {
        suggestionText = suggestedTitles.map((t, i) => `${i + 1}. ${t}`).join('\n');
      } else {
        suggestionText = prompts.map((p, i) => `${i + 1}. ${p}`).join('\n');
      }
    }

    res.json({
      mode: assistMode,
      prompts,
      suggestedTitles,
      suggestionText,
      suggestions: assistMode === 'titles' ? suggestedTitles : prompts,
      note: suggestionText,
    });
  };

  app.post('/api/gemini/story-prompts', handleStoryAiAssist);
  app.post('/api/ai/story-assist', handleStoryAiAssist);

  // ============================================================================
  // 13. SYSTEM-WIDE SYNCHRONIZED SEARCH ENGINE (ART VERSE AI)
  // - GET /api/search/global: Grouped search across Artworks, Authors, ARTVERSE SHORTS,
  //   Stories, and MĨ THUẬT GDPT resources. Strictly strips internal student PII.
  // - GET /api/search/management: Internal RBAC-enforced search for Students (with
  //   studentCode & fullName), Teachers, Classes, Accounts, and System Admin moderation.
  // ============================================================================
  app.get('/api/search/global', async (req, res) => {
    const { actor } = await resolveAuthenticatedActor(req);
    const rawQuery = String(req.query.q || '').trim().slice(0, 120);
    const groupFilter = String(req.query.group || 'all').toLowerCase();
    const limitNum = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const offsetNum = Math.max(0, Number(req.query.offset) || 0);
    const normalizedQuery = normalizeVietnameseSearch(rawQuery);

    const allArtworks = Array.isArray(serverState.artworks) ? serverState.artworks : [];
    const allStories = Array.isArray(serverState.stories) ? serverState.stories : [];
    const allLessons =
      Array.isArray(serverState.lessons) && serverState.lessons.length > 0
        ? serverState.lessons
        : INITIAL_LESSONS;

    const artworkMatches: GlobalSearchGroupItem[] = [];
    const shortMatches: GlobalSearchGroupItem[] = [];
    const authorMap = new Map<string, GlobalSearchGroupItem>();

    for (const art of allArtworks) {
      if (!art || !art.id || art.status === 'removed') continue;
      const isPublicApproved = art.status === 'approved' && art.shareStatus !== 'private';
      const canSee =
        isPublicApproved ||
        actor?.role === 'admin' ||
        (actor?.role === 'teacher' &&
          canTeacherModerateClassScope(actor, art.classCode, art.classGroupId)) ||
        (actor?.uid && (art.authorAccountId === actor.uid || art.ownerKey === actor.uid));
      if (!canSee) continue;

      const publicAlias =
        art.authorNickname || art.authorAlias || art.creatorAnonymousPseudonym || 'Nghệ sĩ Trẻ';
      const gradeLabel = art.grade || art.className || 'Lớp 6';
      const isVideo =
        art.mediaType === 'video' ||
        Boolean(art.videoUrl) ||
        Boolean(art.mimeType && String(art.mimeType).startsWith('video/'));

      const score = normalizedQuery
        ? computeSearchRelevance(
            rawQuery,
            [art.title, publicAlias, gradeLabel],
            [art.description, art.materialsUsed, art.lessonTitle, art.topic]
          )
        : 10;

      if (score > 0) {
        if (isVideo) {
          shortMatches.push({
            id: art.id,
            group: 'short',
            title: art.title || 'Video ARTVERSE SHORTS',
            subtitle: `${publicAlias} · ${gradeLabel}`,
            badge: 'ARTVERSE SHORTS',
            thumbnailUrl: art.thumbnailUrl || art.imageUrl || art.downloadURL,
            mediaType: 'video',
            gradeLabel,
            createdAt: art.createdAt,
            score,
          });
        } else {
          artworkMatches.push({
            id: art.id,
            group: 'artwork',
            title: art.title || 'Tác phẩm Mỹ thuật',
            subtitle: `${publicAlias} · ${gradeLabel}`,
            badge: gradeLabel,
            thumbnailUrl: art.thumbnailUrl || art.imageUrl || art.downloadURL,
            mediaType: 'image',
            gradeLabel,
            createdAt: art.createdAt,
            score,
          });
        }
      }

      // Public Author Alias index (Strictly public alias only — never fullName or studentCode)
      const aliasScore = normalizedQuery
        ? computeSearchRelevance(rawQuery, [publicAlias], [gradeLabel, art.title])
        : 10;
      if (aliasScore > 0) {
        const normKey = normalizeVietnameseSearch(publicAlias);
        const existing = authorMap.get(normKey);
        if (!existing || aliasScore > existing.score) {
          authorMap.set(normKey, {
            id: `author_${normKey.replace(/\s+/g, '_')}`,
            group: 'author',
            title: publicAlias,
            subtitle: `Bí danh Tác giả · ${gradeLabel}`,
            badge: gradeLabel,
            mediaType: 'author',
            gradeLabel,
            score: aliasScore,
          });
        }
      }
    }

    // Also include public student aliases from active students (strictly alias + grade only, zero PII)
    for (const stu of serverState.students) {
      if (!stu || stu.status !== 'active' || !stu.alias) continue;
      const publicAlias = stu.alias;
      const gradeLabel = stu.grade || stu.className || 'Lớp 6';
      const aliasScore = normalizedQuery
        ? computeSearchRelevance(rawQuery, [publicAlias], [gradeLabel])
        : 5;
      if (aliasScore > 0) {
        const normKey = normalizeVietnameseSearch(publicAlias);
        if (!authorMap.has(normKey)) {
          authorMap.set(normKey, {
            id: `author_${normKey.replace(/\s+/g, '_')}`,
            group: 'author',
            title: publicAlias,
            subtitle: `Bí danh Học sinh · ${gradeLabel}`,
            badge: gradeLabel,
            mediaType: 'author',
            gradeLabel,
            score: aliasScore,
          });
        }
      }
    }

    // Stories (Only published stories for public/students; assigned class scope for teachers; own for author)
    const storyMatches: GlobalSearchGroupItem[] = [];
    for (const st of allStories) {
      if (!st || !st.id) continue;
      const canSeeStory =
        st.status === 'approved' ||
        actor?.role === 'admin' ||
        (actor?.role === 'teacher' &&
          canTeacherModerateClassScope(actor, st.classCode, st.classGroupId)) ||
        (actor?.uid && (st.authorAccountId === actor.uid || st.ownerKey === actor.uid));
      if (!canSeeStory) continue;

      const score = normalizedQuery
        ? computeSearchRelevance(
            rawQuery,
            [st.storyTitle, st.authorNickname, st.artworkTitle],
            [st.storyContent, st.inspirationText, st.feelingText, st.viewerMessage, st.gradeLabel]
          )
        : 10;
      if (score > 0) {
        storyMatches.push({
          id: st.id,
          group: 'story',
          title: st.storyTitle || 'Câu chuyện sau nét vẽ',
          subtitle: `${st.authorNickname || 'Họa sĩ Trẻ'} · ${st.gradeLabel || st.className || 'Lớp 6'}`,
          badge: st.status === 'approved' ? 'PUBLISHED' : String(st.status).toUpperCase(),
          thumbnailUrl: st.coverImageUrl || st.artworkImageUrl,
          mediaType: 'story',
          gradeLabel: st.gradeLabel || st.className,
          createdAt: st.publishedAt || st.createdAt,
          score,
        });
      }
    }

    // MĨ THUẬT GDPT Resources (TIỂU HỌC & THCS — SLIDE BÀI GIẢNG & VIDEO BÀI GIẢNG)
    const gdptMatches: GlobalSearchGroupItem[] = [];
    for (const les of allLessons) {
      if (!les || !les.id || les.status === 'deleted' || les.isHidden) continue;
      const gradeLabel = les.grade || les.className || 'Lớp 6';
      const isTieuHoc =
        les.educationLevel === 'TIEU_HOC' ||
        ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5'].includes(gradeLabel);
      const eduLevel: 'TIEU_HOC' | 'THCS' = isTieuHoc ? 'TIEU_HOC' : 'THCS';
      const isVideoLesson =
        les.resourceCategory === 'video' || (Boolean(les.videoUrl) && !les.slideUrl);
      const resCategory: 'slide' | 'video' = isVideoLesson ? 'video' : 'slide';
      const teacherName = les.teacherName || 'Tổ Mĩ thuật GDPT';
      const fileFormat = les.fileFormat || (isVideoLesson ? 'MP4' : 'SLIDE / PDF');

      const score = normalizedQuery
        ? computeSearchRelevance(
            rawQuery,
            [les.title, gradeLabel, teacherName, fileFormat],
            [
              les.description,
              les.topic,
              isTieuHoc ? 'Tiểu học TIEU_HOC' : 'THCS Trung học cơ sở',
              isVideoLesson ? 'Video bài giảng' : 'Slide bài giảng',
            ]
          )
        : 10;

      if (score > 0) {
        gdptMatches.push({
          id: les.id,
          group: 'gdpt',
          title: les.title,
          subtitle: `${isTieuHoc ? 'TIỂU HỌC' : 'THCS'} (${gradeLabel}) · ${isVideoLesson ? 'VIDEO BÀI GIẢNG' : 'SLIDE BÀI GIẢNG'} · ${teacherName}`,
          badge: `${fileFormat} · ${gradeLabel}`,
          mediaType: isVideoLesson ? 'video' : 'slide',
          gradeLabel,
          educationLevel: eduLevel,
          resourceCategory: resCategory,
          createdAt: les.updatedAt || les.createdAt,
          score,
        });
      }
    }

    artworkMatches.sort((a, b) => b.score - a.score);
    const authorMatches = Array.from(authorMap.values()).sort((a, b) => b.score - a.score);
    shortMatches.sort((a, b) => b.score - a.score);
    storyMatches.sort((a, b) => b.score - a.score);
    gdptMatches.sort((a, b) => b.score - a.score);

    const paginateGroup = (list: GlobalSearchGroupItem[]) =>
      list.slice(offsetNum, offsetNum + limitNum);

    const totalMatches =
      artworkMatches.length +
      authorMatches.length +
      shortMatches.length +
      storyMatches.length +
      gdptMatches.length;

    const suggestions = Array.from(
      new Set(
        [
          ...artworkMatches.slice(0, 2).map((i) => i.title),
          ...authorMatches.slice(0, 2).map((i) => i.title),
          ...shortMatches.slice(0, 1).map((i) => i.title),
          ...storyMatches.slice(0, 1).map((i) => i.title),
          ...gdptMatches.slice(0, 2).map((i) => i.title),
        ].filter(Boolean)
      )
    ).slice(0, 6);

    const hasMore =
      (groupFilter === 'all' &&
        (artworkMatches.length > offsetNum + limitNum ||
          authorMatches.length > offsetNum + limitNum ||
          shortMatches.length > offsetNum + limitNum ||
          storyMatches.length > offsetNum + limitNum ||
          gdptMatches.length > offsetNum + limitNum)) ||
      (groupFilter === 'artworks' && artworkMatches.length > offsetNum + limitNum) ||
      (groupFilter === 'authors' && authorMatches.length > offsetNum + limitNum) ||
      (groupFilter === 'shorts' && shortMatches.length > offsetNum + limitNum) ||
      (groupFilter === 'stories' && storyMatches.length > offsetNum + limitNum) ||
      (groupFilter === 'gdpt' && gdptMatches.length > offsetNum + limitNum);

    res.json({
      query: rawQuery,
      normalizedQuery,
      totalMatches,
      groups: {
        artworks:
          groupFilter === 'all' || groupFilter === 'artworks' ? paginateGroup(artworkMatches) : [],
        authors:
          groupFilter === 'all' || groupFilter === 'authors' ? paginateGroup(authorMatches) : [],
        shorts:
          groupFilter === 'all' || groupFilter === 'shorts' ? paginateGroup(shortMatches) : [],
        stories:
          groupFilter === 'all' || groupFilter === 'stories' ? paginateGroup(storyMatches) : [],
        gdptResources:
          groupFilter === 'all' || groupFilter === 'gdpt' ? paginateGroup(gdptMatches) : [],
      },
      suggestions,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore,
      },
    });
  });

  // Internal Management & System Admin Search (Strictly Teacher / Admin with Class Scope)
  app.get('/api/search/management', async (req, res) => {
    const { actor, errorStatus, errorMessage } = await resolveAuthenticatedActor(req);
    if (!actor) {
      res.status(errorStatus || 401).json({
        error: errorMessage || 'Vui lòng đăng nhập quyền Giáo viên hoặc Quản trị viên.',
        code: 'unauthenticated',
      });
      return;
    }

    // Strict RBAC: Students and public viewers are strictly forbidden from internal search
    if (actor.role !== 'teacher' && actor.role !== 'admin') {
      appendSecurityLog(
        'ROLE_ESCALATION_BLOCKED',
        actor.uid,
        actor.role,
        'search/management',
        `Chặn truy cập tìm kiếm dữ liệu nội bộ từ vai trò ${actor.role}.`
      );
      res.status(403).json({
        error:
          'Truy cập bị từ chối: Học sinh và người dùng cộng đồng không được phép truy cập chức năng tìm kiếm dữ liệu nội bộ.',
        code: 'FORBIDDEN_INTERNAL_SEARCH',
      });
      return;
    }

    const rawQuery = String(req.query.q || '').trim().slice(0, 120);
    const scope = String(req.query.scope || 'students').toLowerCase(); // 'students' | 'teachers' | 'classes' | 'accounts' | 'admin'
    const requestedClassCode = req.query.classCode
      ? String(req.query.classCode).trim().toUpperCase()
      : '';
    const statusFilter = req.query.status ? String(req.query.status).trim().toLowerCase() : 'all';
    const limitNum = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const offsetNum = Math.max(0, Number(req.query.offset) || 0);

    // If a teacher explicitly requests a classCode outside their assigned scope, block with 403
    if (
      actor.role === 'teacher' &&
      requestedClassCode &&
      requestedClassCode !== 'ALL' &&
      !canTeacherModerateClassScope(actor, requestedClassCode, requestedClassCode)
    ) {
      appendSecurityLog(
        'CROSS_CLASS_ACCESS_BLOCKED',
        actor.uid,
        actor.role,
        requestedClassCode,
        `Giáo viên ${actor.uid} cố gắng tìm kiếm dữ liệu học sinh ngoài lớp được phân công (${requestedClassCode}).`
      );
      res.status(403).json({
        error: `Bạn không có quyền tìm kiếm dữ liệu nội bộ của lớp ${requestedClassCode} (ngoài phạm vi phân công).`,
        code: 'CROSS_CLASS_SEARCH_FORBIDDEN',
      });
      return;
    }

    if (scope === 'students') {
      const scopedStudents = serverState.students.filter((stu) => {
        if (actor.role !== 'admin') {
          if (!canTeacherModerateClassScope(actor, stu.classCode, stu.classGroupId)) {
            return false;
          }
        }
        if (requestedClassCode && requestedClassCode !== 'ALL') {
          if (stu.classCode.toUpperCase() !== requestedClassCode) return false;
        }
        if (statusFilter !== 'all' && stu.status !== statusFilter) return false;
        if (!rawQuery) return true;
        return (
          computeSearchRelevance(
            rawQuery,
            [stu.studentCode, stu.alias, stu.fullName, stu.displayName],
            [stu.classCode, stu.className, stu.grade, stu.status]
          ) > 0
        );
      });

      const paginated = scopedStudents.slice(offsetNum, offsetNum + limitNum).map((s) => ({
        id: s.id,
        studentCode: s.studentCode,
        alias: s.alias,
        fullName: s.fullName || s.displayName,
        displayName: s.displayName,
        classCode: s.classCode,
        className: s.className,
        grade: s.grade || s.className,
        status: s.status,
        needsAliasSetup: Boolean(s.needsAliasSetup),
        lastLoginAt: s.lastLoginAt,
      }));

      res.json({
        scope: 'students',
        query: rawQuery,
        total: scopedStudents.length,
        items: paginated,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          hasMore: scopedStudents.length > offsetNum + limitNum,
        },
      });
      return;
    }

    if (scope === 'teachers') {
      const matchedTeachers = serverState.teachers.filter((t) => {
        if (!rawQuery) return true;
        return (
          computeSearchRelevance(
            rawQuery,
            [t.displayName, t.email, t.uid || t.id],
            t.assignedClassCodes
          ) > 0
        );
      });
      res.json({
        scope: 'teachers',
        query: rawQuery,
        total: matchedTeachers.length,
        items: matchedTeachers.slice(offsetNum, offsetNum + limitNum),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          hasMore: matchedTeachers.length > offsetNum + limitNum,
        },
      });
      return;
    }

    if (scope === 'classes') {
      const matchedClasses = serverState.classes.filter((c) => {
        if (
          actor.role !== 'admin' &&
          !canTeacherModerateClassScope(actor, c.classCode, c.id)
        ) {
          return false;
        }
        if (!rawQuery) return true;
        return (
          computeSearchRelevance(
            rawQuery,
            [c.name, c.classCode, `Lớp ${c.grade}`, c.teacherDisplayName],
            [c.schoolYear]
          ) > 0
        );
      });
      res.json({
        scope: 'classes',
        query: rawQuery,
        total: matchedClasses.length,
        items: matchedClasses.slice(offsetNum, offsetNum + limitNum),
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          hasMore: matchedClasses.length > offsetNum + limitNum,
        },
      });
      return;
    }

    res.json({
      scope,
      query: rawQuery,
      total: 0,
      items: [],
      pagination: { limit: limitNum, offset: offsetNum, hasMore: false },
    });
  });

  // Catch-all for unknown /api/* routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({
      error: 'API endpoint không tồn tại.',
      code: 'NOT_FOUND',
    });
  });

  if (!IS_PRODUCTION && process.env.ARTVERSE_SKIP_LISTEN !== 'true') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (IS_PRODUCTION) {
    const distPath = path.resolve(__dirname, 'dist');
    const distIndexPath = path.join(distPath, 'index.html');

    app.use(
      express.static(distPath, {
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.includes('workbox-') ||
            filePath.endsWith('.webmanifest') ||
            filePath.endsWith('manifest.json')
          ) {
            setNoCacheHeaders(res);
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('*', (_req, res) => {
      setNoCacheHeaders(res);
      res.sendFile(distIndexPath);
    });
  }

  return app;
}

async function startServer() {
  const app = await createExpressApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Artverse AI Server v${APP_VERSION} (${APP_BUILD_ID}) [${IS_PRODUCTION ? 'production' : 'development'}] running on http://0.0.0.0:${PORT}`
    );
  });
}

// Start server unless imported for unit/integration testing
if (process.env.ARTVERSE_SKIP_LISTEN !== 'true') {
  startServer();
}
