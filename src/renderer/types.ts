export interface SchematicHandles {
    resize(size: number): void;
    destroy(): void;
}

export interface SchematicRenderOptions {
    size: number;
    texturePrefix?: string;
    renderBars?: boolean;
    renderArrow?: boolean;
}
