import { NextRequest, NextResponse } from "next/server";
import https from "https";

// 创建一个跳过 SSL 验证的 agent
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

// 自定义 fetch 函数，跳过 SSL 验证
async function fetchWithSSLBypass(url: string, options: RequestInit) {
  const urlObj = new URL(url);
  
  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || "GET",
        headers: options.headers as Record<string, string>,
        agent: httpsAgent,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve(
            new Response(data, {
              status: res.statusCode || 200,
              headers: res.headers as HeadersInit,
            })
          );
        });
      }
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const { apiKey, baseUrl, model } = await request.json();

    if (!apiKey || !baseUrl || !model) {
      return NextResponse.json(
        { error: "缺少必要的配置参数" },
        { status: 400 }
      );
    }

    // 发送一个简单的测试请求
    const response = await fetchWithSSLBypass(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText } };
      }
      return NextResponse.json(
        { error: errorData.error?.message || `HTTP ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("测试连接错误:", error);
    return NextResponse.json(
      { error: "连接失败，请检查配置" },
      { status: 500 }
    );
  }
}
