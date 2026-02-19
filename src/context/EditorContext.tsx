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
    addNode: (node: CanvasNode) => void;
    updateNode: (id: string, updates: Partial<CanvasNode>, skipHistory?: boolean) => void;
    selectNode: (id: string | null) => void;
    toggleSelection: (id: string) => void;
    setSelection: (ids: string[]) => void;
    deleteNode: (id: string) => void;
    deleteNodes: (ids: string[]) => void;
    toolMode: ToolMode;
    setToolMode: (mode: ToolMode) => void;
    dimOutsideFrames: boolean;
    setDimOutsideFrames: (dim: boolean) => void;
    gridSize: number;
    setGridSize: (size: number) => void;
    paintLayer: Set<string>;
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
    const [isLoaded, setIsLoaded] = useState(false);

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

    const updateNode = (id: string, updates: Partial<CanvasNode>, skipHistory = false) => {
        if (!skipHistory) pushSnapshot();
        setNodes((prev) =>
            prev.map((n) => (n.id === id ? { ...n, ...updates } as CanvasNode : n))
        );
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
                pan,
                setZoom,
                setPan,
                addNode,
                updateNode,
                selectedNodeIds,
                selectNode,
                toggleSelection,
                setSelection,
                deleteNode,
                deleteNodes,
                toolMode,
                setToolMode,
                dimOutsideFrames,
                setDimOutsideFrames,
                gridSize,
                setGridSize,
                paintLayer,
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
