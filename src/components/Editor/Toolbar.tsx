"use client";

import { useEffect, useState } from "react";
import { MousePointer2, Square, Type, Image as ImageIcon, Hand, ZoomIn, ZoomOut, Monitor, Smartphone, ChevronRight } from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { screenToWorld } from "@/utils/coords";
import { snapToGrid } from "@/utils/snap";

export default function Toolbar() {
    const { addNode, pan, zoom, dimOutsideFrames, setDimOutsideFrames, gridSize, activeGroupId, setActiveGroupId, nodes, setSelection, deleteNodes, paintLayer, removePaint } = useEditor();
    const [showGrid, setShowGrid] = useState(true);
    const [showMajorGrid, setShowMajorGrid] = useState(true);

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

    return (
        <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 justify-between z-10 shrink-0">
            <div className="flex items-center space-x-2">
                <span className="font-bold text-lg mr-4">MockupEditor</span>
                <div className="h-6 w-px bg-gray-300 mx-2" />

                {/* Breadcrumb for Group Edit Mode */}
                {activeGroupId && activeGroupNode && (
                    <div className="flex items-center space-x-2 text-sm mr-4 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
                        <button
                            className="text-gray-500 hover:text-gray-900 transition-colors"
                            onClick={() => {
                                setActiveGroupId(null);
                                setSelection([]);
                            }}
                        >
                            All
                        </button>
                        <ChevronRight size={14} className="text-gray-400" />
                        <span className="font-medium text-blue-700">
                            {(activeGroupNode as any).name || 'Group'}
                        </span>
                    </div>
                )}

                {!activeGroupId && (
                    <>
                        <button className="p-2 hover:bg-gray-100 rounded text-blue-600 bg-blue-50">
                            <MousePointer2 size={18} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
                            <Hand size={18} />
                        </button>
                        <div className="h-6 w-px bg-gray-300 mx-2" />

                        <button
                            className="p-2 hover:bg-gray-100 rounded text-gray-600"
                            onClick={() => handleAddFrame(1440, 900, "Desktop")}
                            title="Add Desktop Frame (1440x900)"
                        >
                            <Monitor size={18} />
                        </button>
                        <button
                            className="p-2 hover:bg-gray-100 rounded text-gray-600"
                            onClick={() => handleAddFrame(390, 844, "Mobile")}
                            title="Add Mobile Frame (390x844)"
                        >
                            <Smartphone size={18} />
                        </button>

                        <div className="h-6 w-px bg-gray-300 mx-2" />

                        <button
                            className={`p-2 rounded hover:bg-gray-100 ${dimOutsideFrames ? "bg-gray-200 text-blue-600" : "text-gray-600"}`}
                            onClick={() => setDimOutsideFrames(!dimOutsideFrames)}
                            title="Toggle Focus Mode (Dim Outside)"
                        >
                            <Square size={18} className={dimOutsideFrames ? "fill-current" : ""} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
                            <Type size={18} />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded text-gray-600">
                            <ImageIcon size={18} />
                        </button>
                        <div className="h-6 w-px bg-gray-300 mx-2" />
                        <button
                            className={`px-2 py-1 text-xs rounded border ${showGrid ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200"}`}
                            onClick={() => applyGridSetting(!showGrid, !showGrid ? showMajorGrid : false)}
                            title="Toggle Grid"
                        >
                            Grid
                        </button>
                        <button
                            className={`px-2 py-1 text-xs rounded border ${showMajorGrid && showGrid ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-400 border-gray-200"} ${!showGrid ? "opacity-50 cursor-not-allowed" : ""}`}
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
                    className="px-3 py-1.5 text-sm rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    onClick={handleClearAll}
                    title="Clear All"
                >
                    전체 지우기
                </button>
                <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    <ZoomOut size={16} />
                </button>
                <span className="text-sm text-gray-500 w-12 text-center">{(zoom * 100).toFixed(0)}%</span>
                <button className="p-1 hover:bg-gray-100 rounded text-gray-600">
                    <ZoomIn size={16} />
                </button>
                <button className="ml-4 px-4 py-1.5 bg-black text-white text-sm rounded hover:bg-gray-800">
                    Export
                </button>
            </div>
        </div>
    );
}
