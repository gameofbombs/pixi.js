import type { PoolItem } from "../../../../utils";

export class BufferCopyOperation implements PoolItem
{
    src = 0;
    dst = 0;
    count = 0;

    reset()
    {
        this.src = 0;
        this.dst = 0;
        this.count = 0;
    }
}
