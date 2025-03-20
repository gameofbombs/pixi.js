import * as PIXI from 'pixi.js';

const vertexSrc = `#version 300 es

in ivec2 aInstPosition;
in vec2 aPosition;
in int aInstNumber;
in vec3 aColor;
in vec2 aUV;

out vec3 vColor;
out vec2 vUV;
flat out int vNumber;

uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;

uniform mat3 uTransformMatrix;

void main() {
    vec3 translated = uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0);
    translated.xy += vec2(aInstPosition);
    gl_Position = vec4((uProjectionMatrix * translated).xy, 0.0, 1.0);

    vNumber = aInstNumber;
    vColor = aColor;
    vUV = aUV;
}`;

const fragmentSrc = `#version 300 es

in vec3 vColor;
in vec2 vUV;
flat in int vNumber;

out vec4 out_color;

uniform sampler2D uTexture;

void main() {
    out_color = texture(uTexture, vUV) * vec4(vColor, 1.0);
    if ((vNumber & 1) == 1)
    {
        out_color.rgb *= 2.0;
    }
}`;

const wgsl = `
struct GlobalUniforms {
    projectionMatrix:mat3x3<f32>,
    worldTransformMatrix:mat3x3<f32>,
    worldColorAlpha: vec4<f32>,
    uResolution: vec2<f32>,
}

struct LocalUniforms {
    uTransformMatrix:mat3x3<f32>,
    uColor:vec4<f32>,
    uRound:f32,
}

@group(0) @binding(0) var<uniform> globalUniforms : GlobalUniforms;
@group(1) @binding(0) var<uniform> localUniforms : LocalUniforms;

@group(2) @binding(1) var uTexture : texture_2d<f32>;
@group(2) @binding(2) var uSampler : sampler;

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) vColor : vec3<f32>,
    @location(1) vUV : vec2<f32>,
    @location(2) @interpolate(flat) vNumber : i32,
}

@vertex
fn mainVert(
    @location(0) aPosition : vec2<f32>,
    @location(1) aColor : vec3<f32>,
    @location(2) aUV : vec2<f32>,
    @location(3) aInstNumber : i32,
    @location(4) aInstPosition : vec2i,
) -> VertexOutput {
    let transformed = globalUniforms.worldTransformMatrix * localUniforms.uTransformMatrix * vec3f(aPosition, 1.0);
    let translated = transformed.xy + vec2f(aInstPosition);

    return VertexOutput(
        vec4f((globalUniforms.projectionMatrix * vec3f(translated, 1.0)).xy, 0.0, 1.0),
        aColor,
        aUV,
        aInstNumber
    );
};

@fragment
fn mainFrag(input: VertexOutput) -> @location(0) vec4<f32>{
    let sample1 = textureSample(uTexture, uSampler, input.vUV);
    return sample1 * vec4f(input.vColor, 1.0) * (1.0 + f32(input.vNumber & 1));
}`;

const usage = PIXI.BufferUsage.VERTEX | PIXI.BufferUsage.COPY_DST

let inst = [];
for (let x = 0; x < 5; x++)
    for (let y = 0; y < 5; y++)
    {
        inst.push((x - 2) * 100, (y - 2) * 100, inst.length / 3);
    }

const instBuf = new PIXI.Buffer({ usage, data: new Int32Array(inst) });

const buf1 = new PIXI.Buffer({ usage, data: new Float32Array([-50, -50, // x, y
    50, -50, // x, y
    50, 50]) });

const geometry = new PIXI.Geometry({
    vertexBuffer: instBuf,
    instanced: true,
    topology: 'triangle-list',
    vertexPerInstance: 3,
    attributes: {
        aInstPosition: 'sint32x2',
        aInstNumber: 'sint32',
        aPosition: {
            buffer: buf1,
            format: 'float32x2'
        },
        aColor: {
            buffer: [1, 0, 0, // r, g, b
                0, 1, 0, // r, g, b
                0, 0, 1], // r, g, b
            format: 'float32x3'
        },
        aUV: {
            buffer: [0, 0, // u, v
                1, 0, // u, v
                1, 1], // u, v
            format: 'float32x2'
        }
    }
})

geometry.instanceCount = 25;

const mdb = new PIXI.MultiDrawBuffer(8);
for (let i = 0; i < 8; i++) {
    mdb.counts[i] = 3;
    mdb.baseInstances[i] = i * 3;
    mdb.instanceCounts[i] = 2;
}
mdb.count = 8;
mdb.convertInstancesToVertices(geometry);

async function test(){
    // Create a new application
    const app = new PIXI.Application();

    // Initialize the application
    await app.init({background: '#1099bb', resizeTo: window, preference: 'webgl',});

    // Append the application canvas to the document body
    document.body.appendChild(app.canvas);

    app.renderer.context.extensions.multiDrawBvbi = null;

    const tex = await PIXI.Assets.load('examples/assets/bg_scene_rotate.jpg');

    const resources = {
        uTexture: tex.source,
        uSampler: tex.source.style,
    };

    const shader = PIXI.Shader.from({
        gl: { vertex: vertexSrc, fragment: fragmentSrc },
        gpu: {
            vertex: {
                entryPoint: 'mainVert',
                source: wgsl,
            },
            fragment: {
                entryPoint: 'mainFrag',
                source: wgsl,
            },
        }, resources});

    const triangle = new PIXI.Mesh({geometry, shader});

    triangle.multiDrawBuffer = mdb;

    triangle.position.set(400, 300);
    triangle.scale.set(1);

    app.stage.addChild(triangle);

    app.ticker.add((delta) => {
        triangle.rotation += 0.01;
    });
}

setTimeout(test, 1000)
