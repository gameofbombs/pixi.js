import { GL_FORMATS } from '../rendering/index.js';

import type { GlTexture } from '../rendering/index.js';
import type { Buffer3DSource } from './Buffer3DSource.js';

export function glFormatToCount(f: GL_FORMATS)
{
    if (f === GL_FORMATS.RGBA
        || f === GL_FORMATS.RGBA_INTEGER)
    {
        return 4;
    }
    if (f === GL_FORMATS.RG || f === GL_FORMATS.RG_INTEGER)
    {
        return 2;
    }

    return 1;
}

export const glUploadBuffer3DResource = {

    id: '3d',

    storage(source: Buffer3DSource, glTexture: GlTexture, gl: WebGL2RenderingContext)
    {
        const w = glTexture.width = source.pixelWidth;
        const h = glTexture.height = source.pixelHeight;
        const d = glTexture.depth = source.depth;

        gl.texStorage3D(glTexture.target, source.mipLevelCount, glTexture.internalFormat, w, h, d);
    },

    upload(source: Buffer3DSource, glTexture: GlTexture, gl: WebGL2RenderingContext)
    {
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

        const { data, width, height, depth } = source;
        const { target, type, format } = glTexture;

        glTexture.width = width;
        glTexture.height = height;
        glTexture.depth = depth;
        if (source.useSubRegions)
        {
            this.uploadSubs(source, glTexture, gl);
        }
        else if (data)
        {
            gl.texSubImage3D(target, 0, 0, 0, 0,
                width, height, depth,
                format, type, data);
        }

        return true;
    },

    uploadSubs(source: Buffer3DSource, glTexture: GlTexture, gl: WebGL2RenderingContext)
    {
        const { regionsToUpdate } = source;
        const { target, type, format } = glTexture;

        for (let i = 0; i < regionsToUpdate.length; i++)
        {
            const region = regionsToUpdate[i];

            if (!region.dirty)
            {
                continue;
            }
            region.dirty = false;
            if (!region.isEmpty)
            {
                gl.texSubImage3D(target, 0,
                    region.layout.x, region.layout.y, region.layout.z,
                    region.layout.width, region.layout.height, region.layout.depth,
                    format, type, region.data);
                region.data = null;
            }
        }
        regionsToUpdate.length = 0;
    },

    copyTex(_source: Buffer3DSource, glTexture: GlTexture, gl: WebGL2RenderingContext, source_tex: GlTexture)
    {
        const w = Math.min(source_tex.width, glTexture.width);
        const h = Math.min(source_tex.height, glTexture.height);
        const d = Math.min(source_tex.depth, glTexture.depth);
        const frame_buf = gl.createFramebuffer();

        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, frame_buf);

        for (let lvl = 0; lvl < d; lvl++)
        {
            gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, source_tex.texture, 0, lvl);
            gl.copyTexSubImage3D(glTexture.target, 0, 0, 0, lvl, 0, 0, w, h);
        }

        gl.deleteFramebuffer(frame_buf);
    }
};
