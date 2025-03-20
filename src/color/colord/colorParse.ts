import { parseHex } from './hex';
import { parseHsla } from './hsl';
import { parseHslaString } from './hslString';
import { parseHsva } from './hsv';
import { parseRgba } from './rgb';
import { parseRgbaString } from './rgbString';

import type { ColorInput, ColorInputObject, ColorParser, ColorParseResult, ColorParsers } from './types';

// The built-in input parsing functions.
// We use array instead of object to keep the bundle size lighter.
export const colorParsers: ColorParsers = {
    string: [
        [parseHex, 'hex'],
        [parseRgbaString, 'rgb'],
        [parseHslaString, 'hsl']
    ],
    object: [
        [parseRgba, 'rgb'],
        [parseHsla, 'hsl'],
        [parseHsva, 'hsv'],
    ],
};

const findValidColor = <I extends ColorInput>(
    input: I,
    parsers: ColorParser<I>[]
): ColorParseResult | [null, undefined] =>
{
    for (let index = 0; index < parsers.length; index++)
    {
        const result = parsers[index][0](input);

        if (result) return [result, parsers[index][1]];
    }

    return [null, undefined];
};

/** Tries to convert an incoming value into RGBA color by going through all color model parsers */
export const colorParse = (input: ColorInput): ColorParseResult | [null, undefined] =>
{
    if (typeof input === 'string')
    {
        return findValidColor<string>(input.trim(), colorParsers.string);
    }

    // Don't forget that the type of `null` is "object" in JavaScript
    // https://bitsofco.de/javascript-typeof/
    if (typeof input === 'object' && input !== null)
    {
        return findValidColor<ColorInputObject>(input, colorParsers.object);
    }

    return [null, undefined];
};
