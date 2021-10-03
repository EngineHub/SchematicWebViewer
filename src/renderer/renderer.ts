import { Block, loadSchematic } from '@enginehub/schematicjs';
import { SchematicHandles } from '.';
import { SchematicRenderOptions } from './types';
import { getModelLoader } from './model/loader';
import { getResourceLoader } from '../resource/resourceLoader';
import { BlockModelData, POSSIBLE_FACES } from './model/types';
import {
    faceToFacingVector,
    INVISIBLE_BLOCKS,
    NON_OCCLUDING_BLOCKS,
    parseNbt
} from './utils';
import {
    Engine,
    Scene,
    Vector3,
    ArcRotateCamera,
    HemisphericLight,
    Color3,
    Color4,
    Mesh
} from 'babylonjs';
import { loadBlockStateDefinition } from './model/parser';
import { addArrowToScene, addBarsToScene } from './shapes';

const CASSETTE_DECK_URL = `https://services.enginehub.org/cassette-deck/minecraft-versions/find?dataVersion=`;
const EARLIEST_DV = 1913;
const URL_1_13 =
    'https://launcher.mojang.com/v1/objects/c0b970952cdd279912da384cdbfc0c26e6c6090b/client.jar';

export async function renderSchematic(
    canvas: HTMLCanvasElement,
    schematic: string,
    {
        corsBypassUrl,
        resourcePacks,
        size,
        orbit = true,
        renderArrow = false,
        renderBars = false,
        antialias = false,
        backgroundColor = 0xffffff,
        debug = false
    }: SchematicRenderOptions
): Promise<SchematicHandles> {
    const engine = new Engine(canvas, antialias, {
        alpha: backgroundColor !== 'transparent',
        powerPreference: 'high-performance'
    });
    if (size) {
        if (typeof size === 'number') {
            engine.setSize(size, size);
            console.warn('Usage of deprecated `size: number` property in Schematic renderer.');
        } else {
            engine.setSize(size.width, size.height);
        }
    }

    const scene = new Scene(engine, {
        useGeometryUniqueIdsMap: true
    });

    scene.ambientColor = new Color3(0.5, 0.5, 0.5);
    if (backgroundColor !== 'transparent') {
        scene.clearColor = Color4.FromHexString(
            `#${backgroundColor.toString(16)}FF`
        );
    } else {
        scene.clearColor = new Color4(0, 0, 0, 0);
    }

    let hasDestroyed = false;

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

    engine.runRenderLoop(() => {
        if (hasDestroyed) {
            return;
        }

        scene.render();
    });

    const loadedSchematic = loadSchematic(
        (parseNbt(schematic) as any).Schematic[0]
    );

    const {
        width: worldWidth,
        height: worldHeight,
        length: worldLength
    } = loadedSchematic;

    const cameraOffset = Math.max(worldWidth, worldLength, worldHeight) / 2 + 1;
    camera.radius = cameraOffset * 3;

    const versionManifestFile = await (
        await fetch(
            `${corsBypassUrl}${CASSETTE_DECK_URL}${
                loadedSchematic.dataVersion ?? EARLIEST_DV
            }`
        )
    ).json();

    const resourceLoader = await getResourceLoader([
        `${corsBypassUrl}${versionManifestFile?.[0]?.clientJarUrl ?? URL_1_13}`,
        ...(resourcePacks ?? [])
    ]);
    const modelLoader = getModelLoader(resourceLoader);

    const blockModelLookup: Map<Block, BlockModelData> = new Map();

    for (const block of loadedSchematic.blockTypes) {
        if (INVISIBLE_BLOCKS.has(block.type)) {
            continue;
        }
        const blockState = await loadBlockStateDefinition(
            block.type,
            resourceLoader
        );
        const blockModelData = modelLoader.getBlockModelData(block, blockState);

        if (!blockModelData.models.length) {
            console.log(blockState);
            continue;
        }

        blockModelLookup.set(block, blockModelData);
    }

    Mesh.INSTANCEDMESH_SORT_TRANSPARENT = true;

    for (const pos of loadedSchematic) {
        const { x, y, z } = pos;
        const block = loadedSchematic.getBlock(pos);

        if (!block) {
            console.log(
                `Missing block ${x} ${y} ${z} ${JSON.stringify(
                    loadedSchematic
                )}`
            );
            continue;
        }

        const modelData = blockModelLookup.get(block);
        if (!modelData) {
            continue;
        }

        let anyVisible = false;

        for (const face of POSSIBLE_FACES) {
            const faceOffset = faceToFacingVector(face);
            const offBlock = loadedSchematic.getBlock({
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

        const option = modelLoader.getModelOption(modelData);

        const meshes = await modelLoader.getModel(option, block, scene);
        for (const mesh of meshes) {
            if (!mesh) {
                continue;
            }

            mesh.position.x += -worldWidth / 2 + x + 0.5;
            mesh.position.y += -worldHeight / 2 + y + 0.5;
            mesh.position.z += -worldLength / 2 + z + 0.5;
            mesh.freezeWorldMatrix();

            scene.addMesh(mesh);
        }
    }

    if (renderArrow) {
        addArrowToScene(scene, cameraOffset);
    }
    if (renderBars) {
        addBarsToScene(
            scene,
            cameraOffset,
            worldWidth,
            worldHeight,
            worldLength
        );
    }

    scene.createOrUpdateSelectionOctree();
    scene.freezeMaterials();
    if (debug) {
        scene.debugLayer.show();
    }
    blockModelLookup.clear();
    resourceLoader.clearCache();
    modelLoader.clearCache();

    camera.attachControl(false, true);

    if (orbit) {
        scene.registerBeforeRender(() => {
            camera.alpha += 0.02;
        });
    }

    return {
        resize(size: number): void {
            engine.setSize(size, size);
        },
        setSize(width: number, height: number): void {
            engine.setSize(width, height);
        },
        destroy() {
            engine.dispose();
            hasDestroyed = true;
        }
    };
}
