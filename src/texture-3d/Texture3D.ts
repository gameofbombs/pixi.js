import { Texture3DLayout, type TextureLayout3DOptions } from './Texture3DLayout.js';

import type { TypedArray } from '../rendering/index.js';
import type { Buffer3DSource } from './Buffer3DSource.js';

let UID = 0;

export interface Texture3DOptions
{
    source?: Buffer3DSource;
    layout?: Texture3DLayout | TextureLayout3DOptions
    label?: string;
    data?: TypedArray;
}
export class Texture3D
{
    public label?: string;
    public id = UID++;
    dirty = false;

    source: Buffer3DSource;
    layout: Texture3DLayout;
    data: TypedArray;
    isEmpty = false;

    constructor({ source, layout, label = undefined, data = null }: Texture3DOptions)
    {
        this.label = label;
        this.data = null;
        if (!source && !layout)
        {
            throw Error('For Texture3D source or layout is needed');
        }
        this.source = source;
        if (layout)
        {
            if (layout instanceof Texture3DLayout)
            {
                this.layout = layout;
            }
            else
            {
                this.layout = new Texture3DLayout(layout);
            }
        }
        else
        {
            this.layout = new Texture3DLayout({
                size: source,
                offset: { x: 0, y: 0, z: 0 }
            });
        }
        if (data)
        {
            this.update(data);
        }
    }

    update(data: TypedArray)
    {
        const rs = this.source;

        if (!this.dirty && rs.useSubRegions)
        {
            rs.regionsToUpdate.push(this);
            rs.invalidate();
        }
        this.dirty = true;
        if (data)
        {
            this.data = data;
        }
    }
}
