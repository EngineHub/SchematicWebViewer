# SchematicWebViewer
An NPM package to facilitate importing and viewing of modern Minecraft schematics.

Originally by [cpdt](https://github.com/cpdt) and was available [here](https://github.com/me4502/WorldEditGolf/tree/master/3d_test).

## Usage

This library requires a **complete** Minecraft resource pack in order to function. This means a resource pack that include **all** models, blockstates, and textures. As most resource packs only include what they have changed, they do not fit this criteria. Luckily, the Minecraft client jar file is formatted in the same way as a resource pack. 

To use this on your site, create a canvas element in your HTML that is able to be queried in the JavaScript.

```html
<canvas id="schematicRenderer", width=500, height=500></canvas>
```

```javascript
renderSchematic(document.querySelector('#schematicRenderer'), SCHEMATIC_FILE, {
    size: 500,
    renderArrow: false,
    renderBars: false,
    jarUrl:
        ['url to resource pack']
});
```

The `renderSchematic` function takes a few options.

The first argument is the canvas element to render to.

The second argument is a schematic file encoded in Base64. The schematic format must be supported by [SchematicJS](https://github.com/EngineHub/SchematicJS).

The final argument is an options object that allows configuring various settings about how the schematic is rendered. The following properties are on the object,

```typescript
interface SchematicRenderOptions {
    size: string; // The size of the canvas viewport
    jarUrl?: string | string[]; // A resource pack URL, or a list of resource pack URLs in priority order
    renderBars?: boolean; // Whether a grid should be rendered
    renderArrow?: boolean; // Whether an arrow to show direction should be rendered
    orbit?: boolean; // Whether the view should automatically rotate when not being dragged by the user
    antialias?: boolean; // Whether antialiasing should be enabled
    alpha?: boolean; // Whether the canvas has alpha enabled / is transparent (default: false)
    backgroundColor?: string | number; // Background color of the canvas (default: 0xffffff)
}
```
