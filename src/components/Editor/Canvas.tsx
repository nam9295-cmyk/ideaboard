"use client";

import { snapToGrid } from "@/utils/snap";
import { useCanvasParams } from "@/hooks/useCanvasParams";
import GridBackground from "./GridBackground";
import { useEffect, useRef, useState } from "react";
import { useEditor } from "@/context/EditorContext";
import { worldToScreen } from "@/utils/coords";
import DimOverlay from "./DimOverlay";
import { CanvasNode, FrameNode, TextNode, BoxNode, LineNode, ArrowNode, ButtonNode, InputNode, CardNode, GroupNode } from "@/types";

export default function Canvas() {
    const { nodes, selectedNodeIds, selectNode, toggleSelection, setSelection, updateNode, updateMultipleNodes, deleteNode, deleteNodes, addNode, toolMode, setToolMode, gridSize, paintLayer, addPaint, removePaint, undo, redo, pushSnapshot } = useEditor();
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

    // Start Editing
    const handleDoubleClick = (e: React.MouseEvent, node: CanvasNode) => {
        e.stopPropagation();
        if (node.type === 'TEXT') {
            setEditingNodeId(node.id);
            setEditingText(node.text);
            setIsDraggingNode(false); // Cancel drag if any
        }
    };

    const startNodeDrag = (e: React.PointerEvent, node: CanvasNode) => {
        if (isSpacePressed || e.button === 1) return;
        if (node.type === 'TEXT' && editingNodeId === node.id) return;
        e.stopPropagation();

        console.log("startNodeDrag on node:", node.id, node.type);

        let targetNode = node;
        // If clicking a child node that belongs to a group, drag the whole group
        if (node.groupId) {
            const groupParent = nodes.find(n => n.id === node.groupId);
            if (groupParent) {
                targetNode = groupParent;
            }
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

    // Save Text
    const saveText = () => {
        if (editingNodeId) {
            if (!editingText.trim()) {
                deleteNode(editingNodeId);
            } else {
                updateNode(editingNodeId, { text: editingText });
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
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedNodeIds, deleteNode, editingNodeId]);

    // Dragging & Drawing Logic
    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
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

                if (!dragRef.current.historyRecorded) {
                    pushSnapshot();
                    dragRef.current.historyRecorded = true;
                }

                // Node 0 is the dragged node
                const mainNodeInitial = nodesInitialPos[0];
                let effectiveDeltaX = deltaWorldX;
                let effectiveDeltaY = deltaWorldY;

                if (!e.shiftKey) {
                    const snappedX = snapToGrid(mainNodeInitial.x + deltaWorldX, gridSize);
                    const snappedY = snapToGrid(mainNodeInitial.y + deltaWorldY, gridSize);
                    effectiveDeltaX = snappedX - mainNodeInitial.x;
                    effectiveDeltaY = snappedY - mainNodeInitial.y;
                }

                const updates = nodesInitialPos.map(ip => ({
                    id: ip.id,
                    changes: {
                        x: ip.x + effectiveDeltaX,
                        y: ip.y + effectiveDeltaY,
                        ...(ip.endX !== undefined ? { endX: ip.endX + effectiveDeltaX } : {}),
                        ...(ip.endY !== undefined ? { endY: ip.endY + effectiveDeltaY } : {})
                    }
                }));

                updateMultipleNodes(updates, true);
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
                setDrawingNodeId(null);
                setDrawingStartPos(null);
                setToolMode('select');
            }
            if (isPainting) {
                setIsPainting(false);
                // Don't reset toolMode for pencil/eraser to allow continuous drawing
            }
            if (dragRef.current) {
                dragRef.current = null;
                setIsDraggingNode(false);
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
                        // Quick bounding box check
                        let nodeX = node.x;
                        let nodeY = node.y;
                        let nodeW = 0;
                        let nodeH = 0;

                        if (node.type === 'LINE' || node.type === 'ARROW') {
                            nodeX = Math.min(node.x, node.endX);
                            nodeY = Math.min(node.y, node.endY);
                            nodeW = Math.abs(node.endX - node.x);
                            nodeH = Math.abs(node.endY - node.y);
                        } else {
                            // @ts-ignore
                            nodeW = node.width || 0;
                            // @ts-ignore
                            nodeH = node.height || 0;
                        }

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

        if (isDraggingNode || drawingNodeId || boxStartPos || isPainting || isSelecting) {
            console.log("Attaching event listeners. isDraggingNode:", isDraggingNode);
            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp);
        }

        return () => {
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
        };
    }, [isDraggingNode, drawingNodeId, zoom, pan, updateNode, setToolMode, boxStartPos, currentMousePos, gridSize, addNode, drawingStartPos, isPainting, toolMode, addPaint, removePaint, isSpacePressed, isSelecting, selectionStartPos, selectionEndPos, nodes, selectedNodeIds, setSelection]);

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

    return (
        <div
            ref={containerRef}
            className={`absolute inset-0 overflow-hidden ${isSpacePressed ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : (isPanning ? 'cursor-grabbing' : 'cursor-default')}`}
            onPointerDown={(e) => {
                handleWrapperMouseDown(e); // Keeping existing name for now, but it's triggered by pointerdown

                if (!isSpacePressed && e.button === 0) {
                    const container = containerRef.current;
                    if (!container) return;
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    let worldX = (x - pan.x) / zoom;
                    let worldY = (y - pan.y) / zoom;

                    if (!e.shiftKey) {
                        worldX = snapToGrid(worldX, gridSize);
                        worldY = snapToGrid(worldY, gridSize);
                    }

                    const createNode = (type: CanvasNode['type'], defaults: any) => {
                        const newNode: any = {
                            id: crypto.randomUUID(),
                            type,
                            x: worldX,
                            y: worldY,
                            ...defaults
                        };
                        addNode(newNode);
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
                                fontSize: 16,
                            };
                            addNode(newText);
                            setEditingNodeId(newText.id);
                            setEditingText("");
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
                            setIsSelecting(true);
                            setSelectionStartPos({ x: worldX, y: worldY });
                            setSelectionEndPos({ x: worldX, y: worldY });
                            break;
                    }
                }
            }}
        >
            <DimOverlay />

            <div
                className="absolute inset-0 origin-top-left pointer-events-none"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
            >
                <GridBackground />

                {/* Paint Layer */}
                {Array.from(paintLayer).map((key) => {
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
                {nodes.map((node) => {
                    let x = node.x;
                    let y = node.y;
                    let width = 0;
                    let height = 0;

                    if (node.type === 'LINE' || node.type === 'ARROW') {
                        // Calculate bounding box
                        const minX = Math.min(node.x, node.endX);
                        const minY = Math.min(node.y, node.endY);
                        const maxX = Math.max(node.x, node.endX);
                        const maxY = Math.max(node.y, node.endY);
                        x = minX;
                        y = minY;
                        width = Math.max(maxX - minX, 1); // Avoid 0 width
                        height = Math.max(maxY - minY, 1); // Avoid 0 height
                    } else {
                        if ('width' in node && typeof node.width === 'number') width = node.width;
                        if ('height' in node && typeof node.height === 'number') height = node.height;
                    }

                    const screen = worldToScreen(
                        { x, y, width, height },
                        pan,
                        zoom
                    );

                    const isSelected = selectedNodeIds.includes(node.id);
                    const isEditing = editingNodeId === node.id;

                    if (node.type === 'FRAME') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute bg-white shadow-sm border pointer-events-auto ${isSelected
                                    ? "border-blue-500 ring-2 ring-blue-500/20 z-10"
                                    : "border-gray-300 hover:border-gray-400 z-0"
                                    }`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
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
                        return (
                            <div
                                key={node.id}
                                className={`absolute pointer-events-auto whitespace-pre
                                    ${isSelected && !isEditing ? "ring-1 ring-blue-500 border-blue-500" : ""}
                                `}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    fontSize: (node.fontSize || 16) * zoom,
                                    lineHeight: "1.2",
                                    zIndex: isEditing ? 100 : (isSelected ? 10 : 1),
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                                onDoubleClick={(e) => handleDoubleClick(e, node)}
                            >
                                {isEditing ? (
                                    <textarea
                                        ref={(el) => {
                                            if (el) {
                                                // We don't want to re-focus if already focused to avoid fighting
                                                if (document.activeElement !== el) {
                                                    el.focus();
                                                }
                                            }
                                        }}
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        onKeyDown={(e) => {
                                            e.stopPropagation();
                                            if (e.key === "Enter" && !e.shiftKey) {
                                                e.preventDefault();
                                                saveText();
                                            }
                                            if (e.key === "Escape") {
                                                const node = nodes.find(n => n.id === editingNodeId);
                                                if (node && node.type === 'TEXT' && !node.text) {
                                                    deleteNode(editingNodeId);
                                                }
                                                setEditingNodeId(null);
                                                setToolMode('select');
                                            }
                                        }}
                                        onBlur={saveText}
                                        className="outline-none bg-transparent resize-none overflow-hidden m-0 p-0 border-none block"
                                        style={{
                                            fontSize: "inherit",
                                            fontFamily: "inherit",
                                            lineHeight: "inherit",
                                            minWidth: "1em",
                                            color: "black",
                                            height: "auto",
                                            width: "max-content",
                                        }}
                                        cols={Math.max(editingText.length, 5)}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="select-none text-black cursor-default">
                                        {node.text}
                                    </div>
                                )}
                            </div>
                        );
                    } else if (node.type === 'BOX') {
                        return (
                            <div
                                key={node.id}
                                className={`absolute border-2 border-black bg-white pointer-events-auto ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            />
                        );
                    } else if (node.type === 'LINE' || node.type === 'ARROW') {
                        // Calculate relative coordinates within the bounding box
                        // relative start: node.x - minX, node.y - minY
                        // relative end: node.endX - minX, node.endY - minY
                        const minX = Math.min(node.x, node.endX);
                        const minY = Math.min(node.y, node.endY);

                        const x1 = node.x - minX;
                        const y1 = node.y - minY;
                        const x2 = node.endX - minX;
                        const y2 = node.endY - minY;

                        return (
                            <div
                                key={node.id}
                                className={`absolute pointer-events-auto ${isSelected ? "ring-1 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                }}
                                onPointerDown={(e) => startNodeDrag(e, node)}
                            >
                                <svg width="100%" height="100%" overflow="visible">
                                    <defs>
                                        <marker
                                            id={`arrowhead-${node.id}`}
                                            markerWidth="10"
                                            markerHeight="7"
                                            refX="9"
                                            refY="3.5"
                                            orient="auto"
                                        >
                                            <polygon
                                                points="0 0, 10 3.5, 0 7"
                                                fill="black"
                                            />
                                        </marker>
                                    </defs>
                                    <line
                                        x1={x1 * zoom}
                                        y1={y1 * zoom}
                                        x2={x2 * zoom}
                                        y2={y2 * zoom}
                                        stroke="black"
                                        strokeWidth={2 * zoom}
                                        markerEnd={node.type === 'ARROW' ? `url(#arrowhead-${node.id})` : undefined}
                                    />
                                </svg>
                            </div>
                        );
                    } else if (node.type === 'BUTTON') {
                        return (
                            <button
                                key={node.id}
                                className={`absolute bg-blue-500 text-white rounded pointer-events-auto flex items-center justify-center ${isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    fontSize: 14 * zoom,
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
                                className={`absolute border border-gray-300 rounded bg-white px-2 flex items-center text-gray-400 pointer-events-auto ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
                                    fontSize: 14 * zoom,
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
                                className={`absolute bg-white border border-gray-200 shadow-sm rounded-lg p-4 pointer-events-auto flex flex-col pointer-events-auto ${isSelected ? "ring-2 ring-blue-500" : ""}`}
                                style={{
                                    left: screen.x,
                                    top: screen.y,
                                    width: screen.width,
                                    height: screen.height,
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

            {/* Box Drawing Preview */}
            {boxStartPos && currentMousePos && (
                <div
                    className="absolute border-2 border-blue-500 border-dashed bg-blue-100/20 pointer-events-none z-50"
                    style={{
                        left: worldToScreen({ x: Math.min(boxStartPos.x, currentMousePos.x), y: 0, width: 0, height: 0 }, pan, zoom).x,
                        top: worldToScreen({ x: 0, y: Math.min(boxStartPos.y, currentMousePos.y), width: 0, height: 0 }, pan, zoom).y,
                        width: Math.abs(currentMousePos.x - boxStartPos.x) * zoom,
                        height: Math.abs(currentMousePos.y - boxStartPos.y) * zoom,
                    }}
                />
            )}

            {/* Marquee Selection Preview */}
            {isSelecting && selectionStartPos && selectionEndPos && (
                <div
                    className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none z-50"
                    style={{
                        left: worldToScreen({ x: Math.min(selectionStartPos.x, selectionEndPos.x), y: 0, width: 0, height: 0 }, pan, zoom).x,
                        top: worldToScreen({ x: 0, y: Math.min(selectionStartPos.y, selectionEndPos.y), width: 0, height: 0 }, pan, zoom).y,
                        width: Math.abs(selectionEndPos.x - selectionStartPos.x) * zoom,
                        height: Math.abs(selectionEndPos.y - selectionStartPos.y) * zoom,
                    }}
                />
            )}

            <div className={`absolute bottom-4 left-4 bg-white/80 backdrop-blur p-2 rounded shadow text-xs space-y-1 z-20 pointer-events-none transition-opacity ${isDraggingNode || drawingNodeId || boxStartPos ? "opacity-50" : "opacity-100"}`}>
                <div>Space + Drag to Pan</div>
                <div>Mouse Wheel to Zoom</div>
                <div>Middle Click to Pan</div>
                <div>Double Click Text to Edit</div>
                <div>X: {Math.round(pan.x)} Y: {Math.round(pan.y)} Z: {zoom.toFixed(2)}</div>
            </div>
        </div>
    );
}
