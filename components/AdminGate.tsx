'use client';

import { isAdmin, getSession } from '@/lib/store/auth-store';
import { ShieldAlert, User } from 'lucide-react';

function ViewerNotice() {
  const session = getSession();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)] bg-[image:var(--bg-image)] text-[var(--text-color)]">
      <div className="w-full max-w-md p-4">
        <div className="bg-[var(--glass-bg)] backdrop-blur-[25px] saturate-[180%] border border-[var(--glass-border)] rounded-[var(--radius-2xl)] p-8 shadow-[var(--shadow-md)] flex flex-col items-center gap-6">
          <div className="w-16 h-16 rounded-[var(--radius-full)] bg-amber-500/10 flex items-center justify-center text-amber-500 mb-2 shadow-[var(--shadow-sm)] border border-[var(--glass-border)]">
            <ShieldAlert size={32} />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">权限不足</h2>
            <p className="text-[var(--text-color-secondary)]">仅管理员可修改设置</p>
          </div>

          {session && (
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-sm">
              <User size={16} className="text-[var(--text-color-secondary)]" />
              <span>当前用户：{session.name}</span>
              <span className="px-2 py-0.5 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-[var(--radius-full)] text-xs text-[var(--text-color-secondary)]">
                观众
              </span>
            </div>
          )}

          <a
            href={window?.location?.pathname?.includes('/premium') ? '/premium' : '/'}
            className="w-full py-3 px-4 bg-[var(--accent-color)] text-white font-bold rounded-[var(--radius-2xl)] hover:translate-y-[-2px] hover:brightness-110 shadow-[var(--shadow-sm)] hover:shadow-[0_4px_8px_var(--shadow-color)] active:translate-y-0 active:scale-[0.98] transition-all duration-200 text-center"
          >
            返回首页
          </a>
        </div>
      </div>
    </div>
  );
}

export function AdminGate({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  if (!isAdmin()) return fallback || <ViewerNotice />;
  return <>{children}</>;
}
