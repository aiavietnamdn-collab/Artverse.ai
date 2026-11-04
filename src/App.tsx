/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ARTVERSE AI — Hệ sinh thái Thư viện Mĩ thuật Học sinh & INSTANT GALLERY 2.0
 * Tầng Dữ liệu Bền vững: Firebase Firestore & Cloud Storage
 */

import React, { useState, useEffect } from 'react';
import { ScreenTab, ToastMessage } from './types/artverse';
import { 
  UserRole, 
  CommunityArtwork, 
  ClassGroup, 
  ArtLesson, 
  ArtworkComment, 
  ArtworkStory,
  ArtworkStoryStatus,
  ContentReport, 
  AuditLogEntry,
  PositiveReactionKey,
  POSITIVE_REACTIONS_META,
  getRandomAnonymousNickname
} from './types/communityArt';

import { 
  INITIAL_CLASSES, 
  INITIAL_LESSONS, 
  INITIAL_COMMENTS, 
  INITIAL_REPORTS,
  INITIAL_AUDIT_LOGS
} from './data/mockCommunityData';

import { 
  generateAuthorKey, 
  checkReactionRateLimit 
} from './services/communityArtService';

import {
  subscribePublicArtworks,
  subscribeTeacherArtworks,
  subscribeCommunityClasses,
  subscribeCommunityLessons,
  subscribeCommunityAuditLogs,
  subscribeContentReports,
  subscribeArtworkStories,
  moderateArtworkStoryInFirestore,
  createCommunityArtworkInFirestore,
  updateCommunityArtworkInFirestore,
  hideCommunityArtworkInFirestore,
  unhideCommunityArtworkInFirestore,
  deleteCommunityArtworkInFirestore,
  addReactionToArtworkInFirestore,
  saveCommunityClassInFirestore,
  deleteCommunityClassInFirestore,
  saveCommunityLessonInFirestore,
  deleteCommunityLessonInFirestore,
  getCommunityLessonsFromFirestore,
  createContentReportInFirestore,
  updateContentReportInFirestore,
  logCommunityAuditInFirestore,
  seedInitialCommunityDataIfEmpty
} from './services/communityFirestoreService';
import { 
  quarantineArtworkPhoto, 
  restoreArtworkPhotoToPublic, 
  deleteArtworkPhotoFromStorage,
  uploadArtworkPhotoToStorageWithProgress
} from './services/communityStorageService';

import { useAuth } from './context/AuthContext';

import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { RbacRoleBar } from './components/community/RbacRoleBar';
import { getInitialTabFromUrl, syncUrlWithTab, getApiUrl } from './lib/platform';

import { DiscoverView } from './components/community/DiscoverView';
import { CommunityLibraryView } from './components/community/CommunityLibraryView';
import { ArtworkStoriesSection } from './components/community/ArtworkStoriesSection';
import { StudentStoryModal } from './components/community/StudentStoryModal';
import { ClassLessonManagerView } from './components/community/ClassLessonManagerView';
import { ProfileManagementView } from './components/community/ProfileManagementView';
import { ModerationQueueView } from './components/community/ModerationQueueView';
import { SafetyAuditView } from './components/community/SafetyAuditView';
import { ArtworkDetailModal } from './components/community/ArtworkDetailModal';
import { InstantGalleryCaptureModal } from './components/community/InstantGalleryCaptureModal';
import { ProjectorSlideshowModal } from './components/community/ProjectorSlideshowModal';
import { EditArtworkModal } from './components/community/EditArtworkModal';
import { ReportViolationModal } from './components/community/ReportViolationModal';
import { ExhibitionLabelAndCertificateModal } from './components/community/ExhibitionLabelAndCertificateModal';
import { ClassArtbookExportModal } from './components/community/ClassArtbookExportModal';
import { GeminiArtChatbox } from './components/community/GeminiArtChatbox';
import { StudentPinLoginModal } from './components/community/StudentPinLoginModal';
import { StorageManagementCenterView } from './components/community/StorageManagementCenterView';
import { ArtverseShortsView } from './components/community/ArtverseShortsView';
import { UploadHubView } from './components/community/UploadHubView';
import { ManagementAndAdminView } from './components/community/ManagementAndAdminView';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';

import { RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const {
    user,
    profile,
    isTeacher,
    isAdmin,
    verifiedRole,
    loginWithGoogle,
    getValidBearerToken,
    isStudentLoginModalOpen,
    setIsStudentLoginModalOpen,
  } = useAuth();

  const [currentTab, setCurrentTab] = useState<ScreenTab>(() => getInitialTabFromUrl());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState(false);

  // Synchronize URL pathname with active tab & browser Back/Forward navigation
  useEffect(() => {
    syncUrlWithTab(currentTab);
  }, [currentTab]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentTab(getInitialTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // RBAC Role: Synchronized with verified server role
  const [currentRole, setCurrentRole] = useState<UserRole>('viewer');

  useEffect(() => {
    if (verifiedRole === 'admin') {
      setCurrentRole('admin');
    } else if (verifiedRole === 'teacher') {
      setCurrentRole('teacher');
    } else if (verifiedRole === 'student') {
      setCurrentRole('student');
    } else {
      setCurrentRole('viewer');
    }
  }, [verifiedRole]);

  // Anonymous identity management (Zero-Roster: random author key & poetic moniker)
  const [authorKey] = useState<string>(() => {
    const cached = localStorage.getItem('artverse_anon_author_key');
    if (cached) return cached;
    const fresh = generateAuthorKey();
    localStorage.setItem('artverse_anon_author_key', fresh);
    return fresh;
  });

  const [nickname] = useState<string>(() => {
    const cached = localStorage.getItem('artverse_anon_nickname');
    if (cached) return cached;
    const fresh = getRandomAnonymousNickname();
    localStorage.setItem('artverse_anon_nickname', fresh);
    return fresh;
  });

  // Persistent Core Datasets from Firestore (fallback to INITIAL_CLASSES / INITIAL_LESSONS if DB empty)
  const [classes, setClasses] = useState<ClassGroup[]>(INITIAL_CLASSES);
  const [lessons, setLessons] = useState<ArtLesson[]>(INITIAL_LESSONS);
  const [artworks, setArtworks] = useState<CommunityArtwork[]>([]);
  const [stories, setStories] = useState<ArtworkStory[]>([]);
  const [comments, setComments] = useState<ArtworkComment[]>(INITIAL_COMMENTS);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // Firestore Sync & Connection Status
  const [isArtworksLoading, setIsArtworksLoading] = useState<boolean>(true);
  const [isClassesLoading, setIsClassesLoading] = useState<boolean>(true);
  const [firestoreError, setFirestoreError] = useState<string | null>(null);
  const [isSeedingData, setIsSeedingData] = useState<boolean>(false);

  // Filters
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedLessonFilter, setSelectedLessonFilter] = useState<string>('all');

  // Modals & View States
  const [selectedArtworkForDetail, setSelectedArtworkForDetail] = useState<CommunityArtwork | null>(null);
  const [isInstantCaptureModalOpen, setIsInstantCaptureModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [projectorModalState, setProjectorModalState] = useState<{
    isOpen: boolean;
    startIndex: number;
    joinSessionCode?: string | null;
  }>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const liveCode = params.get('liveSession');
      if (liveCode && liveCode.trim()) {
        return {
          isOpen: true,
          startIndex: 0,
          joinSessionCode: liveCode.trim().toUpperCase(),
        };
      }
    }
    return {
      isOpen: false,
      startIndex: 0,
      joinSessionCode: null,
    };
  });
  const [editingArtwork, setEditingArtwork] = useState<CommunityArtwork | null>(null);
  const [labelAndCertModalState, setLabelAndCertModalState] = useState<{
    artwork: CommunityArtwork;
    tab: 'qr-label' | 'certificate';
  } | null>(null);
  const [isArtbookExportModalOpen, setIsArtbookExportModalOpen] = useState<boolean>(false);

  const [reportModalData, setReportModalData] = useState<{
    targetType: 'artwork' | 'comment' | 'story';
    targetId: string;
    targetTitle: string;
  } | null>(null);

  const [storyModalState, setStoryModalState] = useState<{
    isOpen: boolean;
    artwork: CommunityArtwork | null;
    storyToEdit: ArtworkStory | null;
  }>({
    isOpen: false,
    artwork: null,
    storyToEdit: null,
  });

  // Toast notification system
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (type: 'success' | 'error' | 'info', title: string, message: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, type, title, message };
    setToasts((prev) => [...prev, newToast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // 1. Subscribe to Real-time Classes
  useEffect(() => {
    try {
      const unsub = subscribeCommunityClasses(
        (updatedClasses) => {
          setClasses(updatedClasses.length > 0 ? updatedClasses : INITIAL_CLASSES);
          setIsClassesLoading(false);
        },
        (err) => {
          console.error('Lỗi lắng nghe classes:', err);
          setIsClassesLoading(false);
        }
      );
      return () => unsub && unsub();
    } catch (e: any) {
      console.warn('Không thể đăng ký classes snapshot:', e);
      setIsClassesLoading(false);
    }
  }, []);

  // 2. Subscribe to Real-time Lessons
  useEffect(() => {
    try {
      const unsub = subscribeCommunityLessons(
        (updatedLessons) => {
          setLessons(updatedLessons.length > 0 ? updatedLessons : INITIAL_LESSONS);
        },
        (err) => {
          console.error('Lỗi lắng nghe lessons:', err);
        }
      );
      return () => unsub && unsub();
    } catch (e: any) {
      console.warn('Không thể đăng ký lessons snapshot:', e);
    }
  }, []);

  // 3. Subscribe to Real-time Artworks (Separating Teacher vs Visitor)
  useEffect(() => {
    setIsArtworksLoading(true);
    setFirestoreError(null);

    let unsub: (() => void) | undefined;
    try {
      if (isTeacher || isAdmin) {
        unsub = subscribeTeacherArtworks(
          user?.uid || '',
          isAdmin,
          (items) => {
            setArtworks(items);
            setIsArtworksLoading(false);
          },
          (err) => {
            console.error('Lỗi tải artworks giáo viên:', err);
            setFirestoreError('Không thể đồng bộ danh sách tác phẩm từ Firestore.');
            setIsArtworksLoading(false);
          }
        );
      } else {
        unsub = subscribePublicArtworks(
          (items) => {
            setArtworks(items);
            setIsArtworksLoading(false);
          },
          (err) => {
            console.error('Lỗi tải artworks công khai:', err);
            setFirestoreError('Không thể đồng bộ tác phẩm công khai.');
            setIsArtworksLoading(false);
          }
        );
      }
    } catch (err: any) {
      console.error('Exception khi subscribe artworks:', err);
      setFirestoreError(err.message || 'Lỗi kết nối Firestore');
      setIsArtworksLoading(false);
    }

    return () => unsub && unsub();
  }, [isTeacher, isAdmin, user?.uid]);

  // 4. Subscribe to Real-time Audit Logs (Teacher/Admin only)
  useEffect(() => {
    if (!isTeacher && !isAdmin) return;
    try {
      const unsub = subscribeCommunityAuditLogs(
        (logs) => setAuditLogs(logs),
        (err) => console.warn('Lỗi lắng nghe audit logs:', err)
      );
      return () => unsub && unsub();
    } catch (e) {
      console.warn('Audit logs subscription skipped:', e);
    }
  }, [isTeacher, isAdmin]);

  // 5. Subscribe to Content Reports (Teacher/Admin only)
  useEffect(() => {
    if (!isTeacher && !isAdmin) return;
    try {
      const unsub = subscribeContentReports(
        (repList) => setReports(repList),
        (err) => console.warn('Lỗi lắng nghe content reports:', err)
      );
      return () => unsub && unsub();
    } catch (e) {
      console.warn('Content reports subscription skipped:', e);
    }
  }, [isTeacher, isAdmin]);

  // 5B. Subscribe to Artwork Stories (Firestore + Backend /api/stories sync)
  useEffect(() => {
    let active = true;
    let unsubFirestore: (() => void) | undefined;

    const mergeStoriesList = (incoming: ArtworkStory[]) => {
      if (!active) return;
      setStories((prev) => {
        const map = new Map<string, ArtworkStory>();
        for (const s of prev) {
          if (s && s.id) map.set(s.id, s);
        }
        for (const s of incoming) {
          if (s && s.id) map.set(s.id, s);
        }
        return Array.from(map.values()).sort((a, b) =>
          String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))
        );
      });
    };

    try {
      unsubFirestore = subscribeArtworkStories(
        (fsStories) => {
          mergeStoriesList(fsStories);
        },
        (err) => console.warn('Artwork stories Firestore listener notice:', err)
      );
    } catch (e) {
      console.warn('Artwork stories Firestore subscription skipped:', e);
    }

    getValidBearerToken()
      .then((token) =>
        fetch(getApiUrl('/api/stories'), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.stories)) {
          mergeStoriesList(data.stories);
        }
      })
      .catch(() => {
        // ignore offline fetch
      });

    return () => {
      active = false;
      if (unsubFirestore) unsubFirestore();
    };
  }, [profile?.uid, user?.uid, isTeacher, isAdmin, getValidBearerToken]);

  // 6. Auto-open Artwork Detail when scanning QR code link (#gallery?token=...)
  useEffect(() => {
    if (artworks.length === 0) return;
    const checkHashToken = () => {
      const hash = window.location.hash || '';
      const tokenMatch = hash.match(/[?&]token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        const token = decodeURIComponent(tokenMatch[1]);
        const found = artworks.find((a) => a.shareToken === token);
        if (found) {
          setSelectedArtworkForDetail(found);
        }
      }
    };
    checkHashToken();
    window.addEventListener('hashchange', checkHashToken);
    return () => window.removeEventListener('hashchange', checkHashToken);
  }, [artworks]);

  // Audit Logger Helper (Writes to Firestore & UI)
  const logAuditAction = async (
    action: AuditLogEntry['action'],
    targetId: string,
    targetTitle: string,
    details: string,
    isSafeOperation: boolean = true
  ) => {
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      action,
      targetId,
      targetTitle,
      performedBy: user?.displayName || (currentRole === 'teacher' ? 'Giáo viên Mĩ thuật' : currentRole === 'admin' ? 'Quản trị viên' : 'Khách vãng lai'),
      performedByRole: currentRole,
      timestamp: new Date().toLocaleDateString('vi-VN') + ' ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      details,
      isSafeOperation
    };
    setAuditLogs((prev) => [entry, ...prev]);
    await logCommunityAuditInFirestore(entry);
  };

  // Reactions Handler with Firestore Atomic Increment & 5s Rate-Limiting
  const handleReaction = async (artworkId: string, reactionKey: PositiveReactionKey) => {
    const isAllowed = checkReactionRateLimit(artworkId, reactionKey);
    if (!isAllowed) {
      showToast('info', 'Thao tác nhanh', 'Vui lòng chờ vài giây trước khi gửi thêm cảm xúc cho tác phẩm này.');
      return;
    }

    // Optimistic UI update
    setArtworks((prev) =>
      prev.map((art) => {
        if (art.id === artworkId) {
          return {
            ...art,
            reactions: {
              ...art.reactions,
              [reactionKey]: (art.reactions[reactionKey] || 0) + 1
            }
          };
        }
        return art;
      })
    );

    setSelectedArtworkForDetail((prev) => {
      if (prev && prev.id === artworkId) {
        return {
          ...prev,
          reactions: {
            ...prev.reactions,
            [reactionKey]: (prev.reactions[reactionKey] || 0) + 1
          }
        };
      }
      return prev;
    });

    const meta = POSITIVE_REACTIONS_META[reactionKey];

    try {
      await addReactionToArtworkInFirestore(artworkId, reactionKey);
      showToast('success', 'Đã lưu phản hồi thật', `Bạn đã gửi lời động viên "${meta?.label}" lên máy chủ!`);
    } catch (err: any) {
      console.error('Lỗi khi ghi reaction lên Firestore:', err);
      showToast('error', 'Lỗi đồng bộ', 'Không thể ghi nhận cảm xúc lên cơ sở dữ liệu.');
    }
  };

  // INSTANT GALLERY 2.0: 9-Step Verified Batch Publish Handler
  const handleBatchPublishSuccess = (
    newArtworks: CommunityArtwork[],
    reloadedArtworks?: CommunityArtwork[]
  ) => {
    setArtworks((prev) => {
      const baseList = reloadedArtworks && reloadedArtworks.length > 0 ? reloadedArtworks : prev;
      const map = new Map<string, CommunityArtwork>();
      for (const art of newArtworks) {
        map.set(art.id, art);
      }
      for (const item of baseList) {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      }
      return Array.from(map.values());
    });

    // Ensure the user's newly uploaded artwork is not hidden by a different grade/lesson filter
    if (
      newArtworks.length > 0 &&
      selectedClassFilter !== 'all' &&
      !newArtworks.some((a) => a.classGroupId === selectedClassFilter)
    ) {
      setSelectedClassFilter('all');
    }
    setSelectedLessonFilter('all');
    setCurrentTab('community-library');

    // Audit logs for each published artwork
    for (const art of newArtworks) {
      logAuditAction(
        art.status === 'approved' ? 'instant_publish' : 'security_block',
        art.id,
        art.title,
        art.status === 'approved'
          ? `Xuất bản tức thì vào ${art.className} (Đã lưu Cloud, khử sạch EXIF GPS).`
          : `Tác phẩm được chuyển vào Hàng chờ duyệt: ${art.moderation.moderatorNote || 'Chờ duyệt'}`
      );
    }
  };

  // Admin Image Editor: Save Edited Image to Storage & Firestore
  const handleUpdateArtworkImage = async (
    targetArtwork: CommunityArtwork,
    editedBlob: Blob,
    mode: 'overwrite' | 'new_copy'
  ) => {
    const targetId =
      mode === 'new_copy'
        ? `art-edit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
        : targetArtwork.id;

    const uploadRes = await uploadArtworkPhotoToStorageWithProgress(
      editedBlob,
      targetId,
      true,
      targetArtwork.publishedByTeacherId || user?.uid || 'admin'
    );

    const freshUrl = uploadRes.downloadUrl;
    const nowStr = new Date().toLocaleDateString('vi-VN');

    if (mode === 'overwrite') {
      await updateCommunityArtworkInFirestore(targetArtwork.id, {
        imageUrl: freshUrl,
        imagePath: uploadRes.storagePath,
        updatedAt: nowStr,
      });
      const updatedRecord: CommunityArtwork = {
        ...targetArtwork,
        imageUrl: freshUrl,
        imagePath: uploadRes.storagePath,
        updatedAt: nowStr,
      };
      setArtworks((prev) => prev.map((a) => (a.id === updatedRecord.id ? updatedRecord : a)));
      setSelectedArtworkForDetail(updatedRecord);
      showToast(
        'success',
        'Đã lưu ảnh chỉnh sửa',
        `Ảnh của tác phẩm "${targetArtwork.title}" đã được cập nhật bền vững.`
      );
    } else {
      const copyRecord: CommunityArtwork = {
        ...targetArtwork,
        id: targetId,
        title: `${targetArtwork.title} (Bản trưng bày)`,
        imageUrl: freshUrl,
        imagePath: uploadRes.storagePath,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      const verifiedCopy = await createCommunityArtworkInFirestore(copyRecord);
      setArtworks((prev) => [verifiedCopy, ...prev]);
      setSelectedArtworkForDetail(verifiedCopy);
      showToast(
        'success',
        'Đã lưu bản trưng bày mới',
        `Đã tạo phiên bản "${verifiedCopy.title}" trong triển lãm.`
      );
    }
  };

  // Save Edited Artwork
  const handleSaveEditedArtwork = async (updated: CommunityArtwork) => {
    setArtworks((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedArtworkForDetail && selectedArtworkForDetail.id === updated.id) {
      setSelectedArtworkForDetail(updated);
    }
    try {
      await updateCommunityArtworkInFirestore(updated.id, {
        title: updated.title,
        creatorAnonymousPseudonym: updated.creatorAnonymousPseudonym,
        description: updated.description,
        materialsUsed: updated.materialsUsed,
        classGroupId: updated.classGroupId,
        className: updated.className,
        lessonId: updated.lessonId,
        lessonTitle: updated.lessonTitle,
        shareStatus: updated.shareStatus
      });
      logAuditAction('manual_publish', updated.id, updated.title, 'Cập nhật thông tin tác phẩm.');
    } catch (err: any) {
      console.warn('Lỗi cập nhật Firestore:', err);
    }
  };

  // Hide Artwork (Instantly drops from public gallery on Firestore)
  const handleHideArtwork = async (artworkId: string) => {
    try {
      await hideCommunityArtworkInFirestore(artworkId);
      // Quarantine public image token in Cloud Storage
      await quarantineArtworkPhoto(artworkId);
      if (selectedArtworkForDetail && selectedArtworkForDetail.id === artworkId) {
        setSelectedArtworkForDetail((prev) => prev ? { ...prev, status: 'hidden' } : null);
      }
      logAuditAction('hide', artworkId, 'Tác phẩm', 'Giáo viên tạm ẩn tác phẩm và thu hồi liên kết công khai.');
      showToast('info', 'Đã tạm ẩn tác phẩm', 'Tác phẩm đã được ẩn trên máy chủ (chỉ giáo viên quản lý nhìn thấy).');
    } catch (err: any) {
      showToast('error', 'Lỗi phân quyền', 'Không thể tạm ẩn tác phẩm trên máy chủ: ' + (err.message || ''));
    }
  };

  // Unhide Artwork (Restores back to public gallery on Firestore & Cloud Storage)
  const handleUnhideArtwork = async (artworkId: string) => {
    const target = artworks.find(a => a.id === artworkId);
    try {
      // 1. Restore photo to public exhibition folder from private master
      let freshPublicUrl = target?.imageUrl;
      try {
        freshPublicUrl = await restoreArtworkPhotoToPublic(artworkId, target?.publishedByTeacherId || user?.uid || '');
      } catch (storageErr) {
        console.warn('Không thể tái xuất bản ảnh ra public (ảnh có thể là data URL hoặc đã sẵn sàng):', storageErr);
      }

      // 2. Update Firestore document
      await updateCommunityArtworkInFirestore(artworkId, {
        status: 'approved',
        imageUrl: freshPublicUrl || target?.imageUrl
      });

      if (selectedArtworkForDetail && selectedArtworkForDetail.id === artworkId) {
        setSelectedArtworkForDetail((prev) => prev ? { ...prev, status: 'approved', imageUrl: freshPublicUrl || prev.imageUrl } : null);
      }
      logAuditAction('unhide', artworkId, target?.title || 'Tác phẩm', 'Giáo viên khôi phục tác phẩm trở lại triển lãm công khai.');
      showToast('success', 'Đã khôi phục tác phẩm', 'Tác phẩm đã xuất hiện trở lại trong triển lãm công khai với liên kết ảnh hợp lệ.');
    } catch (err: any) {
      showToast('error', 'Lỗi phân quyền', 'Không thể khôi phục tác phẩm trên máy chủ: ' + (err.message || ''));
    }
  };

  // Toggle Artwork Share Status
  const handleToggleShare = async (artworkId: string) => {
    const target = artworks.find(a => a.id === artworkId);
    if (!target) return;
    const nextShare = target.shareStatus === 'shared' ? 'private' : 'shared';

    try {
      let freshUrl = target.imageUrl;
      if (nextShare === 'private') {
        // Quarantine public copy from Cloud Storage so public URLs return 404
        await quarantineArtworkPhoto(artworkId, target.publishedByTeacherId || user?.uid || '');
      } else if (nextShare === 'shared' && target.status === 'approved') {
        // Restore public copy to exhibition folder
        try {
          freshUrl = await restoreArtworkPhotoToPublic(artworkId, target.publishedByTeacherId || user?.uid || '');
        } catch (e) {
          console.warn('Khôi phục ảnh công khai:', e);
        }
      }

      await updateCommunityArtworkInFirestore(artworkId, {
        shareStatus: nextShare,
        imageUrl: freshUrl || target.imageUrl
      });

      if (selectedArtworkForDetail && selectedArtworkForDetail.id === artworkId) {
        setSelectedArtworkForDetail((prev) => prev ? { ...prev, shareStatus: nextShare, imageUrl: freshUrl || prev.imageUrl } : null);
      }
      logAuditAction('permission_change', artworkId, target.title, `Đổi trạng thái chia sẻ sang "${nextShare}".`);
      showToast('info', 'Đã cập nhật quyền chia sẻ', `Trạng thái chia sẻ đã đổi thành "${nextShare}".`);
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', 'Không thể cập nhật quyền chia sẻ trên Firestore: ' + (err.message || ''));
    }
  };

  // Delete Artwork (Deletes document from Firestore AND cleans Storage files)
  const handleDeleteArtwork = async (artworkId: string) => {
    const target = artworks.find((a) => a.id === artworkId);
    try {
      // 1. Delete from Firestore
      await deleteCommunityArtworkInFirestore(artworkId);

      // 2. Permanently clean up both public and private photos from Cloud Storage
      await deleteArtworkPhotoFromStorage(artworkId, target?.publishedByTeacherId || user?.uid || '');

      if (target) {
        logAuditAction('remove', target.id, target.title, 'Xóa vĩnh viễn tác phẩm và dọn sạch tệp ảnh khỏi hệ thống.');
      }
      if (selectedArtworkForDetail && selectedArtworkForDetail.id === artworkId) {
        setSelectedArtworkForDetail(null);
      }
      showToast('success', 'Đã xóa tác phẩm', 'Tác phẩm và tệp ảnh đã được dọn sạch hoàn toàn khỏi hệ thống.');
    } catch (err: any) {
      showToast('error', 'Lỗi xóa tác phẩm', err.message || 'Không thể xóa tác phẩm trên máy chủ.');
    }
  };

  // Moderation Handlers
  const handleApproveArtwork = async (artworkId: string, moderatorNote?: string) => {
    try {
      await updateCommunityArtworkInFirestore(artworkId, {
        status: 'approved',
        moderation: {
          moderatedBy: user?.displayName || 'Ban Kiểm duyệt',
          moderatedAt: new Date().toLocaleDateString('vi-VN'),
          moderatorNote: moderatorNote || 'Phê duyệt hợp lệ.'
        }
      });
      logAuditAction('manual_publish', artworkId, 'Tác phẩm', `Ban kiểm duyệt phê duyệt: ${moderatorNote || 'Hợp lệ'}`);
      showToast('success', 'Đã phê duyệt', 'Tác phẩm đã được phê duyệt và hiển thị công khai.');
    } catch (err: any) {
      showToast('error', 'Lỗi phê duyệt', err.message || 'Thất bại.');
    }
  };

  const handleRejectArtwork = async (artworkId: string, reason: string) => {
    const target = artworks.find(a => a.id === artworkId);
    try {
      // Quarantine public image
      await quarantineArtworkPhoto(artworkId, target?.publishedByTeacherId || user?.uid || '');

      await updateCommunityArtworkInFirestore(artworkId, {
        status: 'rejected',
        moderation: {
          moderatedBy: user?.displayName || 'Ban Kiểm duyệt',
          moderatedAt: new Date().toLocaleDateString('vi-VN'),
          rejectionReason: reason
        }
      });
      logAuditAction('security_block', artworkId, target?.title || 'Tác phẩm', `Yêu cầu chỉnh sửa và thu hồi ảnh công khai: ${reason}`);
      showToast('info', 'Đã từ chối', `Đã chuyển tác phẩm sang trạng thái từ chối: ${reason}`);
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', err.message || 'Thất bại.');
    }
  };

  const handleRemoveArtwork = async (artworkId: string) => {
    await handleDeleteArtwork(artworkId);
  };

  const handleApproveComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, status: 'approved', moderatedBy: 'Ban Kiểm duyệt' } : c
      )
    );
  };

  const handleRejectComment = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, status: 'hidden', moderatedBy: 'Ban Kiểm duyệt' } : c
      )
    );
  };

  const handleResolveReport = async (reportId: string, actionNote: string) => {
    try {
      await updateContentReportInFirestore(reportId, {
        status: 'resolved',
        resolvedAt: new Date().toLocaleDateString('vi-VN'),
        resolutionAction: actionNote,
        resolverRole: currentRole
      });
      logAuditAction('report_resolved', reportId, 'Báo cáo', `Xử lý báo cáo: ${actionNote}`);
      showToast('success', 'Đã xử lý báo cáo', 'Báo cáo vi phạm đã được giải quyết trên Firestore.');
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', 'Không thể cập nhật trạng thái báo cáo.');
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'open' | 'reviewing' | 'resolved') => {
    try {
      await updateContentReportInFirestore(reportId, { status });
    } catch (err: any) {
      showToast('error', 'Lỗi cập nhật', 'Không thể cập nhật trạng thái báo cáo.');
    }
  };

  // Class & Lesson CRUD with Persistent Firestore Writes
  const handleAddClass = async (newClass: ClassGroup) => {
    try {
      await saveCommunityClassInFirestore(newClass);
      logAuditAction('permission_change', newClass.id, newClass.name, 'Tạo không gian lớp học mới trên Firestore.');
      showToast('success', 'Đã lưu lớp học', `Lớp "${newClass.name}" đã được lưu trên Firestore.`);
    } catch (err: any) {
      showToast('error', 'Lỗi lưu lớp', err.message || 'Thất bại');
    }
  };

  const handleUpdateClass = async (updated: ClassGroup) => {
    try {
      await saveCommunityClassInFirestore(updated);
      showToast('success', 'Đã cập nhật', `Thông tin lớp "${updated.name}" đã được lưu.`);
    } catch (err: any) {
      showToast('error', 'Lỗi cập nhật', err.message || 'Thất bại');
    }
  };

  const handleToggleHideClass = async (classId: string) => {
    const target = classes.find(c => c.id === classId);
    if (!target) return;
    try {
      await saveCommunityClassInFirestore({ ...target, isHidden: !target.isHidden });
      showToast('info', 'Đã thay đổi hiển thị', `Lớp "${target.name}" đã được ${!target.isHidden ? 'ẩn' : 'hiển thị'}.`);
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', err.message || 'Thất bại');
    }
  };

  const handleTogglePublicGallery = async (classId: string) => {
    const target = classes.find(c => c.id === classId);
    if (!target) return;
    const nextState = !target.isPublicGalleryEnabled;
    try {
      await saveCommunityClassInFirestore({ ...target, isPublicGalleryEnabled: nextState });
      logAuditAction(
        'permission_change',
        target.id,
        target.name,
        `Quản trị viên ${nextState ? 'Mở' : 'Khóa'} chế độ Triển lãm Công khai (Instant Gallery).`
      );
      showToast('success', 'Đã cập nhật chế độ Triển lãm', `Không gian ${target.name} đã ${nextState ? 'MỞ' : 'KHÓA'} triển lãm công khai.`);
    } catch (err: any) {
      showToast('error', 'Lỗi phân quyền', err.message || 'Thất bại');
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteCommunityClassInFirestore(classId);
      showToast('success', 'Đã xóa lớp', 'Lớp học đã được xóa khỏi Firestore.');
    } catch (err: any) {
      showToast('error', 'Lỗi xóa lớp', err.message || 'Thất bại');
    }
  };

  const handleAddLesson = async (newLesson: ArtLesson) => {
    try {
      const saved = await saveCommunityLessonInFirestore(newLesson);
      setLessons((prev) => {
        const filtered = prev.filter((l) => l.id !== saved.id);
        return [saved, ...filtered];
      });
      const refreshed = await getCommunityLessonsFromFirestore();
      if (refreshed.length > 0) {
        setLessons(refreshed);
      }
      showToast('success', 'Đã lưu bài học bền vững', `Bài học "${saved.title}" đã được lưu trên Firestore.`);
    } catch (err: any) {
      showToast('error', 'Lỗi lưu bài học', err.message || 'Thất bại');
    }
  };

  const handleUpdateLesson = async (updated: ArtLesson) => {
    try {
      const saved = await saveCommunityLessonInFirestore(updated);
      setLessons((prev) => {
        const exists = prev.some((l) => l.id === saved.id);
        return exists
          ? prev.map((l) => (l.id === saved.id ? saved : l))
          : [saved, ...prev];
      });
      const refreshed = await getCommunityLessonsFromFirestore();
      if (refreshed.length > 0) {
        setLessons(refreshed);
      }
      showToast('success', 'Đã cập nhật bài học bền vững', `Bài học "${saved.title}" đã được lưu trên Firestore.`);
    } catch (err: any) {
      showToast('error', 'Lỗi cập nhật', err.message || 'Thất bại');
    }
  };

  const handleToggleHideLesson = async (lessonId: string) => {
    const target = lessons.find(l => l.id === lessonId);
    if (!target) return;
    try {
      const saved = await saveCommunityLessonInFirestore({ ...target, isHidden: !target.isHidden });
      setLessons((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
      showToast('info', 'Đã thay đổi hiển thị', `Bài học "${target.title}" đã được ${!target.isHidden ? 'ẩn' : 'hiển thị'}.`);
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', err.message || 'Thất bại');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await deleteCommunityLessonInFirestore(lessonId);
      setLessons((prev) =>
        prev.map((l) => (l.id === lessonId ? { ...l, status: 'deleted', isHidden: true } : l))
      );
      const refreshed = await getCommunityLessonsFromFirestore();
      if (refreshed.length > 0) {
        setLessons(refreshed);
      }
      showToast('success', 'Đã xóa bài học', 'Bài học đã được đánh dấu xóa bền vững trên Firestore.');
    } catch (err: any) {
      showToast('error', 'Lỗi xóa bài học', err.message || 'Thất bại');
    }
  };

  // Violation Report Submission
  const handleSubmitReport = async (report: ContentReport) => {
    try {
      await createContentReportInFirestore(report);
      logAuditAction('security_block', report.targetId, report.targetTitle, `Báo cáo ẩn danh từ cộng đồng: ${report.reasonLabel}`);
      showToast('success', 'Đã gửi báo cáo', 'Cảm ơn bạn. Báo cáo đã được gửi tới Ban Kiểm duyệt an toàn.');
    } catch (err: any) {
      showToast('error', 'Lỗi gửi báo cáo', err.message || 'Thất bại');
    }
  };

  // Explicit Seed Initial Classes & Lessons Helper (Only on confirmation)
  const handleSeedStandardStructure = async () => {
    if (!isTeacher && !isAdmin) {
      showToast('error', 'Yêu cầu quyền', 'Vui lòng đăng nhập tài khoản Giáo viên để khởi tạo không gian lớp học.');
      return;
    }

    setIsSeedingData(true);
    try {
      const seeded = await seedInitialCommunityDataIfEmpty(INITIAL_CLASSES, INITIAL_LESSONS);
      if (seeded) {
        showToast('success', 'Khởi tạo thành công', 'Đã tạo 3 lớp học và các bài học GDPT 2018 chuẩn trên Firestore!');
      } else {
        showToast('info', 'Đã có dữ liệu', 'Cơ sở dữ liệu Firestore đã có dữ liệu lớp học trước đó.');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi khởi tạo', err.message || 'Không thể tạo dữ liệu mẫu lên máy chủ.');
    } finally {
      setIsSeedingData(false);
    }
  };

  // Pending Moderation Count
  const pendingModerationCount =
    artworks.filter((a) => a.status === 'pending').length +
    stories.filter((s) => s.status === 'pending').length +
    comments.filter((c) => c.status === 'pending').length +
    reports.filter((r) => r.status === 'open').length;

  const handleOpenWriteStoryModal = (
    artwork?: CommunityArtwork | null,
    storyToEdit?: ArtworkStory | null
  ) => {
    setStoryModalState({
      isOpen: true,
      artwork: artwork || null,
      storyToEdit: storyToEdit || null,
    });
  };

  const handleModerateStory = async (
    storyId: string,
    status: ArtworkStoryStatus,
    teacherNote?: string
  ) => {
    try {
      const token = await getValidBearerToken();
      const res = await fetch(getApiUrl(`/api/stories/${encodeURIComponent(storyId)}/moderate`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status, teacherNote }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Không thể cập nhật trạng thái câu chuyện.');
      }

      const updatedStory = data.story as ArtworkStory;
      setStories((prev) => prev.map((s) => (s.id === storyId ? updatedStory : s)));

      try {
        await moderateArtworkStoryInFirestore(
          storyId,
          status,
          teacherNote,
          profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật'
        );
      } catch (fsErr) {
        console.warn('Firestore story moderation mirror warning:', fsErr);
      }

      const labelMap: Record<ArtworkStoryStatus, string> = {
        approved: 'Đã duyệt xuất bản câu chuyện công khai!',
        revision_required: 'Đã gửi góp ý yêu cầu học sinh chỉnh sửa câu chuyện.',
        rejected: 'Đã từ chối xuất bản câu chuyện.',
        hidden: 'Đã tạm ẩn câu chuyện.',
        pending: 'Đã chuyển câu chuyện về trạng thái chờ duyệt.',
        draft: 'Đã chuyển câu chuyện về bản nháp.',
      };
      showToast('success', 'Đã cập nhật câu chuyện', labelMap[status]);
    } catch (err: any) {
      showToast(
        'error',
        'Lỗi duyệt câu chuyện',
        err?.message || 'Không thể cập nhật trạng thái câu chuyện.'
      );
    }
  };

  const handleQuickAction = () => {
    setIsInstantCaptureModalOpen(true);
  };

  return (
    <div className="wonderland-workspace min-h-screen bg-[#F7F3EA] text-[#20243A] flex flex-col antialiased">
      {/* Offline Mode & Student Privacy Guarantee Banner */}
      <OfflineStatusBanner />

      {/* Top Role Switcher Bar with Server-Backed Enforcement (Desktop only) */}
      <RbacRoleBar 
        currentRole={currentRole} 
        onSelectRole={setCurrentRole} 
        onShowAuthModal={loginWithGoogle}
      />

      {/* Cloud Persistence Status Banner */}
      {firestoreError && (
        <div className="bg-rose-50 border-b border-rose-300 px-4 py-2.5 text-xs text-rose-900 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Lỗi kết nối Firestore:</strong> {firestoreError}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-800 hover:bg-rose-100 font-semibold cursor-pointer shrink-0"
          >
            Tải lại kết nối
          </button>
        </div>
      )}

      {/* Contemporary Creative Gallery Main Stage */}
      <div className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto">
        <div className="flex-1 flex w-full bg-[#F7F3EA] lg:border-x lg:border-[#20243A]/12 overflow-hidden">
          {/* Desktop Perimeter Navigation Rail */}
          <Sidebar
            currentTab={currentTab}
            onSelectTab={setCurrentTab}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            currentRole={currentRole}
            pendingModerationCount={pendingModerationCount}
          />

          {/* Main Exhibition Stage */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#F7F3EA]">
            <Header
              currentTab={currentTab}
              onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
              onQuickAction={handleQuickAction}
              onSelectTab={setCurrentTab}
              onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
              quickActionLabel="Đăng tác phẩm"
            />

            <main className="flex-1 px-4 py-5 md:px-6 md:py-7 lg:px-8 lg:py-8 pb-safe-nav lg:pb-12 max-w-7xl w-full mx-auto">
              {/* 0. Discover View (Contemporary Creative Gallery Homepage) */}
              {currentTab === 'discover' && (
                <div className="space-y-4">
                  {isArtworksLoading ? (
                    <div className="bg-white rounded-lg border border-[#20243A]/12 p-14 text-center space-y-2.5">
                      <RefreshCw className="w-6 h-6 text-[#3457D5] animate-spin mx-auto" />
                      <h3 className="font-display text-lg font-bold text-[#20243A]">
                        Đang tải Không gian Triển lãm...
                      </h3>
                      <p className="text-xs text-[#20243A]/60">
                        Đồng bộ kho lưu trữ tác phẩm từ Cloud Firestore
                      </p>
                    </div>
                  ) : (
                    <DiscoverView
                      artworks={artworks}
                      stories={stories}
                      classes={classes}
                      lessons={lessons}
                      currentRole={currentRole}
                      currentAuthorKey={authorKey}
                      onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                      onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
                      onOpenProjectorModal={(idx) =>
                        setProjectorModalState({ isOpen: true, startIndex: idx })
                      }
                      onNavigateTab={setCurrentTab}
                      onSelectClassInGallery={(clsId) => {
                        setSelectedClassFilter(clsId);
                        setCurrentTab('community-library');
                      }}
                      onReaction={handleReaction}
                    />
                  )}
                </div>
              )}

              {/* 1. Digital Gallery (Triển lãm Nghệ thuật & Tự sự) */}
              {(currentTab === 'community-library' || currentTab === 'library') && (
                <div className="space-y-4">
                  {isArtworksLoading ? (
                    <div className="bg-white rounded-3xl border-2 border-[#E2D9F3] p-16 text-center space-y-3 shadow-sm">
                      <RefreshCw className="w-8 h-8 text-[#8B5CF6] animate-spin mx-auto" />
                      <h3 className="font-display text-xl font-extrabold text-[#1E1B4B]">
                        Đang tải Không gian Triển lãm Nghệ thuật...
                      </h3>
                      <p className="text-xs text-[#5B587B]">
                        Đọc các tác phẩm mĩ thuật công khai từ Cloud Firestore
                      </p>
                    </div>
                  ) : (
                    <CommunityLibraryView
                      artworks={artworks}
                      stories={stories}
                      classes={classes}
                      lessons={lessons}
                      currentRole={currentRole}
                      currentAuthorKey={authorKey}
                      currentStudentUid={profile?.uid || user?.uid}
                      selectedClassFilter={selectedClassFilter}
                      onChangeClassFilter={setSelectedClassFilter}
                      selectedLessonFilter={selectedLessonFilter}
                      onChangeLessonFilter={setSelectedLessonFilter}
                      onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                      onOpenInstantCaptureModal={() => setIsInstantCaptureModalOpen(true)}
                      onOpenProjectorModal={(idx) =>
                        setProjectorModalState({ isOpen: true, startIndex: idx })
                      }
                      onOpenArtbookExportModal={() => setIsArtbookExportModalOpen(true)}
                      onOpenLabelAndCertificate={(art, tab) =>
                        setLabelAndCertModalState({ artwork: art, tab })
                      }
                      onOpenWriteStoryModal={handleOpenWriteStoryModal}
                      onModerateStory={handleModerateStory}
                      onEditArtwork={(art) => setEditingArtwork(art)}
                      onHideArtwork={handleHideArtwork}
                      onUnhideArtwork={handleUnhideArtwork}
                      onReaction={handleReaction}
                      onDeleteArtwork={handleDeleteArtwork}
                      onToggleShareStatus={handleToggleShare}
                      onOpenReportModal={(targetType, targetId, targetTitle) => {
                        setReportModalData({ targetType, targetId, targetTitle });
                      }}
                      onShowToast={showToast}
                    />
                  )}
                </div>
              )}

              {/* 3. ARTVERSE SHORTS Dedicated Subsystem */}
              {currentTab === 'artverse-shorts' && (
                <ArtverseShortsView
                  artworks={artworks}
                  classes={classes}
                  currentRole={currentRole}
                  currentAuthorKey={authorKey}
                  currentUserId={profile?.uid || user?.uid || 'anon-artist'}
                  currentUserAlias={profile?.alias || profile?.displayName || nickname}
                  onShortPublished={(newShort) => {
                    setArtworks((prev) => [newShort, ...prev]);
                  }}
                  onApproveShort={(id) => handleApproveArtwork(id)}
                  onHideShort={handleHideArtwork}
                  onUnhideShort={handleUnhideArtwork}
                  onDeleteShort={handleDeleteArtwork}
                  onOpenReportModal={(targetType, targetId, targetTitle) => {
                    setReportModalData({ targetType, targetId, targetTitle });
                  }}
                  onShowToast={showToast}
                />
              )}

              {/* 1B. Artverse Stories Dedicated View (4. CÂU CHUYỆN SAU NÉT VẼ) */}
              {currentTab === 'art-stories' && (
                <ArtworkStoriesSection
                  stories={stories}
                  artworks={artworks}
                  lessons={lessons}
                  onOpenArtworkDetail={(art) => setSelectedArtworkForDetail(art)}
                  onOpenWriteStoryModal={handleOpenWriteStoryModal}
                  onModerateStory={handleModerateStory}
                  onReportStory={(story) =>
                    setReportModalData({
                      targetType: 'story',
                      targetId: story.id,
                      targetTitle: story.storyTitle,
                    })
                  }
                />
              )}

              {/* 5. MĨ THUẬT GDPT (Kho Tài nguyên Giảng dạy Mỹ thuật) */}
              {currentTab === 'class-lessons' && (
                <ClassLessonManagerView
                  classes={classes}
                  lessons={lessons}
                  artworks={artworks}
                  currentRole={currentRole}
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onToggleHideClass={handleToggleHideClass}
                  onTogglePublicGalleryEnabled={handleTogglePublicGallery}
                  onDeleteClass={handleDeleteClass}
                  onAddLesson={handleAddLesson}
                  onUpdateLesson={handleUpdateLesson}
                  onToggleHideLesson={handleToggleHideLesson}
                  onDeleteLesson={handleDeleteLesson}
                  onShowToast={showToast}
                />
              )}

              {/* 6. ĐĂNG TẢI (Upload Hub — 5 mục đăng tải chính thức) */}
              {currentTab === 'upload-hub' && (
                <UploadHubView
                  currentRole={currentRole}
                  onSelectUploadArtwork={() => setIsInstantCaptureModalOpen(true)}
                  onSelectUploadShort={() => setCurrentTab('artverse-shorts')}
                  onSelectUploadStory={() => handleOpenWriteStoryModal(null, null)}
                  onSelectUploadGdpt={() => setCurrentTab('class-lessons')}
                />
              )}

              {/* IV. NHÓM CÔNG CỤ QUẢN LÝ */}
              {currentTab === 'management-tools' && (
                <ManagementAndAdminView
                  mode="management"
                  currentRole={currentRole}
                  onChangeRole={setCurrentRole}
                  classes={classes}
                  lessons={lessons}
                  artworks={artworks}
                  stories={stories}
                  comments={comments}
                  reports={reports}
                  auditLogs={auditLogs}
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onToggleHideClass={handleToggleHideClass}
                  onTogglePublicGallery={handleTogglePublicGallery}
                  onDeleteClass={handleDeleteClass}
                  onApproveArtwork={handleApproveArtwork}
                  onRejectArtwork={handleRejectArtwork}
                  onHideArtwork={handleHideArtwork}
                  onUnhideArtwork={handleUnhideArtwork}
                  onDeleteArtwork={handleDeleteArtwork}
                  onModerateStory={handleModerateStory}
                  onApproveComment={handleApproveComment}
                  onRejectComment={handleRejectComment}
                  onResolveReport={handleResolveReport}
                  onUpdateReportStatus={handleUpdateReportStatus}
                  onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                  onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
                  onOpenProjectorModal={(idx) =>
                    setProjectorModalState({ isOpen: true, startIndex: idx })
                  }
                  onArtworkDeleted={(artworkId) => {
                    setArtworks((prev) => prev.filter((a) => a.id !== artworkId));
                  }}
                  onArtworkRecovered={(recoveredArt) => {
                    setArtworks((prev) => [recoveredArt, ...prev]);
                  }}
                  onShowToast={showToast}
                />
              )}

              {/* V. NHÓM QUẢN TRỊ HỆ THỐNG */}
              {currentTab === 'system-admin' && (
                <ManagementAndAdminView
                  mode="admin"
                  currentRole={currentRole}
                  onChangeRole={setCurrentRole}
                  classes={classes}
                  lessons={lessons}
                  artworks={artworks}
                  stories={stories}
                  comments={comments}
                  reports={reports}
                  auditLogs={auditLogs}
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onToggleHideClass={handleToggleHideClass}
                  onTogglePublicGallery={handleTogglePublicGallery}
                  onDeleteClass={handleDeleteClass}
                  onApproveArtwork={handleApproveArtwork}
                  onRejectArtwork={handleRejectArtwork}
                  onHideArtwork={handleHideArtwork}
                  onUnhideArtwork={handleUnhideArtwork}
                  onDeleteArtwork={handleDeleteArtwork}
                  onModerateStory={handleModerateStory}
                  onApproveComment={handleApproveComment}
                  onRejectComment={handleRejectComment}
                  onResolveReport={handleResolveReport}
                  onUpdateReportStatus={handleUpdateReportStatus}
                  onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                  onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
                  onOpenProjectorModal={(idx) =>
                    setProjectorModalState({ isOpen: true, startIndex: idx })
                  }
                  onArtworkDeleted={(artworkId) => {
                    setArtworks((prev) => prev.filter((a) => a.id !== artworkId));
                  }}
                  onArtworkRecovered={(recoveredArt) => {
                    setArtworks((prev) => [recoveredArt, ...prev]);
                  }}
                  onShowToast={showToast}
                />
              )}

              {/* 3B. Gemini AI Art Chatbox Full-Page View */}
              {currentTab === 'ai-chatbox' && (
                <GeminiArtChatbox
                  lessons={lessons}
                  isFullPage={true}
                  onShowToast={showToast}
                />
              )}

              {/* 4. Moderation Queue View (Teacher, Moderator, Admin) */}
              {currentTab === 'moderation' && (
                <ModerationQueueView
                  artworks={artworks}
                  comments={comments}
                  reports={reports}
                  currentRole={currentRole}
                  currentModeratorName={user?.displayName || 'Tổ Kiểm duyệt Mĩ thuật'}
                  onApproveArtwork={handleApproveArtwork}
                  onRejectArtwork={handleRejectArtwork}
                  onHideArtwork={handleHideArtwork}
                  onRemoveArtwork={handleRemoveArtwork}
                  onApproveComment={handleApproveComment}
                  onRejectComment={handleRejectComment}
                  onResolveReport={handleResolveReport}
                  onUpdateReportStatus={handleUpdateReportStatus}
                  onShowToast={showToast}
                />
              )}

              {/* 5. Safety & RBAC Audit View */}
              {currentTab === 'safety-audit' && (
                <SafetyAuditView
                  currentRole={currentRole}
                  onChangeRole={setCurrentRole}
                  currentAuthorKey={authorKey}
                  currentNickname={nickname}
                  auditLogs={auditLogs}
                  onShowToast={showToast}
                />
              )}

              {/* 5B. Storage Management Center View (Admin / Teacher / Moderator) */}
              {currentTab === 'storage-center' && (
                <StorageManagementCenterView
                  artworks={artworks}
                  currentRole={currentRole}
                  currentUserId={profile?.uid || user?.uid || 'teacher-auth'}
                  currentUserName={profile?.alias || profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật'}
                  onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
                  onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                  onArtworkDeleted={(artworkId) => {
                    setArtworks((prev) => prev.filter((a) => a.id !== artworkId));
                    if (selectedArtworkForDetail?.id === artworkId) {
                      setSelectedArtworkForDetail(null);
                    }
                  }}
                  onArtworkRecovered={(recoveredArt) => {
                    setArtworks((prev) => {
                      const exists = prev.some((a) => a.id === recoveredArt.id);
                      if (exists) {
                        return prev.map((a) => (a.id === recoveredArt.id ? recoveredArt : a));
                      }
                      return [recoveredArt, ...prev];
                    });
                  }}
                  onNavigateBack={() => setCurrentTab('discover')}
                  onShowToast={showToast}
                />
              )}

              {/* 7. HỒ SƠ CÁ NHÂN */}
              {currentTab === 'profile-manage' && (
                <ProfileManagementView
                  currentRole={currentRole}
                  onSelectRole={setCurrentRole}
                  onNavigateTab={setCurrentTab}
                  onOpenArtbookExportModal={() => setIsArtbookExportModalOpen(true)}
                  pendingModerationCount={pendingModerationCount}
                  artworksCount={artworks.length}
                  classesCount={classes.length}
                  lessonsCount={lessons.length}
                  authorKey={authorKey}
                  nickname={nickname}
                  artworks={artworks}
                  stories={stories}
                  lessons={lessons}
                  onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                  onOpenWriteStoryModal={handleOpenWriteStoryModal}
                  onShowToast={showToast}
                />
              )}
            </main>

            {/* Official Brand Footer (Section I. QUY CHUẨN THƯƠNG HIỆU — ART VERSE AI) */}
            <footer className="border-t border-[#20243A]/12 bg-white px-4 py-4 md:px-8 text-xs text-[#20243A]/65 flex flex-col sm:flex-row items-center justify-between gap-2 pb-safe-nav lg:pb-4">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-[#20243A] tracking-tight">
                  ART VERSE AI
                </span>
                <span>·</span>
                <span>Không gian Triển lãm Nghệ thuật Đương đại &amp; Học liệu Mĩ thuật GDPT</span>
              </div>
              <div className="font-mono-code text-[11px] text-[#20243A]/55">
                ART VERSE AI · ARTVERSE SHORTS · CONTEMPORARY CREATIVE GALLERY
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Navigation for iPhone (Khám phá · Triển lãm · Upload · Lớp học · Cá nhân/Quản lý) */}
      <MobileBottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
        pendingModerationCount={pendingModerationCount}
      />

      {/* Artwork Detail Modal */}
      {selectedArtworkForDetail && (() => {
        const navPool = artworks.filter(
          (a) => isTeacher || isAdmin || (a.status === 'approved' && a.shareStatus === 'shared')
        );
        const currentIndex = navPool.findIndex((a) => a.id === selectedArtworkForDetail.id);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex >= 0 && currentIndex < navPool.length - 1;

        return (
          <ArtworkDetailModal
            artwork={selectedArtworkForDetail}
            allArtworks={artworks}
            story={
              stories.find(
                (s) =>
                  s.artworkId === selectedArtworkForDetail.id &&
                  (s.status === 'approved' ||
                    isTeacher ||
                    isAdmin ||
                    (profile?.uid && s.authorAccountId === profile.uid))
              ) || null
            }
            comments={comments.filter(c => c.artworkId === selectedArtworkForDetail.id)}
            currentRole={currentRole}
            userAuthorKey={authorKey}
            currentStudentUid={profile?.uid || user?.uid}
            onClose={() => setSelectedArtworkForDetail(null)}
            onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
            hasPrevArtwork={hasPrev}
            hasNextArtwork={hasNext}
            onPrevArtwork={
              hasPrev ? () => setSelectedArtworkForDetail(navPool[currentIndex - 1]) : undefined
            }
            onNextArtwork={
              hasNext ? () => setSelectedArtworkForDetail(navPool[currentIndex + 1]) : undefined
            }
            onOpenWriteStoryModal={(art) => handleOpenWriteStoryModal(art, null)}
            onHideArtwork={handleHideArtwork}
            onDeleteArtwork={handleDeleteArtwork}
            onUpdateArtworkImage={handleUpdateArtworkImage}
            onToggleShare={(artworkId) => handleToggleShare(artworkId)}
            onReact={handleReaction}
            onOpenReportModal={(targetType: 'artwork' | 'comment' | 'story', targetId: string, targetTitle: string) => {
              setReportModalData({ targetType, targetId, targetTitle });
            }}
            onOpenLabelAndCertificate={(art, tab) => setLabelAndCertModalState({ artwork: art, tab })}
            onShowToast={showToast}
          />
        );
      })()}

      {/* Student Storytelling Modal (Artverse Stories) */}
      <StudentStoryModal
        isOpen={storyModalState.isOpen}
        onClose={() =>
          setStoryModalState({ isOpen: false, artwork: null, storyToEdit: null })
        }
        initialArtwork={storyModalState.artwork}
        initialStory={storyModalState.storyToEdit}
        artworks={artworks}
        existingStories={stories}
        onStorySaved={(savedStory) => {
          setStories((prev) => {
            const exists = prev.some((s) => s.id === savedStory.id);
            if (exists) {
              return prev.map((s) => (s.id === savedStory.id ? savedStory : s));
            }
            return [savedStory, ...prev];
          });
        }}
        onShowToast={showToast}
      />

      {/* Exhibition QR Label & Digital Certificate Modal */}
      {labelAndCertModalState && (
        <ExhibitionLabelAndCertificateModal
          artwork={labelAndCertModalState.artwork}
          initialTab={labelAndCertModalState.tab}
          onClose={() => setLabelAndCertModalState(null)}
          onShowToast={showToast}
        />
      )}

      {/* Class Artbook & Exhibition Poster Export Modal */}
      {isArtbookExportModalOpen && (
        <ClassArtbookExportModal
          artworks={artworks}
          classes={classes}
          lessons={lessons}
          initialClassFilter={selectedClassFilter}
          initialLessonFilter={selectedLessonFilter}
          onClose={() => setIsArtbookExportModalOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* Instant Gallery 2.0 Batch Capture Modal with Cloud Storage & Firestore */}
      {isInstantCaptureModalOpen && (
        <InstantGalleryCaptureModal
          classes={classes}
          lessons={lessons}
          currentRole={currentRole}
          currentUserId={profile?.uid || user?.uid || 'teacher-auth'}
          currentUserName={profile?.alias || profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật'}
          currentUserAlias={profile?.alias || profile?.displayName || nickname}
          onClose={() => setIsInstantCaptureModalOpen(false)}
          onBatchPublishSuccess={handleBatchPublishSuccess}
          onShowToast={showToast}
        />
      )}

      {/* Classroom Projector & Multi-Device Live Presentation Modal */}
      {projectorModalState.isOpen && (
        <ProjectorSlideshowModal
          artworks={artworks.filter((a) => a.status === 'approved' && a.shareStatus === 'shared')}
          classes={classes}
          lessons={lessons}
          initialIndex={projectorModalState.startIndex}
          initialClassFilter={selectedClassFilter}
          initialLessonFilter={selectedLessonFilter}
          initialJoinSessionCode={projectorModalState.joinSessionCode}
          onClose={() =>
            setProjectorModalState({ isOpen: false, startIndex: 0, joinSessionCode: null })
          }
          onReact={handleReaction}
          onShowToast={showToast}
        />
      )}

      {/* Edit Artwork Modal */}
      {editingArtwork && (
        <EditArtworkModal
          artwork={editingArtwork}
          classes={classes}
          lessons={lessons}
          onClose={() => setEditingArtwork(null)}
          onSave={handleSaveEditedArtwork}
          onShowToast={showToast}
        />
      )}

      {/* Report Violation Modal */}
      {reportModalData && (
        <ReportViolationModal
          targetType={reportModalData.targetType}
          targetId={reportModalData.targetId}
          targetTitle={reportModalData.targetTitle}
          onClose={() => setReportModalData(null)}
          onSubmitReport={handleSubmitReport}
          onShowToast={showToast}
        />
      )}

      {/* Floating Gemini AI Art Chatbox Widget (shown on all tabs except full-page ai-chatbox, hidden for Teachers) */}
      {currentTab !== 'ai-chatbox' &&
        currentRole !== 'teacher' &&
        currentRole !== 'moderator' && (
          <GeminiArtChatbox
            lessons={lessons}
            isFullPage={false}
            isOpenFloating={isFloatingChatOpen}
            onToggleFloating={setIsFloatingChatOpen}
            onShowToast={showToast}
          />
        )}

      {/* Student PIN Login Modal (Method A: Class Code + Student Code + 6-digit PIN) */}
      <StudentPinLoginModal
        isOpen={isStudentLoginModalOpen}
        onClose={() => setIsStudentLoginModalOpen(false)}
        onLoginSuccess={() => {
          showToast(
            'success',
            'Đăng nhập Học sinh thành công!',
            'Chào mừng em đến với Không gian Học tập & Sáng tạo ART VERSE AI.'
          );
        }}
      />

      {/* Global Search Modal (THANH TÌM KIẾM TOÀN CỤC) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        artworks={artworks}
        stories={stories}
        lessons={lessons}
        currentRole={currentRole}
        onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
        onNavigateTab={setCurrentTab}
      />

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
