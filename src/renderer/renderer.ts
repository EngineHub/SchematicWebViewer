import { decode, Tag } from 'nbt-ts';
import { unzip } from 'gzip-js';
import { loadSchematic, Schematic } from '@enginehub/schematicjs';
import { SchematicHandles } from '.';
import { SchematicRenderOptions } from './types';
import { getModelLoader } from './model/loader';
import { getResourceLoader } from '../resource/resourceLoader';
import NonOccludingBlocks from './nonOccluding.json';
import DataVersionMap from '../dataVersionMap.json';
import { POSSIBLE_FACES } from './model/types';
import { faceToFacingVector, runPromisePool } from './utils';
import {
    Engine,
    Scene,
    Vector3,
    ArcRotateCamera,
    HemisphericLight,
    Mesh,
    Color3
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
        backgroundColor = 0xffffff,
    }: SchematicRenderOptions
): Promise<SchematicHandles> {
    const engine = new Engine(canvas, antialias, {
        preserveDrawingBuffer: true,
        stencil: true,
        alpha: backgroundColor === 'transparent',
        powerPreference: 'high-performance',
    });

    const scene = new Scene(engine);
    let hasDestroyed = false;

    // if (backgroundColor !== 'transparent') {
    //     renderer.setClearColor(new Color(backgroundColor));
    // }
    engine.setSize(size, size);

    const camera = new ArcRotateCamera(
        'camera',
        -Math.PI / 2,
        Math.PI / 2.5,
        10,
        new Vector3(0, 0, 0),
        scene
    );
    camera.attachControl(canvas, true);

    const light = new HemisphericLight('light1', new Vector3(1, 1, 0), scene);
    light.specular = new Color3(0, 0, 0);

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
        const meshMap = new Map<string, Mesh>();

        await runPromisePool(
            Array.from(schematic).map(pos => async () => {
                const { x, y, z } = pos;
                const block = schematic.getBlock(pos);
                if (!block) {
                    console.log(
                        `Missing block ${x} ${y} ${z} ${JSON.stringify(
                            schematic
                        )}`
                    );
                    return;
                }
                if (INVISIBLE_BLOCKS.has(block.type)) {
                    return;
                }

                let anyVisible = false;

                for (const face of POSSIBLE_FACES) {
                    const faceOffset = faceToFacingVector(face);
                    const offBlock = schematic.getBlock({
                        x: x + faceOffset[0],
                        y: y + faceOffset[1],
                        z: z + faceOffset[2]
                    });

                    if (!offBlock || TRANSPARENT_BLOCKS.has(offBlock.type)) {
                        anyVisible = true;
                        break;
                    }
                }

                if (!anyVisible) {
                    return;
                }

                const blockKey = JSON.stringify(block);

                if (!meshMap.has(blockKey)) {
                    const rootMesh = await modelLoader.getModel(block, scene);
                    if (!rootMesh) {
                        return;
                    }
                    rootMesh.isVisible = false;
                    meshMap.set(blockKey, rootMesh);
                }

                // Clone instead of instance for proper transparency support.
                const mesh = meshMap.get(blockKey).clone();
                mesh.isVisible = true;

                mesh.position.x = -schematic.width / 2 + x + 0.5;
                mesh.position.y = -schematic.height / 2 + y + 0.5;
                mesh.position.z = -schematic.length / 2 + z + 0.5;
                scene.addMesh(mesh);

                mesh.freezeWorldMatrix();
            }),
            25
        );

        meshMap.clear();
        scene.createOrUpdateSelectionOctree();
    };

    await buildSceneFromSchematic(loadedSchematic, scene);
    const {
        width: worldWidth,
        height: worldHeight,
        length: worldLength
    } = loadedSchematic;

    const cameraOffset = Math.max(worldWidth, worldLength) / 2 + 1;
    camera.radius = cameraOffset;

    // if (renderArrow) {
    //     const arrowMaterial = new MeshBasicMaterial({
    //         color: new Color(0x000000)
    //     });
    //     const arrowGeometry = new CylinderGeometry(
    //         cameraOffset / 4,
    //         cameraOffset / 4,
    //         cameraOffset / 200,
    //         3,
    //         1,
    //         false
    //     );
    //     const arrowMesh = new Mesh(arrowGeometry, arrowMaterial);
    //     arrowMesh.position.z = cameraOffset - 0.5;
    //     scene.add(arrowMesh);
    // }

    // if (renderBars) {
    //     const gridGeom = new CylinderGeometry(
    //         cameraOffset / 400,
    //         cameraOffset / 400,
    //         1,
    //         3,
    //         1,
    //         false
    //     );

    //     const gridMaterial = new MeshBasicMaterial({
    //         color: new Color(0x000000),
    //         opacity: 0.2,
    //         transparent: true
    //     });

    //     // generate a 3d grid
    //     for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
    //         for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
    //             const barMesh = new Mesh(gridGeom, gridMaterial);
    //             barMesh.scale.y = worldLength * 2;
    //             barMesh.rotation.x = Math.PI / 2;
    //             barMesh.position.x = x;
    //             barMesh.position.y = y;
    //             scene.add(barMesh);
    //         }
    //     }
    //     for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
    //         for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
    //             const barMesh = new Mesh(gridGeom, gridMaterial);
    //             barMesh.scale.y = worldWidth * 2;
    //             barMesh.rotation.z = Math.PI / 2;
    //             barMesh.position.z = z;
    //             barMesh.position.y = y;
    //             scene.add(barMesh);
    //         }
    //     }
    //     for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
    //         for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
    //             const barMesh = new Mesh(gridGeom, gridMaterial);
    //             barMesh.scale.y = worldHeight * 2;
    //             barMesh.position.x = x;
    //             barMesh.position.z = z;
    //             scene.add(barMesh);
    //         }
    //     }
    // }

    return {
        resize(size: number): void {
            engine.setSize(size, size);
        },
        destroy() {
            hasDestroyed = true;
        }
    };
}
