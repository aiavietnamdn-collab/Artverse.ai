/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — ARTVERSE COMMUNITY 4-Layer Moderation & Child Safety Engine
 *
 * Implements policy:
 * "TỰ ĐỘNG KIỂM DUYỆT — AN TOÀN HIỂN THỊ NGAY — RỦI RO CHỜ DUYỆT"
 * - Layer 1: Unicode-normalized Vietnamese keyword, leetspeak, & obfuscation filter
 * - Layer 2: Contextual analysis (distinguishing constructive art critique from insults/grooming)
 * - Layer 3: Anti-spam, duplicate detection, gibberish, & unsafe link guard
 * - Layer 4: Severity classification (SAFE | REVIEW | BLOCKED | CRITICAL)
 */

export type CommentModerationSeverity = 'SAFE' | 'REVIEW' | 'BLOCKED' | 'CRITICAL';

export type CommentLifecycleStatus =
  | 'pending'
  | 'published'
  | 'hidden'
  | 'rejected'
  | 'deleted';

export type ViolationCategory =
  | 'none'
  | 'profanity_insult'
  | 'bullying_appearance'
  | 'discrimination'
  | 'threat_violence'
  | 'sexual_inappropriate'
  | 'grooming_private_contact'
  | 'pii_disclosure'
  | 'spam_advertising_link'
  | 'repeated_harassment'
  | 'ai_unavailable_fallback';

export interface ModerationContextInput {
  content: string;
  authorUid: string;
  authorRole: 'student' | 'teacher' | 'admin';
  artworkId: string;
  artworkAuthorUid?: string;
  classCode?: string;
  recentAuthorComments?: Array<{
    content: string;
    artworkId: string;
    createdAtMs: number;
  }>;
  recentArtworkNegativeAuthorUids?: string[];
  customBlockedKeywords?: string[];
  customReviewKeywords?: string[];
  aiModerationSimulatedOffline?: boolean;
}

export interface ModerationEvaluationResult {
  severity: CommentModerationSeverity;
  decidedStatus: CommentLifecycleStatus;
  categories: ViolationCategory[];
  confidence: number; // 0.0 -> 1.0
  studentFriendlyMessage: string;
  internalAuditReason: string;
  isConstructiveArtCritique: boolean;
  requiresPriorityAlert: boolean;
  canStudentAppeal: boolean;
}

/**
 * Normalize Vietnamese text for evasion-resistant matching:
 * - Lowercase & NFC normalize
 * - Convert common leetspeak numbers/symbols used to bypass filters
 * - Collapse punctuation separators inserted between letters (e.g., "n.g.u", "x-ấ-u")
 * - Collapse elongated repeated characters (e.g., "xấuuuuuu" -> "xấu")
 */
export function normalizeVietnameseText(raw: string): {
  normalizedWithTones: string;
  asciiToneStripped: string;
  compactAlphaNum: string;
} {
  const nfc = raw.normalize('NFC').toLowerCase().trim();

  // Replace common leetspeak substitutions when adjacent to letters
  const deLeeted = nfc
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');

  // Collapse dots, dashes, underscores, or stars placed between single letters (e.g. "n.g.u" -> "ngu")
  const deSeparated = deLeeted.replace(
    /\b([a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ])\s*[._\-*+]+\s*(?=[a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]\b)/g,
    '$1'
  );

  // Collapse 3+ repeated identical characters down to 1 (e.g., "xấuuuu" -> "xấu")
  const deRepeated = deSeparated.replace(/(.)\1{2,}/g, '$1');

  // Normalize whitespace
  const normalizedWithTones = deRepeated
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip Vietnamese diacritics for tone-evasion checks
  const asciiToneStripped = normalizedWithTones
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  const compactAlphaNum = asciiToneStripped.replace(/\s+/g, '');

  return {
    normalizedWithTones,
    asciiToneStripped,
    compactAlphaNum,
  };
}

// ============================================================================
// DICTIONARIES FOR 4-LAYER MODERATION
// ============================================================================

// Critical Child Safety: Grooming, solicitation, threats, self-harm, severe violence
const CRITICAL_GROOMING_AND_THREAT_PATTERNS: Array<{
  pattern: RegExp;
  category: ViolationCategory;
  reason: string;
}> = [
  {
    pattern:
      /\b(cho\s*(minh|anh|chi|em|to)\s*(xin\s*)?(so\s*dien\s*thoai|sdt|zalo|facebook|fb|insta|telegram|tiktok)|ket\s*ban\s*(zalo|fb|facebook|rieng)|nhan\s*tin\s*rieng|noi\s*chuyen\s*rieng|gap\s*nhau\s*o\s*ngoai|hen\s*gap\s*rieng|gui\s*anh\s*rieng|chup\s*anh\s*nguoi\s*that)\b/i,
    category: 'grooming_private_contact',
    reason: 'Phát hiện hành vi xin thông tin liên hệ riêng tư hoặc rủ rê trò chuyện ngoài nền tảng.',
  },
  {
    pattern:
      /\b(nha\s*(ban|em|cau|may)\s*o\s*(dau|duong\s*nao|so\s*may)|dia\s*chi\s*nha|hoc\s*truong\s*nao\s*lop\s*may\s*ngoai\s*doi)\b/i,
    category: 'grooming_private_contact',
    reason: 'Phát hiện hành vi dò hỏi địa chỉ nhà hoặc thông tin nhận diện cá nhân của học sinh.',
  },
  {
    pattern:
      /\b(danh\s*(chet|nhau|may|ban)|giet|chem|chan\s*duong|doi\s*o\s*cong\s*truong|tu\s*tu|tu\s*sat|rach\s*tay)\b/i,
    category: 'threat_violence',
    reason: 'Phát hiện lời lẽ đe dọa bạo lực hoặc gây nguy hại an toàn học sinh.',
  },
  {
    pattern:
      /\b(sex|khiêu\s*dâm|khieu\s*dam|18\+|anh\s*nong|khoa\s*than|ấu\s*dâm|au\s*dam|hentai|porn|xxx)\b/i,
    category: 'sexual_inappropriate',
    reason: 'Phát hiện nội dung nhạy cảm không phù hợp với lứa tuổi học đường.',
  },
];

// Direct PII patterns (Phone numbers, Emails, Home Addresses, Social Links)
const PII_DETECTION_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    // Vietnamese mobile & landline phone numbers (including spaced/dotted formats like 0912.345.678 or +84 912 345 678)
    pattern: /(?:\+?84|0)(?:[\s.\-_]*\d){8,10}\b/,
    reason: 'Bình luận chứa số điện thoại cá nhân.',
  },
  {
    // Email addresses
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    reason: 'Bình luận chứa địa chỉ email cá nhân.',
  },
  {
    // Street / home address patterns in Vietnamese
    pattern:
      /\b(so\s*nha\s*\d+|ngach\s*\d+|hem\s*\d+\/\d+|duong\s+[a-z0-9\s]{3,20}\s*phuong\s+[a-z0-9\s]{2,15})\b/i,
    reason: 'Bình luận chứa địa chỉ nhà riêng.',
  },
  {
    // Social media handles / external chat invites
    pattern:
      /\b(zalo\.me|t\.me|m\.me|fb\.com|facebook\.com|instagram\.com|tiktok\.com|id\s*zalo|nick\s*fb|nick\s*zalo|add\s*zalo)\b/i,
    reason: 'Bình luận chứa liên kết hoặc tài khoản mạng xã hội cá nhân.',
  },
];

// Profanity, insults, body-shaming, discrimination (Blocked)
const BLOCKED_PROFANITY_AND_BULLYING_PATTERNS: Array<{
  pattern: RegExp;
  category: ViolationCategory;
  reason: string;
}> = [
  {
    pattern:
      /\b(dm|dkm|dmm|vcl|vl|cc|clm|deo|dit|du\s*ma|ngu\s*ngoc|do\s*ngu|oc\s*cho|mat\s*day|vo\s*hoc|khon\s*nan|rac\s*ruoi|phe\s*vat|do\s*dien|tam\s*than)\b/i,
    category: 'profanity_insult',
    reason: 'Sử dụng từ ngữ chửi tục, xúc phạm hoặc thiếu văn minh.',
  },
  {
    pattern:
      /\b(xau\s*nhu\s*(nguoi\s*ve|ma|cho|quy)|ve\s*nhu\s*(rac|tre\s*len\s*ba|ga\s*boi)|nhin\s*(mat|nguoi)\s*(beo|map|lun|xau\s*xi|gom\s*ghiec)|do\s*(beo|map\s*u|xau\s*xi)|ve\s*xau\s*the\s*nay\s*ma\s*cung\s*dang|Xau\s*vai)\b/i,
    category: 'bullying_appearance',
    reason: 'Chế giễu ngoại hình hoặc miệt thị người vẽ.',
  },
  {
    pattern:
      /\b(do\s*nha\s*ngheo|dan\s*toc\s*thieu\s*so\s*ngu|ky\s*thi|phan\s*biet\s*vung\s*mien|do\s*que\s*mua|khong\s*ai\s*them\s*choi\s*voi\s*may|tay\s*chay\s*no)\b/i,
    category: 'discrimination',
    reason: 'Nội dung mang tính phân biệt đối xử hoặc cô lập bạn học.',
  },
];

// Constructive Art Vocabulary (Layer 2 Context Whitelist)
// Words like "tối", "đậm", "nhạt", "thô", "lệch", "chưa đúng", "cứng", "mờ" are SAFE when used in art critique context!
const ART_CRITIQUE_CONTEXT_TERMS = [
  'phoi canh',
  'bo cuc',
  'mau sac',
  'sac do',
  'duong net',
  'mang mau',
  'anh sang',
  'bong do',
  'tuong phan',
  'chi tiet',
  'hinh khoi',
  'ti le',
  'hoa sac',
  'co ve',
  'mau nuoc',
  'sap dau',
  'chi mau',
  'nen tranh',
  'goc tranh',
  'thu lai nhe',
  'co gang',
  'gop y',
];

// Ambiguous / Mildly negative expressions that require Teacher REVIEW (not auto-blocked, not auto-published)
const REVIEW_AMBIGUOUS_PATTERNS: Array<{
  pattern: RegExp;
  category: ViolationCategory;
  reason: string;
}> = [
  {
    pattern:
      /\b(tranh\s*nay\s*xau\s*qua|nhin\s*chan\s*qua|ve\s*sai\s*het\s*roi|chang\s*ra\s*gi|xau\s*lam|kem\s*qua|khong\s*dep\s*ti\s*nao|hoi\s*xau|ky\s*cuc|ky\s*quac|lon\s*xon)\b/i,
    category: 'bullying_appearance',
    reason: 'Nhận xét tiêu cực thiếu tính xây dựng, cần giáo viên xem xét ngữ cảnh.',
  },
];

// Spam & External Link Patterns (Layer 3)
const UNSAFE_LINK_AND_AD_PATTERN =
  /\b(https?:\/\/|www\.|bit\.ly|tinyurl\.com|t\.me\/|shopee\.vn|lazada\.vn|kiem\s*tien\s*online|nhan\s*qua\s*mien\s*phi|click\s*vao\s*link|hack\s*game|nap\s*the)\b/i;

/**
 * Layer 1-4 Synchronous Evaluation Function
 */
export function evaluateCommentModeration(
  input: ModerationContextInput
): ModerationEvaluationResult {
  const rawContent = (input.content || '').trim();

  // Basic empty or length check
  if (!rawContent || rawContent.length < 2) {
    return {
      severity: 'BLOCKED',
      decidedStatus: 'rejected',
      categories: ['spam_advertising_link'],
      confidence: 1.0,
      studentFriendlyMessage:
        'Em vui lòng viết nội dung cảm nhận rõ ràng hơn (tối thiểu 2 ký tự) trước khi gửi nhé!',
      internalAuditReason: 'Bình luận trống hoặc quá ngắn (< 2 ký tự).',
      isConstructiveArtCritique: false,
      requiresPriorityAlert: false,
      canStudentAppeal: false,
    };
  }

  if (rawContent.length > 800) {
    return {
      severity: 'BLOCKED',
      decidedStatus: 'rejected',
      categories: ['spam_advertising_link'],
      confidence: 1.0,
      studentFriendlyMessage:
        'Bình luận của em hơi dài (tối đa 800 ký tự). Em hãy tóm tắt cảm nhận ngắn gọn hơn nhé!',
      internalAuditReason: 'Bình luận vượt quá độ dài tối đa 800 ký tự.',
      isConstructiveArtCritique: false,
      requiresPriorityAlert: false,
      canStudentAppeal: false,
    };
  }

  const { normalizedWithTones, asciiToneStripped, compactAlphaNum } =
    normalizeVietnameseText(rawContent);

  // ==========================================================================
  // LAYER 3A: GIBBERISH / MEANINGLESS CHARACTER SPAM CHECK
  // ==========================================================================
  const hasLetters = /\p{L}/u.test(rawContent);
  const uniqueChars = new Set(compactAlphaNum.split('')).size;
  const words = asciiToneStripped.split(/\s+/).filter(Boolean);
  const hasLongGibberishWord = words.some((w) => w.length >= 15 && !/^https?/i.test(w));
  if (
    !hasLetters ||
    (compactAlphaNum.length >= 8 && uniqueChars <= 2) ||
    hasLongGibberishWord
  ) {
    return {
      severity: 'BLOCKED',
      decidedStatus: 'rejected',
      categories: ['spam_advertising_link'],
      confidence: 0.96,
      studentFriendlyMessage:
        'Bình luận chỉ chứa ký tự lặp hoặc chưa rõ ý nghĩa. Em hãy viết lời nhận xét chân thành bằng tiếng Việt nhé!',
      internalAuditReason: 'Phát hiện chuỗi ký tự vô nghĩa hoặc spam ký tự lặp.',
      isConstructiveArtCritique: false,
      requiresPriorityAlert: false,
      canStudentAppeal: false,
    };
  }

  // ==========================================================================
  // LAYER 3B: DUPLICATE & RAPID SPAM CHECK
  // ==========================================================================
  if (input.recentAuthorComments && input.recentAuthorComments.length > 0) {
    const now = Date.now();
    const sameContentRecent = input.recentAuthorComments.filter(
      (c) =>
        now - c.createdAtMs < 5 * 60_000 &&
        normalizeVietnameseText(c.content).asciiToneStripped === asciiToneStripped
    );
    if (sameContentRecent.length >= 1) {
      return {
        severity: 'BLOCKED',
        decidedStatus: 'rejected',
        categories: ['spam_advertising_link'],
        confidence: 0.99,
        studentFriendlyMessage:
          'Em vừa gửi một bình luận có nội dung tương tự rồi. Hãy chia sẻ thêm góc nhìn mới nhé!',
        internalAuditReason: 'Chặn gửi trùng bình luận lặp lại liên tiếp trong 5 phút.',
        isConstructiveArtCritique: false,
        requiresPriorityAlert: false,
        canStudentAppeal: false,
      };
    }

    const burstLastMinute = input.recentAuthorComments.filter(
      (c) => now - c.createdAtMs < 60_000
    );
    if (burstLastMinute.length >= 5) {
      return {
        severity: 'BLOCKED',
        decidedStatus: 'rejected',
        categories: ['spam_advertising_link'],
        confidence: 0.99,
        studentFriendlyMessage:
          'Em đang gửi bình luận hơi nhanh. Hãy dừng lại ngắm tranh thêm ít phút rồi bình luận tiếp nhé!',
        internalAuditReason: 'Vượt giới hạn tốc độ gửi bình luận (> 5 bình luận / phút).',
        isConstructiveArtCritique: false,
        requiresPriorityAlert: false,
        canStudentAppeal: false,
      };
    }
  }

  // ==========================================================================
  // LAYER 1A & SECTION B: CRITICAL CHILD SAFETY & PII PROTECTION
  // ==========================================================================
  for (const rule of CRITICAL_GROOMING_AND_THREAT_PATTERNS) {
    if (rule.pattern.test(asciiToneStripped) || rule.pattern.test(normalizedWithTones)) {
      return {
        severity: 'CRITICAL',
        decidedStatus: 'rejected',
        categories: [rule.category],
        confidence: 0.98,
        studentFriendlyMessage:
          'Để bảo vệ an toàn cho em và các bạn trong trường, hệ thống không cho phép đăng nội dung này.',
        internalAuditReason: `[CRITICAL] ${rule.reason}`,
        isConstructiveArtCritique: false,
        requiresPriorityAlert: true,
        canStudentAppeal: false,
      };
    }
  }

  for (const piiRule of PII_DETECTION_PATTERNS) {
    if (piiRule.pattern.test(rawContent) || piiRule.pattern.test(asciiToneStripped)) {
      return {
        severity: 'CRITICAL',
        decidedStatus: 'rejected',
        categories: ['pii_disclosure'],
        confidence: 0.97,
        studentFriendlyMessage:
          'Để bảo vệ quyền riêng tư của học sinh, em không nên chia sẻ số điện thoại, địa chỉ nhà, email hoặc tài khoản mạng xã hội trong bình luận công khai nhé!',
        internalAuditReason: `[CRITICAL - PII] ${piiRule.reason}`,
        isConstructiveArtCritique: false,
        requiresPriorityAlert: true,
        canStudentAppeal: true,
      };
    }
  }

  // ==========================================================================
  // LAYER 3C: UNSAFE LINKS & ADVERTISING SPAM
  // ==========================================================================
  if (UNSAFE_LINK_AND_AD_PATTERN.test(rawContent) || UNSAFE_LINK_AND_AD_PATTERN.test(asciiToneStripped)) {
    return {
      severity: 'BLOCKED',
      decidedStatus: 'rejected',
      categories: ['spam_advertising_link'],
      confidence: 0.95,
      studentFriendlyMessage:
        'Không gian Triển lãm Mĩ thuật không cho phép chèn đường dẫn bên ngoài hoặc nội dung quảng cáo. Em hãy chia sẻ cảm nhận bằng lời viết nhé!',
      internalAuditReason: 'Chặn đường dẫn liên kết ngoài (URL) hoặc quảng cáo spam.',
      isConstructiveArtCritique: false,
      requiresPriorityAlert: false,
      canStudentAppeal: false,
    };
  }

  // ==========================================================================
  // LAYER 1B: CUSTOM ADMIN BLOCKED KEYWORDS & BUILT-IN PROFANITY/BULLYING
  // ==========================================================================
  if (input.customBlockedKeywords && input.customBlockedKeywords.length > 0) {
    for (const kw of input.customBlockedKeywords) {
      const normKw = normalizeVietnameseText(kw).asciiToneStripped;
      if (normKw && asciiToneStripped.includes(normKw)) {
        return {
          severity: 'BLOCKED',
          decidedStatus: 'rejected',
          categories: ['profanity_insult'],
          confidence: 0.95,
          studentFriendlyMessage:
            'Bình luận có chứa từ ngữ chưa phù hợp với quy tắc ứng xử văn minh của bảo tàng. Em hãy diễn đạt nhẹ nhàng và tích cực hơn nhé!',
          internalAuditReason: `Khớp từ khóa cấm trong danh mục quản trị.`,
          isConstructiveArtCritique: false,
          requiresPriorityAlert: false,
          canStudentAppeal: true,
        };
      }
    }
  }

  for (const rule of BLOCKED_PROFANITY_AND_BULLYING_PATTERNS) {
    if (rule.pattern.test(asciiToneStripped) || rule.pattern.test(normalizedWithTones)) {
      return {
        severity: 'BLOCKED',
        decidedStatus: 'rejected',
        categories: [rule.category],
        confidence: 0.95,
        studentFriendlyMessage:
          'Trong không gian nghệ thuật học đường, chúng mình luôn tôn trọng và khích lệ lẫn nhau. Em hãy thay đổi cách diễn đạt lịch sự, thân thiện hơn nhé!',
        internalAuditReason: `[BLOCKED] ${rule.reason}`,
        isConstructiveArtCritique: false,
        requiresPriorityAlert: false,
        canStudentAppeal: true,
      };
    }
  }

  // ==========================================================================
  // LAYER 2: CONTEXTUAL ANALYSIS (ART CRITIQUE VS. HARASSMENT / REVIEW)
  // ==========================================================================
  const matchedArtCritiqueTerms = ART_CRITIQUE_CONTEXT_TERMS.filter((term) =>
    asciiToneStripped.includes(term)
  );
  const isConstructiveArtCritique = matchedArtCritiqueTerms.length > 0;

  // Check custom review keywords configured by Admin
  if (input.customReviewKeywords && input.customReviewKeywords.length > 0) {
    for (const kw of input.customReviewKeywords) {
      const normKw = normalizeVietnameseText(kw).asciiToneStripped;
      if (normKw && asciiToneStripped.includes(normKw) && !isConstructiveArtCritique) {
        return {
          severity: 'REVIEW',
          decidedStatus: 'pending',
          categories: ['bullying_appearance'],
          confidence: 0.78,
          studentFriendlyMessage:
            'Bình luận của em đã được ghi nhận và đang chờ giáo viên Mĩ thuật xem qua trước khi hiển thị công khai nhé!',
          internalAuditReason: 'Chứa từ khóa thuộc nhóm cần giáo viên xem xét ngữ cảnh.',
          isConstructiveArtCritique: false,
          requiresPriorityAlert: false,
          canStudentAppeal: true,
        };
      }
    }
  }

  // Check ambiguous negative patterns (unless clearly grounded in constructive art terms)
  for (const revRule of REVIEW_AMBIGUOUS_PATTERNS) {
    if (revRule.pattern.test(asciiToneStripped) && !isConstructiveArtCritique) {
      return {
        severity: 'REVIEW',
        decidedStatus: 'pending',
        categories: [revRule.category],
        confidence: 0.82,
        studentFriendlyMessage:
          'Bình luận của em đã được chuyển tới giáo viên Mĩ thuật để xem xét trước khi hiển thị nhằm đảm bảo tinh thần góp ý tích cực.',
        internalAuditReason: `[REVIEW] ${revRule.reason}`,
        isConstructiveArtCritique: false,
        requiresPriorityAlert: false,
        canStudentAppeal: true,
      };
    }
  }

  // Section A: Anti-bullying repeated targeting / multi-account pile-on detection
  if (input.recentArtworkNegativeAuthorUids && input.recentArtworkNegativeAuthorUids.length >= 2) {
    const hasMildCritiqueWords =
      /\b(chua\s*dep|hoi\s*xau|loi|sai|kem|thieu|chua\s*dung)\b/i.test(asciiToneStripped);
    if (hasMildCritiqueWords && !isConstructiveArtCritique) {
      return {
        severity: 'REVIEW',
        decidedStatus: 'pending',
        categories: ['repeated_harassment'],
        confidence: 0.8,
        studentFriendlyMessage:
          'Bình luận của em đang được giáo viên Mĩ thuật xem xét trước khi hiển thị công khai.',
        internalAuditReason:
          '[ANTI-BULLYING GUARD] Phát hiện nhiều bình luận nhận xét tiêu cực liên tiếp nhắm vào cùng một tác phẩm học sinh; tạm giữ để giáo viên kiểm tra.',
        isConstructiveArtCritique,
        requiresPriorityAlert: true,
        canStudentAppeal: true,
      };
    }
  }

  // Section F: If AI moderation service is offline/disconnected and comment contains nuanced/critique words,
  // hold for manual review if ambiguous; only auto-publish clearly safe/constructive comments.
  if (input.aiModerationSimulatedOffline) {
    const hasPotentiallyNuancedWords =
      /\b(xau|kem|sai|loi|ky|la\s*qua|buon\s*cuoi|ngoc|ky\s*cuc|ki\s*cuc|roi\s*mat|lon\s*xon|ky\s*quac)\b/i.test(
        asciiToneStripped
      );
    if (hasPotentiallyNuancedWords && !isConstructiveArtCritique) {
      return {
        severity: 'REVIEW',
        decidedStatus: 'pending',
        categories: ['ai_unavailable_fallback'],
        confidence: 0.65,
        studentFriendlyMessage:
          'Hệ thống thẩm định thông minh đang bảo trì nên bình luận của em được chuyển sang chế độ chờ giáo viên duyệt thủ công nhé!',
        internalAuditReason:
          '[AI FALLBACK] Dịch vụ AI Moderation mất kết nối; tự động chuyển bình luận có từ ngữ nhạy cảm vào hàng đợi duyệt thủ công (không tự động công khai).',
        isConstructiveArtCritique: false,
        requiresPriorityAlert: false,
        canStudentAppeal: true,
      };
    }
  }

  // ==========================================================================
  // LAYER 4: SAFE -> PUBLISHED IMMEDIATELY
  // ==========================================================================
  return {
    severity: 'SAFE',
    decidedStatus: 'published',
    categories: ['none'],
    confidence: 0.96,
    studentFriendlyMessage: 'Cảm ơn em đã gửi lời chia sẻ tích cực cho tác phẩm!',
    internalAuditReason: isConstructiveArtCritique
      ? 'Bình luận góp ý nghệ thuật mang tính xây dựng (SAFE -> published).'
      : 'Bình luận an toàn, tích cực (SAFE -> published).',
    isConstructiveArtCritique,
    requiresPriorityAlert: false,
    canStudentAppeal: false,
  };
}
