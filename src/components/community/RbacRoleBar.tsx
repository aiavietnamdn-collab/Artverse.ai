import React from 'react';
import { UserRole } from '../../types/communityArt';
import { Shield, Eye, Palette, GraduationCap, ShieldAlert, Check, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface RbacRoleBarProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  onShowAuthModal?: () => void;
}

export const RbacRoleBar: React.FC<RbacRoleBarProps> = ({ currentRole, onSelectRole, onShowAuthModal }) => {
  const { user, profile, isTeacher, isAdmin, verifiedRole } = useAuth();

  const roles: { 
    key: UserRole; 
    label: string; 
    desc: string; 
    icon: React.ReactNode; 
    color: string;
    requiresAuth: boolean;
    requiredVerifiedRole?: 'teacher' | 'admin';
  }[] = [
    {
      key: 'viewer',
      label: 'Khách xem',
      desc: 'Chỉ xem tác phẩm đã duyệt và chia sẻ, gửi phản hồi tích cực (Không cần đăng nhập)',
      icon: <Eye className="w-3.5 h-3.5" />,
      color: 'border-slate-300 text-slate-700 bg-slate-50',
      requiresAuth: false
    },
    {
      key: 'contributor',
      label: 'Đóng góp ẩn danh',
      desc: 'Gửi tác phẩm ẩn danh (bản nháp/chờ duyệt, lưu với token ngẫu nhiên)',
      icon: <Palette className="w-3.5 h-3.5" />,
      color: 'border-emerald-300 text-emerald-800 bg-emerald-50',
      requiresAuth: false
    },
    {
      key: 'teacher',
      label: 'Giáo viên',
      desc: 'Chụp xuất bản tức thì, quản lý lớp/bài học và duyệt tác phẩm (Cần tài khoản Giáo viên)',
      icon: <GraduationCap className="w-3.5 h-3.5" />,
      color: 'border-blue-300 text-blue-800 bg-blue-50',
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'moderator',
      label: 'Kiểm duyệt viên',
      desc: 'Xử lý hàng chờ duyệt và giải quyết báo cáo vi phạm nội dung',
      icon: <ShieldAlert className="w-3.5 h-3.5" />,
      color: 'border-purple-300 text-purple-800 bg-purple-50',
      requiresAuth: true,
      requiredVerifiedRole: 'teacher'
    },
    {
      key: 'admin',
      label: 'Quản trị viên',
      desc: 'Toàn quyền cấu hình bảo mật, lớp học và quản lý phân quyền Firestore',
      icon: <Shield className="w-3.5 h-3.5" />,
      color: 'border-amber-300 text-amber-800 bg-amber-50',
      requiresAuth: true,
      requiredVerifiedRole: 'admin'
    },
  ];

  const handleRoleClick = (roleDef: typeof roles[number]) => {
    // SECURITY ENFORCEMENT: Disallow unauthenticated guests from self-escalating to teacher or admin
    if (roleDef.requiresAuth && !user) {
      if (onShowAuthModal) {
        onShowAuthModal();
      } else {
        alert('Vui lòng đăng nhập bằng tài khoản Google để kích hoạt vai trò Giáo viên / Quản trị viên.');
      }
      return;
    }

    if (roleDef.requiredVerifiedRole === 'admin' && !isAdmin) {
      alert('Tài khoản của bạn chưa được cấp quyền Quản trị viên trên máy chủ.');
      return;
    }

    if (roleDef.requiredVerifiedRole === 'teacher' && !isTeacher) {
      alert('Tài khoản của bạn chưa có quyền Giáo viên trên cơ sở dữ liệu Firestore.');
      return;
    }

    onSelectRole(roleDef.key);
  };

  const activeRoleMeta = roles.find(r => r.key === currentRole) || roles[0];

  return (
    <div className="hidden lg:block bg-white/95 backdrop-blur-sm border-b border-stone-200/80 px-4 py-2 text-xs no-print shadow-2xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
            <Shield className="w-3 h-3 text-slate-400" />
            Phân quyền Máy chủ (Zero-Trust):
          </span>
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {roles.map((r) => {
              const isActive = currentRole === r.key;
              const isLocked = r.requiresAuth && (!user || (r.requiredVerifiedRole === 'admin' && !isAdmin));

              return (
                <button
                  key={r.key}
                  onClick={() => handleRoleClick(r)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border ${
                    isActive
                      ? `${r.color} shadow-xs font-bold scale-[1.02]`
                      : isLocked
                      ? 'border-dashed border-slate-200 text-slate-400 bg-slate-50/50 hover:bg-slate-100 cursor-not-allowed'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={isLocked ? `Cần đăng nhập tài khoản có thẩm quyền để kích hoạt ${r.label}` : r.desc}
                >
                  {isLocked ? <Lock className="w-3 h-3 text-slate-400" /> : r.icon}
                  <span>{r.label}</span>
                  {isActive && <Check className="w-3 h-3 text-current ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          {user ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Đã xác thực: <strong>{profile?.displayName || user.email}</strong> ({verifiedRole})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              Khách vãng lai (Quyền xem công khai)
            </span>
          )}
          <span className="hidden xl:inline text-slate-400">·</span>
          <span className="italic truncate hidden xl:inline">{activeRoleMeta.desc}</span>
        </div>
      </div>
    </div>
  );
};
