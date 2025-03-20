import type { BindResource } from './BindResource';
import type { GpuProgram } from './GpuProgram';

class GroupProgPair
{
    dirtyId = -1;
    key = '';
}

const keyParts: string[] = [];

/**
 * A bind group is a collection of resources that are bound together for use by a shader.
 * They are essentially a wrapper for the WebGPU BindGroup class. But with the added bonus
 * that WebGL can also work with them.
 * @see https://gpuweb.github.io/gpuweb/#dictdef-gpubindgroupdescriptor
 * @example
 * // Create a bind group with a single texture and sampler
 * const bindGroup = new BindGroup({
 *    uTexture: texture.source,
 *    uTexture: texture.style,
 * });
 *
 * Bind groups resources must implement the {@link BindResource} interface.
 * The following resources are supported:
 * - {@link TextureSource}
 * - {@link TextureStyle}
 * - {@link Buffer}
 * - {@link BufferResource}
 * - {@link UniformGroup}
 *
 * The keys in the bind group must correspond to the names of the resources in the GPU program.
 *
 * This bind group class will also watch for changes in its resources ensuring that the changes
 * are reflected in the WebGPU BindGroup.
 * @memberof rendering
 */
export class BindGroup
{
    /** The resources that are bound together for use by a shader. */
    public resources: Record<string, BindResource> = Object.create(null);

    private _keys = new Map<number, GroupProgPair>();
    private _updateID = -1;

    _lastLayout = -1;

    /**
     * Create a new instance eof the Bind Group.
     * @param resources - The resources that are bound together for use by a shader.
     */
    constructor(resources?: Record<string, BindResource>)
    {
        let index = 0;

        for (const i in resources)
        {
            const resource: BindResource = resources[i];

            this.setResource(resource, index++);
        }
    }

    public getGpuKey(prog: GpuProgram, group: number)
    {
        let rec = this._keys.get(prog._layoutKey);

        if (!rec)
        {
            rec = new GroupProgPair();
            this._keys.set(prog._layoutKey, rec);
        }

        if (rec.dirtyId === this._updateID)
        {
            return rec.key;
        }

        const layout = prog.gpuLayout[group];
        let hasStorage = false;

        for (let i = 0; i < layout.length; i++)
        {
            const bgle = layout[i];

            keyParts.push(this.resources[bgle.binding]._resourceId.toString());

            if (bgle.storageTexture || (bgle.buffer && bgle.buffer.type !== 'uniform'))
            {
                hasStorage = true;
            }
        }
        if (hasStorage) keyParts.push(`~${prog._layoutKey}`);
        rec.key = keyParts.join('|');
        keyParts.length = 0;
        rec.dirtyId = this._updateID;

        return rec.key;
    }

    /**
     * Set a resource at a given index. this function will
     * ensure that listeners will be removed from the current resource
     * and added to the new resource.
     * @param resource - The resource to set.
     * @param index - The index to set the resource at.
     */
    public setResource(resource: BindResource, index: number): void
    {
        const currentResource = this.resources[index];

        if (resource === currentResource) return;

        if (currentResource)
        {
            currentResource.off?.('change', this.onResourceChange, this);
        }

        resource.on?.('change', this.onResourceChange, this);

        this.resources[index] = resource;
        this._updateID++;
        /**
         * it is not clear, whether we need this thing,
         * maybe it iss better to have "bind_group changed two times inside one render pass"
         */
        this._lastLayout = -1;
    }

    /**
     * Returns the resource at the current specified index.
     * @param index - The index of the resource to get.
     * @returns - The resource at the specified index.
     */
    public getResource(index: number): BindResource
    {
        return this.resources[index];
    }

    /**
     * Used internally to 'touch' each resource, to ensure that the GC
     * knows that all resources in this bind group are still being used.
     * @param tick - The current tick.
     * @internal
     * @ignore
     */
    public _touch(tick: number)
    {
        const resources = this.resources;

        for (const i in resources)
        {
            resources[i]._touched = tick;
        }
    }

    /** Destroys this bind group and removes all listeners. */
    public destroy()
    {
        const resources = this.resources;

        for (const i in resources)
        {
            const resource = resources[i];

            resource.off?.('change', this.onResourceChange, this);
        }

        this.resources = null;
    }

    protected onResourceChange(resource: BindResource)
    {
        this._updateID++;

        // check if a resource has been destroyed, if it has then we need to destroy this bind group
        // using this bind group with a destroyed resource will cause the renderer to explode :)
        if (resource.destroyed)
        {
            // free up the resource
            const resources = this.resources;

            for (const i in resources)
            {
                if (resources[i] === resource)
                {
                    resources[i] = null;
                }
            }
        }
    }
}
