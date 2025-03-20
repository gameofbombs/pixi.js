import type { ICanvas } from '../../../../environment/canvas/ICanvas';
import type { TextureSource } from './sources/TextureSource';
import type { Texture } from './Texture';

export type GetPixelsOutput = {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
};

export interface CanvasGenerator
{
    generateCanvas(texture: Texture | TextureSource): ICanvas;
    getPixels(texture: Texture | TextureSource): GetPixelsOutput;
}
