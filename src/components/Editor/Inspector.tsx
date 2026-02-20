"use client";

import { useEditor } from "@/context/EditorContext";

export default function Inspector() {
    const { nodes, selectedNodeIds, updateNode } = useEditor();

    // For now, if multiple nodes are selected, we can show a summary or just the first one?
    // Or maybe just show "Multiple Selection"
    const isMultiple = selectedNodeIds.length > 1;
    const selectedNode = selectedNodeIds.length === 1
        ? nodes.find((n) => n.id === selectedNodeIds[0])
        : null;

    if (!selectedNode && !isMultiple) {
        return (
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Properties</h3>
                </div>
                <div className="p-8 text-center text-gray-400 text-sm">
                    No selection
                </div>
            </div>
        );
    }

    if (isMultiple) {
        return (
            <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0">
                <div className="p-4 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Properties</h3>
                </div>
                <div className="p-8 text-center text-gray-400 text-sm">
                    {selectedNodeIds.length} items selected
                </div>
            </div>
        );
    }

    // Add check to ensure selectedNode is defined (though find returns undefined)
    if (!selectedNode) return null;

    return (
        <div className="w-72 bg-white border-l border-gray-200 flex flex-col z-10 shrink-0">
            <div className="p-4 border-b border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Properties</h3>
            </div>
            <div className="p-4 space-y-6 overflow-y-auto flex-1">

                {/* Common Props: Position (Start Point for Lines) */}
                <div>
                    <label className="text-xs font-medium text-gray-500 mb-2 block">
                        {(selectedNode.type === 'LINE' || selectedNode.type === 'ARROW') ? 'Start Point' : 'Position'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                            <span className="text-gray-400 text-xs mr-2">X</span>
                            <input type="text" value={Math.round(selectedNode.x)} className="w-full text-sm outline-none" readOnly />
                        </div>
                        <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                            <span className="text-gray-400 text-xs mr-2">Y</span>
                            <input type="text" value={Math.round(selectedNode.y)} className="w-full text-sm outline-none" readOnly />
                        </div>
                    </div>
                </div>

                {/* Line/Arrow Specific: End Point */}
                {(selectedNode.type === 'LINE' || selectedNode.type === 'ARROW') && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">End Point</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                                <span className="text-gray-400 text-xs mr-2">X</span>
                                <input type="text" value={Math.round(selectedNode.endX)} className="w-full text-sm outline-none" readOnly />
                            </div>
                            <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                                <span className="text-gray-400 text-xs mr-2">Y</span>
                                <input type="text" value={Math.round(selectedNode.endY)} className="w-full text-sm outline-none" readOnly />
                            </div>
                        </div>
                    </div>
                )}

                {/* Dimensions (For non-lines) */}
                {('width' in selectedNode && 'height' in selectedNode) && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Dimensions</label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                                <span className="text-gray-400 text-xs mr-2">W</span>
                                <input type="text" value={selectedNode.width} className="w-full text-sm outline-none" readOnly />
                            </div>
                            <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                                <span className="text-gray-400 text-xs mr-2">H</span>
                                <input type="text" value={selectedNode.height} className="w-full text-sm outline-none" readOnly />
                            </div>
                        </div>
                    </div>
                )}

                {/* Specific Node Properties */}
                {selectedNode.type === 'FRAME' && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Name</label>
                        <input
                            type="text"
                            value={selectedNode.name}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'GROUP' && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Group Name</label>
                        <input
                            type="text"
                            value={selectedNode.name}
                            onChange={(e) => updateNode(selectedNode.id, { name: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none"
                        />
                    </div>
                )}

                {selectedNode.type === 'TEXT' && (
                    <>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Content</label>
                            <textarea
                                value={selectedNode.text}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none h-20 resize-none"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Font Size</label>
                            <div className="flex items-center border border-gray-200 rounded px-2 py-1">
                                <input type="text" value={selectedNode.fontSize} className="w-full text-sm outline-none" readOnly />
                                <span className="text-gray-400 text-xs ml-2">px</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Font Family</label>
                            <select
                                value={(selectedNode as any).fontFamily || "JetBrains Mono"}
                                onChange={(e) => updateNode(selectedNode.id, { fontFamily: e.target.value } as any)}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none bg-white"
                            >
                                <option value="JetBrains Mono">JetBrains Mono</option>
                                <option value="Noto Sans KR">Noto Sans KR</option>
                                <option value="IBM Plex Sans KR">IBM Plex Sans KR</option>
                            </select>
                        </div>
                    </>
                )}

                {selectedNode.type === 'BUTTON' && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Label</label>
                        <input
                            type="text"
                            value={selectedNode.text}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'INPUT' && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Placeholder</label>
                        <input
                            type="text"
                            value={selectedNode.placeholder || ''}
                            className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none"
                            readOnly
                        />
                    </div>
                )}

                {selectedNode.type === 'CARD' && (
                    <>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Title</label>
                            <input
                                type="text"
                                value={selectedNode.title || ''}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 mb-2 block">Content</label>
                            <textarea
                                value={selectedNode.content || ''}
                                className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none h-20 resize-none"
                                readOnly
                            />
                        </div>
                    </>
                )}

                {selectedNode.type === 'BOX' && (
                    <div>
                        <label className="text-xs font-medium text-gray-500 mb-2 block">Fill</label>
                        <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded border border-gray-200 bg-white"></div>
                            <div className="flex-1 border border-gray-200 rounded px-2 py-1 text-sm text-gray-600">
                                {selectedNode.color === 'transparent' ? 'None' : selectedNode.color || '#FFFFFF'}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
