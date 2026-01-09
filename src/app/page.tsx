"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { convertSimpleElementsToExcalidraw } from "@/lib/element-generator";
import { SimpleElement } from "@/types/excalidraw";
import { AIConfig, loadAIConfig, isConfigValid } from "@/lib/ai-config";
import type { ExcalidrawWrapperRef, ExcalidrawElementLike } from "@/components/ExcalidrawWrapper";

// shadcn/ui 组件
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Send, 
  Settings, 
  Trash2, 
  Sparkles,
  Loader2,
  AlertCircle,
  Palette,
  User,
  Bot
} from "lucide-react";

// 对话消息类型
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

// 动态导入组件
const ExcalidrawWrapper = dynamic(
  () => import("@/components/ExcalidrawWrapper"),
  { 
    ssr: false, 
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 bg-muted/30">
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

// 格式化时间
function formatTime(date: Date) {
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

// 生成进度阶段
type GenerationStage = "idle" | "thinking" | "drawing" | "done";

// 快捷指令
const QUICK_PROMPTS = [
  "画一个简单的用户注册流程图",
  "画三个圆形代表前端、后端、数据库",
  "画一个待办事项列表的 UI 草图",
  "画一个简单的状态机",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("idle");
  const [elements, setElements] = useState<ExcalidrawElementLike[]>([]);
  const [error, setError] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const excalidrawRef = useRef<ExcalidrawWrapperRef>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  const handleConfigChange = useCallback((config: AIConfig) => {
    setAiConfig(config);
    setIsConfigured(isConfigValid(config));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    if (!isConfigured) {
      setError("请先点击右上角设置按钮配置 AI");
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
    setPrompt("");
    setIsLoading(true);
    setGenerationStage("thinking");
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
                  setGenerationStage("drawing");
                  if (data.elements && Array.isArray(data.elements)) {
                    const excalidrawElements = convertSimpleElementsToExcalidraw(
                      data.elements as SimpleElement[]
                    );
                    setElements((prev) => [...prev, ...excalidrawElements]);
                  }
                  const finalContent = data.assistantMessage || fullContent || data.explanation || "已完成绘制";
                  setChatHistory((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: finalContent, isStreaming: false }
                        : msg
                    )
                  );
                  setGenerationStage("done");
                  break;
                
                case "text_only":
                  setChatHistory((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: data.content || fullContent, isStreaming: false }
                        : msg
                    )
                  );
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
      setTimeout(() => setGenerationStage("idle"), 1000);
    }
  }, [prompt, aiConfig, isConfigured, chatHistory]);

  const handleClear = useCallback(() => {
    setElements([]);
    setError("");
    setChatHistory([]);
    excalidrawRef.current?.clearCanvas();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  // 渲染消息内容
  const renderMessageContent = (content: string, role: "user" | "assistant") => {
    if (role === "user") {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    let textPart = content;
    let jsonPart = null;

    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonBlockMatch) {
      const matchIndex = content.indexOf(jsonBlockMatch[0]);
      if (matchIndex > 0) {
        textPart = content.substring(0, matchIndex).trim();
      } else {
        textPart = "";
      }

      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          jsonPart = parsed;
        }
      } catch {
        textPart = content;
      }
    } else {
      try {
        const parsed = JSON.parse(content);
        if (parsed.elements && Array.isArray(parsed.elements)) {
          jsonPart = parsed;
          if (parsed.explanation && parsed.explanation !== "已完成绘制") {
             textPart = parsed.explanation;
          } else {
             textPart = "";
          }
        }
      } catch {
        textPart = content;
      }
    }

    return (
      <div className="space-y-3">
        {textPart && <p className="whitespace-pre-wrap">{textPart}</p>}
        
        {jsonPart && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {jsonPart.explanation || `已绘制 ${jsonPart.elements.length} 个图形`}
              </p>
              <p className="text-xs opacity-75">
                {jsonPart.elements.length} 个元素已添加到画布
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gradient-to-b from-background to-muted/30">
      {/* 左侧：聊天面板 */}
      <aside className="flex h-full w-[400px] min-w-[400px] flex-col border-r bg-background/80 backdrop-blur-xl">
        {/* 头部 */}
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Palette className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold">AI 绘图助手</h1>
              <p className="text-xs text-muted-foreground">对话式绘图</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConfigured ? (
              <Badge 
                variant="secondary" 
                className="cursor-pointer gap-1.5"
                onClick={() => setIsSettingsOpen(true)}
              >
                <span className="size-1.5 rounded-full bg-green-500" />
                {aiConfig?.model}
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className="cursor-pointer border-orange-200 bg-orange-50 text-orange-600"
                onClick={() => setIsSettingsOpen(true)}
              >
                <AlertCircle className="size-3" />
                未配置
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </header>

        {/* 对话区域 */}
        <ScrollArea className="flex-1">
          <div ref={chatContainerRef} className="p-4">
            {chatHistory.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Palette className="size-8 text-primary" />
                </div>
                <h2 className="mb-2 text-lg font-semibold">开始创作</h2>
                <p className="mb-6 max-w-[260px] text-sm text-muted-foreground">
                  用自然语言描述你想画什么，AI 会帮你生成图形
                </p>
                <div className="flex w-full flex-col gap-2">
                  {QUICK_PROMPTS.map((example, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="h-auto justify-start px-3 py-2.5 text-left text-sm font-normal"
                      onClick={() => setPrompt(example)}
                    >
                      <Sparkles className="mr-2 size-4 shrink-0 text-primary" />
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback className={msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                        {msg.role === "user" ? <User className="size-4" /> : <Bot className="size-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex max-w-[85%] flex-col gap-1 ${msg.role === "user" ? "items-end" : ""}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.role === "user" ? "你" : "AI"}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      <Card className={`${msg.role === "user" ? "bg-primary text-primary-foreground" : ""}`}>
                        <CardContent className="p-3 text-sm">
                          {msg.isStreaming && !msg.content ? (
                            <div className="flex items-center gap-1">
                              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                              <span className="size-2 animate-bounce rounded-full bg-current" />
                            </div>
                          ) : (
                            renderMessageContent(msg.content, msg.role)
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* 生成进度 */}
        {isLoading && generationStage !== "idle" && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            <Loader2 className="size-4 animate-spin" />
            {generationStage === "thinking" && "AI 正在思考..."}
            {generationStage === "drawing" && "正在绘制图形..."}
            {generationStage === "done" && "✅ 完成！"}
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4" />
            {error}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-6"
              onClick={() => setError("")}
            >
              ✕
            </Button>
          </div>
        )}

        {/* 输入区域 */}
        <div className="border-t p-4">
          {chatHistory.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 ml-auto flex h-auto gap-1 py-1 text-xs text-muted-foreground"
              onClick={handleClear}
            >
              <Trash2 className="size-3" />
              清空
            </Button>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              className="min-h-[44px] resize-none"
              placeholder={
                chatHistory.length > 0
                  ? "继续描述，或修改画布上的内容..."
                  : "描述你想画什么... (Enter 发送)"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleGenerate}
              disabled={isLoading || !prompt.trim()}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* 右侧：Excalidraw 画布 */}
      <main className="flex-1 overflow-hidden bg-white">
        <ExcalidrawWrapper
          ref={excalidrawRef}
          elements={elements}
        />
      </main>

      {/* 设置面板 */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onConfigChange={handleConfigChange}
      />
    </div>
  );
}
