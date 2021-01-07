const fs = require('fs/promises');

/**
 * This script takes in a WorldEdit blocks.version.json file, and outputs a file containing all blocks that should not occlude.
 */
async function doTheFilter() {
    const data = JSON.parse(await fs.readFile('blocks.json'));

    const blocks = data.filter(bl => bl.material.fullCube === false || bl.material.opaque === false || bl.id.includes('_stair')).map(bl => bl.id.replace('minecraft:', ''));
    await fs.writeFile('output.json', JSON.stringify(blocks));
}

doTheFilter();
