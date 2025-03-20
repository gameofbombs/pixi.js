import { colorParse } from './colorParse';
import { round } from './helpers';
import { rgbaToHex } from './hex';
import { rgbaToHsla, roundHsla } from './hsl';
import { rgbaToHslaString } from './hslString';
import { rgbaToHsva, roundHsva } from './hsv';
import { roundRgba } from './rgb';
import { rgbaToRgbaString } from './rgbString';

import type { ColorConvertOptions } from './names';
import type { AnyColor, ColorInput, HslaColor, HsvaColor, RgbaColor } from './types';

export class Colord
{
    private readonly parsed: RgbaColor | null;
    readonly rgba: RgbaColor;

    constructor(input: AnyColor)
    {
    // Internal color format is RGBA object.
    // We do not round the internal RGBA numbers for better conversion accuracy.
        this.parsed = colorParse(input as ColorInput)[0];
        this.rgba = this.parsed || { r: 0, g: 0, b: 0, a: 1 };
    }

    /**
   * Returns a boolean indicating whether or not an input has been parsed successfully.
   * Note: If parsing is unsuccessful, Colord defaults to black (does not throws an error).
   */
    public isValid(): boolean
    {
        return this.parsed !== null;
    }

    /**
   * Returns the hexadecimal representation of a color.
   * When the alpha channel value of the color is less than 1,
   * it outputs #rrggbbaa format instead of #rrggbb.
   */
    public toHex(): string
    {
        return rgbaToHex(this.rgba);
    }

    /**
   * Converts a color to RGB color space and returns an object.
   * Always includes an alpha value from 0 to 1.
   */
    public toRgb(): RgbaColor
    {
        return roundRgba(this.rgba);
    }

    /**
   * Converts a color to RGB color space and returns a string representation.
   * Outputs an alpha value only if it is less than 1.
   */
    public toRgbString(): string
    {
        return rgbaToRgbaString(this.rgba);
    }

    /**
   * Converts a color to HSL color space and returns an object.
   * Always includes an alpha value from 0 to 1.
   */
    public toHsl(): HslaColor
    {
        return roundHsla(rgbaToHsla(this.rgba));
    }

    /**
   * Converts a color to HSL color space and returns a string representation.
   * Always includes an alpha value from 0 to 1.
   */
    public toHslString(): string
    {
        return rgbaToHslaString(this.rgba);
    }

    /**
   * Converts a color to HSV color space and returns an object.
   * Always includes an alpha value from 0 to 1.
   */
    public toHsv(): HsvaColor
    {
        return roundHsva(rgbaToHsva(this.rgba));
    }

    /**
   * Changes the HSL hue of a color by the given amount.
   */
    public rotate(amount = 15): Colord
    {
        return this.hue(this.hue() + amount);
    }

    /**
   * Allows to get or change a hue value.
   */
    public hue(): number;
    public hue(value: number): Colord;
    public hue(value?: number): Colord | number
    {
        const hsla = rgbaToHsla(this.rgba);

        if (typeof value === 'number') return colord({ h: value, s: hsla.s, l: hsla.l, a: hsla.a });

        return round(hsla.h);
    }

    /**
   * Determines whether two values are the same color.
   */
    public isEqual(color: AnyColor | Colord): boolean
    {
        return this.toHex() === colord(color).toHex();
    }

    public toName(_options: ColorConvertOptions): string | undefined
    {
        return undefined;
    }
}

/**
 * Parses the given input color and creates a new `Colord` instance.
 * See accepted input formats: https://github.com/omgovich/colord#color-parsing
 */
export const colord = (input: AnyColor | Colord): Colord =>
{
    if (input instanceof Colord) return input;

    return new Colord(input);
};
