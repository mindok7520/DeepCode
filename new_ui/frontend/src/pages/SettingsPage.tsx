import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button } from '../components/common';
import { toast } from '../components/common/Toaster';
import { configApi } from '../services/api';
import { Settings, Server, Cpu, Check, LogIn, LogOut, RefreshCw } from 'lucide-react';
import type { CodexModelOption, OpenRouterModelInfo } from '../types/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [selectedModels, setSelectedModels] = useState({
    default: '',
    planning: '',
    implementation: '',
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: configApi.getSettings,
  });

  const { data: providers } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: configApi.getLLMProviders,
  });

  const { data: openRouterModels, isLoading: isLoadingOpenRouterModels } = useQuery({
    queryKey: ['openrouter-models'],
    queryFn: () => configApi.getOpenRouterModels(),
    enabled: selectedProvider === 'openrouter',
  });

  const { data: codexStatus, isLoading: isLoadingCodexStatus } = useQuery({
    queryKey: ['codex-auth-status'],
    queryFn: configApi.getCodexAuthStatus,
  });

  const { data: codexModels, isLoading: isLoadingCodexModels } = useQuery({
    queryKey: ['codex-models'],
    queryFn: configApi.getCodexModels,
    enabled: selectedProvider === 'codex' && codexStatus?.authenticated === true,
  });

  const updateProviderMutation = useMutation({
    mutationFn: configApi.setLLMProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      toast.success('설정이 저장되었습니다', 'LLM 제공자가 변경되었습니다');
    },
    onError: () => {
      toast.error('저장 실패', '잠시 후 다시 시도해 주세요');
    },
  });

  const updateModelsMutation = useMutation({
    mutationFn: configApi.setLLMModels,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['llm-providers'] });
      toast.success('설정이 저장되었습니다', '새 워크플로우부터 선택한 모델을 사용합니다');
    },
    onError: () => {
      toast.error('모델 저장 실패', '선택한 모델 ID를 확인해 주세요');
    },
  });

  const codexLoginMutation = useMutation({
    mutationFn: async (popup: Window | null) => {
      const login = await configApi.startCodexLogin();
      return { login, popup };
    },
    onSuccess: ({ login, popup }) => {
      if (popup && !popup.closed) {
        popup.location.href = login.auth_url;
      } else {
        window.open(login.auth_url, '_blank', 'noopener,noreferrer');
      }
      toast.info('브라우저 로그인을 시작했습니다', '열린 창에서 ChatGPT 계정 로그인을 완료해 주세요');
      window.setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['codex-auth-status'] });
        queryClient.invalidateQueries({ queryKey: ['codex-models'] });
      }, 4000);
    },
    onError: (_error, popup) => {
      if (popup && !popup.closed) {
        popup.close();
      }
      toast.error('로그인 시작 실패', 'Codex 로그인 callback 포트를 열 수 없습니다');
    },
  });

  const handleCodexLogin = () => {
    const popup = window.open('about:blank', '_blank');
    if (popup) {
      popup.opener = null;
      popup.document.title = 'Codex Login';
      popup.document.body.innerHTML =
        '<main style="font-family: system-ui, sans-serif; margin: 3rem; line-height: 1.6;"><h1>Codex Login</h1><p>Preparing the ChatGPT login page...</p></main>';
    }
    codexLoginMutation.mutate(popup);
  };

  const codexLogoutMutation = useMutation({
    mutationFn: configApi.logoutCodex,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codex-auth-status'] });
      queryClient.invalidateQueries({ queryKey: ['codex-models'] });
      toast.success('연결을 해제했습니다', 'Codex/ChatGPT 로그인 정보가 제거되었습니다');
    },
    onError: () => {
      toast.error('연결 해제 실패', '잠시 후 다시 시도해 주세요');
    },
  });

  useEffect(() => {
    if (settings?.llm_provider) {
      setSelectedProvider(settings.llm_provider);
    }
    if (settings?.models) {
      setSelectedModels({
        default: settings.models.default || settings.models.planning || '',
        planning: settings.models.planning || settings.models.default || '',
        implementation:
          settings.models.implementation || settings.models.default || '',
      });
    }
  }, [settings]);

  const codexFallbackModel = 'codex/gpt-5.5';

  const ensureCodexModels = () => ({
    default: selectedModels.default.startsWith('codex/')
      ? selectedModels.default
      : codexFallbackModel,
    planning: selectedModels.planning.startsWith('codex/')
      ? selectedModels.planning
      : codexFallbackModel,
    implementation: selectedModels.implementation.startsWith('codex/')
      ? selectedModels.implementation
      : codexFallbackModel,
  });

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
    if (provider === 'codex') {
      const next = ensureCodexModels();
      setSelectedModels((current) => ({
        default: current.default.startsWith('codex/') ? current.default : next.default,
        planning: current.planning.startsWith('codex/') ? current.planning : next.planning,
        implementation: current.implementation.startsWith('codex/')
          ? current.implementation
          : next.implementation,
      }));
    }
  };

  const handleSaveProvider = () => {
    if (selectedProvider === 'openrouter' || selectedProvider === 'codex') {
      const models =
        selectedProvider === 'codex' ? ensureCodexModels() : selectedModels;
      updateModelsMutation.mutate({
        provider: selectedProvider,
        default_model: models.default,
        planning_model: models.planning,
        implementation_model: models.implementation,
      });
      return;
    }
    if (selectedProvider && selectedProvider !== settings?.llm_provider) {
      updateProviderMutation.mutate(selectedProvider);
    }
  };

  const providerInfo: Record<string, { name: string; description: string }> = {
    codex: {
      name: 'Codex / ChatGPT 웹 로그인',
      description: 'API key 없이 Codex CLI와 같은 브라우저 로그인 세션을 사용합니다',
    },
    gemini: {
      name: 'Google Gemini',
      description: 'Gemini 모델을 사용해 코드를 생성합니다',
    },
    anthropic: {
      name: 'Anthropic Claude',
      description: 'Claude 모델로 긴 문서와 고품질 생성을 처리합니다',
    },
    openai: {
      name: 'OpenAI API key',
      description: 'OpenAI 개발자 API key로 GPT 모델을 사용합니다',
    },
    openrouter: {
      name: 'OpenRouter',
      description: 'OpenRouter를 통해 z-ai/glm-5.1 같은 모델을 사용합니다',
    },
  };

  const modelOptions = openRouterModels?.models || [];
  const normalizedSearch = modelSearch.trim().toLowerCase();
  const filteredModels = modelOptions
    .filter((model) => {
      if (!normalizedSearch) return true;
      return (
        model.id.toLowerCase().includes(normalizedSearch) ||
        model.name.toLowerCase().includes(normalizedSearch)
      );
    })
    .slice(0, 200);
  const selectedProviderChanged = selectedProvider !== settings?.llm_provider;
  const selectedModelsChanged =
    selectedModels.default !== (settings?.models?.default || '') ||
    selectedModels.planning !== (settings?.models?.planning || '') ||
    selectedModels.implementation !== (settings?.models?.implementation || '');
  const shouldShowSave =
    selectedProvider === 'openrouter' || selectedProvider === 'codex'
      ? selectedProviderChanged || selectedModelsChanged
      : selectedProviderChanged;

  const formatContext = (model?: OpenRouterModelInfo) => {
    if (!model?.context_length) return '컨텍스트 정보 없음';
    if (model.context_length >= 1000000) {
      return `${Math.round(model.context_length / 1000000)}M ctx`;
    }
    return `${Math.round(model.context_length / 1000)}K ctx`;
  };

  const formatPrice = (model?: OpenRouterModelInfo) => {
    const prompt = model?.pricing?.prompt;
    const completion = model?.pricing?.completion;
    if (typeof prompt !== 'string' || typeof completion !== 'string') {
      return '가격 정보 없음';
    }
    return `입력 ${prompt} / 출력 ${completion}`;
  };

  const findModel = (id: string) => modelOptions.find((model) => model.id === id);
  const codexModelOptions = codexModels?.models || [];
  const toCodexConfigModel = (slug: string) =>
    slug.startsWith('codex/') ? slug : `codex/${slug}`;
  const findCodexModel = (id: string) =>
    codexModelOptions.find((model) => toCodexConfigModel(model.slug) === id);

  const renderModelSelect = (
    label: string,
    phase: 'default' | 'planning' | 'implementation'
  ) => {
    const selected = findModel(selectedModels[phase]);
    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
        <select
          value={selectedModels[phase]}
          onChange={(event) =>
            setSelectedModels((current) => ({
              ...current,
              [phase]: event.target.value,
            }))
          }
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          {selectedModels[phase] && !filteredModels.some((m) => m.id === selectedModels[phase]) && (
            <option value={selectedModels[phase]}>{selectedModels[phase]}</option>
          )}
          {filteredModels.map((model) => (
            <option key={`${phase}-${model.id}`} value={model.id}>
              {model.name} · {model.id}
            </option>
          ))}
        </select>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
          <span>{formatContext(selected)}</span>
          <span>·</span>
          <span>
            {selected?.supported_parameters.includes('tools')
              ? '도구 호출 지원'
              : '도구 지원 정보 없음'}
          </span>
          <span>·</span>
          <span>{formatPrice(selected)}</span>
        </div>
      </div>
    );
  };

  const renderCodexModelSelect = (
    label: string,
    phase: 'default' | 'planning' | 'implementation'
  ) => {
    const selected = findCodexModel(selectedModels[phase]);
    const fallbackOptions: CodexModelOption[] =
      codexModelOptions.length > 0
        ? codexModelOptions
        : [
            {
              slug: 'gpt-5.5',
              display_name: 'GPT-5.5',
              description: 'Codex 기본 모델',
              default_reasoning_effort: 'xhigh',
              supported_reasoning_levels: [],
            },
            {
              slug: 'gpt-5.4',
              display_name: 'GPT-5.4',
              description: 'Codex 호환 모델',
              default_reasoning_effort: 'high',
              supported_reasoning_levels: [],
            },
            {
              slug: 'gpt-5.4-mini',
              display_name: 'GPT-5.4 Mini',
              description: '빠른 Codex 호환 모델',
              default_reasoning_effort: 'medium',
              supported_reasoning_levels: [],
            },
          ];

    return (
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
        </label>
        <select
          value={
            selectedModels[phase].startsWith('codex/')
              ? selectedModels[phase]
              : codexFallbackModel
          }
          onChange={(event) =>
            setSelectedModels((current) => ({
              ...current,
              [phase]: event.target.value,
            }))
          }
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        >
          {fallbackOptions.map((model) => (
            <option key={`${phase}-${model.slug}`} value={toCodexConfigModel(model.slug)}>
              {model.display_name} · {toCodexConfigModel(model.slug)}
            </option>
          ))}
        </select>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
          <span>{selected?.description || 'Codex/ChatGPT 계정으로 호출됩니다'}</span>
          {selected?.default_reasoning_effort && (
            <>
              <span>·</span>
              <span>기본 reasoning: {selected.default_reasoning_effort}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">
          DeepCode 실행 방식과 모델을 한국어 환경에 맞게 설정합니다
        </p>
      </motion.div>

      {/* LLM Provider */}
      <Card>
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2 bg-primary-50 rounded-lg">
            <Cpu className="h-5 w-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">LLM 제공자</h3>
            <p className="text-sm text-gray-500">
              코드 생성에 사용할 계정 또는 모델 제공자를 선택합니다
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {providers?.available_providers.map((provider) => {
            const info = providerInfo[provider];
            const isSelected = selectedProvider === provider;

            return (
              <button
                key={provider}
                onClick={() => handleProviderSelect(provider)}
                className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
                  isSelected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Server
                    className={`h-5 w-5 ${
                      isSelected ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  />
                  <div className="text-left">
                    <div
                      className={`font-medium ${
                        isSelected ? 'text-primary-900' : 'text-gray-900'
                      }`}
                    >
                      {info?.name || provider}
                    </div>
                    <div
                      className={`text-sm ${
                        isSelected ? 'text-primary-600' : 'text-gray-500'
                      }`}
                    >
                      {info?.description || ''}
                    </div>
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5 text-primary-600" />
                )}
              </button>
            );
          })}
        </div>

        {selectedProvider === 'openrouter' && (
          <div className="mt-6 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                OpenRouter 모델
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                각 워크플로우 단계에서 사용할 모델 ID를 선택합니다. 예: z-ai/glm-5.1
              </p>
            </div>

            <input
              value={modelSearch}
              onChange={(event) => setModelSearch(event.target.value)}
              placeholder="모델 ID 또는 이름 검색, 예: glm"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />

            {isLoadingOpenRouterModels ? (
              <div className="text-sm text-gray-500">OpenRouter 모델을 불러오는 중...</div>
            ) : (
              <div className="space-y-4">
                {renderModelSelect('기본 모델', 'default')}
                {renderModelSelect('계획 수립 모델', 'planning')}
                {renderModelSelect('코드 구현 모델', 'implementation')}
              </div>
            )}

            {openRouterModels && (
              <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                모델 목록 출처: {openRouterModels.source}
                {openRouterModels.stale ? ' (오래된 캐시)' : ''} · {modelOptions.length}개 중{' '}
                {filteredModels.length}개 표시
              </div>
            )}
          </div>
        )}

        {selectedProvider === 'codex' && (
          <div className="mt-6 space-y-4 border-t border-gray-100 pt-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">
                Codex / ChatGPT 계정 연결
              </h4>
              <p className="mt-1 text-sm text-gray-500">
                API key를 입력하지 않고 브라우저에서 ChatGPT 계정으로 로그인합니다.
                로그인 정보는 서버의 Codex 홈 디렉터리에 저장됩니다.
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {isLoadingCodexStatus
                      ? '로그인 상태 확인 중'
                      : codexStatus?.authenticated
                        ? '연결됨'
                        : '연결 필요'}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {codexStatus?.authenticated
                      ? codexStatus.email || codexStatus.account_id || 'ChatGPT 계정'
                      : codexStatus?.error || `저장 위치: ${codexStatus?.codex_home || '~/.codex'}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      queryClient.invalidateQueries({ queryKey: ['codex-auth-status'] });
                      queryClient.invalidateQueries({ queryKey: ['codex-models'] });
                    }}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    새로고침
                  </Button>
                  {codexStatus?.authenticated ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => codexLogoutMutation.mutate()}
                      isLoading={codexLogoutMutation.isPending}
                    >
                      <LogOut className="mr-1 h-4 w-4" />
                      연결 해제
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleCodexLogin}
                      isLoading={codexLoginMutation.isPending}
                    >
                      <LogIn className="mr-1 h-4 w-4" />
                      웹 로그인
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {codexStatus?.authenticated ? (
              isLoadingCodexModels ? (
                <div className="text-sm text-gray-500">Codex 모델을 불러오는 중...</div>
              ) : (
                <div className="space-y-4">
                  {renderCodexModelSelect('기본 모델', 'default')}
                  {renderCodexModelSelect('계획 수립 모델', 'planning')}
                  {renderCodexModelSelect('코드 구현 모델', 'implementation')}
                </div>
              )
            ) : (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                먼저 웹 로그인을 완료해야 Codex 모델을 사용할 수 있습니다.
              </div>
            )}
          </div>
        )}

        {shouldShowSave && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <Button
              onClick={handleSaveProvider}
              isLoading={
                updateProviderMutation.isPending || updateModelsMutation.isPending
              }
            >
              변경 사항 저장
            </Button>
          </div>
        )}
      </Card>

      {/* Current Models */}
      <Card>
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="h-5 w-5 text-gray-600" />
          </div>
          <h3 className="font-semibold text-gray-900">현재 설정</h3>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">활성 제공자</span>
            <span className="text-sm font-medium text-gray-900">
              {providerInfo[settings?.llm_provider || '']?.name || settings?.llm_provider}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">계획 수립 모델</span>
            <span className="text-sm font-mono text-gray-900">
              {settings?.models?.planning || '없음'}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">코드 구현 모델</span>
            <span className="text-sm font-mono text-gray-900">
              {settings?.models?.implementation || '없음'}
            </span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-sm text-gray-500">코드 색인</span>
            <span className="text-sm text-gray-900">
              {settings?.indexing_enabled ? '사용' : '사용 안 함'}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
