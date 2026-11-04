/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Kiểu dữ liệu Thư viện Nghệ thuật Cộng đồng, Phân quyền, Tài khoản Học sinh (Excel 4 cột), Bài học, Slide & Video
 */

export type UserRole = 'viewer' | 'student' | 'contributor' | 'teacher' | 'moderator' | 'admin';

export type UploadStateMachine =
  | 'QUEUED'
  | 'VALIDATING'
  | 'UPLOADING'
  | 'STORAGE_COMPLETED'
  | 'GETTING_URL'
  | 'GETTING_DOWNLOAD_URL'
  | 'SAVING_METADATA'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'ERROR'
  | 'CANCELLED'
  | 'RETRYING';

export const UPLOAD_STATE_LABELS: Record<UploadStateMachine, string> = {
  QUEUED: 'Đang chờ (QUEUED)',
  VALIDATING: 'Đang kiểm tra file (VALIDATING)',
  UPLOADING: 'Đang truyền file (UPLOADING)',
  STORAGE_COMPLETED: 'Đã lưu vào Storage (STORAGE_COMPLETED)',
  GETTING_URL: 'Đang lấy URL (GETTING_DOWNLOAD_URL)',
  GETTING_DOWNLOAD_URL: 'Đang lấy URL (GETTING_DOWNLOAD_URL)',
  SAVING_METADATA: 'Đang ghi Firestore (SAVING_METADATA)',
  VERIFYING: 'Đang kiểm tra lại dữ liệu (VERIFYING)',
  SUCCESS: 'Hoàn thành toàn bộ (SUCCESS)',
  ERROR: 'Thất bại (ERROR)',
  CANCELLED: 'Đã hủy tải lên (CANCELLED)',
  RETRYING: 'Đang thử lại (RETRYING)',
};

export type ModerationStatus = 'approved' | 'pending_moderation' | 'hidden_reported';

export type PositiveReactionType =
  | 'creative_color'
  | 'interesting_composition'
  | 'unique_idea'
  | 'dedicated_effort'
  | 'inspiring';

export type PositiveReactionKey =
  | 'unique_idea'
  | 'striking_color'
  | 'interesting_composition'
  | 'noteworthy_detail'
  | 'inspiring';

export const POSITIVE_REACTIONS_META: Record<
  PositiveReactionKey,
  {
    label: string;
    description: string;
    icon: string;
    emoji: string;
    colorClass: string;
    bgClass: string;
  }
> = {
  unique_idea: {
    label: 'Ý tưởng độc đáo',
    description: 'Cách tiếp cận chủ đề mới mẻ và giàu trí tưởng tượng',
    icon: '💡',
    emoji: '💡',
    colorClass: 'bg-purple-50 text-purple-800 border-purple-200',
    bgClass: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100',
  },
  striking_color: {
    label: 'Màu sắc nổi bật',
    description: 'Phối màu hài hòa, sinh động và giàu cảm xúc',
    icon: '🎨',
    emoji: '🎨',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
    bgClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  interesting_composition: {
    label: 'Bố cục thú vị',
    description: 'Sắp xếp mảng hình chính phụ cân đối và có chiều sâu',
    icon: '📐',
    emoji: '📐',
    colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
    bgClass: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  noteworthy_detail: {
    label: 'Chi tiết đáng chú ý',
    description: 'Đường nét tỉ mỉ, chăm chút trong từng chi tiết tạo hình',
    icon: '✨',
    emoji: '✨',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    bgClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  },
  inspiring: {
    label: 'Truyền cảm hứng',
    description: 'Lan tỏa niềm vui sáng tạo nghệ thuật tới người xem',
    icon: '🌟',
    emoji: '🌟',
    colorClass: 'bg-rose-50 text-rose-800 border-rose-200',
    bgClass: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
  },
};

export const POSITIVE_REACTION_LABELS = POSITIVE_REACTIONS_META;

/**
 * Hệ thống 5 Cảm xúc Tương tác Tác phẩm (Wonderland of Art):
 * ❤️ Yêu thích (love) | 👍 Thích (like) | 😂 Vui (haha) | 😢 Buồn (sad) | 😡 Giận (angry)
 * Mỗi tài khoản chỉ chọn tối đa 1 cảm xúc cho 1 tác phẩm tại 1 thời điểm (có thể đổi hoặc bỏ chọn).
 */
export type ArtworkEmotionKey = 'love' | 'like' | 'haha' | 'sad' | 'angry';
export type CanonicalReactionType = 'heart' | 'like' | 'laugh' | 'sad' | 'angry';

export const ARTWORK_EMOTION_ORDER: ArtworkEmotionKey[] = [
  'love',
  'like',
  'haha',
  'sad',
  'angry',
];

export const CANONICAL_REACTION_ORDER: CanonicalReactionType[] = [
  'heart',
  'like',
  'laugh',
  'sad',
  'angry',
];

export function normalizeToArtworkEmotionKey(raw: unknown): ArtworkEmotionKey | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'heart' || v === 'love') return 'love';
  if (v === 'like') return 'like';
  if (v === 'laugh' || v === 'haha') return 'haha';
  if (v === 'sad') return 'sad';
  if (v === 'angry') return 'angry';
  return null;
}

export function normalizeToCanonicalReactionType(raw: unknown): CanonicalReactionType | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'heart' || v === 'love') return 'heart';
  if (v === 'like') return 'like';
  if (v === 'laugh' || v === 'haha') return 'laugh';
  if (v === 'sad') return 'sad';
  if (v === 'angry') return 'angry';
  return null;
}

export const ARTWORK_EMOTIONS_META: Record<
  ArtworkEmotionKey,
  {
    key: ArtworkEmotionKey;
    label: string;
    emoji: string;
    activeClass: string;
    idleClass: string;
    badgeColor: string;
    activeBg: string;
    activeBorder: string;
    activeText: string;
  }
> = {
  love: {
    key: 'love',
    label: 'Yêu thích',
    emoji: '❤️',
    activeClass:
      'bg-[#FFF0F3] border-[#FF6B6B] text-[#E11D48] shadow-[0_4px_0_#FFB4B4] scale-[1.03]',
    idleClass:
      'bg-[#FFFDF9] border-[#E2E8F0] text-[#1E1B4B] hover:bg-[#FFF0F3] hover:border-[#FF6B6B]/60',
    badgeColor: 'bg-[#FF6B6B] text-white',
    activeBg: '#FFF0F3',
    activeBorder: '#FF6B6B',
    activeText: '#E11D48',
  },
  like: {
    key: 'like',
    label: 'Thích',
    emoji: '👍',
    activeClass:
      'bg-[#EFF6FF] border-[#3B82F6] text-[#1D4ED8] shadow-[0_4px_0_#93C5FD] scale-[1.03]',
    idleClass:
      'bg-[#FFFDF9] border-[#E2E8F0] text-[#1E1B4B] hover:bg-[#EFF6FF] hover:border-[#3B82F6]/60',
    badgeColor: 'bg-[#3B82F6] text-white',
    activeBg: '#EFF6FF',
    activeBorder: '#3B82F6',
    activeText: '#1D4ED8',
  },
  haha: {
    key: 'haha',
    label: 'Vui',
    emoji: '😂',
    activeClass:
      'bg-[#FFFBEB] border-[#F59E0B] text-[#B45309] shadow-[0_4px_0_#FDE68A] scale-[1.03]',
    idleClass:
      'bg-[#FFFDF9] border-[#E2E8F0] text-[#1E1B4B] hover:bg-[#FFFBEB] hover:border-[#F59E0B]/60',
    badgeColor: 'bg-[#FFD93D] text-[#1E1B4B]',
    activeBg: '#FFFBEB',
    activeBorder: '#F59E0B',
    activeText: '#B45309',
  },
  sad: {
    key: 'sad',
    label: 'Buồn',
    emoji: '😢',
    activeClass:
      'bg-[#F0F9FF] border-[#0EA5E9] text-[#0369A1] shadow-[0_4px_0_#BAE6FD] scale-[1.03]',
    idleClass:
      'bg-[#FFFDF9] border-[#E2E8F0] text-[#1E1B4B] hover:bg-[#F0F9FF] hover:border-[#0EA5E9]/60',
    badgeColor: 'bg-[#0EA5E9] text-white',
    activeBg: '#F0F9FF',
    activeBorder: '#0EA5E9',
    activeText: '#0369A1',
  },
  angry: {
    key: 'angry',
    label: 'Giận',
    emoji: '😡',
    activeClass:
      'bg-[#FFF4E6] border-[#FF8E3C] text-[#C2410C] shadow-[0_4px_0_#FFCCA0] scale-[1.03]',
    idleClass:
      'bg-[#FFFDF9] border-[#E2E8F0] text-[#1E1B4B] hover:bg-[#FFF4E6] hover:border-[#FF8E3C]/60',
    badgeColor: 'bg-[#FF8E3C] text-white',
    activeBg: '#FFF4E6',
    activeBorder: '#FF8E3C',
    activeText: '#C2410C',
  },
};

export interface PositiveReactionMeta {
  type: PositiveReactionType;
  label: string;
  emoji: string;
  badgeClass: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  code?: string;
  classCode?: string;
  description?: string;
  grade?: number | string;
  schoolYear?: string;
  teacherDisplayName?: string;
  teacherAlias?: string;
  teacherId?: string;
  createdByTeacherId?: string;
  artworkCount?: number;
  artworksCount?: number;
  lessonCount?: number;
  coverVisual?: string;
  studentCount?: number;
  isHidden?: boolean;
  createdAt?: string;
  isPublicGalleryEnabled?: boolean;
}

export type ArtClassGroup = ClassGroup;

/**
 * Thông tin lớp học do Giáo viên tạo và quản lý tài khoản học sinh (Phương án A)
 */
export interface TeacherManagedClass {
  id: string;
  classCode: string;
  name: string;
  grade: number;
  schoolYear: string;
  teacherId: string;
  teacherDisplayName: string;
  studentCount: number;
  createdAt: string;
}

/**
 * Thông tin tài khoản học sinh:
 * - studentCode (Cột A: Mã HS — Text, dùng để đăng nhập)
 * - alias (Cột B: Bí danh — Text, hiển thị trong triển lãm và cộng đồng)
 * - fullName (Cột C: Tên HS — Text, CHỈ Giáo viên phụ trách và Admin được xem, KHÔNG công khai)
 * - grade / className (Cột D: Lớp — chuẩn hóa Lớp 1 đến Lớp 9)
 */
export interface StudentAccountSummary {
  id: string;
  classCode: string;
  classGroupId: string;
  className: string;
  grade?: string;
  studentCode: string;
  alias: string;
  displayName: string; // Public-safe alias
  fullName?: string; // Private real name (ONLY visible to owning Teacher & Admin)
  needsAliasSetup?: boolean;
  role: 'student';
  status: 'active' | 'locked';
  teacherId: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt: string | null;
}

/**
 * Dòng dữ liệu xem trước khi nhập danh sách học sinh từ Excel (4 cột cố định: A=Mã HS, B=Bí danh, C=Tên HS, D=Lớp)
 */
export interface ExcelStudentPreviewRow {
  rowNumber: number;
  studentCode: string; // Text, giữ nguyên số 0 ở đầu
  alias: string; // Bí danh công khai (nếu trống sẽ yêu cầu HS tạo trong lần đăng nhập đầu)
  fullName: string; // Tên thật (chỉ GV & Admin xem)
  rawGrade: string; // Giá trị cột D gốc
  normalizedGrade: string; // Chuẩn hóa Lớp 1 .. Lớp 9
  status: 'valid_new' | 'valid_update' | 'duplicate_in_file' | 'invalid';
  errors: string[];
}

/**
 * Thẻ đăng nhập học sinh trả về DUY NHẤT 1 LẦN ngay khi giáo viên tạo tài khoản hoặc cấp lại PIN.
 * Không lưu và không bao giờ hiển thị lại PIN cũ sau khi đóng hộp thoại in thẻ.
 */
export interface StudentLoginCard {
  id: string;
  classCode: string;
  className: string;
  grade?: string;
  studentCode: string;
  alias: string;
  displayName: string;
  fullName?: string;
  initialPin: string;
  issuedAt: string;
  actionType?: 'created' | 'updated_pin_reset';
}

/**
 * Một trang Slide trong Bài học (lưu đường dẫn ảnh trên Firebase Storage + nội dung + thứ tự trong Firestore)
 */
export interface LessonSlideItem {
  id?: string;
  slideId?: string;
  lessonId?: string;
  order: number;
  title: string;
  content?: string;
  url?: string;
  storagePath?: string;
  mimeType?: string;
  fileSize?: number;
  imagePath?: string;
  imageUrl?: string;
  updatedAt?: string;
}

/**
 * Bài học Mĩ thuật lưu bền vững trong Firestore (/communityLessons/{lessonId})
 */
export interface ArtLesson {
  id: string;
  lessonId?: string;
  title: string;
  subject?: string;
  classId?: string;
  classGroupId: string;
  className?: string;
  grade?: string;
  educationLevel?: 'TIEU_HOC' | 'THCS' | 'primary' | 'secondary' | string;
  resourceCategory?: 'slide' | 'video' | 'slides' | 'videos' | string;
  teacherName?: string;
  authorName?: string;
  fileFormat?: string;
  fileSize?: number;
  topic: string;
  description?: string;
  content?: string;
  resourceIds?: string[];
  slides?: LessonSlideItem[];
  isHidden?: boolean;
  status?: 'published' | 'draft' | 'archived' | 'deleted';
  createdBy?: string;
  suggestedMaterials?: string[];
  promptQuestion?: string;
  createdAt?: string;
  updatedAt?: string;
  videoPath?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
  videoUpdatedAt?: string;
  slidePath?: string;
  slideUrl?: string;
  slideTitle?: string;
  slideFileName?: string;
  slideFileSize?: number;
  slideMimeType?: string;
  slideUpdatedAt?: string;
  referenceNote?: string;
  searchNormalized?: string;
  searchTokens?: string[];
}

export interface ArtworkVisualData {
  bgGradient: string;
  accentColor: string;
  secondaryColor: string;
  patternType:
    | 'hills'
    | 'abstract_circles'
    | 'folk_waves'
    | 'Origami_polygons'
    | 'botanical'
    | 'starry';
}

export type CommentModerationSeverity = 'SAFE' | 'REVIEW' | 'BLOCKED' | 'CRITICAL';

export type CommentStatus =
  | 'published'
  | 'pending'
  | 'hidden'
  | 'rejected'
  | 'deleted'
  | 'approved';

export interface CommentStateHistoryItem {
  fromStatus: string;
  toStatus: string;
  changedByUid: string;
  changedByName: string;
  changedByRole: 'student' | 'teacher' | 'admin' | 'system';
  reason: string;
  timestamp: string;
}

export interface CommentAppealInfo {
  status: 'none' | 'open' | 'pending' | 'approved' | 'rejected';
  appealReason?: string;
  reason?: string;
  appealedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface ArtworkComment {
  id: string;
  artworkId: string;
  artworkTitle?: string;
  classId?: string;
  classCode?: string;
  classGroupId?: string;
  authorUid?: string;
  authorNickname?: string;
  anonymousNickname?: string;
  authorAnonymousPseudonym?: string;
  authorKey?: string;
  authorRole?: 'student' | 'teacher' | 'admin' | 'viewer' | UserRole;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited?: boolean;
  editedAt?: string;
  status: CommentStatus;
  severity?: CommentModerationSeverity;
  moderationSeverity?: CommentModerationSeverity;
  confidence?: number;
  moderationConfidence?: number;
  categories?: string[];
  moderationCategories?: string[];
  moderatedBy?: string;
  moderatedAt?: string;
  moderationReason?: string;
  userFacingHint?: string;
  internalNote?: string;
  assignedToUid?: string;
  assignedToName?: string;
  replyToId?: string;
  replyToNickname?: string;
  appeal?: CommentAppealInfo;
  stateHistory?: CommentStateHistoryItem[];
}

export type CanvasVisualType = 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';

export interface ArtworkRevision {
  visualType: CanvasVisualType;
  caption: string;
  updatedAt: string;
}

export interface ArtworkModerationInfo {
  moderatedBy?: string;
  moderatedAt?: string;
  moderatorNote?: string;
  rejectionReason?: string;
  isFlaggedSensitive?: boolean;
}

export interface CommunityArtwork {
  id: string;
  artworkId?: string;
  mediaId?: string;
  mediaType?: 'image' | 'video';
  ownerKey: string;
  userId?: string;
  authorId?: string;
  authorUid?: string;
  authorAccountId?: string;
  authorAlias?: string; // Bí danh công khai, KHÔNG lưu tên thật
  authorNickname?: string; // Bí danh công khai chuẩn hóa Phần 2
  creatorAnonymousPseudonym: string; // Bí danh công khai
  title: string;
  description: string;
  materialsUsed: string;
  processNotes?: string;
  classId?: string;
  classGroupId: string;
  className: string;
  grade?: string;
  lessonId: string;
  lessonTitle: string;
  topic?: string;
  storagePath?: string; // Đường dẫn chuẩn trên Firebase Storage (image hoặc video)
  downloadURL?: string; // URL tải về chuẩn từ getDownloadURL
  thumbnailPath?: string; // Đường dẫn ảnh đại diện của ảnh/video trên Storage
  imagePath?: string; // Đường dẫn lưu trữ thực tế trên Firebase Storage
  imageUrl?: string;
  thumbnailUrl?: string;
  videoPath?: string;
  videoUrl?: string;
  fileSize?: number; // Dung lượng byte thực tế
  mimeType?: string; // Định dạng MIME thực tế (image/jpeg, video/mp4,...)
  duration?: number; // Thời lượng video (giây, <= 180s)
  width?: number;
  height?: number;
  visualType?: CanvasVisualType;
  sketchVisualType?: CanvasVisualType;
  sketchImageUrl?: string;
  sketchNotes?: string;
  revisions?: ArtworkRevision[];
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';
  shareStatus: 'private' | 'shared';
  shareToken: string;
  moderation: ArtworkModerationInfo;
  reactions: Record<PositiveReactionKey, number>;
  emotionCounts?: Partial<Record<ArtworkEmotionKey, number>>;
  emotionUsers?: Record<string, ArtworkEmotionKey>;
  comments?: ArtworkComment[];
  commentsCount?: number;
  uploadedDate?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
  isAutoPublished?: boolean;
  publishedByTeacherId?: string;
  teacherName?: string;
  storageLocation?: 'cloud' | 'local' | 'firestore_cloud' | 'local_memory' | 'firebase_storage';
  inspectionSummary?: PrePublishInspectionResult;
  inspectionResult?: PrePublishInspectionResult;
  searchNormalized?: string;
  searchTokens?: string[];
}

export interface StorageUploadRegistryItem {
  mediaId: string;
  mediaType: 'image' | 'video';
  storagePath: string;
  downloadURL: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  fileSize: number;
  mimeType: string;
  duration?: number;
  title?: string;
  classId?: string;
  grade?: string;
  authorUid?: string;
  authorNickname?: string;
  uploadedAt: string;
  firestoreSaved: boolean;
  status: 'uploaded_only' | 'verified' | 'failed' | 'deleted';
  errorReason?: string;
}

export interface MediaDeletionAuditEntry {
  id: string;
  mediaId: string;
  title: string;
  mediaType: 'image' | 'video';
  storagePath: string;
  thumbnailPath?: string;
  fileSize: number;
  classId: string;
  grade: string;
  authorNickname: string;
  deletedByUid: string;
  deletedByRole: string;
  deletedAt: string;
  reason: string;
  storageDeleted: boolean;
  firestoreDeleted: boolean;
  backupSnapshot?: CommunityArtwork;
}

export interface StorageQuotaConfig {
  maxStorageBytes: number; // Mặc định 5GB (5 * 1024 * 1024 * 1024) hoặc tùy chỉnh
  warnThreshold70: number; // 0.70
  warnThreshold85: number; // 0.85
  warnThreshold95: number; // 0.95
  updatedAt: string;
  updatedBy?: string;
}

export type CommunityArtworkItem = CommunityArtwork;

export interface PrePublishInspectionResult {
  passedAllChecks?: boolean;
  canAutoPublish: boolean;
  fileValid: boolean;
  exifStripped: boolean;
  noStudentFaceOrIdDetected?: boolean;
  noSensitiveTextDetected?: boolean;
  noInappropriateContent?: boolean;
  teacherAuthorized?: boolean;
  classPermissionValid?: boolean;
  mimeType?: string;
  width?: number;
  height?: number;
  fileSizeKb?: number;
  fileSizeBytes?: number;
  faceDetected?: boolean;
  faceConfidence?: number;
  personalInfoDetected?: boolean;
  detectedKeywords?: string[];
  riskLevel?: 'safe' | 'warning' | 'danger';
  checkedAt?: string;
  sanitizedDataUrl?: string;
  cleanDimensions?: { width: number; height: number };
  originalSizeBytes?: number;
  sanitizedSizeBytes?: number;
  flaggedReasons?: string[];
  riskSummary: string;
  inspectedAt?: string;
  checks?: Record<string, boolean>;
}

export interface AuditLogEntry {
  id: string;
  action:
    | 'instant_publish'
    | 'manual_publish'
    | 'security_block'
    | 'hide'
    | 'unhide'
    | 'remove'
    | 'permission_change'
    | 'report_resolved'
    | 'UPLOAD_INSPECTED'
    | 'AUTO_PUBLISHED'
    | 'HELD_FOR_REVIEW'
    | 'MODERATION_ACTION'
    | 'REPORT_SUBMITTED'
    | 'SECURITY_BLOCK';
  targetId: string;
  targetTitle: string;
  performedBy: string;
  performedByRole: UserRole;
  timestamp: string;
  details: string;
  isSafeOperation: boolean;
}

export interface ContentReport {
  id: string;
  targetType: 'artwork' | 'comment' | 'story';
  targetId: string;
  targetTitle: string;
  reason:
    | 'inappropriate_language'
    | 'bullying'
    | 'personal_info_leak'
    | 'dangerous_link'
    | 'copyright'
    | 'other';
  reasonCategory?: 'personal_info' | 'inappropriate_image' | 'bullying_comment' | 'copyright' | 'other';
  reasonLabel: string;
  reasonDetails: string;
  details?: string;
  status: 'open' | 'reviewing' | 'resolved';
  reporterAnonymousCode: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionAction?: string;
  resolverRole?: UserRole;
}

export interface SafetyAuditLogItem {
  id: string;
  timestamp: string;
  actorRole: UserRole;
  actionType:
    | 'EXIF_SANITIZED_UPLOAD'
    | 'MODERATION_APPROVED'
    | 'MODERATION_HIDDEN'
    | 'REPORT_SUBMITTED'
    | 'ROLE_SWITCHED'
    | 'ROSTER_CHECK_PASSED';
  targetId: string;
  summary: string;
  complianceTag: 'No-PII' | 'EXIF-Stripped' | 'Non-Scored' | 'Role-Guarded';
}

export interface SafetyRuleSummary {
  id: string;
  category:
    | 'Identity & Zero-Roster'
    | 'EXIF & Media Privacy'
    | 'No Public Scoring'
    | 'Moderation Workflow'
    | 'Gemini AI Student-Only Access';
  title: string;
  description: string;
  enforcedBy: string;
  status: 'active';
}

export type LivePresentationInterval = 5 | 10 | 15 | 20 | 30;
export type LivePresentationMode = 'auto' | 'manual' | 'collection';
export type LivePresentationBackdrop = 'obsidian' | 'museum_stone';

export interface LivePresentationSession {
  sessionCode: string;
  title: string;
  hostUid: string;
  hostDisplayName: string;
  status: 'active' | 'ended';
  mode: LivePresentationMode;
  currentIndex: number;
  isPlaying: boolean;
  intervalSeconds: LivePresentationInterval;
  showArtworkInfo: boolean;
  showAuthorInfo?: boolean;
  showArtworkStory?: boolean;
  pureArtworkOnly: boolean;
  backdropTheme: LivePresentationBackdrop;
  filterGrade: string;
  filterClassId: string;
  filterLessonId: string;
  selectedArtworkIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ArtworkStoryStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'revision_required'
  | 'rejected'
  | 'hidden';

export interface ArtworkStory {
  id: string;
  artworkId: string;
  artworkTitle: string;
  artworkImageUrl?: string;
  artworkVideoUrl?: string;
  mediaType?: 'image' | 'video' | 'none';
  coverImageUrl?: string;
  artworkVisualType?: CanvasVisualType;
  lessonId?: string;
  lessonTitle?: string;
  topic?: string;
  classGroupId: string;
  classCode?: string;
  className?: string;
  gradeLabel?: string;
  ownerKey: string;
  authorAccountId?: string;
  authorNickname: string;
  storyTitle: string;
  storyContent: string;
  inspirationText?: string;
  feelingText?: string;
  viewerMessage?: string;
  teacherNote?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  status: ArtworkStoryStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface NicknameValidationResult {
  valid: boolean;
  available: boolean;
  normalized: string;
  reason?: string;
  suggestions?: string[];
}

export const CREATIVE_NICKNAME_SUGGESTIONS: string[] = [
  'Cọ Vẽ Mùa Thu',
  'Màu Nước Xanh',
  'Nắng Sớm Ban Mai',
  'Họa Sĩ Nhí Sáng Tạo',
  'Bút Chì Màu Tím',
  'Sắc Màu Hạnh Phúc',
  'Đường Nét Tự Do',
  'Khung Tranh Nhỏ',
];

const ANONYMOUS_NICKNAMES = CREATIVE_NICKNAME_SUGGESTIONS;

export function getRandomAnonymousNickname(): string {
  const idx = Math.floor(Math.random() * ANONYMOUS_NICKNAMES.length);
  return ANONYMOUS_NICKNAMES[idx];
}
