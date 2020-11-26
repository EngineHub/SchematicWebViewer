import {
    WebGLRenderer,
    DirectionalLight,
    Color,
    CylinderGeometry,
    OrthographicCamera,
    MeshBasicMaterial,
    Scene,
    Mesh,
    AmbientLight
} from 'three';
import { decode, Tag } from 'nbt-ts';
import { unzip } from 'gzip-js';
import { loadSchematic, Schematic } from '@enginehub/schematicjs';
import { SchematicHandles } from '.';
import { SchematicRenderOptions } from './types';
import TextureManager from './textureManager';

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
    'structure_void'
]);

export async function renderSchematic(
    canvas: HTMLCanvasElement,
    schematic: string,
    options: SchematicRenderOptions
): Promise<SchematicHandles> {
    const scene = new Scene();
    let hasDestroyed = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    const textureManager = TextureManager(options);

    const buildSceneFromSchematic = async (
        schematic: Schematic,
        scene: Scene
    ) => {
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
            const meshFunc = await textureManager.getModel(block.type);
            const mesh = await meshFunc(
                (xOffset: number, yOffset: number, zOffset: number) => {
                    const offBlock = schematic.getBlock({
                        x: x + xOffset,
                        y: y + yOffset,
                        z: z + zOffset
                    });
                    return !offBlock || INVISIBLE_BLOCKS.has(offBlock.type);
                }
            );
            mesh.position.x = -schematic.width / 2 + x + 0.5;
            mesh.position.y = -schematic.height / 2 + y + 0.5;
            mesh.position.z = -schematic.length / 2 + z + 0.5;
            scene.add(mesh);
        }
    };

    const mousedownCallback = (e: MouseEvent) => {
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        e.preventDefault();
    };
    const mousemoveCallback = (e: MouseEvent) => {
        if (!isDragging) return;

        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        scene.rotation.y += deltaX / 100;
        scene.rotation.x += deltaY / 100;

        e.preventDefault();
    };
    const mouseupCallback = () => {
        isDragging = false;
    };
    const mouseWheelCallback = (e: WheelEvent) => {
        const delta = e.deltaY / 1000;

        camera.zoom = Math.max(camera.zoom - delta, 0.01);
        camera.updateProjectionMatrix();
        e.preventDefault();
    };

    const rootTag = parseNbt(schematic);
    const loadedSchematic = loadSchematic((rootTag as any).Schematic[0]);
    await textureManager.setup(
        loadedSchematic.blockTypes.filter(block => !INVISIBLE_BLOCKS.has(block))
    );
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
        10000
    );
    camera.position.z = cameraOffset * 5;
    camera.position.y = (cameraOffset / 2) * 5;
    camera.lookAt(0, 0, 0);

    if (options.renderArrow ?? true) {
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

    const worldLight = new DirectionalLight(0xffffff, 1);
    worldLight.position.x = cameraOffset;
    worldLight.position.z = cameraOffset;
    worldLight.position.y = cameraOffset;
    scene.add(worldLight);
    scene.add(new AmbientLight(new Color(), 0.5));

    if (options.renderBars ?? true) {
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

    const renderer = new WebGLRenderer({ antialias: false, canvas });
    renderer.setClearColor(new Color(0xffffff));
    renderer.setSize(options.size, options.size);

    canvas.addEventListener('mousedown', mousedownCallback);
    canvas.addEventListener('wheel', mouseWheelCallback);
    document.body.addEventListener('mousemove', mousemoveCallback);
    document.body.addEventListener('mouseup', mouseupCallback);

    let lastTime = performance.now();
    function render() {
        if (hasDestroyed) {
            return;
        }

        requestAnimationFrame(render);

        const nowTime = performance.now();
        const deltaTime = nowTime - lastTime;
        lastTime = nowTime;
        if (!isDragging) {
            scene.rotation.y += deltaTime / 4000;
        }

        renderer.render(scene, camera);
    }
    render();

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
