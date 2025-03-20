import { Buffer } from "../../../shared/buffer/Buffer";
import { BufferCopyOperation } from "../../../shared/buffer/BufferCopyOperation";
import { BufferUsage } from "../../../shared/buffer/const";
import { Geometry } from "../../../shared/geometry/Geometry";
import { Shader } from '../../../shared/shader/Shader';

import type { AttributeOption } from '../../../shared/geometry/Attribute';
import type { WebGLRenderer } from "../../WebGLRenderer";

const fragment = `#version 300 es
precision highp float;

out vec4 outColor;

void main() {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

function genVertex(elemSize: number, elemCount: number)
{
    let code = `#version 300 es
precision highp float;
precision highp int;
`;

    for (let i = 1; i <= elemCount; i++)
    {
        code += `in vec${elemSize} a_silly${i};\n`;
    }
    for (let i = 1; i <= elemCount; i++)
    {
        code += `out vec${elemSize} v_silly${i};\n`;
    }
    code += `void main() {`;
    for (let i = 1; i <= elemCount; i++)
    {
        code += `v_silly${i} = a_silly${i};\n`;
    }
    code += `
    gl_PointSize = 0.0;
    gl_Position = vec4(-2.0, -2.0, 0.0, 1.0);
}
`;

    return code;
}

function genAttribs(elemSize: number, elemCount: number): Record<string, AttributeOption>
{
    const attr: Record<string, AttributeOption> = {};

    for (let i = 1; i <= elemCount; i++)
    {
        attr[`a_silly${i}`] = `float32x${elemSize}` as any;
    }

    return attr;
}

function genVaryings(elemCount: number): string[]
{
    const res: string[] = [];

    for (let i = 1; i <= elemCount; i++)
    {
        res.push(`v_silly${i}`);
    }

    return res;
}

export class TFBufferCopier
{
    strideFloats: number;
    strideBytes: number;
    elemCount = 0;
    elemSize = 0;
    shader: Shader = null;
    tf: WebGLTransformFeedback = null;

    geom: Geometry;
    tempBuffer: Buffer;

    constructor(strideFloats = 16)
    {
        this.strideFloats = strideFloats;
        this.strideBytes = 4 * strideFloats;
        this.initProgram();
        this.initGeom();
    }

    initProgram()
    {
        const { strideFloats } = this;
        let elemSize = 4;

        while (elemSize > 1 && strideFloats % elemSize > 0)
        {
            elemSize--;
        }

        this.elemSize = elemSize;
        this.elemCount = strideFloats / this.elemSize;

        const vertex = genVertex(this.elemSize, this.elemCount);
        const tfNames = genVaryings(this.elemCount);

        this.shader = Shader.from({
            gl:
                {
                    vertex, fragment,
                    transformFeedbackVaryings: {
                        names: tfNames,
                        bufferMode: 'interleaved'
                    }
                }
        });
    }

    initGeom()
    {
        this.tempBuffer = new Buffer({ data: new Float32Array(), usage: BufferUsage.COPY_DST });
        this.geom = new Geometry({
            vertexBuffer: this.tempBuffer,
            attributes: genAttribs(this.elemSize, this.elemCount)
        });
    }

    doCopy(renderer: WebGLRenderer, src: Buffer, target: Buffer, strideBytes: number,
        copies: Array<BufferCopyOperation>, copyCount = copies.length): boolean
    {
        // TODO: pooled array here!
        if (strideBytes % this.strideBytes !== 0)
        {
            return false;
        }
        // const shader = this.shader;
        const gl = renderer.gl;
        const tf = this.tf = (this.tf || gl.createTransformFeedback());

        const glBuf = renderer.buffer.updateBuffer(target);

        this.geom.swapBuffer(0, src);
        renderer.shader.bind(this.shader);
        renderer.geometry.bind(this.geom, this.shader.glProgram);
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tf);
        for (let i = 0; i < copyCount; i++)
        {
            const op = copies[i];

            gl.bindBufferRange(gl.TRANSFORM_FEEDBACK_BUFFER, 0, glBuf.buffer,
                op.dst * strideBytes, op.count * strideBytes);
            gl.beginTransformFeedback(gl.POINTS);
            gl.drawArrays(gl.POINTS, op.src * strideBytes / this.strideBytes, op.count * strideBytes / this.strideBytes);
            gl.endTransformFeedback();
        }
        gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
        renderer.geometry.unbind();
        this.geom.swapBuffer(0, this.tempBuffer);

        return true;
    }
}
