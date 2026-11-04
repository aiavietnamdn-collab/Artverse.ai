/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ART VERSE AI — CÔNG CỤ QUẢN LÝ & QUẢN TRỊ HỆ THỐNG (MASTER ARCHITECTURE 2.0)
 *
 * IV. NHÓM CÔNG CỤ QUẢN LÝ (mode = 'management'):
 *   1. QUẢN LÝ HỌC SINH
 *   2. QUẢN LÝ GIÁO VIÊN
 *   3. QUẢN LÝ LỚP HỌC
 *   4. QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN
 *
 * V. NHÓM QUẢN TRỊ HỆ THỐNG (mode = 'admin'):
 *   1. QUẢN LÝ TÁC PHẨM
 *   2. QUẢN LÝ ARTVERSE SHORTS
 *   3. QUẢN LÝ CÂU CHUYỆN
 *   4. KIỂM DUYỆT BÌNH LUẬN
 *   5. KIỂM DUYỆT NỘI DUNG
 *   6. QUẢN LÝ LƯU TRỮ (Phân biệt rõ: Ảnh tác phẩm, Video ngắn, Video bài giảng, Tài liệu slide)
 *   7. TRÌNH CHIẾU TRIỂN LÃM
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ClassGroup,
  ArtLesson,
  CommunityArtwork,
  ArtworkStory,
  ArtworkStoryStatus,
  ArtworkComment,
  ContentReport,
  AuditLogEntry,
  UserRole,
} from '../../types/communityArt';
import { STANDARD_GRADES, normalizeGrade, getArtworkNormalizedGrade } from '../../utils/gradeUtils';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/platform';
import { TeacherStudentManagerPanel } from './TeacherStudentManagerPanel';
import { StorageManagementCenterView } from './StorageManagementCenterView';
import {
  Users,
  GraduationCap,
  School,
  ShieldCheck,
  Image as ImageIcon,
  Film,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  HardDrive,
  Presentation,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';
import { matchesSearchQuery, isWithinDateFilter } from '../../utils/searchEngine';

interface ManagementAndAdminViewProps {
  mode: 'management' | 'admin';
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  classes: ClassGroup[];
  lessons: ArtLesson[];
  artworks: CommunityArtwork[];
  stories: ArtworkStory[];
  comments: ArtworkComment[];
  reports: ContentReport[];
  auditLogs: AuditLogEntry[];
  onAddClass: (newClass: ClassGroup) => Promise<void>;
  onUpdateClass: (updatedClass: ClassGroup) => Promise<void>;
  onToggleHideClass: (classId: string) => Promise<void>;
  onTogglePublicGallery: (classId: string) => Promise<void>;
  onDeleteClass: (classId: string) => Promise<void>;
  onApproveArtwork: (artworkId: string, note?: string) => Promise<void>;
  onRejectArtwork: (artworkId: string, reason: string) => Promise<void>;
  onHideArtwork: (artworkId: string) => Promise<void>;
  onUnhideArtwork: (artworkId: string) => Promise<void>;
  onDeleteArtwork: (artworkId: string) => Promise<void>;
  onModerateStory: (
    storyId: string,
    status: ArtworkStoryStatus,
    teacherNote?: string
  ) => Promise<void>;
  onApproveComment: (commentId: string) => void;
  onRejectComment: (commentId: string) => void;
  onResolveReport: (reportId: string, actionNote: string) => Promise<void>;
  onUpdateReportStatus: (
    reportId: string,
    status: 'open' | 'reviewing' | 'resolved'
  ) => Promise<void>;
  onSelectArtwork: (artwork: CommunityArtwork) => void;
  onOpenUploadModal: () => void;
  onOpenProjectorModal: (startIndex: number) => void;
  onArtworkDeleted: (artworkId: string) => void;
  onArtworkRecovered: (artwork: CommunityArtwork) => void;
  onShowToast: (type: 'success' | 'error' | 'info', title: string, message: string) => void;
}

type ManagementSubTab = 'students' | 'teachers' | 'classes' | 'rbac';
type AdminSubTab =
  | 'artworks'
  | 'shorts'
  | 'stories'
  | 'comments'
  | 'content-moderation'
  | 'storage'
  | 'projector';

interface ServerTeacherRecord {
  uid: string;
  email: string;
  displayName: string;
  role: 'teacher' | 'admin';
  assignedClasses: string[];
  updatedAt?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ManagementAndAdminView: React.FC<ManagementAndAdminViewProps> = ({
  mode,
  currentRole,
  onChangeRole,
  classes,
  lessons,
  artworks,
  stories,
  comments,
  reports,
  auditLogs,
  onAddClass,
  onToggleHideClass,
  onTogglePublicGallery,
  onDeleteClass,
  onApproveArtwork,
  onRejectArtwork,
  onHideArtwork,
  onUnhideArtwork,
  onDeleteArtwork,
  onModerateStory,
  onApproveComment,
  onRejectComment,
  onResolveReport,
  onSelectArtwork,
  onOpenUploadModal,
  onOpenProjectorModal,
  onArtworkDeleted,
  onArtworkRecovered,
  onShowToast,
}) => {
  const { user, profile, isAdmin, isTeacher, getValidBearerToken } = useAuth();

  const [managementTab, setManagementTab] = useState<ManagementSubTab>('students');
  const [adminTab, setAdminTab] = useState<AdminSubTab>('artworks');

  // Teacher directory state (for QUẢN LÝ GIÁO VIÊN & PHÂN QUYỀN)
  const [teachersList, setTeachersList] = useState<ServerTeacherRecord[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [newTeacherEmail, setNewTeacherEmail] = useState('');
  const [newTeacherName, setNewTeacherName] = useState('');
  const [newTeacherRole, setNewTeacherRole] = useState<'teacher' | 'admin'>('teacher');

  // Class Creation State
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Lớp 6');
  const [newClassSchoolYear, setNewClassSchoolYear] = useState('2025 - 2026');
  const [confirmDeleteClassId, setConfirmDeleteClassId] = useState<string | null>(null);

  // Confirm delete state for artworks / shorts
  const [confirmDeleteArtworkId, setConfirmDeleteArtworkId] = useState<string | null>(null);
  const [teacherNotesMap, setTeacherNotesMap] = useState<Record<string, string>>({});
  const [reportResolutionNotes, setReportResolutionNotes] = useState<Record<string, string>>({});

  // III.5 & III.6 Search & Filter states for Management & System Admin
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [rbacSearchQuery, setRbacSearchQuery] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('all');
  const [adminDateFilter, setAdminDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    const fetchTeachers = async () => {
      if (!isTeacher && !isAdmin) return;
      setLoadingTeachers(true);
      try {
        const token = await getValidBearerToken();
        const res = await fetch(getApiUrl('/api/admin/teachers'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.teachers)) {
            setTeachersList(data.teachers);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoadingTeachers(false);
      }
    };
    fetchTeachers();
  }, [isTeacher, isAdmin, getValidBearerToken]);

  // Separate visual artworks and ARTVERSE SHORTS videos
  const visualArtworksOnly = useMemo(
    () =>
      artworks.filter(
        (item) =>
          item.mediaType !== 'video' &&
          !item.videoUrl &&
          !(item.mimeType && item.mimeType.startsWith('video/'))
      ),
    [artworks]
  );

  const shortVideosOnly = useMemo(
    () =>
      artworks.filter(
        (item) =>
          item.mediaType === 'video' ||
          Boolean(item.videoUrl) ||
          Boolean(item.mimeType && item.mimeType.startsWith('video/'))
      ),
    [artworks]
  );

  // Filtered lists for Management & Admin tabs (Sections III.5 & III.6)
  const filteredTeachers = useMemo(() => {
    if (!teacherSearchQuery.trim()) return teachersList;
    return teachersList.filter((t) =>
      matchesSearchQuery(teacherSearchQuery, {
        primary: [t.displayName, t.email, t.uid],
        secondary: [t.role, ...(t.assignedClasses || [])],
      })
    );
  }, [teachersList, teacherSearchQuery]);

  const filteredClasses = useMemo(() => {
    if (!classSearchQuery.trim()) return classes;
    return classes.filter((c) =>
      matchesSearchQuery(classSearchQuery, {
        primary: [c.name, String(c.grade || ''), c.id],
        secondary: [c.teacherAlias, c.schoolYear, c.description],
      })
    );
  }, [classes, classSearchQuery]);

  const filteredAdminArtworks = useMemo(() => {
    return visualArtworksOnly.filter((art) => {
      if (adminStatusFilter !== 'all' && art.status !== adminStatusFilter) return false;
      if (!isWithinDateFilter(art.createdAt || art.uploadedDate, adminDateFilter)) return false;
      if (adminSearchQuery.trim()) {
        return matchesSearchQuery(adminSearchQuery, {
          primary: [art.id, art.title],
          secondary: [
            art.authorNickname,
            art.authorAlias,
            art.creatorAnonymousPseudonym,
            art.status,
          ],
          tertiary: [art.description, art.createdAt],
        });
      }
      return true;
    });
  }, [visualArtworksOnly, adminSearchQuery, adminStatusFilter, adminDateFilter]);

  const filteredAdminShorts = useMemo(() => {
    return shortVideosOnly.filter((vid) => {
      if (adminStatusFilter !== 'all' && vid.status !== adminStatusFilter) return false;
      if (!isWithinDateFilter(vid.createdAt || vid.uploadedDate, adminDateFilter)) return false;
      if (adminSearchQuery.trim()) {
        return matchesSearchQuery(adminSearchQuery, {
          primary: [vid.id, vid.title],
          secondary: [
            vid.authorNickname,
            vid.authorAlias,
            vid.creatorAnonymousPseudonym,
            vid.status,
          ],
          tertiary: [vid.description, vid.createdAt],
        });
      }
      return true;
    });
  }, [shortVideosOnly, adminSearchQuery, adminStatusFilter, adminDateFilter]);

  const filteredAdminStories = useMemo(() => {
    return stories.filter((st) => {
      if (adminStatusFilter !== 'all' && st.status !== adminStatusFilter) return false;
      if (!isWithinDateFilter(st.publishedAt || st.createdAt, adminDateFilter)) return false;
      if (adminSearchQuery.trim()) {
        return matchesSearchQuery(adminSearchQuery, {
          primary: [st.id, st.storyTitle, st.artworkTitle],
          secondary: [st.authorNickname, st.status, st.gradeLabel],
          tertiary: [st.storyContent, st.createdAt],
        });
      }
      return true;
    });
  }, [stories, adminSearchQuery, adminStatusFilter, adminDateFilter]);

  const filteredAdminComments = useMemo(() => {
    return comments.filter((c) => {
      if (adminStatusFilter !== 'all' && c.status !== adminStatusFilter) return false;
      if (!isWithinDateFilter(c.createdAt, adminDateFilter)) return false;
      if (adminSearchQuery.trim()) {
        return matchesSearchQuery(adminSearchQuery, {
          primary: [c.id, c.authorAnonymousPseudonym, c.content],
          secondary: [c.artworkId, c.status, c.createdAt],
        });
      }
      return true;
    });
  }, [comments, adminSearchQuery, adminStatusFilter, adminDateFilter]);

  const filteredAdminReports = useMemo(() => {
    return reports.filter((rep) => {
      if (adminStatusFilter !== 'all' && rep.status !== adminStatusFilter) return false;
      if (!isWithinDateFilter(rep.createdAt, adminDateFilter)) return false;
      if (adminSearchQuery.trim()) {
        return matchesSearchQuery(adminSearchQuery, {
          primary: [rep.id, rep.targetTitle, rep.reasonLabel],
          secondary: [rep.targetType, rep.status, rep.details],
        });
      }
      return true;
    });
  }, [reports, adminSearchQuery, adminStatusFilter, adminDateFilter]);

  // Storage Breakdown across 4 official media categories (Section V.6)
  const storageCategoryBreakdown = useMemo(() => {
    const artworkImagesBytes = visualArtworksOnly.reduce(
      (sum, a) => sum + (a.fileSize || 420 * 1024),
      0
    );
    const shortVideosBytes = shortVideosOnly.reduce(
      (sum, v) => sum + (v.fileSize || 4.5 * 1024 * 1024),
      0
    );
    const activeLessons = lessons.filter((l) => l.status !== 'deleted');
    const slideResources = activeLessons.filter(
      (l) => l.resourceCategory === 'slide' || Boolean(l.slideUrl) || (l.slides && l.slides.length > 0)
    );
    const lectureVideos = activeLessons.filter(
      (l) => l.resourceCategory === 'video' || Boolean(l.videoUrl)
    );
    const slideBytes = slideResources.reduce((sum, s) => sum + (s.fileSize || 1.2 * 1024 * 1024), 0);
    const lectureVideoBytes = lectureVideos.reduce(
      (sum, v) => sum + (v.fileSize || 8.5 * 1024 * 1024),
      0
    );

    return {
      artworkImagesCount: visualArtworksOnly.length,
      artworkImagesBytes,
      shortVideosCount: shortVideosOnly.length,
      shortVideosBytes,
      lectureVideosCount: lectureVideos.length,
      lectureVideoBytes,
      slideCount: slideResources.length,
      slideBytes,
    };
  }, [visualArtworksOnly, shortVideosOnly, lessons]);

  const handleCreateNewClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) {
      onShowToast('error', 'Thiếu tên lớp', 'Vui lòng nhập tên lớp học.');
      return;
    }
    const gradeMeta =
      STANDARD_GRADES.find((g) => g.label === newClassGrade) || STANDARD_GRADES[5];
    const newClassObj: ClassGroup = {
      id: `cls-custom-${Date.now()}`,
      name: newClassName.trim(),
      grade: gradeMeta.label,
      schoolYear: newClassSchoolYear.trim() || '2025 - 2026',
      teacherAlias: profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật',
      description: `Không gian Mĩ thuật ${gradeMeta.label} (${newClassName.trim()})`,
      artworkCount: 0,
      lessonCount: 0,
      coverVisual: 'watercolor',
      isPublicGalleryEnabled: true,
    };
    await onAddClass(newClassObj);
    setNewClassName('');
  };

  const handleGrantTeacherRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeacherEmail.trim()) {
      onShowToast('error', 'Thiếu email', 'Vui lòng nhập email tài khoản Google của Giáo viên.');
      return;
    }
    try {
      const token = await getValidBearerToken();
      const res = await fetch(getApiUrl('/api/admin/teachers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: newTeacherEmail.trim(),
          displayName: newTeacherName.trim() || newTeacherEmail.trim(),
          role: newTeacherRole,
          assignedClasses: STANDARD_GRADES.map((g) => g.classId),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onShowToast(
          'error',
          'Không thể cấp quyền',
          data.error || 'Chỉ Quản trị viên mới được cấp quyền giáo viên.'
        );
        return;
      }
      if (Array.isArray(data.teachers)) {
        setTeachersList(data.teachers);
      }
      setNewTeacherEmail('');
      setNewTeacherName('');
      onShowToast(
        'success',
        'Đã cấp quyền thành công',
        `Đã cập nhật quyền ${newTeacherRole.toUpperCase()} trên ART VERSE AI.`
      );
    } catch (err: any) {
      onShowToast('error', 'Lỗi kết nối', err?.message || 'Không thể kết nối máy chủ.');
    }
  };

  // ============================================================================
  // RENDER MODE 1: IV. NHÓM CÔNG CỤ QUẢN LÝ (management-tools)
  // ============================================================================
  if (mode === 'management') {
    return (
      <div className="space-y-6 pb-12 text-[#20243A] museum-fade-in">
        {/* Masthead */}
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 sm:p-8 space-y-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#3457D5]">
              <span className="w-2.5 h-2.5 bg-[#3457D5] inline-block" />
              <span>ART VERSE AI · NHÓM CÔNG CỤ QUẢN LÝ</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black text-[#20243A] tracking-tight uppercase">
              CÔNG CỤ QUẢN LÝ
            </h1>
            <p className="text-xs sm:text-sm text-[#20243A]/70 max-w-2xl">
              Quản lý học sinh, giáo viên, không gian lớp học và phân quyền tài khoản trên hệ thống ART VERSE AI.
            </p>
          </div>

          {/* 4 Required Management Subsystems */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#20243A]/10">
            <button
              type="button"
              onClick={() => setManagementTab('students')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                managementTab === 'students'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <Users className="w-4 h-4 text-[#3457D5]" />
              <span>1. QUẢN LÝ HỌC SINH</span>
            </button>

            <button
              type="button"
              onClick={() => setManagementTab('teachers')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                managementTab === 'teachers'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#269C91]" />
              <span>2. QUẢN LÝ GIÁO VIÊN</span>
            </button>

            <button
              type="button"
              onClick={() => setManagementTab('classes')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                managementTab === 'classes'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <School className="w-4 h-4 text-[#F15B3D]" />
              <span>3. QUẢN LÝ LỚP HỌC</span>
            </button>

            <button
              type="button"
              onClick={() => setManagementTab('rbac')}
              className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
                managementTab === 'rbac'
                  ? 'bg-[#20243A] text-[#F7F3EA]'
                  : 'bg-[#F7F3EA] text-[#20243A] border border-[#20243A]/15 hover:border-[#20243A]/40'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#6945B5]" />
              <span>4. QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN</span>
            </button>
          </div>
        </section>

        {/* 1. QUẢN LÝ HỌC SINH */}
        {managementTab === 'students' && (
          <TeacherStudentManagerPanel onShowToast={onShowToast} />
        )}

        {/* 2. QUẢN LÝ GIÁO VIÊN */}
        {managementTab === 'teachers' && (
          <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#20243A]/12 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                  QUẢN LÝ GIÁO VIÊN MĨ THUẬT
                </h2>
                <p className="text-xs text-[#20243A]/65 mt-0.5">
                  Danh sách giáo viên phụ trách các khối lớp Tiểu học &amp; THCS trên hệ thống ART VERSE AI.
                </p>
              </div>
              <span className="px-3 py-1 rounded-sm bg-[#20243A] text-[#F7F3EA] text-xs font-mono-code font-bold">
                {teachersList.length} GIÁO VIÊN / QUẢN TRỊ
              </span>
            </div>

            {isAdmin && (
              <form
                onSubmit={handleGrantTeacherRole}
                className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
              >
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    Email Google Giáo viên *
                  </label>
                  <input
                    type="email"
                    required
                    value={newTeacherEmail}
                    onChange={(e) => setNewTeacherEmail(e.target.value)}
                    placeholder="giaovien@school.edu.vn"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-[#20243A] mb-1">
                    Họ tên / Chức danh hiển thị
                  </label>
                  <input
                    type="text"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    placeholder="Cô Nguyễn Thị A - GV Mĩ thuật"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#20243A] mb-1">Vai trò</label>
                  <select
                    value={newTeacherRole}
                    onChange={(e) => setNewTeacherRole(e.target.value as 'teacher' | 'admin')}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs font-bold text-[#20243A]"
                  >
                    <option value="teacher">Giáo viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2 px-3 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    + Cấp quyền GV
                  </button>
                </div>
              </form>
            )}

            {/* Search bar for QUẢN LÝ GIÁO VIÊN (III.5) */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={teacherSearchQuery}
                onChange={(e) => setTeacherSearchQuery(e.target.value)}
                placeholder="Tìm kiếm giáo viên theo Họ tên, Tài khoản, Email, Lớp được phân công..."
                className="w-full pl-10 pr-8 py-2.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 text-xs text-[#20243A] focus:outline-none focus:border-[#3457D5]"
              />
              {teacherSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTeacherSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loadingTeachers ? (
              <div className="py-8 text-center text-xs text-[#20243A]/60">
                Đang tải danh sách giáo viên...
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#F7F3EA] text-xs text-[#20243A]/70">
                {teachersList.length === 0
                  ? `Tài khoản hiện tại (${user?.email || profile?.displayName || 'Giáo viên'}) đang giữ quyền điều hành. Quản trị viên có thể thêm email giáo viên bộ môn bên trên.`
                  : 'Không tìm thấy giáo viên phù hợp với từ khóa.'}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[#20243A]/15">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F7F3EA] border-b border-[#20243A]/15 text-[11px] font-bold uppercase text-[#20243A]/70">
                      <th className="py-3 px-4">Tên Giáo viên</th>
                      <th className="py-3 px-4">Email Xác thực</th>
                      <th className="py-3 px-4">Vai trò Hệ thống</th>
                      <th className="py-3 px-4">Khối lớp Phụ trách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#20243A]/10 bg-white">
                    {filteredTeachers.map((t) => (
                      <tr key={t.uid || t.email}>
                        <td className="py-3 px-4 font-bold text-[#20243A]">{t.displayName}</td>
                        <td className="py-3 px-4 font-mono-code text-[#3457D5]">{t.email}</td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold uppercase">
                            {t.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#20243A]/70">
                          {t.assignedClasses && t.assignedClasses.length > 0
                            ? 'Lớp 1 – Lớp 9'
                            : 'Toàn trường'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 3. QUẢN LÝ LỚP HỌC */}
        {managementTab === 'classes' && (
          <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#20243A]/12 pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                  QUẢN LÝ LỚP HỌC (LỚP 1 – LỚP 9)
                </h2>
                <p className="text-xs text-[#20243A]/65 mt-0.5">
                  Quản lý danh sách lớp học, trạng thái mở/khóa triển lãm công khai và số lượng tác phẩm theo lớp.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateNewClass}
              className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
            >
              <div className="sm:col-span-4">
                <label className="block text-xs font-bold text-[#20243A] mb-1">
                  Tên lớp học mới *
                </label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ví dụ: Lớp 6A1 - Mỹ thuật Đương đại"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-[#20243A] mb-1">Khối lớp</label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs font-bold text-[#20243A]"
                >
                  {STANDARD_GRADES.map((g) => (
                    <option key={g.classId} value={g.label}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-[#20243A] mb-1">Năm học</label>
                <input
                  type="text"
                  value={newClassSchoolYear}
                  onChange={(e) => setNewClassSchoolYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#20243A]/20 text-xs text-[#20243A]"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Lớp</span>
                </button>
              </div>
            </form>

            {/* Search bar for QUẢN LÝ LỚP HỌC (III.5) */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={classSearchQuery}
                onChange={(e) => setClassSearchQuery(e.target.value)}
                placeholder="Tìm kiếm lớp học theo Tên lớp, Khối, Giáo viên phụ trách..."
                className="w-full pl-10 pr-8 py-2.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 text-xs text-[#20243A] focus:outline-none focus:border-[#3457D5]"
              />
              {classSearchQuery && (
                <button
                  type="button"
                  onClick={() => setClassSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClasses.map((cls) => {
                const classArtCount = artworks.filter(
                  (a) =>
                    a.classGroupId === cls.id ||
                    getArtworkNormalizedGrade(a) === normalizeGrade(cls.grade || cls.name)
                ).length;

                return (
                  <div
                    key={cls.id}
                    className="p-4 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold uppercase">
                          {normalizeGrade(cls.grade || cls.name)}
                        </span>
                        <span className="text-[11px] font-mono-code text-[#20243A]/60">
                          {cls.schoolYear}
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#20243A] pt-1">
                        {cls.name}
                      </h3>
                      <p className="text-xs text-[#20243A]/65">
                        GV phụ trách: <strong>{cls.teacherAlias}</strong> · {classArtCount} tác phẩm
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#20243A]/10 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onTogglePublicGallery(cls.id)}
                        className={`px-2.5 py-1 rounded-sm text-[11px] font-bold cursor-pointer ${
                          cls.isPublicGalleryEnabled !== false
                            ? 'bg-[#269C91]/15 text-[#269C91] border border-[#269C91]/30'
                            : 'bg-[#F15B3D]/15 text-[#F15B3D] border border-[#F15B3D]/30'
                        }`}
                      >
                        {cls.isPublicGalleryEnabled !== false
                          ? 'Triển lãm Công khai: MỞ'
                          : 'Triển lãm Công khai: KHÓA'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleHideClass(cls.id)}
                          className="p-1.5 rounded-md bg-white border border-[#20243A]/15 text-[#20243A] hover:bg-[#20243A] hover:text-white cursor-pointer"
                          title={cls.isHidden ? 'Hiện lớp' : 'Ẩn lớp'}
                        >
                          {cls.isHidden ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {confirmDeleteClassId === cls.id ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDeleteClass(cls.id);
                                setConfirmDeleteClassId(null);
                              }}
                              className="px-2 py-1 rounded-md bg-[#F15B3D] text-white text-[10px] font-bold cursor-pointer"
                            >
                              Xác nhận xóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteClassId(null)}
                              className="px-2 py-1 rounded-md bg-white border border-[#20243A]/20 text-[10px] font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteClassId(cls.id)}
                            className="p-1.5 rounded-md bg-white border border-[#20243A]/15 text-[#F15B3D] hover:bg-[#F15B3D] hover:text-white cursor-pointer"
                            title="Xóa lớp học"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 4. QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN */}
        {managementTab === 'rbac' && (
          <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-5">
            <div className="border-b border-[#20243A]/12 pb-4">
              <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN (RBAC)
              </h2>
              <p className="text-xs text-[#20243A]/65 mt-0.5">
                Kiểm soát phân quyền Học sinh (Thẻ PIN), Giáo viên Mĩ thuật, Kiểm duyệt viên và Quản trị viên hệ thống ART VERSE AI.
              </p>
            </div>

            {/* Search bar for QUẢN LÝ TÀI KHOẢN VÀ PHÂN QUYỀN (III.5) */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rbacSearchQuery}
                onChange={(e) => setRbacSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo Tài khoản, UID, Vai trò (student/teacher/moderator/admin), Trạng thái..."
                className="w-full pl-10 pr-8 py-2.5 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 text-xs text-[#20243A] focus:outline-none focus:border-[#3457D5]"
              />
              {rbacSearchQuery && (
                <button
                  type="button"
                  onClick={() => setRbacSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(
                [
                  {
                    role: 'student' as UserRole,
                    title: 'Học sinh (Thẻ PIN)',
                    desc: 'Đăng tải tác phẩm, đăng tải video ARTVERSE SHORTS, viết Câu chuyện sau nét vẽ (Lưu nháp / Gửi duyệt), xem và tải học liệu Mĩ thuật GDPT.',
                  },
                  {
                    role: 'teacher' as UserRole,
                    title: 'Giáo viên Mĩ thuật',
                    desc: 'Quản lý học sinh & lớp học, đăng tải Slide bài giảng & Video bài giảng Mĩ thuật GDPT, duyệt câu chuyện và điều phối triển lãm.',
                  },
                  {
                    role: 'moderator' as UserRole,
                    title: 'Kiểm duyệt viên',
                    desc: 'Kiểm duyệt tác phẩm, kiểm duyệt ARTVERSE SHORTS, kiểm duyệt bình luận và xử lý báo cáo nội dung.',
                  },
                  {
                    role: 'admin' as UserRole,
                    title: 'Quản trị viên Hệ thống',
                    desc: 'Toàn quyền quản trị hệ thống, phân quyền giáo viên, quản lý dung lượng lưu trữ Firebase Storage & Firestore.',
                  },
                ] as const
              )
                .filter(
                  (item) =>
                    !rbacSearchQuery.trim() ||
                    matchesSearchQuery(rbacSearchQuery, {
                      primary: [item.role, item.title],
                      secondary: [item.desc],
                    })
                )
                .map((item) => {
                  const active = currentRole === item.role;
                  return (
                    <div
                      key={item.role}
                    className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                      active
                        ? 'bg-[#3457D5]/8 border-[#3457D5]'
                        : 'bg-[#F7F3EA]/50 border-[#20243A]/15'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold text-[#20243A]">
                          {item.title}
                        </span>
                        {active && (
                          <span className="px-2 py-0.5 rounded-sm bg-[#3457D5] text-white text-[10px] font-bold uppercase">
                            Đang kích hoạt
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#20243A]/70 leading-relaxed">{item.desc}</p>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => onChangeRole(item.role)}
                        className="px-3.5 py-1.5 rounded-md bg-[#20243A] hover:bg-[#3457D5] text-[#F7F3EA] text-xs font-bold cursor-pointer transition-colors"
                      >
                        Chuyển chế độ kiểm tra: {item.title}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDER MODE 2: V. NHÓM QUẢN TRỊ HỆ THỐNG (system-admin)
  // ============================================================================
  return (
    <div className="space-y-6 pb-12 text-[#20243A] museum-fade-in">
      {/* Masthead */}
      <section className="rounded-xl bg-[#20243A] text-[#F7F3EA] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#F2D64B]">
              <span className="w-2.5 h-2.5 bg-[#F15B3D] inline-block" />
              <span>ART VERSE AI · NHÓM QUẢN TRỊ HỆ THỐNG</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase">
              QUẢN TRỊ HỆ THỐNG
            </h1>
            <p className="text-xs sm:text-sm text-[#F7F3EA]/75 max-w-2xl">
              Điều hành 7 phân hệ quản trị: Tác phẩm, ARTVERSE SHORTS, Câu chuyện, Bình luận, Nội dung, Lưu trữ và Trình chiếu Triển lãm.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenProjectorModal(0)}
            className="px-4 py-2.5 rounded-lg bg-[#F2D64B] hover:bg-white text-[#20243A] text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer shrink-0 transition-colors"
          >
            <Presentation className="w-4 h-4" />
            <span>Mở Trình chiếu Triển lãm</span>
          </button>
        </div>

        {/* 7 Required System Admin Subsystems */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/15">
          {(
            [
              {
                id: 'artworks' as AdminSubTab,
                label: `1. QUẢN LÝ TÁC PHẨM (${visualArtworksOnly.length})`,
                icon: <ImageIcon className="w-3.5 h-3.5" />,
              },
              {
                id: 'shorts' as AdminSubTab,
                label: `2. QUẢN LÝ ARTVERSE SHORTS (${shortVideosOnly.length})`,
                icon: <Film className="w-3.5 h-3.5" />,
              },
              {
                id: 'stories' as AdminSubTab,
                label: `3. QUẢN LÝ CÂU CHUYỆN (${stories.length})`,
                icon: <BookOpen className="w-3.5 h-3.5" />,
              },
              {
                id: 'comments' as AdminSubTab,
                label: `4. KIỂM DUYỆT BÌNH LUẬN (${comments.length})`,
                icon: <MessageSquare className="w-3.5 h-3.5" />,
              },
              {
                id: 'content-moderation' as AdminSubTab,
                label: `5. KIỂM DUYỆT NỘI DUNG (${reports.length})`,
                icon: <ShieldAlert className="w-3.5 h-3.5" />,
              },
              {
                id: 'storage' as AdminSubTab,
                label: '6. QUẢN LÝ LƯU TRỮ',
                icon: <HardDrive className="w-3.5 h-3.5" />,
              },
              {
                id: 'projector' as AdminSubTab,
                label: '7. TRÌNH CHIẾU TRIỂN LÃM',
                icon: <Presentation className="w-3.5 h-3.5" />,
              },
            ] as const
          ).map((tab) => {
            const active = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAdminTab(tab.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#3457D5] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-[#F7F3EA]/85'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* III.6 QUẢN TRỊ HỆ THỐNG Search & Filter Bar (by Mã nội dung, Tiêu đề, Người đăng, Trạng thái, Thời gian) */}
      {adminTab !== 'projector' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#20243A]/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              placeholder="Tìm kiếm quản trị theo Mã nội dung (ID), Tiêu đề, Bí danh người đăng, Trạng thái kiểm duyệt..."
              className="w-full pl-10 pr-8 py-2 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 text-xs text-[#20243A] focus:outline-none focus:border-[#3457D5]"
            />
            {adminSearchQuery && (
              <button
                type="button"
                onClick={() => setAdminSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#20243A]/50 hover:text-[#20243A] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={adminStatusFilter}
              onChange={(e) => setAdminStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
            >
              <option value="all">Tất cả trạng thái kiểm duyệt</option>
              <option value="approved">Đã công bố / Approved</option>
              <option value="pending">Chờ duyệt / Pending</option>
              <option value="revision_required">Yêu cầu chỉnh sửa</option>
              <option value="rejected">Từ chối / Rejected</option>
              <option value="hidden">Đã ẩn / Hidden</option>
            </select>

            <select
              value={adminDateFilter}
              onChange={(e) => setAdminDateFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 text-xs font-bold text-[#20243A]"
            >
              <option value="all">Mọi thời gian</option>
              <option value="today">Hôm nay</option>
              <option value="week">7 ngày qua</option>
              <option value="month">30 ngày qua</option>
            </select>
          </div>
        </section>
      )}

      {/* 1. QUẢN LÝ TÁC PHẨM */}
      {adminTab === 'artworks' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#20243A]/12 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                1. QUẢN LÝ TÁC PHẨM MỸ THUẬT ({filteredAdminArtworks.length}/{visualArtworksOnly.length})
              </h2>
              <p className="text-xs text-[#20243A]/65">
                Phê duyệt, tạm ẩn hoặc xóa có xác nhận các tác phẩm thuộc phân hệ TRIỂN LÃM TÁC PHẨM.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAdminArtworks.map((art) => (
              <div
                key={art.id}
                className="p-3.5 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 flex flex-col justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={art.thumbnailUrl || art.imageUrl || art.downloadURL}
                    alt={art.title}
                    onClick={() => onSelectArtwork(art)}
                    className="w-20 h-20 rounded-md object-cover bg-[#20243A] shrink-0 cursor-pointer border border-[#20243A]/15"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold">
                        {getArtworkNormalizedGrade(art)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase ${
                          art.status === 'approved'
                            ? 'bg-[#269C91]/15 text-[#269C91]'
                            : art.status === 'hidden'
                              ? 'bg-[#20243A]/15 text-[#20243A]'
                              : 'bg-[#F15B3D]/15 text-[#F15B3D]'
                        }`}
                      >
                        {art.status}
                      </span>
                    </div>
                    <h3
                      onClick={() => onSelectArtwork(art)}
                      className="text-sm font-bold text-[#20243A] truncate cursor-pointer hover:text-[#3457D5]"
                    >
                      {art.title}
                    </h3>
                    <p className="text-xs text-[#20243A]/65 truncate">
                      {art.authorNickname || art.authorAlias || art.creatorAnonymousPseudonym}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[#20243A]/10 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {art.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => onApproveArtwork(art.id)}
                        className="px-2.5 py-1 rounded-md bg-[#269C91] text-white text-[11px] font-bold cursor-pointer"
                      >
                        Duyệt
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        art.status === 'hidden' ? onUnhideArtwork(art.id) : onHideArtwork(art.id)
                      }
                      className="px-2.5 py-1 rounded-md bg-white border border-[#20243A]/20 text-[#20243A] text-[11px] font-bold cursor-pointer"
                    >
                      {art.status === 'hidden' ? 'Hiện lại' : 'Tạm ẩn'}
                    </button>
                  </div>

                  {confirmDeleteArtworkId === art.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteArtwork(art.id);
                          setConfirmDeleteArtworkId(null);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#F15B3D] text-white text-[11px] font-bold cursor-pointer"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteArtworkId(null)}
                        className="px-2 py-1 rounded-md bg-white border border-[#20243A]/20 text-[11px] font-bold cursor-pointer"
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteArtworkId(art.id)}
                      className="px-2.5 py-1 rounded-md bg-[#F15B3D]/12 hover:bg-[#F15B3D] text-[#F15B3D] hover:text-white text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. QUẢN LÝ ARTVERSE SHORTS */}
      {adminTab === 'shorts' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#20243A]/12 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                2. QUẢN LÝ ARTVERSE SHORTS ({filteredAdminShorts.length}/{shortVideosOnly.length})
              </h2>
              <p className="text-xs text-[#20243A]/65">
                Quản lý chuyên biệt các video ngắn thuộc phân hệ ARTVERSE SHORTS (tách biệt với tranh triển lãm và video bài giảng GDPT).
              </p>
            </div>
          </div>

          {filteredAdminShorts.length === 0 ? (
            <div className="p-8 rounded-lg bg-[#F7F3EA] text-center text-xs text-[#20243A]/70">
              Không tìm thấy video ngắn nào trong ARTVERSE SHORTS phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAdminShorts.map((vid) => (
                <div
                  key={vid.id}
                  className="p-4 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-sm bg-[#F15B3D] text-white text-[10px] font-bold uppercase">
                        ARTVERSE SHORTS
                      </span>
                      <span className="text-[11px] font-mono-code text-[#20243A]/65">
                        {formatBytes(vid.fileSize)}
                      </span>
                    </div>
                    <h3
                      onClick={() => onSelectArtwork(vid)}
                      className="text-sm font-bold text-[#20243A] cursor-pointer hover:text-[#3457D5]"
                    >
                      {vid.title}
                    </h3>
                    <p className="text-xs text-[#20243A]/65">
                      Tác giả: {vid.authorNickname || vid.authorAlias || vid.creatorAnonymousPseudonym} ·{' '}
                      {getArtworkNormalizedGrade(vid)}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[#20243A]/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        vid.status === 'hidden' ? onUnhideArtwork(vid.id) : onHideArtwork(vid.id)
                      }
                      className="px-2.5 py-1 rounded-md bg-white border border-[#20243A]/20 text-xs font-bold cursor-pointer"
                    >
                      {vid.status === 'hidden' ? 'Hiện lại video' : 'Tạm ẩn video'}
                    </button>

                    {confirmDeleteArtworkId === vid.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteArtwork(vid.id);
                            setConfirmDeleteArtworkId(null);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#F15B3D] text-white text-xs font-bold cursor-pointer"
                        >
                          Xác nhận xóa
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteArtworkId(null)}
                          className="px-2 py-1 rounded-md bg-white border border-[#20243A]/20 text-xs font-bold cursor-pointer"
                        >
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteArtworkId(vid.id)}
                        className="px-2.5 py-1 rounded-md bg-[#F15B3D]/15 text-[#F15B3D] hover:bg-[#F15B3D] hover:text-white text-xs font-bold cursor-pointer"
                      >
                        Xóa video
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. QUẢN LÝ CÂU CHUYỆN */}
      {adminTab === 'stories' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-4">
          <div className="border-b border-[#20243A]/12 pb-3">
            <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
              3. QUẢN LÝ CÂU CHUYỆN SAU NÉT VẼ ({filteredAdminStories.length}/{stories.length})
            </h2>
            <p className="text-xs text-[#20243A]/65">
              Trạng thái quy chuẩn: DRAFT (Bản nháp) · PENDING (Chờ duyệt) · PUBLISHED (Đã công bố) · REVISION_REQUIRED (Yêu cầu chỉnh sửa) · REJECTED (Từ chối) · HIDDEN (Đã ẩn).
            </p>
          </div>

          <div className="space-y-3">
            {filteredAdminStories.map((st) => (
              <div
                key={st.id}
                className="p-4 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold uppercase">
                      {st.status === 'approved' ? 'PUBLISHED' : st.status.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-[#3457D5]">
                      {st.authorNickname} ({normalizeGrade(st.gradeLabel || st.classGroupId)})
                    </span>
                  </div>
                  <span className="text-xs text-[#20243A]/60">Tác phẩm: {st.artworkTitle}</span>
                </div>

                <div>
                  <h3 className="font-editorial text-lg font-bold text-[#20243A]">
                    “{st.storyTitle}”
                  </h3>
                  <p className="text-xs text-[#20243A]/80 mt-1 line-clamp-3">{st.storyContent}</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[#20243A]/10">
                  <input
                    type="text"
                    value={teacherNotesMap[st.id] ?? (st.teacherNote || '')}
                    onChange={(e) =>
                      setTeacherNotesMap((prev) => ({ ...prev, [st.id]: e.target.value }))
                    }
                    placeholder="Nhập nhận xét của giáo viên..."
                    className="flex-1 px-3 py-1.5 rounded-md bg-white border border-[#20243A]/20 text-xs"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        onModerateStory(st.id, 'approved', teacherNotesMap[st.id] ?? st.teacherNote)
                      }
                      className="px-3 py-1.5 rounded-md bg-[#269C91] text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Công bố (PUBLISHED)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onModerateStory(
                          st.id,
                          'revision_required',
                          teacherNotesMap[st.id] || 'Em hãy bổ sung thêm chi tiết cho câu chuyện nhé.'
                        )
                      }
                      className="px-3 py-1.5 rounded-md bg-[#F2D64B] text-[#20243A] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Yêu cầu sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onModerateStory(st.id, 'rejected', teacherNotesMap[st.id] ?? st.teacherNote)
                      }
                      className="px-3 py-1.5 rounded-md bg-[#F15B3D]/15 text-[#F15B3D] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Từ chối</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onModerateStory(st.id, 'hidden', teacherNotesMap[st.id] ?? st.teacherNote)
                      }
                      className="px-3 py-1.5 rounded-md bg-white border border-[#20243A]/20 text-[#20243A] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Ẩn</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. KIỂM DUYỆT BÌNH LUẬN */}
      {adminTab === 'comments' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-4">
          <div className="border-b border-[#20243A]/12 pb-3">
            <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
              4. KIỂM DUYỆT BÌNH LUẬN ({filteredAdminComments.length}/{comments.length})
            </h2>
            <p className="text-xs text-[#20243A]/65">
              Rà soát và kiểm duyệt các bình luận của học sinh &amp; khách thưởng lãm.
            </p>
          </div>

          <div className="space-y-2.5">
            {filteredAdminComments.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-lg bg-[#F7F3EA]/60 border border-[#20243A]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#20243A]">{c.authorAnonymousPseudonym}</span>
                    <span className="text-[#20243A]/50">·</span>
                    <span className="text-[11px] text-[#20243A]/60">{c.createdAt}</span>
                    <span className="px-2 py-0.5 rounded-sm bg-[#20243A]/10 text-[10px] font-bold uppercase">
                      {c.status}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-[#20243A]/90">{c.content}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onApproveComment(c.id)}
                    className="px-3 py-1.5 rounded-md bg-[#269C91] text-white text-xs font-bold cursor-pointer"
                  >
                    Hiển thị
                  </button>
                  <button
                    type="button"
                    onClick={() => onRejectComment(c.id)}
                    className="px-3 py-1.5 rounded-md bg-[#F15B3D] text-white text-xs font-bold cursor-pointer"
                  >
                    Ẩn bình luận
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. KIỂM DUYỆT NỘI DUNG (Báo cáo vi phạm & Nhật ký an toàn) */}
      {adminTab === 'content-moderation' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-6">
          <div className="border-b border-[#20243A]/12 pb-3">
            <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
              5. KIỂM DUYỆT NỘI DUNG &amp; XỬ LÝ BÁO CÁO VI PHẠM
            </h2>
            <p className="text-xs text-[#20243A]/65">
              Xử lý báo cáo vi phạm từ cộng đồng và theo dõi nhật ký kiểm toán an toàn trên ART VERSE AI.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F15B3D]">
              Danh sách báo cáo nội dung ({filteredAdminReports.length}/{reports.length})
            </h3>
            {filteredAdminReports.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#F7F3EA] text-xs text-[#20243A]/70">
                Hiện không có báo cáo vi phạm nào phù hợp.
              </div>
            ) : (
              filteredAdminReports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-4 rounded-lg bg-[#F7F3EA]/70 border border-[#20243A]/15 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F15B3D] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>
                        [{rep.targetType.toUpperCase()}] {rep.targetTitle} — {rep.reasonLabel}
                      </span>
                    </span>
                    <span className="px-2 py-0.5 rounded-sm bg-[#20243A] text-[#F7F3EA] text-[10px] font-bold uppercase">
                      {rep.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#20243A]/80">{rep.details}</p>
                  {rep.status !== 'resolved' && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        type="text"
                        value={reportResolutionNotes[rep.id] || ''}
                        onChange={(e) =>
                          setReportResolutionNotes((prev) => ({
                            ...prev,
                            [rep.id]: e.target.value,
                          }))
                        }
                        placeholder="Ghi chú biện pháp xử lý..."
                        className="flex-1 px-3 py-1.5 rounded-md bg-white border border-[#20243A]/20 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          onResolveReport(
                            rep.id,
                            reportResolutionNotes[rep.id] || 'Đã kiểm tra và xử lý an toàn.'
                          )
                        }
                        className="px-3.5 py-1.5 rounded-md bg-[#269C91] text-white text-xs font-bold cursor-pointer"
                      >
                        Đánh dấu Đã xử lý
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2 pt-4 border-t border-[#20243A]/12">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#20243A]/70">
              Nhật ký Kiểm toán Hệ thống gần đây ({auditLogs.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {auditLogs.slice(0, 15).map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-md bg-[#F7F3EA]/60 border border-[#20243A]/10 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <strong className="text-[#20243A]">{log.targetTitle}</strong>:{' '}
                    <span className="text-[#20243A]/75">{log.details}</span>
                  </div>
                  <span className="text-[10px] font-mono-code text-[#20243A]/55 shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. QUẢN LÝ LƯU TRỮ (Phân biệt rõ 4 loại tệp theo Mục V.6) */}
      {adminTab === 'storage' && (
        <div className="space-y-6">
          <section className="rounded-xl bg-white border border-[#20243A]/15 p-6 space-y-4">
            <div className="border-b border-[#20243A]/12 pb-3">
              <h2 className="font-display text-xl font-bold text-[#20243A] uppercase">
                PHÂN TÍCH DUNG LƯỢNG THEO 4 PHÂN HỆ LƯU TRỮ
              </h2>
              <p className="text-xs text-[#20243A]/65">
                Phân biệt rõ: Ảnh tác phẩm · Video ngắn thuộc ARTVERSE SHORTS · Video bài giảng thuộc MĨ THUẬT GDPT · Tài liệu slide thuộc MĨ THUẬT GDPT.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#3457D5]">
                  1. ẢNH TÁC PHẨM (TRIỂN LÃM)
                </span>
                <p className="font-display text-2xl font-black text-[#20243A] tabular-nums">
                  {storageCategoryBreakdown.artworkImagesCount} tệp
                </p>
                <p className="text-xs font-mono-code text-[#20243A]/70">
                  Dung lượng: {formatBytes(storageCategoryBreakdown.artworkImagesBytes)}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#F15B3D]">
                  2. VIDEO NGẮN (ARTVERSE SHORTS)
                </span>
                <p className="font-display text-2xl font-black text-[#20243A] tabular-nums">
                  {storageCategoryBreakdown.shortVideosCount} tệp
                </p>
                <p className="text-xs font-mono-code text-[#20243A]/70">
                  Dung lượng: {formatBytes(storageCategoryBreakdown.shortVideosBytes)}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#269C91]">
                  3. VIDEO BÀI GIẢNG (MĨ THUẬT GDPT)
                </span>
                <p className="font-display text-2xl font-black text-[#20243A] tabular-nums">
                  {storageCategoryBreakdown.lectureVideosCount} tệp
                </p>
                <p className="text-xs font-mono-code text-[#20243A]/70">
                  Dung lượng: {formatBytes(storageCategoryBreakdown.lectureVideoBytes)}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#F7F3EA] border border-[#20243A]/15 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6945B5]">
                  4. TÀI LIỆU SLIDE (MĨ THUẬT GDPT)
                </span>
                <p className="font-display text-2xl font-black text-[#20243A] tabular-nums">
                  {storageCategoryBreakdown.slideCount} tệp
                </p>
                <p className="text-xs font-mono-code text-[#20243A]/70">
                  Dung lượng: {formatBytes(storageCategoryBreakdown.slideBytes)}
                </p>
              </div>
            </div>
          </section>

          <StorageManagementCenterView
            artworks={artworks}
            currentRole={currentRole}
            currentUserId={profile?.uid || user?.uid || 'teacher-auth'}
            currentUserName={
              profile?.alias || profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật'
            }
            onOpenUploadModal={onOpenUploadModal}
            onSelectArtwork={onSelectArtwork}
            onArtworkDeleted={onArtworkDeleted}
            onArtworkRecovered={onArtworkRecovered}
            onNavigateBack={() => setAdminTab('artworks')}
            onShowToast={onShowToast}
          />
        </div>
      )}

      {/* 7. TRÌNH CHIẾU TRIỂN LÃM */}
      {adminTab === 'projector' && (
        <section className="rounded-xl bg-white border border-[#20243A]/15 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-[#20243A] text-[#F2D64B] flex items-center justify-center mx-auto">
            <Presentation className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="font-display text-2xl font-bold text-[#20243A] uppercase">
              7. TRÌNH CHIẾU TRIỂN LÃM TRÊN MÀN HÌNH LỚN
            </h2>
            <p className="text-xs sm:text-sm text-[#20243A]/70">
              Chế độ trình chiếu toàn màn hình phục vụ tiết học thưởng thức mĩ thuật, trưng bày tổng kết học kỳ và kết nối đa thiết bị trực tiếp.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onOpenProjectorModal(0)}
              className="min-h-[46px] px-6 py-3 rounded-lg bg-[#3457D5] hover:bg-[#20243A] text-white text-xs sm:text-sm font-bold uppercase tracking-wider inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Presentation className="w-4 h-4" />
              <span>KHỞI ĐỘNG TRÌNH CHIẾU TRIỂN LÃM</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
