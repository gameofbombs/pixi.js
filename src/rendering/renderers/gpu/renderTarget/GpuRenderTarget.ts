import type { TextureSource } from '../../shared/texture/sources/TextureSource';

export const HDR_FORMATS: GPUTextureFormat[] = ['bgra8unorm', 'rgba16float', 'rgba32float'];

/**
 * A class which holds the canvas contexts and textures for a render target.
 * @memberof rendering
 * @ignore
 */
export class GpuRenderTarget
{
    public contexts: GPUCanvasContext[] = [];
    public msaaTextures: TextureSource[] = [];
    public msaa: boolean;
    public msaaSamples = 1;
    public width: number;
    public height: number;
    public hdr: 0 | 1 | 2 = 0;
    public descriptor: GPURenderPassDescriptor;
}
