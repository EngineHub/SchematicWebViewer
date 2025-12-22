import type { Block } from '@enginehub/schematicjs';
import { loadSchematic } from '@enginehub/schematicjs';
import type { SchematicHandles } from '.';
import type { GetClientJarUrlProps, SchematicRenderOptions } from './types';
import { getModelLoader } from './model/loader';
import { getResourceLoader } from '../resource/resourceLoader';
import type { BlockModelData } from './model/types';
import { POSSIBLE_FACES } from './model/types';
import {
    faceToFacingVector,
    INVISIBLE_BLOCKS,
    NON_OCCLUDING_BLOCKS,
    parseNbt,
} from './utils';
import { loadBlockStateDefinition } from './model/parser';
import { addArrowToScene, addBarsToScene } from './shapes';
import {
    ArcRotateCamera,
    Color3,
    Color4,
    Engine,
    HemisphericLight,
    Mesh,
    Scene,
    ScenePerformancePriority,
    Vector3,
} from '@babylonjs/core';

const CASSETTE_DECK_URL = `https://services.enginehub.org/cassette-deck/minecraft-versions/find?dataVersion=`;
const URL_1_13 =
    'https://launcher.mojang.com/v1/objects/c0b970952cdd279912da384cdbfc0c26e6c6090b/client.jar';

function blockKey(block: Block): string {
    const props = block.properties ?? {};
    const keys = Object.keys(props);
    if (keys.length === 0) {
        return block.type;
    }

    keys.sort();
    let out = block.type + '[';
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (i > 0) {
            out += ',';
        }
        out += key + '=' + String(props[key]);
    }
    out += ']';
    return out;
}

async function getClientJarUrlDefault({
    dataVersion,
    corsBypassUrl,
}: GetClientJarUrlProps): Promise<string> {
    const versionManifestFile = dataVersion
        ? await (
              await fetch(`${corsBypassUrl}${CASSETTE_DECK_URL}${dataVersion}`)
          ).json()
        : undefined;

    return `${corsBypassUrl}${
        versionManifestFile?.[0]?.clientJarUrl ?? URL_1_13
    }`;
}

export async function renderSchematic(
    canvas: HTMLCanvasElement,
    schematic: string,
    {
        corsBypassUrl,
        getClientJarUrl = getClientJarUrlDefault,
        resourcePacks,
        size,
        orbit = true,
        orbitSpeed = 0.02,
        renderArrow = false,
        renderBars = false,
        antialias = false,
        backgroundColor = 0xffffff,
        debug = false,
        disableAutoRender = false,
    }: SchematicRenderOptions
): Promise<SchematicHandles> {
    const engine = new Engine(canvas, antialias, {
        alpha: backgroundColor !== 'transparent',
        powerPreference: 'high-performance',
    });
    if (size) {
        if (typeof size === 'number') {
            engine.setSize(size, size);
            console.warn(
                'Usage of deprecated `size: number` property in Schematic renderer.'
            );
        } else {
            engine.setSize(size.width, size.height);
        }
    }

    const scene = new Scene(engine, {
        useGeometryUniqueIdsMap: true,
        useClonedMeshMap: true,
    });
    scene.performancePriority = ScenePerformancePriority.Intermediate;
    scene.renderingManager.maintainStateBetweenFrames = true;
    scene.skipFrustumClipping = true;

    scene.ambientColor = new Color3(0.5, 0.5, 0.5);
    if (backgroundColor !== 'transparent') {
        const hex = backgroundColor.toString(16).padStart(6, '0');
        scene.clearColor = Color4.FromHexString(`#${hex}FF`);
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

    const render = () => {
        if (hasDestroyed) {
            return;
        }

        scene.render();
    };

    if (!disableAutoRender) {
        engine.runRenderLoop(render);
    }

    const loadedSchematic = loadSchematic(parseNbt(schematic));

    const {
        width: worldWidth,
        height: worldHeight,
        length: worldLength,
    } = loadedSchematic;

    const cameraOffset = Math.max(worldWidth, worldLength, worldHeight) / 2 + 1;
    camera.radius = cameraOffset * 3;

    const resourceLoader = await getResourceLoader([
        await getClientJarUrl({
            dataVersion: loadedSchematic.dataVersion,
            corsBypassUrl,
        }),
        ...(resourcePacks ?? []),
    ]);
    const modelLoader = getModelLoader(resourceLoader);

    const blockModelLookup: Map<string, BlockModelData> = new Map();

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

        blockModelLookup.set(blockKey(block), blockModelData);
    }

    Mesh.INSTANCEDMESH_SORT_TRANSPARENT = true;

    const worldXBase = -worldWidth / 2 + 0.5;
    const worldYBase = -worldHeight / 2 + 0.5;
    const worldZBase = -worldLength / 2 + 0.5;

    const neighborPos = { x: 0, y: 0, z: 0 };

    scene.blockMaterialDirtyMechanism = true;
    for (const pos of loadedSchematic) {
        const { x, y, z } = pos;
        const block = loadedSchematic.getBlock(pos);

        if (!block || INVISIBLE_BLOCKS.has(block.type)) {
            continue;
        }

        const modelData = blockModelLookup.get(blockKey(block));
        if (!modelData) {
            continue;
        }

        let anyVisible = false;

        for (const face of POSSIBLE_FACES) {
            const faceOffset = faceToFacingVector(face);
            neighborPos.x = x + faceOffset[0];
            neighborPos.y = y + faceOffset[1];
            neighborPos.z = z + faceOffset[2];
            const offBlock = loadedSchematic.getBlock(neighborPos);

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

            mesh.position.x += worldXBase + x;
            mesh.position.y += worldYBase + y;
            mesh.position.z += worldZBase + z;
            mesh.freezeWorldMatrix();
        }
    }
    scene.blockMaterialDirtyMechanism = false;

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
            camera.alpha += orbitSpeed;
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
            hasDestroyed = true;
            engine.stopRenderLoop(render);
            scene.dispose();
            engine.dispose();
        },
        render,
        getEngine(): Engine {
            return engine;
        },
    };
}
