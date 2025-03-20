/**
 * will log a shader error highlighting the lines with the error
 * also will add numbers along the side.
 * @param gl - the WebGLContext
 * @param shader - the shader to log errors for
 */
function logPrettyShaderError(gl: WebGLRenderingContext, shader: WebGLShader, out_report?: string[]): void
{
    const shaderSrc = gl.getShaderSource(shader)
        .split('\n')
        .map((line, index) => `${index}: ${line}`);

    const shaderLog = gl.getShaderInfoLog(shader);
    const splitShader = shaderLog.split('\n');
    const dedupe: Record<number, boolean> = {};

    if (out_report)
    {
        out_report.push(...splitShader);
    }

    const lineNumbers = splitShader.map((line) => parseFloat(line.replace(/^ERROR\: 0\:([\d]+)\:.*$/, '$1')))
        .filter((n) =>
        {
            if (n && !dedupe[n])
            {
                dedupe[n] = true;

                return true;
            }

            return false;
        });

    const logArgs = [''];

    lineNumbers.forEach((number) =>
    {
        shaderSrc[number - 1] = `%c${shaderSrc[number - 1]}%c`;
        logArgs.push('background: #FF0000; color:#FFFFFF; font-size: 10px', 'font-size: 10px');
    });

    const fragmentSourceToLog = shaderSrc
        .join('\n');

    logArgs[0] = fragmentSourceToLog;

    console.error(shaderLog);

    // eslint-disable-next-line no-console
    console.groupCollapsed('click to view full shader code');
    console.warn(...logArgs);
    // eslint-disable-next-line no-console
    console.groupEnd();
}

/**
 *
 * logs out any program errors
 * @param gl - The current WebGL context
 * @param program - the WebGL program to display errors for
 * @param vertexShader  - the fragment WebGL shader program
 * @param fragmentShader - the vertex WebGL shader program
 * @param out_report
 * @private
 */
export function logProgramError(
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
    out_report?: string[]
)
{
    // if linking fails, then log and cleanup
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        {
            out_report?.push('PIXI PROBLEM WITH VERTEX SHADER');
            logPrettyShaderError(gl, vertexShader, out_report);
        }

        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        {
            out_report?.push('PIXI PROBLEM WITH FRAGMENT SHADER');
            logPrettyShaderError(gl, fragmentShader, out_report);
        }

        console.error('PixiJS Error: Could not initialize shader.');

        // if there is a program info log, log it
        if (gl.getProgramInfoLog(program) !== '')
        {
            const s = gl.getProgramInfoLog(program);

            out_report?.push('PIXI PROBLEM WITH LINKAGE');
            out_report?.push(s);
            console.warn('PixiJS Warning: gl.getProgramInfoLog()', s);
        }
    }
}
