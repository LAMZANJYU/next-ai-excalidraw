// Excalidraw 元素类型定义
// 用于 AI 生成图形时的类型约束

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "hachure" | "cross-hatch" | "solid";
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  boundElements: null | { id: string; type: string }[];
  updated: number;
  link: null | string;
  locked: boolean;
}

export interface RectangleElement extends BaseElement {
  type: "rectangle";
  roundness: null | { type: number; value?: number };
}

export interface EllipseElement extends BaseElement {
  type: "ellipse";
}

export interface DiamondElement extends BaseElement {
  type: "diamond";
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: number; // 1: Virgil, 2: Helvetica, 3: Cascadia
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle" | "bottom";
  containerId: null | string;
  originalText: string;
  lineHeight: number;
}

export interface ArrowElement extends BaseElement {
  type: "arrow";
  points: [number, number][];
  startBinding: null | { elementId: string; focus: number; gap: number };
  endBinding: null | { elementId: string; focus: number; gap: number };
  startArrowhead: null | "arrow" | "bar" | "dot" | "triangle";
  endArrowhead: null | "arrow" | "bar" | "dot" | "triangle";
}

export interface LineElement extends BaseElement {
  type: "line";
  points: [number, number][];
  startBinding: null;
  endBinding: null;
  startArrowhead: null;
  endArrowhead: null;
}

export type ExcalidrawElementType =
  | RectangleElement
  | EllipseElement
  | DiamondElement
  | TextElement
  | ArrowElement
  | LineElement;

// AI 生成元素时使用的简化类型
export interface SimpleElement {
  type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  points?: [number, number][];
}

// AI 响应格式
export interface AIDrawingResponse {
  elements: SimpleElement[];
  explanation?: string;
}


