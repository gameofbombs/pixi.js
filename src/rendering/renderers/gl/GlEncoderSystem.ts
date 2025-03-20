import { ExtensionType } from '../../../extensions/Extensions';
import { Buffer } from '../shared/buffer/Buffer';
import { BUFFER_TYPE_EX } from './buffer/const';
import { TFBufferCopier } from './buffer/utils/TFBufferCopier';

import type { BufferCopyOperation } from '../shared/buffer/BufferCopyOperation';
import type { Topology } from '../shared/geometry/const';
import type { Geometry } from '../shared/geometry/Geometry';
import type { MultiDrawBuffer } from '../shared/geometry/MultiDrawBuffer';
import type { Shader } from '../shared/shader/Shader';
import type { State } from '../shared/state/State';
import type { System } from '../shared/system/System';
import type { WebGLRenderer } from './WebGLRenderer';

/**
 * The system that handles encoding commands for the WebGL.
 * @memberof rendering
 */
export class GlEncoderSystem implements System
{
    /** @ignore */
    public static extension = {
        type: [
            ExtensionType.WebGLSystem,
        ],
        name: 'encoder',
    } as const;

    public readonly commandFinished = Promise.resolve();
    private readonly _renderer: WebGLRenderer;

    constructor(renderer: WebGLRenderer)
    {
        this._renderer = renderer;
    }

    public setGeometry(geometry: Geometry, shader?: Shader)
    {
        this._renderer.geometry.bind(geometry, shader.glProgram);
    }

    public finishRenderPass()
    {
        // noop
    }

    public draw(options: {
        geometry: Geometry,
        shader: Shader,
        state?: State,
        topology?: Topology,
        size?: number,
        start?: number,
        instanceCount?: number,
        baseInstance?: number,
        skipSync?: boolean,
    })
    {
        const renderer = this._renderer;
        const { geometry, shader, state, skipSync, topology: type, size, start, instanceCount, baseInstance } = options;

        renderer.shader.bind(shader, skipSync);

        renderer.geometry.bind(geometry, renderer.shader._activeProgram);

        if (state)
        {
            renderer.state.set(state);
        }

        if (baseInstance)
        {
            renderer.geometry.drawBI(type, size, start, instanceCount ?? geometry.instanceCount, baseInstance);
        }
        else
        {
            renderer.geometry.draw(type, size, start, instanceCount ?? geometry.instanceCount);
        }

        this._renderer.checkError();
    }

    public multiDraw(options: {
        geometry: Geometry;
        multiDrawBuffer?: MultiDrawBuffer;
        shader: Shader;
        state?: State;
        skipSync?: boolean;
    })
    {
        const renderer = this._renderer;
        const { geometry, shader, state, skipSync, multiDrawBuffer } = options;

        renderer.shader.bind(shader, skipSync);

        renderer.geometry.bind(geometry, renderer.shader._activeProgram);

        if (state)
        {
            renderer.state.set(state);
        }

        renderer.geometry.multiDraw(multiDrawBuffer);

        this._renderer.checkError();
    }

    copier: TFBufferCopier = null;

    enableTFCopier(strideFloats: number)
    {
        if (!this.copier)
        {
            this.copier = new TFBufferCopier(strideFloats);
        }
    }

    multiCopyBuffer(src: Buffer, target: Buffer,
        strideBytes: number, copies: Array<BufferCopyOperation>, copyCount = copies.length): void
    {
        if (this.copier?.doCopy(this._renderer, src, target, strideBytes, copies, copyCount))
        {
            return;
        }

        const renderer = this._renderer;
        const gl = renderer.gl;

        renderer.buffer.updateBuffer(src, BUFFER_TYPE_EX.COPY_READ_BUFFER);
        renderer.buffer.updateBuffer(target, BUFFER_TYPE_EX.COPY_WRITE_BUFFER);

        for (let i = 0; i < copyCount; i++)
        {
            const op = copies[i];

            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER,
                op.src * strideBytes, op.dst * strideBytes, op.count * strideBytes);
        }
    }
    public destroy()
    {
        (this._renderer as null) = null;
    }
}
