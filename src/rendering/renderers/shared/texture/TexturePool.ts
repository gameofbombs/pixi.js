import { nextPow2, type Size } from '../../../../maths/index.js';
import { TextureSource } from './sources/TextureSource';
import { Texture } from './Texture';

import type { TextureSourceOptions } from './sources/TextureSource';

let count = 0;

/**
 * Texture pool, used by FilterSystem and plugins.
 *
 * Stores collection of temporary pow2 or screen-sized renderTextures
 * Can use screen-size adjustments in case of big textures
 *
 * If you use custom RenderTexturePool for your filters, you can use methods
 * `getFilterTexture` and `returnFilterTexture` same as in default pool
 * @memberof rendering
 * @name TexturePool
 */
export class TexturePoolClass
{
    /** The default options for texture pool */
    public textureOptions: TextureSourceOptions;

    /**
     * Allow renderTextures of the same size as screen, not just pow2
     *
     * Automatically sets to true after `setScreenSize`
     * @default false
     */
    public enableFullScreen: boolean;

    private _texturePool: {[x in string | number]: Texture[]};
    private _poolKeyHash: Record<number, number> = Object.create(null);

    // Those are screen-related options
    private _screenWidth = 0;
    private _screenHeight = 0;
    _pixelsWidth = 0;
    _pixelsHeight = 0;
    /**
     * all textures bigger than that will have screen-pow2 size
     */
    screenThreshold = 512;
    /**
     * screen-size will be aligned on this value
     * @private
     */
    screenAlign = 1;
    /**
     * padding for screen, one-sided, do * 2 if you need from both
     */
    screenPadding = 0;
    /**
     * scaling factor for screen-based thingy
     */
    screenSizeFactor = 1.4;

    /**
     * @param textureOptions - options that will be passed to BaseRenderTexture constructor
     * @param {SCALE_MODE} [textureOptions.scaleMode] - See {@link SCALE_MODE} for possible values.
     */
    constructor(textureOptions?: TextureSourceOptions)
    {
        this._texturePool = {};
        this.textureOptions = textureOptions || {};
        this.enableFullScreen = false;
    }

    /**
     * Creates texture with params that were specified in pool constructor.
     * @param pixelWidth - Width of texture in pixels.
     * @param pixelHeight - Height of texture in pixels.
     * @param antialias
     * @param hdr
     */
    public createTexture(pixelWidth: number, pixelHeight: number, antialias: boolean, hdr: boolean): Texture
    {
        const options = {
            ...this.textureOptions,

            width: pixelWidth,
            height: pixelHeight,
            resolution: 1,
            antialias,
            autoGarbageCollect: true,
        };

        if (hdr)
        {
            options.format = 'rgba16float';
        }

        const textureSource = new TextureSource(options);

        textureSource.canResizeForResource = false;

        return new Texture({
            source: textureSource,
            label: `texturePool_${count++}`,
        });
    }

    /**
     * Gets a Power-of-Two render texture or fullScreen texture
     * @param frameWidth - The minimum width of the render texture.
     * @param frameHeight - The minimum height of the render texture.
     * @param resolution - The resolution of the render texture.
     * @param antialias
     * @param hdr
     * @param ignoreScreen
     * @returns The new render texture.
     */
    public getOptimalTexture(frameWidth: number, frameHeight: number, resolution = 1,
        antialias: boolean, hdr: boolean, ignoreScreen = false): Texture
    {
        let width = Math.ceil((frameWidth * resolution) - 1e-6);
        let height = Math.ceil((frameHeight * resolution) - 1e-6);

        let screenWidth = this._pixelsWidth;
        let screenHeight = this._pixelsHeight;

        let sign: number;

        if (ignoreScreen || width <= this.screenThreshold || height <= this.screenThreshold
            || width > screenWidth || height > screenHeight)
        {
            width = nextPow2(width);
            height = nextPow2(height);
            sign = 1;
        }
        else
        {
            const factor = this.screenSizeFactor;

            while (width <= Math.ceil(screenWidth / factor))
            {
                screenWidth = Math.ceil(screenWidth / factor);
            }
            while (height <= Math.ceil(screenHeight / factor))
            {
                screenHeight = Math.ceil(screenHeight / factor);
            }
            width = screenWidth;
            height = screenHeight;
            sign = -1;
        }

        const key = sign * ((width << 16) + (height << 2) + (antialias ? 1 : 0) + (hdr ? 2 : 0));

        if (!this._texturePool[key])
        {
            this._texturePool[key] = [];
        }

        let texture = this._texturePool[key].pop();

        if (!texture)
        {
            texture = this.createTexture(width, height, antialias, hdr);
        }

        texture.source._resolution = resolution;
        texture.source.width = width / resolution;
        texture.source.height = height / resolution;
        texture.source.pixelWidth = width;
        texture.source.pixelHeight = height;

        // fit the layout to the requested original size
        texture.frame.x = 0;
        texture.frame.y = 0;
        texture.frame.width = frameWidth;
        texture.frame.height = frameHeight;

        texture.setOrigTrim();
        texture.updateUvs();

        this._poolKeyHash[texture.uid] = key;

        return texture;
    }

    /**
     * Gets extra texture of the same size as input renderTexture
     * @param texture - The texture to check what size it is.
     * @param antialias - Whether to use antialias.
     * @returns A texture that is a power of two
     */
    public getSameSizeTexture(texture: Texture, antialias = false, hdr = false)
    {
        const source = texture.source;

        return this.getOptimalTexture(texture.width, texture.height, source._resolution, antialias, hdr);
    }

    /**
     * Place a render texture back into the pool.
     * @param renderTexture - The renderTexture to free
     */
    public returnTexture(renderTexture: Texture): void
    {
        const key = this._poolKeyHash[renderTexture.uid];
        const arr = this._texturePool[key];

        if (arr)
        {
            arr.push(renderTexture);
        }
        else
        {
            renderTexture.destroy(true);
        }
    }

    /**
     * Clears the pool.
     * @param destroyTextures - Destroy all stored textures.
     */
    public clear(destroyTextures?: boolean): void
    {
        destroyTextures = destroyTextures !== false;
        if (destroyTextures)
        {
            for (const i in this._texturePool)
            {
                const textures = this._texturePool[i];

                if (textures)
                {
                    for (let j = 0; j < textures.length; j++)
                    {
                        textures[j].destroy(true);
                    }
                }
            }
        }

        this._texturePool = {};
    }

    /**
     * If screen size was changed, drops all screen-sized textures,
     * sets new screen size, sets `enableFullScreen` to true
     *
     * Size is measured in pixels, `renderer.view` can be passed here, not `renderer.screen`
     * @param size - Initial size of screen.
     */
    setScreenSize(size: Size): void
    {
        if (size.width === this._screenWidth
            && size.height === this._screenHeight)
        {
            return;
        }

        if (this._pixelsWidth > 0)
        {
            for (const i in this._texturePool)
            {
                if (!(Number(i) < 0))
                {
                    continue;
                }
                const textures = this._texturePool[i];

                if (textures)
                {
                    for (let j = 0; j < textures.length; j++)
                    {
                        textures[j].destroy(true);
                    }
                }

                delete this._texturePool[i];
            }
        }

        this._screenWidth = size.width;
        this._screenHeight = size.height;

        const { screenAlign, screenPadding } = this;

        this._pixelsWidth = Math.ceil((size.width + screenPadding) / screenAlign) * screenAlign;
        this._pixelsHeight = Math.ceil((size.height + screenPadding) / screenAlign) * screenAlign;
    }
}

export const TexturePool = new TexturePoolClass();
