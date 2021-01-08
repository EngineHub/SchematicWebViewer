export interface SchematicHandles {
    resize(size: number): void;
    destroy(): void;
}

export interface SchematicRenderOptions {
    size: number;
    jarUrl?: string;
    renderBars?: boolean;
    renderArrow?: boolean;
    orbit?: boolean;
    antialias?: boolean;
}
