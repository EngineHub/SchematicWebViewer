import { Engine } from 'babylonjs';

export interface SchematicHandles {
    /**
     * @deprecated Use #setSize
     */
    resize(size: number): void;
    /**
     * Set the size of the renderer.
     *
     * @param width The width
     * @param height The height
     */
    setSize(width: number, height: number): void;
    /**
     * Cleanup the resources associated with this renderer.
     */
    destroy(): void;
    /**
     * Call this to manually render the scene.
     *
     * To disable automatic rendering and purely rely on this function, see {@link SchematicRenderOptions#disableAutoRender}.
     */
    render(): void;
    /**
     * Gets the internal BabylonJS engine.
     *
     * Note: This method is provided for advanced use cases and should not be used in most cases.
     */
    getEngine(): Engine;
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
    disableAutoRender?: boolean;
}
