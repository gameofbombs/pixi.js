var Shader = require('../../../Shader');

/**
 * This shader is used to draw simple primitive shapes for {@link PIXI.Graphics}.
 *
 * @class
 * @memberof PIXI
 * @extends PIXI.Shader
 * @param gl {WebGLRenderingContext} The webgl shader manager this shader works for.
 */
function PrimitiveShader(gl)
{
    Shader.call(this,
        gl,
        // vertex shader
        [
            'attribute vec2 aVertexPosition;',
            'attribute vec4 aColor;',

            'uniform mat4 translationMatrix;',
            'uniform mat4 projectionMatrix;',

            'uniform float alpha;',
            'uniform vec3 tint;',

            'varying vec4 vColor;',

            'void main(void){',
            '   gl_Position = projectionMatrix * translationMatrix * vec4(aVertexPosition, 0.0, 1.0);',
            '   vColor = aColor * vec4(tint * alpha, alpha);',
            '}'
        ].join('\n'),
        // fragment shader
        [
            'varying vec4 vColor;',

            'void main(void){',
            '   gl_FragColor = vColor;',
            '}'
        ].join('\n')
    );
}

PrimitiveShader.prototype = Object.create(Shader.prototype);
PrimitiveShader.prototype.constructor = PrimitiveShader;

module.exports = PrimitiveShader;
