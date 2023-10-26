import {
    type Scene,
    Axis,
    Color3,
    MeshBuilder,
    StandardMaterial,
} from '@babylonjs/core';

export function addArrowToScene(scene: Scene, cameraOffset: number): void {
    const arrowMaterial = new StandardMaterial('arrow', scene);
    arrowMaterial.diffuseColor = Color3.Black();
    const arrowMesh = MeshBuilder.CreateCylinder(
        'arrow-mesh',
        {
            diameterTop: cameraOffset / 2,
            diameterBottom: cameraOffset / 2,
            height: cameraOffset / 200,
            tessellation: 3,
            subdivisions: 1,
        },
        scene
    );

    arrowMesh.material = arrowMaterial;
    arrowMesh.rotate(Axis.Y, -Math.PI / 2);

    arrowMesh.position.z = cameraOffset - 0.5;
    scene.addMesh(arrowMesh);
}

export function addBarsToScene(
    scene: Scene,
    cameraOffset: number,
    worldWidth: number,
    worldHeight: number,
    worldLength: number
): void {
    const gridMaterial = new StandardMaterial('grid', scene);
    gridMaterial.diffuseColor = Color3.Black();
    gridMaterial.alpha = 0.2;

    const gridMesh = MeshBuilder.CreateCylinder(
        'grid-mesh',
        {
            diameterTop: cameraOffset / 400,
            diameterBottom: cameraOffset / 400,
            height: 1,
            tessellation: 3,
            subdivisions: 1,
        },
        scene
    );
    gridMesh.material = gridMaterial;

    // generate a 3d grid
    for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
        for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
            const barMesh = gridMesh.clone();
            barMesh.scaling.y = worldLength * 2;
            barMesh.rotation.x = Math.PI / 2;
            barMesh.position.x = x;
            barMesh.position.y = y;
            scene.addMesh(barMesh);
        }
    }
    for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
        for (let y = -worldHeight / 2; y <= worldHeight / 2; y++) {
            const barMesh = gridMesh.clone();
            barMesh.scaling.y = worldWidth * 2;
            barMesh.rotation.z = Math.PI / 2;
            barMesh.position.z = z;
            barMesh.position.y = y;
            scene.addMesh(barMesh);
        }
    }
    for (let x = -worldWidth / 2; x <= worldWidth / 2; x++) {
        for (let z = -worldLength / 2; z <= worldLength / 2; z++) {
            const barMesh = gridMesh.clone();
            barMesh.scaling.y = worldHeight * 2;
            barMesh.position.x = x;
            barMesh.position.z = z;
            scene.addMesh(barMesh);
        }
    }
}
