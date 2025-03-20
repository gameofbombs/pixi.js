import { ShaderStage } from '../../../shared/shader/const';

import type { TEXTURE_FORMATS } from '../../../shared/texture/const.js';
import type { ProgramPipelineLayoutDescription } from '../GpuProgram';
import type { StructsAndGroups } from './extractStructAndGroups';

const mapParamToSampleType: Record<string, GPUTextureSampleType> = {
    'f32': 'float',
    'i32': 'sint',
    'u32': 'uint'
};

export function generateGpuLayoutGroups({ groups }: StructsAndGroups): ProgramPipelineLayoutDescription
{
    const layout: ProgramPipelineLayoutDescription = [];

    let compute_flag = ShaderStage.VERTEX | ShaderStage.FRAGMENT;
    let type: string = '';

    function spliceType(delim: string): boolean
    {
        const splice_ind = type.indexOf(delim);

        if (splice_ind >= 0)
        {
            type = type.substring(0, splice_ind) + type.substring(splice_ind + delim.length, type.length);

            return true;
        }

        return false;
    }

    for (let i = 0; i < groups.length; i++)
    {
        const group = groups[i];

        if (group.writable)
        {
            compute_flag = ShaderStage.COMPUTE;
        }
    }

    for (let i = 0; i < groups.length; i++)
    {
        const group = groups[i];

        if (!layout[group.group])
        {
            layout[group.group] = [];
        }

        if (group.isUniform)
        {
            layout[group.group].push({
                binding: group.binding,
                visibility: compute_flag,
                buffer: {
                    type: 'uniform'
                }
            });
            continue;
        }
        if (group.isStorage)
        {
            layout[group.group].push({
                binding: group.binding,
                visibility: compute_flag,
                buffer: {
                    type: group.writable ? 'storage' : 'read-only-storage'
                }
            });
            continue;
        }

        type = group.type;
        if (type === 'sampler')
        {
            layout[group.group].push({
                binding: group.binding,
                visibility: ShaderStage.FRAGMENT,
                sampler: {
                    type: 'filtering'
                }
            });
            continue;
        }
        if (type === 'sampler_comparison')
        {
            layout[group.group].push({
                binding: group.binding,
                visibility: ShaderStage.FRAGMENT,
                sampler: {
                    type: 'comparison'
                }
            });
            continue;
        }

        if (!type.startsWith('texture'))
        {
            continue;
        }

        // eslint-disable-next-line no-nested-ternary,max-len
        const viewDimension: GPUTextureViewDimension = (type.endsWith('_3d') ? '3d' : (type.endsWith('2d_array') ? '2d-array' : '2d'));

        if (spliceType('_storage'))
        {
            layout[group.group].push({
                binding: group.binding,
                visibility: compute_flag,
                storageTexture: {
                    format: group.typeParam as TEXTURE_FORMATS,
                    viewDimension,
                    access: group.writable ? (group.accessMode === 'write' ? 'write-only' : 'read-write') : 'read-only',
                }
            });
            continue;
        }

        let sampleType = mapParamToSampleType[group.typeParam];

        if (spliceType('_depth'))
        {
            sampleType = 'depth';
        }

        if (compute_flag === ShaderStage.COMPUTE && sampleType === 'float')
        {
            sampleType = 'unfilterable-float';
        }

        layout[group.group].push({
            binding: group.binding,
            visibility: compute_flag,
            texture: {
                sampleType,
                viewDimension,
                multisampled: false,
            }
        });
    }

    return layout;
}
