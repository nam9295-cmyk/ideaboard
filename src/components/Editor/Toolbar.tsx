"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
    ArrowRight,
    Box,
    ChevronDown,
    ChevronRight,
    Eraser,
    FolderOpen,
    Grid3X3,
    LogIn,
    LogOut,
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
    Menu,
    ShieldCheck,
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
        setZoom,
        setPan,
        isAdmin,
        adminEmail,
        activeGroupId,
        setActiveGroupId,
        nodes,
        setSelection,
        paintLayer,
        toolMode,
        setToolMode,
        newProject,
        saveToCloud,
        exportVGE,
        exportJSON,
        importVGE,
        handleGoogleLogin,
        handleLogout,
    } = useEditor();
    const [hasRecentWork, setHasRecentWork] = useState(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [isGridVisible, setIsGridVisible] = useState(true);
    const [isDeepCanvasMode, setIsDeepCanvasMode] = useState(false);
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const fileMenuRef = useRef<HTMLDivElement | null>(null);
    const accountMenuRef = useRef<HTMLDivElement | null>(null);
    const [isFileMenuOpen, setIsFileMenuOpen] = useState(false);
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

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

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node;

            if (fileMenuRef.current && !fileMenuRef.current.contains(target)) {
                setIsFileMenuOpen(false);
            }

            if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
                setIsAccountMenuOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsFileMenuOpen(false);
                setIsAccountMenuOpen(false);
            }
        };

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("keydown", handleEscape);
        };
    }, []);

    const activeGroupNode = activeGroupId ? nodes.find((n) => n.id === activeGroupId) : null;

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

    const handleZoomOut = () => {
        setZoom((prev) => Math.max(0.2, Number((prev - 0.1).toFixed(2))));
    };

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(4, Number((prev + 0.1).toFixed(2))));
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
            if (boardId === "guest-local") {
                setShareMessage("Saved locally");
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

    const showActionMessage = (message: string) => {
        setShareMessage(message);
        window.setTimeout(() => setShareMessage(null), 2500);
    };

    const handleImportButtonClick = () => {
        setIsFileMenuOpen(false);
        importInputRef.current?.click();
    };

    const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        const imported = await importVGE(file);
        if (imported) {
            showActionMessage(`Imported (${file.name})`);
        }
    };

    const handleExportVGE = async () => {
        setIsFileMenuOpen(false);
        const exported = await exportVGE();
        if (exported) {
            showActionMessage("Saved (.vge)");
        }
    };

    const handleExportJSON = async () => {
        setIsFileMenuOpen(false);
        const exported = await exportJSON();
        if (exported) {
            showActionMessage("Saved (.json)");
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
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${toolMode === mode
                ? "border-blue-500/70 bg-[#1E2737] text-blue-300"
                : "border-[#303548] bg-[#151922] text-[#94A3B8] hover:bg-[#1B2230] hover:text-[#E2E8F0]"
                }`}
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
            ? "border-blue-500/70 bg-[#1E2737] text-blue-300 hover:bg-[#273245]"
            : tone === "accent"
                ? "border-[#303548] bg-[#F8FAFC] text-[#181A20] hover:bg-white"
                : tone === "danger"
                    ? "border-[#4D2630] bg-[#27191E] text-red-300 hover:bg-[#321E24]"
                    : "border-[#303548] bg-[#151922] text-[#E2E8F0] hover:bg-[#1B2230]";

        return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors whitespace-nowrap ${toneClass} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
                <Icon size={12} />
                {label}
            </button>
        );
    };

    const DropdownItem = ({
        onClick,
        icon: Icon,
        label,
        disabled = false,
        tone = "default",
    }: {
        onClick?: () => void;
        icon: any;
        label: string;
        disabled?: boolean;
        tone?: "default" | "danger";
    }) => (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${tone === "danger"
                ? "text-red-300 hover:bg-[#27191E]"
                : "text-[#E2E8F0] hover:bg-[#1B2230]"
                } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
        >
            <Icon size={14} />
            <span>{label}</span>
        </button>
    );

    return (
        <>
            <input
                ref={importInputRef}
                type="file"
                accept=".vge"
                className="hidden"
                onChange={handleImportChange}
            />
            <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[#2A3040] bg-[#12161F] px-4 text-[#E2E8F0]">
                <div className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
                    <span className="shrink-0 text-[15px] font-black tracking-[0.18em] text-[#F8FAFC] uppercase">
                        Verygooditor
                    </span>

                    {isAdmin ? (
                        <div ref={accountMenuRef} className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsAccountMenuOpen((prev) => !prev);
                                    setIsFileMenuOpen(false);
                                }}
                                className="flex items-center gap-2 rounded-lg border border-blue-500/40 bg-[#1E2737] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-300 transition-colors hover:bg-[#273245]"
                            >
                                <ShieldCheck size={13} />
                                <span>{adminEmail === "nam9295@gmail.com" ? "Admin" : "Signed In"}</span>
                                <ChevronDown size={13} className={`transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
                            </button>

                            {isAccountMenuOpen && (
                                <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[220px] rounded-xl border border-[#303548] bg-[#11161F] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                                    <div className="px-3 py-2 text-[11px] uppercase tracking-[0.08em] text-[#64748B]">
                                        {adminEmail || "Admin"}
                                    </div>
                                    <DropdownItem
                                        icon={ChevronRight}
                                        label="Recent"
                                        disabled={!hasRecentWork}
                                        onClick={() => {
                                            setIsAccountMenuOpen(false);
                                            handleFocusRecentWork();
                                        }}
                                    />
                                    <DropdownItem
                                        icon={LogOut}
                                        label="Logout"
                                        tone="danger"
                                        onClick={() => {
                                            setIsAccountMenuOpen(false);
                                            handleLogout();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <SystemButton onClick={handleGoogleLogin} icon={LogIn} label="Google" />
                    )}

                    {activeGroupId && activeGroupNode && (
                        <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#303548] bg-[#151922] px-3 py-2 text-xs">
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
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-center gap-3">
                    <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-xl border border-[#303548] bg-[#0F141D] px-2 py-1.5">
                        {TOOL_BUTTONS.map((tool) => (
                            <ToolIconButton key={tool.mode} mode={tool.mode} icon={tool.icon} label={tool.label} />
                        ))}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[#303548] bg-[#0F141D] p-1.5">
                        <button
                            type="button"
                            onClick={handleToggleGrid}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${isGridVisible
                                ? "border-blue-500/70 bg-[#1E2737] text-blue-300"
                                : "border-[#303548] bg-[#151922] text-[#94A3B8] hover:bg-[#1B2230] hover:text-[#E2E8F0]"
                                }`}
                            title="Grid"
                        >
                            <Grid3X3 size={14} />
                        </button>
                        <button
                            type="button"
                            onClick={handleToggleDeepCanvasMode}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${isDeepCanvasMode
                                ? "border-blue-500/70 bg-[#1E2737] text-blue-300"
                                : "border-[#303548] bg-[#151922] text-[#94A3B8] hover:bg-[#1B2230] hover:text-[#E2E8F0]"
                                }`}
                            title="Deep"
                        >
                            <MoonStar size={14} />
                        </button>
                        <div className="mx-1 h-6 w-px bg-[#252B39]" />
                        <button
                            type="button"
                            onClick={handleZoomOut}
                            className="rounded-md p-1.5 text-[#94A3B8] transition-colors hover:bg-[#151922] hover:text-[#E2E8F0]"
                            title="Zoom Out"
                        >
                            <ZoomOut size={13} />
                        </button>
                        <span className="w-10 text-center text-[10px] font-semibold text-[#CBD5E1]">{(zoom * 100).toFixed(0)}%</span>
                        <button
                            type="button"
                            onClick={handleZoomIn}
                            className="rounded-md p-1.5 text-[#94A3B8] transition-colors hover:bg-[#151922] hover:text-[#E2E8F0]"
                            title="Zoom In"
                        >
                            <ZoomIn size={13} />
                        </button>
                    </div>
                </div>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
                    <SystemButton onClick={handleNewProject} icon={Sparkles} label="New" tone="default" />
                    <SystemButton onClick={() => setIsDashboardOpen(true)} icon={FolderOpen} label="Projects" />
                    <SystemButton onClick={handleShareToCloud} icon={Save} label={isSharing ? "Saving" : "Save"} disabled={isSharing} />
                    <div ref={fileMenuRef} className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setIsFileMenuOpen((prev) => !prev);
                                setIsAccountMenuOpen(false);
                            }}
                            className="flex items-center gap-2 rounded-lg border border-[#303548] bg-[#151922] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#E2E8F0] transition-colors hover:bg-[#1B2230]"
                        >
                            <Menu size={13} />
                            <span>File</span>
                            <ChevronDown size={13} className={`transition-transform ${isFileMenuOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isFileMenuOpen && (
                            <div className="absolute right-0 top-[calc(100%+8px)] z-50 min-w-[220px] rounded-xl border border-[#303548] bg-[#11161F] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
                                <DropdownItem
                                    icon={Sparkles}
                                    label="New"
                                    onClick={() => {
                                        setIsFileMenuOpen(false);
                                        handleNewProject();
                                    }}
                                />
                                <DropdownItem icon={FolderOpen} label="불러오기 (.vge)" onClick={handleImportButtonClick} />
                                <DropdownItem icon={Save} label="백업 저장 (.vge)" onClick={handleExportVGE} />
                                <DropdownItem icon={Sparkles} label="AI 전달용 (.json)" onClick={handleExportJSON} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {shareMessage && (
                <div className="pointer-events-none absolute right-4 top-[4.25rem] z-40 rounded-lg border border-[#303548] bg-[#10151D]/95 px-3 py-1.5 text-[11px] text-[#E2E8F0] shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                    {shareMessage}
                </div>
            )}

            <DashboardModal isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />
        </>
    );
}
