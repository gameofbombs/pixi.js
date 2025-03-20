import { ExtensionType } from '../../../../extensions/Extensions';
import { warn } from '../../../../utils/logging/warn';
import { STENCIL_MODES } from '../../shared/state/const';
import { createIdFromString } from '../../shared/utils/createIdFromString';
import { HDR_FORMATS } from '../renderTarget/GpuRenderTarget';
import { GpuStencilModesToPixi } from '../state/GpuStencilModesToPixi';

import type { Topology } from '../../shared/geometry/const';
import type { Geometry } from '../../shared/geometry/Geometry';
import type { State } from '../../shared/state/State';
import type { System } from '../../shared/system/System';
import type { GPU } from '../GpuDeviceSystem';
import type { GpuRenderTarget } from '../renderTarget/GpuRenderTarget';
import type { GpuProgram } from '../shader/GpuProgram';
import type { StencilState } from '../state/GpuStencilModesToPixi';
import type { WebGPURenderer } from '../WebGPURenderer';

const topologyStringToId = {
    'point-list': 0,
    'line-list': 1,
    'line-strip': 2,
    'triangle-list': 3,
    'triangle-strip': 4,
};

function getProgKey(
    geometryLayout: number,
    shaderKey: number,
    topology: number,
): number
{
    return (geometryLayout << 13) // Allocate the 8 bits for geometryLayouts at the top
        | (shaderKey << 3) // Next 8 bits for shaderKeys
        | topology; // And 3 bits for topology at the least significant position
}

// geometryLayouts = 128 // 7 bits // 128 states // value 0-127;
// shaderKeys = 256; // 8 bits // 256 states // value 0-255;
// state = 64; // 6 bits // 64 states // value 0-63;
// blendMode = 32; // 5 bits // 32 states // value 0-31;
// topology = 8; // 3 bits // 8 states // value 0-7;
function getGraphicsStateKey(
    customId: number,
    depthCompareKey: number,
    state: number,
    blendMode: number,
): number
{
    return (customId << 15) // Allocate the 8 bits for geometryLayouts at the top
         | (depthCompareKey << 12) // 3 bits for depth compare
         | (state << 5) // 7 bits for state
         | blendMode; // 5 bits for blendMode
}

// colorMask = 16;// 4 bits // 16 states // value 0-15;
// stencilState = 8; // 3 bits // 8 states // value 0-7;
// renderTarget = 1; // 2 bit // 3 states // value 0-3; // none, stencil, depth, depth-stencil
// multiSampleCount = 1; // 1 bit // 2 states // value 0-1;
function getGlobalStateKey(
    stencilStateId: number,
    multiSampleCount: number,
    colorMask: number,
    renderTarget: number,
    hdr: number
): number
{
    if ((renderTarget & 1) === 0)
    {
        stencilStateId = 0;
    }

    return (colorMask << 8) // Allocate the 4 bits for colorMask at the top
         | (stencilStateId << 5) // Next 3 bits for stencilStateId
         | (renderTarget << 3) // 2 bits for renderTarget
         | (hdr << 1) // 2 bits for hdr
         | multiSampleCount; // And 1 bit for multiSampleCount at the least significant position
}

type PipeHash = Record<number, GPURenderPipeline>;

type ComputeHash = Record<number, GPUComputePipeline>;

/**
 * A system that creates and manages the GPU pipelines.
 *
 * Caching Mechanism: At its core, the system employs a two-tiered caching strategy to minimize
 * the redundant creation of GPU pipelines (or "pipes"). This strategy is based on generating unique
 * keys that represent the state of the graphics settings and the specific requirements of the
 * item being rendered. By caching these pipelines, subsequent draw calls with identical configurations
 * can reuse existing pipelines instead of generating new ones.
 *
 * State Management: The system differentiates between "global" state properties (like color masks
 * and stencil masks, which do not change frequently) and properties that may vary between draw calls
 * (such as geometry, shaders, and blend modes). Unique keys are generated for both these categories
 * using getStateKey for global state and getGraphicsStateKey for draw-specific settings. These keys are
 * then then used to caching the pipe. The next time we need a pipe we can check
 * the cache by first looking at the state cache and then the pipe cache.
 * @memberof rendering
 */
export class PipelineSystem implements System
{
    /** @ignore */
    public static extension = {
        type: [ExtensionType.WebGPUSystem],
        name: 'pipeline',
    } as const;
    private readonly _renderer: WebGPURenderer;

    protected CONTEXT_UID: number;

    private _moduleCache: Record<string, GPUShaderModule> = Object.create(null);
    private _bufferLayoutsCache: Record<number, GPUVertexBufferLayout[]> = Object.create(null);
    private readonly _bindingNamesCache: Record<string, number[]> = Object.create(null);

    private _pipeCache: PipeHash = Object.create(null);
    private _computeCache: ComputeHash = Object.create(null);
    private _prevProgKey: number = -1;
    private _prevPipeKey: number = -1;
    private _pipeRT: Record<number, PipeHash> = Object.create(null);
    private readonly _pipeStateCaches: Record<number, Record<number, PipeHash>> = Object.create(null);

    private _gpu: GPU;
    private _stencilState: StencilState;

    private _depthCompareKey: number = 0;
    private _stencilMode: STENCIL_MODES;
    private _colorMask = 0b1111;
    private _multisampleCount = 1;
    private _depthStencilAttachment: number = 0;
    private _hdr: 0 | 1 | 2;

    constructor(renderer: WebGPURenderer)
    {
        this._renderer = renderer;
    }

    protected contextChange(gpu: GPU): void
    {
        this._gpu = gpu;
        this.setStencilMode(STENCIL_MODES.DISABLED);

        this._updatePipeHash();
    }

    public setMultisampleCount(multisampleCount: number): void
    {
        if (this._multisampleCount === multisampleCount) return;

        this._multisampleCount = multisampleCount;

        this._updatePipeHash();
    }

    public setRenderTarget(renderTarget: GpuRenderTarget)
    {
        this._multisampleCount = renderTarget.msaaSamples;

        this._depthStencilAttachment = renderTarget.descriptor.depthStencilAttachment ? (
            1 | (renderTarget.descriptor.depthStencilAttachment.stencilLoadOp ? 2 : 0)
        ) : 0;
        this._hdr = renderTarget.hdr;

        this._updatePipeHash();
    }

    public setColorMask(colorMask: number): void
    {
        if (this._colorMask === colorMask) return;

        this._colorMask = colorMask;

        this._updatePipeHash();
    }

    public setDepthCompareKey(depthCompareKey: number): void
    {
        this._depthCompareKey = depthCompareKey;
    }

    public setStencilMode(stencilMode: STENCIL_MODES): void
    {
        if (this._stencilMode === stencilMode) return;

        this._stencilMode = stencilMode;
        this._stencilState = GpuStencilModesToPixi[stencilMode];

        this._updatePipeHash();
    }

    public setPipeline(geometry: Geometry, program: GpuProgram, state: State, passEncoder: GPURenderPassEncoder): void
    {
        const pipeline = this.getPipeline(geometry, program, state);

        passEncoder.setPipeline(pipeline);
    }

    public getPipeline(
        geometry: Geometry,
        program: GpuProgram,
        state: State,
        topology?: Topology,
    ): GPURenderPipeline
    {
        this.ensureGeometryLayoutKey(geometry);

        topology = topology || geometry.topology;

        const progKey = getProgKey(
            geometry._layoutKey,
            program._layoutKey,
            topologyStringToId[topology]
        );

        if (this._prevProgKey !== progKey)
        {
            this._prevProgKey = progKey;
            this._pipeCache = this._pipeRT[progKey];
            if (!this._pipeCache)
            {
                this._pipeCache = this._pipeRT[progKey] = Object.create(null);
            }
        }

        const depthCompareKey = (this._depthStencilAttachment & 1) ? this._depthCompareKey : 0;

        // now we have set the Ids - the key is different...
        // eslint-disable-next-line max-len
        const key = getGraphicsStateKey(
            state.customId,
            depthCompareKey,
            state.data,
            state._blendModeId,
        );

        if (this._pipeCache[key]) return this._pipeCache[key];

        this._pipeCache[key] = this._createPipeline(geometry, program, state, topology);

        return this._pipeCache[key];
    }

    private _createPipeline(geometry: Geometry, program: GpuProgram, state: State, topology: Topology): GPURenderPipeline
    {
        const device = this._gpu.device;

        const buffers = this._createVertexBufferLayouts(geometry, program);

        const stateSystem = this._renderer.state;
        const blendModes = stateSystem.getColorTargets(state);
        const cullMode = stateSystem.getCullMode(state);

        blendModes[0].writeMask = this._stencilMode === STENCIL_MODES.RENDERING_MASK_ADD ? 0 : this._colorMask;
        blendModes[0].format = HDR_FORMATS[this._hdr];

        const layout = this._renderer.shader.getProgramData(program).pipeline;

        const descriptor: GPURenderPipelineDescriptor = {
            // TODO later check if its helpful to create..
            // layout,
            vertex: {
                module: this._getModule(program.vertex.source),
                entryPoint: program.vertex.entryPoint,
                // geometry..
                buffers,
            },
            fragment: {
                module: this._getModule(program.fragment.source),
                entryPoint: program.fragment.entryPoint,
                targets: blendModes,
            },
            primitive: {
                topology,
                cullMode,
            },
            layout,
            multisample: {
                count: this._multisampleCount,
            },
            // depthStencil,
            label: `PIXI Pipeline`,
        };

        // only apply if the texture has stencil or depth
        if (this._depthStencilAttachment)
        {
            // mask states..
            descriptor.depthStencil = {
                ...this._stencilState,
                format: this._depthStencilAttachment === 1 ? 'depth32float' : 'depth24plus-stencil8',
                depthWriteEnabled: state.depthMask && stateSystem.depthCompare !== 'equal',
                depthCompare: state.depthTest ? stateSystem.depthCompare : 'always',
                depthBias: state._depthBiasValue,
                depthBiasSlopeScale: state._depthBiasSlopeScale,
            };
        }

        const pipeline = device.createRenderPipeline(descriptor);

        return pipeline;
    }

    public getComputePipeline(
        program: GpuProgram,
    ): GPUComputePipeline
    {
        const key = program._layoutKey;

        if (this._computeCache[key]) return this._computeCache[key];

        this._computeCache[key] = this._createComputePipeline(program);

        return this._computeCache[key];
    }

    private _createComputePipeline(program: GpuProgram): GPUComputePipeline
    {
        const device = this._gpu.device;

        const layout = this._renderer.shader.getProgramData(program).pipeline;

        const descriptor: GPUComputePipelineDescriptor = {
            compute: {
                module: this._getModule(program.vertex.source),
                entryPoint: program.vertex.entryPoint,
            },
            layout,
            // depthStencil,
            label: `PIXI Compute Pipeline`,
        };

        const pipeline = device.createComputePipeline(descriptor);

        return pipeline;
    }

    private _getModule(code: string): GPUShaderModule
    {
        return this._moduleCache[code] || this._createModule(code);
    }

    private _createModule(code: string): GPUShaderModule
    {
        const device = this._gpu.device;

        this._moduleCache[code] = device.createShaderModule({
            code,
        });

        return this._moduleCache[code];
    }

    private _generateBufferKey(geometry: Geometry): number
    {
        const keyGen = [];
        let index = 0;
        // generate a key..

        const attributeKeys = Object.keys(geometry.attributes).sort();

        for (let i = 0; i < attributeKeys.length; i++)
        {
            const attribute = geometry.attributes[attributeKeys[i]];

            keyGen[index++] = attribute.offset;
            keyGen[index++] = attribute.format;
            keyGen[index++] = attribute.stride;
            keyGen[index++] = attribute.instance;
            keyGen[index++] = attribute.buffer_index;
        }

        const stringKey = keyGen.join('');

        geometry._layoutKey = createIdFromString(stringKey, 'geometry');

        return geometry._layoutKey;
    }

    private _generateAttributeLocationsKey(program: GpuProgram): number
    {
        const keyGen = [];
        let index = 0;
        // generate a key..

        const attributeKeys = Object.keys(program.attributeData).sort();

        for (let i = 0; i < attributeKeys.length; i++)
        {
            const attribute = program.attributeData[attributeKeys[i]];

            keyGen[index++] = attribute.location;
        }

        const stringKey = keyGen.join('|');

        program._attributeLocationsKey = createIdFromString(stringKey, 'programAttributes');

        return program._attributeLocationsKey;
    }

    public ensureGeometryLayoutKey(geometry: Geometry): number
    {
        if (geometry._layoutKey)
        {
            return geometry._layoutKey;
        }
        if (geometry.proto?._layoutKey)
        {
            geometry._layoutKey = geometry.proto._layoutKey;
        }

        // prepare the geometry for the pipeline
        this._generateBufferKey(geometry);
        if (geometry.proto)
        {
            geometry.proto._layoutKey = geometry._layoutKey;
        }

        return geometry._layoutKey;
    }

    /**
     * Returns a hash of buffer names mapped to bind locations.
     * This is used to bind the correct buffer to the correct location in the shader.
     * @param geometry - The geometry where to get the buffer names
     * @param program - The program where to get the buffer names
     * @returns An object of buffer names mapped to the bind location.
     */
    public getBufferNamesToBind(geometry: Geometry, program: GpuProgram): number[]
    {
        this.ensureGeometryLayoutKey(geometry);

        if (!program._attributeLocationsKey) this._generateAttributeLocationsKey(program);

        const key = (geometry._layoutKey << 16) | program._attributeLocationsKey;

        if (this._bindingNamesCache[key]) return this._bindingNamesCache[key];

        this._createVertexBufferLayouts(geometry, program);

        return this._bindingNamesCache[key];
    }

    private _createVertexBufferLayouts(geometry: Geometry, program: GpuProgram): GPUVertexBufferLayout[]
    {
        if (!program._attributeLocationsKey) this._generateAttributeLocationsKey(program);

        const key = (geometry._layoutKey << 16) | program._attributeLocationsKey;

        if (this._bufferLayoutsCache[key])
        {
            return this._bufferLayoutsCache[key];
        }

        const vertexBuffersLayout: GPUVertexBufferLayout[] = [];
        const buffer_indices = [];

        for (let i = 0; i < geometry.buffers.length; i++)
        {
            const bufferEntry: GPUVertexBufferLayout = {
                arrayStride: 0,
                stepMode: 'vertex',
                attributes: [],
            };

            const bufferEntryAttributes = bufferEntry.attributes as GPUVertexAttribute[];

            for (const j in geometry.attributes)
            {
                const attribute = geometry.attributes[j];

                if (attribute.buffer_index !== i)
                {
                    continue;
                }

                const attrData = program.attributeData[j];

                if (!attrData)
                {
                    continue;
                }

                if ((attribute.divisor ?? 1) !== 1)
                {
                    // TODO: Maybe emulate divisor with storage_buffers/float_textures?
                    // For now just issue a warning
                    warn(`Attribute ${i} has an invalid divisor value of '${attribute.divisor}'. `
                        + 'WebGPU only supports a divisor value of 1');
                }

                bufferEntry.arrayStride = attribute.stride;
                bufferEntry.stepMode = attribute.instance ? 'instance' : 'vertex';

                bufferEntryAttributes.push({
                    shaderLocation: attrData.location,
                    offset: attribute.offset,
                    format: attribute.format,
                });
            }

            if (bufferEntryAttributes.length)
            {
                vertexBuffersLayout.push(bufferEntry);
                buffer_indices.push(i);
            }
        }
        for (const j in program.attributeData)
        {
            if (!geometry.attributes[j])
            {
                // eslint-disable-next-line max-len
                warn(`Attribute ${j} is not present in the shader, but is present in the geometry. Unable to infer attribute details.`);
            }
        }

        this._bufferLayoutsCache[key] = vertexBuffersLayout;

        this._bindingNamesCache[key] = buffer_indices;

        return vertexBuffersLayout;
    }

    private _updatePipeHash(): void
    {
        const key = getGlobalStateKey(
            this._stencilMode,
            this._multisampleCount,
            this._colorMask,
            this._depthStencilAttachment,
            this._hdr
        );

        if (this._prevPipeKey === key)
        {
            return;
        }
        this._prevPipeKey = key;
        this._prevProgKey = -1;

        if (!this._pipeStateCaches[key])
        {
            this._pipeStateCaches[key] = Object.create(null);
        }

        this._pipeRT = this._pipeStateCaches[key];
    }

    public destroy(): void
    {
        (this._renderer as null) = null;
        this._bufferLayoutsCache = null;
    }
}
