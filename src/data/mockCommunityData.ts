/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Dữ liệu Khởi tạo Lớp 1 đến Lớp 9, Bài học Tham khảo & Quy tắc Bảo mật
 */

import {
  ArtClassGroup,
  ArtLesson,
  ArtworkComment,
  AuditLogEntry,
  CommunityArtwork,
  ContentReport,
  PositiveReactionMeta,
  PositiveReactionType,
  SafetyRuleSummary
} from '../types/communityArt';

export const POSITIVE_REACTIONS: Record<PositiveReactionType, PositiveReactionMeta> = {
  creative_color: {
    type: 'creative_color',
    label: 'Màu sắc sáng tạo',
    emoji: '🎨',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
  },
  interesting_composition: {
    type: 'interesting_composition',
    label: 'Bố cục thú vị',
    emoji: '📐',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
  },
  unique_idea: {
    type: 'unique_idea',
    label: 'Ý tưởng độc đáo',
    emoji: '💡',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100'
  },
  dedicated_effort: {
    type: 'dedicated_effort',
    label: 'Chăm chút tỉ mỉ',
    emoji: '✨',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
  },
  inspiring: {
    type: 'inspiring',
    label: 'Truyền cảm hứng',
    emoji: '🌟',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
  }
};

export const INITIAL_CLASSES: ArtClassGroup[] = [
  {
    id: 'cls-1',
    name: 'Lớp 1',
    grade: 1,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-2',
    name: 'Lớp 2',
    grade: 2,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-3',
    name: 'Lớp 3',
    grade: 3,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-4',
    name: 'Lớp 4',
    grade: 4,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-5',
    name: 'Lớp 5',
    grade: 5,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-6',
    name: 'Lớp 6',
    grade: 6,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-7',
    name: 'Lớp 7',
    grade: 7,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-8',
    name: 'Lớp 8',
    grade: 8,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  },
  {
    id: 'cls-9',
    name: 'Lớp 9',
    grade: 9,
    schoolYear: '2025 - 2026',
    teacherDisplayName: 'Tổ Mĩ thuật',
    artworkCount: 0
  }
];

export const INITIAL_LESSONS: ArtLesson[] = [
  {
    id: 'les-101',
    title: 'Thế giới মàu sắc quanh em: Chấm, Nét và Mảng màu cơ bản',
    classGroupId: 'cls-1',
    className: 'Lớp 1',
    topic: 'Mĩ thuật Tạo hình Cơ bản',
    suggestedMaterials: ['Sáp màu', 'Giấy vẽ A4', 'Đất nặn'],
    promptQuestion: 'Em thích sắc màu nào nhất trong thiên nhiên quanh mình?',
    createdAt: '01/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=1b2v3c4d5e6',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade1/preview',
    referenceNote: 'Hướng dẫn làm quen chấm, nét thẳng, nét cong và ba màu cơ bản Đỏ - Vàng - Lam.'
  },
  {
    id: 'les-201',
    title: 'Con vật yêu thích & Khu vườn kỳ diệu',
    classGroupId: 'cls-2',
    className: 'Lớp 2',
    topic: 'Thiên nhiên & Bầu trời',
    suggestedMaterials: ['Màu sáp dầu', 'Giấy thủ công', 'Hồ dán'],
    promptQuestion: 'Con vật nào có hình dáng và bộ lông rực rỡ khiến em ấn tượng?',
    createdAt: '02/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=2b3c4d5e6f7',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade2/preview',
    referenceNote: 'Kết hợp vẽ nét và xé dán giấy màu tạo hình con vật quen thuộc.'
  },
  {
    id: 'les-301',
    title: 'Mặt nạ vui nhộn từ bìa cứng & Vật liệu tái chế',
    classGroupId: 'cls-3',
    className: 'Lớp 3',
    topic: 'Mĩ thuật Ứng dụng & Tái chế',
    suggestedMaterials: ['Bìa carton', 'Màu nước', 'Dây len'],
    promptQuestion: 'Chiếc mặt nạ của em thể hiện nhân vật vui tươi hay dũng cảm?',
    createdAt: '03/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=3c4d5e6f7g8',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade3/preview',
    referenceNote: 'Thực hành đối xứng trục dọc và phối màu nổi bật cho mặt nạ lễ hội.'
  },
  {
    id: 'les-401',
    title: 'Phong cảnh quê hương & Hòa sắc Nóng - Lạnh',
    classGroupId: 'cls-4',
    className: 'Lớp 4',
    topic: 'Mĩ thuật Tạo hình & Hòa sắc',
    suggestedMaterials: ['Màu nước', 'Chì màu', 'Giấy định lượng 180gsm'],
    promptQuestion: 'Bức tranh phong cảnh của em mang cảm giác ấm áp hay mát dịu?',
    createdAt: '04/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=4d5e6f7g8h9',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade4/preview',
    referenceNote: 'Phân biệt lớp cảnh gần - trung - xa trong tranh phong cảnh quê hương.'
  },
  {
    id: 'les-501',
    title: 'Lễ hội truyền thống Việt Nam & Bố cục tranh sinh hoạt',
    classGroupId: 'cls-5',
    className: 'Lớp 5',
    topic: 'Văn hóa & Lễ hội Dân tộc',
    suggestedMaterials: ['Màu bột / Gouache', 'Sáp dầu', 'Giấy A3'],
    promptQuestion: 'Hoạt động nào trong lễ hội tạo nên nhịp điệu sôi nổi nhất?',
    createdAt: '05/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=5e6f7g8h9i0',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade5/preview',
    referenceNote: 'Cách sắp xếp nhóm nhân vật chính và nhóm phụ trong tranh đề tài lễ hội.'
  },
  {
    id: 'les-601',
    title: 'Hòa sắc thiên nhiên: Màu nóng, Màu lạnh & Tranh in hoa lá',
    classGroupId: 'cls-6',
    className: 'Lớp 6',
    topic: 'Mĩ thuật Tạo hình & Thiên nhiên',
    suggestedMaterials: ['Màu nước', 'Sáp dầu', 'Lá cây tự nhiên', 'Giấy canson A4'],
    promptQuestion: 'Làm thế nào để kết hợp gam màu nóng - lạnh tạo cảm xúc mùa thu hoặc mùa xuân?',
    createdAt: '10/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=fe3hP9Y_v7E',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade6/preview',
    referenceNote: 'Hướng dẫn kỹ thuật pha màu cơ bản, lăn màu in độc bản từ gân lá cây tự nhiên.'
  },
  {
    id: 'les-701',
    title: 'Nhịp điệu đường nét, Ký họa dáng người & Luật xa gần',
    classGroupId: 'cls-7',
    className: 'Lớp 7',
    topic: 'Ký họa & Phối cảnh Không gian',
    suggestedMaterials: ['Bút chì 2B/4B', 'Bút kim kỹ thuật', 'Màu nước loãng'],
    promptQuestion: 'Đường chân trời và điểm tụ giúp tạo chiều sâu cho con phố hoặc hàng cây như thế nào?',
    createdAt: '12/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=ab8kL2M_x9Q',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade7/preview',
    referenceNote: 'Video minh họa trực quan luật phối cảnh 1 điểm tụ và ký họa nhanh dáng hoạt động sân trường.'
  },
  {
    id: 'les-801',
    title: 'Cảm hứng Nghệ thuật Hiện đại & Thiết kế Trang phục Dân tộc',
    classGroupId: 'cls-8',
    className: 'Lớp 8',
    topic: 'Mĩ thuật Ứng dụng & Văn hóa Dân tộc',
    suggestedMaterials: ['Màu Acrylic / Gouache', 'Giấy màu thủ công', 'Vải vụn tái chế'],
    promptQuestion: 'Em chọn họa tiết thổ cẩm hoặc hoa văn truyền thống nào để đưa vào thiết kế hiện đại?',
    createdAt: '15/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=cd9nP4R_z2W',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade8/preview',
    referenceNote: 'Slide phân tích bảng màu trường phái Ấn tượng, Lập thể và cách cách điệu hoa văn dân tộc.'
  },
  {
    id: 'les-901',
    title: 'Mĩ thuật Đương đại: Thiết kế Poster & Nghệ thuật Sắp đặtTái chế',
    classGroupId: 'cls-9',
    className: 'Lớp 9',
    topic: 'Thiết kế Đồ họa & Mĩ thuật Đương đại',
    suggestedMaterials: ['Bìa carton tái chế', 'Màu poster', 'Cắt dán Mixed Media'],
    promptQuestion: 'Thông điệp bảo vệ môi trường hoặc bản sắc văn hóa nào em muốn truyền tải qua Poster?',
    createdAt: '18/10/2025',
    videoUrl: 'https://www.youtube.com/watch?v=ef4mQ8T_y5K',
    slideUrl: 'https://docs.google.com/presentation/d/example-slide-grade9/preview',
    referenceNote: 'Hướng dẫn bố cục chữ (Typography) kết hợp hình ảnh biểu tượng cô đọng trong thiết kế đồ họa.'
  }
];

export const INITIAL_ARTWORKS: CommunityArtwork[] = [];
export const INITIAL_COMMENTS: ArtworkComment[] = [];
export const INITIAL_REPORTS: ContentReport[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

export const SAFETY_RULES_CHECKLIST: SafetyRuleSummary[] = [
  {
    id: 'sr-1',
    category: 'Identity & Zero-Roster',
    title: 'Không có cơ sở dữ liệu hồ sơ học sinh (Zero Student Roster)',
    description:
      'Hệ thống không có bảng students. Học sinh chỉ được ghi nhận qua mã bút danh ẩn danh (VD: HS-6A-09) trên từng tác phẩm.',
    enforcedBy: 'Firestore Schema + Security Rules',
    status: 'active'
  },
  {
    id: 'sr-2',
    category: 'EXIF & Media Privacy',
    title: 'Tự động xóa siêu dữ liệu GPS & EXIF ngay trên trình duyệt',
    description:
      'Mọi bức ảnh chụp tác phẩm được vẽ lại qua HTML5 Canvas để loại bỏ hoàn toàn tọa độ GPS, thiết bị chụp và nén xuống <= 1200px trước khi tải lên.',
    enforcedBy: 'Client Canvas Sanitizer + Storage Rules',
    status: 'active'
  },
  {
    id: 'sr-3',
    category: 'No Public Scoring',
    title: 'Không chấm điểm số, không xếp hạng cá nhân, không bình luận tự do',
    description:
      'Thay thế hoàn toàn thang điểm và bình luận văn bản tự do bằng 5 nút phản hồi khích lệ nghệ thuật tích cực.',
    enforcedBy: 'UI Architecture + Firestore Validation',
    status: 'active'
  },
  {
    id: 'sr-4',
    category: 'Moderation Workflow',
    title: 'Kiểm duyệt trạng thái & tự động ẩn khi có báo cáo nhạy cảm',
    description:
      'Tác phẩm do học sinh đóng góp đi qua hàng chờ pending_moderation. Giáo viên có thể ẩn ngay lập tức nếu phát hiện thông tin cá nhân trên giấy vẽ.',
    enforcedBy: 'RBAC Role Guard + Moderation Queue',
    status: 'active'
  },
  {
    id: 'sr-5',
    category: 'Gemini AI Student-Only Access',
    title: 'Phân quyền Gemini AI nghiêm ngặt: Chỉ Học sinh được trò chuyện (10 lượt/ngày)',
    description:
      'Backend Express xác thực Firebase ID Token, truy vấn vai trò thực tế từ Firestore, từ chối Admin/Giáo viên gọi /api/gemini/chat và khóa nguyên tử hạn mức 10 lượt/ngày cho mỗi Học sinh.',
    enforcedBy: 'Server Token Verification + Atomic Quota Lock',
    status: 'active'
  }
];
