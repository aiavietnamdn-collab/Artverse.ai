import { 
  CommunityArtwork, 
  ArtworkComment, 
  ContentReport, 
  ClassGroup, 
  ArtLesson, 
  PositiveReactionKey, 
  getRandomAnonymousNickname 
} from '../types/communityArt';

// ====================================================
// 1. SAFETY & MODERATION FILTERS (PROTECT MINORS)
// ====================================================

const INAPPROPRIATE_KEYWORDS = [
  'chửi', 'tục', 'ngu', 'dốt', 'xấu xí', 'vô dụng', 'chết tiệt', 
  'đồ con hoang', 'ghét', 'đánh nhau', 'bắt nạt'
];

export interface SafetyCheckResult {
  isSafe: boolean;
  flagReason?: string;
}

export function checkTextSafety(text: string): SafetyCheckResult {
  const lower = text.toLowerCase();

  // 1. Check for dangerous external URLs
  if (/https?:\/\/|www\./i.test(text)) {
    return {
      isSafe: false,
      flagReason: 'Chứa liên kết URL bên ngoài (Tiềm ẩn nguy cơ an toàn cho học sinh).'
    };
  }

  // 2. Check for personal phone numbers (10 digits starting with 0)
  if (/(?:\+84|0)(?:\d[\s.-]?){9,10}\b/.test(text)) {
    return {
      isSafe: false,
      flagReason: 'Phát hiện số điện thoại (Vi phạm quy tắc bảo vệ danh tính cá nhân).'
    };
  }

  // 3. Check for email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
    return {
      isSafe: false,
      flagReason: 'Phát hiện địa chỉ email cá nhân.'
    };
  }

  // 4. Inappropriate language / bullying keywords
  for (const word of INAPPROPRIATE_KEYWORDS) {
    if (lower.includes(word)) {
      return {
        isSafe: false,
        flagReason: 'Phát hiện từ ngữ chưa chuẩn mực hoặc mang tính bắt nạt.'
      };
    }
  }

  return { isSafe: true };
}

// ====================================================
// 2. CRYPTO & TOKEN HELPERS
// ====================================================

export function generateUnguessableShareToken(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  let token = 'share-';
  for (let i = 0; i < 24; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

export function generateAuthorKey(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(20);
  window.crypto.getRandomValues(array);
  let key = 'auth-';
  for (let i = 0; i < 20; i++) {
    key += chars[array[i] % chars.length];
  }
  return key;
}

// ====================================================
// 3. RATE LIMITING FOR POSITIVE REACTIONS
// ====================================================

const reactionRateLimitMap = new Map<string, number>();

export function checkReactionRateLimit(artworkId: string, reactionKey: PositiveReactionKey): boolean {
  const key = `${artworkId}_${reactionKey}`;
  const now = Date.now();
  const lastClick = reactionRateLimitMap.get(key) || 0;

  // Rate limit: 1 reaction of the same type per artwork every 5 seconds
  if (now - lastClick < 5000) {
    return false; // too fast!
  }

  reactionRateLimitMap.set(key, now);
  return true;
}
