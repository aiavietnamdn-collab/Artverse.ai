export type ScreenTab = 
  | 'discover'
  | 'community-library'
  | 'my-artworks'
  | 'class-lessons'
  | 'ai-chatbox'
  | 'moderation'
  | 'safety-audit'
  | 'profile-manage'
  | 'art-plan'
  | 'dashboard'
  | 'lesson-plan'
  | 'assessment'
  | 'portfolio'
  | 'report'
  | 'library';

export type SchoolLevel = 'all' | 'primary' | 'secondary'; // Tiểu học / THCS

export interface LessonPlan {
  id: string;
  title: string;
  grade: string; // Lớp 1-9
  level: 'primary' | 'secondary';
  topic: string; // Chủ đề
  durationWeeks: number; // Số tiết (ví dụ: 2 tiết)
  textbook: string; // Bộ sách (Kết nối tri thức, Chân trời sáng tạo, Cánh diều)
  competencies: string[]; // Năng lực đặc thù (Quan sát nhận thức, Sáng tạo ứng dụng, Phân tích đánh giá)
  qualities: string[]; // Phẩm chất (Yêu nước, Nhân ái, Chăm chỉ, Trung thực, Trách nhiệm)
  preparationTeacher: string;
  preparationStudent: string;
  steps: {
    step1Discovery: string; // 1. Khám phá
    step2Knowledge: string; // 2. Kiến tạo tri thức mới
    step3Practice: string; // 3. Luyện tập - sáng tạo
    step4Analysis: string; // 4. Phân tích - đánh giá
    step5Application: string; // 5. Vận dụng - phát triển
  };
  status: 'published' | 'draft';
  lastEdited: string;
  author: string;
}

export interface StudentArtwork {
  id: string;
  studentId: string;
  studentName: string;
  classGroup: string;
  title: string;
  medium: string; // Màu sáp dầu, Màu nước, Xé dán, Đất nặn, In độc bản
  dateSubmitted: string;
  ratingLevel: 'excellent' | 'proficient' | 'developing'; // Hoàn thành tốt (T), Hoàn thành (H), Cần cố gắng (C)
  rubricScores: {
    lineShape: number; // Đường nét & hình khối (1-10)
    colorValue: number; // Màu sắc & sắc độ (1-10)
    composition: number; // Bố cục & không gian (1-10)
    creativity: number; // Tính sáng tạo (1-10)
    expression: number; // Biểu đạt & cảm xúc (1-10)
  };
  totalScore: number;
  teacherFeedback: string;
  pedagogicalSuggestion: string; // Gợi mở phát triển thêm
  visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  accentColor: string;
}

export interface StudentProfile {
  id: string;
  name: string;
  classGroup: string;
  level: 'primary' | 'secondary';
  artAptitude: string; // Thiên hướng (Hội họa tạo hình, Thủ công tạo dáng, Phối màu biểu cảm)
  overallRating: 'excellent' | 'proficient' | 'developing';
  artworksCount: number;
  recentNotes: string;
  strengths: string[];
  areasToGrow: string[];
  sampleWorks: {
    id: string;
    title: string;
    date: string;
    rating: string;
    visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  }[];
}

export interface ResourceItem {
  id: string;
  title: string;
  category: 'folk' | 'fineart' | 'technique' | 'award' | 'slides';
  categoryLabel: string;
  targetGrades: string;
  eraOrArtist: string;
  description: string;
  teachingGuide: string;
  visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
  downloadFormat: string;
  fileSize: string;
  downloadsCount: number;
  tags: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export interface ArtPlanInput {
  schoolLevel: 'primary' | 'secondary';
  grade: string; // Lớp 1 - 9
  textbook: string;
  topicTitle: string;
  durationPeriods: number; // 1-4 tiết
  learningObjectives: string; // Yêu cầu cần đạt do giáo viên nhập
  materialsAndEquipment: string; // Vật liệu và thiết bị do giáo viên nhập
  studentAudienceAndNotes: string; // Đối tượng học sinh và lưu ý lớp học do giáo viên nhập
}

export interface ArtPlanActivity {
  stepNumber: number;
  name: string;
  phaseTitle: string;
  objective: string;
  content: string;
  expectedProduct: string;
  implementationSteps: string[];
}

export interface ArtPlanRubricCriterion {
  id: string;
  name: string;
  excellentDesc: string; // Hoàn thành tốt
  proficientDesc: string; // Hoàn thành
  developingDesc: string; // Cần cố gắng
}

export interface ArtPlanGenerated {
  id: string;
  createdAt: string;
  input: ArtPlanInput;
  lessonObjectives: {
    knowledgeAndSkills: string[];
    specificCompetencies: string[]; // Năng lực mĩ thuật đặc thù
    generalCompetencies: string[]; // Năng lực chung
    qualities: string[]; // Phẩm chất
  };
  preparation: {
    teacher: string[];
    students: string[];
    safetyAndClassroomNotes: string[];
  };
  activities: ArtPlanActivity[];
  inquiryQuestions: string[];
  creativeTask: {
    format: string; // Cá nhân / Nhóm
    prompt: string;
    differentiationNotes: string; // Phương án phân hóa
  };
  assessmentEvidence: string[];
  assessmentPlan: {
    methods: string[];
    rubricCriteria: ArtPlanRubricCriterion[];
  };
  approvalStatus: 'pending_review' | 'approved';
  approvedAt?: string;
  teacherApprovalNote?: string;
}

// ==========================================
// ARTRUBRIC & PRODUCT FEEDBACK SYSTEM TYPES
// ==========================================

export type RubricLevelKey = 'needs_support' | 'partially_achieved' | 'achieved' | 'exceeded';

export interface ArtRubricCriterion4Levels {
  id: string;
  name: string;
  weight: number; // e.g. 25 (%) if weighted mode
  levels: {
    needs_support: string; // 1. Cần hỗ trợ
    partially_achieved: string; // 2. Đạt một phần
    achieved: string; // 3. Đạt yêu cầu
    exceeded: string; // 4. Thể hiện tốt
  };
}

export interface ArtRubricTemplate {
  id: string;
  title: string;
  grade: string;
  topic: string;
  productType: string;
  evaluationMode: 'weighted' | 'qualitative'; // Đặt trọng số (%) hoặc Đánh giá định tính
  criteria: ArtRubricCriterion4Levels[];
  createdAt: string;
  author: string;
}

export interface CriterionFeedbackItem {
  criterionId: string;
  criterionName: string;
  suggestedLevel: RubricLevelKey;
  suggestedLevelLabel: string;
  explanation: string;
  teacherOverrideLevel?: RubricLevelKey;
  teacherComment?: string;
  isAccepted: boolean | null; // true = accepted, false = rejected, null = pending
}

export interface ArtProductFeedback {
  id: string;
  rubricId: string;
  studentName: string;
  classGroup: string;
  productTitle: string;
  imageUrl?: string;
  imageFileName?: string;
  imageAnalysisStatus: 'real_image_uploaded' | 'sample_canvas_visual' | 'no_image_description_only';
  teacherProcessNotes: string;
  aiObservations: {
    visualFeatures: string[];
    criteriaAlignment: CriterionFeedbackItem[];
    unverifiableAspects: string[];
    pedagogicalSuggestions: string[];
    ethicalGuarantees: string[];
  };
  teacherFinalDecision: {
    status: 'pending' | 'accepted' | 'rejected' | 'modified';
    finalSummaryComment: string;
    reviewedAt?: string;
  };
}

// ==========================================
// ARTPORTFOLIO SYSTEM TYPES (Non-identifying)
// ==========================================

export interface ArtPortfolioRecord {
  id: string;
  studentCode: string; // Mã học sinh giả lập / mã nội bộ không định danh (VD: HS-6A1-08)
  studentPseudonym: string; // Tên viết tắt / định danh sư phạm (VD: Em M. (6A1))
  classGroup: string;
  topic: string;
  title: string;
  executionDate: string; // Ngày thực hiện
  timePeriod: string; // e.g. "Tháng 10/2026", "Học kỳ I"
  sketchImage: {
    imageUrl?: string;
    caption: string;
    visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
    notes: string;
  };
  finalImage: {
    imageUrl?: string;
    caption: string;
    visualType: 'dongho' | 'watercolor' | 'lacquer' | 'clay' | 'collage' | 'pastel';
    notes: string;
  };
  studentWrittenIdea: string; // Ý tưởng do học sinh tự viết
  studentSelfAssessment: {
    level: RubricLevelKey;
    levelLabel: string;
    reflection: string;
    favoriteElement: string;
  };
  teacherFeedback: {
    comment: string;
    guidance: string;
    teacherName: string;
    verifiedDate: string;
  };
  rubricResult: {
    rubricTitle: string;
    overallLevel: RubricLevelKey;
    overallLabel: string;
    isTeacherVerified: boolean;
    criteriaScores: {
      criterionName: string;
      level: RubricLevelKey;
      note: string;
    }[];
  };
  isSampleData: boolean; // True for demo mock records
  storageType: 'session_temp' | 'persistent_mock';
}
