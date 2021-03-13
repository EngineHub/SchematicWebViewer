export interface SchematicHandles {
    resize(size: number): void;
    destroy(): void;
}

export interface SchematicRenderOptions {
    size: number;
    jarUrl?: string | string[];
    renderBars?: boolean;
    renderArrow?: boolean;
    orbit?: boolean;
    antialias?: boolean;
    backgroundColor?: number | 'transparent';
    loadingSpinner?: boolean;
}
