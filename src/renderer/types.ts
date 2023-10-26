import type { Engine } from '@babylonjs/core';

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

export interface GetClientJarUrlProps {
    dataVersion: number;
    corsBypassUrl: string;
}

export interface SchematicRenderOptions {
    /**
     * Usage as number is deprecated and will be removed
     */
    size?: number | { width: number; height: number };
    /**
     * A url of a cors-anywhere instance to allow access to MC server jars. Required by the default `getClientJarUrl` function
     */
    corsBypassUrl?: string;
    /**
     * A function that returns the url of the client jar to use. Defaults to using the EngineHub Cassette Deck service
     */
    getClientJarUrl?: (props: GetClientJarUrlProps) => Promise<string>;
    /**
     * A list of resource pack URLs in priority order
     */
    resourcePacks?: string[];
    /**
     * Whether a grid should be rendered
     */
    renderBars?: boolean;
    /**
     * Whether an arrow to show direction should be rendered
     */
    renderArrow?: boolean;
    /**
     * Whether the view should automatically rotate when not being dragged by the user
     */
    orbit?: boolean;
    /**
     * The speed at which the view should orbit (default: 0.02)
     */
    orbitSpeed?: number;
    /**
     * Whether antialiasing should be enabled
     */
    antialias?: boolean;
    /**
     * Background color of the canvas (default: 0xffffff), or if it should be transparent
     */
    backgroundColor?: number | 'transparent';
    /**
     * Whether to enable further debug information
     */
    debug?: boolean;
    /**
     * Only update the view when {@link SchematicHandles#render} is called. This is useful if you want to control the rendering yourself
     */
    disableAutoRender?: boolean;
}
