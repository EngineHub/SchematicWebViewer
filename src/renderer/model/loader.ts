import { Block } from '@enginehub/schematicjs';
import {
    Material,
    TextureLoader,
    PlaneGeometry,
    MeshPhongMaterial,
    Scene,
    Mesh,
    Texture,
    NearestFilter,
    Color,
    NearestMipmapLinearFilter
} from 'three';
import { ResourceLoader } from '../../resource/resourceLoader';
import { getBlockStateDefinition, getModel } from './parser';
import { BlockStateDefinitionVariant, Faces, Vector } from './types';

type IsAdjacentEmpty = (x: number, y: number, z: number) => boolean;

interface LocationMatrix {
    position: {
        x?: number;
        y?: number;
        z?: number;
    };
    rotation: {
        x?: number;
        y?: number;
        z?: number;
    };
}

function faceToLocation(face: Faces): LocationMatrix {
    switch (face) {
        case 'up':
            return {
                rotation: {
                    x: -Math.PI / 2
                },
                position: {
                    y: 0.5
                }
            };
        case 'down':
            return {
                rotation: {
                    x: Math.PI / 2
                },
                position: {
                    y: -0.5
                }
            };
        case 'north':
            return {
                rotation: {
                    y: Math.PI
                },
                position: {
                    z: -0.5
                }
            };
        case 'south':
            return {
                rotation: {},
                position: {
                    z: 0.5
                }
            };
        case 'east':
            return {
                rotation: {
                    y: Math.PI / 2
                },
                position: {
                    x: 0.5
                }
            };
        case 'west':
            return {
                rotation: {
                    y: -Math.PI / 2
                },
                position: {
                    x: -0.5
                }
            };
    }
}

function faceToFacingVector(face: Faces): Vector {
    switch (face) {
        case 'up':
            return [0, 1, 0];
        case 'down':
            return [0, -1, 0];
        case 'north':
            return [0, 0, -1];
        case 'south':
            return [0, 0, 1];
        case 'east':
            return [1, 0, 0];
        case 'west':
            return [-1, 0, 0];
        default:
            return [0, 0, 0];
    }
}

function faceToTextureSize(
    face: Faces,
    from: Vector,
    to: Vector
): [number, number] {
    switch (face) {
        case 'up':
        case 'down':
            return [to[0] - from[0], to[2] - from[2]];
        case 'north':
        case 'south':
            return [to[0] - from[0], to[1] - from[1]];
        case 'east':
        case 'west':
            return [to[2] - from[2], to[1] - from[1]];
        default:
            return [1, 1];
    }
}

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
                URL.createObjectURL(blob),
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
        tintindex?: number
    ): Promise<Material> {
        const cached = materialCache.get(tex);
        if (cached) {
            return cached;
        }

        const texture = await loadTexture(tex);
        texture.magFilter = NearestFilter;
        texture.minFilter = NearestMipmapLinearFilter;
        const mat = new MeshPhongMaterial({
            map: texture,
            color: tintindex !== undefined ? new Color(0x91bd59) : new Color(),
            shininess: 0
        });
        mat.transparent = true;
        materialCache.set(tex, mat);
        return mat;
    }

    return {
        getModel: async (block: Block) => {
            const blockState = await getBlockStateDefinition(
                block.type,
                resourceLoader
            );

            const modelRefs: string[] = [];

            if (blockState.variants?.['']) {
                let variant = blockState.variants[''];

                if (Array.isArray(variant)) {
                    variant =
                        variant[Math.floor(Math.random() & variant.length)];
                }

                modelRefs.push(variant.model);
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

                modelRefs.push(variant.model);
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
                                break;
                            }
                        }
                    }

                    let models = part.apply;

                    if (Array.isArray(models)) {
                        models =
                            models[Math.floor(Math.random() & models.length)];
                    }

                    modelRefs.push(models.model);
                }
            }

            if (modelRefs.length > 0) {
                const models = await Promise.all(
                    modelRefs.map(
                        async modelRef =>
                            await getModel(modelRef, resourceLoader)
                    )
                );

                return async (f: IsAdjacentEmpty) => {
                    const scene = new Scene();
                    for (const model of models) {
                        const resolveTexture = (ref: string) => {
                            while (ref.startsWith('#')) {
                                ref = model.textures[ref.substring(1)];
                            }

                            return ref;
                        };

                        if (model.elements) {
                            for (const element of model.elements) {
                                // Normalize to/from to threejs coords.
                                element.from = element.from.map(
                                    normalize
                                ) as Vector;
                                element.to = element.to.map(
                                    normalize
                                ) as Vector;

                                const elementSize = [
                                    element.to[0] - element.from[0],
                                    element.to[1] - element.from[1],
                                    element.to[2] - element.from[2]
                                ];

                                for (const face of Object.keys(element.faces)) {
                                    const faceData = element.faces[face];

                                    if (
                                        faceData.cullface &&
                                        !f(
                                            ...faceToFacingVector(
                                                faceData.cullface
                                            )
                                        )
                                    ) {
                                        continue;
                                    }

                                    const textureSize = faceToTextureSize(
                                        face as Faces,
                                        element.from,
                                        element.to
                                    );

                                    let elementGeometry = new PlaneGeometry(
                                        ...textureSize,
                                        1,
                                        1
                                    );

                                    const rot = faceToLocation(face as Faces);

                                    if (element.rotation) {
                                        elementGeometry.translate(
                                            normalize(
                                                element.rotation.origin[0]
                                            ),
                                            normalize(
                                                element.rotation.origin[1]
                                            ),
                                            normalize(
                                                element.rotation.origin[2]
                                            )
                                        );
                                    }

                                    const mesh = new Mesh(
                                        elementGeometry,
                                        await getTextureMaterial(
                                            resolveTexture(faceData.texture),
                                            faceData.tintindex
                                        )
                                    );

                                    if (rot.position.x) {
                                        mesh.position.x =
                                            rot.position.x * elementSize[0];
                                    }

                                    if (rot.position.y) {
                                        mesh.position.y =
                                            rot.position.y * elementSize[1];
                                    }

                                    if (rot.position.z) {
                                        mesh.position.z =
                                            rot.position.z * elementSize[2];
                                    }

                                    mesh.rotation.set(
                                        rot.rotation.x ?? mesh.rotation.x,
                                        rot.rotation.y ?? mesh.rotation.y,
                                        rot.rotation.z ?? mesh.rotation.z
                                    );

                                    if (element.rotation) {
                                        mesh.rotation[element.rotation.axis] +=
                                            element.rotation.angle;
                                    }

                                    mesh.position.y -= (1 - elementSize[1]) / 2;

                                    scene.add(mesh);
                                }
                            }
                        }
                    }
                    return scene;
                };
            } else {
                console.log(blockState);
                return async (f: IsAdjacentEmpty) => {
                    return new Scene();
                };
            }
        }
    };
}
