type BlockStateDefinitionModel =
    | {
          model: string;
          x?: number;
          y?: number;
          uvlock?: boolean;
      }
    | {
          model: string;
          x?: number;
          y?: number;
          uvlock?: boolean;
          weight?: number;
      }[];

// This is necessary to work around a restriction that prevents index types from having non-conforming sibling types
export type BlockStateDefinitionVariant<T> = { [variant: string]: T };

// This is not technically a valid type. TS will complain if you try to instantiate an object with it.
// Luckily for our use cases, we don't need to. This just models existing data.
export interface BlockStateDefinition {
    variants?: BlockStateDefinitionVariant<BlockStateDefinitionModel>;
    multipart?: {
        apply: BlockStateDefinitionModel;
        when?: {
            OR?: BlockStateDefinitionVariant<string>[];
        } & BlockStateDefinitionVariant<string>;
    }[];
}

export type Vector = [number, number, number];
export type Faces = 'down' | 'up' | 'north' | 'south' | 'west' | 'east';

export interface BlockModel {
    parent?: string;
    ambientocclusion?: boolean;
    display?: {
        Position?: {
            rotation?: Vector;
            translation?: Vector;
            scale?: Vector;
        };
    };
    textures?: {
        particle?: string;
        [texture: string]: string;
    };
    elements: {
        from?: Vector;
        to?: Vector;
        rotation?: {
            origin?: Vector;
            axis?: 'x' | 'y' | 'z';
            angle?: number;
            rescale?: boolean;
        };
        shade?: boolean;
        faces?: {
            [face in Faces]: {
                uv?: [number, number, number, number];
                texture?: string;
                cullface?: Faces;
                rotation?: number;
                tintindex?: number;
            };
        };
    }[];
}
