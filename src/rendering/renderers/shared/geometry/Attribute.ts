import { Buffer, type TypedArray } from '../buffer/Buffer.js';
import { type BufferOption, ensureIsBuffer } from './utils/ensureIsBuffer';

import type { VertexFormat } from './const';

/* eslint-disable max-len */

/**
 * The attribute options used by the constructor for adding geometries attributes
 * extends {@link rendering.Attribute} but allows for the buffer to be a typed or number array
 * @memberof rendering
 */
export type AttributeOption = Omit<IAttribute, 'buffer'> & { buffer?: BufferOption } | BufferOption | VertexFormat;

export type IAttribute = Partial<Omit<Attribute, 'buffer_index'>>;

export type ExtractedAttributeData = Omit<IAttribute, 'buffer'>;

/**
 * Holds the information for a single attribute structure required to render geometry.
 *
 * This does not contain the actual data, but instead has a buffer id that maps to a {@link PIXI.Buffer}
 * This can include anything from positions, uvs, normals, colors etc.
 * @memberof PIXI
 */
export class Attribute
{
    buffer: Buffer;
    buffer_index = -1;
    /** the format of the attribute */
    format: VertexFormat;
    /** set where the shader location is for this attribute */
    location?: number;
    /** the stride of the data in the buffer*/
    stride: number;
    /** the offset of the attribute from the buffer, defaults to 0 */
    offset: number | undefined;
    /** is this an instanced buffer? (defaults to false) */
    instance: boolean;
    divisor?: number;

    constructor(attr: IAttribute)
    {
        this.buffer = attr.buffer || null;
        this.format = attr.format || 'float32';
        this.stride = attr.stride;
        this.offset = attr.offset;
        this.instance = attr.instance;
        this.location = attr.location || undefined;
        this.divisor = attr.divisor || undefined;
    }
}

export function ensureIsAttribute(attribute: AttributeOption, default_buffer?: Buffer, default_instance?: boolean): IAttribute
{
    if (typeof attribute === 'string')
    {
        return {
            buffer: default_buffer,
            instance: default_instance,
            format: attribute as VertexFormat
        };
    }

    if (attribute instanceof Buffer || Array.isArray(attribute) || (attribute as TypedArray).BYTES_PER_ELEMENT)
    {
        return {
            buffer: ensureIsBuffer(attribute as BufferOption, false),
        };
    }

    const attr = attribute as IAttribute;

    if (attr.buffer)
    {
        attr.buffer = ensureIsBuffer(attr.buffer, false);
    }
    else
    {
        attr.buffer = default_buffer;
        attr.instance = default_instance;
    }

    return attr;
}
