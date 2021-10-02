export interface SchematicHandles {
    resize(size: number): void;
    destroy(): void;
}

export interface SchematicRenderOptions {
    size?: number;
    corsBypassUrl: string;
    resourcePacks?: string[];
    renderBars?: boolean;
    renderArrow?: boolean;
    orbit?: boolean;
    antialias?: boolean;
    backgroundColor?: number | 'transparent';
    debug?: boolean;
}
