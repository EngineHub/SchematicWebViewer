import { unzip } from 'gzip-js';
import type { TagMap } from '@enginehub/nbt-ts';
import { decode } from '@enginehub/nbt-ts';
import type { Faces, Vector } from './model/types';
import NonOccludingBlocks from './nonOccluding.json';
import TransparentBlocks from './transparent.json';

const FACE_TO_FACING_VECTOR: Record<Faces, Vector> = {
    up: [0, 1, 0],
    down: [0, -1, 0],
    bottom: [0, -1, 0],
    north: [0, 0, -1],
    south: [0, 0, 1],
    east: [1, 0, 0],
    west: [-1, 0, 0],
};

export function faceToFacingVector(face: Faces): Vector {
    const vec = FACE_TO_FACING_VECTOR[face];
    if (!vec) {
        throw new Error(`Unknown face: ${face}`);
    }
    return vec;
}

export const INVISIBLE_BLOCKS = new Set([
    'air',
    'cave_air',
    'void_air',
    'structure_void',
    'barrier',
    'light',
]);

export const TRANSPARENT_BLOCKS = new Set([
    ...INVISIBLE_BLOCKS,
    ...TransparentBlocks,
]);

export const NON_OCCLUDING_BLOCKS = new Set([
    ...INVISIBLE_BLOCKS,
    ...NonOccludingBlocks,
]);

export function parseNbt(nbt: string): TagMap {
    const buff = Buffer.from(nbt, 'base64');
    const deflated = Buffer.from(unzip(buff));
    const data = decode(deflated, {
        unnamed: false,
        useMaps: true,
    });
    return data.value as TagMap;
}
