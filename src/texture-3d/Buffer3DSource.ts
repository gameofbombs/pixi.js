import {
    type GLTextureUploader,
    type GpuTextureUploader,
    TextureSource,
    type TextureSourceOptions,
    type TypedArray
} from '../rendering/index.js';
import { glUploadBuffer3DResource } from './glUploadBuffer3DResource.js';
import { gpuUploadBuffer3DResource } from './gpuUploadBuffer3DResource';
import { Texture3D } from './Texture3D.js';

/**
 * Constructor options for BufferResource.
 * @memberof PIXI
 */
export interface IBuffer3DResourceOptions extends TextureSourceOptions
{
    useFixedSize?: boolean;
    useSubRegions?: boolean;
}

/**
 * Buffer resource with data of typed array.
 * @memberof PIXI
 */
export class Buffer3DSource extends TextureSource
{
    public glUploader: GLTextureUploader = glUploadBuffer3DResource;
    public gpuUploader: GpuTextureUploader = gpuUploadBuffer3DResource;

    public depth: number;
    public useSubRegions: boolean;

    public regionsToUpdate: Array<Texture3D> = [];

    /**
     * @param source - Source buffer
     * @param options - Options
     * @param {number} options.width - Width of the texture
     * @param {number} options.height - Height of the texture
     * @param {1|2|4|8} [options.unpackAlignment=4] - The alignment of the pixel rows.
     */
    constructor(options: IBuffer3DResourceOptions)
    {
        super({ ...options, dimension: options.dimension ?? '3d', viewDimension: options.viewDimension ?? '3d' });

        if (!options.width || !options.height || !options.depth)
        {
            throw new Error('Buffer3DSource size should be specified');
        }
        this.useSubRegions = options.useSubRegions ?? false;
    }

    unload(): void
    {
        this.data = null;
    }

    public resize3D(width: number, height: number, depth: number, resolution?: number): boolean
    {
        if (this.depth !== depth)
        {
            this.depth = depth;
            this.pixelWidth = -1;
        }

        return this.resize(width, height, resolution);
    }

    /**
     * Used to auto-detect the type of resource.
     * @param {*} source - The source object
     * @returns {boolean} `true` if buffer source
     */
    static test(source: unknown): source is TypedArray
    {
        return source === null
            || source instanceof Int8Array
            || source instanceof Uint8Array
            || source instanceof Uint8ClampedArray
            || source instanceof Int16Array
            || source instanceof Uint16Array
            || source instanceof Int32Array
            || source instanceof Uint32Array
            || source instanceof Float32Array;
    }
}
