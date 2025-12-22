import { readFile, writeFile } from 'node:fs/promises';

/**
 * This script takes in a WorldEdit blocks.version.json file, and outputs a file containing all blocks that should not occlude.
 */
async function doTheFilter() {
    const data = JSON.parse(
        await readFile(new URL('blocks.json', import.meta.url))
    );

    const nonOccluding = data
        .filter(
            bl =>
                bl.material.fullCube === false ||
                bl.material.opaque === false ||
                bl.id.includes('_stair')
        )
        .map(bl => bl.id.replace('minecraft:', ''));
    const transparent = data
        .filter(bl => bl.material.opaque === false || bl.id.includes('door'))
        .map(bl => bl.id.replace('minecraft:', ''));

    // MC has renamed this to short_grass; it's common enough to special case for old schematics.
    transparent.push('grass');

    await Promise.all([
        writeFile(
            new URL('../src/renderer/nonOccluding.json', import.meta.url),
            JSON.stringify(nonOccluding)
        ),
        writeFile(
            new URL('../src/renderer/transparent.json', import.meta.url),
            JSON.stringify(transparent)
        ),
    ]);
}

doTheFilter();
