"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CanvasNode, FrameNode, TextNode, ToolMode } from "@/types";
import { loadFrames, saveFrames } from "@/utils/storage";

interface EditorState {
    nodes: CanvasNode[];
    selectedNodeIds: string[];
    zoom: number;
    pan: { x: number; y: number };
    setZoom: (zoom: number | ((prev: number) => number)) => void;
    setPan: (pan: { x: number; y: number } | ((prev: { x: number; y: number }) => { x: number; y: number })) => void;

    activeGroupId: string | null;
    setActiveGroupId: (id: string | null) => void;

    addNode: (node: CanvasNode) => void;
    addNodes: (nodes: CanvasNode[]) => void;
    updateNode: (id: string, updates: Partial<CanvasNode>, skipHistory?: boolean) => void;
    updateMultipleNodes: (updates: { id: string, changes: Partial<CanvasNode> }[], skipHistory?: boolean) => void;
    selectNode: (id: string | null) => void;
    toggleSelection: (id: string) => void;
    setSelection: (ids: string[]) => void;
    deleteNode: (id: string) => void;
    deleteNodes: (ids: string[]) => void;
    groupNodes: () => void;
    ungroupNodes: () => void;
    reorderNode: (draggedId: string, targetId: string, position: 'above' | 'below') => void;
    toolMode: ToolMode;
    setToolMode: (mode: ToolMode) => void;
    dimOutsideFrames: boolean;
    setDimOutsideFrames: (dim: boolean) => void;
    gridSize: number;
    setGridSize: (size: number) => void;
    paintLayer: Set<string>;
    paintLayerVisible: boolean;
    setPaintLayerVisible: (visible: boolean) => void;
    addPaint: (key: string, skipHistory?: boolean) => void;
    removePaint: (key: string, skipHistory?: boolean) => void;

    // History
    history: { past: Snapshot[]; future: Snapshot[] };
    pushSnapshot: () => void;
    undo: () => void;
    redo: () => void;
}

interface Snapshot {
    nodes: CanvasNode[];
    paintLayer: Set<string>;
}

const EditorContext = createContext<EditorState | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [nodes, setNodes] = useState<CanvasNode[]>([]);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [toolMode, setToolMode] = useState<ToolMode>('select');
    const [dimOutsideFrames, setDimOutsideFrames] = useState(false);
    const [gridSize, setGridSize] = useState(10);
    const [paintLayer, setPaintLayer] = useState<Set<string>>(new Set());
    const [paintLayerVisible, setPaintLayerVisible] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);

    // Group Edit State
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

    // History
    const [history, setHistory] = useState<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });

    // Helper to record current state to history
    const pushSnapshot = () => {
        setHistory(prev => {
            const newPast = [...prev.past, { nodes: [...nodes], paintLayer: new Set(paintLayer) }];
            if (newPast.length > 100) newPast.shift();
            return {
                past: newPast,
                future: []
            };
        });
    };

    const undo = () => {
        if (history.past.length === 0) return;

        const previous = history.past[history.past.length - 1];
        const newPast = history.past.slice(0, -1);

        const currentSnapshot: Snapshot = { nodes: [...nodes], paintLayer: new Set(paintLayer) };

        setHistory({
            past: newPast,
            future: [currentSnapshot, ...history.future]
        });

        setNodes(previous.nodes);
        setPaintLayer(previous.paintLayer);
        // We might want to clear selection or keep it? Figma usually keeps it if possible, but simplest is clear or keep.
        // Let's keep selection if IDs exist, managed automatically by React rendering but IDs might point to non-existent nodes if undone.
        // Canvas handles missing nodes gracefully usually.
    };

    const redo = () => {
        if (history.future.length === 0) return;

        const next = history.future[0];
        const newFuture = history.future.slice(1);

        const currentSnapshot: Snapshot = { nodes: [...nodes], paintLayer: new Set(paintLayer) };

        setHistory({
            past: [...history.past, currentSnapshot],
            future: newFuture
        });

        setNodes(next.nodes);
        setPaintLayer(next.paintLayer);
    };

    // Load from storage on mount
    useEffect(() => {
        const loaded = loadFrames();
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setNodes(loaded);
        setIsLoaded(true);
    }, []);

    // Save to storage whenever nodes change (but only after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveFrames(nodes);
        }
    }, [nodes, isLoaded]);

    const addNode = (node: CanvasNode) => {
        pushSnapshot();
        setNodes((prev) => [...prev, node]);
        setSelectedNodeIds([node.id]);
    };

    const addNodes = (newNodes: CanvasNode[]) => {
        pushSnapshot();
        setNodes((prev) => [...prev, ...newNodes]);
        setSelectedNodeIds(newNodes.map(n => n.id));
    };

    const updateNode = (id: string, updates: Partial<CanvasNode>, skipHistory = false) => {
        if (!skipHistory) pushSnapshot();
        setNodes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, ...updates } as CanvasNode : n))
        );
    };

    const updateMultipleNodes = (updates: { id: string, changes: Partial<CanvasNode> }[], skipHistory = false) => {
        if (!skipHistory) pushSnapshot();
        setNodes((prev) => {
            const updatesMap = new Map(updates.map(u => [u.id, u.changes]));
            return prev.map((n) => {
                const changes = updatesMap.get(n.id);
                return changes ? { ...n, ...changes } as CanvasNode : n;
            });
        });
    };

    const deleteNode = (id: string) => {
        pushSnapshot();
        setNodes((prev) => prev.filter((n) => n.id !== id));
        setSelectedNodeIds((prev) => prev.filter((pid) => pid !== id));
    };

    const deleteNodes = (ids: string[]) => {
        pushSnapshot();
        setNodes((prev) => prev.filter((n) => !ids.includes(n.id)));
        setSelectedNodeIds((prev) => prev.filter((pid) => !ids.includes(pid)));
    };

    const groupNodes = () => {
        if (selectedNodeIds.length < 2) return;
        const groupId = crypto.randomUUID();

        pushSnapshot();
        setNodes((prev) => {
            const selected = prev.filter(n => selectedNodeIds.includes(n.id));
            if (selected.length < 2) return prev;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            selected.forEach(n => {
                if (n.x < minX) minX = n.x;
                if (n.y < minY) minY = n.y;
                const w = n.width ?? 0;
                const h = n.height ?? 0;
                if (n.x + w > maxX) maxX = n.x + w;
                if (n.y + h > maxY) maxY = n.y + h;
            });

            if (maxX === -Infinity) maxX = minX;
            if (maxY === -Infinity) maxY = minY;

            const firstGroupId = selected[0].groupId;
            const allSameGroup = selected.every(n => n.groupId === firstGroupId);
            const parentGroupId = allSameGroup ? firstGroupId : undefined;

            const newGroup = {
                id: groupId,
                type: 'GROUP',
                name: 'Group',
                x: minX,
                y: minY,
                width: maxX - minX,
                height: Math.max(0, maxY - minY),
                groupId: parentGroupId
            } as CanvasNode;

            const next = prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, groupId } : n);
            return [...next, newGroup];
        });

        setSelectedNodeIds([groupId]);
    };

    const ungroupNodes = () => {
        const selectedGroups = nodes.filter(n => n.type === 'GROUP' && selectedNodeIds.includes(n.id));
        if (selectedGroups.length === 0) return;

        pushSnapshot();
        const groupIdsToRemove = new Set(selectedGroups.map(g => g.id));
        const newSelectedIds: string[] = [];

        setNodes((prev) => {
            const next = prev.filter(n => !groupIdsToRemove.has(n.id)).map(n => {
                if (n.groupId && groupIdsToRemove.has(n.groupId)) {
                    // This node is a child of one of the groups being ungrouped
                    const parentGroup = selectedGroups.find(g => g.id === n.groupId);
                    newSelectedIds.push(n.id); // Select the children
                    return { ...n, groupId: parentGroup?.groupId }; // Inherit the grandparent's groupId
                }
                return n;
            });
            return next;
        });

        // Also keep any non-group selected blocks selected
        const nonGroupSelectedIds = selectedNodeIds.filter(id => !groupIdsToRemove.has(id));
        setSelectedNodeIds([...nonGroupSelectedIds, ...newSelectedIds]);
    };

    const selectNode = (id: string | null) => {
        if (id === null) {
            setSelectedNodeIds([]);
        } else {
            setSelectedNodeIds([id]);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedNodeIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((pid) => pid !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const setSelection = (ids: string[]) => {
        setSelectedNodeIds(ids);
    };

    const reorderNode = (draggedId: string, targetId: string, position: 'above' | 'below') => {
        pushSnapshot();
        setNodes((prev) => {
            const newNodes = [...prev];
            const draggedIndex = newNodes.findIndex(n => n.id === draggedId);
            const targetIndex = newNodes.findIndex(n => n.id === targetId);

            if (draggedIndex === -1 || targetIndex === -1) return prev;

            const [draggedNode] = newNodes.splice(draggedIndex, 1);

            // Re-find target index since array length changed
            const newTargetIndex = newNodes.findIndex(n => n.id === targetId);

            // In LayersPanel, 'above' visually means higher Z-index (later in array).
            // 'below' visually means lower Z-index (earlier in array).
            if (position === 'above') {
                newNodes.splice(newTargetIndex + 1, 0, draggedNode);
            } else {
                newNodes.splice(newTargetIndex, 0, draggedNode);
            }

            return newNodes;
        });
    };

    const addPaint = (key: string, skipHistory = false) => {
        if (!skipHistory) pushSnapshot();
        setPaintLayer((prev) => {
            const newSet = new Set(prev);
            newSet.add(key);
            return newSet;
        });
    };

    const removePaint = (key: string, skipHistory = false) => {
        if (!skipHistory) pushSnapshot();
        setPaintLayer((prev) => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
        });
    };

    return (
        <EditorContext.Provider
            value={{
                nodes,
                zoom,
                setZoom,
                pan,
                setPan,
                activeGroupId,
                setActiveGroupId,
                addNode,
                addNodes,
                updateNode,
                updateMultipleNodes,
                selectedNodeIds,
                selectNode,
                toggleSelection,
                setSelection,
                deleteNode,
                deleteNodes,
                groupNodes,
                ungroupNodes,
                reorderNode,
                toolMode,
                setToolMode,
                dimOutsideFrames,
                setDimOutsideFrames,
                gridSize,
                setGridSize,
                paintLayer,
                paintLayerVisible,
                setPaintLayerVisible,
                addPaint,
                removePaint,
                history,
                pushSnapshot,
                undo,
                redo,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}

export function useEditor() {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error("useEditor must be used within an EditorProvider");
    }
    return context;
}
