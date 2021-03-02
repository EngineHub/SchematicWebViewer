import {
    WebGLRenderer,
    Color,
    CylinderGeometry,
    OrthographicCamera,
    MeshBasicMaterial,
    Scene,
    Mesh,
    Object3D
} from 'three';
import { decode, Tag } from 'nbt-ts';
import { unzip } from 'gzip-js';
import { loadSchematic, Schematic } from '@enginehub/schematicjs';
import { SchematicHandles } from '.';
import { SchematicRenderOptions } from './types';
import { getModelLoader } from './model/loader';
import { getResourceLoader } from '../resource/resourceLoader';
import NonOccludingBlocks from './nonOccluding.json';
import { POSSIBLE_FACES } from './model/types';
import { faceToFacingVector } from './utils';

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
        jarUrl,
        size,
        orbit = true,
        renderArrow = true,
        renderBars = true,
        antialias = false,
        alpha = false,
        backgroundColor = 0xffffff
    }: SchematicRenderOptions
): Promise<SchematicHandles> {
    const scene = new Scene();
    let hasDestroyed = false;
    let isDragging = false;
    let dragButton = -1;
    let dragStartX = 0;
    let dragStartY = 0;

    const resourceLoader = await getResourceLoader(jarUrl);
    const modelLoader = await getModelLoader(resourceLoader);

    const buildSceneFromSchematic = async (
        schematic: Schematic,
        scene: Scene
    ) => {
        const meshMap = new Map();

        for (const pos of schematic) {
            const { x, y, z } = pos;
            const block = schematic.getBlock(pos);
            if (!block) {
                console.log(
                    `Missing block ${x} ${y} ${z} ${JSON.stringify(schematic)}`
                );
                continue;
            }
            if (INVISIBLE_BLOCKS.has(block.type)) {
                continue;
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
                continue;
            }

            let mesh: Object3D = undefined;
            if (meshMap.has(block)) {
                mesh = meshMap.get(block).clone();
            } else {
                mesh = await modelLoader.getModel(block);
                meshMap.set(block, mesh);
            }
            if (!mesh || mesh.children.length === 0) {
                continue;
            }

            mesh.position.x = -schematic.width / 2 + x + 0.5;
            mesh.position.y = -schematic.height / 2 + y + 0.5;
            mesh.position.z = -schematic.length / 2 + z + 0.5;
            scene.add(mesh);
        }

        meshMap.clear();
    };

    const mousedownCallback = (e: MouseEvent) => {
        isDragging = true;
        dragButton = e.button;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        e.preventDefault();
    };

    const touchdownCallback = (e: TouchEvent) => {
        isDragging = true;
        dragButton = -1;
        const touch = e.touches.item(0);

        dragStartX = touch.clientX;
        dragStartY = touch.clientY;
        e.preventDefault();
    };
    const touchmoveCallback = (e: TouchEvent) => {
        if (!isDragging) {
            return;
        }

        const touch = e.touches.item(0);
        const deltaX = touch.clientX - dragStartX;
        const deltaY = touch.clientY - dragStartY;
        dragStartX = touch.clientX;
        dragStartY = touch.clientY;

        scene.rotation.y += deltaX / 100;
        scene.rotation.x += deltaY / 100;

        if (!orbit) {
            render();
        }
    };

    const mousemoveCallback = (e: MouseEvent) => {
        if (!isDragging) {
            return;
        }

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        if (dragButton === 0) {
            scene.rotation.y += deltaX / 100;
            scene.rotation.x += deltaY / 100;
        }

        if (!orbit) {
            render();
        }

        e.preventDefault();
    };
    const mouseupCallback = (e: MouseEvent) => {
        isDragging = false;
        dragButton = -1;

        if (!orbit) {
            render();
        }
    };

    const mouseWheelCallback = (e: WheelEvent) => {
        const delta = e.deltaY / 1000;

        camera.zoom = Math.max(camera.zoom - delta, 0.01);
        camera.updateProjectionMatrix();
        e.preventDefault();

        if (!orbit) {
            render();
        }
    };

    const rootTag = parseNbt(schematic);
    const loadedSchematic = loadSchematic((rootTag as any).Schematic[0]);
    await buildSceneFromSchematic(loadedSchematic, scene);
    const {
        width: worldWidth,
        height: worldHeight,
        length: worldLength
    } = loadedSchematic;
    const cameraOffset = Math.max(worldWidth, worldLength) / 2 + 1;
    const camera = new OrthographicCamera(
        -cameraOffset,
        cameraOffset,
        cameraOffset,
        -cameraOffset,
        0.01,
        1000
    );
    camera.position.z = cameraOffset * 5;
    camera.position.y = (cameraOffset / 2) * 5;
    camera.lookAt(0, 0, 0);

    if (renderArrow) {
        const arrowMaterial = new MeshBasicMaterial({
            color: new Color(0x000000)
        });
        const arrowGeometry = new CylinderGeometry(
            cameraOffset / 4,
            cameraOffset / 4,
            cameraOffset / 200,
            3,
            1,
            false
        );
        const arrowMesh = new Mesh(arrowGeometry, arrowMaterial);
        arrowMesh.position.z = cameraOffset - 0.5;
        scene.add(arrowMesh);
    }

    if (renderBars) {
        const gridGeom = new CylinderGeometry(
            cameraOffset / 400,
            cameraOffset / 400,
            1,
            3,
            1,
            false
        );

        const gridMaterial = new MeshBasicMaterial({
            color: new Color(0x000000),
            opacity: 0.2,
            transparent: true
        });

        // generate a 3d grid
        for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
            for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
                const barMesh = new Mesh(gridGeom, gridMaterial);
                barMesh.scale.y = worldLength * 2;
                barMesh.rotation.x = Math.PI / 2;
                barMesh.position.x = x;
                barMesh.position.y = y;
                scene.add(barMesh);
            }
        }
        for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
            for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
                const barMesh = new Mesh(gridGeom, gridMaterial);
                barMesh.scale.y = worldWidth * 2;
                barMesh.rotation.z = Math.PI / 2;
                barMesh.position.z = z;
                barMesh.position.y = y;
                scene.add(barMesh);
            }
        }
        for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
            for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
                const barMesh = new Mesh(gridGeom, gridMaterial);
                barMesh.scale.y = worldHeight * 2;
                barMesh.position.x = x;
                barMesh.position.z = z;
                scene.add(barMesh);
            }
        }
    }

    const renderer = new WebGLRenderer({
        antialias,
        canvas,
        powerPreference: 'high-performance',
        alpha
    });
    if (!alpha) {
        renderer.setClearColor(new Color(backgroundColor));
    }
    renderer.setSize(size, size);

    canvas.addEventListener('mousedown', mousedownCallback);
    canvas.addEventListener('wheel', mouseWheelCallback);
    canvas.addEventListener('contextmenu', e => {
        // right click is drag, don't let the menu get in the way.
        e.preventDefault();
        return false;
    });
    canvas.addEventListener('touchstart', touchdownCallback);

    document.body.addEventListener('mousemove', mousemoveCallback);
    document.body.addEventListener('mouseup', mouseupCallback);

    document.body.addEventListener('touchmove', touchmoveCallback);
    document.body.addEventListener('touchcancel', mouseupCallback);
    document.body.addEventListener('touchend', mouseupCallback);

    let lastTime = performance.now();
    function render() {
        if (hasDestroyed) {
            return;
        }

        if (orbit) {
            requestAnimationFrame(render);

            const nowTime = performance.now();
            const deltaTime = nowTime - lastTime;
            lastTime = nowTime;
            if (!isDragging) {
                scene.rotation.y += deltaTime / 4000;
            }
        }

        renderer.render(scene, camera);
    }
    render();
    console.log(renderer.info.render);

    return {
        resize(size: number): void {
            renderer.setSize(size, size);
        },
        destroy() {
            hasDestroyed = true;
            canvas.removeEventListener('mousedown', mousedownCallback);
            canvas.removeEventListener('wheel', mouseWheelCallback);
            document.body.removeEventListener('mousemove', mousemoveCallback);
            document.body.removeEventListener('mouseup', mouseupCallback);
        }
    };
}
