import { SchematicRenderOptions } from './types';
import TextureMerger from '../external/TextureMerger';
import {
    Material,
    TextureLoader,
    PlaneGeometry,
    NearestFilter,
    MeshPhongMaterial,
    Color,
    Object3D,
    Scene,
    Mesh,
    Texture,
    Vector2, LinearFilter, NearestMipMapLinearFilter, NearestMipMapNearestFilter, NearestMipmapNearestFilter
} from 'three';

export default (renderOptions: SchematicRenderOptions) => {
    const needsColorBlocks = new Set([
        'birch_leaves',
        'dark_oak_leaves',
        'grass_block_top',
        'spruce_leaves',
        'oak_leaves',
        'jungle_leaves',
        'acacia_leaves'
    ]);
    const materialCache = new Map<string, Material>();
    const loader = new TextureLoader();
    const blockSideGeometry = new PlaneGeometry(1, 1, 1, 1);
    let mergedTextures;

    type IsAdjacentEmpty = (x: number, y: number, z: number) => boolean;

    function loadTexture(tex: string): Promise<Texture> {
        return new Promise((resolve, reject) => {
            loader.load(
                `${renderOptions.texturePrefix || ''}/textures/${tex}.png`,
                texture => {
                    resolve(texture);
                }, () => {}, (e) => reject(e)
            );
        });
    }

    async function getTextureMaterial(tex: string): Promise<Material> {
        const cached = materialCache.get(tex);
        if (cached) return cached;

        const needsColor = needsColorBlocks.has(tex);
        let texture: Texture;
        if (mergedTextures.textureOffsets[tex]) {
            texture = mergedTextures.mergedTexture.clone();
            const ranges = mergedTextures.ranges[tex];

            const bleedAllowance = 0.01;

            texture.offset = new Vector2(ranges.startU + bleedAllowance, ranges.endV + bleedAllowance);
            texture.repeat = new Vector2(
                ranges.endU - ranges.startU - bleedAllowance,
                ranges.startV - ranges.endV - bleedAllowance
            );
            texture.minFilter = NearestMipMapLinearFilter;
            texture.magFilter = NearestFilter;
            texture.generateMipmaps = true;
            texture.needsUpdate = true;
        } else {
            texture = await loadTexture(tex);
        }
        const mat = new MeshPhongMaterial({
            map: texture,
            color: needsColor ? new Color(0x91bd59) : new Color(),
            shininess: 0
        });
        materialCache.set(tex, mat);
        return mat;
    }

    function multiBlockGen(
        top: string,
        bottom: string,
        left: string,
        right: string,
        back: string,
        front: string
    ): (f: IsAdjacentEmpty) => Promise<Object3D> {
        return async f => {
            const scene = new Scene();

            if (f(0, 1, 0)) {
                const topMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(top)
                );
                topMesh.rotation.x = -Math.PI / 2;
                topMesh.position.y = 0.5;
                scene.add(topMesh);
            }

            if (f(0, -1, 0)) {
                const bottomMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(bottom)
                );
                bottomMesh.rotation.x = Math.PI / 2;
                bottomMesh.position.y = -0.5;
                scene.add(bottomMesh);
            }

            if (f(-1, 0, 0)) {
                const leftMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(left)
                );
                leftMesh.rotation.y = -Math.PI / 2;
                leftMesh.position.x = -0.5;
                scene.add(leftMesh);
            }

            if (f(1, 0, 0)) {
                const rightMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(right)
                );
                rightMesh.rotation.y = Math.PI / 2;
                rightMesh.position.x = 0.5;
                scene.add(rightMesh);
            }

            if (f(0, 0, -1)) {
                const backMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(back)
                );
                backMesh.rotation.y = Math.PI;
                backMesh.position.z = -0.5;
                scene.add(backMesh);
            }

            if (f(0, 0, 1)) {
                const frontMesh = new Mesh(
                    blockSideGeometry,
                    await getTextureMaterial(front)
                );
                frontMesh.position.z = 0.5;
                scene.add(frontMesh);
            }

            return scene;
        };
    }

    function sideBlockGen(
        top: string,
        bottom: string,
        side: string
    ): (f: IsAdjacentEmpty) => Promise<Object3D> {
        return multiBlockGen(top, bottom, side, side, side, side);
    }

    function basicBlockGen(
        material: string
    ): (f: IsAdjacentEmpty) => Promise<Object3D> {
        return sideBlockGen(material, material, material);
    }

    // TODO Replace with model loader
    const blockNameMap: {
        [key: string]: {
            modelType: Function;
            textures: string[];
        };
    } = {
        acacia_door: {
            modelType: basicBlockGen,
            textures: ['acacia_door_top']
        },
        barrel: {
            modelType: sideBlockGen,
            textures: ['barrel_top', 'barrel_bottom', 'barrel_side']
        },
        birch_door: { modelType: basicBlockGen, textures: ['birch_door_top'] },
        bone_block: {
            modelType: sideBlockGen,
            textures: ['bone_block_top', 'bone_block_top', 'bone_block_side']
        },
        cake: { modelType: basicBlockGen, textures: ['cake_top'] },
        cartography_table: {
            modelType: multiBlockGen,
            textures: [
                'cartography_table_top',
                'cartography_table_side3',
                'cartography_table_side1',
                'cartography_table_side2',
                'cartography_table_side3',
                'cartography_table_side3'
            ]
        },
        cauldron: {
            modelType: sideBlockGen,
            textures: ['cauldron_top', 'cauldron_bottom', 'cauldron_side']
        },
        composter: {
            modelType: sideBlockGen,
            textures: ['composter_top', 'composter_bottom', 'composter_side']
        },
        crafting_table: {
            modelType: multiBlockGen,
            textures: [
                'crafting_table_top',
                'oak_planks',
                'crafting_table_side',
                'crafting_table_side',
                'crafting_table_side',
                'crafting_table_front'
            ]
        },
        dispenser: {
            modelType: multiBlockGen,
            textures: [
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'dispenser_front'
            ]
        },
        dried_kelp: {
            modelType: sideBlockGen,
            textures: ['dried_kelp_top', 'dried_kelp_bottom', 'dried_kelp_side']
        },
        dropper: {
            modelType: multiBlockGen,
            textures: [
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'furnace_top',
                'dropper_front'
            ]
        },
        fletching_table: {
            modelType: basicBlockGen,
            textures: ['fletching_table_front']
        },
        frosted_ice: { modelType: basicBlockGen, textures: ['frosted_ice_0'] },
        furnace: { modelType: basicBlockGen, textures: ['furnace_front'] },
        grass_block: {
            modelType: sideBlockGen,
            textures: ['grass_block_top', 'dirt', 'grass_block_side']
        },
        hopper: { modelType: basicBlockGen, textures: ['hopper_outside'] },
        iron_door: { modelType: basicBlockGen, textures: ['iron_door_top'] },
        jukebox: { modelType: basicBlockGen, textures: ['jukebox_top'] },
        lectern: { modelType: basicBlockGen, textures: ['lectern_front'] },
        loom: { modelType: basicBlockGen, textures: ['loom_front'] },
        mycelium: { modelType: basicBlockGen, textures: ['mycelium_top'] },
        oak_door: { modelType: basicBlockGen, textures: ['oak_door_top'] },
        observer: { modelType: basicBlockGen, textures: ['observer_front'] },
        quartz_block: {
            modelType: basicBlockGen,
            textures: ['quartz_block_side']
        },
        scaffolding: {
            modelType: basicBlockGen,
            textures: ['scaffolding_top']
        },
        'smithing-table': {
            modelType: basicBlockGen,
            textures: ['smithing_table_front']
        },
        smoker: { modelType: basicBlockGen, textures: ['smoker_front'] },
        smooth_stone_slab: {
            modelType: basicBlockGen,
            textures: ['smooth_stone_slab_side']
        },
        stone_slab: { modelType: basicBlockGen, textures: ['stone_slab_side'] },
        tnt: {
            modelType: sideBlockGen,
            textures: ['tnt_top', 'tnt_bottom', 'tnt_side']
        }
    };

    return {
        setup: async (requiredBlocks: string[]) => {
            const loadedTextures = (
                await Promise.all(
                    requiredBlocks
                        .map(block => blockNameMap[block]?.textures ?? [block])
                        .reduce((a, b) => {
                            a.push(...b);
                            return a;
                        }, [])
                        .map(async block => {
                            return { [block]: await loadTexture(block) };
                        })
                )
            ).reduce((a, tex) => {
                a = { ...a, ...tex };
                return a;
            }, {});

            mergedTextures = new TextureMerger(loadedTextures);

            // Object.keys(loadedTextures).forEach(tex => {
            //     loadedTextures[tex].dispose();
            // });
        },
        getModel: async (block: string) => {
            return await (blockNameMap[block]?.modelType ?? basicBlockGen)(
                ...(blockNameMap[block]?.textures ?? [block])
            );
        }
    };
};
