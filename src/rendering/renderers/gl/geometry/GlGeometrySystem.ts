import { ExtensionType } from '../../../../extensions/Extensions';
import { getAttributeInfoFromFormat } from '../../shared/geometry/utils/getAttributeInfoFromFormat';
import { BUFFER_TYPE } from '../buffer/const';
import { ensureAttributes } from '../shader/program/ensureAttributes';
import { type AttributeBaseCallbackStruct, generateAttribSyncForGeom } from "./utils/generateAttributeSync";
import { getGlTypeFromFormat } from './utils/getGlTypeFromFormat';

import type { Buffer } from '../../shared/buffer/Buffer';
import type { Topology } from '../../shared/geometry/const';
import type { Geometry } from '../../shared/geometry/Geometry';
import type { MultiDrawBuffer } from "../../shared/geometry/MultiDrawBuffer";
import type { System } from '../../shared/system/System';
import type { GlBuffer } from '../buffer/GlBuffer';
import type { GlRenderingContext } from '../context/GlRenderingContext';
import type { GlProgram } from '../shader/GlProgram';
import type { WebGLRenderer } from '../WebGLRenderer';

const topologyToGlMap = {
    'point-list': 0x0000,
    'line-list': 0x0001,
    'line-strip': 0x0003,
    'triangle-list': 0x0004,
    'triangle-strip': 0x0005
};

export class GeometryPerGL
{
    /**
     * 0 or 1 whether buffers are ref-counted
     */
    lastGPS: GeometryPerShader = null;
    lastProgram: GlProgram = null;
    lastSignature: string = null;
    hasSecondInstance = false;
    bySignature: {[key: string]: GeometryPerShader} = {};

    constructor(public CONTEXT_UID: number)
    {

    }
}

export class GeometryPerShader
{
    vao: WebGLVertexArrayObject;
    instLocations: number[] = null;
    emulateBaseInstance = 0;

    constructor(vao: WebGLVertexArrayObject)
    {
        this.vao = vao;
    }
}

/**
 * System plugin to the renderer to manage geometry.
 * @memberof rendering
 */
export class GlGeometrySystem implements System
{
    /** @ignore */
    public static extension = {
        type: [
            ExtensionType.WebGLSystem,
        ],
        name: 'geometry',
    } as const;

    /**
     * `true` if we has `*_vertex_array_object` extension.
     * @readonly
     */
    public hasVao: boolean;

    /**
     * `true` if has `ANGLE_instanced_arrays` extension.
     * @readonly
     */
    public hasInstance: boolean;

    protected gl: GlRenderingContext;
    protected _activeGeometry: Geometry;
    protected _activeGPS: GeometryPerShader;
    protected _activeBB: Buffer;

    protected managed_geometries = new Map<number, GeometryPerGL>();

    /** Renderer that owns this {@link GeometrySystem}. */
    private _renderer: WebGLRenderer;

    /** @param renderer - The renderer this System works for. */
    constructor(renderer: WebGLRenderer)
    {
        this._renderer = renderer;
        this._activeGeometry = null;
        this._activeGPS = null;

        this.hasVao = true;
        this.hasInstance = true;

        this._renderer.renderableGC.addManagedHash(this, '_geometryVaoHash');
    }

    /** Sets up the renderer context and necessary buffers. */
    protected contextChange(): void
    {
        const gl = this.gl = this._renderer.gl;

        if (!this._renderer.context.supports.vertexArrayObject)
        {
            throw new Error('[PixiJS] Vertex Array Objects are not supported on this device');
        }

        const nativeVaoExtension = this._renderer.context.extensions.vertexArrayObject;

        if (nativeVaoExtension)
        {
            gl.createVertexArray = (): WebGLVertexArrayObject =>
                nativeVaoExtension.createVertexArrayOES();

            gl.bindVertexArray = (vao): void =>
                nativeVaoExtension.bindVertexArrayOES(vao);

            gl.deleteVertexArray = (vao): void =>
                nativeVaoExtension.deleteVertexArrayOES(vao);
        }

        const nativeInstancedExtension = this._renderer.context.extensions.vertexAttribDivisorANGLE;

        if (nativeInstancedExtension)
        {
            gl.drawArraysInstanced = (a, b, c, d): void =>
            {
                nativeInstancedExtension.drawArraysInstancedANGLE(a, b, c, d);
            };

            gl.drawElementsInstanced = (a, b, c, d, e): void =>
            {
                nativeInstancedExtension.drawElementsInstancedANGLE(a, b, c, d, e);
            };

            gl.vertexAttribDivisor = (a, b): void =>
                nativeInstancedExtension.vertexAttribDivisorANGLE(a, b);
        }

        this._activeGeometry = null;
        this._activeGPS = null;
        this.managed_geometries = new Map();
    }

    /**
     * Binds geometry so that is can be drawn. Creating a Vao if required
     * @param geometry - Instance of geometry to bind.
     * @param program - Instance of program to use vao for.
     */
    public bind(geometry?: Geometry, program?: GlProgram): void
    {
        // shader = shader || this.renderer.shader.shader;

        const gl = this.gl;

        this._activeGeometry = geometry;

        if (!geometry.glData)
        {
            geometry.glData = new GeometryPerGL(0);
            this.managed_geometries.set(geometry.uid, geometry.glData);

            geometry.on('destroy', this.onGeometryDestroy, this);
        }
        else if (geometry.bufRefCount === 0)
        {
            this.regenVao(geometry);
        }

        const glData = geometry.glData;

        const gps = glData.bySignature[program.uid] || this.initGeometryVao(geometry, program, glData);

        if (this._activeGPS !== gps)
        {
            this._activeGPS = gps;

            gl.bindVertexArray(gps.vao);
        }

        this.updateBuffers();
        this._activeBB = null;
    }

    /** Reset and unbind any active VAO and geometry. */
    public resetState(): void
    {
        this.unbind();
    }

    /** Update buffers of the currently bound geometry. */
    public updateBuffers(): void
    {
        const geometry = this._activeGeometry;

        const bufferSystem = this._renderer.buffer;

        for (let i = 0; i < geometry.buffers.length; i++)
        {
            const buffer = geometry.buffers[i];

            bufferSystem.updateBuffer(buffer);
        }
    }

    /**
     * Check compatibility between a geometry and a program
     * @param geometry - Geometry instance.
     * @param program - Program instance.
     */
    protected checkCompatibility(geometry: Geometry, program: GlProgram): void
    {
        // geometry must have at least all the attributes that the shader requires.
        const geometryAttributes = geometry.attributes;
        const shaderAttributes = program._attributeData;

        for (const j in shaderAttributes)
        {
            if (!geometryAttributes[j])
            {
                throw new Error(`shader and geometry incompatible, geometry missing the "${j}" attribute`);
            }
        }
    }

    /**
     * Takes a geometry and program and generates a unique signature for them.
     * @param geometry - To get signature from.
     * @param program - To test geometry against.
     * @returns - Unique signature of the geometry and program
     */
    protected getSignature(geometry: Geometry, program: GlProgram): string
    {
        const attribs = geometry.attributes;
        const shaderAttributes = program._attributeData;

        const strings = ['g', geometry.uid];

        for (const i in attribs)
        {
            if (shaderAttributes[i])
            {
                strings.push(i, shaderAttributes[i].location);
            }
        }

        return strings.join('-');
    }

    /**
     * Creates or gets Vao with the same structure as the geometry and stores it on the geometry.
     * If vao is created, it is bound automatically. We use a shader to infer what and how to set up the
     * attribute locations.
     * @param geometry - Instance of geometry to to generate Vao for.
     * @param program
     * @param _incRefCount - Increment refCount of all geometry buffers.
     */
    protected initGeometryVao(geometry: Geometry, program: GlProgram, glData: GeometryPerGL): GeometryPerShader
    {
        const gl = this._renderer.gl;
        // const CONTEXT_UID = this.CONTEXT_UID;
        const bufferSystem = this._renderer.buffer;

        this._renderer.shader._getProgramData(program);

        this.checkCompatibility(geometry, program);

        const signature = this.getSignature(geometry, program);

        const vaoObjectHash = glData.bySignature;

        let gps = glData.bySignature[signature];

        if (gps)
        {
            // this will give us easy access to the vao
            vaoObjectHash[program.uid] = gps;

            return gps;
        }

        ensureAttributes(geometry, program._attributeData);

        const buffers = geometry.buffers;

        // @TODO: We don't know if VAO is supported.
        gps = new GeometryPerShader(gl.createVertexArray());

        gl.bindVertexArray(gps.vao);

        // first update - and create the buffers!
        // only create a gl buffer if it actually gets
        for (let i = 0; i < buffers.length; i++)
        {
            const buffer = buffers[i];

            bufferSystem.bind(buffer);
        }

        // TODO - maybe make this a data object?
        // lets wait to see if we need to first!

        this.activateVao(geometry, program);
        geometry.addBufferRef();

        if (glData.lastProgram)
        {
            glData.hasSecondInstance = true;
        }
        glData.bySignature[program.uid] = gps;
        glData.bySignature[signature] = gps;
        glData.lastGPS = gps;
        glData.lastProgram = program;
        glData.lastSignature = signature;

        gl.bindVertexArray(null);
        bufferSystem.unbind(BUFFER_TYPE.ARRAY_BUFFER);

        return gps;
    }

    regenVao(geometry: Geometry)
    {
        if (geometry.bufRefCount > 0)
        {
            return;
        }

        const { gl } = this._renderer;
        const glData = geometry.glData;
        const gps = glData.lastGPS;

        gl.bindVertexArray(gps.vao);
        this.activateVao(geometry, glData.lastProgram);
        geometry.addBufferRef();
        if (!glData.hasSecondInstance)
        {
            return;
        }

        const old = glData.bySignature;

        glData.hasSecondInstance = false;
        glData.bySignature = {};
        for (const sig in old)
        {
            if (old[sig] === gps.vao)
            {
                glData.bySignature[sig] = new GeometryPerShader(gps.vao);
                continue;
            }
            if (sig[0] === 'g')
            {
                gl.deleteVertexArray(glData.bySignature[sig]);
            }
        }
    }

    /**
     * Disposes geometry.
     * @param geometry - Geometry with buffers. Only VAO will be disposed
     * @param [contextLost=false] - If context was lost, we suppress deleteVertexArray
     */
    protected onGeometryDestroy(geometry: Geometry, contextLost?: boolean): void
    {
        const vaoObjectHash = this.managed_geometries.get(geometry.uid);

        const gl = this.gl;

        if (vaoObjectHash)
        {
            if (contextLost)
            {
                const sign = vaoObjectHash.bySignature;

                for (const i in sign)
                {
                    if (this._activeGPS !== sign[i])
                    {
                        this.unbind();
                    }

                    gl.deleteVertexArray(sign[i]);
                }
            }
            else
            {
                this.managed_geometries.delete(geometry.uid);
            }
        }

        geometry.glData = null;
    }

    /**
     * Dispose all WebGL resources of all managed geometries.
     * @param [contextLost=false] - If context was lost, we suppress `gl.delete` calls
     */
    public destroyAll(contextLost = false): void
    {
        const gl = this.gl;

        for (const geom of this.managed_geometries.values())
        {
            if (!contextLost)
            {
                const sign = geom.bySignature;

                for (const i in sign)
                {
                    // TODO : check refcounts
                    gl.deleteVertexArray(sign[i].vao);
                }
            }

            geom.bySignature = {};
        }

        this.unbind();
    }

    protected activateVao(geometry: Geometry, program: GlProgram): void
    {
        const gl = this._renderer.gl;
        const bufferSystem = this._renderer.buffer;
        const buffers = geometry.buffers;
        const attributes = geometry.attributes;

        if (geometry.indexBuffer)
        {
            // first update the index buffer if we have one..
            bufferSystem.bind(geometry.indexBuffer);
        }

        let lastBuffer: GlBuffer = null;

        // add a new one!
        for (const j in attributes)
        {
            const attribute = attributes[j];
            const buffer = buffers[attribute.buffer_index];
            const glBuffer = buffer.glData;

            const program_attrib = program._attributeData[j];

            if (program_attrib)
            {
                if (!glBuffer || lastBuffer !== glBuffer)
                {
                    bufferSystem.bind(buffer);

                    lastBuffer = buffer.glData;
                }

                const location = program_attrib.location;
                const attr_info = getAttributeInfoFromFormat(attribute.format);
                const type = getGlTypeFromFormat(attribute.format);

                // TODO introduce state again
                // we can optimise this for older devices that have no VAOs
                gl.enableVertexAttribArray(location);

                if (program_attrib.format.substring(1, 4) === 'int')
                {
                    gl.vertexAttribIPointer(location,
                        attr_info.size,
                        type,
                        attribute.stride,
                        attribute.offset);
                }
                else
                {
                    gl.vertexAttribPointer(location,
                        attr_info.size,
                        type,
                        attr_info.normalised,
                        attribute.stride,
                        attribute.offset);
                }

                if (attribute.instance)
                {
                    // TODO calculate instance count based of this...
                    if (this.hasInstance)
                    {
                        gl.vertexAttribDivisor(location, 1);
                    }
                    else
                    {
                        throw new Error('geometry error, GPU Instancing is not supported on this device');
                    }
                }
            }
        }
    }

    /**
     * Draws the currently bound geometry.
     * @param topology - The type primitive to render.
     * @param size - The number of elements to be rendered. If not specified, all vertices after the
     *  starting vertex will be drawn.
     * @param start - The starting vertex in the geometry to start drawing from. If not specified,
     *  drawing will start from the first vertex.
     * @param instanceCount - The number of instances of the set of elements to execute. If not specified,
     *  all instances will be drawn.
     */
    public draw(topology?: Topology, size?: number, start?: number, instanceCount?: number): this
    {
        const { gl } = this._renderer;
        const geometry = this._activeGeometry;

        if (this._activeGPS.emulateBaseInstance !== 0)
        {
            this.drawBI(topology, size, start, instanceCount, 0);

            return this;
        }

        const glTopology = topologyToGlMap[geometry.topology || topology];

        instanceCount ||= geometry.instanceCount;
        size ||= geometry.getDrawSize();

        if (geometry.indexBuffer)
        {
            const byteSize = geometry.indexBuffer.data.BYTES_PER_ELEMENT;
            const glType = byteSize === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;

            if (instanceCount > 1)
            {
                size = size || geometry.indexPerInstance || geometry.indexBuffer.data.length;
                /* eslint-disable max-len */
                gl.drawElementsInstanced(glTopology, size, glType, (start || 0) * byteSize, instanceCount);
                /* eslint-enable max-len */
            }
            else
            {
                /* eslint-disable max-len */
                gl.drawElements(glTopology, size || geometry.indexBuffer.data.length, glType, (start || 0) * byteSize);
                /* eslint-enable max-len */
            }
        }
        else if (instanceCount > 1)
        {
            // TODO need a better way to calculate size..
            gl.drawArraysInstanced(glTopology, start || 0, size, instanceCount);
        }
        else
        {
            gl.drawArrays(glTopology, start || 0, size);
        }

        return this;
    }

    public drawBI(topology?: Topology, size?: number, start?: number, instanceCount?: number, baseInstance?: number): this
    {
        const geometry = this._activeGeometry;

        const glTopology = topologyToGlMap[geometry.topology || topology];

        const { bvbi } = this._renderer.context.extensions;

        instanceCount ||= geometry.instanceCount;

        if (bvbi)
        {
            bvbi.drawArraysInstancedBaseInstanceWEBGL(glTopology, start || 0, size || geometry.getDrawSize(), instanceCount, baseInstance);

            return this;
        }

        const { gl, buffer } = this._renderer;
        const gps = this._activeGPS;
        const program = this._renderer.shader._activeProgram;
        const attribSync = this.getGlAttributeBaseCallback(geometry);

        if (!gps.instLocations)
        {
            gps.instLocations = program.getLocationListByAttributes(geometry.getInstancedAttributeNames());
        }

        if (attribSync.bufSyncCount === 0)
        {
            const bb = attribSync.bufFirstIndex;

            if (this._activeBB !== geometry.buffers[bb])
            {
                this._activeBB = geometry.buffers[bb];
                buffer.bind(this._activeBB);
            }
            if (gps.emulateBaseInstance !== baseInstance)
            {
                gps.emulateBaseInstance = baseInstance;
                attribSync.syncFunc(gl, gps.instLocations, baseInstance);
            }
            gl.drawArraysInstanced(glTopology, start, size, instanceCount);
        }
        else
        {
            const buffers = geometry.buffers;

            if (gps.emulateBaseInstance !== baseInstance)
            {
                gps.emulateBaseInstance = baseInstance;
                this._activeBB = attribSync.syncFunc(gl, gps.instLocations, baseInstance,
                    buffer, buffers, this._activeBB);
            }
            gl.drawArraysInstanced(glTopology, start, size, instanceCount);
        }

        return this;
    }

    getGlAttributeBaseCallback(geometry: Geometry): AttributeBaseCallbackStruct
    {
        if (!geometry._glAttributeBaseCallback)
        {
            geometry._glAttributeBaseCallback = generateAttribSyncForGeom(geometry);
        }

        return geometry._glAttributeBaseCallback;
    }

    public multiDraw(mdb: MultiDrawBuffer): void
    {
        const renderer = this._renderer;
        const { gl } = renderer;
        const geometry = this._activeGeometry;
        const gps = this._activeGPS;
        const program = renderer.shader._activeProgram;
        const gl_draw_mode = topologyToGlMap[geometry.topology];
        const { offsets, counts, instanceCounts, baseInstances, count } = mdb;

        if (!geometry.instanced)
        {
            const { multiDraw } = renderer.context.extensions;

            if (geometry.indexBuffer)
            {
                const byteSize = geometry.indexBuffer.data.BYTES_PER_ELEMENT;
                const glType = byteSize === 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT;

                if (multiDraw)
                {
                    multiDraw.multiDrawElementsWEBGL(
                        gl_draw_mode,
                        counts, 0,
                        glType,
                        offsets, 0,
                        count,
                    );
                }
                else
                {
                    for (let i = 0; i < count; i++)
                    {
                        gl.drawElements(gl_draw_mode, counts[i], glType, offsets[i]);
                    }
                }
            }
            else if (multiDraw)
            {
                multiDraw.multiDrawArraysWEBGL(
                    gl_draw_mode,
                    offsets, 0,
                    counts, 0,
                    count,
                );
            }
            else
            {
                for (let i = 0; i < count; i++)
                {
                    gl.drawArrays(gl_draw_mode, offsets[i], counts[i]);
                }
            }

            return;
        }

        const { multiDrawBvbi } = renderer.context.extensions;


        if (multiDrawBvbi)
        {
            multiDrawBvbi.multiDrawArraysInstancedBaseInstanceWEBGL(
                gl_draw_mode,
                offsets, 0,
                counts, 0,
                instanceCounts, 0,
                baseInstances, 0,
                count,
            );

            return;
        }
        const attribSync = this.getGlAttributeBaseCallback(geometry);

        if (!gps.instLocations)
        {
            gps.instLocations = program.getLocationListByAttributes(geometry.getInstancedAttributeNames());
        }

        if (attribSync.bufSyncCount === 0)
        {
            renderer.buffer.bind(geometry.buffers[attribSync.bufFirstIndex]);
            for (let i = 0; i < count; i++)
            {
                if (gps.emulateBaseInstance !== baseInstances[i])
                {
                    gps.emulateBaseInstance = baseInstances[i];
                    attribSync.syncFunc(gl, gps.instLocations, baseInstances[i]);
                }
                gl.drawArraysInstanced(gl_draw_mode, 0, counts[i], instanceCounts[i]);
            }
        }
        else
        {
            const buffers = geometry.buffers;
            const bufferSystem = renderer.buffer;

            for (let i = 0; i < count; i++)
            {
                if (gps.emulateBaseInstance !== baseInstances[i])
                {
                    gps.emulateBaseInstance = baseInstances[i];
                    this._activeBB = attribSync.syncFunc(gl, gps.instLocations, baseInstances[i],
                        bufferSystem, buffers, this._activeBB);
                }
                gl.drawArraysInstanced(gl_draw_mode, 0, counts[i], instanceCounts[i]);
            }
        }
    }

    /** Unbind/reset everything. */
    public unbind(): void
    {
        this.gl.bindVertexArray(null);
        this._activeGPS = null;
        this._activeGeometry = null;
    }

    public destroy(): void
    {
        this._renderer = null;
        this.gl = null;
        this._activeGPS = null;
        this._activeGeometry = null;
    }
}
