"use client";

import { snapToGrid } from "@/utils/snap";
import { useCanvasParams } from "@/hooks/useCanvasParams";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/context/EditorContext";
import { screenToWorld, worldToScreen } from "@/utils/coords";
import DimOverlay from "./DimOverlay";
import { CanvasNode } from "@/types";

export default function Canvas() {
    const { nodes, selectedNodeIds, selectNode, toggleSelection, setSelection, updateNode, updateMultipleNodes, deleteNode, deleteNodes, groupNodes, ungroupNodes, addNode, addNodes, toolMode, setToolMode, gridSize, paintLayer, paintLayerVisible, addPaint, removePaint, undo, redo, pushSnapshot, activeGroupId, setActiveGroupId } = useEditor();
    const {
        zoom,
        pan,
        setZoom,
        setPan,
        isPanning,
        isSpacePressed,
        handleWrapperMouseDown,
    } = useCanvasParams();

    const containerRef = useRef<HTMLDivElement>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    // Node Dragging State
    const [isDraggingNode, setIsDraggingNode] = useState(false);
    const dragRef = useRef<{
        nodeId: string;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
        nodesInitialPos: { id: string, x: number, y: number, endX?: number, endY?: number }[];
        historyRecorded?: boolean;
    } | null>(null);
    const [snapGuide, setSnapGuide] = useState<{
        x: number | null;
        y: number | null;
    }>({ x: null, y: null });
    const [dragHud, setDragHud] = useState<{
        x: number;
        y: number;
        screenX: number;
        screenY: number;
    } | null>(null);
    const [lastPointerScreenPos, setLastPointerScreenPos] = useState<{ x: number; y: number } | null>(null);
    const [showGrid, setShowGrid] = useState(true);
    const [showMajorGrid, setShowMajorGrid] = useState(true);
    const [isDeepCanvasMode, setIsDeepCanvasMode] = useState(false);
    const [isHudCollapsed, setIsHudCollapsed] = useState(false);
    const SNAP_GRID_SIZE = 10;
    const SNAP_THRESHOLD = 4;

    // Drawing State (Line/Arrow)
    const [drawingNodeId, setDrawingNodeId] = useState<string | null>(null);
    const [drawingStartPos, setDrawingStartPos] = useState<{ x: number, y: number } | null>(null);

    // Drawing State (Box)
    const [boxStartPos, setBoxStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null);

    // Marquee Selection State
    const [selectionStartPos, setSelectionStartPos] = useState<{ x: number, y: number } | null>(null);
    const [selectionEndPos, setSelectionEndPos] = useState<{ x: number, y: number } | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    // Painting State (Pencil/Eraser)
    const [isPainting, setIsPainting] = useState(false);

    // Text Editing State
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");
    const [editingFontSize, setEditingFontSize] = useState(14);
    const [editingFontFamily, setEditingFontFamily] = useState("JetBrains Mono");
    const [editingFontWeight, setEditingFontWeight] = useState<"normal" | "bold">("normal");
    const [editingTextAlign, setEditingTextAlign] = useState<"left" | "center" | "right">("left");
    const [editingTextColor, setEditingTextColor] = useState("#E2E8F0");
    const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const textMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [editingTextareaWidth, setEditingTextareaWidth] = useState(60);
    const [editingTextareaHeight, setEditingTextareaHeight] = useState(28);
    const [isResizingText, setIsResizingText] = useState(false);
    const textResizeRef = useRef<{
        nodeId: string;
        startX: number;
        startY: number;
        initialX: number;
        initialY: number;
        initialWidth: number;
        initialHeight: number;
        direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
        historyRecorded?: boolean;
    } | null>(null);
    const EDITING_PADDING_X = 8;
    const EDITING_PADDING_Y = 6;
    const SPAWN_GRID_SIZE = 10;
    const TEXT_BOX_DEFAULT_WIDTH = 140;
    const TEXT_BOX_DEFAULT_HEIGHT = 40;
    const TEXT_BOX_MIN_WIDTH = 80;
    const TEXT_BOX_MIN_HEIGHT = 36;
    const TEXT_RESIZE_HANDLE_SIZE = 10;
    const FONT_FAMILY_MAP: Record<string, string> = {
        "JetBrains Mono": 'var(--font-jetbrains-mono), "JetBrains Mono", monospace',
        "Noto Sans KR": 'var(--font-noto-sans-kr), "Noto Sans KR", sans-serif',
        "IBM Plex Sans KR": 'var(--font-ibm-plex-sans-kr), "IBM Plex Sans KR", sans-serif',
    };
    const LAST_WORK_KEY = "asmemo_last_work_pos";
    const TEXT_HIT_PADDING_X = 16;
    const TEXT_HIT_PADDING_Y = 10;
    const getTextMetrics = (text: string, fontSize = 16, fontFamily = "JetBrains Mono", fontWeight: "normal" | "bold" = "normal") => {
        if (!textMeasureCanvasRef.current) {
            textMeasureCanvasRef.current = document.createElement("canvas");
        }
        const context = textMeasureCanvasRef.current.getContext("2d");
        const lines = (text || " ").split("\n");
        const resolvedFontFamily = fontFamily === "Noto Sans KR"
            ? '"Noto Sans KR", sans-serif'
            : fontFamily === "IBM Plex Sans KR"
                ? '"IBM Plex Sans KR", sans-serif'
                : '"JetBrains Mono", monospace';
        if (!context) {
            return {
                width: Math.max(fontSize * 0.6, ...lines.map((line) => line.length * fontSize * 0.6)),
                height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2),
            };
        }

        context.font = `${fontWeight} ${fontSize}px ${resolvedFontFamily}`;
        const width = Math.max(
            fontSize * 0.6,
            ...lines.map((line) => context.measureText(line || " ").width)
        );
        const height = Math.max(fontSize * 1.2, lines.length * fontSize * 1.2);

        return { width, height };
    };
    const getTextLayout = (node: Extract<CanvasNode, { type: 'TEXT' }>) => {
        const metrics = getTextMetrics(
            node.text,
            node.fontSize || 16,
            (node as any).fontFamily || "JetBrains Mono",
            (node as any).fontWeight || "normal"
        );
        const naturalWidth = metrics.width + TEXT_HIT_PADDING_X;
        const naturalHeight = metrics.height + TEXT_HIT_PADDING_Y;
        const boxWidth = typeof node.width === 'number' ? node.width : Math.max(naturalWidth, TEXT_BOX_DEFAULT_WIDTH);
        const boxHeight = typeof node.height === 'number' ? node.height : Math.max(naturalHeight, TEXT_BOX_DEFAULT_HEIGHT);

        return {
            boxWidth,
            boxHeight,
            renderedFontSize: node.fontSize || 14,
        };
    };
    const getAutoSizedTextDimensions = (
        text: string,
        fontSize: number,
        fontFamily: string,
        fontWeight: "normal" | "bold",
        width?: number,
        height?: number
    ) => {
        const metrics = getTextMetrics(text, fontSize, fontFamily, fontWeight);
        return {
            width: Math.max(width ?? 0, metrics.width + TEXT_HIT_PADDING_X),
            height: Math.max(height ?? 0, metrics.height + TEXT_HIT_PADDING_Y),
        };
    };
    const syncEditingTextareaSize = () => {
        const textarea = editingTextareaRef.current;
        if (!textarea) return;

        const minWidth = Math.max(60, Math.ceil(TEXT_BOX_MIN_WIDTH * zoom));
        const minHeight = Math.max(28, Math.ceil(TEXT_BOX_MIN_HEIGHT * zoom));

        textarea.style.width = "0px";
        textarea.style.height = "0px";

        const nextWidth = Math.max(minWidth, Math.ceil(textarea.scrollWidth));
        const nextHeight = Math.max(minHeight, Math.ceil(textarea.scrollHeight));

        setEditingTextareaWidth(nextWidth);
        setEditingTextareaHeight(nextHeight);
    };
    const getNodeBounds = (node: CanvasNode): { x: number; y: number; width: number; height: number } => {
        if (node.type === 'TEXT') {
            const textLayout = getTextLayout(node);
            return {
                x: node.x,
                y: node.y,
                width: textLayout.boxWidth,
                height: textLayout.boxHeight,
            };
        }

        if (node.type === 'LINE' || node.type === 'ARROW') {
            const geometry = getLineGeometry(node);
            return {
                x: geometry.minX,
                y: geometry.minY,
                width: Math.max(geometry.maxX - geometry.minX, 1),
                height: Math.max(geometry.maxY - geometry.minY, 1),
            };
        }

        return {
            x: node.x,
            y: node.y,
            width: typeof node.width === 'number' ? node.width : 0,
            height: typeof node.height === 'number' ? node.height : 0,
        };
    };
    const getNodeCenter = (node: CanvasNode) => {
        const bounds = getNodeBounds(node);
        return {
            x: bounds.x + bounds.width / 2,
            y: bounds.y + bounds.height / 2,
        };
    };
    const getAnchorPointForBounds = (
        bounds: { x: number; y: number; width: number; height: number },
        targetPoint: { x: number; y: number }
    ) => {
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const dx = targetPoint.x - centerX;
        const dy = targetPoint.y - centerY;

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0
                ? { x: bounds.x + bounds.width, y: centerY }
                : { x: bounds.x, y: centerY };
        }

        return dy > 0
            ? { x: centerX, y: bounds.y + bounds.height }
            : { x: centerX, y: bounds.y };
    };
    const getLineGeometry = (node: Extract<CanvasNode, { type: 'LINE' | 'ARROW' }>) => {
        const cpOffset = 100;
        const startLinkedNode = node.startNodeId
            ? nodes.find((candidate) => candidate.id === node.startNodeId && candidate.type !== 'LINE' && candidate.type !== 'ARROW')
            : undefined;
        const endLinkedNode = node.endNodeId
            ? nodes.find((candidate) => candidate.id === node.endNodeId && candidate.type !== 'LINE' && candidate.type !== 'ARROW')
            : undefined;

        const startBounds = startLinkedNode ? getNodeBounds(startLinkedNode) : undefined;
        const endBounds = endLinkedNode ? getNodeBounds(endLinkedNode) : undefined;

        const startCenter = startBounds
            ? { x: startBounds.x + startBounds.width / 2, y: startBounds.y + startBounds.height / 2 }
            : { x: node.x, y: node.y };
        const endCenter = endBounds
            ? { x: endBounds.x + endBounds.width / 2, y: endBounds.y + endBounds.height / 2 }
            : { x: node.endX, y: node.endY };

        const startPoint = startBounds ? getAnchorPointForBounds(startBounds, endCenter) : startCenter;
        const endPoint = endBounds ? getAnchorPointForBounds(endBounds, startCenter) : endCenter;

        const dx = endCenter.x - startCenter.x;
        const dy = endCenter.y - startCenter.y;
        const isHorizontal = Math.abs(dx) > Math.abs(dy);
        const horizontalDirection = dx >= 0 ? 1 : -1;
        const verticalDirection = dy >= 0 ? 1 : -1;

        const cp1x = isHorizontal ? startPoint.x + cpOffset * horizontalDirection : startPoint.x;
        const cp1y = isHorizontal ? startPoint.y : startPoint.y + cpOffset * verticalDirection;
        const cp2x = isHorizontal ? endPoint.x - cpOffset * horizontalDirection : endPoint.x;
        const cp2y = isHorizontal ? endPoint.y : endPoint.y - cpOffset * verticalDirection;

        return {
            startPoint,
            endPoint,
            cp1: { x: cp1x, y: cp1y },
            cp2: { x: cp2x, y: cp2y },
            minX: Math.min(startPoint.x, endPoint.x, cp1x, cp2x),
            minY: Math.min(startPoint.y, endPoint.y, cp1y, cp2y),
            maxX: Math.max(startPoint.x, endPoint.x, cp1x, cp2x),
            maxY: Math.max(startPoint.y, endPoint.y, cp1y, cp2y),
        };
    };
    const findConnectableNodeAt = (worldX: number, worldY: number, excludeIds: string[] = []) =>
        [...nodes].reverse().find((node) => {
            if (excludeIds.includes(node.id)) return false;
            if (node.type === 'LINE' || node.type === 'ARROW') return false;
            const bounds = getNodeBounds(node);
            return (
                worldX >= bounds.x &&
                worldX <= bounds.x + bounds.width &&
                worldY >= bounds.y &&
                worldY <= bounds.y + bounds.height
            );
        });
    const recordLastWorkPos = (x: number, y: number) => {
        try {
            localStorage.setItem(LAST_WORK_KEY, JSON.stringify({ x, y, t: Date.now() }));
            window.dispatchEvent(new CustomEvent("asmemo:last-work-updated"));
        } catch {
            // ignore storage errors
        }
    };

    const worldLeft = (0 - pan.x) / zoom;
    const worldTop = (0 - pan.y) / zoom;
    const worldRight = (viewportSize.width - pan.x) / zoom;
    const worldBottom = (viewportSize.height - pan.y) / zoom;

    const minorSpacing = 10;
    const majorSpacing = 100;

    const maxGridLines = 400;
    const getLineCount = (minor: number, major: number) => {
        const minorCountX = Math.ceil((worldRight - worldLeft) / minor) + 1;
        const minorCountY = Math.ceil((worldBottom - worldTop) / minor) + 1;
        const majorCountX = Math.ceil((worldRight - worldLeft) / major) + 1;
        const majorCountY = Math.ceil((worldBottom - worldTop) / major) + 1;
        return minorCountX + minorCountY + majorCountX + majorCountY;
    };
    // Keep spacing fixed (minor 10, major 100) for CAD-like consistency.

    const startMinorX = Math.floor(worldLeft / minorSpacing) * minorSpacing;
    const endMinorX = Math.ceil(worldRight / minorSpacing) * minorSpacing;
    const startMinorY = Math.floor(worldTop / minorSpacing) * minorSpacing;
    const endMinorY = Math.ceil(worldBottom / minorSpacing) * minorSpacing;

    const startMajorX = Math.floor(worldLeft / majorSpacing) * majorSpacing;
    const endMajorX = Math.ceil(worldRight / majorSpacing) * majorSpacing;
    const startMajorY = Math.floor(worldTop / majorSpacing) * majorSpacing;
    const endMajorY = Math.ceil(worldBottom / majorSpacing) * majorSpacing;

    const minorVerticalLines: number[] = [];
    for (let x = startMinorX; x <= endMinorX; x += minorSpacing) {
        minorVerticalLines.push(x);
    }
    const minorHorizontalLines: number[] = [];
    for (let y = startMinorY; y <= endMinorY; y += minorSpacing) {
        minorHorizontalLines.push(y);
    }
    const majorVerticalLines: number[] = [];
    for (let x = startMajorX; x <= endMajorX; x += majorSpacing) {
        majorVerticalLines.push(x);
    }
    const majorHorizontalLines: number[] = [];
    for (let y = startMajorY; y <= endMajorY; y += majorSpacing) {
        majorHorizontalLines.push(y);
    }

    const getSpawnWorldPos = (container: HTMLDivElement, screenPos?: { x: number; y: number }) => {
        const baseScreenPos = screenPos || lastPointerScreenPos || {
            x: container.clientWidth / 2,
            y: container.clientHeight / 2,
        };

        let world = screenToWorld(baseScreenPos, pan, zoom);

        const selectedFrame = nodes.find(
            (n): n is CanvasNode & { type: 'FRAME'; width: number; height: number } =>
                n.type === 'FRAME' && selectedNodeIds.includes(n.id)
        );

        if (selectedFrame) {
            const margin = 40;
            const minX = selectedFrame.x + margin;
            const minY = selectedFrame.y + margin;
            const maxX = selectedFrame.x + selectedFrame.width - margin;
            const maxY = selectedFrame.y + selectedFrame.height - margin;
            world = {
                x: Math.max(minX, Math.min(world.x, Math.max(minX, maxX))),
                y: Math.max(minY, Math.min(world.y, Math.max(minY, maxY))),
            };
        }

        return {
            x: snapToGrid(world.x, SPAWN_GRID_SIZE),
            y: snapToGrid(world.y, SPAWN_GRID_SIZE),
        };
    };

    useEffect(() => {
        if (!editingNodeId) return;
        const textarea = editingTextareaRef.current;
        if (!textarea) return;

        textarea.focus();
        const end = textarea.value.length;
        textarea.setSelectionRange(end, end);
        syncEditingTextareaSize();
    }, [editingNodeId]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            setViewportSize({
                width: container.clientWidth,
                height: container.clientHeight,
            });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const readGridSettings = () => {
            try {
                const storedShowGrid = localStorage.getItem("asmemo_show_grid");
                const storedShowMajor = localStorage.getItem("asmemo_show_major_grid");
                const storedDeepCanvasMode = localStorage.getItem("asmemo_deep_canvas_mode");
                const nextShowGrid = storedShowGrid === null ? true : storedShowGrid === "true";
                const nextShowMajor = storedShowMajor === null ? true : storedShowMajor === "true";
                setShowGrid(nextShowGrid);
                setShowMajorGrid(nextShowGrid ? nextShowMajor : false);
                setIsDeepCanvasMode(storedDeepCanvasMode === "true");
            } catch {
                setShowGrid(true);
                setShowMajorGrid(true);
                setIsDeepCanvasMode(false);
            }
        };

        readGridSettings();
        window.addEventListener("storage", readGridSettings);
        window.addEventListener("asmemo:grid-settings-changed", readGridSettings as EventListener);
        window.addEventListener("asmemo:canvas-view-settings-changed", readGridSettings as EventListener);
        return () => {
            window.removeEventListener("storage", readGridSettings);
            window.removeEventListener("asmemo:grid-settings-changed", readGridSettings as EventListener);
            window.removeEventListener("asmemo:canvas-view-settings-changed", readGridSettings as EventListener);
        };
    }, []);

    useEffect(() => {
        if (!editingNodeId) return;
        const editingNode = nodes.find(n => n.id === editingNodeId);
        if (editingNode?.type === 'TEXT') {
            setEditingFontSize(editingNode.fontSize || 14);
            setEditingFontFamily((editingNode as any).fontFamily || "JetBrains Mono");
            setEditingFontWeight((editingNode as any).fontWeight || "normal");
            setEditingTextAlign((editingNode as any).textAlign || "left");
            setEditingTextColor((editingNode as any).textColor || "#E2E8F0");
        }
    }, [editingNodeId, nodes]);

    useEffect(() => {
        if (!editingNodeId) return;
        syncEditingTextareaSize();
    }, [editingNodeId, editingText, editingFontSize, editingFontFamily, editingFontWeight, zoom]);

    // Start Editing or Enter Group
    const handleDoubleClick = (e: React.MouseEvent, node: CanvasNode) => {
        e.stopPropagation();
        if (node.locked) return;
        if (node.type === 'TEXT') {
            if (activeGroupId && node.groupId === activeGroupId) {
                // In group edit mode, keep double-click for selection/move workflow.
                selectNode(node.id);
                return;
            }
            if (!node.fontSize) {
                updateNode(node.id, { fontSize: 14 }, true);
            }
            if (!(node as any).fontFamily) {
                updateNode(node.id, { fontFamily: "JetBrains Mono" } as any, true);
            }
            if (!(node as any).fontWeight) {
                updateNode(node.id, { fontWeight: "normal" } as any, true);
            }
            if (!(node as any).textColor) {
                updateNode(node.id, { textColor: "#E2E8F0" } as any, true);
            }
            if (!(node as any).textAlign) {
                updateNode(node.id, { textAlign: "left" } as any, true);
            }
            if (!(node as any).verticalAlign) {
                updateNode(node.id, { verticalAlign: "top" } as any, true);
            }
            setEditingNodeId(node.id);
            setEditingText(node.text);
            setEditingFontSize(node.fontSize || 14);
            setEditingFontFamily((node as any).fontFamily || "JetBrains Mono");
            setEditingFontWeight((node as any).fontWeight || "normal");
            setEditingTextAlign((node as any).textAlign || "left");
            setEditingTextColor((node as any).textColor || "#E2E8F0");
            setIsDraggingNode(false); // Cancel drag if any
        } else if (node.type === 'GROUP') {
            // Enter group edit mode
            setActiveGroupId(node.id);
            setSelection([]); // Clear selection when entering group
        }
    };

    const startNodeDrag = (e: React.PointerEvent, node: CanvasNode) => {
        if (isSpacePressed || e.button === 1 || node.locked) return;
        if (node.type === 'TEXT' && editingNodeId === node.id) return;
        e.stopPropagation();

        if (toolMode === 'line' || toolMode === 'arrow') {
            const startPoint = getNodeCenter(node);
            const newNode: any = {
                id: crypto.randomUUID(),
                type: toolMode === 'line' ? 'LINE' : 'ARROW',
                x: startPoint.x,
                y: startPoint.y,
                endX: startPoint.x,
                endY: startPoint.y,
                startNodeId: node.id,
            };
            addNode(newNode);
            setDrawingNodeId(newNode.id);
            setDrawingStartPos(startPoint);
            return;
        }

        console.log("startNodeDrag on node:", node.id, node.type);

        let targetNode = node;
        // Outside group edit mode, dragging a child drags the parent group.
        // Inside group edit mode, dragging should affect the child itself.
        if (!activeGroupId && node.groupId) {
            const groupParent = nodes.find(n => n.id === node.groupId);
            if (groupParent) {
                targetNode = groupParent;
            }
        }

        if (activeGroupId) {
            // In group edit mode, only direct children of active group are editable.
            if (node.groupId !== activeGroupId) {
                return;
            }
            targetNode = node;
        }

        const isSelected = selectedNodeIds.includes(targetNode.id);
        if (e.shiftKey) {
            toggleSelection(targetNode.id);
        } else {
            if (!isSelected) {
                selectNode(targetNode.id);
            }
        }
        setIsDraggingNode(true);

        let childrenPos: any[] = [];
        if (targetNode.type === 'GROUP') {
            const children = nodes.filter(n => n.groupId === targetNode.id);
            childrenPos = children.map(c => ({
                id: c.id,
                x: c.x,
                y: c.y,
                endX: (c as any).endX,
                endY: (c as any).endY
            }));
        }

        if (e.altKey) {
            if (targetNode.type === "GROUP") {
                const subtree: CanvasNode[] = [];
                const queue: string[] = [targetNode.id];
                const visited = new Set<string>();

                while (queue.length > 0) {
                    const currentId = queue.shift()!;
                    if (visited.has(currentId)) continue;
                    visited.add(currentId);

                    const currentNode = nodes.find((n) => n.id === currentId);
                    if (!currentNode) continue;
                    subtree.push(currentNode);

                    const children = nodes.filter((n) => n.groupId === currentId);
                    for (const child of children) queue.push(child.id);
                }

                const idMap = new Map<string, string>(
                    subtree.map((n) => [n.id, crypto.randomUUID()])
                );

                const clonedSubtree = subtree.map((n) => {
                    const clone = (typeof structuredClone === "function"
                        ? structuredClone(n)
                        : JSON.parse(JSON.stringify(n))) as any;
                    clone.id = idMap.get(n.id);
                    if (clone.groupId && idMap.has(clone.groupId)) {
                        clone.groupId = idMap.get(clone.groupId);
                    }
                    if (clone.startNodeId && idMap.has(clone.startNodeId)) {
                        clone.startNodeId = idMap.get(clone.startNodeId);
                    }
                    if (clone.endNodeId && idMap.has(clone.endNodeId)) {
                        clone.endNodeId = idMap.get(clone.endNodeId);
                    }
                    return clone as CanvasNode;
                });

                const clonedRootId = idMap.get(targetNode.id)!;
                const clonedRoot = clonedSubtree.find((n) => n.id === clonedRootId)!;
                const clonedChildrenPos = clonedSubtree
                    .filter((n) => n.groupId === clonedRootId)
                    .map((c) => ({
                        id: c.id,
                        x: c.x,
                        y: c.y,
                        endX: (c as any).endX,
                        endY: (c as any).endY,
                    }));

                addNodes(clonedSubtree as any);
                selectNode(clonedRoot.id);

                dragRef.current = {
                    nodeId: clonedRoot.id,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialX: clonedRoot.x,
                    initialY: clonedRoot.y,
                    nodesInitialPos: [
                        {
                            id: clonedRoot.id,
                            x: clonedRoot.x,
                            y: clonedRoot.y,
                            endX: (clonedRoot as any).endX,
                            endY: (clonedRoot as any).endY,
                        },
                        ...clonedChildrenPos,
                    ],
                };
                return;
            }

            const clonedNode = {
                ...(typeof structuredClone === "function"
                    ? structuredClone(targetNode)
                    : JSON.parse(JSON.stringify(targetNode))),
                id: crypto.randomUUID(),
            } as CanvasNode;

            addNode(clonedNode as any);
            selectNode(clonedNode.id);

            dragRef.current = {
                nodeId: clonedNode.id,
                startX: e.clientX,
                startY: e.clientY,
                initialX: clonedNode.x,
                initialY: clonedNode.y,
                nodesInitialPos: [
                    {
                        id: clonedNode.id,
                        x: clonedNode.x,
                        y: clonedNode.y,
                        endX: (clonedNode as any).endX,
                        endY: (clonedNode as any).endY,
                    },
                ],
            };
            return;
        }

        dragRef.current = {
            nodeId: targetNode.id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: targetNode.x,
            initialY: targetNode.y,
            nodesInitialPos: [
                { id: targetNode.id, x: targetNode.x, y: targetNode.y, endX: (targetNode as any).endX, endY: (targetNode as any).endY },
                ...childrenPos
            ]
        };
    };
    const startTextResize = (
        e: React.PointerEvent,
        node: Extract<CanvasNode, { type: 'TEXT' }>,
        direction: "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"
    ) => {
        if (node.locked) return;
        e.stopPropagation();
        e.preventDefault();

        const textLayout = getTextLayout(node);
        selectNode(node.id);
        setIsResizingText(true);
        textResizeRef.current = {
            nodeId: node.id,
            startX: e.clientX,
            startY: e.clientY,
            initialX: node.x,
            initialY: node.y,
            initialWidth: textLayout.boxWidth,
            initialHeight: textLayout.boxHeight,
            direction,
        };
    };

    // Save Text
    const saveText = () => {
        if (editingNodeId) {
            if (!editingText.trim()) {
                deleteNode(editingNodeId);
            } else {
                const existingNode = nodes.find((n) => n.id === editingNodeId);
                if (existingNode?.type === 'TEXT') {
                    const textarea = editingTextareaRef.current;
                    const measuredWidth = textarea
                        ? Math.ceil(textarea.scrollWidth / zoom)
                        : undefined;
                    const measuredHeight = textarea
                        ? Math.ceil(textarea.scrollHeight / zoom)
                        : undefined;
                    const nextSize = getAutoSizedTextDimensions(
                        editingText,
                        editingFontSize,
                        editingFontFamily,
                        editingFontWeight,
                        measuredWidth,
                        measuredHeight
                    );
                    updateNode(editingNodeId, {
                        text: editingText,
                        fontSize: editingFontSize,
                        fontFamily: editingFontFamily as any,
                        fontWeight: editingFontWeight,
                        textColor: editingTextColor,
                        textAlign: editingTextAlign,
                        width: nextSize.width,
                        height: nextSize.height,
                    } as any);
                } else {
                    updateNode(editingNodeId, { text: editingText });
                }
            }
            setEditingNodeId(null);
            setEditingText("");
            setToolMode('select');
        }
    };

    // Global Hotkeys
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // If editing text, ignore global shortcuts (except if we handled it in textarea and stopped prop, but this is a safety check)
            if (editingNodeId) return;

            if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedNodeIds.length > 0 && !editingNodeId) {
                    deleteNodes(selectedNodeIds);
                }
            }

            if (e.key === "Escape" && activeGroupId) {
                e.preventDefault();
                const currentGroup = nodes.find(n => n.id === activeGroupId && n.type === 'GROUP');
                setActiveGroupId(currentGroup?.groupId || null);
                setSelection([]);
                return;
            }

            if (!e.metaKey && !e.ctrlKey && !e.altKey) {
                if (e.code === 'KeyT') {
                    e.preventDefault();
                    setToolMode('text');
                    return;
                }

                if (e.code === 'KeyV') {
                    e.preventDefault();
                    setToolMode('select');
                    return;
                }
            }

            // Undo/Redo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            }
            // Redo alternative
            if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
            // Grouping selected nodes
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (e.shiftKey) {
                    ungroupNodes();
                } else {
                    groupNodes();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedNodeIds, deleteNodes, editingNodeId, activeGroupId, nodes, setActiveGroupId, setSelection, setToolMode, groupNodes, ungroupNodes, undo, redo]);

    // Dragging & Drawing Logic
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (textResizeRef.current && isResizingText) {
                const { nodeId, startX, startY, initialX, initialY, initialWidth, initialHeight, direction } = textResizeRef.current;
                const deltaWorldX = (e.clientX - startX) / zoom;
                const deltaWorldY = (e.clientY - startY) / zoom;

                if (!textResizeRef.current.historyRecorded) {
                    pushSnapshot();
                    textResizeRef.current.historyRecorded = true;
                }

                let nextX = initialX;
                let nextY = initialY;
                let nextWidth = initialWidth;
                let nextHeight = initialHeight;

                if (direction.includes("e")) {
                    nextWidth = Math.max(TEXT_BOX_MIN_WIDTH, initialWidth + deltaWorldX);
                }
                if (direction.includes("s")) {
                    nextHeight = Math.max(TEXT_BOX_MIN_HEIGHT, initialHeight + deltaWorldY);
                }
                if (direction.includes("w")) {
                    nextWidth = Math.max(TEXT_BOX_MIN_WIDTH, initialWidth - deltaWorldX);
                    nextX = initialX + (initialWidth - nextWidth);
                }
                if (direction.includes("n")) {
                    nextHeight = Math.max(TEXT_BOX_MIN_HEIGHT, initialHeight - deltaWorldY);
                    nextY = initialY + (initialHeight - nextHeight);
                }

                updateNode(nodeId, {
                    x: nextX,
                    y: nextY,
                    width: nextWidth,
                    height: nextHeight,
                }, true);
                return;
            }

            if (isPainting) {
                if (isSpacePressed) return; // Spacebar priority

                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                let worldX = (mouseX - pan.x) / zoom;
                let worldY = (mouseY - pan.y) / zoom;

                const cellX = Math.round(worldX / gridSize);
                const cellY = Math.round(worldY / gridSize);
                const key = `${cellX},${cellY}`;

                if (toolMode === 'pencil') {
                    addPaint(key, true);
                } else if (toolMode === 'eraser') {
                    removePaint(key, true);
                }
                return;
            }

            // Handle Marquee Selection
            if (isSelecting && selectionStartPos) {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const worldX = (mouseX - pan.x) / zoom;
                const worldY = (mouseY - pan.y) / zoom;

                setSelectionEndPos({ x: worldX, y: worldY });
                return;
            }

            // Handle Box Drawing Preview
            if (boxStartPos) {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                let worldX = (mouseX - pan.x) / zoom;
                let worldY = (mouseY - pan.y) / zoom;

                if (!e.shiftKey) {
                    worldX = snapToGrid(worldX, gridSize);
                    worldY = snapToGrid(worldY, gridSize);
                }
                setCurrentMousePos({ x: worldX, y: worldY });
                return;
            }

            // Handle Drawing (Line/Arrow)
            if (drawingNodeId && drawingStartPos) {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                let worldX = (mouseX - pan.x) / zoom;
                let worldY = (mouseY - pan.y) / zoom;

                if (e.shiftKey) {
                    // Angle Snapping (0, 45, 90)
                    const dx = worldX - drawingStartPos.x;
                    const dy = worldY - drawingStartPos.y;
                    const angle = Math.atan2(dy, dx);
                    const snapAngle = Math.PI / 4; // 45 degrees
                    const roundedAngle = Math.round(angle / snapAngle) * snapAngle;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    worldX = drawingStartPos.x + distance * Math.cos(roundedAngle);
                    worldY = drawingStartPos.y + distance * Math.sin(roundedAngle);
                } else {
                    // Grid Snapping
                    worldX = snapToGrid(worldX, gridSize);
                    worldY = snapToGrid(worldY, gridSize);
                }

                updateNode(drawingNodeId, {
                    endX: worldX,
                    endY: worldY,
                }, true);
                return; // Skip dragging logic if drawing
            }

            // Handle Dragging
            if (dragRef.current && isDraggingNode) {
                const { startX, startY, nodesInitialPos } = dragRef.current;

                const deltaWorldX = (e.clientX - startX) / zoom;
                const deltaWorldY = (e.clientY - startY) / zoom;

                console.log("Dragging node:", dragRef.current.nodeId, "deltaWorld:", deltaWorldX, deltaWorldY);

                const targetNode = nodes.find(n => n.id === dragRef.current?.nodeId);
                // Restrict drag inside activeGroupId: Only direct children allowed
                if (targetNode && activeGroupId) {
                    if (targetNode.groupId !== activeGroupId) {
                        return;
                    }
                }

                if (!dragRef.current.historyRecorded) {
                    pushSnapshot();
                    dragRef.current.historyRecorded = true;
                }

                // Node 0 is the dragged node
                const mainNodeInitial = nodesInitialPos[0];
                let effectiveDeltaX = deltaWorldX;
                let effectiveDeltaY = deltaWorldY;
                let snappedMainX = mainNodeInitial.x + deltaWorldX;
                let snappedMainY = mainNodeInitial.y + deltaWorldY;
                let snappedOnX = false;
                let snappedOnY = false;

                if (!e.shiftKey) {
                    const nearestX = Math.round(snappedMainX / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;
                    const nearestY = Math.round(snappedMainY / SNAP_GRID_SIZE) * SNAP_GRID_SIZE;

                    if (Math.abs(snappedMainX - nearestX) <= SNAP_THRESHOLD) {
                        snappedMainX = nearestX;
                        snappedOnX = true;
                    }
                    if (Math.abs(snappedMainY - nearestY) <= SNAP_THRESHOLD) {
                        snappedMainY = nearestY;
                        snappedOnY = true;
                    }

                    effectiveDeltaX = snappedMainX - mainNodeInitial.x;
                    effectiveDeltaY = snappedMainY - mainNodeInitial.y;
                }

                const updates: { id: string; changes: Partial<CanvasNode> }[] = nodesInitialPos.map(ip => ({
                    id: ip.id,
                    changes: {
                        x: ip.x + effectiveDeltaX,
                        y: ip.y + effectiveDeltaY,
                        ...(ip.endX !== undefined ? { endX: ip.endX + effectiveDeltaX } : {}),
                        ...(ip.endY !== undefined ? { endY: ip.endY + effectiveDeltaY } : {})
                    }
                }));
                const draggedNode = nodes.find((n) => n.id === dragRef.current?.nodeId);
                const parentGroupId = draggedNode?.groupId;
                const nextUpdates: { id: string; changes: Partial<CanvasNode> }[] = [...updates];

                if (parentGroupId) {
                    const PADDING = 30;
                    const updatesMap = new Map(
                        updates.map((u) => [u.id, u.changes] as const)
                    );

                    const groupChildren = nodes.filter(
                        (n) => n.groupId === parentGroupId && n.id !== parentGroupId
                    );

                    let minX = Infinity;
                    let minY = Infinity;
                    let maxX = -Infinity;
                    let maxY = -Infinity;

                    for (const child of groupChildren) {
                        const childBounds = getNodeBounds(child);
                        const override = updatesMap.get(child.id);
                        const overrideAny = override as any;
                        const nextX = typeof override?.x === "number" ? override.x : childBounds.x;
                        const nextY = typeof override?.y === "number" ? override.y : childBounds.y;
                        const nextEndX = typeof overrideAny?.endX === "number" ? overrideAny.endX : (child as any).endX;
                        const nextEndY = typeof overrideAny?.endY === "number" ? overrideAny.endY : (child as any).endY;

                        if (child.type === "LINE" || child.type === "ARROW") {
                            const lineMinX = Math.min(nextX, nextEndX ?? nextX);
                            const lineMinY = Math.min(nextY, nextEndY ?? nextY);
                            const lineMaxX = Math.max(nextX, nextEndX ?? nextX);
                            const lineMaxY = Math.max(nextY, nextEndY ?? nextY);
                            minX = Math.min(minX, lineMinX);
                            minY = Math.min(minY, lineMinY);
                            maxX = Math.max(maxX, lineMaxX);
                            maxY = Math.max(maxY, lineMaxY);
                        } else {
                            minX = Math.min(minX, nextX);
                            minY = Math.min(minY, nextY);
                            maxX = Math.max(maxX, nextX + childBounds.width);
                            maxY = Math.max(maxY, nextY + childBounds.height);
                        }
                    }

                    if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY)) {
                        nextUpdates.push({
                            id: parentGroupId,
                            changes: {
                                x: minX - PADDING,
                                y: minY - PADDING,
                                width: (maxX - minX) + PADDING * 2,
                                height: Math.max(0, maxY - minY) + PADDING * 2,
                            },
                        });
                    }
                }

                updateMultipleNodes(nextUpdates, true);
                recordLastWorkPos(snappedMainX, snappedMainY);

                const hudScreen = worldToScreen(
                    { x: snappedMainX, y: snappedMainY, width: 0, height: 0 },
                    pan,
                    zoom
                );
                setDragHud({
                    x: Math.round(snappedMainX),
                    y: Math.round(snappedMainY),
                    screenX: hudScreen.x + 12,
                    screenY: hudScreen.y - 28,
                });
                setSnapGuide({
                    x: snappedOnX ? snappedMainX : null,
                    y: snappedOnY ? snappedMainY : null,
                });
            }
        };

        const handlePointerUp = (e: PointerEvent) => { // Added e argument

            if (boxStartPos && currentMousePos) {
                // Finalize Box Creation
                const x = Math.min(boxStartPos.x, currentMousePos.x);
                const y = Math.min(boxStartPos.y, currentMousePos.y);
                const width = Math.abs(currentMousePos.x - boxStartPos.x);
                const height = Math.abs(currentMousePos.y - boxStartPos.y);

                if (width > 0 && height > 0) {
                    const newNode: any = {
                        id: crypto.randomUUID(),
                        type: 'BOX',
                        x,
                        y,
                        width: Math.max(width, gridSize), // Ensure min width
                        height: Math.max(height, gridSize), // Ensure min height
                        color: 'transparent',
                    };
                    addNode(newNode);
                }
                setBoxStartPos(null);
                setCurrentMousePos(null);
                setToolMode('select');
            } else if (boxStartPos) {
                // Mouse up without move? Maybe click-to-create fallback or just cancel
                setBoxStartPos(null);
                setCurrentMousePos(null);
                // Optional: fallback to default size if just a click?
                // User asked for "drag to draw", let's strictly follow that. 
                // If dragging didn't happen (width/height 0), we do nothing or default.
                // Let's fallback to default size for better UX if user just clicks.
                const newNode: any = {
                    id: crypto.randomUUID(),
                    type: 'BOX',
                    x: boxStartPos.x,
                    y: boxStartPos.y,
                    width: 100,
                    height: 100,
                    color: 'transparent',
                    // Default to transparent
                };
                addNode(newNode);
                setToolMode('select');
            }

            if (drawingNodeId) {
                const container = containerRef.current;
                if (container) {
                    const drawingNode = nodes.find((node) => node.id === drawingNodeId);
                    const drawingStartNodeId = drawingNode && (drawingNode.type === 'LINE' || drawingNode.type === 'ARROW')
                        ? drawingNode.startNodeId || ""
                        : "";
                    const rect = container.getBoundingClientRect();
                    const mouseX = e.clientX - rect.left;
                    const mouseY = e.clientY - rect.top;
                    const worldX = (mouseX - pan.x) / zoom;
                    const worldY = (mouseY - pan.y) / zoom;

                    const targetNode = findConnectableNodeAt(worldX, worldY, [drawingNodeId, drawingStartNodeId]);

                    if (targetNode) {
                        const endPoint = getNodeCenter(targetNode);
                        updateNode(drawingNodeId, { endNodeId: targetNode.id, endX: endPoint.x, endY: endPoint.y });
                    } else {
                        updateNode(drawingNodeId, { endX: worldX, endY: worldY });
                    }
                }
                setDrawingNodeId(null);
                setDrawingStartPos(null);
                setToolMode('select');
            }
            if (isPainting) {
                setIsPainting(false);
                // Don't reset toolMode for pencil/eraser to allow continuous drawing
            }
            if (textResizeRef.current) {
                textResizeRef.current = null;
                setIsResizingText(false);
            }
            if (dragRef.current) {
                const draggedNode = nodes.find((node) => node.id === dragRef.current?.nodeId);
                if (draggedNode && draggedNode.type !== 'LINE' && draggedNode.type !== 'ARROW') {
                    const draggedBounds = getNodeBounds(draggedNode);
                    const targetNode = [...nodes].reverse().find((node) => {
                        if (node.id === draggedNode.id) return false;
                        if (node.type === 'LINE' || node.type === 'ARROW') return false;
                        if (draggedNode.groupId && node.groupId && draggedNode.groupId === node.groupId) return false;
                        if (draggedNode.type === 'GROUP' && node.groupId === draggedNode.id) return false;
                        if (node.type === 'GROUP' && draggedNode.groupId === node.id) return false;

                        const targetBounds = getNodeBounds(node);
                        return (
                            draggedBounds.x < targetBounds.x + targetBounds.width &&
                            draggedBounds.x + draggedBounds.width > targetBounds.x &&
                            draggedBounds.y < targetBounds.y + targetBounds.height &&
                            draggedBounds.y + draggedBounds.height > targetBounds.y
                        );
                    });

                    if (targetNode && (e.metaKey || e.ctrlKey || e.shiftKey)) {
                        const startNodeId = dragRef.current.nodeId;
                        const endNodeId = targetNode.id;
                        const hasLineBetweenNodes = nodes.some((node) =>
                            node.type === 'LINE' &&
                            (
                                (node.startNodeId === startNodeId && node.endNodeId === endNodeId) ||
                                (node.startNodeId === endNodeId && node.endNodeId === startNodeId)
                            )
                        );
                        const hasArrowInDirection = nodes.some((node) =>
                            node.type === 'ARROW' &&
                            node.startNodeId === startNodeId &&
                            node.endNodeId === endNodeId
                        );
                        const shouldCreateArrow = e.shiftKey && !hasArrowInDirection;
                        const shouldCreateLine = !e.shiftKey && !hasLineBetweenNodes;

                        if (shouldCreateLine || shouldCreateArrow) {
                            const draggedCenter = getNodeCenter(draggedNode);
                            const targetCenter = getNodeCenter(targetNode);
                            addNode({
                                id: crypto.randomUUID(),
                                type: shouldCreateArrow ? 'ARROW' : 'LINE',
                                x: draggedCenter.x,
                                y: draggedCenter.y,
                                endX: targetCenter.x,
                                endY: targetCenter.y,
                                startNodeId,
                                endNodeId,
                            } as any);
                        }

                        if (shouldCreateLine || shouldCreateArrow) {
                            const restoreUpdates = dragRef.current.nodesInitialPos.map((ip) => ({
                                id: ip.id,
                                changes: {
                                    x: ip.x,
                                    y: ip.y,
                                    ...(ip.endX !== undefined ? { endX: ip.endX } : {}),
                                    ...(ip.endY !== undefined ? { endY: ip.endY } : {}),
                                } as Partial<CanvasNode>,
                            }));
                            updateMultipleNodes(restoreUpdates, true);
                        }
                    }
                }
                dragRef.current = null;
                setIsDraggingNode(false);
                setSnapGuide({ x: null, y: null });
                setDragHud(null);
            }

            // Finalize Marquee Selection
            if (isSelecting && selectionStartPos && selectionEndPos) {
                const x = Math.min(selectionStartPos.x, selectionEndPos.x);
                const y = Math.min(selectionStartPos.y, selectionEndPos.y);
                const width = Math.abs(selectionEndPos.x - selectionStartPos.x);
                const height = Math.abs(selectionEndPos.y - selectionStartPos.y);

                const newSelectedIds: string[] = [];

                if (width > 0 && height > 0) {
                    nodes.forEach(node => {
                        if (node.visible === false || node.locked) return;

                        if (activeGroupId && node.groupId !== activeGroupId) return; // Only select children of active group

                        // Quick bounding box check
                        const bounds = getNodeBounds(node);
                        const nodeX = bounds.x;
                        const nodeY = bounds.y;
                        const nodeW = bounds.width;
                        const nodeH = bounds.height;

                        // Check intersection
                        if (
                            x < nodeX + nodeW &&
                            x + width > nodeX &&
                            y < nodeY + nodeH &&
                            y + height > nodeY
                        ) {
                            newSelectedIds.push(node.id);
                        }
                    });
                }

                // Handle shift key addition
                if (e.shiftKey) {
                    // Add new selections to existing ones, avoid duplicates
                    const combined = new Set([...selectedNodeIds, ...newSelectedIds]);
                    // Only if we actually selected something? 
                    // Or if we selected nothing, do we keep previous? Yes.
                    if (newSelectedIds.length > 0) {
                        setSelection(Array.from(combined));
                    }
                } else {
                    if (newSelectedIds.length > 0) {
                        setSelection(newSelectedIds);
                    } else {
                        // Clicked on empty space with no drag or drag wrapped nothing -> clear selection
                        // BUT: if it was a tiny click (no drag), we might want to clear.
                        // Here we are in handlePointerUp. If start/end diff is small, it's a click.
                        // The logic below for "click to clear" handles the 0 dragging case usually.
                        // But if user dragged and selected nothing, it should clear.
                        setSelection([]);
                    }
                }

                setIsSelecting(false);
                setSelectionStartPos(null);
                setSelectionEndPos(null);
            } else if (isSelecting) {
                // Was selecting but no end pos means just a click
                if (!e.shiftKey) {
                    setSelection([]);
                }
                setIsSelecting(false);
                setSelectionStartPos(null);
                setSelectionEndPos(null);
            }
        };

        if (isDraggingNode || drawingNodeId || boxStartPos || isPainting || isSelecting || isResizingText) {
            console.log("Attaching event listeners. isDraggingNode:", isDraggingNode);
            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp);
        }

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [isDraggingNode, drawingNodeId, zoom, pan, updateNode, updateMultipleNodes, setToolMode, boxStartPos, currentMousePos, gridSize, addNode, drawingStartPos, isPainting, toolMode, addPaint, removePaint, isSpacePressed, isSelecting, selectionStartPos, selectionEndPos, nodes, selectedNodeIds, setSelection, dragRef, activeGroupId, pushSnapshot, isResizingText]);

    // Refs to store latest state
    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);

    useEffect(() => {
        zoomRef.current = zoom;
        panRef.current = pan;
    }, [zoom, pan]);

    // Wheel event handler
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            const currentZoom = zoomRef.current;
            const currentPan = panRef.current;

            if (e.ctrlKey) {
                // Pinch to Zoom
                const zoomSensitivity = 0.005;
                const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
                const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.2), 4.0);

                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const worldX = (mouseX - currentPan.x) / currentZoom;
                const worldY = (mouseY - currentPan.y) / currentZoom;

                const newPanX = mouseX - worldX * newZoom;
                const newPanY = mouseY - worldY * newZoom;

                setZoom(newZoom);
                setPan({ x: newPanX, y: newPanY });

            } else {
                // Pan
                const newPanX = currentPan.x - e.deltaX;
                const newPanY = currentPan.y - e.deltaY;
                setPan({ x: newPanX, y: newPanY });
            }
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            container.removeEventListener("wheel", handleWheel);
        };
    }, [setZoom, setPan]);

    const existingGroupIds = new Set(nodes.filter((n) => n.type === 'GROUP').map((n) => n.id));

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden ${isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : (isPanning ? 'cursor-grabbing' : 'cursor-default')}`}
            style={{ backgroundColor: isDeepCanvasMode ? "#17191F" : "#22242B" }}
            onPointerMove={(e) => {
                const container = containerRef.current;
                if (!container) return;
                const rect = container.getBoundingClientRect();
                setLastPointerScreenPos({
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top,
                });
            }}
            onPointerLeave={() => {
                setLastPointerScreenPos(null);
            }}
            onDoubleClick={(e) => {
                if (!activeGroupId) return;
                if (e.target !== e.currentTarget) return;
                const currentGroup = nodes.find(n => n.id === activeGroupId && n.type === 'GROUP');
                setActiveGroupId(currentGroup?.groupId || null);
                setSelection([]);
            }}
            onPointerDown={(e) => {
                handleWrapperMouseDown(e); // Keeping existing name for now, but it's triggered by pointerdown

                if (!isSpacePressed && e.button === 0) {
                    const container = containerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    setLastPointerScreenPos({ x, y });

                    const spawn = getSpawnWorldPos(container, { x, y });
                    let worldX = spawn.x;
                    let worldY = spawn.y;

                    const createNode = (type: CanvasNode['type'], defaults: any) => {
                        const newNode: any = {
                            id: crypto.randomUUID(),
                            type,
                            x: worldX,
                            y: worldY,
                            ...defaults
                        };
                        addNode(newNode);
                        recordLastWorkPos(worldX, worldY);
                        setToolMode('select');
                    };

                    switch (toolMode) {
                        case 'text':
                            e.preventDefault();
                            const newText: CanvasNode = {
                                id: crypto.randomUUID(),
                                type: 'TEXT',
                                x: worldX,
                                y: worldY,
                                text: "",
                                fontSize: 14,
                                fontFamily: "JetBrains Mono",
                                fontWeight: "normal",
                                textColor: "#E2E8F0",
                                textAlign: "left",
                                verticalAlign: "top",
                                width: TEXT_BOX_DEFAULT_WIDTH,
                                height: TEXT_BOX_DEFAULT_HEIGHT,
                            } as any;
                            addNode(newText);
                            recordLastWorkPos(worldX, worldY);
                            setEditingNodeId(newText.id);
                            setEditingText("");
                            setEditingFontSize(14);
                            setEditingFontFamily((newText as any).fontFamily || "JetBrains Mono");
                            setEditingFontWeight((newText as any).fontWeight || "normal");
                            setEditingTextAlign((newText as any).textAlign || "left");
                            setEditingTextColor((newText as any).textColor || "#E2E8F0");
                            setToolMode('select');
                            break;
                        case 'box':
                            // createNode('BOX', { width: 240, height: 120, color: 'transparent' });
                            // Replaced with Drag-to-Draw logic
                            setBoxStartPos({ x: worldX, y: worldY });
                            setCurrentMousePos({ x: worldX, y: worldY });
                            break;
                        case 'button':
                            createNode('BUTTON', { width: 100, height: 40, text: 'Button', variant: 'primary' });
                            break;
                        case 'input':
                            createNode('INPUT', { width: 200, height: 40, placeholder: 'Input...' });
                            break;
                        case 'card':
                            createNode('CARD', { width: 300, height: 200, title: 'Card Title', content: 'Card Content' });
                            break;
                        case 'line':
                        case 'arrow':
                            const newNode: any = {
                                id: crypto.randomUUID(),
                                type: toolMode === 'line' ? 'LINE' : 'ARROW',
                                x: worldX,
                                y: worldY,
                                endX: worldX, // Initialize end point same as start
                                endY: worldY,
                            };
                            addNode(newNode);
                            setDrawingNodeId(newNode.id);
                            setDrawingStartPos({ x: worldX, y: worldY });
                            // Do NOT reset toolMode here, wait for mouse up
                            break;
                        case 'pencil':
                        case 'eraser':
                            setIsPainting(true);
                            // Initial paint on click
                            const cellX = Math.round(worldX / gridSize);
                            const cellY = Math.round(worldY / gridSize);
                            const key = `${cellX},${cellY}`;
                            if (toolMode === 'pencil') {
                                addPaint(key);
                            } else {
                                removePaint(key);
                            }
                            break;

                        case 'select':
                            // Start Marquee Selection if clicking on empty space (which we are, since nodes stop propagation)
                            if (e.shiftKey) {
                                worldX = (x - pan.x) / zoom;
                                worldY = (y - pan.y) / zoom;
                            } else {
                                worldX = snapToGrid((x - pan.x) / zoom, gridSize);
                                worldY = snapToGrid((y - pan.y) / zoom, gridSize);
                            }
                            setIsSelecting(true);
                            setSelectionStartPos({ x: worldX, y: worldY });
                            setSelectionEndPos({ x: worldX, y: worldY });
                            break;
                    }
                }
            }}
        >
            <DimOverlay />

            {showGrid && (
                <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
                    {minorVerticalLines.map((x) => {
                        const sx = x * zoom + pan.x;
                        return (
                            <line
                                key={`mvx-${x}`}
                                x1={sx}
                                y1={0}
                                x2={sx}
                                y2={viewportSize.height}
                                stroke={isDeepCanvasMode ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.04)"}
                                strokeWidth={1}
                            />
                        );
                    })}
                    {minorHorizontalLines.map((y) => {
                        const sy = y * zoom + pan.y;
                        return (
                            <line
                                key={`mhy-${y}`}
                                x1={0}
                                y1={sy}
                                x2={viewportSize.width}
                                y2={sy}
                                stroke={isDeepCanvasMode ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.04)"}
                                strokeWidth={1}
                            />
                        );
                    })}
                    {showMajorGrid && majorVerticalLines.map((x) => {
                        const sx = x * zoom + pan.x;
                        return (
                            <line
                                key={`Mvx-${x}`}
                                x1={sx}
                                y1={0}
                                x2={sx}
                                y2={viewportSize.height}
                                stroke={isDeepCanvasMode ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.1)"}
                                strokeWidth={1.15}
                            />
                        );
                    })}
                    {showMajorGrid && majorHorizontalLines.map((y) => {
                        const sy = y * zoom + pan.y;
                        return (
                            <line
                                key={`Mhy-${y}`}
                                x1={0}
                                y1={sy}
                                x2={viewportSize.width}
                                y2={sy}
                                stroke={isDeepCanvasMode ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.1)"}
                                strokeWidth={1.15}
                            />
                        );
                    })}
                </svg>
            )}

            <div
                className="absolute inset-0 origin-top-left pointer-events-none"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
            >

                {/* Paint Layer */}
                {paintLayerVisible && Array.from(paintLayer).map((key) => {
                    const [cx, cy] = key.split(',').map(Number);
                    return (
                        <div
                            key={key}
                            className="absolute bg-black"
                            style={{
                                left: cx * gridSize,
                                top: cy * gridSize,
                                width: gridSize,
                                height: gridSize,
                            }}
                        />
                    );
                })}
            </div>

            <div className="absolute inset-0 pointer-events-none">
                {nodes.filter(n => n.visible !== false).map((node) => {
                    const bounds = getNodeBounds(node);
                    const x = bounds.x;
                    const y = bounds.y;
                    const width = bounds.width;
                    const height = bounds.height;

                    const screen = worldToScreen(
                        { x, y, width, height },
                        pan,
                        zoom
                    );

                    const isSelected = selectedNodeIds.includes(node.id);
                    const isEditing = editingNodeId === node.id;

                    // Interaction restriction: in group edit mode, only direct children are editable.
                    const isInteractable = !activeGroupId || node.groupId === activeGroupId;
                    const pointerEvents = isInteractable ? "auto" : "none";
                    const opacity = isInteractable ? 1 : 0.4;
                    const hiddenOutlineGroupNames = new Set(["문단 영역", "이미지 영역", "특징 모음", "FAQ"]);
                    const shouldHideGroupOutline = node.type === 'GROUP' && hiddenOutlineGroupNames.has(node.name || "");

                    if (node.type === 'GROUP') {
                        if (shouldHideGroupOutline && !isSelected) {
                            return null;
                        }
                        const isGroupEditing = activeGroupId === node.id;
                        return (
                            <div
                                key={node.id}
                                className={`absolute ${isSelected ? "ring-2 ring-blue-500/30" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: Math.max(screen.width, 1),
                                    height: Math.max(screen.height, 1),
                                    pointerEvents,
                                    opacity,
                                    borderRadius: "0px",
                                    backgroundColor: node.backgroundColor || "rgba(255, 255, 255, 0.03)",
                                    border: `2px solid ${isGroupEditing ? "#3B82F6" : "#E2E8F0"}`,
                                    boxShadow: "4px 4px 0px 0px #000",
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setActiveGroupId(node.id);
                                    setSelection([]);
                                }}
                            />
                        );
                    } else if (node.type === 'FRAME') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute bg-white shadow-sm border ${isSelected
                                    ? "border-blue-500 ring-2 ring-blue-500/20 z-10"
                                    : "border-gray-300 hover:border-gray-400 z-0"
                                    }`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    pointerEvents,
                                    opacity,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                <div
                                    className={`absolute -top-7 left-0 px-1 py-0.5 text-xs font-medium truncate max-w-full cursor-pointer select-none rounded-t-sm
                                        ${isSelected ? "bg-blue-500 text-white" : "text-gray-500 hover:text-gray-700"}
                                    `}
                                >
                                    {node.name}
                                </div>
                            </div>
                        );
                    } else if (node.type === 'TEXT') {
                        const textLayout = getTextLayout(node);
                        const isInGroup = !!node.groupId && existingGroupIds.has(node.groupId);
                        const parentGroup = isInGroup
                            ? nodes.find((n): n is Extract<CanvasNode, { type: 'GROUP' }> => n.type === 'GROUP' && n.id === node.groupId)
                            : undefined;
                        const parentGroupHasBackground = !!parentGroup?.backgroundColor && parentGroup.backgroundColor !== 'transparent';
                        const resolvedBackgroundColor = isInGroup ? 'transparent' : (node.backgroundColor || 'transparent');
                        const hasBackgroundColor = resolvedBackgroundColor !== 'transparent';
                        const hasBackground = resolvedBackgroundColor !== 'transparent';
                        const dynamicTextColor = hasBackground ? '#000000' : '#E2E8F0';
                        const finalTextColor = isInGroup
                            ? (parentGroupHasBackground ? '#000000' : '#E2E8F0')
                            : ((node as any).textColor || dynamicTextColor);
                        const selectionHalo = isSelected && !isEditing ? "0 0 0 2px rgba(59, 130, 246, 0.95)" : "";
                        const neoShadow = hasBackgroundColor ? "4px 4px 0px 0px #000" : "";
                        const combinedBoxShadow = [selectionHalo, neoShadow].filter(Boolean).join(", ") || "none";
                        return (
                            <div
                                key={node.id}
                                className="absolute"
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: isEditing ? Math.max(textLayout.boxWidth * zoom, editingTextareaWidth) : textLayout.boxWidth * zoom,
                                    height: isEditing ? Math.max(textLayout.boxHeight * zoom, editingTextareaHeight) : textLayout.boxHeight * zoom,
                                    zIndex: isEditing ? 100 : (isSelected ? 10 : 1),
                                    pointerEvents,
                                    opacity,
                                    overflow: "visible",
                                    backgroundColor: resolvedBackgroundColor,
                                    padding: resolvedBackgroundColor !== 'transparent' ? `${4 * zoom}px ${8 * zoom}px` : '0',
                                    border: hasBackgroundColor ? '2px solid #E2E8F0' : 'none',
                                    boxShadow: combinedBoxShadow,
                                    borderRadius: '0px',
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                                onDoubleClick={(e) => handleDoubleClick(e, node)}
                            >
                                {isEditing ? (
                                    <textarea
                                        ref={editingTextareaRef}
                                        value={editingText}
                                        onChange={(e) => {
                                            setEditingText(e.target.value);
                                            syncEditingTextareaSize();
                                        }}
                                        onInput={syncEditingTextareaSize}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === "Escape") {
                                                e.preventDefault();
                                                saveText();
                                            }
                                        }}
                                        onBlur={saveText}
                                        className="outline-none bg-transparent resize-none overflow-hidden m-0 border-none block"
                                        style={{
                                            fontSize: `${editingFontSize * zoom}px`,
                                            fontFamily: FONT_FAMILY_MAP[editingFontFamily] || FONT_FAMILY_MAP["JetBrains Mono"],
                                            fontWeight: editingFontWeight,
                                            color: finalTextColor,
                                            textAlign: editingTextAlign,
                                            lineHeight: "1.4",
                                            letterSpacing: "inherit",
                                            padding: `${EDITING_PADDING_Y}px ${EDITING_PADDING_X}px`,
                                            background: "rgba(0,0,0,0.5)",
                                            border: "none",
                                            outline: "none",
                                            caretColor: finalTextColor,
                                            height: editingTextareaHeight,
                                            width: editingTextareaWidth,
                                            minHeight: editingTextareaHeight,
                                            minWidth: editingTextareaWidth,
                                            borderRadius: 0,
                                            boxSizing: "border-box",
                                            whiteSpace: "pre",
                                            overflowWrap: "normal",
                                            wordBreak: "normal",
                                            overflow: "hidden",
                                            resize: "none",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div
                                        className="h-full w-full select-none text-slate-900 cursor-default flex"
                                        style={{
                                            padding: `${(TEXT_HIT_PADDING_Y / 2) * zoom}px ${(TEXT_HIT_PADDING_X / 2) * zoom}px`,
                                            fontSize: textLayout.renderedFontSize * zoom,
                                            fontFamily: FONT_FAMILY_MAP[(node as any).fontFamily || "JetBrains Mono"],
                                            fontWeight: (node as any).fontWeight || "normal",
                                            color: finalTextColor,
                                            lineHeight: "1.4",
                                            boxSizing: "border-box",
                                            width: "100%",
                                            minWidth: "100%",
                                            maxWidth: "100%",
                                            whiteSpace: "pre-wrap",
                                            overflowWrap: "anywhere",
                                            wordBreak: "break-word",
                                            overflow: "visible",
                                            textAlign: (node as any).textAlign || "left",
                                            justifyContent:
                                                ((node as any).textAlign || "left") === "center"
                                                    ? "center"
                                                    : ((node as any).textAlign || "left") === "right"
                                                        ? "flex-end"
                                                        : "flex-start",
                                            alignItems:
                                                ((node as any).verticalAlign || "top") === "middle"
                                                    ? "center"
                                                    : ((node as any).verticalAlign || "top") === "bottom"
                                                        ? "flex-end"
                                                        : "flex-start",
                                        }}
                                    >
                                        {node.text}
                                    </div>
                                )}
                                {isSelected && !isEditing && (
                                    <>
                                        {[
                                            { key: "n", cursor: "ns-resize", style: { top: -TEXT_RESIZE_HANDLE_SIZE / 2, left: TEXT_RESIZE_HANDLE_SIZE, right: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "s", cursor: "ns-resize", style: { bottom: -TEXT_RESIZE_HANDLE_SIZE / 2, left: TEXT_RESIZE_HANDLE_SIZE, right: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "e", cursor: "ew-resize", style: { right: -TEXT_RESIZE_HANDLE_SIZE / 2, top: TEXT_RESIZE_HANDLE_SIZE, bottom: TEXT_RESIZE_HANDLE_SIZE, width: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "w", cursor: "ew-resize", style: { left: -TEXT_RESIZE_HANDLE_SIZE / 2, top: TEXT_RESIZE_HANDLE_SIZE, bottom: TEXT_RESIZE_HANDLE_SIZE, width: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "ne", cursor: "nesw-resize", style: { top: -TEXT_RESIZE_HANDLE_SIZE / 2, right: -TEXT_RESIZE_HANDLE_SIZE / 2, width: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "nw", cursor: "nwse-resize", style: { top: -TEXT_RESIZE_HANDLE_SIZE / 2, left: -TEXT_RESIZE_HANDLE_SIZE / 2, width: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "se", cursor: "nwse-resize", style: { bottom: -TEXT_RESIZE_HANDLE_SIZE / 2, right: -TEXT_RESIZE_HANDLE_SIZE / 2, width: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                            { key: "sw", cursor: "nesw-resize", style: { bottom: -TEXT_RESIZE_HANDLE_SIZE / 2, left: -TEXT_RESIZE_HANDLE_SIZE / 2, width: TEXT_RESIZE_HANDLE_SIZE, height: TEXT_RESIZE_HANDLE_SIZE } },
                                        ].map((handle) => (
                                            <div
                                                key={handle.key}
                                                className="absolute"
                                                style={{
                                                    ...handle.style,
                                                    cursor: handle.cursor,
                                                    pointerEvents: "auto",
                                                    background: "rgba(96, 165, 250, 0.55)",
                                                    borderRadius: 2,
                                                }}
                                                onPointerDown={(e) => startTextResize(e, node, handle.key as "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw")}
                                            />
                                        ))}
                                    </>
                                )}
                            </div>
                        );
                    } else if (node.type === 'BOX') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    pointerEvents,
                                    opacity,
                                    backgroundColor: node.backgroundColor || 'transparent',
                                    border: '2px solid #E2E8F0',
                                    borderRadius: '0px',
                                    boxShadow: '4px 4px 0px 0px #000',
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            />
                        );
                    } else if (node.type === 'LINE' || node.type === 'ARROW') {
                        const geometry = getLineGeometry(node);
                        const x1 = geometry.startPoint.x - geometry.minX;
                        const y1 = geometry.startPoint.y - geometry.minY;
                        const x2 = geometry.endPoint.x - geometry.minX;
                        const y2 = geometry.endPoint.y - geometry.minY;
                        const cp1x = geometry.cp1.x - geometry.minX;
                        const cp1y = geometry.cp1.y - geometry.minY;
                        const cp2x = geometry.cp2.x - geometry.minX;
                        const cp2y = geometry.cp2.y - geometry.minY;

                        return (
                            <div
                                key={node.id}
                                className={`absolute ${isSelected ? "ring-1 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    pointerEvents,
                                    opacity,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                <svg width="100%" height="100%" overflow="visible">
                                    <defs>
                                        <marker
                                            id={`arrowhead-${node.id}`}
                                            markerWidth="10"
                                            markerHeight="7"
                                            refX="8.5"
                                            refY="3.5"
                                            orient="auto"
                                            markerUnits="userSpaceOnUse"
                                        >
                                            <polygon
                                                points="0 0, 10 3.5, 0 7"
                                                fill="#94A3B8"
                                            />
                                        </marker>
                                    </defs>
                                    <path
                                        d={`M ${x1 * zoom} ${y1 * zoom} C ${cp1x * zoom} ${cp1y * zoom}, ${cp2x * zoom} ${cp2y * zoom}, ${x2 * zoom} ${y2 * zoom}`}
                                        stroke="#94A3B8"
                                        strokeWidth={1.5 * zoom}
                                        strokeDasharray={node.type === 'LINE' ? "5,5" : undefined}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        markerEnd={node.type === 'ARROW' ? `url(#arrowhead-${node.id})` : undefined}
                                    />
                                </svg>
                            </div>
                        );
                    } else if (node.type === 'BUTTON') {
                        return (
                            <button
                                key={node.id}
                                className={`absolute bg-blue-500 text-white rounded flex items-center justify-center ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    fontSize: 14 * zoom,
                                    pointerEvents,
                                    opacity,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                {node.text}
                            </button>
                        );
                    } else if (node.type === 'INPUT') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute border border-gray-300 rounded bg-white px-2 flex items-center text-gray-400 ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    fontSize: 14 * zoom,
                                    pointerEvents,
                                    opacity,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                {node.placeholder}
                            </div>
                        );
                    } else if (node.type === 'CARD') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute bg-white border border-gray-200 shadow-sm rounded-lg p-4 flex flex-col ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    pointerEvents,
                                    opacity,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                <div className="font-bold border-b pb-2 mb-2" style={{ fontSize: 16 * zoom }}>{node.title}</div>
                                <div className="text-gray-600" style={{ fontSize: 14 * zoom }}>{node.content}</div>
                            </div>
                        );
                    }
                    return null;
                })}
            </div>

            {isDraggingNode && snapGuide.x !== null && (
                <div
                    className="absolute pointer-events-none z-40 bg-cyan-400/90"
                    style={{
                        left: pan.x + snapGuide.x * zoom,
                        top: 0,
                        width: 1,
                        height: "100%",
                    }}
                />
            )}
            {isDraggingNode && snapGuide.y !== null && (
                <div
                    className="absolute pointer-events-none z-40 bg-cyan-400/90"
                    style={{
                        left: 0,
                        top: pan.y + snapGuide.y * zoom,
                        width: "100%",
                        height: 1,
                    }}
                />
            )}

            {isDraggingNode && dragHud && (
                <div
                    className="absolute pointer-events-none z-50 bg-black/75 text-white text-[11px] px-2 py-1 rounded"
                    style={{
                        left: dragHud.screenX,
                        top: dragHud.screenY,
                    }}
                >
                    X: {dragHud.x} Y: {dragHud.y}
                </div>
            )}

            {/* Box Drawing Preview */}
            {
                boxStartPos && currentMousePos && (
                    <div
                        className="absolute border-2 border-blue-500 border-dashed bg-blue-100/20 pointer-events-none z-50"
                        style={{
                            left: worldToScreen({ x: Math.min(boxStartPos.x, currentMousePos.x), y: 0, width: 0, height: 0 }, pan, zoom).x,
                            top: worldToScreen({ x: 0, y: Math.min(boxStartPos.y, currentMousePos.y), width: 0, height: 0 }, pan, zoom).y,
                            width: Math.abs(currentMousePos.x - boxStartPos.x) * zoom,
                            height: Math.abs(currentMousePos.y - boxStartPos.y) * zoom,
                        }}
                    />
                )
            }

            {/* Marquee Selection Preview */}
            {
                isSelecting && selectionStartPos && selectionEndPos && (
                    <div
                        className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                        style={{
                            left: worldToScreen({ x: Math.min(selectionStartPos.x, selectionEndPos.x), y: 0, width: 0, height: 0 }, pan, zoom).x,
                            top: worldToScreen({ x: 0, y: Math.min(selectionStartPos.y, selectionEndPos.y), width: 0, height: 0 }, pan, zoom).y,
                            width: Math.abs(selectionEndPos.x - selectionStartPos.x) * zoom,
                            height: Math.abs(selectionEndPos.y - selectionStartPos.y) * zoom,
                        }}
                    />
                )
            }

            <div className={`absolute bottom-4 left-4 bg-[#181A20]/92 border border-[#3B4252] backdrop-blur p-2 rounded shadow text-xs text-[#E2E8F0] z-20 transition-opacity ${isDraggingNode || drawingNodeId || boxStartPos ? "opacity-50" : "opacity-100"}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[#94A3B8]">Canvas Help</div>
                    <button
                        type="button"
                        className="pointer-events-auto rounded border border-[#3B4252] bg-[#232734] px-2 py-0.5 text-[#E2E8F0] hover:bg-[#2D3340]"
                        onClick={() => setIsHudCollapsed((prev) => !prev)}
                    >
                        {isHudCollapsed ? "Open" : "Hide"}
                    </button>
                </div>
                {!isHudCollapsed && (
                    <div className="mt-2 space-y-1">
                        <div>Space + Drag to Pan</div>
                        <div>Mouse Wheel to Zoom</div>
                        <div>Middle Click to Pan</div>
                        <div>Alt + Drag: Duplicate Node</div>
                        <div>Cmd/Ctrl + Drag to Node: Link (Dashed)</div>
                        <div>Shift + Drag to Node: Link (Arrow)</div>
                        <div>Double Click Text to Edit</div>
                        <div>Double Click Group to Enter</div>
                        {activeGroupId && <div>Esc / Empty Double Click to Exit Group</div>}
                    </div>
                )}
                <div className="mt-2 text-[#94A3B8]">X: {Math.round(pan.x)} Y: {Math.round(pan.y)} Z: {zoom.toFixed(2)}</div>
            </div>
        </div>
    );
}
