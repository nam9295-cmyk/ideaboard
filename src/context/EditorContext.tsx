"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CanvasNode, FrameNode, TextNode, ToolMode } from "@/types";
import { loadFrames, saveFrames } from "@/utils/storage";

interface EditorState {
    nodes: CanvasNode[];
    selectedNodeIds: string[];
    isAdmin: boolean;
    adminEmail: string | null;
    currentCloudBoardId: string | null;
    currentCloudBoardTitle: string | null;
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
    saveToCloud: () => Promise<string | null>;
    openCloudBoard: (id: string) => Promise<boolean>;
    handleGoogleLogin: () => Promise<void>;
    handleLogout: () => Promise<void>;
    newProject: () => void;

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
const ADMIN_EMAIL = "nam9295@gmail.com";

export function EditorProvider({ children }: { children: ReactNode }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [nodes, setNodes] = useState<CanvasNode[]>([]);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(() => {
        if (typeof window === "undefined") return false;
        return localStorage.getItem("isAdmin") === "true";
    });
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [currentCloudBoardId, setCurrentCloudBoardId] = useState<string | null>(null);
    const [currentCloudBoardTitle, setCurrentCloudBoardTitle] = useState<string | null>(null);
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

    const getFirestoreClient = async () => {
        const [{ db }, firestore] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/firestore/lite"),
        ]);

        return {
            db,
            doc: firestore.doc,
            getDoc: firestore.getDoc,
            setDoc: firestore.setDoc,
        };
    };
    const getAuthClient = async () => {
        const [{ auth, googleProvider }, firebaseAuth] = await Promise.all([
            import("@/lib/firebase"),
            import("firebase/auth"),
        ]);

        return {
            auth,
            googleProvider,
            signInWithPopup: firebaseAuth.signInWithPopup,
            signOut: firebaseAuth.signOut,
            onAuthStateChanged: firebaseAuth.onAuthStateChanged,
        };
    };
    const sanitizeForFirestore = (value: unknown): unknown => {
        if (value === undefined) return undefined;
        if (value === null) return null;

        if (Array.isArray(value)) {
            return value
                .map((item) => sanitizeForFirestore(item))
                .filter((item) => item !== undefined);
        }

        if (typeof value === "number") {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value === "object") {
            return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((acc, [key, entryValue]) => {
                const sanitizedValue = sanitizeForFirestore(entryValue);
                if (sanitizedValue !== undefined) {
                    acc[key] = sanitizedValue;
                }
                return acc;
            }, {});
        }

        return value;
    };

    const loadCloudBoard = async (boardId: string) => {
        const { db, doc, getDoc } = await getFirestoreClient();
        const snapshot = await getDoc(doc(db, "ideaboards", boardId));
        if (!snapshot.exists()) return false;

        const data = snapshot.data();
        const nextNodes = Array.isArray(data.nodes) ? data.nodes as CanvasNode[] : [];
        setNodes(nextNodes);
        setSelectedNodeIds([]);
        setActiveGroupId(null);
        setPaintLayer(new Set());
        setHistory({ past: [], future: [] });
        setCurrentCloudBoardId(boardId);
        setCurrentCloudBoardTitle(typeof data.title === "string" && data.title.trim() ? data.title : "Untitled");
        return true;
    };

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
        let isCancelled = false;

        const loadInitialState = async () => {
            const boardId = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("id")
                : null;

            if (boardId && isAdmin) {
                try {
                    const loadedFromCloud = await loadCloudBoard(boardId);
                    if (loadedFromCloud || isCancelled) {
                        if (!isCancelled) {
                            setIsLoaded(true);
                        }
                        return;
                    }
                } catch (error) {
                    console.error("Failed to load cloud board", error);
                }
            }

            const loaded = loadFrames();
            if (!isCancelled) {
                setNodes(loaded);
                setCurrentCloudBoardId(null);
                setCurrentCloudBoardTitle(null);
                setIsLoaded(true);
            }
        };

        loadInitialState();

        return () => {
            isCancelled = true;
        };
    }, [isAdmin]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const syncAuthState = async () => {
            const { auth, onAuthStateChanged } = await getAuthClient();
            unsubscribe = onAuthStateChanged(auth, (user) => {
                const nextEmail = user?.email ?? null;
                const nextIsAdmin = nextEmail === ADMIN_EMAIL;
                setAdminEmail(nextEmail);
                setIsAdmin(nextIsAdmin);

                if (typeof window !== "undefined") {
                    if (nextIsAdmin) {
                        localStorage.setItem("isAdmin", "true");
                    } else {
                        localStorage.removeItem("isAdmin");
                    }
                }
            });
        };

        syncAuthState();

        return () => {
            unsubscribe?.();
        };
    }, []);

    // Save to storage whenever nodes change (but only after initial load)
    useEffect(() => {
        if (isLoaded) {
            saveFrames(nodes);
        }
    }, [nodes, isLoaded]);

    const addNode = (node: CanvasNode) => {
        pushSnapshot();
        setNodes((prev) => {
            const hasActiveGroup = !!activeGroupId && prev.some((n) => n.id === activeGroupId && n.type === "GROUP");
            const nextGroupId = node.groupId ?? (hasActiveGroup ? activeGroupId ?? undefined : undefined);
            const nodeWithGroup = {
                ...node,
                ...(nextGroupId ? { groupId: nextGroupId } : {}),
            };
            return [...prev, nodeWithGroup];
        });
        setSelectedNodeIds([node.id]);
    };

    const addNodes = (newNodes: CanvasNode[]) => {
        pushSnapshot();
        setNodes((prev) => {
            const hasActiveGroup = !!activeGroupId && prev.some((n) => n.id === activeGroupId && n.type === "GROUP");
            const nodesWithGroup = newNodes.map((n) => {
                const nextGroupId = n.groupId ?? (hasActiveGroup ? activeGroupId ?? undefined : undefined);
                return {
                    ...n,
                    ...(nextGroupId ? { groupId: nextGroupId } : {}),
                };
            });
            return [...prev, ...nodesWithGroup];
        });
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
            const PADDING = 30;

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
                x: minX - PADDING,
                y: minY - PADDING,
                width: (maxX - minX) + (PADDING * 2),
                height: Math.max(0, maxY - minY) + (PADDING * 2),
                ...(parentGroupId ? { groupId: parentGroupId } : {})
            } as CanvasNode;

            const next = prev.map(n => selectedNodeIds.includes(n.id) ? { ...n, groupId } : n);
            return [newGroup, ...next];
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

    const openCloudBoard = async (id: string) => {
        if (!isAdmin) return false;
        const loaded = await loadCloudBoard(id);
        if (!loaded) return false;

        if (typeof window !== "undefined") {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("id", id);
            window.history.pushState({}, "", nextUrl.toString());
        }

        return true;
    };

    const saveToCloud = async () => {
        if (!isAdmin) {
            saveFrames(nodes);
            if (typeof window !== "undefined") {
                localStorage.setItem("asmemo_guest_last_saved_at", new Date().toISOString());
            }
            return "guest-local";
        }

        const nextId = currentCloudBoardId ?? crypto.randomUUID().replace(/-/g, "").slice(0, 12);
        let nextTitle = currentCloudBoardTitle;

        if (!currentCloudBoardId) {
            const providedTitle = typeof window !== "undefined"
                ? window.prompt("프로젝트 이름을 입력하세요", currentCloudBoardTitle || "Untitled")
                : "Untitled";

            if (providedTitle === null) {
                return null;
            }

            nextTitle = providedTitle.trim() || "Untitled";
        }

        const { db, doc, setDoc } = await getFirestoreClient();
        const sanitizedNodes = sanitizeForFirestore(nodes) as CanvasNode[];

        await setDoc(doc(db, "ideaboards", nextId), {
            nodes: sanitizedNodes,
            title: nextTitle || "Untitled",
            updatedAt: new Date().toISOString(),
        });

        setCurrentCloudBoardId(nextId);
        setCurrentCloudBoardTitle(nextTitle || "Untitled");

        if (typeof window !== "undefined") {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set("id", nextId);
            window.history.pushState({}, "", nextUrl.toString());

            try {
                await navigator.clipboard.writeText(nextUrl.toString());
            } catch (error) {
                console.error("Failed to copy cloud URL", error);
            }
        }

        return nextId;
    };

    const handleGoogleLogin = async () => {
        try {
            const { auth, googleProvider, signInWithPopup, signOut } = await getAuthClient();
            const result = await signInWithPopup(auth, googleProvider);
            const email = result.user.email ?? "";

            if (email === ADMIN_EMAIL) {
                setIsAdmin(true);
                setAdminEmail(email);
                if (typeof window !== "undefined") {
                    localStorage.setItem("isAdmin", "true");
                    window.alert("관리자 모드로 연결되었습니다.");
                }
                return;
            }

            await signOut(auth);
            setIsAdmin(false);
            setAdminEmail(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("isAdmin");
                window.alert("관리자 전용입니다. 방문자 모드(로컬 저장)로 사용됩니다.");
            }
        } catch (error) {
            console.error("Google login failed", error);
            setIsAdmin(false);
            setAdminEmail(null);
            if (typeof window !== "undefined") {
                localStorage.removeItem("isAdmin");
                window.alert("구글 로그인에 실패했습니다. 방문자 모드(로컬 저장)로 사용됩니다.");
            }
        }
    };

    const handleLogout = async () => {
        try {
            const { auth, signOut } = await getAuthClient();
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setIsAdmin(false);
            setAdminEmail(null);
            setCurrentCloudBoardId(null);
            setCurrentCloudBoardTitle(null);

            if (typeof window !== "undefined") {
                localStorage.removeItem("isAdmin");
            }
        }
    };

    const newProject = () => {
        setNodes([]);
        setSelectedNodeIds([]);
        setActiveGroupId(null);
        setCurrentCloudBoardId(null);
        setCurrentCloudBoardTitle(null);
        setPaintLayer(new Set());
        setHistory({ past: [], future: [] });
        setToolMode("select");

        if (typeof window !== "undefined") {
            window.history.pushState({}, "", window.location.pathname);
        }
    };

    return (
        <EditorContext.Provider
            value={{
                nodes,
                isAdmin,
                adminEmail,
                currentCloudBoardId,
                currentCloudBoardTitle,
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
                saveToCloud,
                openCloudBoard,
                handleGoogleLogin,
                handleLogout,
                newProject,
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
