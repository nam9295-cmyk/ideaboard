"use client";

import { useEffect, useState } from "react";
import { MousePointer2, Square, Type, Image as ImageIcon, Hand, ZoomIn, ZoomOut, Monitor, Smartphone, ChevronRight, FolderOpen, Sparkles } from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { screenToWorld } from "@/utils/coords";
import { snapToGrid } from "@/utils/snap";
import DashboardModal from "./DashboardModal";

export default function Toolbar() {
    const { addNode, pan, zoom, setPan, dimOutsideFrames, setDimOutsideFrames, gridSize, activeGroupId, setActiveGroupId, nodes, setSelection, deleteNodes, paintLayer, removePaint, newProject } = useEditor();
    const [showGrid, setShowGrid] = useState(true);
    const [showMajorGrid, setShowMajorGrid] = useState(true);
    const [hasRecentWork, setHasRecentWork] = useState(false);
    const [isDashboardOpen, setIsDashboardOpen] = useState(false);

    useEffect(() => {
        try {
            const storedShowGrid = localStorage.getItem("asmemo_show_grid");
            const storedShowMajor = localStorage.getItem("asmemo_show_major_grid");
            if (storedShowGrid !== null) setShowGrid(storedShowGrid === "true");
            if (storedShowMajor !== null) setShowMajorGrid(storedShowMajor === "true");
        } catch {
            // ignore storage errors
        }
    }, []);

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

    const applyGridSetting = (nextShowGrid: boolean, nextShowMajorGrid: boolean) => {
        setShowGrid(nextShowGrid);
        setShowMajorGrid(nextShowMajorGrid);
        try {
            localStorage.setItem("asmemo_show_grid", String(nextShowGrid));
            localStorage.setItem("asmemo_show_major_grid", String(nextShowMajorGrid));
        } catch {
            // ignore storage errors
        }
        window.dispatchEvent(new CustomEvent("asmemo:grid-settings-changed"));
    };

    const handleAddFrame = (width: number, height: number, name: string) => {
        const viewportCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 800;
        const viewportCenterY = typeof window !== 'undefined' ? window.innerHeight / 2 : 600;

        const canvasX = (viewportCenterX - pan.x) / zoom;
        const canvasY = (viewportCenterY - pan.y) / zoom;

        let x = canvasX - width / 2;
        let y = canvasY - height / 2;

        x = snapToGrid(x, gridSize);
        y = snapToGrid(y, gridSize);

        addNode({
            id: crypto.randomUUID(),
            type: 'FRAME',
            name,
            x,
            y,
            width,
            height,
        });
    };

    const activeGroupNode = activeGroupId ? nodes.find(n => n.id === activeGroupId) : null;

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

    return (
        <>
            <div className="h-12 bg-[#181A20] border-b border-[#313543] text-[#E2E8F0] flex items-center px-4 justify-between z-10 shrink-0">
                <div className="flex items-center space-x-2">
                    <span className="font-bold text-lg mr-4">MockupEditor</span>
                    <button
                        type="button"
                        onClick={handleNewProject}
                        className="flex items-center gap-2 border-2 border-[#E2E8F0] bg-[#3A1F24] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#FDE68A] shadow-[4px_4px_0px_0px_#000] hover:bg-[#4A252C]"
                        style={{ borderRadius: 0 }}
                    >
                        <Sparkles size={14} />
                        New
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsDashboardOpen(true)}
                        className="flex items-center gap-2 border-2 border-[#E2E8F0] bg-[#232734] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#E2E8F0] shadow-[4px_4px_0px_0px_#000] hover:bg-[#2D3340]"
                        style={{ borderRadius: 0 }}
                    >
                        <FolderOpen size={14} />
                        Projects
                    </button>
                    <div className="h-6 w-px bg-[#3B4252] mx-2" />

                    {/* Breadcrumb for Group Edit Mode */}
                    {activeGroupId && activeGroupNode && (
                        <div className="flex items-center space-x-2 text-sm mr-4 bg-[#232734] px-3 py-1.5 rounded-md border border-[#3B4252]">
                            <button
                                className="text-[#94A3B8] hover:text-white transition-colors"
                                onClick={() => {
                                    setActiveGroupId(null);
                                    setSelection([]);
                                }}
                            >
                                All
                            </button>
                            <ChevronRight size={14} className="text-[#64748B]" />
                            <span className="font-medium text-blue-300">
                                {(activeGroupNode as any).name || 'Group'}
                            </span>
                        </div>
                    )}

                    {!activeGroupId && (
                        <>
                            <button className="p-2 hover:bg-[#232734] rounded text-blue-400 bg-[#232734]">
                                <MousePointer2 size={18} />
                            </button>
                            <button className="p-2 hover:bg-[#232734] rounded text-[#94A3B8]">
                                <Hand size={18} />
                            </button>
                            <div className="h-6 w-px bg-[#3B4252] mx-2" />

                            <button
                                className="p-2 hover:bg-[#232734] rounded text-[#94A3B8]"
                                onClick={() => handleAddFrame(1440, 900, "Desktop")}
                                title="Add Desktop Frame (1440x900)"
                            >
                                <Monitor size={18} />
                            </button>
                            <button
                                className="p-2 hover:bg-[#232734] rounded text-[#94A3B8]"
                                onClick={() => handleAddFrame(390, 844, "Mobile")}
                                title="Add Mobile Frame (390x844)"
                            >
                                <Smartphone size={18} />
                            </button>

                            <div className="h-6 w-px bg-[#3B4252] mx-2" />

                            <button
                                className={`p-2 rounded hover:bg-[#232734] ${dimOutsideFrames ? "bg-[#2D3340] text-blue-400" : "text-[#94A3B8]"}`}
                                onClick={() => setDimOutsideFrames(!dimOutsideFrames)}
                                title="Toggle Focus Mode (Dim Outside)"
                            >
                                <Square size={18} className={dimOutsideFrames ? "fill-current" : ""} />
                            </button>
                            <button className="p-2 hover:bg-[#232734] rounded text-[#94A3B8]">
                                <Type size={18} />
                            </button>
                            <button className="p-2 hover:bg-[#232734] rounded text-[#94A3B8]">
                                <ImageIcon size={18} />
                            </button>
                            <div className="h-6 w-px bg-[#3B4252] mx-2" />
                            <button
                                className={`px-2 py-1 text-xs rounded border ${showGrid ? "bg-[#232734] text-blue-300 border-blue-900" : "bg-[#181A20] text-[#94A3B8] border-[#3B4252]"}`}
                                onClick={() => applyGridSetting(!showGrid, !showGrid ? showMajorGrid : false)}
                                title="Toggle Grid"
                            >
                                Grid
                            </button>
                            <button
                                className={`px-2 py-1 text-xs rounded border ${showMajorGrid && showGrid ? "bg-[#232734] text-blue-300 border-blue-900" : "bg-[#181A20] text-[#64748B] border-[#3B4252]"} ${!showGrid ? "opacity-50 cursor-not-allowed" : ""}`}
                                onClick={() => {
                                    if (!showGrid) return;
                                    applyGridSetting(showGrid, !showMajorGrid);
                                }}
                                title="Toggle Major Grid"
                                disabled={!showGrid}
                            >
                                Major
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        className="px-3 py-1.5 text-sm rounded border border-red-900 bg-[#3A1F24] text-red-300 hover:bg-[#4A252C]"
                        onClick={handleClearAll}
                        title="Clear All"
                    >
                        전체 지우기
                    </button>
                    <button
                        className={`px-3 py-1.5 text-sm rounded border ${hasRecentWork ? "border-blue-900 bg-[#232734] text-blue-300 hover:bg-[#2D3340]" : "border-[#3B4252] bg-[#181A20] text-[#64748B] cursor-not-allowed"}`}
                        onClick={handleFocusRecentWork}
                        title="최근 작업 위치로 이동"
                        disabled={!hasRecentWork}
                    >
                        최근 작업
                    </button>
                    <button className="p-1 hover:bg-[#232734] rounded text-[#94A3B8]">
                        <ZoomOut size={16} />
                    </button>
                    <span className="text-sm text-[#94A3B8] w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                    <button className="p-1 hover:bg-[#232734] rounded text-[#94A3B8]">
                        <ZoomIn size={16} />
                    </button>
                    <button className="ml-4 px-4 py-1.5 bg-[#E2E8F0] text-[#181A20] text-sm rounded hover:bg-white">
                        Export
                    </button>
                </div>
            </div>
            <DashboardModal isOpen={isDashboardOpen} onClose={() => setIsDashboardOpen(false)} />
        </>
    );
}
