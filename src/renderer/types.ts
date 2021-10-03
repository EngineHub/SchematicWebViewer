export interface SchematicHandles {
    /**
     * @deprecated Use #setSize
     */
    resize(size: number): void;
    setSize(width: number, height: number): void;
    destroy(): void;
}

export interface SchematicRenderOptions {
    /**
     * Usage as number is deprecated and will be removed.
     */
    size?: number | { width: number; height: number };
    corsBypassUrl: string;
    resourcePacks?: string[];
    renderBars?: boolean;
    renderArrow?: boolean;
    orbit?: boolean;
    antialias?: boolean;
    backgroundColor?: number | 'transparent';
    debug?: boolean;
}
