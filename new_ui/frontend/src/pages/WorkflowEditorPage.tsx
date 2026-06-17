import { motion } from 'framer-motion';
import { Card } from '../components/common';
import { WorkflowCanvas } from '../components/workflow';
import { PAPER_TO_CODE_STEPS, CHAT_PLANNING_STEPS } from '../types/workflow';
import { useState } from 'react';

export default function WorkflowEditorPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<'paper' | 'chat'>('paper');
  const [currentStep, setCurrentStep] = useState(2); // 데모: 2번 단계 활성화

  const steps = selectedWorkflow === 'paper' ? PAPER_TO_CODE_STEPS : CHAT_PLANNING_STEPS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-gray-900">워크플로우 편집기</h1>
        <p className="text-gray-500 mt-1">
          코드 생성 워크플로우의 단계와 진행 흐름을 시각적으로 확인합니다
        </p>
      </motion.div>

      {/* Workflow Selection */}
      <Card>
        <div className="flex items-center space-x-4 mb-6">
          <span className="text-sm font-medium text-gray-700">워크플로우:</span>
          <div className="flex space-x-2">
            <button
              onClick={() => setSelectedWorkflow('paper')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedWorkflow === 'paper'
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              논문 구현
            </button>
            <button
              onClick={() => setSelectedWorkflow('chat')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                selectedWorkflow === 'chat'
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              채팅 기획
            </button>
          </div>
        </div>

        {/* Step Selector for Demo */}
        <div className="flex items-center space-x-4 mb-6">
          <span className="text-sm font-medium text-gray-700">현재 단계:</span>
          <input
            type="range"
            min="0"
            max={steps.length - 1}
            value={currentStep}
            onChange={(e) => setCurrentStep(parseInt(e.target.value))}
            className="w-48"
          />
          <span className="text-sm text-gray-500">
            {steps[currentStep]?.title || '없음'}
          </span>
        </div>

        <WorkflowCanvas
          steps={steps}
          currentStepIndex={currentStep}
          onStepClick={(stepId) => {
            const index = steps.findIndex((s) => s.id === stepId);
            if (index !== -1) setCurrentStep(index);
          }}
        />
      </Card>

      {/* Info */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">화면 안내</h3>
        <p className="text-sm text-gray-600">
          이 화면은 DeepCode가 입력을 처리하고 코드를 생성하는 파이프라인을 보여줍니다.
          각 노드는 처리 단계를 의미하며, 연결선은 단계 사이의 데이터 흐름을 나타냅니다.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          <li className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-gray-300"></span>
            <span>대기 중인 단계</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-primary-500"></span>
            <span>실행 중인 단계</span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            <span>완료된 단계</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
