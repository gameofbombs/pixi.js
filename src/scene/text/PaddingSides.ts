/** class used for paddings of text styles and other things */
export class PaddingSides
{
    public top: number = 0;
    public right: number = 0;
    public bottom: number = 0;
    public left: number = 0;

    get horizontal()
    {
        return this.left + this.right;
    }

    get vertical()
    {
        return this.top + this.bottom;
    }

    public copyFrom(sides: IPaddingSidesLike): this
    {
        if (!sides)
        {
            this.top = 0;
            this.right = 0;
            this.bottom = 0;
            this.left = 0;
        }
        else if (typeof sides === 'number')
        {
            this.top = sides;
            this.right = sides;
            this.bottom = sides;
            this.left = sides;
        }
        else if ((sides as any) instanceof Array)
        {
            this.top = (sides as any)[0];
            this.right = (sides as any)[1];
            this.bottom = (sides as any)[2];
            this.left = (sides as any)[3];
        }
        else
        {
            this.top = (sides as any).top || 0;
            this.right = (sides as any).right || 0;
            this.bottom = (sides as any).bottom || 0;
            this.left = (sides as any).left || 0;
        }

        return this;
    }

    public ceil(): this
    {
        this.top = Math.ceil(this.top);
        this.right = Math.ceil(this.right);
        this.bottom = Math.ceil(this.bottom);
        this.left = Math.ceil(this.left);

        return this;
    }

    public static fromDistanceRotation(rotation: number, distance: number, blur: number = 0): IPaddingSidesLike
    {
        if (!distance)
        {
            return blur;
        }

        const res = new PaddingSides();

        const x = Math.cos(rotation) * distance;
        const y = Math.sin(rotation) * distance;

        res.top = -Math.min(0, y - blur);
        res.bottom = Math.max(0, y + blur);
        res.left = -Math.min(0, x - blur);
        res.right = Math.max(0, x + blur);

        return res.ceil();
    }
}

export type IPaddingSidesLike = PaddingSides | [number, number, number, number] | number;
