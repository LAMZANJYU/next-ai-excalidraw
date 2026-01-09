import { SimpleElement } from "@/types/excalidraw";

// 简化的元素类型
interface ExcalidrawElementLike {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

// 生成唯一 ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// 生成随机种子
function generateSeed(): number {
  return Math.floor(Math.random() * 2000000000);
}

// 基础元素属性 - 包含 Excalidraw 所需的所有必要字段
function getBaseElement(x: number, y: number): ExcalidrawElementLike {
  const now = Date.now();
  return {
    id: generateId(),
    type: "rectangle", // 默认类型，会被覆盖
    x: x || 0,
    y: y || 0,
    width: 100,
    height: 100,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "solid", // 使用 solid 填充，更清晰
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: generateSeed(),
    version: 1,
    versionNonce: generateSeed(),
    isDeleted: false,
    // 重要：这些字段是必须的
    groupIds: [],
    frameId: null,
    boundElements: null,
    updated: now,
    link: null,
    locked: false,
    // roundness 对于形状很重要
    roundness: { type: 3 },
  };
}

// 计算文字宽度（中文字符按全宽计算）
function calculateTextWidth(text: string, fontSize: number): number {
  let width = 0;
  for (const char of text) {
    // 中文字符和全角字符按 1:1 计算
    if (/[\u4e00-\u9fa5\uff00-\uffff]/.test(char)) {
      width += fontSize;
    } else {
      // 英文和数字按 0.6 计算
      width += fontSize * 0.6;
    }
  }
  return width;
}

// 创建文字元素
// Excalidraw 字体选项:
// 1 = Virgil (经典手写字体，不支持中文)
// 2 = Helvetica (普通字体)  
// 3 = Cascadia (等宽代码字体)
// 4 = Excalifont (新版手写字体，支持中文！)
// 5 = Nunito
function createTextElement(
  text: string,
  centerX: number,
  centerY: number,
  strokeColor?: string
): ExcalidrawElementLike {
  const fontSize = 20;
  const textWidth = calculateTextWidth(text, fontSize);
  const textHeight = fontSize * 1.5;
  
  // 使用 Excalifont (fontFamily: 4) - 支持中文的手写字体
  const fontFamily = 4;

  return {
    ...getBaseElement(centerX - textWidth / 2, centerY - textHeight / 2),
    type: "text",
    width: textWidth,
    height: textHeight,
    text: text,
    fontSize: fontSize,
    fontFamily: fontFamily,
    textAlign: "center",
    verticalAlign: "middle",
    containerId: null,
    originalText: text,
    lineHeight: 1.25,
    strokeColor: strokeColor || "#1e1e1e",
    backgroundColor: "transparent",
    roundness: null,
    autoResize: true,
  };
}

// 将简化元素转换为 Excalidraw 元素（可能返回多个元素）
export function convertToExcalidrawElements(
  simple: SimpleElement
): ExcalidrawElementLike[] {
  // 确保 x, y 有默认值
  const x = simple.x ?? 100;
  const y = simple.y ?? 100;
  const base = getBaseElement(x, y);
  const elements: ExcalidrawElementLike[] = [];

  switch (simple.type) {
    case "rectangle": {
      const width = simple.width || 150;
      const height = simple.height || 80;
      const rectElement = {
        ...base,
        type: "rectangle",
        width,
        height,
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: simple.backgroundColor || "transparent",
        roundness: { type: 3 },
      };
      elements.push(rectElement);

      // 如果有文字，在中心添加文字元素
      if (simple.text) {
        const textElement = createTextElement(
          simple.text,
          x + width / 2,
          y + height / 2,
          simple.strokeColor
        );
        elements.push(textElement);
      }
      break;
    }

    case "ellipse": {
      const width = simple.width || 100;
      const height = simple.height || 100;
      const ellipseElement = {
        ...base,
        type: "ellipse",
        width,
        height,
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: simple.backgroundColor || "transparent",
        roundness: null, // ellipse 不需要 roundness
      };
      elements.push(ellipseElement);

      // 如果有文字，在中心添加文字元素
      if (simple.text) {
        const textElement = createTextElement(
          simple.text,
          x + width / 2,
          y + height / 2,
          simple.strokeColor
        );
        elements.push(textElement);
      }
      break;
    }

    case "diamond": {
      const width = simple.width || 120;
      const height = simple.height || 120;
      const diamondElement = {
        ...base,
        type: "diamond",
        width,
        height,
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: simple.backgroundColor || "transparent",
        roundness: null,
      };
      elements.push(diamondElement);

      // 如果有文字，在中心添加文字元素
      if (simple.text) {
        const textElement = createTextElement(
          simple.text,
          x + width / 2,
          y + height / 2,
          simple.strokeColor
        );
        elements.push(textElement);
      }
      break;
    }

    case "text": {
      const fontSize = 20;
      const text = simple.text || "Text";
      const textWidth = calculateTextWidth(text, fontSize);
      
      const textElement = {
        ...base,
        type: "text",
        width: textWidth,
        height: fontSize * 1.5,
        text: text,
        fontSize: fontSize,
        fontFamily: 4, // Excalifont - 支持中文的手写字体
        textAlign: "center",
        verticalAlign: "middle",
        containerId: null,
        originalText: text,
        lineHeight: 1.25,
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: "transparent",
        roundness: null,
        autoResize: true,
      };
      elements.push(textElement);
      break;
    }

    case "arrow": {
      // 处理箭头的 points
      // AI 可能生成绝对坐标或相对坐标
      let arrowPoints = simple.points || [
        [0, 0],
        [100, 0],
      ];

      // 如果 AI 没有提供 x, y，从 points 的第一个点推断位置
      let arrowX = simple.x;
      let arrowY = simple.y;

      if (arrowX === undefined || arrowY === undefined) {
        // 计算 points 的边界
        let minX = Infinity,
          minY = Infinity;
        for (const [px, py] of arrowPoints) {
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
        }
        arrowX = minX;
        arrowY = minY;

        // 将 points 转换为相对坐标
        arrowPoints = arrowPoints.map(([px, py]) => [px - minX, py - minY]);
      }

      // 计算宽高
      let maxX = -Infinity,
        maxY = -Infinity;
      for (const [px, py] of arrowPoints) {
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }

      const arrowElement = {
        ...getBaseElement(arrowX, arrowY),
        type: "arrow",
        width: maxX || 100,
        height: maxY || 1,
        points: arrowPoints,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: "arrow",
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: "transparent",
        roundness: { type: 2 },
        lastCommittedPoint: null,
      };
      elements.push(arrowElement);
      break;
    }

    case "line": {
      // 处理线条的 points
      let linePoints = simple.points || [
        [0, 0],
        [100, 0],
      ];

      let lineX = simple.x;
      let lineY = simple.y;

      if (lineX === undefined || lineY === undefined) {
        let minX = Infinity,
          minY = Infinity;
        for (const [px, py] of linePoints) {
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
        }
        lineX = minX;
        lineY = minY;

        linePoints = linePoints.map(([px, py]) => [px - minX, py - minY]);
      }

      let maxX = -Infinity,
        maxY = -Infinity;
      for (const [px, py] of linePoints) {
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }

      const lineElement = {
        ...getBaseElement(lineX, lineY),
        type: "line",
        width: maxX || 100,
        height: maxY || 1,
        points: linePoints,
        startBinding: null,
        endBinding: null,
        startArrowhead: null,
        endArrowhead: null,
        strokeColor: simple.strokeColor || "#1e1e1e",
        backgroundColor: "transparent",
        roundness: { type: 2 },
        lastCommittedPoint: null,
      };
      elements.push(lineElement);
      break;
    }

    default: {
      const defaultElement = {
        ...base,
        type: "rectangle",
        width: 100,
        height: 100,
      };
      elements.push(defaultElement);
    }
  }

  return elements;
}

// 批量转换（保持向后兼容）
export function convertSimpleElementsToExcalidraw(
  simpleElements: SimpleElement[]
): ExcalidrawElementLike[] {
  if (!simpleElements || !Array.isArray(simpleElements)) {
    console.warn("Invalid elements array:", simpleElements);
    return [];
  }

  const allElements: ExcalidrawElementLike[] = [];

  for (const el of simpleElements) {
    if (!el || typeof el !== "object" || !el.type) {
      console.warn("Filtering invalid element:", el);
      continue;
    }

    const converted = convertToExcalidrawElements(el);
    console.log(`Converted ${el.type} to ${converted.length} elements`);
    allElements.push(...converted);
  }

  return allElements;
}
