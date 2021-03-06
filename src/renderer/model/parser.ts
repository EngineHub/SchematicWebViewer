import deepmerge from 'deepmerge';
import { ResourceLoader } from '../../resource/resourceLoader';
import { BlockModel, BlockStateDefinition } from './types';

export async function getBlockStateDefinition(
    block: string,
    resourceLoader: ResourceLoader
): Promise<BlockStateDefinition> {
    return JSON.parse(
        await resourceLoader.getResourceString(`blockstates/${block}.json`)
    ) as BlockStateDefinition;
}

export async function getModel(
    modelRef: string,
    resourceLoader: ResourceLoader
): Promise<BlockModel> {
    if (modelRef.startsWith('minecraft:')) {
        modelRef = modelRef.substring('minecraft:'.length);
    }
    let model = JSON.parse(
        await resourceLoader.getResourceString(`models/${modelRef}.json`)
    ) as BlockModel;

    if (model.parent) {
        let parent = await getModel(model.parent, resourceLoader);
        if (model['elements'] && parent['elements']) {
            delete parent['elements'];
        }
        model = deepmerge(parent, model);
        delete model.parent;
    }

    return model;
}
