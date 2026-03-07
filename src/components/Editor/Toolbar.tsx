"use client";

import { useEffect, useState } from "react";
import {
    ArrowRight,
    Box,
    ChevronRight,
    Eraser,
    FolderOpen,
    Grid3X3,
    Minus,
    MousePointer2,
    MoonStar,
    PenTool,
    RectangleHorizontal,
    Save,
    Sparkles,
    Square,
    Type,
    LayoutTemplate,
    ZoomIn,
    ZoomOut,
} from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { ToolMode } from "@/types";
import DashboardModal from "./DashboardModal";

const TOOL_BUTTONS: Array<{ mode: ToolMode; icon: any; label: string }> = [
    { mode: "select", icon: MousePointer2, label: "Select" },
    { mode: "text", icon: Type, label: "Text" },
    { mode: "box", icon: Square, label: "Box" },
    { mode: "line", icon: Minus, label: "Line" },
    { mode: "arrow", icon: ArrowRight, label: "Arrow" },
    { mode: "button", icon: RectangleHorizontal, label: "Button" },
    { mode: "input", icon: LayoutTemplate, label: "Input" },
    { mode: "card", icon: Box, label: "Card" },
    { mode: "pencil", icon: PenTool, label: "Pencil" },
    { mode: "eraser", icon: Eraser, label: "Eraser" },
];

export default function Toolbar() {
    const {
        zoom,
        setPan,
        activeGroupId,
        setActiveGroupId,
        nodes,
        setSelection,
        deleteNodes,
        paintLayer,
        removePaint,
        toolMode,
        setToolMode,
        newProject,
        saveToCloud,
    } = useEditor();
    const [hasRecentWork, setHasRecentWork] = useState(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [isGridVisible, setIsGridVisible] = useState(true);
    const [isDeepCanvasMode, setIsDeepCanvasMode] = useState(false);

    useEffect(() => {
        const readRecentWork = () => {
            try {
                setHasRecentWork(!!localStorage.getItem("asmemo_last_work_pos"));
            } catch {
                setHasRecentWork(false);
            }
        };

        readRecentWork();
        window.addEventListener("storage", readRecentWork);
        window.addEventListener("asmemo:last-work-updated", readRecentWork as EventListener);
        return () => {
            window.removeEventListener("storage", readRecentWork);
            window.removeEventListener("asmemo:last-work-updated", readRecentWork as EventListener);
        };
    }, []);

    useEffect(() => {
        const readCanvasViewSettings = () => {
            try {
                const storedShowGrid = localStorage.getItem("asmemo_show_grid");
                const storedDeepCanvasMode = localStorage.getItem("asmemo_deep_canvas_mode");
                setIsGridVisible(storedShowGrid === null ? true : storedShowGrid === "true");
                setIsDeepCanvasMode(storedDeepCanvasMode === "true");
            } catch {
                setIsGridVisible(true);
                setIsDeepCanvasMode(false);
            }
        };

        readCanvasViewSettings();
        window.addEventListener("storage", readCanvasViewSettings);
        window.addEventListener("asmemo:grid-settings-changed", readCanvasViewSettings as EventListener);
        window.addEventListener("asmemo:canvas-view-settings-changed", readCanvasViewSettings as EventListener);
        return () => {
            window.removeEventListener("storage", readCanvasViewSettings);
            window.removeEventListener("asmemo:grid-settings-changed", readCanvasViewSettings as EventListener);
            window.removeEventListener("asmemo:canvas-view-settings-changed", readCanvasViewSettings as EventListener);
        };
    }, []);

    const activeGroupNode = activeGroupId ? nodes.find((n) => n.id === activeGroupId) : null;

    const handleClearAll = () => {
        if (nodes.length === 0 && paintLayer.size === 0) return;
        const confirmed = window.confirm("정말 지우겠습니까?");
        if (!confirmed) return;

        if (nodes.length > 0) {
            deleteNodes(nodes.map((n) => n.id));
        }
        if (paintLayer.size > 0) {
            paintLayer.forEach((key) => removePaint(key, true));
        }
        setSelection([]);
    };

    const handleFocusRecentWork = () => {
        try {
            const raw = localStorage.getItem("asmemo_last_work_pos");
            if (!raw) return;
            const parsed = JSON.parse(raw) as { x: number; y: number };
            const canvasViewport = document.querySelector("main.flex-1.relative.overflow-hidden.bg-\\[\\#22242B\\]") as HTMLElement | null;
            const viewportCenterX = canvasViewport ? canvasViewport.clientWidth / 2 : window.innerWidth / 2;
            const viewportCenterY = canvasViewport ? canvasViewport.clientHeight / 2 : window.innerHeight / 2;

            setPan({
                x: viewportCenterX - parsed.x * zoom,
                y: viewportCenterY - parsed.y * zoom,
            });
        } catch {
            // ignore parsing/storage errors
        }
    };

    const handleNewProject = () => {
        const hasWork = nodes.length > 0 || paintLayer.size > 0;
        if (hasWork) {
            const confirmed = window.confirm("저장하지 않은 내용은 사라집니다. 새로 시작하시겠습니까?");
            if (!confirmed) return;
        }
        newProject();
    };

    const handleShareToCloud = async () => {
        setIsSharing(true);
        setShareMessage(null);
        try {
            const boardId = await saveToCloud();
            if (!boardId) {
                setShareMessage("Save cancelled");
                return;
            }
            setShareMessage(`Saved (${boardId})`);
        } catch (error) {
            console.error("Failed to save board to cloud", error);
            setShareMessage(error instanceof Error ? `Save failed: ${error.message}` : "Save failed");
        } finally {
            setIsSharing(false);
            window.setTimeout(() => setShareMessage(null), 2500);
        }
    };

    const handleToggleGrid = () => {
        const nextValue = !isGridVisible;
        setIsGridVisible(nextValue);
        try {
            localStorage.setItem("asmemo_show_grid", String(nextValue));
            localStorage.setItem("asmemo_show_major_grid", String(nextValue));
        } catch {
            // ignore storage errors
        }
        window.dispatchEvent(new CustomEvent("asmemo:grid-settings-changed"));
    };

    const handleToggleDeepCanvasMode = () => {
        const nextValue = !isDeepCanvasMode;
        setIsDeepCanvasMode(nextValue);
        try {
            localStorage.setItem("asmemo_deep_canvas_mode", String(nextValue));
        } catch {
            // ignore storage errors
        }
        window.dispatchEvent(new CustomEvent("asmemo:canvas-view-settings-changed"));
    };

    const ToolIconButton = ({ mode, icon: Icon, label }: { mode: ToolMode; icon: any; label: string }) => (
        <button
            type="button"
            onClick={() => setToolMode(mode)}
            className={`flex h-8 w-8 shrink-0 items-center justify-center border transition-colors ${toolMode === mode
                ? "border-blue-500 bg-[#232734] text-blue-300 shadow-[2px_2px_0px_0px_#000]"
                : "border-[#3B4252] bg-[#1E2129] text-[#94A3B8] hover:bg-[#232734] hover:text-[#E2E8F0]"
                }`}
            style={{ borderRadius: 0 }}
            title={label}
        >
            <Icon size={14} />
        </button>
    );

    const SystemButton = ({
        onClick,
        icon: Icon,
        label,
        disabled,
        active = false,
        tone = "default",
    }: {
        onClick?: () => void;
        icon: any;
        label: string;
        disabled?: boolean;
        active?: boolean;
        tone?: "default" | "accent" | "danger";
    }) => {
        const toneClass = active
            ? "border-blue-500 bg-[#232734] text-blue-300 hover:bg-[#2D3340]"
            : tone === "accent"
                ? "border-[#E2E8F0] bg-[#E2E8F0] text-[#181A20] hover:bg-white"
                : tone === "danger"
                    ? "border-red-900 bg-[#3A1F24] text-red-300 hover:bg-[#4A252C]"
                    : "border-[#E2E8F0] bg-[#232734] text-[#E2E8F0] hover:bg-[#2D3340]";

        return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={`flex shrink-0 items-center gap-1.5 border-2 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-[3px_3px_0px_0px_#000] transition-colors whitespace-nowrap ${toneClass} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
                style={{ borderRadius: 0 }}
            >
                <Icon size={12} />
                {label}
            </button>
        );
    };

    return (
        <>
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#313543] bg-[#181A20] px-3 text-[#E2E8F0]">
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <span className="mr-1 shrink-0 text-[15px] font-black tracking-[0.1em] text-[#F8FAFC] uppercase">
                        Verygooditor
                    </span>

                    {activeGroupId && activeGroupNode && (
                        <div className="mr-1 flex shrink-0 items-center gap-1.5 border border-[#3B4252] bg-[#232734] px-2 py-1 text-xs">
                            <button
                                className="text-[#94A3B8] transition-colors hover:text-white"
                                onClick={() => {
                                    setActiveGroupId(null);
                                    setSelection([]);
                                }}
                            >
                                All
                            </button>
                            <ChevronRight size={12} className="text-[#64748B]" />
                            <span className="font-medium text-blue-300">
                                {(activeGroupNode as any).name || "Group"}
                            </span>
                        </div>
                    )}

                    <div className="h-6 w-px shrink-0 bg-[#313543]" />

                    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                        {TOOL_BUTTONS.map((tool) => (
                            <ToolIconButton key={tool.mode} mode={tool.mode} icon={tool.icon} label={tool.label} />
                        ))}
                    </div>

                </div>

                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                    <SystemButton onClick={handleToggleGrid} icon={Grid3X3} label="Grid" active={isGridVisible} />
                    <SystemButton onClick={handleToggleDeepCanvasMode} icon={MoonStar} label="Deep" active={isDeepCanvasMode} />
                    <SystemButton onClick={handleNewProject} icon={Sparkles} label="New" tone="default" />
                    <SystemButton onClick={() => setIsDashboardOpen(true)} icon={FolderOpen} label="Projects" />
                    <SystemButton onClick={handleShareToCloud} icon={Save} label={isSharing ? "Saving" : "Save"} disabled={isSharing} />
                    <SystemButton onClick={handleClearAll} icon={Square} label="Clear" tone="danger" />
                    <SystemButton onClick={handleFocusRecentWork} icon={ChevronRight} label="Recent" disabled={!hasRecentWork} />
                    <div className="mx-0.5 flex shrink-0 items-center gap-1 border border-[#3B4252] bg-[#1E2129] px-1.5 py-1 text-[#94A3B8] shadow-[2px_2px_0px_0px_#000]">
                        <button className="rounded p-0.5 transition-colors hover:bg-[#232734]" title="Zoom Out">
                            <ZoomOut size={12} />
                        </button>
                        <span className="w-10 text-center text-[10px] font-semibold">{(zoom * 100).toFixed(0)}%</span>
                        <button className="rounded p-0.5 transition-colors hover:bg-[#232734]" title="Zoom In">
                            <ZoomIn size={12} />
                        </button>
                    </div>
                    <SystemButton icon={Box} label="Export" tone="accent" />
                </div>
            </div>

            {shareMessage && (
                <div className="pointer-events-none absolute right-4 top-16 z-40 border border-[#3B4252] bg-[#181A20]/95 px-3 py-1 text-[11px] text-[#E2E8F0] shadow-[4px_4px_0px_0px_#000]">
                    {shareMessage}
                </div>
            )}

            <DashboardModal isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />
        </>
    );
}
