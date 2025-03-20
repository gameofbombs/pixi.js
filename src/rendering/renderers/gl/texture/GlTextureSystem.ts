import { DOMAdapter } from '../../../../environment/adapter';
import { ExtensionType } from '../../../../extensions/Extensions';
import { SAMPLER_TYPES } from '../../shared/texture/const';
import { Texture } from '../../shared/texture/Texture';
import { mapFormatToSamplerType } from '../../shared/texture/utils/mapFormatToSamplerType';
import { GL_TARGETS } from './const';
import { GlTexture } from './GlTexture';
import { glUploadBufferImageResource } from './uploaders/glUploadBufferImageResource';
import { glUploadImageResource } from './uploaders/glUploadImageResource';
import { glUploadVideoResource } from './uploaders/glUploadVideoResource';
import { applyStyleParams } from './utils/applyStyleParams';
import { mapFormatToGlFormat } from './utils/mapFormatToGlFormat';
import { mapFormatToGlInternalFormat } from './utils/mapFormatToGlInternalFormat';
import { mapFormatToGlType } from './utils/mapFormatToGlType';
import { unpremultiplyAlpha } from './utils/unpremultiplyAlpha';

import type { ICanvas } from '../../../../environment/canvas/ICanvas';
import type { System } from '../../shared/system/System';
import type { CanvasGenerator, GetPixelsOutput } from '../../shared/texture/GenerateCanvas';
import type { TextureSource } from '../../shared/texture/sources/TextureSource';
import type { BindableTexture } from '../../shared/texture/Texture';
import type { TextureStyle } from '../../shared/texture/TextureStyle';
import type { GlRenderingContext } from '../context/GlRenderingContext';
import type { WebGLRenderer } from '../WebGLRenderer';
import type { GLTextureUploader } from './uploaders/GLTextureUploader';

const BYTES_PER_PIXEL = 4;

export const glUploadUnknown: GLTextureUploader = {
    id: 'unknown',
    storage(source: TextureSource, glTexture: GlTexture, gl: WebGL2RenderingContext): void
    {
        if (source.glMutableSize)
        {
            return;
        }

        const w = glTexture.width = source.pixelWidth;
        const h = glTexture.height = source.pixelHeight;

        gl.texStorage2D(gl.TEXTURE_2D, source.mipLevelCount, glTexture.internalFormat, w, h);
    },
    upload(source: TextureSource, glTexture: GlTexture, gl: WebGL2RenderingContext): void
    {
        if (!source.glMutableSize)
        {
            return;
        }
        if (glTexture.width === source.pixelWidth
            && glTexture.height === source.pixelHeight)
        {
            return;
        }

        const w = glTexture.width = source.pixelWidth;
        const h = glTexture.height = source.pixelHeight;

        gl.texImage2D(gl.TEXTURE_2D, 0, glTexture.internalFormat, w, h,
            0, glTexture.format, glTexture.type, null);
        // nothing
        // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.pixelWidth,
        // source.pixelHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
};

/**
 * The system for managing textures in WebGL.
 * @memberof rendering
 */
export class GlTextureSystem implements System, CanvasGenerator
{
    /** @ignore */
    public static extension = {
        type: [
            ExtensionType.WebGLSystem,
        ],
        name: 'texture',
    } as const;

    public readonly managedTextures = new Map<number, TextureSource>();

    private readonly _renderer: WebGLRenderer;

    private _glTextures: Record<number, GlTexture> = Object.create(null);
    private _glSamplers: Record<string, WebGLSampler> = Object.create(null);

    _boundTextures: TextureSource[] = [];
    private _activeTextureLocation = -1;

    private _boundSamplers: Record<number, WebGLSampler> = Object.create(null);

    private readonly _uploads: Record<string, GLTextureUploader> = {
        unknown: glUploadUnknown,
        image: glUploadImageResource,
        buffer: glUploadBufferImageResource,
        video: glUploadVideoResource,
    };

    private _gl: GlRenderingContext;
    private _mapFormatToInternalFormat: Record<string, number>;
    private _mapFormatToType: Record<string, number>;
    private _mapFormatToFormat: Record<string, number>;

    // TODO - separate samplers will be a cool thing to add, but not right now!
    private readonly _useSeparateSamplers = false;

    constructor(renderer: WebGLRenderer)
    {
        this._renderer = renderer;
        this._renderer.renderableGC.addManagedHash(this, '_glTextures');
        this._renderer.renderableGC.addManagedHash(this, '_glSamplers');
    }

    protected contextChange(gl: GlRenderingContext): void
    {
        this._gl = gl;

        if (!this._mapFormatToInternalFormat)
        {
            this._mapFormatToInternalFormat = mapFormatToGlInternalFormat(gl, this._renderer.context.extensions);

            this._mapFormatToType = mapFormatToGlType(gl);
            this._mapFormatToFormat = mapFormatToGlFormat(gl);
        }

        this._glTextures = Object.create(null);
        this._glSamplers = Object.create(null);
        this._boundSamplers = Object.create(null);

        for (let i = 0; i < 16; i++)
        {
            this.bind(Texture.EMPTY, i);
        }
    }

    public initSource(source: TextureSource)
    {
        this.bind(source);
    }

    public bind(texture: BindableTexture, location = 0)
    {
        const source = texture?.source;

        if (source)
        {
            this.bindSource(source, location);

            if (this._useSeparateSamplers)
            {
                this._bindSampler(source.style, location);
            }
        }
        else
        {
            this.bindSource(null, location);

            if (this._useSeparateSamplers)
            {
                this._bindSampler(null, location);
            }
        }
    }

    public bindSource(source: TextureSource, location?: number): void
    {
        const gl = this._gl;

        location = location ?? source._glLastBindLocation;

        if (this._boundTextures[location] !== source)
        {
            this._boundTextures[location] = source;
            this._activateLocation(location);

            source = source || Texture.EMPTY.source;

            // bind texture and source!
            const glTexture = this.getGlSource(source);

            source._glLastBindLocation = location;
            gl.bindTexture(glTexture.target, glTexture.texture);
        }

        if (source)
        {
            source._touched = this._renderer.textureGC.count;
            source.checkUpdate();
        }
    }

    private _bindSampler(style: TextureStyle, location = 0): void
    {
        const gl = this._gl;

        if (!style)
        {
            this._boundSamplers[location] = null;
            gl.bindSampler(location, null);

            return;
        }

        const sampler = this._getGlSampler(style);

        if (this._boundSamplers[location] !== sampler)
        {
            this._boundSamplers[location] = sampler;
            gl.bindSampler(location, sampler);
        }
    }

    public unbind(texture: BindableTexture): void
    {
        const source = texture.source;
        const boundTextures = this._boundTextures;
        const gl = this._gl;

        for (let i = 0; i < boundTextures.length; i++)
        {
            if (boundTextures[i] === source)
            {
                this._activateLocation(i);

                const glTexture = this.getGlSource(source);

                gl.bindTexture(glTexture.target, null);
                boundTextures[i] = null;
            }
        }
    }

    private _activateLocation(location: number): void
    {
        if (this._activeTextureLocation !== location)
        {
            this._activeTextureLocation = location;
            this._gl.activeTexture(this._gl.TEXTURE0 + location);
        }
    }

    private _initSourceInner(source: TextureSource): GlTexture
    {
        const gl = this._renderer.gl;
        const glTexture = new GlTexture(gl.createTexture());

        glTexture.type = this._mapFormatToType[source.format];
        glTexture.internalFormat = this._mapFormatToInternalFormat[source.format];
        glTexture.format = this._mapFormatToFormat[source.format];
        glTexture.samplerType = mapFormatToSamplerType[source.format] ?? SAMPLER_TYPES.FLOAT;

        switch (source.viewDimension)
        {
            case '2d-array': glTexture.target = GL_TARGETS.TEXTURE_2D_ARRAY; break;
            case '3d': glTexture.target = GL_TARGETS.TEXTURE_3D; break;
        }

        if (source.autoGenerateMipmaps && source.isPowerOfTwo)
        {
            const biggestDimension = Math.max(source.width, source.height);

            source.mipLevelCount = Math.floor(Math.log2(biggestDimension)) + 1;
        }

        this._glTextures[source.uid] = glTexture;

        return glTexture;
    }

    private setLocationAuto(source: TextureSource, bind_gl_tex: GlTexture = null)
    {
        if (source._glLastBindLocation >= 0)
        {
            this._activateLocation(source._glLastBindLocation);
        }
        else
        {
            // TODO: choose something else, rotate locations 8-16?
            source._glLastBindLocation = this._activeTextureLocation;
        }

        if (bind_gl_tex)
        {
            if (this._boundTextures[this._activeTextureLocation] !== source)
            {
                this._renderer.gl.bindTexture(bind_gl_tex.target, bind_gl_tex.texture);
                this._boundTextures[this._activeTextureLocation] = source
            }
        }
    }

    private _initSource(source: TextureSource, uploader: GLTextureUploader): GlTexture
    {
        const gl = this._renderer.gl;
        const glTexture = this._initSourceInner(source);

        if (!this.managedTextures.has(source.uid))
        {
            source.on('update', this.onSourceUpdate, this);
            source.on('resize', this.onSourceResize, this);
            source.on('styleChange', this.onStyleChange, this);
            source.on('destroy', this.onSourceDestroy, this);
            source.on('unload', this.onSourceUnload, this);
            source.on('updateMipmaps', this.onUpdateMipmaps, this);

            this.managedTextures.set(source.uid, source);
        }
        this.setLocationAuto(source);
        gl.bindTexture(glTexture.target, glTexture.texture);
        if (!source.glMutableSize && uploader.storage)
        {
            uploader.storage(source, glTexture, gl);
        }
        this._updateSource(source, uploader);
        this.updateStyle(source, true);

        return glTexture;
    }

    private _updateSource(source: TextureSource, uploader: GLTextureUploader): GlTexture
    {
        const gl = this._renderer.gl;

        const glTexture = this.getGlSource(source);

        this.setLocationAuto(source, glTexture);

        uploader.upload(source, glTexture, gl, this._renderer.context.webGLVersion);

        if (source.autoGenerateMipmaps && source.mipLevelCount > 1)
        {
            this.onUpdateMipmaps(source, false);
        }

        source.markValid();

        return glTexture;
    }

    protected onStyleChange(source: TextureSource): void
    {
        this.updateStyle(source, false);
    }

    protected updateStyle(source: TextureSource, firstCreation: boolean): void
    {
        const gl = this._gl;

        const glTexture = this.getGlSource(source);

        this.setLocationAuto(source, glTexture);

        applyStyleParams(
            source.style,
            gl,
            source.mipLevelCount > 1,
            this._renderer.context.extensions.anisotropicFiltering,
            'texParameteri',
            glTexture.target,
            // will force a clamp to edge if the texture is not a power of two
            !this._renderer.context.supports.nonPowOf2wrapping && !source.isPowerOfTwo,
            firstCreation
        );
    }

    protected onSourceUnload(source: TextureSource): void
    {
        const glTexture = this._glTextures[source.uid];

        if (!glTexture) return;

        delete this._glTextures[source.uid];

        this.unbind(source);

        this._gl.deleteTexture(glTexture.texture);
    }

    protected onSourceUpdate(source: TextureSource): void
    {
        this._updateSource(source, this.getSourceUploader(source));
    }

    protected onSourceResize(source: TextureSource): void
    {
        const old_tex = this._glTextures[source.uid];
        const uploader = this.getSourceUploader(source);

        if (source.glMutableSize || !old_tex || !uploader.storage)
        {
            this.onSourceUpdate(source);

            return;
        }

        this.unbind(source);

        const gl = this._renderer.gl;

        // this will be rewritten with new texture
        this._glTextures[source.uid] = null;

        if (!source.copyOnResize)
        {
            gl.deleteTexture(old_tex.texture);
            this.initSource(source);

            return;
        }

        const glTexture = this._initSourceInner(source);

        this.updateStyle(source, true); // also binds texture

        uploader.storage(source, glTexture, gl);
        uploader.copyTex(source, glTexture, gl, old_tex);
        gl.deleteTexture(old_tex.texture);

        // TODO: whether upload new data after copying old?
        uploader.upload(source, glTexture, gl, 2);
        source.markValid();

        if (source.autoGenerateMipmaps && source.mipLevelCount > 1)
        {
            this.onUpdateMipmaps(source, false);
        }
    }

    protected onUpdateMipmaps(source: TextureSource, bind = true): void
    {
        if (bind) this.bindSource(source, 0);

        const glTexture = this.getGlSource(source);

        this._gl.generateMipmap(glTexture.target);
    }

    protected onSourceDestroy(source: TextureSource): void
    {
        source.off('destroy', this.onSourceDestroy, this);
        source.off('update', this.onSourceUpdate, this);
        source.off('resize', this.onSourceResize, this);
        source.off('unload', this.onSourceUnload, this);
        source.off('styleChange', this.onStyleChange, this);
        source.off('updateMipmaps', this.onUpdateMipmaps, this);

        this.managedTextures.delete(source.uid);

        this.onSourceUnload(source);
    }

    private _initSampler(style: TextureStyle): WebGLSampler
    {
        const gl = this._gl;

        const glSampler = this._gl.createSampler();

        this._glSamplers[style._resourceId] = glSampler;

        applyStyleParams(
            style,
            gl,
            this._boundTextures[this._activeTextureLocation].mipLevelCount > 1,
            this._renderer.context.extensions.anisotropicFiltering,
            'samplerParameteri',
            glSampler,
            false,
            true,
        );

        return this._glSamplers[style._resourceId];
    }

    private _getGlSampler(sampler: TextureStyle): WebGLSampler
    {
        return this._glSamplers[sampler._resourceId] || this._initSampler(sampler);
    }

    public getGlSource(source: TextureSource): GlTexture
    {
        return this._glTextures[source.uid] || this._initSource(source, this.getSourceUploader(source));
    }

    public getSourceUploader(source: TextureSource): GLTextureUploader
    {
        return source.glUploader || this._uploads[source.uploadMethodId];
    }

    public getGlTexForDepth(depthTexture: TextureSource)
    {
        const tex = this._renderer.texture._glTextures[depthTexture.uid];

        if (tex)
        {
            return tex;
        }
        this._renderer.texture.bind(depthTexture, 0);
        this._renderer.texture.bind(null, 0);

        return this._renderer.texture._glTextures[depthTexture.uid];
    }

    public generateCanvas(texture: Texture | TextureSource): ICanvas
    {
        const { pixels, width, height } = this.getPixels(texture);

        const canvas = DOMAdapter.get().createCanvas();

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        if (ctx)
        {
            const imageData = ctx.createImageData(width, height);

            imageData.data.set(pixels);
            ctx.putImageData(imageData, 0, 0);
        }

        return canvas;
    }

    public getPixels(texture: Texture | TextureSource): GetPixelsOutput
    {
        const resolution = texture.source.resolution;

        let width = texture.source.pixelWidth;
        let height = texture.source.pixelHeight;
        let x = 0;
        let y = 0;

        if (texture instanceof Texture)
        {
            const frame = texture.frame;

            x = Math.round(frame.x * resolution);
            y = Math.round(frame.y * resolution);
            width = Math.max(Math.round(frame.width * resolution), 1);
            height = Math.max(Math.round(frame.height * resolution), 1);
        }
        const pixels = new Uint8Array(BYTES_PER_PIXEL * width * height);

        const renderer = this._renderer;

        const renderTarget = renderer.renderTarget.getRenderTarget(texture);
        const glRenterTarget = renderer.renderTarget.getGpuRenderTarget(renderTarget);

        const gl = renderer.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, glRenterTarget.resolveTargetFramebuffer);

        gl.readPixels(
            x,
            y,
            width,
            height,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels
        );

        const len = 4 * width;
        const w1 = new Uint8Array(len);
        const w2 = new Uint8Array(len);

        // flip Y!
        if (renderTarget.isRoot)
        {
            for (let y = 0; y < height >> 1; y++)
            {
                const row1 = pixels.subarray(y * len, (y + 1) * len);
                const row2 = pixels.subarray((height - y - 1) * len, (height - y) * len);

                w1.set(row1);
                w2.set(row2);
                row1.set(w2, 0);
                row2.set(w1, 0);
            }
        }

        // if (texture.source.premultiplyAlpha > 0)
        // TODO - premultiplied alpha does not exist right now, need to add that back in!
        // eslint-disable-next-line no-constant-condition
        if (false)
        {
            unpremultiplyAlpha(pixels);
        }

        return { pixels: new Uint8ClampedArray(pixels.buffer), width, height };
    }

    public destroy(): void
    {
        // we copy the array as the array with a slice as onSourceDestroy
        // will remove the source from the real managedTextures array
        for (const ts of this.managedTextures.values())
        {
            this.onSourceDestroy(ts);
        }

        (this.managedTextures as null) = null;

        (this._renderer as null) = null;
    }

    public resetState(): void
    {
        this._activeTextureLocation = -1;
        this._boundTextures.fill(Texture.EMPTY.source);
        this._boundSamplers = Object.create(null);
    }
}

