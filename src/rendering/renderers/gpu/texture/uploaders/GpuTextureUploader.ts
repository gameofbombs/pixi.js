import type { TextureSource } from '../../../shared/texture/sources/TextureSource';
import type { GPU } from '../../GpuDeviceSystem';

export interface GpuTextureUploader<T extends TextureSource = TextureSource>
{
    id: string;
    uploadGpu(source: T, gpuTexture: GPUTexture, gpu: GPU): void;
}
