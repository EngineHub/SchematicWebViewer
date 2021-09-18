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
    Vector3
} from 'babylonjs';
import deepmerge from 'deepmerge';
import { ResourceLoader } from '../../resource/resourceLoader';
import { TRANSPARENT_BLOCKS } from '../renderer';
import { getBlockStateDefinition, getModel } from './parser';
import {
    BlockStateDefinitionVariant,
    BlockStateModelHolder,
    POSSIBLE_FACES,
    Vector
} from './types';

const TINT_COLOR = new Color4(145 / 255, 189 / 255, 89 / 255, 1);
const WATER_COLOR = new Color4(36 / 255, 57 / 255, 214 / 255, 1);
const LAVA_COLOR = new Color4(232 / 255, 89 / 255, 23 / 255, 1);

const DEG2RAD = Math.PI / 180;

function normalize(input: number): number {
    return input / 16 - 0.5;
}

export async function getModelLoader(resourceLoader: ResourceLoader) {
    const materialCache = new Map<string, Material>();

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
            Texture.NEAREST_SAMPLINGMODE
        );
        texture.hasAlpha = transparent;
        texture.isBlocking = false;

        if (rotation) {
            texture.uRotationCenter = 0.5;
            texture.vRotationCenter = 0.5;
            texture.vAng = -rotation * DEG2RAD;
        }
        if (uv) {
            texture.uOffset = uv[0] / 16;
            texture.vOffset = uv[1] / 16;

            texture.uScale = (uv[2] - uv[0]) / 16;
            texture.vScale = (uv[3] - uv[1]) / 16;

            texture.wrapU = 1;
            texture.wrapV = 1;
        }

        const mat = new StandardMaterial(cacheKey, scene);
        mat.diffuseTexture = texture;
        mat.useAlphaFromDiffuseTexture = transparent;
        mat.freeze();

        materialCache.set(cacheKey, mat);
        return mat;
    }

    return {
        getModel: async (block: Block, scene: Scene) => {
            const blockState = await getBlockStateDefinition(
                block.type,
                resourceLoader
            );

            const modelRefs: BlockStateModelHolder[] = [];

            if (blockState.variants?.['']) {
                let variant = blockState.variants[''];

                if (Array.isArray(variant)) {
                    variant =
                        variant[Math.floor(Math.random() * variant.length)];
                }

                modelRefs.push(variant);
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
                let variant = blockState.variants[variantName];

                if (Array.isArray(variant)) {
                    variant =
                        variant[Math.floor(Math.random() * variant.length)];
                }

                modelRefs.push(variant);
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

                    let models = part.apply;

                    if (Array.isArray(models)) {
                        models =
                            models[Math.floor(Math.random() * models.length)];
                    }

                    modelRefs.push(models);
                }
            }

            if (modelRefs.length > 0) {
                const group = [];
                for (const modelHolder of modelRefs) {
                    const model = await getModel(
                        modelHolder.model,
                        resourceLoader
                    );
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
                            await getModel('block/cube_all', resourceLoader),
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
                            element.from = element.from.map(
                                normalize
                            ) as Vector;
                            element.to = element.to.map(normalize) as Vector;

                            const elementSize = [
                                element.to[0] - element.from[0],
                                element.to[1] - element.from[1],
                                element.to[2] - element.from[2]
                            ];

                            const colours = [];
                            let hasColor = false;
                            const subMaterials = [];

                            for (const face of POSSIBLE_FACES) {
                                if (!element.faces[face]) {
                                    subMaterials.push(undefined);
                                    colours.push(undefined);
                                    continue;
                                }
                                const faceData = element.faces[face];
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
                                width: elementSize[0],
                                height: elementSize[1],
                                depth: elementSize[2],
                                wrap: true,
                                faceColors: hasColor ? colours : undefined
                            });

                            const subMeshes = [];
                            const verticesCount = box.getTotalVertices();
                            for (let i = 0; i < POSSIBLE_FACES.length; i++) {
                                if (!subMaterials[i]) {
                                    continue;
                                }
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

                            const material = new MultiMaterial(
                                block.type,
                                scene
                            );

                            // Remove the undefined ones.
                            material.subMaterials = subMaterials.filter(
                                mat => mat
                            );

                            material.freeze();
                            box.material = material;

                            if (element.rotation) {
                                box.locallyTranslate(
                                    new Vector3(
                                        -normalize(element.rotation.origin[0]),
                                        -normalize(element.rotation.origin[1]),
                                        -normalize(element.rotation.origin[2])
                                    )
                                );

                                switch (element.rotation.axis) {
                                    case 'y':
                                        box.rotation.y +=
                                            -element.rotation.angle * DEG2RAD;
                                        break;
                                    case 'x':
                                        box.rotation.x +=
                                            element.rotation.angle * DEG2RAD;
                                        break;
                                    case 'z':
                                        box.rotation.z +=
                                            element.rotation.angle * DEG2RAD;
                                        break;
                                }

                                box.locallyTranslate(
                                    new Vector3(
                                        normalize(element.rotation.origin[0]),
                                        normalize(element.rotation.origin[1]),
                                        normalize(element.rotation.origin[2])
                                    )
                                );
                            }

                            if (modelHolder.x) {
                                box.rotation.x += -DEG2RAD * modelHolder.x;
                            }
                            if (modelHolder.y) {
                                box.rotation.y += -DEG2RAD * modelHolder.y;
                            }

                            box.setAbsolutePosition(
                                box.absolutePosition.add(
                                    new Vector3(
                                        element.from[0] + elementSize[0] / 2,
                                        element.from[1] + elementSize[1] / 2,
                                        element.from[2] + elementSize[2] / 2
                                    )
                                )
                            );

                            group.push(box);
                        }
                    }
                }

                // We cannot merge these meshes as we lose independent face colours.
                return group;
            } else {
                console.log(blockState);
                return [];
            }
        }
    };
}
