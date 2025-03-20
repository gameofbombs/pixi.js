/**
 * expected argument lengths
 * @type {Object}
 */

const length: {[key:string]: number} = { a: 7, c: 6, h: 1, l: 2, m: 2, q: 4, s: 4, t: 2, v: 1, z: 0 };

/**
 * segment pattern
 * @type {RegExp}
 */

const segment = /([astvzqmhlc])([^astvzqmhlc]*)/ig;

/**
 * parse an svg path data string. Generates an Array
 * of commands where each command is an Array of the
 * form `[command, arg1, arg2, ...]`
 *
 * @param {String} path
 * @return {Array}
 */

export function parse_svg_path(path: string): [string, ...number[]][]
{
    const data: any[] = [];

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    path.replace(segment, function replacer(_, command, args)
    {
        let type = command.toLowerCase();

        args = parseValues(args);

        // overloaded moveTo
        if (type === 'm' && args.length > 2)
        {
            data.push([command].concat(args.splice(0, 2)));
            type = 'l';
            command = command === 'm' ? 'l' : 'L';
        }

        // eslint-disable-next-line no-constant-condition
        while (true)
        {
            if (args.length === length[type])
            {
                args.unshift(command);

                return data.push(args);
            }
            if (args.length < length[type]) throw new Error('malformed path data');
            data.push([command].concat(args.splice(0, length[type])));
        }
    });

    return data;
}

const number = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/ig;

function parseValues(args: any)
{
    const numbers = args.match(number);

    return numbers ? numbers.map(Number) : [];
}
