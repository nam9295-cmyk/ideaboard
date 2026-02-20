"use client";

import { useState, useEffect } from "react";
import { MousePointer2, Type, Square, ArrowRight, Minus, Box, RectangleHorizontal, LayoutTemplate, PenTool, Eraser, Layout, Layers } from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { ToolMode, FrameNode, CanvasNode, GroupNode } from "@/types";

const CATEGORIES = {
    BASICS: "Basics",
    UI_ELEMENTS: "UI Elements",
    DRAWING: "Drawing",
    DETAIL_PAGE: "상세페이지 전용",
    BLOG: "블로그 전용",
    LANDING_PAGE: "랜딩페이지 전용"
};

export default function Sidebar() {
    const { nodes, selectedNodeIds, toolMode, setToolMode, pan, zoom, gridSize, addNodes } = useEditor();

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

            if (e.key.toLowerCase() === 'v') {
                setToolMode('select');
            } else if (e.key.toLowerCase() === 't') {
                setToolMode('text');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setToolMode]);

    const ToolButton = ({ mode, icon: Icon, label }: { mode: ToolMode; icon: any; label: string }) => (
        <button
            onClick={() => setToolMode(mode)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors text-sm font-medium
                ${toolMode === mode
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );

    const snapToGrid = (v: number) => Math.round(v / gridSize) * gridSize;

    const getPlacementPos = () => {
        const canvasViewport = document.querySelector("main.flex-1.relative.overflow-hidden.bg-gray-100") as HTMLElement | null;
        const viewportCenterScreenX = canvasViewport ? canvasViewport.clientWidth / 2 : window.innerWidth / 2;
        const viewportCenterScreenY = canvasViewport ? canvasViewport.clientHeight / 2 : window.innerHeight / 2;

        let worldX = (viewportCenterScreenX - pan.x) / zoom;
        let worldY = (viewportCenterScreenY - pan.y) / zoom;

        const selectedFrame = nodes.find(n => n.type === 'FRAME' && selectedNodeIds.includes(n.id)) as FrameNode | undefined;
        if (selectedFrame) {
            const margin = 40;
            worldX = Math.max(selectedFrame.x + margin, Math.min(worldX, selectedFrame.x + selectedFrame.width - margin));
            worldY = Math.max(selectedFrame.y + margin, Math.min(worldY, selectedFrame.y + selectedFrame.height - margin));
        }

        return { x: snapToGrid(worldX), y: snapToGrid(worldY) };
    };

    const createBlockGroup = (
        nodesFn: (x: number, y: number) => CanvasNode[],
        blockName: string
    ) => {
        const { x, y } = getPlacementPos();
        let blockNodes = nodesFn(x, y);

        const selectedFrame = nodes.find(n => n.type === 'FRAME' && selectedNodeIds.includes(n.id)) as FrameNode | undefined;
        const allFrames = nodes.filter((n): n is FrameNode => n.type === 'FRAME');
        const containingFrame = allFrames.find(
            (f) => x >= f.x && x <= f.x + f.width && y >= f.y && y <= f.y + f.height
        );
        const nearestFrame = allFrames.length > 0
            ? [...allFrames].sort((a, b) => {
                const acx = a.x + a.width / 2;
                const acy = a.y + a.height / 2;
                const bcx = b.x + b.width / 2;
                const bcy = b.y + b.height / 2;
                const da = Math.hypot(acx - x, acy - y);
                const db = Math.hypot(bcx - x, bcy - y);
                return da - db;
            })[0]
            : undefined;
        const targetFrame = selectedFrame || containingFrame || nearestFrame;

        const getNodeBounds = (node: CanvasNode) => {
            if (node.type === 'LINE' || node.type === 'ARROW') {
                const minX = Math.min(node.x, node.endX);
                const minY = Math.min(node.y, node.endY);
                const maxX = Math.max(node.x, node.endX);
                const maxY = Math.max(node.y, node.endY);
                return { minX, minY, maxX, maxY };
            }

            if (node.type === 'TEXT') {
                const lines = (node.text || "").split("\n");
                const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
                const fontSize = node.fontSize || 16;
                const textWidth = Math.max(10, longestLine * fontSize * 0.56);
                const textHeight = Math.max(fontSize * 1.4, lines.length * fontSize * 1.4);
                return {
                    minX: node.x,
                    minY: node.y,
                    maxX: node.x + textWidth,
                    maxY: node.y + textHeight,
                };
            }

            const width = node.width || 0;
            const height = node.height || 0;
            return {
                minX: node.x,
                minY: node.y,
                maxX: node.x + width,
                maxY: node.y + height,
            };
        };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        blockNodes.forEach(n => {
            const bounds = getNodeBounds(n);
            minX = Math.min(minX, bounds.minX);
            minY = Math.min(minY, bounds.minY);
            maxX = Math.max(maxX, bounds.maxX);
            maxY = Math.max(maxY, bounds.maxY);
        });

        const applyScaleFromMin = (scale: number) => {
            blockNodes = blockNodes.map((n) => {
                if (n.type === 'LINE' || n.type === 'ARROW') {
                    return {
                        ...n,
                        x: minX + (n.x - minX) * scale,
                        y: minY + (n.y - minY) * scale,
                        endX: minX + (n.endX - minX) * scale,
                        endY: minY + (n.endY - minY) * scale,
                    };
                }

                const baseNode = {
                    ...n,
                    x: minX + (n.x - minX) * scale,
                    y: minY + (n.y - minY) * scale,
                } as CanvasNode;

                if ('width' in n && typeof n.width === 'number') {
                    (baseNode as any).width = n.width * scale;
                }
                if ('height' in n && typeof n.height === 'number') {
                    (baseNode as any).height = n.height * scale;
                }
                if (n.type === 'TEXT') {
                    (baseNode as any).fontSize = Math.max(12, n.fontSize * scale);
                }

                return baseNode;
            });

            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            blockNodes.forEach(n => {
                const bounds = getNodeBounds(n);
                minX = Math.min(minX, bounds.minX);
                minY = Math.min(minY, bounds.minY);
                maxX = Math.max(maxX, bounds.maxX);
                maxY = Math.max(maxY, bounds.maxY);
            });
        };

        if (targetFrame) {
            const margin = 40;
            const availableWidth = Math.max(1, targetFrame.width - margin * 2);
            const groupWidth = Math.max(0, maxX - minX);

            // Scale down large blocks (e.g. detail page presets) to fit selected frame width, useful for mobile frames.
            if (groupWidth > availableWidth) {
                applyScaleFromMin(availableWidth / groupWidth);
            }

            const groupHeight = Math.max(0, maxY - minY);
            const maxAllowedX = targetFrame.x + targetFrame.width - margin - groupWidth;
            const maxAllowedY = targetFrame.y + targetFrame.height - margin - groupHeight;
            const targetMinX = Math.max(targetFrame.x + margin, Math.min(minX, maxAllowedX));
            const targetMinY = Math.max(targetFrame.y + margin, Math.min(minY, maxAllowedY));
            const dx = targetMinX - minX;
            const dy = targetMinY - minY;

            if (dx !== 0 || dy !== 0) {
                blockNodes = blockNodes.map((n) => {
                    if (n.type === 'LINE' || n.type === 'ARROW') {
                        return { ...n, x: n.x + dx, y: n.y + dy, endX: n.endX + dx, endY: n.endY + dy };
                    }
                    return { ...n, x: n.x + dx, y: n.y + dy };
                });
                minX += dx;
                minY += dy;
                maxX += dx;
                maxY += dy;
            }
        }

        const groupId = crypto.randomUUID();
        const groupNode: GroupNode = {
            id: groupId,
            type: 'GROUP',
            name: blockName,
            x: minX,
            y: minY,
            width: Math.max(0, maxX - minX),
            height: Math.max(0, maxY - minY),
        };

        const nodesWithGroupId = blockNodes.map(n => ({ ...n, groupId }));
        addNodes([groupNode, ...nodesWithGroupId]);
        setToolMode('select');
    };

    const addHeroBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 320, height: 190, color: '#f8fafc' },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 20, y: y + 34, text: "세상을 바꾸는 혁신적인 아이디어", fontSize: 17 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 20, y: y + 74, text: "지금 바로 시작하고 여러분의 꿈을\n현실로 만드세요.", fontSize: 13 },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 20, y: y + 126, width: 130, height: 36, text: "무료로 시작하기", variant: 'primary' }
        ], '히어로 영역');
    };

    const addParagraphBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'TEXT', x, y, text: "핵심 가치 및 비전", fontSize: 36 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 50, text: "우리는 사용자 경험을 최우선으로 생각합니다.\n모든 기능은 깊은 고민 끝에 탄생했습니다.", fontSize: 14 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 108, text: "지속 가능한 성장을 위해 우리는 매일 혁신합니다.\n기술은 도구일 뿐, 본질은 사람입니다.", fontSize: 14 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 166, text: "함께 미래를 그려나갈 파트너를 찾고 있습니다.\n지금 바로 문의해 주세요.", fontSize: 14 }
        ], '문단 영역');
    };

    const addImageBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 320, height: 190, color: '#e2e8f0' },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 208, text: "이미지에 대한 상세 설명이 여기에 들어갑니다.", fontSize: 13 }
        ], '이미지 영역');
    };

    const addFeatureBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            for (let i = 0; i < 3; i++) {
                const by = y + (i * 170);
                blockNodes.push({ id: crypto.randomUUID(), type: 'CARD', x, y: by, width: 320, height: 150, title: `특징 ${i + 1}`, content: "이 제품이 가진 핵심적인 장점을\n간략하게 설명합니다." });
            }
            return blockNodes;
        }, '특징 모음');
    };

    const addPricingBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 320, height: 280, color: '#ffffff' },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 24, y: y + 28, text: "Premium Plan", fontSize: 20 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 24, y: y + 66, text: "₩ 29,900 / 월", fontSize: 30 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 24, y: y + 122, text: "모든 고급 기능을\n제한 없이 사용하세요.", fontSize: 14 },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 24, y: y + 206, width: 272, height: 42, text: "지금 구매하기", variant: 'primary' }
        ], '가격 플랜');
    };

    const addFaqBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            for (let i = 0; i < 3; i++) {
                const currentY = y + (i * 100);
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x, y: currentY, text: `Q. 질문이 여기에 들어갑니다. (${i + 1})`, fontSize: 18 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 20, y: currentY + 30, text: `A. 답변 내용이 여기에 자세하게 작성됩니다.`, fontSize: 14 });
            }
            return blockNodes;
        }, 'FAQ');
    };

    const addSpecTableBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            blockNodes.push({ id: crypto.randomUUID(), type: 'BOX', x, y, width: 320, height: 250, color: 'transparent' }); // Container

            for (let i = 0; i < 5; i++) {
                const currentY = y + (i * 50);
                blockNodes.push({ id: crypto.randomUUID(), type: 'LINE', x, y: currentY, endX: x + 320, endY: currentY }); // Top border of row
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 12, y: currentY + 15, text: `항목 ${i + 1}`, fontSize: 14 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 150, y: currentY + 15, text: `상세값 ${i + 1}`, fontSize: 14 });
            }
            blockNodes.push({ id: crypto.randomUUID(), type: 'LINE', x, y: y + 250, endX: x + 320, endY: y + 250 }); // Bottom border of table
            return blockNodes;
        }, '스펙 표');
    };

    const addReviewBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            for (let i = 0; i < 3; i++) {
                const by = y + (i * 158);
                blockNodes.push({ id: crypto.randomUUID(), type: 'BOX', x, y: by, width: 320, height: 140, color: '#f8fafc' });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 18, y: by + 18, text: "⭐⭐⭐⭐⭐", fontSize: 16 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 18, y: by + 56, text: "정말 훌륭한 제품입니다!", fontSize: 14 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 18, y: by + 98, text: "홍길동", fontSize: 12 });
            }
            return blockNodes;
        }, '후기');
    };

    const addDividerTitleBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'LINE', x, y, endX: x + 320, endY: y },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 18, text: "새로운 섹션 제목", fontSize: 24 }
        ], '섹션 제목');
    };

    const addTwoButtonsBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BUTTON', x, y, width: 152, height: 44, text: "구매하기", variant: 'primary' },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 168, y, width: 152, height: 44, text: "문의하기", variant: 'secondary' }
        ], '버튼 그룹');
    };

    const BlockButton = ({ onClick, icon: Icon, label }: { onClick: () => void; icon: any; label: string }) => (
        <button
            onClick={onClick}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors text-sm font-medium text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 shadow-sm"
        >
            <Icon size={18} className="text-blue-500" />
            <span>{label}</span>
        </button>
    );

    return (
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 shrink-0 h-full">
            <div className="flex border-b border-gray-200 shrink-0">
                <div className="w-full py-3 text-xs font-bold uppercase tracking-widest text-center text-gray-500 bg-gray-50">
                    Tools
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-8">

                {/* BASICS Functionality */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        {CATEGORIES.BASICS}
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="select" icon={MousePointer2} label="Select" />
                        <ToolButton mode="text" icon={Type} label="Text" />
                        <ToolButton mode="box" icon={Square} label="Box" />
                        <ToolButton mode="line" icon={Minus} label="Line" />
                        <ToolButton mode="arrow" icon={ArrowRight} label="Arrow" />
                    </div>
                </div>

                {/* UI ELEMENTS */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        {CATEGORIES.UI_ELEMENTS}
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="button" icon={RectangleHorizontal} label="Button" />
                        <ToolButton mode="input" icon={LayoutTemplate} label="Input" />
                        <ToolButton mode="card" icon={Box} label="Card" />
                    </div>
                </div>

                {/* DRAWING */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        {CATEGORIES.DRAWING}
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="pencil" icon={PenTool} label="Pencil" />
                        <ToolButton mode="eraser" icon={Eraser} label="Eraser" />
                    </div>
                </div>

                {/* PAGE BLOCKS - 상세페이지 전용 */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        {CATEGORIES.DETAIL_PAGE}
                    </h3>
                    <div className="space-y-2">
                        <BlockButton onClick={addHeroBlock} icon={Layout} label="히어로 영역" />
                        <BlockButton onClick={addParagraphBlock} icon={Type} label="문단 영역" />
                        <BlockButton onClick={addImageBlock} icon={Box} label="이미지+설명" />
                        <BlockButton onClick={addFeatureBlock} icon={LayoutTemplate} label="장점 3개" />
                        <BlockButton onClick={addPricingBlock} icon={RectangleHorizontal} label="가격+구매버튼" />

                        <div className="my-2 border-t border-gray-100"></div>

                        <BlockButton onClick={addFaqBlock} icon={Type} label="FAQ (질문/답변)" />
                        <BlockButton onClick={addSpecTableBlock} icon={LayoutTemplate} label="스펙 표" />
                        <BlockButton onClick={addReviewBlock} icon={Box} label="후기 3개" />
                        <BlockButton onClick={addDividerTitleBlock} icon={Minus} label="구분선+소제목" />
                        <BlockButton onClick={addTwoButtonsBlock} icon={RectangleHorizontal} label="버튼 2개 영역" />
                    </div>
                </div>

            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 shrink-0">
                <p className="text-xs text-gray-400">Project: Untitled</p>
                <div className="mt-2 text-[10px] text-gray-300 flex space-x-2">
                    <span>V: Select</span>
                    <span>T: Text</span>
                </div>
            </div>
        </aside>
    );
}
