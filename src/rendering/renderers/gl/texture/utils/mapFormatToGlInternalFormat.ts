import { DOMAdapter } from '../../../../../environment/adapter';

import type { GlRenderingContext } from '../../context/GlRenderingContext';
import type { WebGLExtensions } from '../../context/WebGLExtensions';

/**
 * Returns a lookup table that maps each type-format pair to a compatible internal format.
 * @function mapTypeAndFormatToInternalFormat
 * @private
 * @param gl - The rendering context.
 * @param extensions - The WebGL extensions.
 * @returns Lookup table.
 */
export function mapFormatToGlInternalFormat(
    gl: GlRenderingContext,
    extensions: WebGLExtensions,
): Record<string, number>
{
    let srgb = {};
    let bgra8unorm: number = gl.RGBA;

    if (!(gl instanceof DOMAdapter.get().getWebGLRenderingContext()))
    {
        srgb = {
            'rgba8unorm-srgb': gl.SRGB8_ALPHA8,
            'bgra8unorm-srgb': gl.SRGB8_ALPHA8,
        };

        bgra8unorm = gl.RGBA8;
    }
    else if (extensions.srgb)
    {
        srgb = {
            'rgba8unorm-srgb': extensions.srgb.SRGB8_ALPHA8_EXT,
            'bgra8unorm-srgb': extensions.srgb.SRGB8_ALPHA8_EXT,
        };
    }

    return {
        // 8-bit formats
        r8unorm: gl.R8,
        r8snorm: gl.R8_SNORM,
        r8uint: gl.R8UI,
        r8sint: gl.R8I,

        // 16-bit formats
        r16uint: gl.R16UI,
        r16sint: gl.R16I,
        r16float: gl.R16F,
        rg8unorm: gl.RG8,
        rg8snorm: gl.RG8_SNORM,
        rg8uint: gl.RG8UI,
        rg8sint: gl.RG8I,

        // 32-bit formats
        r32uint: gl.R32UI,
        r32sint: gl.R32I,
        r32float: gl.R32F,
        rg16uint: gl.RG16UI,
        rg16sint: gl.RG16I,
        rg16float: gl.RG16F,
        rgba8unorm: gl.RGBA8,

        ...srgb,

        // Packed 32-bit formats
        rgba8snorm: gl.RGBA8_SNORM,
        rgba8uint: gl.RGBA8UI,
        rgba8sint: gl.RGBA8I,
        bgra8unorm,
        rgb9e5ufloat: gl.RGB9_E5,
        rgb10a2unorm: gl.RGB10_A2,
        rg11b10ufloat: gl.R11F_G11F_B10F,

        // 64-bit formats
        rg32uint: gl.RG32UI,
        rg32sint: gl.RG32I,
        rg32float: gl.RG32F,
        rgba16uint: gl.RGBA16UI,
        rgba16sint: gl.RGBA16I,
        rgba16float: gl.RGBA16F,

        // 128-bit formats
        rgba32uint: gl.RGBA32UI,
        rgba32sint: gl.RGBA32I,
        rgba32float: gl.RGBA32F,

        // Depth/stencil formats
        stencil8: gl.STENCIL_INDEX8,
        depth16unorm: gl.DEPTH_COMPONENT16,
        depth24plus: gl.DEPTH_COMPONENT24,
        'depth24plus-stencil8': gl.DEPTH24_STENCIL8,
        depth32float: gl.DEPTH_COMPONENT32F,
        'depth32float-stencil8': gl.DEPTH32F_STENCIL8,
    };
}
