export interface PointData3D
{
    /** X coord */
    x: number;

    /** Y coord */
    y: number;

    z: number;
}

/**
 * Defines a size with a width and a height.
 * @memberof maths
 */
export interface Size3D
{
    /** The width. */
    width: number;
    /** The height. */
    height: number;
    /** The depth. */
    depth: number;
}

export interface TextureLayout3DOptions
{
    size: Size3D;
    offset: PointData3D;
}

export class Texture3DLayout
{
    width: number;
    height: number;
    depth: number;
    x: number;
    y: number;
    z: number;

    constructor(options: TextureLayout3DOptions)
    {
        this.x = options.offset.x;
        this.y = options.offset.y;
        this.z = options.offset.z;
        this.width = options.size.width;
        this.height = options.size.height;
        this.depth = options.size.depth;
    }
}
