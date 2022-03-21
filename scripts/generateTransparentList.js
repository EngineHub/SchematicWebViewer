// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs/promises');

/**
 * This script takes in a WorldEdit blocks.version.json file, and outputs a file containing all blocks that should not occlude.
 */
async function doTheFilter() {
    const data = JSON.parse(await fs.readFile('blocks.json'));

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
    await fs.writeFile(
        '../src/renderer/nonOccluding.json',
        JSON.stringify(nonOccluding)
    );
    await fs.writeFile(
        '../src/renderer/transparent.json',
        JSON.stringify(transparent)
    );
}

doTheFilter();
