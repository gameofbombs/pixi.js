/* eslint-disable camelcase */
export interface WebGLExtensions
{
    drawBuffers?: WEBGL_draw_buffers;
    depthTexture?: OES_texture_float;
    loseContext?: WEBGL_lose_context;
    vertexArrayObject?: OES_vertex_array_object;
    anisotropicFiltering?: EXT_texture_filter_anisotropic;
    uint32ElementIndex?: OES_element_index_uint;
    floatTexture?: OES_texture_float;
    floatTextureLinear?: OES_texture_float_linear;
    textureHalfFloat?: OES_texture_half_float;
    textureHalfFloatLinear?: OES_texture_half_float_linear;
    colorBufferFloat?: EXT_color_buffer_float;
    vertexAttribDivisorANGLE?: ANGLE_instanced_arrays;
    multiDraw?: WEBGL_multi_draw;
    multiDrawBvbi?: any;
    bvbi?: any;

    // webgl1 EXT_sRGB
    srgb?: EXT_sRGB;

}
/* eslint-enable camelcase */
