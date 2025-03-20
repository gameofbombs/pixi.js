import type { TEXTURE_FORMATS } from '../const';

export const mapFormatToPixelSize: Record<TEXTURE_FORMATS, number> = {
    // 8-bit formats
    r8unorm: 1,
    r8snorm: 1,
    r8uint: 1,
    r8sint: 1,

    // 16-bit formats
    r16uint: 2,
    r16sint: 2,
    r16float: 2,
    rg8unorm: 2,
    rg8snorm: 2,
    rg8uint: 2,
    rg8sint: 2,

    // 32-bit formats
    r32uint: 4,
    r32sint: 4,
    r32float: 4,
    rg16uint: 4,
    rg16sint: 4,
    rg16float: 4,
    rgba8unorm: 4,
    'rgba8unorm-srgb': 4,

    // Packed 32-bit formats
    rgba8snorm: 4,
    rgba8uint: 4,
    rgba8sint: 4,
    bgra8unorm: 4,
    'bgra8unorm-srgb': 4,
    rgb9e5ufloat: 4,
    rgb10a2unorm: 4,
    rg11b10ufloat: 4,

    // 64-bit formats
    rg32uint: 8,
    rg32sint: 8,
    rg32float: 8,
    rgba16uint: 8,
    rgba16sint: 8,
    rgba16float: 8,

    // 128-bit formats
    rgba32uint: 16,
    rgba32sint: 16,
    rgba32float: 16,

    // Depth/stencil formats
    stencil8: 1,
    depth16unorm: 2,
    depth24plus: 3,
    'depth24plus-stencil8': 4,
    depth32float: 4,
    'depth32float-stencil8': 5,
};
