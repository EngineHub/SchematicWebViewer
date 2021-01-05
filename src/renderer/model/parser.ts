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
    model: string,
    resourceLoader: ResourceLoader
): Promise<BlockModel> {
    if (model.startsWith('minecraft:')) {
        model = model.substring('minecraft:'.length);
    }
    return JSON.parse(
        await resourceLoader.getResourceString(`models/${model}.json`)
    ) as BlockModel;
}
