import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button } from '../components/common';
import { FileUploader, UrlInput } from '../components/input';
import { ProgressTracker, ActivityLogViewer } from '../components/streaming';
import { FileTree } from '../components/results';
import { InteractionPanel } from '../components/interaction';
import { useWorkflowStore } from '../stores/workflowStore';
import { useSessionStore } from '../stores/sessionStore';
import { useStreaming } from '../hooks/useStreaming';
import { workflowsApi } from '../services/api';
import { toast } from '../components/common/Toaster';
import { PAPER_TO_CODE_STEPS } from '../types/workflow';
import { AlertTriangle, CheckCircle, XCircle, FolderOpen, StopCircle } from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

type InputMethod = 'file' | 'url';

export default function PaperToCodePage() {
  const [inputMethod, setInputMethod] = useState<InputMethod>('file');
  const [uploadedFilePath, setUploadedFilePath] = useState<string | null>(null);
  const [enableIndexing, setEnableIndexing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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

  // Show toast when workflow completes
  useEffect(() => {
    if ((status === 'completed' || status === 'incomplete' || status === 'completed_with_warnings') && result) {
      toast.success('논문 처리가 완료되었습니다', '코드가 성공적으로 생성되었습니다.');
      refreshActiveSession();
    } else if (status === 'error' && error) {
      toast.error('처리 실패', error);
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
      toast.info('작업을 취소했습니다', '워크플로우를 중지했습니다.');
    } catch (err) {
      toast.error('취소 실패', '작업을 취소하지 못했습니다.');
      console.error('Cancel error:', err);
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const handleStart = async (inputSource: string, inputType: 'file' | 'url') => {
    try {
      reset();
      setSteps(PAPER_TO_CODE_STEPS);

      const response = await workflowsApi.startPaperToCode(
        inputSource,
        inputType,
        enableIndexing,
        true,
        activeSessionId
      );

      setActiveTask(response.task_id, 'paper-to-code');
      if (response.session_id) {
        setActiveSessionId(response.session_id);
        selectSession(response.session_id);
      }
      toast.info('워크플로우를 시작했습니다', '논문을 분석하고 코드를 생성합니다...');
    } catch (error) {
      toast.error('워크플로우 시작 실패', '잠시 후 다시 시도해 주세요');
      console.error('Start error:', error);
    }
  };

  const handleFileUploaded = (_fileId: string, path: string) => {
    setUploadedFilePath(path);
  };

  const handleUrlSubmit = (url: string) => {
    handleStart(url, 'url');
  };

  const handleStartWithFile = () => {
    if (uploadedFilePath) {
      handleStart(uploadedFilePath, 'file');
    }
  };

  const isRunning = status === 'running';
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
        <h1 className="text-2xl font-bold text-gray-900">논문으로 코드 만들기</h1>
        <p className="text-gray-500 mt-1">
          연구 논문을 업로드하거나 링크로 입력해 실행 가능한 구현 코드로 변환합니다
        </p>
        <div className="mt-3 inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500">
          세션:{' '}
          <span className="ml-1 font-medium text-gray-700">
            {activeSession?.title || activeSessionId || '새 세션이 생성됩니다'}
          </span>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Input */}
        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">입력 소스</h3>

            {/* Input Method Tabs */}
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setInputMethod('file')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMethod === 'file'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                PDF 업로드
              </button>
              <button
                onClick={() => setInputMethod('url')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  inputMethod === 'url'
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                URL 링크
              </button>
            </div>

            {/* Input Components */}
            {inputMethod === 'file' ? (
              <div className="space-y-4">
                <FileUploader onFileUploaded={handleFileUploaded} disabled={isRunning} />
                {uploadedFilePath && !isRunning && (
                  <Button
                    onClick={handleStartWithFile}
                    isLoading={isRunning}
                    className="w-full"
                  >
                    처리 시작
                  </Button>
                )}
              </div>
            ) : (
              <UrlInput onSubmit={handleUrlSubmit} isLoading={isRunning} disabled={isRunning} />
            )}

            {/* Cancel Button */}
            {isRunning && (
              <div className="mt-4">
                <button
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <StopCircle className="h-4 w-4" />
                  <span>작업 취소</span>
                </button>
              </div>
            )}

            {/* Options */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableIndexing}
                  onChange={(e) => setEnableIndexing(e.target.checked)}
                  className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">
                  코드 색인 사용
                </span>
              </label>
              <p className="text-xs text-gray-400 mt-1 ml-7">
                시간이 더 걸리지만 코드 품질과 참조 정확도를 높입니다
              </p>
            </div>
          </Card>
        </div>

        {/* Right Column - Progress & Results */}
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

          {/* User-in-Loop Interaction Panel */}
          <AnimatePresence>
            {pendingInteraction && activeTaskId && (
              <InteractionPanel
                taskId={activeTaskId}
                interaction={pendingInteraction}
              />
            )}
          </AnimatePresence>

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
                      논문을 바탕으로 코드가 성공적으로 생성되었습니다.
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
                        ? '작업 완료 전에 백엔드가 재시작되었습니다. 이 세션을 선택하고 다시 시작하면 저장된 파일에서 이어갈 수 있습니다.'
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
                      처리 실패
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
