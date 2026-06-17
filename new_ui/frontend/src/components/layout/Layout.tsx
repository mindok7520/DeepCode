import { ReactNode, useEffect, useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { TaskRecoveryBanner } from '../common/TaskRecoveryBanner';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useTaskRecovery } from '../../hooks/useTaskRecovery';
import { useNavigationGuard } from '../../hooks/useNavigationGuard';
import { useSessionStore } from '../../stores/sessionStore';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { isRecovering, recoveredTaskId } = useTaskRecovery();
  const [showBanner, setShowBanner] = useState(true);
  const { activeSessionId, activeSession, loadSessions, selectSession } =
    useSessionStore();

  const {
    showConfirmDialog,
    confirmNavigation,
    cancelNavigation,
  } = useNavigationGuard();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (activeSessionId && !activeSession) {
      selectSession(activeSessionId);
    }
  }, [activeSessionId, activeSession, selectSession]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Task Recovery Banner */}
      {showBanner && (
        <TaskRecoveryBanner
          isRecovering={isRecovering}
          recoveredTaskId={recoveredTaskId}
          onDismiss={() => setShowBanner(false)}
        />
      )}

      {/* Navigation Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="작업이 아직 실행 중입니다"
        message="현재 작업이 실행 중입니다. 페이지를 이동해도 작업은 백그라운드에서 계속되지만 진행 상황을 놓칠 수 있습니다. 이동할까요?"
        confirmLabel="이동"
        cancelLabel="머무르기"
        variant="warning"
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
      />

      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
