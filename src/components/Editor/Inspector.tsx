"use client";

import { useEditor } from "@/context/EditorContext";
import { CanvasNode } from "@/types";

export default function Inspector() {
    const { nodes, selectedNodeIds, updateNode } = useEditor();
    const PASTEL_COLORS = ['#F7CAC9', '#91A8D0', '#B4E1D1', '#FDFD96', '#E2D0F9', '#FFD3B6', '#A8E6CF', '#E2E8F0'];
    const measureText = (text: string, fontSize: number, fontFamily: string, fontWeight: "normal" | "bold") => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const lines = (text || " ").split("\n");
        const resolvedFontFamily = fontFamily === "Noto Sans KR"
            ? '"Noto Sans KR", sans-serif'
            : fontFamily === "IBM Plex Sans KR"
                ? '"IBM Plex Sans KR", sans-serif'
                : '"JetBrains Mono", monospace';

        if (!context) {
            return {
                width: Math.max(fontSize * 0.6, ...lines.map((line) => line.length * fontSize * 0.6)),
                height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2),
            };
        }

        context.font = `${fontWeight} ${fontSize}px ${resolvedFontFamily}`;
        return {
            width: Math.max(fontSize * 0.6, ...lines.map((line) => context.measureText(line || " ").width)),
            height: Math.max(fontSize * 1.2, lines.length * fontSize * 1.2),
        };
    };
    const updateTextNode = (node: Extract<CanvasNode, { type: "TEXT" }>, updates: Partial<CanvasNode>, resizeBox = false) => {
        if (!resizeBox) {
            updateNode(node.id, updates);
            return;
        }

        const nextFontSize = (updates as any).fontSize ?? node.fontSize ?? 14;
        const nextFontFamily = (updates as any).fontFamily ?? (node as any).fontFamily ?? "JetBrains Mono";
        const nextFontWeight = (updates as any).fontWeight ?? (node as any).fontWeight ?? "normal";
        const metrics = measureText(node.text, nextFontSize, nextFontFamily, nextFontWeight);
        updateNode(node.id, {
            ...updates,
            width: Math.max((node.width as number | undefined) ?? 0, Math.ceil(metrics.width + 16)),
            height: Math.max((node.height as number | undefined) ?? 0, Math.ceil(metrics.height + 10)),
        } as any);
    };

    // For now, if multiple nodes are selected, we can show a summary or just the first one?
    // Or maybe just show "Multiple Selection"
    const isMultiple = selectedNodeIds.length > 1;
    const selectedNode = selectedNodeIds.length === 1
        ? nodes.find((n) => n.id === selectedNodeIds[0])
        : null;

    if (!selectedNode && !isMultiple) {
        return (
            <div className="w-60 bg-[#181A20] border-l border-[#313543] flex flex-col z-10 shrink-0 text-[#E2E8F0]">
                <div className="p-4 border-b border-[#313543]">
                    <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Properties</h3>
                </div>
                <div className="p-8 text-center text-[#64748B] text-sm">
                    No selection
                </div>
            </div>
        );
    }

    if (isMultiple) {
        return (
            <div className="w-60 bg-[#181A20] border-l border-[#313543] flex flex-col z-10 shrink-0 text-[#E2E8F0]">
                <div className="p-4 border-b border-[#313543]">
                    <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Properties</h3>
                </div>
                <div className="p-8 text-center text-[#64748B] text-sm">
                    {selectedNodeIds.length} items selected
                </div>
            </div>
        );
    }

    // Add check to ensure selectedNode is defined (though find returns undefined)
    if (!selectedNode) return null;

    return (
        <div className="w-60 bg-[#181A20] border-l border-[#313543] flex flex-col z-10 shrink-0 text-[#E2E8F0]">
            <div className="p-4 border-b border-[#313543]">
                <h3 className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">Properties</h3>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">

                {/* Common Props: Position (Start Point for Lines) */}
                <div>
                    <label className="text-xs font-medium text-[#94A3B8] mb-2 block">
                        {(selectedNode.type === 'LINE' || selectedNode.type === 'ARROW') ? 'Start Point' : 'Position'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                            <span className="text-[#64748B] text-xs mr-2">X</span>
                            <input type="text" value={Math.round(selectedNode.x)} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                        </div>
                        <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                            <span className="text-[#64748B] text-xs mr-2">Y</span>
                            <input type="text" value={Math.round(selectedNode.y)} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                        </div>
                    </div>
                </div>

                {/* Line/Arrow Specific: End Point */}
                {(selectedNode.type === 'LINE' || selectedNode.type === 'ARROW') && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">End Point</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                                <span className="text-[#64748B] text-xs mr-2">X</span>
                                <input type="text" value={Math.round(selectedNode.endX)} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                            </div>
                            <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                                <span className="text-[#64748B] text-xs mr-2">Y</span>
                                <input type="text" value={Math.round(selectedNode.endY)} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                            </div>
                        </div>
                    </div>
                )}

                {/* Dimensions (For non-lines) */}
                {('width' in selectedNode && 'height' in selectedNode) && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Dimensions</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                                <span className="text-[#64748B] text-xs mr-2">W</span>
                                <input type="text" value={selectedNode.width} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                            </div>
                            <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                                <span className="text-[#64748B] text-xs mr-2">H</span>
                                <input type="text" value={selectedNode.height} className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]" readOnly />
                            </div>
                        </div>
                    </div>
                )}

                {/* Specific Node Properties */}
                {selectedNode.type === 'FRAME' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Name</label>
                        <input
                            type="text"
                            value={selectedNode.name}
                            className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none text-[#E2E8F0]"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'GROUP' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Group Name</label>
                        <input
                            type="text"
                            value={selectedNode.name}
                            onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                            className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none text-[#E2E8F0]"
                        />
                    </div>
                )}

                {selectedNode.type !== 'LINE' && selectedNode.type !== 'ARROW' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Background Color</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => updateNode(selectedNode.id, { backgroundColor: 'transparent', textColor: '#FFFFFF' } as any)}
                                className={`relative h-8 w-8 rounded-full border border-[#3B4252] overflow-hidden ${((selectedNode as any).backgroundColor || 'transparent') === 'transparent' ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181A20]' : ''}`}
                                style={{
                                    background:
                                        'linear-gradient(135deg, transparent 0%, transparent 44%, #ef4444 44%, #ef4444 56%, transparent 56%, transparent 100%), #ffffff',
                                }}
                                aria-label="Transparent background"
                            />
                            {PASTEL_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateNode(selectedNode.id, { backgroundColor: color, textColor: '#000000' } as any)}
                                    className={`h-8 w-8 rounded-full border border-[#3B4252] ${((selectedNode as any).backgroundColor || 'transparent') === color ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181A20]' : ''}`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Set background color ${color}`}
                                />
                            ))}
                            <label
                                className={`relative h-8 w-8 rounded-full border border-[#3B4252] overflow-hidden cursor-pointer bg-[#1E2129] ${((selectedNode as any).backgroundColor || 'transparent') !== 'transparent' && !PASTEL_COLORS.includes((selectedNode as any).backgroundColor || '') ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181A20]' : ''}`}
                                aria-label="Custom background color"
                            >
                                <input
                                    type="color"
                                    value={((selectedNode as any).backgroundColor && (selectedNode as any).backgroundColor !== 'transparent')
                                        ? (selectedNode as any).backgroundColor
                                        : '#E2E8F0'}
                                    onChange={(e) => updateNode(selectedNode.id, { backgroundColor: e.target.value, textColor: '#000000' } as any)}
                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                />
                                <div
                                    className="h-full w-full"
                                    style={{
                                        background: `conic-gradient(#ff6b6b, #ffd166, #06d6a0, #4cc9f0, #4361ee, #b5179e, #ff6b6b)`,
                                    }}
                                />
                            </label>
                        </div>
                        <div className="mt-3 flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                            <span className="text-[#64748B] text-xs mr-2">HEX</span>
                            <input
                                type="text"
                                value={((selectedNode as any).backgroundColor && (selectedNode as any).backgroundColor !== 'transparent')
                                    ? (selectedNode as any).backgroundColor.toUpperCase()
                                    : '#E2E8F0'}
                                onChange={(e) => {
                                    const value = e.target.value.toUpperCase();
                                    if (/^#[0-9A-F]{6}$/.test(value)) {
                                        updateNode(selectedNode.id, { backgroundColor: value, textColor: '#000000' } as any);
                                    }
                                }}
                                className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]"
                                placeholder="#E2E8F0"
                            />
                        </div>
                    </div>
                )}

                {selectedNode.type === 'TEXT' && (
                    <>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Font Size</label>
                            <div className="flex items-center border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1">
                                <input
                                    type="number"
                                    min={8}
                                    max={200}
                                    value={selectedNode.fontSize}
                                    onChange={(e) => updateTextNode(selectedNode, { fontSize: Math.max(8, Number(e.target.value) || 14) } as any, true)}
                                    className="w-full text-sm outline-none bg-transparent text-[#E2E8F0]"
                                />
                                <span className="text-[#64748B] text-xs ml-2">px</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Font Family</label>
                            <select
                                value={(selectedNode as any).fontFamily || "JetBrains Mono"}
                                onChange={(e) => updateTextNode(selectedNode, { fontFamily: e.target.value } as any, true)}
                                className="w-full text-sm border border-[#3B4252] rounded px-2 py-1 outline-none bg-[#1E2129] text-[#E2E8F0]"
                            >
                                <option value="JetBrains Mono">JetBrains Mono</option>
                                <option value="Noto Sans KR">Noto Sans KR</option>
                                <option value="IBM Plex Sans KR">IBM Plex Sans KR</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Weight</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateTextNode(selectedNode, { fontWeight: "normal" } as any, true)}
                                    className={`rounded border px-3 py-2 text-sm ${((selectedNode as any).fontWeight || "normal") === "normal" ? "border-blue-500 bg-[#232734] text-blue-300" : "border-[#3B4252] bg-[#1E2129] text-[#CBD5E1]"}`}
                                >
                                    Regular
                                </button>
                                <button
                                    type="button"
                                    onClick={() => updateTextNode(selectedNode, { fontWeight: "bold" } as any, true)}
                                    className={`rounded border px-3 py-2 text-sm font-bold ${((selectedNode as any).fontWeight || "normal") === "bold" ? "border-blue-500 bg-[#232734] text-blue-300" : "border-[#3B4252] bg-[#1E2129] text-[#CBD5E1]"}`}
                                >
                                    Bold
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Text Color</label>
                            <div className="flex gap-2">
                                {["#0F172A", "#FFFFFF"].map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => updateNode(selectedNode.id, { textColor: color } as any)}
                                        className={`h-8 w-8 rounded-full border border-[#3B4252] ${(((selectedNode as any).textColor || "#E2E8F0").toUpperCase() === color) ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-[#181A20]" : ""}`}
                                        style={{ backgroundColor: color }}
                                        aria-label={`Set text color ${color}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Alignment</label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    ["top", "left"], ["top", "center"], ["top", "right"],
                                    ["middle", "left"], ["middle", "center"], ["middle", "right"],
                                    ["bottom", "left"], ["bottom", "center"], ["bottom", "right"],
                                ].map(([verticalAlign, textAlign]) => {
                                    const active = (((selectedNode as any).verticalAlign || "top") === verticalAlign)
                                        && (((selectedNode as any).textAlign || "left") === textAlign);
                                    return (
                                        <button
                                            key={`${verticalAlign}-${textAlign}`}
                                            type="button"
                                            onClick={() => updateNode(selectedNode.id, { verticalAlign, textAlign } as any)}
                                            className={`h-10 rounded border flex items-center justify-center ${active ? "border-blue-500 bg-[#232734]" : "border-[#3B4252] bg-[#1E2129]"}`}
                                        >
                                            <div
                                                className={`${active ? "bg-blue-400" : "bg-[#64748B]"}`}
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: 2,
                                                    transform:
                                                        verticalAlign === "top"
                                                            ? `translateY(-8px)`
                                                            : verticalAlign === "bottom"
                                                                ? `translateY(8px)`
                                                                : "translateY(0)",
                                                    marginLeft:
                                                        textAlign === "left"
                                                            ? -18
                                                            : textAlign === "right"
                                                                ? 18
                                                                : 0,
                                                }}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Content</label>
                            <textarea
                                value={selectedNode.text}
                                className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none h-20 resize-none text-[#E2E8F0]"
                                readOnly
                            />
                        </div>
                    </>
                )}

                {selectedNode.type === 'BUTTON' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Label</label>
                        <input
                            type="text"
                            value={selectedNode.text}
                            className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none text-[#E2E8F0]"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'INPUT' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Placeholder</label>
                        <input
                            type="text"
                            value={selectedNode.placeholder || ''}
                            className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none text-[#E2E8F0]"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'CARD' && (
                    <>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Title</label>
                            <input
                                type="text"
                                value={selectedNode.title || ''}
                                className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none text-[#E2E8F0]"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Content</label>
                            <textarea
                                value={selectedNode.content || ''}
                                className="w-full text-sm border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 outline-none h-20 resize-none text-[#E2E8F0]"
                                readOnly
                            />
                        </div>
                    </>
                )}

                {selectedNode.type === 'BOX' && (
                    <div>
                        <label className="text-xs font-medium text-[#94A3B8] mb-2 block">Fill</label>
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded border border-[#3B4252] bg-[#1E2129]"></div>
                            <div className="flex-1 border border-[#3B4252] bg-[#1E2129] rounded px-2 py-1 text-sm text-[#CBD5E1]">
                                {selectedNode.color === 'transparent' ? 'None' : selectedNode.color || '#FFFFFF'}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
