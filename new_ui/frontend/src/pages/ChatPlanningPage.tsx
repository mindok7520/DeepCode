import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components/common';
import { ChatInput } from '../components/input';
import { ProgressTracker, ActivityLogViewer } from '../components/streaming';
import { FileTree } from '../components/results';
import { InlineChatInteraction } from '../components/interaction';
import { useWorkflowStore } from '../stores/workflowStore';
import { useSessionStore } from '../stores/sessionStore';
import { useStreaming } from '../hooks/useStreaming';
import { workflowsApi } from '../services/api';
import { toast } from '../components/common/Toaster';
import { CHAT_PLANNING_STEPS } from '../types/workflow';
import { AlertTriangle, MessageSquare, User, Bot, CheckCircle, XCircle, FolderOpen, StopCircle } from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export default function ChatPlanningPage() {
  const [enableIndexing, setEnableIndexing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [localMessages, setLocalMessages] = useState<Array<{
    id: string;
    role: 'user' | 'assistant' | 'system' | string;
    content: string;
  }>>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const {
    activeTaskId,
    status,
    progress,
    message,
    steps,
    generatedFiles,
    activityLogs,
    pendingInteraction,
    isWaitingForInput,
    result,
    error,
    setActiveTask,
    setSteps,
    setStatus,
    reset,
  } = useWorkflowStore();

  const {
    activeSessionId,
    activeSession,
    setActiveSessionId,
    selectSession,
    refreshActiveSession,
  } = useSessionStore();
  useStreaming(activeTaskId);

  // Debug: log status changes
  console.log('[ChatPlanningPage] status:', status, 'result:', result, 'error:', error);

  // Auto-scroll to bottom when new messages or interactions appear
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [activeSession?.messages.length, localMessages.length, pendingInteraction]);

  useEffect(() => {
    setLocalMessages([]);
  }, [activeSessionId]);

  // Show toast and add message when workflow completes
  useEffect(() => {
    if ((status === 'completed' || status === 'incomplete' || status === 'completed_with_warnings') && result) {
      toast.success('코드 생성이 완료되었습니다', '프로젝트 파일이 성공적으로 생성되었습니다.');
      refreshActiveSession();
      setLocalMessages([]);
    } else if (status === 'error' && error) {
      toast.error('생성 실패', error);
      refreshActiveSession();
    } else if (status === 'interrupted') {
      toast.warning('작업이 중단되었습니다', '작업 완료 전에 백엔드가 재시작되었습니다.');
      refreshActiveSession();
    }
  }, [status, error, result, refreshActiveSession]);

  // Handle task cancellation
  const handleCancelTask = async () => {
    if (!activeTaskId) return;

    setIsCancelling(true);
    try {
      await workflowsApi.cancel(activeTaskId);
      setStatus('idle');
      reset();
      setLocalMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '작업을 취소했습니다. 새 요청을 입력해 주세요.',
        },
      ]);
      toast.info('작업을 취소했습니다', '워크플로우를 중지했습니다.');
    } catch (err) {
      toast.error('취소 실패', '작업을 취소하지 못했습니다.');
      console.error('Cancel error:', err);
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const handleSubmit = async (message: string) => {
    try {
      setLocalMessages((messages) => [
        ...messages,
        { id: crypto.randomUUID(), role: 'user', content: message },
      ]);

      reset();
      setSteps(CHAT_PLANNING_STEPS);

      const response = await workflowsApi.startChatPlanning(
        message,
        enableIndexing,
        true,
        activeSessionId
      );

      setActiveTask(response.task_id, 'chat-planning');
      if (response.session_id) {
        setActiveSessionId(response.session_id);
        selectSession(response.session_id);
      }
      setLocalMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '코드 생성을 시작합니다...',
        },
      ]);

      toast.info('워크플로우를 시작했습니다', '요구사항을 바탕으로 코드를 생성합니다...');
    } catch (error) {
      toast.error('워크플로우 시작 실패', '잠시 후 다시 시도해 주세요');
      setLocalMessages((messages) => [
        ...messages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '요청을 처리하는 중 오류가 발생했습니다.',
        },
      ]);
      console.error('Start error:', error);
    }
  };

  const isRunning = status === 'running';
  const sessionMessages = (activeSession?.messages ?? []).map((msg, index) => ({
    id: `${msg.timestamp}-${index}`,
    role: msg.role,
    content: msg.content,
  }));
  const chatMessages = [...sessionMessages, ...localMessages];
  const implementationResult =
    result?.implementation && typeof result.implementation === 'object'
      ? (result.implementation as Record<string, unknown>)
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-gray-900">채팅으로 기획하기</h1>
        <p className="text-gray-500 mt-1">
          만들고 싶은 프로젝트를 한국어로 설명하면 AI가 구조를 잡고 코드를 생성합니다
        </p>
        <div className="mt-3 inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
          세션:{' '}
          <span className="ml-1 font-medium text-gray-700">
            {activeSession?.title || activeSessionId || '새 세션이 생성됩니다'}
          </span>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Chat */}
        <div className="space-y-6">
          <Card padding="none" className="flex flex-col h-[600px]">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <MessageSquare className="h-5 w-5 text-primary-500" />
                <span className="font-medium text-gray-900">
                  프로젝트 요구사항
                </span>
              </div>
            </div>

            {/* Chat Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && !pendingInteraction ? (
                <div className="h-full flex items-center justify-center text-center text-gray-400">
                  <div>
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">
                      시작하려면 만들고 싶은 기능과 조건을 입력해 주세요
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start space-x-3 ${
                        msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          msg.role === 'user'
                            ? 'bg-primary-100'
                            : 'bg-gray-100'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <User className="h-4 w-4 text-primary-600" />
                        ) : (
                          <Bot className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          msg.role === 'user'
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  ))}

                  {/* Inline Interaction - displayed in chat flow */}
                  <AnimatePresence>
                    {pendingInteraction && activeTaskId && (
                      <InlineChatInteraction
                        taskId={activeTaskId}
                        interaction={pendingInteraction}
                      />
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-100">
              <ChatInput
                onSubmit={handleSubmit}
                isLoading={isRunning}
                placeholder="예: Next.js로 사내 문서 검색 챗봇을 만들고 싶어요..."
              />
            </div>
          </Card>

          {/* Options */}
          <Card>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableIndexing}
                onChange={(e) => setEnableIndexing(e.target.checked)}
                disabled={isRunning}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500 disabled:opacity-50"
              />
              <span className={`text-sm ${isRunning ? 'text-gray-400' : 'text-gray-700'}`}>
                더 나은 결과를 위해 코드 색인 사용
              </span>
            </label>

            {/* Cancel Button */}
            {isRunning && (
              <button
                onClick={() => setShowCancelDialog(true)}
                disabled={isCancelling}
                className="mt-4 w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              >
                <StopCircle className="h-4 w-4" />
                <span>작업 취소</span>
              </button>
            )}
          </Card>
        </div>

        {/* Right Column - Results */}
        <div className="space-y-6">
          {/* Progress */}
          {status !== 'idle' && (
            <Card>
              <ProgressTracker
                steps={steps}
                currentProgress={progress}
                currentMessage={message}
              />
            </Card>
          )}

          {/* Activity Log */}
          <ActivityLogViewer
            logs={activityLogs}
            isRunning={isRunning && !isWaitingForInput}
            currentMessage={isWaitingForInput ? '사용자 입력을 기다리는 중...' : message}
          />

          {/* Generated Files */}
          {generatedFiles.length > 0 && (
            <FileTree files={generatedFiles} />
          )}

          {/* Completion Status */}
          {status === 'completed' && result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-green-200 bg-green-50">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-green-900">
                      코드 생성 완료
                    </h3>
                    <p className="text-sm text-green-700 mt-1">
                      요청한 프로젝트 코드가 생성되었습니다.
                    </p>
                    {result.repo_result && typeof result.repo_result === 'object' && 'code_directory' in (result.repo_result as Record<string, unknown>) ? (
                      <div className="mt-3 flex items-center text-sm text-green-600">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        <span className="font-mono text-xs">
                          {String((result.repo_result as Record<string, unknown>).code_directory)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {(status === 'incomplete' ||
            status === 'completed_with_warnings' ||
            status === 'interrupted') && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-yellow-200 bg-yellow-50">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-900">
                      {status === 'interrupted'
                        ? '작업이 중단되었습니다'
                        : '코드 생성이 일부 완료되었습니다'}
                    </h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      {status === 'interrupted'
                        ? '작업 완료 전에 백엔드가 재시작되었습니다. 이 세션을 선택하고 다시 요청하면 저장된 파일에서 이어갈 수 있습니다.'
                        : '일부 파일이 아직 미완성일 수 있습니다. 아래 구현 메타데이터를 확인해 주세요.'}
                    </p>
                    {implementationResult && (
                        <div className="mt-3 text-xs text-yellow-800 space-y-1">
                          <div>
                            파일:{' '}
                            {String(implementationResult.files_completed ?? 0)}
                            /
                            {String(implementationResult.total_files ?? 0)}
                          </div>
                          <div>
                            사유:{' '}
                            {String(implementationResult.abort_reason ?? '로그 확인')}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Error Status */}
          {status === 'error' && error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="border-red-200 bg-red-50">
                <div className="flex items-start space-x-3">
                  <XCircle className="h-6 w-6 text-red-500 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-red-900">
                      생성 실패
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showCancelDialog}
        title="작업을 취소할까요?"
        message="현재 작업을 취소하면 진행 중인 내용이 중단됩니다. 계속하려면 새로 시작해야 합니다."
        confirmLabel="취소하기"
        cancelLabel="계속 실행"
        variant="danger"
        onConfirm={handleCancelTask}
        onCancel={() => setShowCancelDialog(false)}
      />
    </div>
  );
}
