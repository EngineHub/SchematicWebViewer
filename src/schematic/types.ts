import { make3DArray } from '../util/array';

export class Schematic implements Iterable<BlockVector3> {
    width: number;
    height: number;
    length: number;
    blocks: Block[][][];
    blockTypes: string[];

    constructor(
        width: number,
        height: number,
        length: number,
        blockTypes: string[]
    ) {
        this.width = width;
        this.height = height;
        this.length = length;
        this.blockTypes = blockTypes;

        this.blocks = make3DArray(width, height, length);
    }

    contains(pos: BlockVector3): boolean {
        return (
            pos.x < this.width &&
            pos.y < this.height &&
            pos.z < this.length &&
            pos.x >= 0 &&
            pos.y >= 0 &&
            pos.z >= 0
        );
    }

    getBlock(pos: BlockVector3): Block | undefined {
        if (!this.contains(pos)) {
            return undefined;
        }
        return this.blocks[pos.x][pos.y][pos.z];
    }

    setBlock(pos: BlockVector3, block: Block): void {
        if (!this.contains(pos)) {
            return;
        }
        this.blocks[pos.x][pos.y][pos.z] = block;
    }

    [Symbol.iterator](): Iterator<BlockVector3> {
        let nextX = 0;
        let nextY = 0;
        let nextZ = 0;

        return {
            next: function () {
                if (nextX === -1) {
                    return { done: true };
                }
                const answer = { x: nextX, y: nextY, z: nextZ };
                if (++nextX > this.width - 1) {
                    nextX = 0;
                    if (++nextZ > this.length - 1) {
                        nextZ = 0;
                        if (++nextY > this.height - 1) {
                            nextX = -1;
                        }
                    }
                }
                return { value: answer };
            }.bind(this)
        };
    }
}

export interface BlockVector3 {
    x: number;
    y: number;
    z: number;
}

export interface Block {
    type: string;
}
