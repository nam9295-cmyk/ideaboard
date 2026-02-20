export type NodeType = 'FRAME' | 'TEXT' | 'BOX' | 'LINE' | 'ARROW' | 'BUTTON' | 'INPUT' | 'CARD' | 'GROUP';
export type ToolMode = 'select' | 'text' | 'box' | 'line' | 'arrow' | 'button' | 'input' | 'card' | 'pencil' | 'eraser';

export interface BaseNode {
    id: string;
    x: number;
    y: number;
    type: NodeType;
    width?: number;
    height?: number;
    groupId?: string;
    visible?: boolean;
    locked?: boolean;
}

export interface FrameNode extends BaseNode {
    type: 'FRAME';
    name: string;
    width: number;
    height: number;
}

export interface TextNode extends BaseNode {
    type: 'TEXT';
    text: string;
    fontSize: number;
}

export interface BoxNode extends BaseNode {
    type: 'BOX';
    width: number;
    height: number;
    color?: string;
}

export interface LineNode extends BaseNode {
    type: 'LINE';
    endX: number;
    endY: number;
}

export interface ArrowNode extends BaseNode {
    type: 'ARROW';
    endX: number;
    endY: number;
}

export interface ButtonNode extends BaseNode {
    type: 'BUTTON';
    text: string;
    width: number;
    height: number;
    variant?: 'primary' | 'secondary';
}

export interface InputNode extends BaseNode {
    type: 'INPUT';
    placeholder?: string;
    width: number;
    height: number;
}

export interface CardNode extends BaseNode {
    type: 'CARD';
    title?: string;
    width: number;
    height: number;
    content?: string;
}

export interface GroupNode extends BaseNode {
    type: 'GROUP';
    name: string;
    width: number;
    height: number;
}

export type CanvasNode = FrameNode | TextNode | BoxNode | LineNode | ArrowNode | ButtonNode | InputNode | CardNode | GroupNode;

// Deprecated alias to help with transition if needed, but better to switch
// export type Frame = FrameNode; 
