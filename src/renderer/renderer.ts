import { decode, Tag } from 'nbt-ts';
import { unzip } from 'gzip-js';
import { loadSchematic, Schematic } from '@enginehub/schematicjs';
import { SchematicHandles } from '.';
import { SchematicRenderOptions } from './types';
import { getModelLoader } from './model/loader';
import { getResourceLoader } from '../resource/resourceLoader';
import NonOccludingBlocks from './nonOccluding.json';
import TransparentBlocks from './transparent.json';
import DataVersionMap from '../dataVersionMap.json';
import { POSSIBLE_FACES } from './model/types';
import { faceToFacingVector } from './utils';
import {
    Engine,
    Scene,
    Vector3,
    ArcRotateCamera,
    HemisphericLight,
    Color3,
    Color4,
} from 'babylonjs';

function parseNbt(nbt: string): Tag {
    const buff = Buffer.from(nbt, 'base64');
    const deflated = Buffer.from(unzip(buff));
    const data = decode(deflated, {
        unnamed: false,
        useMaps: true
    });
    return { [data.name]: [data.value] };
}

const INVISIBLE_BLOCKS = new Set([
    'air',
    'cave_air',
    'void_air',
    'structure_void',
    'barrier'
]);

export const TRANSPARENT_BLOCKS = new Set([
    ...INVISIBLE_BLOCKS,
    ...TransparentBlocks
]);

export const NON_OCCLUDING_BLOCKS = new Set([
    ...INVISIBLE_BLOCKS,
    ...NonOccludingBlocks
]);

export async function renderSchematic(
    canvas: HTMLCanvasElement,
    schematic: string,
    {
        corsBypassUrl,
        resourcePacks,
        size,
        orbit = true,
        renderArrow = true,
        renderBars = true,
        antialias = false,
        backgroundColor = 0xffffff
    }: SchematicRenderOptions
): Promise<SchematicHandles> {
    const engine = new Engine(canvas, antialias, {
        alpha: backgroundColor !== 'transparent',
        powerPreference: 'high-performance'
    });

    const scene = new Scene(engine);
    let hasDestroyed = false;

    if (size) {
        engine.setSize(size, size);
    }

    const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 2.5,
        10,
        new Vector3(0, 0, 0),
        scene
    );
    camera.wheelPrecision = 50;

    const light = new HemisphericLight('light1', new Vector3(1, 1, 0), scene);
    light.specular = new Color3(0, 0, 0);
    scene.ambientColor = new Color3(0.5, 0.5, 0.5);
    if (backgroundColor !== 'transparent') {
        scene.clearColor = Color4.FromHexString(
            `#${backgroundColor.toString(16)}FF`
        );
    } else {
        scene.clearColor = new Color4(0, 0, 0, 0);
    }

    canvas.addEventListener('contextmenu', e => {
        // right click is drag, don't let the menu get in the way.
        e.preventDefault();
        return false;
    });

    engine.runRenderLoop(() => {
        if (hasDestroyed) {
            return;
        }

        scene.render();
    });

    const rootTag = parseNbt(schematic);
    const loadedSchematic = loadSchematic((rootTag as any).Schematic[0]);

    const dataVersion = loadedSchematic.dataVersion;
    const jarUrl = DataVersionMap[dataVersion];

    const resourceLoader = await getResourceLoader([
        `${corsBypassUrl}${jarUrl}`,
        ...(resourcePacks ?? [])
    ]);
    const modelLoader = await getModelLoader(resourceLoader);

    const buildSceneFromSchematic = async (
        schematic: Schematic,
        scene: Scene
    ) => {
        for (const pos of schematic) {
            const { x, y, z } = pos;
            const block = schematic.getBlock(pos);

            if (!block) {
                console.log(
                    `Missing block ${x} ${y} ${z} ${JSON.stringify(schematic)}`
                );
                continue;
            }
            if (INVISIBLE_BLOCKS.has(block.type)) {
                continue;
            }

            let anyVisible = false;

            for (const face of POSSIBLE_FACES) {
                const faceOffset = faceToFacingVector(face);
                const offBlock = schematic.getBlock({
                    x: x + faceOffset[0],
                    y: y + faceOffset[1],
                    z: z + faceOffset[2]
                });

                if (!offBlock || NON_OCCLUDING_BLOCKS.has(offBlock.type)) {
                    anyVisible = true;
                    break;
                }
            }

            if (!anyVisible) {
                continue;
            }

            const meshes = await modelLoader.getModel(block, scene);
            for (const mesh of meshes) {
                if (!mesh) {
                    continue;
                }

                mesh.position.x += -schematic.width / 2 + x + 0.5;
                mesh.position.y += -schematic.height / 2 + y + 0.5;
                mesh.position.z += -schematic.length / 2 + z + 0.5;
                scene.addMesh(mesh);

                mesh.freezeWorldMatrix();
            }
        }

        scene.createOrUpdateSelectionOctree();
        resourceLoader.clearCache();
        modelLoader.clearCache();
    };

    await buildSceneFromSchematic(loadedSchematic, scene);
    const {
        width: worldWidth,
        height: worldHeight,
        length: worldLength
    } = loadedSchematic;

    const cameraOffset = Math.max(worldWidth, worldLength, worldHeight) / 2 + 1;
    camera.radius = cameraOffset;
    camera.attachControl(canvas, true);

    if (orbit) {
        scene.registerBeforeRender(() => {
            camera.alpha += 0.02;
        });
    }

    return {
        resize(size: number): void {
            engine.setSize(size, size);
        },
        destroy() {
            engine.dispose();
            hasDestroyed = true;
        }
    };
}
