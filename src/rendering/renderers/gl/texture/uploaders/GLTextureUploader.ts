import type { TextureSource } from '../../../shared/texture/sources/TextureSource';
import type { GlRenderingContext } from '../../context/GlRenderingContext';
import type { GlTexture } from '../GlTexture';

export interface GLTextureUploader
{
    id: string;
    upload(source: TextureSource, GlTexture: GlTexture, gl: GlRenderingContext, webGLVersion: number): void;
    storage?(source: TextureSource, GlTexture: GlTexture, gl: GlRenderingContext): void;
    copyTex?(source: TextureSource, GlTexture: GlTexture, gl: GlRenderingContext, copyFrom: GlTexture): void;
}
