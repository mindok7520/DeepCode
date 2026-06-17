// Workflow types

export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'waiting_for_input'
  | 'completed'
  | 'completed_with_warnings'
  | 'incomplete'
  | 'interrupted'
  | 'error'
  | 'cancelled';

export interface WorkflowStep {
  id: string;
  title: string;
  subtitle: string;
  progress: number;
  status: 'pending' | 'active' | 'completed' | 'error';
}

export interface WorkflowTask {
  taskId: string;
  status: WorkflowStatus;
  progress: number;
  message: string;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowInput {
  type: 'paper-to-code' | 'chat-planning';
  inputSource: string;
  inputType: 'file' | 'url' | 'chat';
  enableIndexing: boolean;
}

// Workflow step definitions
export const PAPER_TO_CODE_STEPS: WorkflowStep[] = [
  { id: 'init', title: '초기화', subtitle: '워크플로우 시작', progress: 5, status: 'pending' },
  { id: 'input', title: '입력 수집', subtitle: 'PDF 복사 및 변환', progress: 25, status: 'pending' },
  { id: 'workspace', title: '작업 공간 준비', subtitle: '작업 디렉터리 구성', progress: 40, status: 'pending' },
  { id: 'preprocess', title: '문서 전처리', subtitle: '논문 내용 분할', progress: 50, status: 'pending' },
  { id: 'planning', title: '구현 계획', subtitle: '구현 계획 생성', progress: 60, status: 'pending' },
  { id: 'references', title: '참고 자료 조사', subtitle: '관련 연구 분석', progress: 70, status: 'pending' },
  { id: 'implementation', title: '코드 구현', subtitle: '코드 파일 생성', progress: 85, status: 'pending' },
];

export const CHAT_PLANNING_STEPS: WorkflowStep[] = [
  { id: 'init', title: '초기화', subtitle: '에이전트 준비', progress: 5, status: 'pending' },
  { id: 'plan', title: '요구사항 분석', subtitle: '의도 파악', progress: 30, status: 'pending' },
  { id: 'setup', title: '환경 준비', subtitle: '작업 공간 구성', progress: 50, status: 'pending' },
  { id: 'draft', title: '계획 작성', subtitle: '구현 계획 생성', progress: 70, status: 'pending' },
  { id: 'implement', title: '코드 구현', subtitle: '코드 생성', progress: 85, status: 'pending' },
];
