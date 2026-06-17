import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Settings,
  Menu,
  Loader2,
  Clock,
  Plus,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useState, type MouseEvent } from 'react';
import { useWorkflowStore } from '../../stores/workflowStore';
import { useSessionStore } from '../../stores/sessionStore';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSessionMenuOpen, setIsSessionMenuOpen] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(
    null
  );
  const [sessionDeleteError, setSessionDeleteError] = useState<string | null>(
    null
  );

  const { status, workflowType, progress } = useWorkflowStore();
  const {
    activeSessionId,
    activeSession,
    sessions,
    isLoading,
    createSession,
    selectSession,
    deleteSession,
  } = useSessionStore();
  const isRunning = status === 'running' || status === 'waiting_for_input';

  const navItems = [
    { path: '/', label: '홈' },
    { path: '/paper-to-code', label: '논문 구현' },
    { path: '/chat', label: '채팅 기획' },
    { path: '/workflow', label: '워크플로우' },
  ];

  const getSessionTitle = () =>
    activeSession?.title || activeSessionId || '세션 선택';

  const routeForSession = (session: Awaited<ReturnType<typeof selectSession>>) => {
    const latestTask = session?.tasks?.[session.tasks.length - 1];
    if (latestTask?.task_kind === 'chat' || latestTask?.task_kind === 'requirement') {
      navigate('/chat');
    } else if (
      latestTask?.task_kind === 'paper' ||
      latestTask?.task_kind === 'paper2code' ||
      latestTask?.task_kind === 'url'
    ) {
      navigate('/paper-to-code');
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    const session = await selectSession(sessionId);
    setIsSessionMenuOpen(false);
    routeForSession(session);
  };

  const handleNewSession = async () => {
    const session = await createSession('새 세션');
    setIsSessionMenuOpen(false);
    if (session) navigate('/chat');
  };

  const handleDeleteSession = async (
    event: MouseEvent<HTMLButtonElement>,
    sessionId: string
  ) => {
    event.stopPropagation();
    setSessionDeleteError(null);
    const confirmed = window.confirm(
      '이 세션을 삭제할까요? 세션 기록, 작업 공간, 생성 파일, 로그가 제거됩니다. 업로드한 원본 파일은 유지됩니다.'
    );
    if (!confirmed) return;

    setDeletingSessionId(sessionId);
    try {
      await deleteSession(sessionId);
    } catch (error) {
      setSessionDeleteError(
        error instanceof Error ? error.message : '세션을 삭제하지 못했습니다'
      );
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="https://github.com/Zongwei9888/Experiment_Images/raw/43c585dca3d21b8e4b6390d835cdd34dc4b4b23d/DeepCode_images/title_logo.svg"
              alt="DeepCode 로고"
              className="h-8 w-8"
            />
            <span className="text-xl font-semibold text-gray-900">
              DeepCode
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setIsSessionMenuOpen((open) => !open)}
                className="flex max-w-[12rem] items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700 sm:max-w-[16rem]"
                title="세션 선택"
              >
                <Clock className="h-4 w-4 flex-shrink-0 text-primary-500" />
                <span className="truncate">{getSessionTitle()}</span>
                <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-400" />
              </button>

              {isSessionMenuOpen && (
                <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">세션</div>
                      <div className="text-xs text-gray-400">
                        이전 작업을 이어가거나 새로 시작합니다
                      </div>
                    </div>
                    <button
                      onClick={handleNewSession}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      새로 만들기
                    </button>
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2">
                    {sessionDeleteError && (
                      <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                        {sessionDeleteError}
                      </div>
                    )}
                    {isLoading && sessions.length === 0 ? (
                      <div className="flex items-center px-3 py-4 text-sm text-gray-400">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        세션을 불러오는 중...
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-gray-400">
                        아직 세션이 없습니다. 작업을 시작하거나 세션을 만들어 주세요.
                      </div>
                    ) : (
                      sessions.slice(0, 12).map((session) => {
                        const isActive = activeSessionId === session.session_id;
                        return (
                          <div
                            key={session.session_id}
                            className={`group flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                              isActive
                                ? 'bg-primary-50 text-primary-700'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <button
                              onClick={() => handleSelectSession(session.session_id)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium">
                                    {session.title || `세션 ${session.session_id}`}
                                  </div>
                                  <div className="text-xs text-gray-400">
                                    메시지 {session.message_count}개 · 작업 {session.task_count}개
                                  </div>
                                </div>
                                <span className="mt-0.5 flex-shrink-0 font-mono text-[10px] text-gray-400">
                                  {session.session_id}
                                </span>
                              </div>
                            </button>
                            <button
                              onClick={(event) =>
                                handleDeleteSession(event, session.session_id)
                              }
                              disabled={deletingSessionId === session.session_id}
                              className="mt-0.5 rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 group-hover:text-gray-500"
                              title="세션 삭제"
                              aria-label={`세션 ${session.session_id} 삭제`}
                            >
                              {deletingSessionId === session.session_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Running Task Indicator */}
            {isRunning && (
              <button
                onClick={() => {
                  if (workflowType === 'chat-planning') {
                    navigate('/chat');
                  } else if (workflowType === 'paper-to-code') {
                    navigate('/paper-to-code');
                  }
                }}
                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">작업 실행 중</span>
                <span className="text-blue-500">{progress}%</span>
              </button>
            )}

            <Link
              to="/settings"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <Settings className="h-5 w-5" />
            </Link>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-100">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
