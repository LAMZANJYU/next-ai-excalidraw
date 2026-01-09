"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { convertSimpleElementsToExcalidraw } from "@/lib/element-generator";
import { SimpleElement } from "@/types/excalidraw";
import { AIConfig, loadAIConfig, isConfigValid } from "@/lib/ai-config";
import type { ExcalidrawWrapperRef, ExcalidrawElementLike } from "@/components/ExcalidrawWrapper";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { 
  Send, 
  Settings, 
  MessageSquarePlus,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Terminal,
  FileText,
  Zap,
  Cloud,
  GitBranch,
  Palette,
  History,
  Download,
  Image as ImageIcon,
  Link,
  Cpu,
  X,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import Image from "next/image";

// 对话消息类型
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  elementCount?: number;
}

// 动态导入组件
const ExcalidrawWrapper = dynamic(
  () => import("@/components/ExcalidrawWrapper"),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex h-full items-center justify-center gap-3 bg-background">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载画布中...</span>
      </div>
    ) 
  }
);

const SettingsPanel = dynamic(
  () => import("@/components/SettingsPanel"),
  { ssr: false }
);

// 生成唯一 ID
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// 快捷示例
const QUICK_EXAMPLES = [
  {
    icon: FileText,
    title: "文档转图表",
    isNew: true,
    desc: "上传 PDF、TXT 等文件自动生成图表",
    prompt: "请帮我绘制一个文档结构图"
  },
  {
    icon: Zap,
    title: "动画图表",
    desc: "创建带动画连接器的 Transformer 架构",
    prompt: "画一个 Transformer 架构图，包含 Encoder 和 Decoder"
  },
  {
    icon: Cloud,
    title: "AWS 架构",
    desc: "使用 AWS 风格创建云架构图",
    prompt: "画一个简单的 AWS 云架构图，包含用户、EC2、S3、数据库"
  },
  {
    icon: GitBranch,
    title: "复制流程图",
    desc: "上传并复制现有流程图",
    prompt: "画一个用户注册流程图，包含开始、填写信息、验证、完成"
  },
  {
    icon: Palette,
    title: "创意绘图",
    desc: "绘制有趣且富有创意的内容",
    prompt: "画一个有趣的创意图表"
  },
];

// 示例卡片组件
interface ExampleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  isNew?: boolean;
}

function ExampleCard({ icon, title, description, onClick, isNew }: ExampleCardProps) {
  return (
    <button
      onClick={onClick}
      className={`group w-full text-left p-4 rounded-xl border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200 hover:shadow-sm ${
        isNew ? "border-primary/40 ring-1 ring-primary/20" : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isNew ? "bg-primary/20 group-hover:bg-primary/25" : "bg-primary/10 group-hover:bg-primary/15"
        }`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              {title}
            </h3>
            {isNew && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded">
                新
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

// 工具调用卡片组件
interface ToolCallCardProps {
  isStreaming: boolean;
  content: string;
  elementCount?: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCopy: () => void;
  isCopied: boolean;
}

function ToolCallCard({ 
  isStreaming, 
  content, 
  elementCount,
  isExpanded, 
  onToggleExpand, 
  onCopy,
  isCopied
}: ToolCallCardProps) {
  return (
    <div className="my-3 rounded-xl border border-border/60 bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium text-foreground/80">
            Generate Diagram
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                完成
              </span>
              {isExpanded && (
                <button
                  type="button"
                  onClick={onCopy}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  title={isCopied ? "已复制" : "复制"}
                >
                  {isCopied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </>
          )}
          {content && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
      
      {content && isExpanded && (
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
            {content}
          </p>
          {elementCount && elementCount > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              已添加 {elementCount} 个元素到画布
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [elements, setElements] = useState<ExcalidrawElementLike[]>([]);
  const [error, setError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "good" | "bad">>({});
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const excalidrawRef = useRef<ExcalidrawWrapperRef>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载保存的配置
  useEffect(() => {
    const config = loadAIConfig();
    setAiConfig(config);
    setIsConfigured(isConfigValid(config));
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // 自动聚焦输入框
  useEffect(() => {
    if (!isLoading && textareaRef.current && isPanelVisible) {
      textareaRef.current.focus();
    }
  }, [isLoading, isPanelVisible]);

  // 自动调整 textarea 高度
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [prompt, adjustTextareaHeight]);

  const handleConfigChange = useCallback((config: AIConfig) => {
    setAiConfig(config);
    setIsConfigured(isConfigValid(config));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!isConfigured) {
      setError("请先配置 AI 模型");
      setIsSettingsOpen(true);
      return;
    }

    const currentElements = excalidrawRef.current?.getElements() || [];

    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: "user",
      content: prompt,
      timestamp: new Date(),
    };
    
    const assistantMessageId = generateMessageId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setChatHistory((prev) => [...prev, userMessage, assistantMessage]);
    setExpandedTools((prev) => ({ ...prev, [assistantMessageId]: true }));
    setPrompt("");
    setIsLoading(true);
    setError("");

    try {
      const historyMessages = chatHistory.slice(-10).map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt,
          config: aiConfig,
          messages: historyMessages,
          currentElements,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "生成失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case "text":
                case "thinking":
                  fullContent += data.content;
                  setChatHistory((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: fullContent }
                        : msg
                    )
                  );
                  break;
                  
                case "elements":
                  if (data.elements && Array.isArray(data.elements)) {
                    const excalidrawElements = convertSimpleElementsToExcalidraw(
                      data.elements as SimpleElement[]
                    );
                    setElements((prev) => [...prev, ...excalidrawElements]);
                    
                    let explanation = data.explanation || "";
                    if (!explanation && fullContent) {
                      explanation = fullContent;
                    }
                    
                    setChatHistory((prev) =>
                      prev.map((msg) =>
                        msg.id === assistantMessageId
                          ? { 
                              ...msg, 
                              content: explanation,
                              elementCount: data.elements.length,
                              isStreaming: false 
                            }
                          : msg
                      )
                    );
                    // 完成后自动折叠
                    setExpandedTools((prev) => ({ ...prev, [assistantMessageId]: false }));
                  }
                  break;
                
                case "text_only":
                  setChatHistory((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: data.content || fullContent, isStreaming: false }
                        : msg
                    )
                  );
                  setExpandedTools((prev) => ({ ...prev, [assistantMessageId]: false }));
                  break;
                  
                case "error":
                  setError(data.error || "生成失败");
                  setChatHistory((prev) =>
                    prev.filter((msg) => msg.id !== assistantMessageId)
                  );
                  break;
                
                case "done":
                  setChatHistory((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, isStreaming: false }
                        : msg
                    )
                  );
                  setExpandedTools((prev) => ({ ...prev, [assistantMessageId]: false }));
                  break;
              }
            } catch (parseError) {
              console.warn("解析失败:", parseError);
            }
          }
        }
      }
    } catch (err) {
      console.error("生成错误:", err);
      setError(err instanceof Error ? err.message : "生成失败，请重试");
      setChatHistory((prev) =>
        prev.filter((msg) => msg.id !== assistantMessageId)
      );
    } finally {
      setIsLoading(false);
    }
  }, [prompt, aiConfig, isConfigured, chatHistory]);

  const handleNewChat = useCallback(() => {
    setElements([]);
    setError("");
    setChatHistory([]);
    setExpandedTools({});
    excalidrawRef.current?.clearCanvas();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  const handleCopy = useCallback((content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleFeedback = useCallback((messageId: string, value: "good" | "bad") => {
    setFeedback((prev) => {
      if (prev[messageId] === value) {
        const next = { ...prev };
        delete next[messageId];
        return next;
      }
      return { ...prev, [messageId]: value };
    });
  }, []);

  // 折叠面板视图
  if (!isPanelVisible) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <main className="flex-1 overflow-hidden">
          <ExcalidrawWrapper
            ref={excalidrawRef}
            elements={elements}
          />
        </main>
        
        <div className="h-full flex flex-col items-center pt-4 bg-card border-l border-border/30 rounded-l-xl w-12">
          <button
            onClick={() => setIsPanelVisible(true)}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            title="显示面板"
          >
            <PanelRightOpen className="h-5 w-5 text-muted-foreground" />
          </button>
          <div
            className="text-sm font-medium text-muted-foreground mt-8 tracking-wide"
            style={{ writingMode: "vertical-rl" }}
          >
            AI Chat
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* 左侧：Excalidraw 画布 */}
      <main className="flex-1 overflow-hidden">
        <ExcalidrawWrapper
          ref={excalidrawRef}
          elements={elements}
        />
      </main>

      {/* 右侧：聊天面板 */}
      <aside className="h-full flex flex-col bg-card shadow-soft rounded-l-xl border-l border-border/30 w-[420px] min-w-[360px] relative animate-slide-in-right">
        {/* 头部 */}
        <header className="px-5 py-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleNewChat}
              disabled={isLoading}
              className="flex items-center gap-2 overflow-x-hidden hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="新建对话"
            >
              <div className="flex items-center gap-2">
                <Image
                  src="/favicon.ico"
                  alt="AI Excalidraw"
                  width={28}
                  height={28}
                  className="rounded flex-shrink-0"
                />
                <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">
                  AI Excalidraw
                </h1>
              </div>
            </button>
            <div className="flex items-center gap-1 justify-end overflow-visible">
              <button
                onClick={handleNewChat}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                title="新建对话"
              >
                <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="设置"
              >
                <Settings className="h-5 w-5 text-muted-foreground" />
              </button>
              <button
                onClick={() => setIsPanelVisible(false)}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                title="隐藏面板"
              >
                <PanelRightClose className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </header>

        {/* 消息区域 */}
        <ScrollArea className="flex-1 w-full">
          <div ref={chatContainerRef}>
            {chatHistory.length === 0 ? (
              // 欢迎界面
              <div className="py-6 px-4 animate-fade-in">
                {/* 公告卡片 */}
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mb-4 p-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                      <Terminal className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground group-hover:text-purple-500 transition-colors">
                          AI Excalidraw 已开源
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-500 text-white rounded">
                          Preview
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        使用自然语言绘制 Excalidraw 图表
                      </p>
                    </div>
                  </div>
                </a>

                {/* 欢迎标题 */}
                <div className="text-center mb-6">
                  <h2 className="text-lg font-semibold text-foreground mb-2">
                    用 AI 创建图表
                  </h2>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    描述您想要创建的内容或上传图片进行复制
                  </p>
                </div>

                {/* 快速示例 */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
                    快速示例
                  </p>
                  <div className="grid gap-2">
                    {QUICK_EXAMPLES.map((example, i) => {
                      const IconComponent = example.icon;
                      return (
                        <ExampleCard
                          key={i}
                          icon={<IconComponent className="w-4 h-4 text-primary" />}
                          title={example.title}
                          description={example.desc}
                          onClick={() => setPrompt(example.prompt)}
                          isNew={example.isNew}
                        />
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 text-center mt-4">
                    * 缓存的示例可能会立即显示
                  </p>
                </div>
              </div>
            ) : (
              // 聊天消息
              <div className="py-4 px-4 space-y-4">
                {chatHistory.map((msg, msgIndex) => {
                  const isLastAssistantMessage = msg.role === "assistant" && 
                    (msgIndex === chatHistory.length - 1 || 
                     chatHistory.slice(msgIndex + 1).every((m) => m.role !== "assistant"));

                  return (
                    <div
                      key={msg.id}
                      className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"} animate-message-in`}
                      style={{ animationDelay: `${msgIndex * 50}ms` }}
                    >
                      {/* 用户消息操作按钮 */}
                      {msg.role === "user" && (
                        <div className="flex items-center gap-1 self-center mr-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
                            title={copiedId === msg.id ? "已复制" : "复制"}
                          >
                            {copiedId === msg.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      )}

                      <div className="max-w-[85%] min-w-0">
                        {msg.role === "user" ? (
                          // 用户消息
                          <div className="px-4 py-3 text-sm leading-relaxed bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-sm">
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        ) : (
                          // AI 消息 - 工具调用卡片
                          <>
                            <ToolCallCard
                              isStreaming={msg.isStreaming || false}
                              content={msg.content}
                              elementCount={msg.elementCount}
                              isExpanded={expandedTools[msg.id] ?? !msg.isStreaming}
                              onToggleExpand={() => setExpandedTools((prev) => ({
                                ...prev,
                                [msg.id]: !prev[msg.id]
                              }))}
                              onCopy={() => handleCopy(msg.content, msg.id)}
                              isCopied={copiedId === msg.id}
                            />
                            
                            {/* AI 消息操作按钮 */}
                            {!msg.isStreaming && (
                              <div className="flex items-center gap-1 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(msg.content, msg.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    copiedId === msg.id
                                      ? "text-green-600 bg-green-100"
                                      : "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                                  }`}
                                  title={copiedId === msg.id ? "已复制" : "复制"}
                                >
                                  {copiedId === msg.id ? (
                                    <Check className="h-3.5 w-3.5" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                
                                {/* 重新生成按钮 */}
                                {isLastAssistantMessage && (
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                                    title="重新生成"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                
                                <div className="w-px h-4 bg-border mx-1" />
                                
                                {/* 反馈按钮 */}
                                <button
                                  type="button"
                                  onClick={() => handleFeedback(msg.id, "good")}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    feedback[msg.id] === "good"
                                      ? "text-green-600 bg-green-100"
                                      : "text-muted-foreground/60 hover:text-green-600 hover:bg-green-50"
                                  }`}
                                  title="好的回复"
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleFeedback(msg.id, "bad")}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    feedback[msg.id] === "bad"
                                      ? "text-red-600 bg-red-100"
                                      : "text-muted-foreground/60 hover:text-red-600 hover:bg-red-50"
                                  }`}
                                  title="差的回复"
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-2 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            <span>{error}</span>
            <button 
              className="ml-auto text-destructive/60 hover:text-destructive"
              onClick={() => setError("")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 输入区域 */}
        <footer className="p-4 border-t border-border/50 bg-card/50">
          <form
            onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}
            className="w-full transition-all duration-200"
          >
            <div className="relative rounded-2xl border border-border bg-background shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all duration-200">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述您的图表或上传文件..."
                disabled={isLoading}
                className="min-h-[60px] max-h-[200px] resize-none border-0 bg-transparent px-4 py-3 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60 scrollbar-thin"
              />
              <div className="flex items-center justify-end gap-1 px-3 py-2 border-t border-border/50">
                <div className="flex items-center gap-1 overflow-x-hidden">
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-8 w-8 p-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="历史记录"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-8 w-8 p-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="保存图表"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-8 w-8 p-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="上传文件"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className="h-8 w-8 p-0 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    title="提取 URL"
                  >
                    <Link className="h-4 w-4" />
                  </button>
                </div>
                
                {/* 模型选择器 */}
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border bg-background text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="max-w-[100px] truncate">
                    {isConfigured ? (aiConfig?.model || "默认") : "未配置"}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
                
                <div className="w-px h-5 bg-border mx-1" />
                
                {/* 发送按钮 */}
                <button
                  type="submit"
                  disabled={isLoading || !prompt.trim()}
                  className="h-8 px-4 rounded-xl font-medium shadow-sm flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="text-sm">发送</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </footer>
      </aside>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
