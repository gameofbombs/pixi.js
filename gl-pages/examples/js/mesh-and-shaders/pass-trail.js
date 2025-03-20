import * as PIXI from 'pixi.js';

const renderer = new PIXI.Renderer({ backgroundColor: 0x1099bb });
document.body.appendChild(renderer.view);

const stage = new PIXI.Container();
const ticker = new PIXI.Ticker();

const pass = new PIXI.LayerPass({
    useRenderTexture: true,
    useDoubleBuffer: true,
    clearColor: true,
});

stage.addChild(new PIXI.Sprite(pass.getRenderTexture()));

const layer = new PIXI.Container();
const trailSprite = new PIXI.Sprite(pass.getRenderTexture());
trailSprite.alpha = 0.6;

layer.addChild(trailSprite);
layer.enableTempParent();

stage._render = () => {
    renderer.pass.begin(pass);
    layer.updateTransform();
    layer.render(renderer);
    renderer.pass.end();
};

const bunnyTex = PIXI.Texture.from('examples/assets/bunny.png');
const bunnies = [];
for (let i = 0; i < 5; i++) {
    bunnies[i] = new PIXI.Container();
    bunnies[i].position.set(renderer.screen.width / 2, renderer.screen.height / 2);
    bunnies[i].rotation = (i / 5) * (Math.PI * 2);
    bunnies[i].pivot.set(0, -200);

    const sprite = new PIXI.Sprite(bunnyTex);
    bunnies[i].addChild(sprite);
    sprite.anchor.set(0.5);
    sprite.scale.set(2 + Math.random());

    layer.addChild(bunnies[i]);
}

// Listen for animate update
ticker.add((delta) => {
    // just for fun, let's rotate mr rabbit a little
    // delta is 1 if running at 100% performance
    // creates frame-independent transformation
    for (let i = 0; i < bunnies.length; i++) {
        bunnies[i].rotation += 0.05 * delta;
        bunnies[i].children[0].rotation += 0.1 * delta;
    }
    renderer.render(stage);
});
ticker.start();
