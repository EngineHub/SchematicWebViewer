import { Block } from '@enginehub/schematicjs';
import deepmerge from 'deepmerge';
import {
    Material,
    TextureLoader,
    Mesh,
    Texture,
    NearestFilter,
    Color,
    NearestMipmapLinearFilter,
    MathUtils,
    MeshBasicMaterial,
    Group,
    BoxGeometry
} from 'three';
import { ResourceLoader } from '../../resource/resourceLoader';
import { TRANSPARENT_BLOCKS } from '../renderer';
import { getBlockStateDefinition, getModel } from './parser';
import {
    BlockStateDefinitionVariant,
    BlockStateModelHolder,
    POSSIBLE_FACES,
    Vector
} from './types';

const TINT_COLOR = new Color(0x91bd59);
const WATER_COLOR = new Color(0x2439d6);
const LAVA_COLOR = new Color(0xe85917);
const BLANK_COLOR = new Color();

function normalize(input: number): number {
    return input / 16 - 0.5;
}

export async function getModelLoader(resourceLoader: ResourceLoader) {
    const materialCache = new Map<string, Material>();
    const loader = new TextureLoader();

    async function loadTexture(tex: string): Promise<Texture | undefined> {
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
        return await new Promise((resolve, reject) => {
            loader.load(
                blob,
                texture => {
                    resolve(texture);
                },
                () => {},
                e => reject(e)
            );
        });
    }

    async function getTextureMaterial(
        tex: string,
        rotation?: number,
        uv?: [number, number, number, number],
        tintindex?: number,
        transparent?: boolean
    ): Promise<Material> {
        const cacheKey = `${tex}_rot=${rotation}_uv=${uv}_tint=${tintindex}`;

        const cached = materialCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const texture = await loadTexture(tex);
        if (rotation) {
            texture.rotation = rotation * MathUtils.DEG2RAD;
        }
        if (uv) {
            texture.offset.x = uv[0] / 16;
            texture.offset.y = uv[1] / 16;
            texture.repeat.x = (uv[2] - uv[0]) / 16;
            texture.repeat.y = (uv[3] - uv[1]) / 16;
        }
        texture.magFilter = NearestFilter;
        texture.minFilter = NearestMipmapLinearFilter;

        let color: Color;
        if (tintindex !== undefined) {
            color = TINT_COLOR;
        } else if (tex.startsWith('block/water_')) {
            color = WATER_COLOR;
        } else if (tex.startsWith('block/lava_')) {
            color = LAVA_COLOR;
        } else {
            color = BLANK_COLOR;
        }

        const mat = new MeshBasicMaterial({
            map: texture,
            color,
            transparent: transparent || tex.includes('overlay')
        });

        materialCache.set(cacheKey, mat);
        return mat;
    }

    return {
        getModel: async (block: Block) => {
            const blockState = await getBlockStateDefinition(
                block.type,
                resourceLoader
            );

            const modelRefs: BlockStateModelHolder[] = [];

            if (blockState.variants?.['']) {
                let variant = blockState.variants[''];

                if (Array.isArray(variant)) {
                    variant =
                        variant[Math.floor(Math.random() & variant.length)];
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
                        variant[Math.floor(Math.random() & variant.length)];
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
                            models[Math.floor(Math.random() & models.length)];
                    }

                    modelRefs.push(models);
                }
            }

            if (modelRefs.length > 0) {
                const group = new Group();
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

                            const materials = [];
                            const geometry = new BoxGeometry(
                                ...elementSize,
                                1,
                                1,
                                1
                            );

                            let index = -1;
                            for (const face of POSSIBLE_FACES) {
                                index++;
                                if (!element.faces[face]) {
                                    for (
                                        let i = geometry.faces.length - 1;
                                        i >= 0;
                                        i--
                                    ) {
                                        if (
                                            geometry.faces[i] &&
                                            geometry.faces[i].materialIndex ===
                                                index
                                        ) {
                                            geometry.faces.splice(i, 1);
                                        }
                                    }
                                    materials.push(undefined);
                                    continue;
                                }
                                const faceData = element.faces[face];

                                materials.push(
                                    await getTextureMaterial(
                                        resolveTexture(faceData.texture),
                                        faceData.rotation,
                                        faceData.uv,
                                        faceData.tintindex,
                                        TRANSPARENT_BLOCKS.has(block.type)
                                    )
                                );
                            }

                            geometry.elementsNeedUpdate = true;

                            if (geometry.faces.length === 0) {
                                geometry.dispose();
                                continue;
                            }

                            geometry.translate(
                                element.from[0] + elementSize[0] / 2,
                                element.from[1] + elementSize[1] / 2,
                                element.from[2] + elementSize[2] / 2
                            );

                            if (modelHolder.x) {
                                geometry.rotateX(
                                    -MathUtils.DEG2RAD * modelHolder.x
                                );
                            }
                            if (modelHolder.y) {
                                geometry.rotateY(
                                    -MathUtils.DEG2RAD * modelHolder.y
                                );
                            }

                            if (element.rotation) {
                                geometry.translate(
                                    -normalize(element.rotation.origin[0]),
                                    -normalize(element.rotation.origin[1]),
                                    -normalize(element.rotation.origin[2])
                                );

                                switch (element.rotation.axis) {
                                    case 'y':
                                        geometry.rotateY(
                                            -element.rotation.angle *
                                                MathUtils.DEG2RAD
                                        );
                                        break;
                                    case 'x':
                                        geometry.rotateX(
                                            -element.rotation.angle *
                                                MathUtils.DEG2RAD
                                        );
                                        break;
                                    case 'z':
                                        geometry.rotateZ(
                                            -element.rotation.angle *
                                                MathUtils.DEG2RAD
                                        );
                                        break;
                                }

                                geometry.translate(
                                    normalize(element.rotation.origin[0]),
                                    normalize(element.rotation.origin[1]),
                                    normalize(element.rotation.origin[2])
                                );
                            }

                            group.add(new Mesh(geometry, materials));
                        }
                    }
                }
                return group;
            } else {
                console.log(blockState);
                return undefined;
            }
        }
    };
}
