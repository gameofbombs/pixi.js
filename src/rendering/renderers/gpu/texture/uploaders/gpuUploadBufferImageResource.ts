import type { BufferImageSource } from '../../../shared/texture/sources/BufferImageSource';
import type { GPU } from '../../GpuDeviceSystem';
import type { GpuTextureUploader } from './GpuTextureUploader';

export const gpuUploadBufferImageResource = {

    id: 'buffer',

    uploadGpu(source: BufferImageSource, gpuTexture: GPUTexture, gpu: GPU)
    {
        const data = source.data;

        if (!data)
        {
            return;
        }

        const total = (source.pixelWidth | 0) * (source.pixelHeight | 0);
        const bytesPerPixel = data.byteLength / total;

        gpu.device.queue.writeTexture(
            { texture: gpuTexture },
            data,
            {
                offset: 0,
                rowsPerImage: source.pixelHeight,
                bytesPerRow: source.pixelWidth * bytesPerPixel,
            },
            {
                width: source.pixelWidth,
                height: source.pixelHeight,
                depthOrArrayLayers: source.depth,
            }
        );
    }
} as GpuTextureUploader<BufferImageSource>;

