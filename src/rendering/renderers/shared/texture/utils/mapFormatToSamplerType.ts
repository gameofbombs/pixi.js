import { SAMPLER_TYPES, type TEXTURE_FORMATS } from "../const";

export const mapFormatToSamplerType: Record<TEXTURE_FORMATS, SAMPLER_TYPES> = {
    // 8-bit formats
    r8unorm: SAMPLER_TYPES.INT,
    r8snorm: SAMPLER_TYPES.INT,
    r8uint: SAMPLER_TYPES.INT,
    r8sint: SAMPLER_TYPES.INT,

    // 16-bit formats
    r16uint: SAMPLER_TYPES.UINT,
    r16sint: SAMPLER_TYPES.INT,
    r16float: SAMPLER_TYPES.FLOAT,
    rg8unorm: SAMPLER_TYPES.FLOAT,
    rg8snorm: SAMPLER_TYPES.FLOAT,
    rg8uint: SAMPLER_TYPES.UINT,
    rg8sint: SAMPLER_TYPES.INT,

    // 32-bit formats
    r32uint: SAMPLER_TYPES.UINT,
    r32sint: SAMPLER_TYPES.INT,
    r32float: SAMPLER_TYPES.FLOAT,
    rg16uint: SAMPLER_TYPES.UINT,
    rg16sint: SAMPLER_TYPES.INT,
    rg16float: SAMPLER_TYPES.FLOAT,
    rgba8unorm: SAMPLER_TYPES.UINT,
    'rgba8unorm-srgb': SAMPLER_TYPES.INT,

    // Packed 32-bit formats
    rgba8snorm: SAMPLER_TYPES.FLOAT,
    rgba8uint: SAMPLER_TYPES.UINT,
    rgba8sint: SAMPLER_TYPES.INT,
    bgra8unorm: SAMPLER_TYPES.UINT,
    'bgra8unorm-srgb': SAMPLER_TYPES.UINT,
    rgb9e5ufloat: SAMPLER_TYPES.UINT,
    rgb10a2unorm: SAMPLER_TYPES.FLOAT,
    rg11b10ufloat: SAMPLER_TYPES.FLOAT,

    // 64-bit formats
    rg32uint: SAMPLER_TYPES.UINT,
    rg32sint: SAMPLER_TYPES.INT,
    rg32float: SAMPLER_TYPES.FLOAT,
    rgba16uint: SAMPLER_TYPES.UINT,
    rgba16sint: SAMPLER_TYPES.INT,
    rgba16float: SAMPLER_TYPES.FLOAT,

    // 128-bit formats
    rgba32uint: SAMPLER_TYPES.UINT,
    rgba32sint: SAMPLER_TYPES.INT,
    rgba32float: SAMPLER_TYPES.FLOAT,

    // Depth/stencil formats
    stencil8: SAMPLER_TYPES.INT,
    depth16unorm: SAMPLER_TYPES.FLOAT,
    depth24plus: SAMPLER_TYPES.FLOAT,
    'depth24plus-stencil8': SAMPLER_TYPES.FLOAT,
    depth32float: SAMPLER_TYPES.SHADOW,
    'depth32float-stencil8': SAMPLER_TYPES.SHADOW,
};
