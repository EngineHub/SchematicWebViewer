import { Schematic, Block } from './types';
import { Tag, Short } from 'nbt-ts/lib';

export function loadSchematic(tag: Tag): Schematic {
    const blocks = (tag as any).get('BlockData') as Buffer;
    const width = ((tag as any).get('Width') as Short).value;
    const height = ((tag as any).get('Height') as Short).value;
    const length = ((tag as any).get('Length') as Short).value;

    const palette = new Map<number, Block>();
    for (let [key, value] of (tag as any).get('Palette').entries()) {
        // sanitize the block name
        let colonIndex = key.indexOf(':');
        if (colonIndex !== -1) {
            key = key.substring(colonIndex + 1);
        }

        let bracketIndex = key.indexOf('[');
        if (bracketIndex !== -1) {
            key = key.substring(0, bracketIndex);
        }

        palette.set(value.value, { type: key });
    }

    const schematic = new Schematic(
        width,
        height,
        length,
        [...palette.values()].map(key => key.type)
    );
    let index = 0;
    let i = 0;
    while (i < blocks.length) {
        let value = 0;
        let varintLength = 0;

        while (true) {
            value |= (blocks[i] & 127) << (varintLength++ * 7);
            if (varintLength > 5) {
                throw new Error('VarInt too big');
            }
            if ((blocks[i] & 128) != 128) {
                i++;
                break;
            }
            i++;
        }

        let y = Math.floor(index / (width * length));
        let z = Math.floor((index % (width * length)) / width);
        let x = (index % (width * length)) % width;

        index++;

        const block = palette.get(value);
        schematic.setBlock({ x, y, z }, block);
    }

    return schematic;
}
