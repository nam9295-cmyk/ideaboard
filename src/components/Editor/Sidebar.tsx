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
        // Find selected frame
        const selectedFrame = nodes.find(n => n.type === 'FRAME' && selectedNodeIds.includes(n.id)) as FrameNode | undefined;
        if (selectedFrame) {
            // Find nodes inside this frame to calculate the lowest Y position
            const nodesInFrame = nodes.filter(n => {
                if (n.id === selectedFrame.id) return false;
                // Simple AABB check: if node's top-left is inside the frame
                return n.x >= selectedFrame.x && n.x <= selectedFrame.x + selectedFrame.width &&
                    n.y >= selectedFrame.y && n.y <= selectedFrame.y + selectedFrame.height;
            });

            let maxY = selectedFrame.y + 40; // Default padding from top

            for (const node of nodesInFrame) {
                // Not all nodes have height/endY explicitly cleanly typed in BaseNode without casting,
                // but we can estimate based on type or properties.
                let nodeBottom = node.y;
                if ('height' in node && typeof node.height === 'number') {
                    nodeBottom = node.y + node.height;
                } else if ('endY' in node && typeof node.endY === 'number') {
                    nodeBottom = Math.max(node.y, node.endY);
                } else if (node.type === 'TEXT') {
                    // Approximate text height based on font size and lines (simple heuristic)
                    const textNode = node as any;
                    const lines = (textNode.text || '').split('\n').length;
                    nodeBottom = node.y + (textNode.fontSize || 16) * lines * 1.5;
                }

                if (nodeBottom + 40 > maxY) {
                    maxY = nodeBottom + 40; // 40px margin below the lowest node
                }
            }

            return { x: snapToGrid(selectedFrame.x + 40), y: snapToGrid(maxY) };
        }

        // Center of viewport
        const viewportCenterX = (window.innerWidth / 2 - pan.x) / zoom;
        const viewportCenterY = (window.innerHeight / 2 - pan.y) / zoom;
        return { x: snapToGrid(viewportCenterX), y: snapToGrid(viewportCenterY) };
    };

    const createBlockGroup = (
        nodesFn: (x: number, y: number) => CanvasNode[],
        blockName: string
    ) => {
        const { x, y } = getPlacementPos();
        const nodes = nodesFn(x, y);

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach(n => {
            const nx = n.x;
            const ny = n.y;
            let nw = nx;
            let nh = ny;

            if (n.type === 'LINE' || n.type === 'ARROW') {
                nw = Math.max(nx, n.endX);
                nh = Math.max(ny, n.endY);
                minX = Math.min(minX, nx, n.endX);
                minY = Math.min(minY, ny, n.endY);
            } else {
                nw = nx + (n.width || 0);
                nh = ny + (n.height || 0);
                minX = Math.min(minX, nx);
                minY = Math.min(minY, ny);
            }
            maxX = Math.max(maxX, nw);
            maxY = Math.max(maxY, nh);
        });

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

        const nodesWithGroupId = nodes.map(n => ({ ...n, groupId }));
        addNodes([groupNode, ...nodesWithGroupId]);
        setToolMode('select');
    };

    const addHeroBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 800, height: 400, color: '#f8fafc' },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 60, y: y + 80, text: "세상을 바꾸는 혁신적인 아이디어", fontSize: 48 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 60, y: y + 160, text: "지금 바로 시작하고 여러분의 꿈을 현실로 만드세요.", fontSize: 24 },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 60, y: y + 240, width: 160, height: 50, text: "무료로 시작하기", variant: 'primary' }
        ], '히어로 영역');
    };

    const addParagraphBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'TEXT', x, y, text: "핵심 가치 및 비전", fontSize: 32 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 60, text: "우리는 사용자 경험을 최우선으로 생각합니다. 모든 기능은 깊은 고민 끝에 탄생했습니다.", fontSize: 16 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 90, text: "지속 가능한 성장을 위해 우리는 매일 혁신합니다. 기술은 도구일 뿐, 본질은 사람입니다.", fontSize: 16 },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 120, text: "함께 미래를 그려나갈 파트너를 찾고 있습니다. 지금 바로 문의해 주세요.", fontSize: 16 }
        ], '문단 영역');
    };

    const addImageBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 500, height: 300, color: '#e2e8f0' },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 320, text: "이미지에 대한 상세 설명이 여기에 들어갑니다.", fontSize: 14 }
        ], '이미지 영역');
    };

    const addFeatureBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            for (let i = 0; i < 3; i++) {
                const bx = x + (i * 240);
                blockNodes.push({ id: crypto.randomUUID(), type: 'CARD', x: bx, y, width: 220, height: 160, title: `특징 ${i + 1}`, content: "이 제품이 가진 핵심적인 장점을 간략하게 설명합니다." });
            }
            return blockNodes;
        }, '특징 모음');
    };

    const addPricingBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BOX', x, y, width: 300, height: 350, color: '#ffffff' },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 40, y: y + 40, text: "Premium Plan", fontSize: 24 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 40, y: y + 80, text: "₩ 29,900 / 월", fontSize: 36 },
            { id: crypto.randomUUID(), type: 'TEXT', x: x + 40, y: y + 140, text: "모든 고급 기능을 제한 없이 사용하세요.", fontSize: 14 },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 40, y: y + 260, width: 220, height: 50, text: "지금 구매하기", variant: 'primary' }
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
            blockNodes.push({ id: crypto.randomUUID(), type: 'BOX', x, y, width: 600, height: 250, color: 'transparent' }); // Container

            for (let i = 0; i < 5; i++) {
                const currentY = y + (i * 50);
                blockNodes.push({ id: crypto.randomUUID(), type: 'LINE', x, y: currentY, endX: x + 600, endY: currentY }); // Top border of row
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 20, y: currentY + 15, text: `항목 ${i + 1}`, fontSize: 16 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: x + 200, y: currentY + 15, text: `상세 스펙 값 ${i + 1}`, fontSize: 16 });
            }
            blockNodes.push({ id: crypto.randomUUID(), type: 'LINE', x, y: y + 250, endX: x + 600, endY: y + 250 }); // Bottom border of table
            return blockNodes;
        }, '스펙 표');
    };

    const addReviewBlock = () => {
        createBlockGroup((x, y) => {
            const blockNodes: CanvasNode[] = [];
            for (let i = 0; i < 3; i++) {
                const bx = x + (i * 240);
                blockNodes.push({ id: crypto.randomUUID(), type: 'BOX', x: bx, y, width: 220, height: 140, color: '#f8fafc' });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: bx + 20, y: y + 20, text: "⭐⭐⭐⭐⭐", fontSize: 16 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: bx + 20, y: y + 60, text: "정말 훌륭한 제품입니다!", fontSize: 14 });
                blockNodes.push({ id: crypto.randomUUID(), type: 'TEXT', x: bx + 20, y: y + 100, text: "홍길동", fontSize: 12 });
            }
            return blockNodes;
        }, '후기');
    };

    const addDividerTitleBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'LINE', x, y, endX: x + 800, endY: y },
            { id: crypto.randomUUID(), type: 'TEXT', x, y: y + 20, text: "새로운 섹션 제목", fontSize: 32 }
        ], '섹션 제목');
    };

    const addTwoButtonsBlock = () => {
        createBlockGroup((x, y) => [
            { id: crypto.randomUUID(), type: 'BUTTON', x, y, width: 160, height: 50, text: "구매하기", variant: 'primary' },
            { id: crypto.randomUUID(), type: 'BUTTON', x: x + 180, y, width: 160, height: 50, text: "문의하기", variant: 'secondary' }
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
