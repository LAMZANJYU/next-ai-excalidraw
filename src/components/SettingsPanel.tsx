"use client";

import { useState } from "react";
import {
  AIConfig,
  API_PRESETS,
  saveAIConfig,
  loadAIConfig,
  isConfigValid,
} from "@/lib/ai-config";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, EyeOff, Link, Settings2 } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange: (config: AIConfig) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  onConfigChange,
}: SettingsPanelProps) {
  const [config, setConfig] = useState<AIConfig>(() => loadAIConfig());
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const savedConfig = loadAIConfig();
    const matchedPreset = API_PRESETS.find(
      (p) => p.baseUrl === savedConfig.baseUrl
    );
    return matchedPreset ? matchedPreset.name : "自定义";
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [useCustomModel, setUseCustomModel] = useState(false);

  // 处理预设切换
  const handlePresetChange = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = API_PRESETS.find((p) => p.name === presetName);
    if (preset && preset.baseUrl) {
      setConfig((prev) => ({
        ...prev,
        baseUrl: preset.baseUrl,
        model: preset.models[0] || prev.model,
      }));
      setUseCustomModel(false);
    }
  };

  // 获取当前预设的模型列表
  const getCurrentModels = (): string[] => {
    const preset = API_PRESETS.find((p) => p.name === selectedPreset);
    return preset?.models || [];
  };

  // 保存配置
  const handleSave = () => {
    saveAIConfig(config);
    onConfigChange(config);
    onClose();
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!isConfigValid(config)) {
      setTestStatus("error");
      setTestMessage("请填写完整的配置信息");
      return;
    }

    setTestStatus("testing");
    setTestMessage("测试连接中...");

    try {
      const response = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      const data = await response.json();

      if (response.ok) {
        setTestStatus("success");
        setTestMessage("连接成功！");
      } else {
        setTestStatus("error");
        setTestMessage(data.error || "连接失败");
      }
    } catch {
      setTestStatus("error");
      setTestMessage("网络错误，请检查配置");
    }
  };

  const models = getCurrentModels();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-5" />
            AI 设置
          </DialogTitle>
          <DialogDescription>
            配置 AI 模型连接参数，支持 OpenAI 兼容的 API
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* API 提供商预设 */}
          <div className="space-y-2">
            <Label>API 提供商</Label>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue placeholder="选择 API 提供商" />
              </SelectTrigger>
              <SelectContent>
                {API_PRESETS.map((preset) => (
                  <SelectItem key={preset.name} value={preset.name}>
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                }
                placeholder="sk-..."
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <Label>API Base URL</Label>
            <Input
              value={config.baseUrl}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
              }
              placeholder="https://api.openai.com/v1"
            />
          </div>

          {/* 模型选择 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>模型</Label>
              {models.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 text-xs"
                  onClick={() => setUseCustomModel(!useCustomModel)}
                >
                  {useCustomModel ? "📋 选择预设" : "✏️ 自定义输入"}
                </Button>
              )}
            </div>
            
            {models.length > 0 && !useCustomModel ? (
              <Select
                value={config.model}
                onValueChange={(value) =>
                  setConfig((prev) => ({ ...prev, model: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={config.model}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, model: e.target.value }))
                }
                placeholder="输入模型名，如 gpt-4o, glm-4.7"
              />
            )}
            <p className="text-xs text-muted-foreground">
              💡 可以直接输入任意模型名，如 glm-4.7、gpt-4-turbo 等
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <Badge variant="secondary">{config.temperature}</Badge>
            </div>
            <Slider
              value={[config.temperature]}
              onValueChange={([value]) =>
                setConfig((prev) => ({ ...prev, temperature: value }))
              }
              min={0}
              max={2}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>精确 (0)</span>
              <span>创意 (2)</span>
            </div>
          </div>

          {/* 测试状态 */}
          {testStatus !== "idle" && (
            <div
              className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
                testStatus === "testing"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : testStatus === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {testStatus === "testing" && <Loader2 className="size-4 animate-spin" />}
              {testMessage}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTestConnection}>
            <Link className="size-4" />
            测试连接
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!isConfigValid(config)}>
              保存配置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
