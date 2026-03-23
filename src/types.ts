export type NodeType = 'FRAME' | 'TEXT' | 'BOX' | 'IMAGE' | 'LINE' | 'ARROW' | 'BUTTON' | 'INPUT' | 'CARD' | 'GROUP';
export type ToolMode = 'select' | 'text' | 'box' | 'line' | 'arrow' | 'button' | 'input' | 'card' | 'pencil' | 'eraser';

export interface BaseNode {
    id: string;
    x: number;
    y: number;
    type: NodeType;
    width?: number;
    height?: number;
    backgroundColor?: string;
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
    fontFamily?: 'JetBrains Mono' | 'Noto Sans KR' | 'IBM Plex Sans KR';
    fontWeight?: 'normal' | 'bold';
    textColor?: string;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
}

export interface BoxNode extends BaseNode {
    type: 'BOX';
    width: number;
    height: number;
    color?: string;
}

export interface ImageNode extends BaseNode {
    type: 'IMAGE';
    width: number;
    height: number;
    fileId: string;
    imageUrl: string;
    fit?: 'contain' | 'cover';
    name?: string;
}

export interface LineNode extends BaseNode {
    type: 'LINE';
    endX: number;
    endY: number;
    startNodeId?: string;
    endNodeId?: string;
}

export interface ArrowNode extends BaseNode {
    type: 'ARROW';
    endX: number;
    endY: number;
    startNodeId?: string;
    endNodeId?: string;
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

export type CanvasNode = FrameNode | TextNode | BoxNode | ImageNode | LineNode | ArrowNode | ButtonNode | InputNode | CardNode | GroupNode;

// Deprecated alias to help with transition if needed, but better to switch
// export type Frame = FrameNode; 
