import type { Block } from '@enginehub/schematicjs';
import deepmerge from 'deepmerge';
import type { ResourceLoader } from '../../resource/resourceLoader';
import { TRANSPARENT_BLOCKS } from '../utils';
import { loadModel } from './parser';
import type {
    BlockModelData,
    BlockModelOption,
    BlockStateDefinition,
    BlockStateDefinitionVariant,
    BlockStateModelHolder,
    Vector,
} from './types';
import { POSSIBLE_FACES } from './types';
import {
    Axis,
    Color3,
    Color4,
    type InstancedMesh,
    type Material,
    type Mesh,
    MeshBuilder,
    MultiMaterial,
    type Scene,
    Space,
    StandardMaterial,
    SubMesh,
    Texture,
    Vector3,
    Vector4,
} from '@babylonjs/core';

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
    getBlockModelData: (
        block: Block,
        blockState: BlockStateDefinition
    ) => BlockModelData;
    getModelOption: (data: BlockModelData) => BlockModelOption;
    getModel: (
        data: BlockModelOption,
        block: Block,
        scene: Scene
    ) => Promise<InstancedMesh[]>;
}

export function getModelLoader(resourceLoader: ResourceLoader): ModelLoader {
    const materialCache = new Map<string, Material>();
    const modelCache = new Map<string, Mesh[]>();

    const clearCache = () => {
        materialCache.clear();
        modelCache.clear();
    };

    async function getTextureMaterial(
        tex: string,
        scene: Scene,
        rotation?: number,
        transparent?: boolean
    ): Promise<Material> {
        // Normalise values for better caching.
        if (rotation === 0) {
            rotation = undefined;
        }

        const cacheKey = `${tex}_rot=${rotation}`;

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

        const mat = new StandardMaterial(cacheKey, scene);
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = transparent;
        mat.ambientColor = AMBIENT_LIGHT;
        mat.disableDepthWrite = transparent;

        materialCache.set(cacheKey, mat);
        return mat;
    }

    function getBlockModelData(
        block: Block,
        blockState: BlockStateDefinition
    ): BlockModelData {
        const models: BlockModelData['models'] = [];

        const validVariantProperties = blockState.variants
            ? new Set(
                  Object.keys(blockState.variants)[0]
                      .split(',')
                      .map(a => a.split('=')[0])
              )
            : new Set(Object.keys(block.properties));
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

        const createWeightedModels = (
            model: BlockStateModelHolder | BlockStateModelHolder[]
        ): BlockModelData['models'][number]['options'] => {
            if (Array.isArray(model)) {
                return model.map(m => ({ holder: m, weight: m.weight ?? 1 }));
            }
            return [{ holder: model, weight: 1 }];
        };

        if (blockState.variants?.['']) {
            models.push({
                options: createWeightedModels(blockState.variants['']),
            });
        } else if (blockState.variants) {
            models.push({
                options: createWeightedModels(blockState.variants[variantName]),
            });
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

                models.push({ options: createWeightedModels(part.apply) });
            }
        }

        const name =
            variantName.length > 0
                ? `${block.type}[${variantName}]`
                : block.type;

        return { models, name };
    }

    const getModelOption = (data: BlockModelData) => {
        const weightedRandomIndex = (
            options: BlockModelData['models'][number]['options']
        ) => {
            let totalWeight = 0;
            for (let i = 0; i < options.length; i++) {
                totalWeight += options[i].weight;
            }

            let random = Math.random() * totalWeight;
            for (let i = 0; i < options.length; i++) {
                random -= options[i].weight;
                if (random < 0) {
                    return i;
                }
            }

            return options.length - 1;
        };

        let name = data.name;
        const holders = [];
        for (const model of data.models) {
            const index = weightedRandomIndex(model.options);
            holders.push(model.options[index].holder);
            name = `${name}-${index}`;
        }

        return { name, holders };
    };

    const getModel = async (
        data: BlockModelOption,
        block: Block,
        scene: Scene
    ) => {
        if (modelCache.has(data.name)) {
            const cachedGroup = modelCache.get(data.name);
            const instances = new Array<InstancedMesh>(cachedGroup.length);
            const instanceNamePrefix = `${data.name}-`;

            for (let i = 0; i < cachedGroup.length; i++) {
                instances[i] = cachedGroup[i].createInstance(
                    instanceNamePrefix + i
                );
            }

            return instances;
        }

        const group: Mesh[] = [];
        for (
            let modelIndex = 0;
            modelIndex < data.holders.length;
            modelIndex++
        ) {
            const modelHolder = data.holders[modelIndex];
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

                    // Rewrite bottom to down for weird MC quirk.
                    if (element.faces['bottom']) {
                        element.faces['down'] = element.faces['bottom'];
                    }

                    // Normalize to/from to local coords.
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
                        element.to[2] - element.from[2],
                    ];

                    const colours = [];
                    const uvs = [];
                    let hasColor = false;
                    let subMaterials: Material[] = [];

                    for (const face of POSSIBLE_FACES) {
                        const faceData = element.faces[face];
                        if (!faceData) {
                            subMaterials.push(undefined);
                            colours.push(undefined);
                            uvs.push(undefined);
                            continue;
                        }
                        const tex = resolveTexture(faceData.texture);

                        subMaterials.push(
                            await getTextureMaterial(
                                tex,
                                scene,
                                faceData.rotation,
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

                        if (!faceData.uv) {
                            faceData.uv = [0, 0, 16, 16];
                        }
                        faceData.uv = faceData.uv.map(u => u / 16) as [
                            number,
                            number,
                            number,
                            number,
                        ];
                        uvs.push(new Vector4(...faceData.uv));
                    }

                    const box = MeshBuilder.CreateBox(
                        `${data.name}-${modelIndex}`,
                        {
                            width: elementSize[0] || 0.001,
                            height: elementSize[1] || 0.001,
                            depth: elementSize[2] || 0.001,
                            wrap: true,
                            faceColors: hasColor ? colours : undefined,
                            updatable: false,
                            faceUV: uvs,
                        },
                        scene
                    );
                    box.doNotSyncBoundingInfo = true;

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
                    // Remove the undefined ones.
                    subMaterials = subMaterials.filter(mat => mat);

                    // If we're a list of the same material, just use that.
                    if (subMaterials.length > 1) {
                        const testMaterial = subMaterials[0];
                        let allMatch = true;
                        for (let i = 1; i < subMaterials.length; i++) {
                            if (subMaterials[i] !== testMaterial) {
                                allMatch = false;
                                break;
                            }
                        }
                        if (allMatch) {
                            subMaterials = [testMaterial];
                        }
                    }

                    let material: Material = undefined;
                    if (subMaterials.length > 1) {
                        material = new MultiMaterial(
                            `${data.name}-${modelIndex}`,
                            scene
                        );
                        (material as MultiMaterial).subMaterials = subMaterials;
                    } else if (subMaterials.length === 1) {
                        material = subMaterials[0];
                    } else {
                        continue;
                    }

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
        for (const mesh of group) {
            mesh.setEnabled(false);
            mesh.isVisible = false;
        }
        modelCache.set(data.name, group);

        const instances = new Array<InstancedMesh>(group.length);
        const instanceNamePrefix = `${data.name}-`;
        for (let i = 0; i < group.length; i++) {
            instances[i] = group[i].createInstance(instanceNamePrefix + i);
        }
        return instances;
    };

    return {
        clearCache,
        getBlockModelData,
        getModelOption,
        getModel,
    };
}
