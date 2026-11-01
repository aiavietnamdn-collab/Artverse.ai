/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Community Art Library & Instant Gallery Types
 */

export type UserRole = 'viewer' | 'contributor' | 'teacher' | 'moderator' | 'admin';

export type ArtworkStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed';

export type ShareStatus = 'private' | 'shared';

/**
 * 5 community reactions as explicitly requested:
 * - Ý tưởng thú vị (unique_idea)
 * - Màu sắc ấn tượng (striking_color)
 * - Bố cục độc đáo (interesting_composition)
 * - Chi tiết khiến tôi chú ý (noteworthy_detail)
 * - Tác phẩm truyền cảm hứng (inspiring)
 */
export type PositiveReactionKey = 
  | 'unique_idea'             // 💡 Ý tưởng thú vị
  | 'striking_color'          // 🎨 Màu sắc ấn tượng
  | 'interesting_composition' // 📐 Bố cục độc đáo
  | 'noteworthy_detail'       // 🔍 Chi tiết khiến tôi chú ý
  | 'inspiring';              // ✨ Tác phẩm truyền cảm hứng

export interface PositiveReactionsMap {
  unique_idea: number;
  striking_color: number;
  interesting_composition: number;
  noteworthy_detail?: number;
  inspiring: number;
  commendable_effort?: number; // Kept optional for backward compatibility
}

export interface ArtworkRevision {
  id: string;
  caption: string;
  notes: string;
  visualType: 'clay' | 'watercolor' | 'dongho' | 'lacquer' | 'pastel' | 'collage';
  imageUrl?: string;
  createdAt: string;
}

export interface ArtworkComment {
  id: string;
  artworkId: string;
  anonymousNickname: string; // Random poetic moniker: Mây Xanh, Cọ Nhỏ, Hạt Nắng...
  content: string;
  status: 'pending' | 'approved' | 'hidden' | 'flagged';
  authorKey: string; // Secret key for commenter
  replyToId?: string;
  createdAt: string;
  moderationNote?: string;
  moderatedBy?: string;
}

export interface ContentReport {
  id: string;
  targetType: 'artwork' | 'comment';
  targetId: string;
  targetTitle: string;
  reason: 'inappropriate_language' | 'bullying' | 'personal_info_leak' | 'dangerous_link' | 'copyright' | 'other';
  reasonLabel: string;
  reasonDetails: string;
  status: 'open' | 'reviewing' | 'resolved';
  reporterAnonymousCode: string;
  createdAt: string;
  resolvedAt?: string;
  resolutionAction?: string;
  resolverRole?: string;
}

/**
 * Audit log recording all critical administrative & publishing actions
 */
export interface AuditLogEntry {
  id: string;
  action: 'instant_publish' | 'manual_publish' | 'hide' | 'unhide' | 'remove' | 'report_resolved' | 'permission_change' | 'security_block';
  targetId: string;
  targetTitle: string;
  performedBy: string;
  performedByRole: UserRole;
  timestamp: string;
  details: string;
  isSafeOperation: boolean;
}

/**
 * Result of the automated pre-publish safety inspection
 */
export interface PrePublishInspectionResult {
  fileValid: boolean;
  mimeType: string;
  fileSizeBytes: number;
  exifStripped: boolean;
  faceDetected: boolean;
  faceConfidence?: number;
  personalInfoDetected: boolean;
  detectedKeywords: string[];
  riskLevel: 'safe' | 'warning' | 'danger';
  riskSummary: string;
  canAutoPublish: boolean;
  checkedAt: string;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g. "Lớp 6", "Lớp 7", "Lớp 4" — No primary/secondary separation
  code: string;
  description: string;
  isHidden: boolean;
  createdAt: string;
  createdByTeacherId?: string;
  // INSTANT GALLERY: Public exhibition permissions
  isPublicGalleryEnabled: boolean; // Set by admin/authorized staff
  assignedTeacherIds?: string[];   // Specific teacher IDs authorized to instant-publish
}

export interface ArtLesson {
  id: string;
  classGroupId: string;
  className: string;
  grade?: '6' | '7' | '8' | '9';
  title: string;
  topic: string;
  description: string;
  isHidden: boolean;
  createdAt: string;
  createdByTeacherId?: string;
  // Video & Slide reference fields
  videoUrl?: string;
  videoFileName?: string;
  videoFileSize?: number;
  videoMimeType?: string;
  videoUpdatedAt?: string;
  slideUrl?: string;
  slideFileName?: string;
  slideFileSize?: number;
  slideMimeType?: string;
  slideUpdatedAt?: string;
}

export interface CommunityArtwork {
  id: string;
  ownerKey: string; // Creator private access key / auth UID
  creatorAnonymousPseudonym: string; // Non-identifying moniker: "Cọ Non Ẩn Danh"
  title: string;
  description: string;
  materialsUsed: string;
  processNotes: string;
  classGroupId: string;
  className: string; // "Lớp 6", "Lớp 7", "Lớp 4"
  lessonId: string;
  lessonTitle: string;
  imageUrl?: string; // Clean stripped photo data or art canvas representation
  visualType: 'clay' | 'watercolor' | 'dongho' | 'lacquer' | 'pastel' | 'collage';
  sketchImageUrl?: string;
  sketchVisualType?: 'pastel' | 'watercolor' | 'dongho';
  sketchNotes?: string;
  revisions: ArtworkRevision[];
  status: ArtworkStatus;
  shareStatus: ShareStatus;
  shareToken: string; // High-entropy unguessable token for direct sharing
  moderation: {
    moderatedBy?: string;
    moderatedAt?: string;
    moderatorNote?: string;
    rejectionReason?: string;
  };
  reactions: PositiveReactionsMap;
  commentsCount: number;
  storageLocation: 'demo_sample' | 'local_device' | 'firestore_cloud';
  createdAt: string;
  updatedAt: string;
  // INSTANT GALLERY specific metadata
  isAutoPublished?: boolean;
  publishedByTeacherId?: string;
  teacherName?: string;
  inspectionResult?: PrePublishInspectionResult;
}

export const POSITIVE_REACTIONS_META: Record<PositiveReactionKey, { label: string; icon: string; description: string; color: string }> = {
  unique_idea: {
    label: 'Ý tưởng thú vị',
    icon: '💡',
    description: 'Cách tiếp cận đề tài bất ngờ, mới lạ',
    color: 'from-amber-500 to-yellow-500',
  },
  striking_color: {
    label: 'Màu sắc ấn tượng',
    icon: '🎨',
    description: 'Hòa sắc rực rỡ, độ chuyển màu cảm xúc',
    color: 'from-purple-500 to-indigo-500',
  },
  interesting_composition: {
    label: 'Bố cục độc đáo',
    icon: '📐',
    description: 'Sắp xếp mảng miếng, nhịp điệu thị giác hài hòa',
    color: 'from-blue-500 to-cyan-500',
  },
  noteworthy_detail: {
    label: 'Chi tiết khiến tôi chú ý',
    icon: '🔍',
    description: 'Nét vẽ tỉ mỉ, chi tiết tạo điểm nhấn sâu sắc',
    color: 'from-emerald-500 to-teal-500',
  },
  inspiring: {
    label: 'Tác phẩm truyền cảm hứng',
    icon: '✨',
    description: 'Gợi mở cảm hứng sáng tác cho cộng đồng',
    color: 'from-rose-500 to-pink-500',
  },
};

export const ANONYMOUS_NICKNAMES_POOL = [
  'Mây Xanh',
  'Cọ Nhỏ',
  'Bút Chì Màu',
  'Gió Mùa Thu',
  'Hạt Nắng',
  'Giọt Mực',
  'Hoa Hướng Dương',
  'Cát Vàng',
  'Sóng Biển',
  'Khung Tranh',
  'Lá Non',
  'Dòng Sông Sáng',
  'Ngôi Sao Nhỏ',
  'Ánh Trăng',
  'Họa Mi Biển',
  'Màu Nước Biếc',
];

export function getRandomAnonymousNickname(): string {
  const index = Math.floor(Math.random() * ANONYMOUS_NICKNAMES_POOL.length);
  return ANONYMOUS_NICKNAMES_POOL[index];
}
