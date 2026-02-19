"use client";

import { useEffect } from "react";
import { MousePointer2, Type, Square, ArrowRight, Minus, Box, RectangleHorizontal, LayoutTemplate, PenTool, Eraser } from "lucide-react";
import { useEditor } from "@/context/EditorContext";
import { ToolMode } from "@/types";

export default function Sidebar() {
    const { toolMode, setToolMode } = useEditor();

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

            if (e.key.toLowerCase() === 'v') {
                setToolMode('select');
            } else if (e.key.toLowerCase() === 't') {
                setToolMode('text');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setToolMode]);

    const ToolButton = ({ mode, icon: Icon, label }: { mode: ToolMode; icon: any; label: string }) => (
        <button
            onClick={() => setToolMode(mode)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md transition-colors text-sm font-medium
                ${toolMode === mode
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
        >
            <Icon size={18} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col z-10 shrink-0 h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-8">

                {/* BASICS Functionality */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        Basics
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="select" icon={MousePointer2} label="Select" />
                        <ToolButton mode="text" icon={Type} label="Text" />
                        <ToolButton mode="box" icon={Square} label="Box" />
                        <ToolButton mode="line" icon={Minus} label="Line" />
                        <ToolButton mode="arrow" icon={ArrowRight} label="Arrow" />
                    </div>
                </div>

                {/* UI ELEMENTS */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        UI Elements
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="button" icon={RectangleHorizontal} label="Button" />
                        <ToolButton mode="input" icon={LayoutTemplate} label="Input" />
                        <ToolButton mode="card" icon={Box} label="Card" />
                    </div>
                </div>

                {/* DRAWING */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
                        Drawing
                    </h3>
                    <div className="space-y-1">
                        <ToolButton mode="pencil" icon={PenTool} label="Pencil" />
                        <ToolButton mode="eraser" icon={Eraser} label="Eraser" />
                    </div>
                </div>

            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-400">Project: Untitled</p>
                <div className="mt-2 text-[10px] text-gray-300 flex space-x-2">
                    <span>V: Select</span>
                    <span>T: Text</span>
                </div>
            </div>
        </div>
    );
}
