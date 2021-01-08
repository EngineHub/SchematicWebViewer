import JSZip from 'jszip';

export interface ResourceLoader {
    getResourceBlob: (name: string) => Promise<string> | undefined;
    getResourceString: (name: string) => Promise<string> | undefined;
}

let zipPromise: Promise<JSZip> = undefined;
let zip: JSZip = undefined;

async function loadZip(jarUrl: string) {
    const zipFile = await (await fetch(jarUrl)).blob();
    const zip = await JSZip.loadAsync(zipFile);

    return zip;
}

export async function getResourceLoader(
    jarUrl: string
): Promise<ResourceLoader> {
    if (!zip) {
        if (!zipPromise) {
            zipPromise = loadZip(jarUrl);
        }
        zip = await zipPromise;
    }

    const stringCache: Map<string, string> = new Map();
    const blobCache: Map<string, string> = new Map();

    const getResourceBlob = async (name: string) => {
        if (blobCache.has(name)) {
            return blobCache.get(name);
        } else {
            const data = await zip
                .file(`assets/minecraft/${name}`)
                ?.async('blob');
            if (!data) {
                blobCache.set(name, undefined);
                return undefined;
            }
            const url = URL.createObjectURL(data);
            blobCache.set(name, url);
            return url;
        }
    };

    const getResourceString = async (name: string) => {
        if (stringCache.has(name)) {
            return stringCache.get(name);
        } else {
            const data = await zip
                .file(`assets/minecraft/${name}`)
                ?.async('string');
            stringCache.set(name, data);
            return data;
        }
    };

    return {
        getResourceBlob,
        getResourceString
    };
}
