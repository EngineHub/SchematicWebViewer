import { Faces, Vector } from './model/types';

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

export type Runner<R = any> = (...args: any[]) => Promise<R>;

export async function runPromisePool<R>(
    workers: Runner<R>[],
    count = 25
): Promise<R[]> {
    if (workers.length === 0) {
        return [];
    }

    const methods = workers.slice();
    const results: R[] = [];

    async function task(): Promise<void> {
        while (methods.length > 0) {
            const a = methods.pop()!;
            const r = await a();
            results.push(r);
        }
    }

    await Promise.all(new Array(count).fill(undefined).map(() => task()));
    return results.reverse();
}
