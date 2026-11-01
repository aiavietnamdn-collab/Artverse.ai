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
  createContentReportInFirestore,
  updateContentReportInFirestore,
  logCommunityAuditInFirestore,
  seedInitialCommunityDataIfEmpty
} from './services/communityFirestoreService';
import { 
  quarantineArtworkPhoto, 
  restoreArtworkPhotoToPublic, 
  deleteArtworkPhotoFromStorage 
} from './services/communityStorageService';

import { useAuth } from './context/AuthContext';

import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineStatusBanner } from './components/common/OfflineStatusBanner';
import { RbacRoleBar } from './components/community/RbacRoleBar';
import { getInitialTabFromUrl, syncUrlWithTab } from './lib/platform';

import { DiscoverView } from './components/community/DiscoverView';
import { CommunityLibraryView } from './components/community/CommunityLibraryView';
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

import { RefreshCw, AlertCircle } from 'lucide-react';

export default function App() {
  const { user, profile, isTeacher, isAdmin, verifiedRole, loginWithGoogle } = useAuth();

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
  const [projectorModalState, setProjectorModalState] = useState<{ isOpen: boolean; startIndex: number }>({
    isOpen: false,
    startIndex: 0
  });
  const [editingArtwork, setEditingArtwork] = useState<CommunityArtwork | null>(null);
  const [labelAndCertModalState, setLabelAndCertModalState] = useState<{
    artwork: CommunityArtwork;
    tab: 'qr-label' | 'certificate';
  } | null>(null);
  const [isArtbookExportModalOpen, setIsArtbookExportModalOpen] = useState<boolean>(false);

  const [reportModalData, setReportModalData] = useState<{
    targetType: 'artwork' | 'comment';
    targetId: string;
    targetTitle: string;
  } | null>(null);

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

  // INSTANT GALLERY 2.0: Batch Publish Handler
  const handleBatchPublishSuccess = (newArtworks: CommunityArtwork[]) => {
    setArtworks((prev) => {
      const existingIds = new Set(prev.map(a => a.id));
      const uniqueNew = newArtworks.filter(a => !existingIds.has(a.id));
      return [...uniqueNew, ...prev];
    });

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
      await saveCommunityLessonInFirestore(newLesson);
      showToast('success', 'Đã tạo bài học', `Bài học "${newLesson.title}" đã được lưu trên Firestore.`);
    } catch (err: any) {
      showToast('error', 'Lỗi lưu bài học', err.message || 'Thất bại');
    }
  };

  const handleUpdateLesson = async (updated: ArtLesson) => {
    try {
      await saveCommunityLessonInFirestore(updated);
      showToast('success', 'Đã cập nhật bài học', `Bài học "${updated.title}" đã được lưu.`);
    } catch (err: any) {
      showToast('error', 'Lỗi cập nhật', err.message || 'Thất bại');
    }
  };

  const handleToggleHideLesson = async (lessonId: string) => {
    const target = lessons.find(l => l.id === lessonId);
    if (!target) return;
    try {
      await saveCommunityLessonInFirestore({ ...target, isHidden: !target.isHidden });
      showToast('info', 'Đã thay đổi hiển thị', `Bài học "${target.title}" đã được ${!target.isHidden ? 'ẩn' : 'hiển thị'}.`);
    } catch (err: any) {
      showToast('error', 'Lỗi máy chủ', err.message || 'Thất bại');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      await deleteCommunityLessonInFirestore(lessonId);
      showToast('success', 'Đã xóa bài học', 'Bài học đã được xóa khỏi Firestore.');
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
    comments.filter((c) => c.status === 'pending').length +
    reports.filter((r) => r.status === 'open').length;

  const handleQuickAction = () => {
    setIsInstantCaptureModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#121316] flex flex-col antialiased">
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
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 text-xs text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Lỗi kết nối Firestore:</strong> {firestoreError}</span>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 hover:bg-rose-100 font-semibold cursor-pointer shrink-0"
          >
            Tải lại kết nối
          </button>
        </div>
      )}

      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (Hidden on iPhone screens) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          currentRole={currentRole}
          pendingModerationCount={pendingModerationCount}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            currentTab={currentTab}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onQuickAction={handleQuickAction}
            onSelectTab={setCurrentTab}
            quickActionLabel="Đăng tác phẩm"
          />

          <main className="flex-1 p-4 md:p-6 lg:p-8 pb-safe-nav lg:pb-8 max-w-7xl w-full mx-auto">
            {/* 0. Discover View (Trang Khám Phá) */}
            {currentTab === 'discover' && (
              <div className="space-y-4">
                {isArtworksLoading ? (
                  <div className="bg-white rounded-3xl border border-stone-200 p-14 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#1D4ED8] animate-spin mx-auto" />
                    <h3 className="text-sm font-bold text-stone-800">Đang đồng bộ dữ liệu thật từ Cloud Firestore...</h3>
                    <p className="text-xs text-stone-500">Đang tải không gian Khám phá &amp; Triển lãm Mĩ thuật</p>
                  </div>
                ) : (
                  <DiscoverView
                    artworks={artworks}
                    classes={classes}
                    lessons={lessons}
                    currentRole={currentRole}
                    currentAuthorKey={authorKey}
                    onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                    onOpenUploadModal={() => setIsInstantCaptureModalOpen(true)}
                    onOpenProjectorModal={(idx) => setProjectorModalState({ isOpen: true, startIndex: idx })}
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

            {/* 1. Digital Gallery (Triển lãm) */}
            {(currentTab === 'community-library' || currentTab === 'library') && (
              <div className="space-y-4">
                {isArtworksLoading ? (
                  <div className="bg-white rounded-3xl border border-stone-200 p-14 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-[#1D4ED8] animate-spin mx-auto" />
                    <h3 className="text-sm font-bold text-stone-800">Đang đồng bộ dữ liệu thật từ Cloud Firestore...</h3>
                    <p className="text-xs text-stone-500">Đọc các tác phẩm mĩ thuật công khai được bảo vệ an toàn</p>
                  </div>
                ) : (
                  <CommunityLibraryView
                    artworks={artworks}
                    classes={classes}
                    lessons={lessons}
                    currentRole={currentRole}
                    currentAuthorKey={authorKey}
                    selectedClassFilter={selectedClassFilter}
                    onChangeClassFilter={setSelectedClassFilter}
                    selectedLessonFilter={selectedLessonFilter}
                    onChangeLessonFilter={setSelectedLessonFilter}
                    onSelectArtwork={(art) => setSelectedArtworkForDetail(art)}
                    onOpenInstantCaptureModal={() => setIsInstantCaptureModalOpen(true)}
                    onOpenProjectorModal={(idx) => setProjectorModalState({ isOpen: true, startIndex: idx })}
                    onOpenArtbookExportModal={() => setIsArtbookExportModalOpen(true)}
                    onOpenLabelAndCertificate={(art, tab) => setLabelAndCertModalState({ artwork: art, tab })}
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

            {/* 2. Class & Lesson Manager View (Lớp học & Tham khảo Bài học Khối 6, 7, 8, 9) */}
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
                currentModeratorName={user?.displayName || "Tổ Kiểm duyệt Mĩ thuật"}
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

            {/* 6. Profile & Management Hub (Cá nhân / Quản lý) */}
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
                onShowToast={showToast}
              />
            )}
          </main>
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
      {selectedArtworkForDetail && (
        <ArtworkDetailModal
          artwork={selectedArtworkForDetail}
          comments={comments.filter(c => c.artworkId === selectedArtworkForDetail.id)}
          currentRole={currentRole}
          userAuthorKey={authorKey}
          onClose={() => setSelectedArtworkForDetail(null)}
          onHideArtwork={handleHideArtwork}
          onDeleteArtwork={handleDeleteArtwork}
          onToggleShare={(artworkId) => handleToggleShare(artworkId)}
          onReact={handleReaction}
          onOpenReportModal={(targetType: 'artwork' | 'comment', targetId: string, targetTitle: string) => {
            setReportModalData({ targetType, targetId, targetTitle });
          }}
          onOpenLabelAndCertificate={(art, tab) => setLabelAndCertModalState({ artwork: art, tab })}
          onShowToast={showToast}
        />
      )}

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
          currentUserId={user?.uid || 'teacher-auth'}
          currentUserName={profile?.displayName || user?.displayName || 'Giáo viên Mĩ thuật'}
          onClose={() => setIsInstantCaptureModalOpen(false)}
          onBatchPublishSuccess={handleBatchPublishSuccess}
          onShowToast={showToast}
        />
      )}

      {/* Classroom Projector Slideshow Modal */}
      {projectorModalState.isOpen && (
        <ProjectorSlideshowModal
          artworks={artworks.filter((a) => a.status === 'approved' && a.shareStatus === 'shared')}
          initialIndex={projectorModalState.startIndex}
          onClose={() => setProjectorModalState({ isOpen: false, startIndex: 0 })}
          onReact={handleReaction}
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

      {/* Floating Gemini AI Art Chatbox Widget (shown on all tabs except full-page ai-chatbox) */}
      {currentTab !== 'ai-chatbox' && (
        <GeminiArtChatbox
          lessons={lessons}
          isFullPage={false}
          isOpenFloating={isFloatingChatOpen}
          onToggleFloating={setIsFloatingChatOpen}
          onShowToast={showToast}
        />
      )}

      {/* Global Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}
