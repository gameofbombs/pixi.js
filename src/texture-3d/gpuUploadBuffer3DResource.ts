import type { GPU } from '../rendering/renderers/gpu/GpuDeviceSystem';
import type { Buffer3DSource } from "./Buffer3DSource";
import {mapFormatToPixelSize} from "../rendering/renderers/shared/texture/utils/mapFormatToPixelSize";

export const gpuUploadBuffer3DResource = {

    id: '3d',

    uploadGpu(source: Buffer3DSource, gpuTexture: GPUTexture, gpu: GPU)
    {
        const data = source.data;
        const bytesPerPixel = mapFormatToPixelSize[source.format];

        if (source.useSubRegions)
        {
            this.uploadSubs(source, gpuTexture, gpu);

            return;
        }
        if (!data)
        {
            return;
        }

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
    },

    uploadSubs(source: Buffer3DSource, gpuTexture: GPUTexture, gpu: GPU)
    {
        const { regionsToUpdate } = source;

        const bytesPerPixel = mapFormatToPixelSize[source.format];

        for (let i = 0; i < regionsToUpdate.length; i++)
        {
            const region = regionsToUpdate[i];

            if (!region.dirty)
            {
                continue;
            }

            region.dirty = false;
            if (region.isEmpty)
            {
                continue;
            }
            const layout = region.layout;

            gpu.device.queue.writeTexture(
                { texture: gpuTexture, origin: layout },
                region.data,
                {
                    offset: 0,
                    rowsPerImage: layout.height,
                    bytesPerRow: layout.width * bytesPerPixel,
                },
                {
                    width: layout.width,
                    height: layout.height,
                    depthOrArrayLayers: layout.depth,
                }
            );
            region.data = null;
        }
        regionsToUpdate.length = 0;
    }
};

