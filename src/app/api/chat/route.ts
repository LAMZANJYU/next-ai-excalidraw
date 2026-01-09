import { NextRequest } from "next/server";
import https from "https";

// 创建一个跳过 SSL 验证的 agent（用于企业网络环境）
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// 定义绘图工具 - 使用 OpenAI Function Calling 格式
const DRAW_TOOL = {
  type: "function" as const,
  function: {
    name: "draw_elements",
    description: "在画布上绘制图形元素。当用户要求画图、绘制、添加图形时调用此工具。",
    parameters: {
      type: "object",
      properties: {
        elements: {
          type: "array",
          description: "要绘制的图形元素列表",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["rectangle", "ellipse", "diamond", "text", "arrow", "line"],
                description: "图形类型：rectangle(矩形), ellipse(椭圆/圆形), diamond(菱形), text(文字), arrow(箭头), line(线条)",
              },
              x: {
                type: "number",
                description: "元素左上角的 X 坐标",
              },
              y: {
                type: "number",
                description: "元素左上角的 Y 坐标",
              },
              width: {
                type: "number",
                description: "元素宽度（矩形、椭圆、菱形需要）",
              },
              height: {
                type: "number",
                description: "元素高度（矩形、椭圆、菱形需要）",
              },
              text: {
                type: "string",
                description: "文字内容（text类型必需，也可以在矩形/椭圆/菱形内添加标签）",
              },
              strokeColor: {
                type: "string",
                description: "边框颜色，如 #1e1e1e(黑), #e03131(红), #2f9e44(绿), #1971c2(蓝)",
              },
              backgroundColor: {
                type: "string",
                description: "背景颜色，如 transparent, #ffc9c9(浅红), #b2f2bb(浅绿), #a5d8ff(浅蓝)",
              },
              points: {
                type: "array",
                description: "箭头或线条的点坐标，格式 [[x1,y1], [x2,y2], ...]",
                items: {
                  type: "array",
                  items: { type: "number" },
                },
              },
            },
            required: ["type", "x", "y"],
          },
        },
        explanation: {
          type: "string",
          description: "简短解释这次绘制做了什么",
        },
      },
      required: ["elements"],
    },
  },
};

// 系统提示词 - 业界最佳实践：指导 AI 使用工具
const SYSTEM_PROMPT = `你是一个专业的绘图助手。当用户要求绘图时，你必须使用 draw_elements 工具来绑定图形。

【使用 draw_elements 工具的规则】

1. **元素类型**：
   - ellipse: 圆形/椭圆 (默认 width=100, height=100)
   - rectangle: 矩形 (默认 width=150, height=80)
   - diamond: 菱形 (默认 width=120, height=120)
   - text: 纯文字标签
   - arrow: 箭头，需要 points 数组
   - line: 线条，需要 points 数组

2. **颜色选择**：
   - 边框色 (strokeColor): #1971c2(蓝), #2f9e44(绿), #e03131(红), #f08c00(橙), #1e1e1e(黑)
   - 背景色 (backgroundColor): transparent, #a5d8ff(浅蓝), #b2f2bb(浅绿), #ffc9c9(浅红), #ffec99(浅黄)

3. **布局规则**：
   - 起始位置: x=100, y=100
   - 水平间距: 150px
   - 垂直间距: 150px
   - 每个元素必须有 type, x, y 字段

4. **explanation 字段**：简短描述你绑定了什么图形

请始终使用 draw_elements 工具来响应绘图请求。`;

// 消息类型
interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// 自定义流式 fetch 函数
async function* streamFetch(url: string, options: RequestInit): AsyncGenerator<string> {
  const urlObj = new URL(url);
  
  const responsePromise = new Promise<{
    statusCode: number;
    stream: NodeJS.ReadableStream;
  }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || "POST",
        headers: options.headers as Record<string, string>,
        agent: httpsAgent,
      },
      (res) => {
        resolve({ statusCode: res.statusCode || 200, stream: res });
      }
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });

  const { statusCode, stream } = await responsePromise;

  if (statusCode !== 200) {
    let errorData = "";
    for await (const chunk of stream) {
      errorData += chunk.toString();
    }
    throw new Error(`API 请求失败 (${statusCode}): ${errorData}`);
  }

  // 逐块读取流
  for await (const chunk of stream) {
    yield chunk.toString();
  }
}

// 解析 SSE 数据，提取内容和工具调用
interface ParsedChunk {
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    argumentsDelta: string;
  };
  finishReason?: string;
}

function parseSSEData(chunk: string): ParsedChunk[] {
  const lines = chunk.split("\n");
  const results: ParsedChunk[] = [];
  
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        const finishReason = parsed.choices?.[0]?.finish_reason;
        
        const result: ParsedChunk = {};
        
        // 提取文本内容（思考过程）
        if (delta?.content) {
          result.content = delta.content;
        }
        
        // 提取工具调用
        if (delta?.tool_calls?.[0]) {
          const tc = delta.tool_calls[0];
          result.toolCall = {
            id: tc.id || "",
            name: tc.function?.name || "",
            argumentsDelta: tc.function?.arguments || "",
          };
        }
        
        if (finishReason) {
          result.finishReason = finishReason;
        }
        
        if (result.content || result.toolCall || result.finishReason) {
          results.push(result);
        }
      } catch {
        // 忽略解析错误
      }
    }
  }
  
  return results;
}

// 将画布元素转换为简洁的描述
function describeCanvasElements(elements: Array<{
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  backgroundColor?: string;
}>): string {
  if (!elements || elements.length === 0) {
    return "画布当前为空。";
  }

  const descriptions = elements.map((el, i) => {
    let desc = `${i + 1}. ${el.type}`;
    if (el.text) desc += ` "${el.text}"`;
    desc += ` 位于 (${Math.round(el.x)}, ${Math.round(el.y)})`;
    if (el.width && el.height) desc += ` 尺寸 ${Math.round(el.width)}x${Math.round(el.height)}`;
    if (el.backgroundColor && el.backgroundColor !== "transparent") {
      desc += ` 背景色 ${el.backgroundColor}`;
    }
    return desc;
  });

  return `画布上当前有 ${elements.length} 个元素：\n${descriptions.join("\n")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, config, messages: inputMessages, currentElements } = await request.json();

    if (!prompt) {
      return new Response(JSON.stringify({ error: "请提供绘图描述" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 使用传入的配置
    const apiKey = config?.apiKey || process.env.OPENAI_API_KEY;
    const baseUrl = config?.baseUrl || "https://api.openai.com/v1";
    const model = config?.model || "gpt-4o-mini";
    const temperature = config?.temperature ?? 0.7;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "请先配置 API Key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 构建消息列表
    const messages: Message[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // 添加历史对话
    if (inputMessages && Array.isArray(inputMessages)) {
      messages.push(...inputMessages);
    }

    // 构建当前用户消息，包含画布状态
    let userMessage = prompt;
    if (currentElements && Array.isArray(currentElements) && currentElements.length > 0) {
      const canvasDescription = describeCanvasElements(currentElements);
      userMessage = `【当前画布状态】\n${canvasDescription}\n\n【用户请求】\n${prompt}\n\n请在现有元素的基础上进行操作，新元素要避免与现有元素重叠。`;
    }

    messages.push({ role: "user", content: userMessage });

    // 业界最佳实践：强制工具调用
    // 智谱 AI、OpenAI、Anthropic 等主流模型都支持强制工具调用
    // 使用 tool_choice 指定必须调用的工具，避免模型输出文本而不是调用工具
    const isOllama = baseUrl.includes("localhost:11434") || baseUrl.includes("ollama");
    
    // 构建请求体 - 强制使用工具调用
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature: temperature,
      stream: true,
      tools: [DRAW_TOOL],
      // 强制调用 draw_elements 工具（业界最佳实践）
      // Ollama 本地模型可能不支持强制工具调用，使用 auto
      tool_choice: isOllama 
        ? "auto"
        : { type: "function", function: { name: "draw_elements" } },
    });

    // 创建 ReadableStream 来流式返回数据
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let thinkingContent = ""; // 模型的思考/解释内容
        let toolCallName = "";
        let toolCallArguments = ""; // 累积工具调用的参数
        
        try {
          for await (const chunk of streamFetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: requestBody,
          })) {
            // 解析 SSE 数据
            const parsedChunks = parseSSEData(chunk);
            
            for (const parsed of parsedChunks) {
              // 处理文本内容（思考过程）
              if (parsed.content) {
                thinkingContent += parsed.content;
                // 发送思考内容
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                  type: "thinking", 
                  content: parsed.content 
                })}\n\n`));
              }
              
              // 处理工具调用
              if (parsed.toolCall) {
                if (parsed.toolCall.name) {
                  toolCallName = parsed.toolCall.name;
                }
                if (parsed.toolCall.argumentsDelta) {
                  toolCallArguments += parsed.toolCall.argumentsDelta;
                }
              }
              
              // 处理完成
              if (parsed.finishReason === "tool_calls" || parsed.finishReason === "stop") {
                // 如果有工具调用，解析并返回元素
                if (toolCallName === "draw_elements" && toolCallArguments) {
                  try {
                    const args = JSON.parse(toolCallArguments);
                    
                    // 构建 JSON 格式的消息内容，以便前端正确渲染 AI Result 卡片
                    const jsonContent = JSON.stringify({
                      elements: args.elements || [],
                      explanation: args.explanation || `已绘制 ${args.elements?.length || 0} 个元素`
                    }, null, 2); // 格式化 JSON 以便阅读（如果需要）

                    // 优先使用思考过程作为文本部分
                    let textPart = thinkingContent;
                    
                    // 如果思考过程为空，尝试使用工具调用中的解释
                    if (!textPart && args.explanation) {
                       textPart = args.explanation;
                    }
                    
                    // 组合文本和 JSON 代码块
                    const messageContent = textPart 
                       ? `${textPart}\n\n\`\`\`json\n${jsonContent}\n\`\`\``
                       : `\`\`\`json\n${jsonContent}\n\`\`\``;
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: "elements", 
                      elements: args.elements || [],
                      explanation: args.explanation || "",
                      assistantMessage: messageContent
                    })}\n\n`));
                  } catch (parseError) {
                    console.error("工具参数解析失败:", parseError, toolCallArguments);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: "error", 
                      error: "工具参数解析失败" 
                    })}\n\n`));
                  }
                } else if (!toolCallName && thinkingContent) {
                  // 模型没有调用工具，只返回了文本回复
                  // 尝试从文本中提取 JSON
                  console.log("尝试从文本中提取 JSON:", thinkingContent.substring(0, 200));
                  
                  // 多种匹配模式
                  let jsonStr = "";
                  
                  // 方式1：```json 代码块
                  const jsonBlockMatch = thinkingContent.match(/```json\s*([\s\S]*?)\s*```/);
                  if (jsonBlockMatch) {
                    jsonStr = jsonBlockMatch[1].trim();
                  }
                  
                  // 方式2：直接 JSON 对象 (从 { 到最后一个 })
                  if (!jsonStr) {
                    const firstBrace = thinkingContent.indexOf("{");
                    const lastBrace = thinkingContent.lastIndexOf("}");
                    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                      jsonStr = thinkingContent.substring(firstBrace, lastBrace + 1);
                    }
                  }
                  
                  if (jsonStr) {
                    try {
                      // 清理可能的格式问题 - 增强对 GLM 输出的容错
                      jsonStr = jsonStr
                        .replace(/[\x00-\x1F\x7F]/g, ' ') // 替换控制字符为空格
                        // 修复缺少引号的属性名（GLM 常见问题）
                        .replace(/,\s*(type|x|y|width|height|text|strokeColor|backgroundColor|points|explanation|elements)"/g, ',"$1"') // 修复 , width" -> ,"width"
                        .replace(/\{\s*(type|x|y|width|height|text|strokeColor|backgroundColor|points|explanation|elements)"/g, '{"$1"') // 修复 { width" -> {"width"
                        .replace(/(\d+)\s+(type|x|y|width|height|text|strokeColor|backgroundColor)"/g, '$1, "$2"') // 修复 100 width" -> 100, "width"
                        .replace(/"\s*:\s*,/g, '": 0,') // 修复 "y": , -> "y": 0,
                        .replace(/:\s*,/g, ': 0,') // 修复 : , -> : 0,
                        .replace(/:\s*}/g, ': null}') // 修复 "key": } -> "key": null}
                        .replace(/:\s*]/g, ': null]') // 修复 "key": ] -> "key": null]
                        .replace(/,\s*,/g, ',') // 修复 ,, -> ,
                        .replace(/,\s*}/g, '}') // 移除尾部逗号
                        .replace(/,\s*]/g, ']') // 移除数组尾部逗号
                        .replace(/"\s*\n\s*"/g, '","') // 修复换行导致的字符串中断
                        .replace(/""\s*:/g, '"type":') // 修复 "": -> "type":
                        .replace(/,\s*""\s*:/g, ',"type":') // 修复 ,"": -> ,"type":
                        .replace(/\{\s*""\s*:/g, '{"type":') // 修复 {"": -> {"type":
                        .replace(/"\s*\n/g, '" ') // 修复引号后换行
                        .replace(/\n\s*"/g, ' "') // 修复换行后引号
                        .replace(/\[\[(\d+),\s*(\d+)\](\d+),\s*(\d+)\]\]/g, '[[$1, $2], [$3, $4]]') // 修复 points 格式
                        .replace(/(\d+)\](\d+)/g, '$1], [$2') // 修复数组分隔
                        .trim();
                      
                      console.log("清理后的 JSON:", jsonStr.substring(0, 500));
                      const result = JSON.parse(jsonStr);
                      
                      if (result.elements && Array.isArray(result.elements)) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                          type: "elements", 
                          elements: result.elements, 
                          explanation: result.explanation || `已绘制 ${result.elements.length} 个元素`,
                          assistantMessage: result.explanation || `已绘制 ${result.elements.length} 个元素`
                        })}\n\n`));
                      } else {
                        console.warn("JSON 中没有 elements 数组:", result);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                          type: "text_only", 
                          content: thinkingContent 
                        })}\n\n`));
                      }
                    } catch (parseErr) {
                      console.error("JSON 解析失败:", parseErr, "原始内容:", jsonStr.substring(0, 300));
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: "error", 
                        error: "JSON 格式错误，请重试" 
                      })}\n\n`));
                    }
                  } else {
                    // 完全没有图形数据
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: "text_only", 
                      content: thinkingContent 
                    })}\n\n`));
                  }
                }
              }
            }
          }
          
          // 发送完成信号
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (error) {
          console.error("流式处理错误:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            type: "error", 
            error: error instanceof Error ? error.message : "未知错误" 
          })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI 绘图错误:", error);
    return new Response(
      JSON.stringify({ error: "生成图形失败，请稍后重试" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
