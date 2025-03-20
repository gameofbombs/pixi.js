import { gpuUploadImageResource } from './gpuUploadImageSource';

import type { VideoSource } from '../../../shared/texture/sources/VideoSource';
import type { GPU } from '../../GpuDeviceSystem';
import type { GpuTextureUploader } from './GpuTextureUploader';

export const gpuUploadVideoResource = {

    id: 'video',

    uploadGpu(source: VideoSource, gpuTexture: GPUTexture, gpu: GPU)
    {
        gpuUploadImageResource.uploadGpu(source, gpuTexture, gpu);
    }
} as GpuTextureUploader<VideoSource>;

