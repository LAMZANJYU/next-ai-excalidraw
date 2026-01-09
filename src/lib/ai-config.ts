// AI 配置类型定义
export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
}

// 默认配置
export const DEFAULT_AI_CONFIG: AIConfig = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
  temperature: 0.7,
};

// 常用的 API 提供商预设
export const API_PRESETS = [
  {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  {
    name: "Azure OpenAI",
    baseUrl: "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
    models: ["gpt-4", "gpt-35-turbo"],
  },
  {
    name: "Anthropic (兼容)",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
  },
  {
    name: "本地 Ollama",
    baseUrl: "http://localhost:11434/v1",
    models: ["llama3", "mistral", "codellama"],
  },
  {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder"],
  },
  {
    name: "Moonshot (月之暗面)",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  {
    name: "智谱 AI",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    models: ["glm-4", "glm-4-flash", "glm-3-turbo"],
  },
  {
    name: "自定义",
    baseUrl: "",
    models: [],
  },
];

// localStorage key
const STORAGE_KEY = "ai-excalidraw-config";

// 保存配置到 localStorage
export function saveAIConfig(config: AIConfig): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

// 从 localStorage 加载配置
export function loadAIConfig(): AIConfig {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_AI_CONFIG, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_AI_CONFIG;
      }
    }
  }
  return DEFAULT_AI_CONFIG;
}

// 检查配置是否有效
export function isConfigValid(config: AIConfig): boolean {
  return !!(config.apiKey && config.baseUrl && config.model);
}

