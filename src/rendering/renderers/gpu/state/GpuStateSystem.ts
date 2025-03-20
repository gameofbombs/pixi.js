import { ExtensionType } from '../../../../extensions/Extensions';
import { State } from '../../shared/state/State';
import {GpuBlendModesToPixi, GpuCompareToPixi} from './GpuBlendModesToPixi';

import type { BLEND_MODES, CULL_MODES } from '../../shared/state/const';
import type { System } from '../../shared/system/System';
import type { GPU } from '../GpuDeviceSystem';
import type {WebGPURenderer} from "../WebGPURenderer";

/**
 * System plugin to the renderer to manage WebGL state machines.
 * @memberof rendering
 */
export class GpuStateSystem implements System
{
    /** @ignore */
    public static extension = {
        type: [
            ExtensionType.WebGPUSystem,
        ],
        name: 'state',
    } as const;

    /**
     * Blend mode
     * @default 'none'
     * @readonly
     */
    public blendMode: BLEND_MODES;

    /** Whether current blend equation is different */
    protected _blendEq: boolean;

    /**
     * GL context
     * @member {WebGLRenderingContext}
     * @readonly
     */
    protected gpu: GPU;

    /**
     * Default WebGL State
     * @readonly
     */
    protected defaultState: State;

    _swapWinding = false;

    _depthCompare: GPUCompareFunction = 'less-equal';

    _renderer: WebGPURenderer;

    constructor(renderer: WebGPURenderer)
    {
        this._renderer = renderer;
        this.defaultState = new State();
        this.defaultState.blend = true;
    }

    protected contextChange(gpu: GPU): void
    {
        this.gpu = gpu;
    }

    /**
     * Gets the blend mode data for the current state
     * @param state - The state to get the blend mode from
     */
    public getColorTargets(state: State): GPUColorTargetState[]
    {
        const blend = state.blendMode === 'none' ? undefined
            : (GpuBlendModesToPixi[state.blendMode] || GpuBlendModesToPixi.normal);

        return [
            {
                format: 'bgra8unorm',
                writeMask: 0,
                blend,
            },
        ];
    }

    public toggleWinding(): void
    {
        this._swapWinding = !this._swapWinding;
    }

    public setSwapWinding(value: boolean): void
    {
        this._swapWinding = value;
    }

    public getCullMode(state: State): CULL_MODES
    {
        if (!state.culling)
        {
            return 'none';
        }

        return (state.clockwiseFrontFace !== this._swapWinding) ? 'front' : 'back';
    }

    set depthCompare(value: GPUCompareFunction)
    {
        if (this._depthCompare === value)
        {
            return;
        }
        this._depthCompare = value;

        this._renderer.pipeline.setDepthCompareKey(GpuCompareToPixi[value]);
    }

    get depthCompare()
    {
        return this._depthCompare;
    }

    public destroy(): void
    {
        this.gpu = null;
    }
}
