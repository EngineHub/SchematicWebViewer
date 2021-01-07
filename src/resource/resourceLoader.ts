import JSZip from 'jszip';

export interface ResourceLoader {
    getResourceBlob: (name: string) => Promise<Blob> | undefined;
    getResourceString: (name: string) => Promise<string> | undefined;
}

export async function getResourceLoader(
    jarUrl: string
): Promise<ResourceLoader> {
    const zipFile = await (await fetch(jarUrl)).blob();
    const zip = await JSZip.loadAsync(zipFile);

    const stringCache: Map<string, string> = new Map();
    const blobCache: Map<string, Blob> = new Map();

    const getResourceBlob = async (name: string) => {
        if (blobCache.has(name)) {
            return blobCache.get(name);
        } else {
            const data = await zip.file(`assets/minecraft/${name}`)?.async('blob');
            blobCache.set(name, data);
            return data;
        }
    };

    const getResourceString = async (name: string) => {
        if (stringCache.has(name)) {
            return stringCache.get(name);
        } else {
            const data = await zip.file(`assets/minecraft/${name}`)?.async('string');
            stringCache.set(name, data);
            return data;
        }
    };

    return {
        getResourceBlob,
        getResourceString
    };
}
