import React from 'react';
import { UserRole } from '../../types/communityArt';
import { Shield, Eye, Palette, GraduationCap, ShieldAlert, Check, Lock, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RbacRoleBarProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onShowAuthModal?: () => void;
}

export const RbacRoleBar: React.FC<RbacRoleBarProps> = ({ currentRole, onSelectRole, onShowAuthModal }) => {
  const { user, profile, isTeacher, isAdmin, isStudent, verifiedRole, setIsStudentLoginModalOpen } = useAuth();

  const roles: { 
    key: UserRole; 
    label: string; 
    desc: string; 
    icon: React.ReactNode; 
    requiresAuth: boolean;
    requiredVerifiedRole?: 'student' | 'teacher' | 'admin';
  }[] = [
    {
      key: 'viewer',
      label: 'Khách thưởng lãm',
      desc: 'Thưởng lãm tác phẩm công khai và gửi phản hồi khích lệ (Không cần đăng nhập)',
      icon: <Eye className="w-3.5 h-3.5" />,
      requiresAuth: false
    },
    {
      key: 'student',
      label: 'Nghệ sĩ Học sinh (PIN)',
      desc: 'Đăng nhập bằng Mã lớp + Mã học sinh + Mã PIN; đăng tranh, viết câu chuyện & hỏi Trợ lý Gemini',
      icon: <KeyRound className="w-3.5 h-3.5" />,
      requiresAuth: true,
      requiredVerifiedRole: 'student'
    },
    {
      key: 'contributor',
      label: 'Đóng góp ẩn danh',
      desc: 'Gửi tác phẩm với biệt danh nghệ thuật ẩn danh',
      icon: <Palette className="w-3.5 h-3.5" />,
      requiresAuth: false
    },
    {
      key: 'teacher',
      label: 'Giáo viên Mĩ thuật',
      desc: 'Quản lý lớp, cấp thẻ PIN học sinh, xuất bản tức thì và duyệt câu chuyện',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'moderator',
      label: 'Giám tuyển / Kiểm duyệt',
      desc: 'Duyệt hàng chờ tác phẩm và xử lý báo cáo nội dung',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'admin',
      label: 'Quản trị Bảo tàng',
      desc: 'Phân quyền giáo viên, chỉnh sửa ảnh triển lãm & quản trị toàn hệ thống',
      icon: <Shield className="w-3.5 h-3.5" />,
      requiresAuth: true,
      requiredVerifiedRole: 'admin'
    },
  ];

  const handleRoleClick = (roleDef: typeof roles[number]) => {
    if (roleDef.requiredVerifiedRole === 'student') {
      if (isStudent) {
        onSelectRole('student');
      } else {
        setIsStudentLoginModalOpen(true);
      }
      return;
    }

    if (roleDef.requiresAuth && !user) {
      if (onShowAuthModal) {
        onShowAuthModal();
      }
      return;
    }

    if (roleDef.requiredVerifiedRole === 'admin' && !isAdmin) {
      return;
    }

    if (roleDef.requiredVerifiedRole === 'teacher' && !isTeacher) {
      return;
    }

    onSelectRole(roleDef.key);
  };

  const activeRoleMeta = roles.find(r => r.key === currentRole) || roles[0];

  return (
    <div className="hidden lg:block bg-[#181817] px-6 pt-2.5 pb-1 text-[11px] no-print">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-[#9A968E] uppercase tracking-[0.22em] text-[9px] font-semibold">
            MUSEUM ACCESS PASS:
          </span>
          <div className="flex items-center gap-1">
            {roles.map((r) => {
              const isActive = currentRole === r.key;
              const isLocked =
                r.requiresAuth &&
                ((r.requiredVerifiedRole === 'student' && !isStudent) ||
                  (r.requiredVerifiedRole === 'teacher' && !isTeacher) ||
                  (r.requiredVerifiedRole === 'admin' && !isAdmin));

              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => handleRoleClick(r)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium transition-colors border cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#0B0B0C] text-[#F3C1C6] border-[#F3C1C6]/50 font-bold'
                      : isLocked
                        ? 'border-transparent text-[#9A968E]/55 hover:text-[#F4F0EA]'
                        : 'border-transparent text-[#9A968E] hover:text-[#F4F0EA]'
                  }`}
                  title={isLocked ? `Nhấn để đăng nhập kích hoạt ${r.label}` : r.desc}
                >
                  {isLocked ? <Lock className="w-2.5 h-2.5 text-[#9A968E]/50" /> : r.icon}
                  <span>{r.label}</span>
                  {isActive && <Check className="w-2.5 h-2.5 text-[#F3C1C6]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[10px] text-[#9A968E] flex items-center gap-2 shrink-0">
          {profile ? (
            <span>
              Đã xác thực: <strong className="text-[#F4F0EA]">{profile.nickname || profile.displayName}</strong> · <span className="text-[#F3C1C6] uppercase tracking-wider text-[9px]">{verifiedRole}</span>
            </span>
          ) : (
            <span className="uppercase tracking-[0.18em] text-[9px]">PUBLIC EXHIBITION VISITOR</span>
          )}
          <span className="hidden xl:inline text-[#F4F0EA]/20">·</span>
          <span className="font-editorial italic truncate max-w-xs hidden xl:inline text-[#9A968E]">{activeRoleMeta.desc}</span>
        </div>
      </div>
    </div>
  );
};

