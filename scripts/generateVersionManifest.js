const JSZip = require('jszip');
const got = require('got');
const fs = require('fs');

const MANIFEST_URL =
    'https://launchermeta.mojang.com/mc/game/version_manifest.json';

const zip = new JSZip();

async function runWorkers(workers, count = 1) {
    const methods = workers.slice();
    const results = [];

    async function task() {
        while (methods.length > 0) {
            const a = methods.pop();
            const r = await a();
            results.push(r);
        }
    }

    await Promise.all(new Array(count).fill(undefined).map(() => task()));
    return results;
}

async function getManifest() {
    return await got(MANIFEST_URL).json();
}

// 1.13
const DV_CUTOFF_DATE = new Date('2018-06-04T15:17:34+00:00');

async function getVersions() {
    const manifest = await getManifest();
    return manifest.versions
        .filter(ver => ver.type !== 'old_alpha' && ver.type !== 'old_beta')
        .filter(ver => {
            const releaseDate = new Date(ver.releaseTime);
            return releaseDate > DV_CUTOFF_DATE;
        })
        .reduce((versions, version) => {
            versions[version.id] = version.url;
            return versions;
        }, {});
}

async function generateVersionManifest() {
    const versions = await getVersions();
    console.log(
        `Generating manifest for ${Object.keys(versions).length} versions`
    );

    const manifest = (
        await runWorkers(
            Object.keys(versions).map(version => async () => {
                const data = await got(versions[version]).json();
                const jar = await got(data.downloads.client.url).buffer();
                const zipFile = await zip.loadAsync(jar);
                const versionFile = zipFile.file('version.json');
                if (!versionFile) {
                    console.log(`Skipping ${version}`);
                    return {};
                }
                const versionData = JSON.parse(
                    await versionFile.async('string')
                );

                console.log(
                    `${versionData.world_version} = ${data.downloads.client.url}`
                );

                return {
                    [versionData.world_version]: data.downloads.client.url
                };
            }),
            5
        )
    ).reduce(
        (versions, version) => ({
            ...versions,
            ...version
        }),
        {}
    );

    fs.writeFileSync('src/dataVersionMap.json', JSON.stringify(manifest, null, 0));
}

generateVersionManifest()
    .then(() => {})
    .catch(e => console.error(e));
