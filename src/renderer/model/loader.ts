import { Block } from '@enginehub/schematicjs';
import deepmerge from 'deepmerge';
import {
    Material,
    TextureLoader,
    PlaneGeometry,
    MeshPhongMaterial,
    Scene,
    Mesh,
    Texture,
    NearestFilter,
    Color
} from 'three';
import { ResourceLoader } from '../../resource/resourceLoader';
import { getBlockStateDefinition, getModel } from './parser';

type IsAdjacentEmpty = (x: number, y: number, z: number) => boolean;

export async function getModelLoader(resourceLoader: ResourceLoader) {
    const materialCache = new Map<string, Material>();
    const loader = new TextureLoader();
    const blockSideGeometry = new PlaneGeometry(1, 1, 1, 1);

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
        const mat = new MeshPhongMaterial({
            map: texture,
            color: tintindex !== undefined ? new Color(0x91bd59) : new Color(),
            shininess: 0
        });
        materialCache.set(tex, mat);
        return mat;
    }
    return {
        getModel: async (block: Block) => {
            const blockState = await getBlockStateDefinition(
                block.type,
                resourceLoader
            );
            let variant = undefined;

            if (blockState.variants?.['']) {
                variant = blockState.variants[''];
            } else {
                variant =
                    blockState.variants[Object.keys(blockState.variants)[0]];
            }

            if (Array.isArray(variant)) {
                variant = variant[Math.floor(Math.random() & variant.length)];
            }

            if (variant) {
                let model = await getModel(variant.model, resourceLoader);

                if (model.parent) {
                    let parent = await getModel(model.parent, resourceLoader);
                    if (model['elements'] && parent['elements']) {
                        delete parent['elements'];
                    }
                    model = deepmerge(parent, model);
                    while (parent.parent) {
                        parent = await getModel(parent.parent, resourceLoader);
                        if (model['elements'] && parent['elements']) {
                            delete parent['elements'];
                        }
                        model = deepmerge(parent, model);
                    }

                    delete model.parent;
                }

                const resolveTexture = (ref: string) => {
                    while (ref.startsWith('#')) {
                        ref = model.textures[ref.substring(1)];
                    }

                    return ref;
                };

                if (model.elements) {
                    for (const element of model.elements) {
                        return async (f: IsAdjacentEmpty) => {
                            const scene = new Scene();

                            if (element.faces.up && f(0, 1, 0)) {
                                const topMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.up.texture
                                        ),
                                        element.faces.up.tintindex
                                    )
                                );
                                topMesh.rotation.x = -Math.PI / 2;
                                topMesh.position.y = 0.5;
                                scene.add(topMesh);
                            }

                            if (element.faces.down && f(0, -1, 0)) {
                                const bottomMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.down.texture
                                        ),
                                        element.faces.down.tintindex
                                    )
                                );
                                bottomMesh.rotation.x = Math.PI / 2;
                                bottomMesh.position.y = -0.5;
                                scene.add(bottomMesh);
                            }

                            if (element.faces.west && f(-1, 0, 0)) {
                                const leftMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.west.texture
                                        ),
                                        element.faces.west.tintindex
                                    )
                                );
                                leftMesh.rotation.y = -Math.PI / 2;
                                leftMesh.position.x = -0.5;
                                scene.add(leftMesh);
                            }

                            if (element.faces.east && f(1, 0, 0)) {
                                const rightMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.east.texture
                                        ),
                                        element.faces.east.tintindex
                                    )
                                );
                                rightMesh.rotation.y = Math.PI / 2;
                                rightMesh.position.x = 0.5;
                                scene.add(rightMesh);
                            }

                            if (element.faces.north && f(0, 0, -1)) {
                                const backMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.north.texture
                                        ),
                                        element.faces.north.tintindex
                                    )
                                );
                                backMesh.rotation.y = Math.PI;
                                backMesh.position.z = -0.5;
                                scene.add(backMesh);
                            }

                            if (element.faces.south && f(0, 0, 1)) {
                                const frontMesh = new Mesh(
                                    blockSideGeometry,
                                    await getTextureMaterial(
                                        resolveTexture(
                                            element.faces.south.texture
                                        ),
                                        element.faces.south.tintindex
                                    )
                                );
                                frontMesh.position.z = 0.5;
                                scene.add(frontMesh);
                            }

                            return scene;
                        };
                    }
                }
            } else {
                console.log(blockState);
            }
        }
    };
}
