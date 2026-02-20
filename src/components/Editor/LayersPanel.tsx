"use client";

import { useEditor } from "@/context/EditorContext";
import { CanvasNode } from "@/types";
import { useState } from "react";
import { Layout, Box, Type, Square, Minus, ArrowRight, RectangleHorizontal, LayoutTemplate, PenTool, LayoutDashboard, Eye, EyeOff, Lock, Unlock, ChevronRight, ChevronDown, ChevronLeft } from "lucide-react";

export default function LayersPanel() {
    const { nodes, selectedNodeIds, selectNode, paintLayer, paintLayerVisible, setPaintLayerVisible, updateNode, reorderNode, groupNodes, ungroupNodes, activeGroupId, setActiveGroupId, setSelection } = useEditor();
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Drag and Drop State
    const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
    const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null);
    const [dropPosition, setDropPosition] = useState<'above' | 'below' | null>(null);

    const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(() => {
        try {
            const saved = localStorage.getItem('asmemo_expanded_groups');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch {
            return new Set();
        }
    });

    const toggleGroup = (groupId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedGroupIds(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            localStorage.setItem('asmemo_expanded_groups', JSON.stringify(Array.from(next)));
            return next;
        });
    };

    const handleDoubleClick = (node: CanvasNode, currentValue: string) => {
        if (node.type === 'GROUP') {
            setActiveGroupId(node.id);
            setSelection([]);
            return;
        }
        setEditingNodeId(node.id);
        setEditValue(currentValue);
    };

    const handleSave = (node: CanvasNode) => {
        if (!editValue) return;

        if (node.type === 'FRAME' || node.type === 'GROUP') {
            updateNode(node.id, { name: editValue } as any);
        } else if (node.type === 'TEXT' || node.type === 'BUTTON') {
            updateNode(node.id, { text: editValue } as any);
        } else if (node.type === 'CARD') {
            updateNode(node.id, { title: editValue } as any);
        } else if (node.type === 'INPUT') {
            updateNode(node.id, { placeholder: editValue } as any);
        }
        setEditingNodeId(null);
    };

    const toggleVisible = (node: CanvasNode, e: React.MouseEvent) => {
        e.stopPropagation();
        updateNode(node.id, { visible: node.visible === false ? true : false });
    };

    const toggleLock = (node: CanvasNode, e: React.MouseEvent) => {
        e.stopPropagation();
        updateNode(node.id, { locked: node.locked === true ? false : true });
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'FRAME': return Layout;
            case 'GROUP': return LayoutDashboard;
            case 'TEXT': return Type;
            case 'BOX': return Square;
            case 'LINE': return Minus;
            case 'ARROW': return ArrowRight;
            case 'BUTTON': return RectangleHorizontal;
            case 'INPUT': return LayoutTemplate;
            case 'CARD': return Box;
            default: return Square;
        }
    };

    const getName = (node: CanvasNode) => {
        if ('name' in node) return node.name;
        if ('text' in node) return node.text;
        if ('title' in node) return node.title;
        if ('placeholder' in node) return node.placeholder;
        return node.type;
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedNodeId(id);
        // Required for Firefox
        e.dataTransfer.setData('text/plain', id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedNodeId === id) return;

        setDragOverNodeId(id);

        // Calculate whether we are in the top half or bottom half of the element
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height / 2) {
            // Note: Since the list is reversed, dropping 'above' visually means going earlier in the rendered list, 
            // which corresponds to 'above' (higher z-index) in our reorderNode logic based on visual positioning.
            setDropPosition('above');
        } else {
            setDropPosition('below');
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        setDragOverNodeId(null);
        setDropPosition(null);
    };

    const handleDrop = (e: React.DragEvent, id: string) => {
        e.preventDefault();
        setDragOverNodeId(null);
        setDropPosition(null);

        if (!draggedNodeId || draggedNodeId === id || !dropPosition) return;

        // Let's verify they are in the same section (both items, groups, or frames)
        const draggedNode = nodes.find(n => n.id === draggedNodeId);
        const targetNode = nodes.find(n => n.id === id);

        if (!draggedNode || !targetNode) return;

        // Optional: restriction to reorder within same sections
        // if (draggedNode.type !== targetNode.type) return; 

        reorderNode(draggedNodeId, id, dropPosition);
        setDraggedNodeId(null);
    };

    const handleDragEnd = () => {
        setDraggedNodeId(null);
        setDragOverNodeId(null);
        setDropPosition(null);
    };

    const renderLayerItem = (node: CanvasNode, depth: number = 0, isGroupChild: boolean = false) => {
        const isSelected = selectedNodeIds.includes(node.id);
        const Icon = getIcon(node.type);
        const name = getName(node);
        const isEditing = editingNodeId === node.id;
        const isVisible = node.visible !== false;
        const isLocked = node.locked === true;
        const isDragging = draggedNodeId === node.id;
        const isDragOver = dragOverNodeId === node.id;
        const isGroup = node.type === 'GROUP';
        const isExpanded = expandedGroupIds.has(node.id);
        const isActiveGroup = node.id === activeGroupId;

        const paddingLeft = `${16 + depth * 16}px`;

        return (
            <div key={node.id}>
                <div
                    draggable={!isGroupChild}
                    onDragStart={(e) => !isGroupChild && handleDragStart(e, node.id)}
                    onDragOver={(e) => !isGroupChild && handleDragOver(e, node.id)}
                    onDragLeave={!isGroupChild ? handleDragLeave : undefined}
                    onDrop={(e) => !isGroupChild && handleDrop(e, node.id)}
                    onDragEnd={!isGroupChild ? handleDragEnd : undefined}
                    className={`relative group flex items-center pr-4 py-2 text-sm cursor-pointer hover:bg-gray-100 ${isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-700'} ${isActiveGroup ? 'ring-1 ring-blue-300 bg-blue-50/70' : ''} ${!isVisible ? 'opacity-50' : ''} ${isDragging ? 'opacity-30' : ''}`}
                    style={{ paddingLeft }}
                    onClick={() => selectNode(node.id)}
                    onDoubleClick={() => handleDoubleClick(node, name || node.type)}
                >
                    {/* Visual Drop Indicators */}
                    {!isGroupChild && isDragOver && dropPosition === 'above' && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
                    )}
                    {!isGroupChild && isDragOver && dropPosition === 'below' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 z-10" />
                    )}

                    {isGroup ? (
                        <button onClick={(e) => toggleGroup(node.id, e)} className="p-0.5 mr-1 text-gray-400 hover:text-gray-600 rounded">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                    ) : (
                        <div className="w-5" />
                    )}

                    <Icon size={14} className="mr-2 shrink-0" />
                    {isEditing ? (
                        <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSave(node)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave(node);
                                if (e.key === 'Escape') setEditingNodeId(null);
                            }}
                            autoFocus
                            className="flex-1 w-0 bg-white border border-blue-500 rounded px-1 -my-1 py-1 outline-none text-xs text-black"
                        />
                    ) : (
                        <span className="truncate flex-1 text-xs">
                            {isGroupChild ? `${node.type}: ${name || node.type}` : (name || node.type)}
                        </span>
                    )}

                    <div className="flex items-center space-x-2 ml-2">
                        <button onClick={(e) => toggleLock(node, e)} title={isLocked ? "Unlock" : "Lock"} className="text-gray-400 hover:text-gray-600">
                            {isLocked ? <Lock size={12} /> : <Unlock size={12} className="opacity-0 group-hover:opacity-100" />}
                        </button>
                        <button onClick={(e) => toggleVisible(node, e)} title={isVisible ? "Hide" : "Show"} className="text-gray-400 hover:text-gray-600">
                            {isVisible ? <Eye size={12} className="opacity-0 group-hover:opacity-100" /> : <EyeOff size={12} />}
                        </button>
                    </div>
                </div>

                {isGroup && isExpanded && (
                    <div className="flex flex-col">
                        {reversedNodes.filter(child => child.groupId === node.id).map(child => renderLayerItem(child, depth + 1, true))}
                    </div>
                )}
            </div>
        );
    };

    // Note: Reversing items so newest added appears on top is standard in drawing apps.
    // However, nodes array orders by Z-index inherently. 
    // Usually layers are rendered reverse of Z-index (top layer is index 0 in list).
    const [...reversedNodes] = nodes;
    reversedNodes.reverse();

    const topLevelNodes = reversedNodes.filter(n => !n.groupId);
    const frames = topLevelNodes.filter(n => n.type === 'FRAME');
    const groups = topLevelNodes.filter(n => n.type === 'GROUP');
    const items = topLevelNodes.filter(n => n.type !== 'FRAME' && n.type !== 'GROUP');
    const hasGroupSelected = selectedNodeIds.some(id => nodes.find(n => n.id === id)?.type === 'GROUP');

    return (
        <aside className={`${isCollapsed ? 'w-12' : 'w-64'} bg-white border-r border-gray-200 flex flex-col z-10 shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out`}>
            <div className="flex border-b border-gray-200 shrink-0 items-center bg-gray-50 h-[41px]">
                {!isCollapsed && (
                    <div className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-center text-gray-500 pl-8">
                        Layers
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`p-2 text-gray-400 hover:text-gray-600 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
                    title={isCollapsed ? "Expand Layers" : "Collapse Layers"}
                >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
            </div>

            {!isCollapsed ? (
                <div className="flex-1 overflow-y-auto w-full py-4 min-w-[16rem]">
                    <div className="flex items-center justify-between px-4 mb-4">
                        <span className="font-semibold text-gray-700">Layers</span>
                        <div className="flex items-center space-x-2">
                            {hasGroupSelected && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); ungroupNodes(); }}
                                    className="text-[10px] px-2 py-1 bg-red-50 text-red-600 font-medium rounded hover:bg-red-100 transition-colors flex items-center"
                                    title="Ungroup Selected (Cmd/Ctrl + Shift + G)"
                                >
                                    Ungroup
                                </button>
                            )}
                            {selectedNodeIds.length >= 2 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); groupNodes(); }}
                                    className="text-[10px] px-2 py-1 bg-blue-100 text-blue-700 font-medium rounded hover:bg-blue-200 transition-colors flex items-center"
                                    title="Group Selected (Cmd/Ctrl + G)"
                                >
                                    <Box size={10} className="mr-1" />
                                    Group
                                </button>
                            )}
                        </div>
                    </div>

                    {frames.length > 0 && (
                        <div className="mb-6">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Frames</div>
                            {frames.map(n => renderLayerItem(n))}
                        </div>
                    )}

                    {groups.length > 0 && (
                        <div className="mb-6">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Groups</div>
                            {groups.map(n => renderLayerItem(n))}
                        </div>
                    )}

                    {items.length > 0 && (
                        <div className="mb-6">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Items</div>
                            {items.map(n => renderLayerItem(n))}
                        </div>
                    )}

                    {paintLayer.size > 0 && (
                        <div className="mb-6">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">Drawing</div>
                            <div className={`group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer ${!paintLayerVisible ? 'opacity-50' : ''}`}>
                                <PenTool size={14} className="mr-3 shrink-0 text-gray-400" />
                                <span className="truncate flex-1 text-xs italic text-gray-500">Pencil Details</span>
                                <div className="flex items-center space-x-2 ml-2">
                                    <button onClick={() => setPaintLayerVisible(!paintLayerVisible)} title={paintLayerVisible ? "Hide" : "Show"} className="text-gray-400 hover:text-gray-600">
                                        {paintLayerVisible ? <Eye size={12} className="opacity-0 group-hover:opacity-100" /> : <EyeOff size={12} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {nodes.length === 0 && paintLayer.size === 0 && (
                        <div className="px-4 text-xs text-gray-400 italic text-center mt-10">
                            No layers yet
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center pt-6 space-y-6 text-gray-400">
                    {/* Tiny visual representation when collapsed */}
                    <div className="flex flex-col items-center space-y-2 group cursor-pointer" onClick={() => setIsCollapsed(false)} title="Expand Layers">
                        <Layout size={18} className="group-hover:text-blue-500 transition-colors" />
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                        <div className="w-1 h-1 rounded-full bg-gray-300" />
                    </div>
                </div>
            )}
        </aside>
    );
}
