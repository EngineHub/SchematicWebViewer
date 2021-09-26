import { Block } from '@enginehub/schematicjs';
import {
    Material,
    Texture,
    Scene,
    StandardMaterial,
    MeshBuilder,
    MultiMaterial,
    SubMesh,
    Color4,
    Vector3,
    Axis,
    Space,
    Color3,
    Mesh
} from 'babylonjs';
import deepmerge from 'deepmerge';
import { ResourceLoader } from '../../resource/resourceLoader';
import { faceToFacingVector, TRANSPARENT_BLOCKS } from '../utils';
import { loadBlockStateDefinition, loadModel } from './parser';
import {
    BlockStateDefinition,
    BlockStateDefinitionVariant,
    BlockStateModelHolder,
    POSSIBLE_FACES,
    Vector
} from './types';

const TINT_COLOR = new Color4(145 / 255, 189 / 255, 89 / 255, 1);
const WATER_COLOR = new Color4(36 / 255, 57 / 255, 214 / 255, 1);
const LAVA_COLOR = new Color4(232 / 255, 89 / 255, 23 / 255, 1);
const AMBIENT_LIGHT = new Color3(0.5, 0.5, 0.5);

const DEG2RAD = Math.PI / 180;

function normalize(input: number): number {
    return input / 16 - 0.5;
}

interface ModelLoader {
    clearCache: () => void;
    getModel: (
        block: Block,
        scene: Scene,
        isAdjacentOccluding: (x: number, y: number, z: number) => boolean
    ) => Promise<Mesh[]>;
}

export function getModelLoader(resourceLoader: ResourceLoader): ModelLoader {
    const materialCache = new Map<string, Material>();

    const clearCache = () => {
        materialCache.clear();
    };

    async function getTextureMaterial(
        tex: string,
        scene: Scene,
        rotation?: number,
        uv?: [number, number, number, number],
        transparent?: boolean
    ): Promise<Material> {
        // Normalise values for better caching.
        if (rotation === 0) {
            rotation = undefined;
        }
        if (uv && uv[0] === 0 && uv[1] === 0 && uv[2] === 16 && uv[3] === 16) {
            uv = undefined;
        }

        const cacheKey = `${tex}_rot=${rotation}_uv=${uv}`;

        // TODO - Determine if there's a better way to handle this other than manually caching.
        const cached = materialCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        if (tex.startsWith('minecraft:')) {
            tex = tex.substring('minecraft:'.length);
        }
        const blob = await resourceLoader.getResourceBlob(
            `textures/${tex}.png`
        );
        if (blob === undefined) {
            console.log(tex);
            return undefined;
        }

        const texture = new Texture(
            blob,
            scene,
            false,
            true,
            Texture.NEAREST_NEAREST_MIPNEAREST
        );
        texture.hasAlpha = transparent;
        texture.isBlocking = false;

        if (rotation) {
            texture.wAng = rotation * DEG2RAD;
        }
        if (uv) {
            // MC uses x1, y1, x2, y2 coords - ensure that Babylon handles this
            texture.uOffset = uv[0] / 16;
            texture.vOffset = uv[1] / 16;

            texture.uScale = (uv[2] - uv[0]) / 16;
            texture.vScale = (uv[3] - uv[1]) / 16;

            texture.wrapU = Texture.WRAP_ADDRESSMODE;
            texture.wrapV = Texture.WRAP_ADDRESSMODE;
        }

        const mat = new StandardMaterial(cacheKey, scene);
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = transparent;
        mat.ambientColor = AMBIENT_LIGHT;
        mat.disableDepthWrite = transparent;
        mat.freeze();

        materialCache.set(cacheKey, mat);
        return mat;
    }

    function getModelHolders(block: Block, blockState: BlockStateDefinition) {
        const holders: BlockStateModelHolder[] = [];

        const chooseVariant = (
            model: BlockStateModelHolder | BlockStateModelHolder[]
        ): BlockStateModelHolder => {
            if (Array.isArray(model)) {
                return model[Math.floor(Math.random() * model.length)];
            }
            return model;
        };

        if (blockState.variants?.['']) {
            holders.push(chooseVariant(blockState.variants['']));
        } else if (blockState.variants) {
            const validVariantProperties = new Set(
                Object.keys(blockState.variants)[0]
                    .split(',')
                    .map(a => a.split('=')[0])
            );
            const variantName = Object.keys(block.properties)
                .sort()
                .reduce((a, b) => {
                    if (!validVariantProperties.has(b)) {
                        return a;
                    }
                    a.push(`${b}=${block.properties[b]}`);
                    return a;
                }, [])
                .join(',');
            holders.push(chooseVariant(blockState.variants[variantName]));
        } else if (blockState.multipart) {
            const doesFilterPass = (
                filter: BlockStateDefinitionVariant<string>
            ) => {
                for (const property of Object.keys(filter)) {
                    if (block.properties[property] !== filter[property]) {
                        return false;
                    }
                }
                return true;
            };

            for (const part of blockState.multipart) {
                if (part.when) {
                    // Check filters
                    if (part.when.OR) {
                        let anyPassed = false;
                        for (const test of part.when.OR) {
                            if (doesFilterPass(test)) {
                                anyPassed = true;
                                break;
                            }
                        }
                        if (!anyPassed) {
                            continue;
                        }
                    } else {
                        if (!doesFilterPass(part.when)) {
                            continue;
                        }
                    }
                }

                holders.push(chooseVariant(part.apply));
            }
        }

        return holders;
    }

    async function getModel(
        block: Block,
        scene: Scene,
        isAdjacentOccluding: (x: number, y: number, z: number) => boolean
    ): Promise<Mesh[]> {
        const blockState = await loadBlockStateDefinition(
            block.type,
            resourceLoader
        );
        const modelHolders = getModelHolders(block, blockState);

        if (!modelHolders.length) {
            console.log(blockState);
            return [];
        }

        const group: Mesh[] = [];
        for (const modelHolder of modelHolders) {
            const model = await loadModel(modelHolder.model, resourceLoader);
            const resolveTexture = (ref: string) => {
                while (ref.startsWith('#')) {
                    ref = model.textures[ref.substring(1)];
                }

                return ref;
            };

            if (block.type === 'water' || block.type === 'lava') {
                // These blocks are not rendered via models, so handle specially.
                model.textures['all'] = model.textures.particle;
                const temporaryModel = deepmerge(
                    await loadModel('block/cube_all', resourceLoader),
                    model
                );
                model.textures = temporaryModel.textures;
                model.elements = temporaryModel.elements;
            }

            if (model.elements) {
                for (const element of model.elements) {
                    if (Object.keys(element.faces).length === 0) {
                        continue;
                    }

                    // Normalize to/from to threejs coords.
                    element.from = element.from.map(normalize) as Vector;
                    element.to = element.to.map(normalize) as Vector;
                    if (element.rotation) {
                        element.rotation.origin = element.rotation.origin.map(
                            normalize
                        ) as Vector;
                    }

                    const elementSize = [
                        element.to[0] - element.from[0],
                        element.to[1] - element.from[1],
                        element.to[2] - element.from[2]
                    ];

                    const colours = [];
                    let hasColor = false;
                    const subMaterials = [];

                    // For rotated blocks, we need to check the occlusion faces with rotation applied, so disable for now.
                    const shouldCheckOcclusion =
                        !element.rotation && !modelHolder.y && !modelHolder.x;

                    for (const face of POSSIBLE_FACES) {
                        const faceData = element.faces[face];
                        if (
                            !faceData ||
                            (shouldCheckOcclusion &&
                                isAdjacentOccluding(
                                    ...faceToFacingVector(
                                        faceData.cullface ?? face
                                    )
                                ))
                        ) {
                            subMaterials.push(undefined);
                            colours.push(undefined);
                            continue;
                        }
                        const tex = resolveTexture(faceData.texture);

                        subMaterials.push(
                            await getTextureMaterial(
                                tex,
                                scene,
                                faceData.rotation,
                                faceData.uv,
                                TRANSPARENT_BLOCKS.has(block.type) ||
                                    faceData.texture.includes('overlay')
                            )
                        );

                        let color: Color4;
                        if (faceData.tintindex !== undefined) {
                            color = TINT_COLOR;
                        } else if (tex.startsWith('block/water_')) {
                            color = WATER_COLOR;
                        } else if (tex.startsWith('block/lava_')) {
                            color = LAVA_COLOR;
                        } else {
                            colours.push(undefined);
                            continue;
                        }
                        hasColor = true;
                        colours.push(color);
                    }

                    const box = MeshBuilder.CreateBox('box', {
                        width: elementSize[0] || 0.0001,
                        height: elementSize[1] || 0.0001,
                        depth: elementSize[2] || 0.0001,
                        wrap: true,
                        faceColors: hasColor ? colours : undefined
                    });

                    const subMeshes = [];
                    const verticesCount = box.getTotalVertices();
                    for (let i = 0; i < POSSIBLE_FACES.length; i++) {
                        if (!subMaterials[i]) {
                            continue;
                        }
                        // Only create the submesh if it has a material.
                        const subMesh = new SubMesh(
                            subMeshes.length,
                            i,
                            verticesCount,
                            i * 6,
                            6,
                            box,
                            undefined,
                            true,
                            false
                        );
                        subMeshes.push(subMesh);
                    }
                    box.subMeshes = subMeshes;

                    // TODO - Validate if material names must be unique.
                    const material = new MultiMaterial(block.type, scene);

                    // Remove the undefined ones.
                    material.subMaterials = subMaterials.filter(mat => mat);

                    material.freeze();
                    box.material = material;

                    if (element.rotation) {
                        box.setPivotPoint(
                            new Vector3(
                                element.rotation.origin[0],
                                element.rotation.origin[1],
                                element.rotation.origin[2]
                            ),
                            Space.WORLD
                        );

                        switch (element.rotation.axis) {
                            case 'y':
                                box.rotate(
                                    Axis.Y,
                                    element.rotation.angle * -DEG2RAD,
                                    Space.WORLD
                                );
                                break;
                            case 'x':
                                box.rotate(
                                    Axis.X,
                                    element.rotation.angle * DEG2RAD,
                                    Space.WORLD
                                );
                                break;
                            case 'z':
                                box.rotate(
                                    Axis.Z,
                                    element.rotation.angle * DEG2RAD,
                                    Space.WORLD
                                );
                                break;
                        }

                        box.setPivotPoint(new Vector3(0, 0, 0));
                    }

                    if (modelHolder.x) {
                        box.rotate(
                            Axis.X,
                            -DEG2RAD * modelHolder.x,
                            Space.WORLD
                        );
                    }
                    if (modelHolder.y) {
                        box.rotate(
                            Axis.Y,
                            -DEG2RAD * modelHolder.y,
                            Space.WORLD
                        );
                    }

                    box.translate(Axis.X, element.from[0] + elementSize[0] / 2)
                        .translate(Axis.Y, element.from[1] + elementSize[1] / 2)
                        .translate(
                            Axis.Z,
                            element.from[2] + elementSize[2] / 2
                        );

                    group.push(box);
                }
            }
        }

        // We cannot merge these meshes as we lose independent face colours.
        return group;
    }

    return {
        clearCache,
        getModel
    };
}
