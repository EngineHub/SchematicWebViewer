import { Faces, Vector } from "./model/types";

export function faceToFacingVector(face: Faces): Vector {
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
