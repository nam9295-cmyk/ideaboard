"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Models } from "appwrite";
import { CanvasNode, ToolMode } from "@/types";
import { loadFrames, saveFrames } from "@/utils/storage";
import { account, ADMIN_EMAIL, APPWRITE_BOARDS_COLLECTION_ID, APPWRITE_DATABASE_ID, APPWRITE_UPLOADS_BUCKET_ID, storage, tablesDB, ID, OAuthProvider, Permission, Role } from "@/lib/appwrite";

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
    exportVGE: () => Promise<boolean>;
    exportJSON: () => Promise<boolean>;
    importVGE: (file: File) => Promise<boolean>;
    uploadImageToCanvas: (file: File, spawnPos?: { x: number; y: number }) => Promise<boolean>;
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

type BoardDocument = Models.Row & {
    title: string;
    content: string;
    ownerEmail: string;
    ownerId: string;
};

const EditorContext = createContext<EditorState | undefined>(undefined);
const VGE_SIGNATURE = "verygooditor_v1";
type EdgeNode = Extract<CanvasNode, { type: "LINE" | "ARROW" }>;
type ExportPayload = {
    _signature: string;
    exportedAt: string;
    data: {
        nodes: CanvasNode[];
        edges: EdgeNode[];
    };
};
type SaveDialogFileType = {
    description: string;
    accept: Record<string, string[]>;
};
type SaveDialogHandle = {
    createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>;
        close: () => Promise<void>;
    }>;
};
type WindowWithSavePicker = Window & {
    showSaveFilePicker?: (options: {
        suggestedName: string;
        types: SaveDialogFileType[];
    }) => Promise<SaveDialogHandle>;
};
const IMAGE_DEFAULT_MAX_DIMENSION = 420;
const IMAGE_DEFAULT_MIN_WIDTH = 180;
const IMAGE_DEFAULT_MIN_HEIGHT = 120;
const IMAGE_UPLOAD_MAX_DIMENSION = 1600;
const IMAGE_UPLOAD_QUALITY = 0.82;

export function EditorProvider({ children }: { children: ReactNode }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [nodes, setNodes] = useState<CanvasNode[]>([]);
    const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminEmail, setAdminEmail] = useState<string | null>(null);
    const [adminUserId, setAdminUserId] = useState<string | null>(null);
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
    const getAuthRedirectUrl = (status: "success" | "failure") => {
        if (typeof window === "undefined") return "/";
        const url = new URL(window.location.href);
        url.searchParams.set("auth", status);
        return url.toString();
    };
    const isEdgeNode = (node: CanvasNode): node is EdgeNode => node.type === "LINE" || node.type === "ARROW";
    const buildExportPayload = (): ExportPayload => ({
        _signature: VGE_SIGNATURE,
        exportedAt: new Date().toISOString(),
        data: {
            nodes: nodes.filter((node) => !isEdgeNode(node)),
            edges: nodes.filter(isEdgeNode),
        },
    });
    const downloadExport = (suggestedName: string, blob: Blob) => {
        if (typeof window === "undefined") return;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = suggestedName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };
    const saveFileWithDialog = async (suggestedName: string, blob: Blob, types: SaveDialogFileType[]) => {
        if (typeof window === "undefined") return false;

        try {
            const savePickerWindow = window as WindowWithSavePicker;
            if (typeof savePickerWindow.showSaveFilePicker !== "function") {
                throw new TypeError("showSaveFilePicker is not supported");
            }

            const handle = await savePickerWindow.showSaveFilePicker({ suggestedName, types });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return false;
            }

            if (error instanceof ReferenceError || error instanceof TypeError) {
                downloadExport(suggestedName, blob);
                return true;
            }

            console.error("Failed to save export file", error);
            if (typeof window !== "undefined") {
                window.alert("파일 저장에 실패했습니다.");
            }
            return false;
        }
    };
    const restoreImportedCanvas = (nextNodes: CanvasNode[], title: string | null) => {
        setNodes(nextNodes);
        setSelectedNodeIds([]);
        setActiveGroupId(null);
        setPaintLayer(new Set());
        setHistory({ past: [], future: [] });
        setCurrentCloudBoardId(null);
        setCurrentCloudBoardTitle(title);
        setToolMode("select");

        if (typeof window !== "undefined") {
            window.history.pushState({}, "", window.location.pathname);
        }
    };

    const parseBoardContent = (rawContent: string): CanvasNode[] => {
        const parsed = JSON.parse(rawContent) as Partial<ExportPayload> | CanvasNode[];
        if (Array.isArray(parsed)) {
            return parsed as CanvasNode[];
        }

        if (parsed._signature !== VGE_SIGNATURE || !parsed.data || !Array.isArray(parsed.data.nodes)) {
            throw new Error("Invalid board content");
        }

        const importedEdges = Array.isArray(parsed.data.edges) ? parsed.data.edges : [];
        return [...parsed.data.nodes, ...importedEdges];
    };

    const loadImageSize = (file: File) => new Promise<{ width: number; height: number }>((resolve) => {
        if (typeof window === "undefined") {
            resolve({ width: 320, height: 200 });
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const image = new window.Image();

        image.onload = () => {
            const rawWidth = image.naturalWidth || 320;
            const rawHeight = image.naturalHeight || 200;
            const scale = Math.min(1, IMAGE_DEFAULT_MAX_DIMENSION / Math.max(rawWidth, rawHeight));
            URL.revokeObjectURL(objectUrl);
            resolve({
                width: Math.max(IMAGE_DEFAULT_MIN_WIDTH, Math.round(rawWidth * scale)),
                height: Math.max(IMAGE_DEFAULT_MIN_HEIGHT, Math.round(rawHeight * scale)),
            });
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ width: 320, height: 200 });
        };

        image.src = objectUrl;
    });
    const optimizeImageForUpload = (file: File) => new Promise<File>(async (resolve) => {
        if (typeof window === "undefined") {
            resolve(file);
            return;
        }

        if (
            file.type === "image/gif" ||
            file.type === "image/svg+xml"
        ) {
            resolve(file);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        const image = new window.Image();

        image.onload = async () => {
            try {
                const rawWidth = image.naturalWidth || 0;
                const rawHeight = image.naturalHeight || 0;
                if (!rawWidth || !rawHeight) {
                    URL.revokeObjectURL(objectUrl);
                    resolve(file);
                    return;
                }

                const scale = Math.min(1, IMAGE_UPLOAD_MAX_DIMENSION / Math.max(rawWidth, rawHeight));
                const targetWidth = Math.max(1, Math.round(rawWidth * scale));
                const targetHeight = Math.max(1, Math.round(rawHeight * scale));
                const canvas = document.createElement("canvas");
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const context = canvas.getContext("2d");

                if (!context) {
                    URL.revokeObjectURL(objectUrl);
                    resolve(file);
                    return;
                }

                context.drawImage(image, 0, 0, targetWidth, targetHeight);
                const blob = await new Promise<Blob | null>((blobResolve) => {
                    canvas.toBlob(blobResolve, "image/webp", IMAGE_UPLOAD_QUALITY);
                });

                URL.revokeObjectURL(objectUrl);

                if (!blob) {
                    resolve(file);
                    return;
                }

                const nextName = file.name.replace(/\.[^.]+$/, "") || "image";
                resolve(new File([blob], `${nextName}.webp`, { type: "image/webp" }));
            } catch {
                URL.revokeObjectURL(objectUrl);
                resolve(file);
            }
        };

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(file);
        };

        image.src = objectUrl;
    });

    const loadCloudBoard = async (boardId: string) => {
        const document = await tablesDB.getRow<BoardDocument>(
            APPWRITE_DATABASE_ID,
            APPWRITE_BOARDS_COLLECTION_ID,
            boardId,
        ) as BoardDocument;
        const nextNodes = parseBoardContent(document.content);
        setNodes(nextNodes);
        setSelectedNodeIds([]);
        setActiveGroupId(null);
        setPaintLayer(new Set());
        setHistory({ past: [], future: [] });
        setCurrentCloudBoardId(boardId);
        setCurrentCloudBoardTitle(typeof document.title === "string" && document.title.trim() ? document.title : "Untitled");
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
        let isCancelled = false;

        const syncAuthState = async () => {
            const authStatus = typeof window !== "undefined"
                ? new URLSearchParams(window.location.search).get("auth")
                : null;

            try {
                const user = await account.get();
                if (isCancelled) return;

                const nextEmail = user.email ?? null;
                const nextIsAdmin = nextEmail === ADMIN_EMAIL;

                if (!nextIsAdmin) {
                    await account.deleteSession("current");
                    if (isCancelled) return;
                    setIsAdmin(false);
                    setAdminEmail(null);
                    setAdminUserId(null);
                    if (authStatus === "success" && typeof window !== "undefined") {
                        window.alert("관리자 전용입니다. 방문자 모드(로컬 저장)로 사용됩니다.");
                    }
                } else {
                    setIsAdmin(true);
                    setAdminEmail(nextEmail);
                    setAdminUserId(user.$id);
                    if (authStatus === "success" && typeof window !== "undefined") {
                        window.alert("관리자 모드로 연결되었습니다.");
                    }
                }
            } catch (error) {
                if (isCancelled) return;
                setIsAdmin(false);
                setAdminEmail(null);
                setAdminUserId(null);

                if (authStatus === "failure" && typeof window !== "undefined") {
                    window.alert("구글 로그인에 실패했습니다. 방문자 모드(로컬 저장)로 사용됩니다.");
                }
            } finally {
                if (typeof window !== "undefined" && authStatus) {
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.delete("auth");
                    window.history.replaceState({}, "", nextUrl.toString());
                }
            }
        };

        void syncAuthState();

        return () => {
            isCancelled = true;
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

    const cleanupImageFiles = async (targetNodes: CanvasNode[]) => {
        const imageFileIds = Array.from(
            new Set(
                targetNodes
                    .filter((node): node is Extract<CanvasNode, { type: "IMAGE" }> => node.type === "IMAGE")
                    .map((node) => node.fileId)
                    .filter(Boolean)
            )
        );

        await Promise.all(
            imageFileIds.map(async (fileId) => {
                try {
                    await storage.deleteFile(APPWRITE_UPLOADS_BUCKET_ID, fileId);
                } catch (error) {
                    console.error(`Failed to delete image file ${fileId}`, error);
                }
            })
        );
    };

    const deleteNode = (id: string) => {
        const targetNode = nodes.find((n) => n.id === id);
        pushSnapshot();
        setNodes((prev) => prev.filter((n) => n.id !== id));
        setSelectedNodeIds((prev) => prev.filter((pid) => pid !== id));
        if (targetNode) {
            void cleanupImageFiles([targetNode]);
        }
    };

    const deleteNodes = (ids: string[]) => {
        const targetNodeIds = new Set(ids);
        const targetNodes = nodes.filter((n) => targetNodeIds.has(n.id));
        pushSnapshot();
        setNodes((prev) => prev.filter((n) => !ids.includes(n.id)));
        setSelectedNodeIds((prev) => prev.filter((pid) => !ids.includes(pid)));
        if (targetNodes.length > 0) {
            void cleanupImageFiles(targetNodes);
        }
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

        const sanitizedNodes = sanitizeForFirestore(nodes) as CanvasNode[];
        const content = JSON.stringify({
            _signature: VGE_SIGNATURE,
            exportedAt: new Date().toISOString(),
            data: {
                nodes: sanitizedNodes.filter((node) => !isEdgeNode(node)),
                edges: sanitizedNodes.filter(isEdgeNode),
            },
        });
        const payload = {
            title: nextTitle || "Untitled",
            content,
            ownerEmail: adminEmail || ADMIN_EMAIL,
            ownerId: adminUserId || "unknown",
        };
        const documentPermissions = adminUserId
            ? [
                Permission.read(Role.user(adminUserId)),
                Permission.update(Role.user(adminUserId)),
                Permission.delete(Role.user(adminUserId)),
            ]
            : undefined;

        if (currentCloudBoardId) {
            await tablesDB.updateRow(
                APPWRITE_DATABASE_ID,
                APPWRITE_BOARDS_COLLECTION_ID,
                currentCloudBoardId,
                payload,
            );
        } else {
            await tablesDB.createRow(
                APPWRITE_DATABASE_ID,
                APPWRITE_BOARDS_COLLECTION_ID,
                nextId || ID.unique(),
                payload,
                documentPermissions,
            );
        }

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

    const exportVGE = async () => {
        const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], { type: "application/json" });
        return saveFileWithDialog("베리굿기획안.vge", blob, [
            {
                description: "VeryGood Editor File",
                accept: { "application/json": [".vge"] },
            },
        ]);
    };

    const exportJSON = async () => {
        const blob = new Blob([JSON.stringify(buildExportPayload(), null, 2)], { type: "application/json" });
        return saveFileWithDialog("베리굿기획안.json", blob, [
            {
                description: "JSON File",
                accept: { "application/json": [".json"] },
            },
        ]);
    };

    const importVGE = async (file: File) => {
        const lowerName = file.name.toLowerCase();
        if (!lowerName.endsWith(".vge")) {
            if (typeof window !== "undefined") {
                window.alert(".vge 파일만 불러올 수 있습니다.");
            }
            return false;
        }

        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw) as Partial<ExportPayload>;

            if (parsed._signature !== VGE_SIGNATURE) {
                throw new Error("Invalid signature");
            }

            const importedNodes = Array.isArray(parsed.data?.nodes) ? parsed.data.nodes as CanvasNode[] : null;
            const importedEdges = Array.isArray(parsed.data?.edges) ? parsed.data.edges as EdgeNode[] : [];

            if (!importedNodes) {
                throw new Error("Invalid node payload");
            }

            const restoredNodes = importedNodes.some(isEdgeNode)
                ? importedNodes
                : [...importedNodes, ...importedEdges];
            const nextTitle = file.name.replace(/\.vge$/i, "") || "Imported Project";

            restoreImportedCanvas(restoredNodes, nextTitle);
            return true;
        } catch (error) {
            console.error("Failed to import VGE", error);
            if (typeof window !== "undefined") {
                window.alert("유효한 .vge 파일이 아닙니다.");
            }
            return false;
        }
    };

    const uploadImageToCanvas = async (file: File, spawnPos?: { x: number; y: number }) => {
        if (!isAdmin || !adminUserId) {
            if (typeof window !== "undefined") {
                window.alert("이미지 업로드는 관리자 로그인 후 사용할 수 있습니다.");
            }
            return false;
        }

        if (!file.type.startsWith("image/")) {
            if (typeof window !== "undefined") {
                window.alert("이미지 파일만 업로드할 수 있습니다.");
            }
            return false;
        }

        const optimizedFile = await optimizeImageForUpload(file);
        const imageSize = await loadImageSize(optimizedFile);
        const uploadedFile = await storage.createFile(
            APPWRITE_UPLOADS_BUCKET_ID,
            ID.unique(),
            optimizedFile,
            [
                Permission.read(Role.user(adminUserId)),
                Permission.update(Role.user(adminUserId)),
                Permission.delete(Role.user(adminUserId)),
            ],
        );
        const imageUrl = storage.getFileView(APPWRITE_UPLOADS_BUCKET_ID, uploadedFile.$id);
        const spawnOffset = Math.min(nodes.length, 6) * 24;
        const fallbackX = 120 + spawnOffset;
        const fallbackY = 120 + spawnOffset;

        addNode({
            id: crypto.randomUUID(),
            type: "IMAGE",
            x: spawnPos?.x ?? fallbackX,
            y: spawnPos?.y ?? fallbackY,
            width: imageSize.width,
            height: imageSize.height,
            fileId: uploadedFile.$id,
            imageUrl,
            fit: "cover",
            name: uploadedFile.name || optimizedFile.name || file.name || "Image",
        });

        return true;
    };

    const handleGoogleLogin = async () => {
        try {
            if (typeof window === "undefined") return;
            account.createOAuth2Session(
                OAuthProvider.Google,
                getAuthRedirectUrl("success"),
                getAuthRedirectUrl("failure"),
            );
        } catch (error) {
            console.error("Google login failed", error);
            if (typeof window !== "undefined") {
                window.alert("구글 로그인에 실패했습니다. 방문자 모드(로컬 저장)로 사용됩니다.");
            }
        }
    };

    const handleLogout = async () => {
        try {
            await account.deleteSession("current");
        } catch (error) {
            console.error("Logout failed", error);
        } finally {
            setIsAdmin(false);
            setAdminEmail(null);
            setAdminUserId(null);
            setCurrentCloudBoardId(null);
            setCurrentCloudBoardTitle(null);
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
                exportVGE,
                exportJSON,
                importVGE,
                uploadImageToCanvas,
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
