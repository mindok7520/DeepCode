import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  MessageSquare,
  GitBranch,
  ArrowRight,
  Rocket,
  Palette,
  Server,
  Users,
} from 'lucide-react';
import { Card } from '../components/common';

const features = [
  {
    icon: Rocket,
    title: 'Paper2Code',
    description:
      '연구 논문의 복잡한 알고리즘을 바로 실행 가능한 고품질 코드로 자동 구현합니다.',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  {
    icon: Palette,
    title: 'Text2Web',
    description:
      '간단한 설명을 동작하는 프론트엔드 웹 코드와 화면으로 변환합니다.',
    color: 'text-teal-500',
    bgColor: 'bg-teal-50',
  },
  {
    icon: Server,
    title: 'Text2Backend',
    description:
      '텍스트 요구사항만으로 확장 가능한 백엔드 코드를 생성합니다.',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Users,
    title: 'User-in-Loop',
    description:
      '실시간 피드백과 인라인 채팅으로 AI 에이전트와 함께 결과를 조정합니다.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
];

const actions = [
  {
    path: '/paper-to-code',
    icon: FileText,
    title: '논문으로 코드 만들기',
    description: '연구 논문을 실행 가능한 구현으로 변환합니다',
    color: 'from-blue-500 to-indigo-600',
  },
  {
    path: '/chat',
    icon: MessageSquare,
    title: '채팅으로 기획하기',
    description: '만들고 싶은 프로젝트를 설명하면 AI가 코드를 생성합니다',
    color: 'from-purple-500 to-pink-600',
  },
  {
    path: '/workflow',
    icon: GitBranch,
    title: '워크플로우 편집기',
    description: '복잡한 프로젝트의 처리 흐름을 시각적으로 확인합니다',
    color: 'from-green-500 to-teal-600',
  },
];

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          한국어로 쓰는{' '}
          <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
            DeepCode
          </span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          논문과 자연어 요구사항을 실제 프로젝트 코드로 바꾸는 AI 개발 자동화 도구입니다.
          Codex 웹 로그인으로 시작하고, 전체 작업 흐름을 한 화면에서 관리합니다.
        </p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.path}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Link to={action.path}>
                <Card className="group hover:shadow-md transition-shadow h-full">
                  <div
                    className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${action.color} mb-4`}
                  >
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-gray-500 text-sm mb-4">
                    {action.description}
                  </p>
                  <span className="inline-flex items-center text-sm font-medium text-primary-600">
                    시작하기
                    <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Features */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          주요 기능
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
              >
                <Card className="h-full">
                  <div
                    className={`inline-flex p-2.5 rounded-lg ${feature.bgColor} mb-3`}
                  >
                    <Icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
