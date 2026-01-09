"use client";

import { useEffect, useState, useRef, useImperativeHandle, forwardRef, useCallback } from "react";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";

// 导入 Excalidraw 0.18 的样式（路径通过 package.json exports 定义）
import "@excalidraw/excalidraw/index.css";

// 配置 Excalidraw 字体资源路径
const configureExcalidrawAssets = () => {
  // 这里的配置已移动到 layout.tsx 全局设置，组件内仅做后备检查
  if (typeof window !== "undefined" && !window.EXCALIDRAW_ASSET_PATH) {
    window.EXCALIDRAW_ASSET_PATH = "/excalidraw-assets/";
  }
};

// 声明全局类型
declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

// 简化的元素类型接口
export interface ExcalidrawElementLike {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  strokeColor?: string;
  backgroundColor?: string;
  [key: string]: unknown;
}

// 暴露给父组件的方法
export interface ExcalidrawWrapperRef {
  getElements: () => ExcalidrawElementLike[];
  clearCanvas: () => void;
}

interface ExcalidrawWrapperProps {
  elements: ExcalidrawElementLike[];
}

const ExcalidrawWrapper = forwardRef<ExcalidrawWrapperRef, ExcalidrawWrapperProps>(
  function ExcalidrawWrapper({ elements }, ref) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [Excalidraw, setExcalidraw] = useState<any>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevElementsRef = useRef<ExcalidrawElementLike[]>([]);
    const isReadyRef = useRef(false);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      getElements: () => {
        if (!excalidrawAPI) return [];
        const sceneElements = excalidrawAPI.getSceneElements() || [];
        return sceneElements.map((el: ExcalidrawElementLike) => ({
          id: el.id,
          type: el.type,
          x: Math.round(el.x),
          y: Math.round(el.y),
          width: el.width ? Math.round(el.width as number) : undefined,
          height: el.height ? Math.round(el.height as number) : undefined,
          text: el.type === "text" ? el.text : undefined,
          strokeColor: el.strokeColor,
          backgroundColor: el.backgroundColor,
        }));
      },
      clearCanvas: () => {
        if (excalidrawAPI) {
          excalidrawAPI.updateScene({
            elements: [],
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });
          prevElementsRef.current = [];
        }
      },
    }), [excalidrawAPI]);

    // 计算容器尺寸
    const updateDimensions = useCallback(() => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // 只有当尺寸合理时才更新
        if (rect.width > 0 && rect.height > 0 && rect.height < 10000) {
          setDimensions({ width: rect.width, height: rect.height });
        }
      }
    }, []);

    // 监听容器尺寸变化
    useEffect(() => {
      configureExcalidrawAssets();
      
      // 初始化尺寸
      updateDimensions();

      // 监听窗口大小变化
      window.addEventListener('resize', updateDimensions);
      
      // 使用 ResizeObserver 监听容器变化
      const resizeObserver = new ResizeObserver(updateDimensions);
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        window.removeEventListener('resize', updateDimensions);
        resizeObserver.disconnect();
      };
    }, [updateDimensions]);

    // 动态加载 Excalidraw
    useEffect(() => {
      import("@excalidraw/excalidraw").then((mod) => {
        setExcalidraw(() => mod.Excalidraw);
      });
    }, []);

    // 当外部传入的 elements 变化时，更新画布
    useEffect(() => {
      if (!excalidrawAPI || !isReadyRef.current) {
        return;
      }
      if (!elements || !Array.isArray(elements) || elements.length === 0) {
        return;
      }

      try {
        const prevIds = new Set(
          prevElementsRef.current.map((e) => e?.id).filter(Boolean)
        );
        const newElements = elements.filter((e) => e && e.id && !prevIds.has(e.id));

        if (newElements.length > 0) {
          const currentElements = excalidrawAPI.getSceneElements() || [];
          const allElements = [
            ...currentElements.map((el: ExcalidrawElementLike) => ({ ...el })),
            ...newElements.map((el) => ({ ...el })),
          ];

          excalidrawAPI.updateScene({
            elements: allElements,
            captureUpdate: CaptureUpdateAction.IMMEDIATELY,
          });

          setTimeout(() => {
            try {
              const allSceneElements = excalidrawAPI.getSceneElements();
              if (allSceneElements && allSceneElements.length > 0) {
                excalidrawAPI.scrollToContent(allSceneElements, {
                  fitToViewport: true,
                  viewportZoomFactor: 0.85,
                  animate: true,
                  duration: 300,
                });
              }
            } catch (e) {
              console.warn("滚动失败:", e);
            }
          }, 100);
        }

        prevElementsRef.current = elements;
      } catch (error) {
        console.error("更新画布失败:", error);
      }
    }, [elements, excalidrawAPI]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleExcalidrawAPI = (api: any) => {
      if (api) {
        setExcalidrawAPI(api);
        isReadyRef.current = true;
        
        // 修复 Excalidraw 0.18 布局问题
        setTimeout(() => {
          fixExcalidrawLayout();
        }, 100);
      }
    };
    
    // 修复 Excalidraw 内部元素高度异常的问题
    const fixExcalidrawLayout = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const height = container.getBoundingClientRect().height;
      
      // 修复 layer-ui__wrapper 内部容器的高度
      const layerUI = container.querySelector('.layer-ui__wrapper') as HTMLElement;
      if (layerUI) {
        layerUI.style.height = `${height}px`;
        layerUI.style.overflow = 'hidden';
        layerUI.style.pointerEvents = 'none';
      }
      
      // 修复 FixedSideContainer 高度
      const fixedContainers = container.querySelectorAll('.FixedSideContainer');
      fixedContainers.forEach((el) => {
        (el as HTMLElement).style.height = 'auto';
        (el as HTMLElement).style.maxHeight = `${height}px`;
        (el as HTMLElement).style.pointerEvents = 'none';
      });
      
      // 修复 App-menu 高度
      const appMenus = container.querySelectorAll('.App-menu, .App-menu_top');
      appMenus.forEach((el) => {
        (el as HTMLElement).style.height = 'auto';
        (el as HTMLElement).style.pointerEvents = 'none';
      });
      
      // 修复 Island 工具栏
      const islands = container.querySelectorAll('.Island');
      islands.forEach((el) => {
        (el as HTMLElement).style.height = 'auto';
        (el as HTMLElement).style.maxHeight = 'fit-content';
        (el as HTMLElement).style.pointerEvents = 'auto';
      });
      
      // 确保按钮可点击
      const buttons = layerUI?.querySelectorAll('button, input, [role="radio"], [role="checkbox"]');
      buttons?.forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'auto';
      });
    };

    // 加载状态
    const isLoading = !Excalidraw || !dimensions;

    return (
      <div 
        ref={containerRef}
        style={{ 
          width: "100%", 
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "100%", 
            width: "100%",
            background: "#f9fafb",
            color: "#6b7280"
          }}>
            加载 Excalidraw...
          </div>
        ) : (
          <div
            style={{
              width: dimensions.width,
              height: dimensions.height,
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <Excalidraw
              excalidrawAPI={handleExcalidrawAPI}
              UIOptions={{
                canvasActions: {
                  changeViewBackgroundColor: true,
                  clearCanvas: true,
                  export: false,
                  loadScene: false,
                  saveAsImage: false,
                  saveToActiveFile: false,
                  toggleTheme: true,
                },
              }}
            />
          </div>
        )}
      </div>
    );
  }
);

export default ExcalidrawWrapper;
