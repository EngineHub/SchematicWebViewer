import { renderSchematic } from '../src/';

const COMPLEX_SCHEM = "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";
const SIMPLE_SCHEM = 'H4sIAAAAAAAAAF1OXUvDQBCc3GHTnIr/wZ8h2Aex4INFQbF+IGVNN8lieoHcgvrqH/Wn6J4KFedl2JndmQ2oruqON6RSe4RL6lmVF/QKwAeUv4LHwUYi1yM1epR0iGy+89jfqiSjaYXH4VZrR0pp9dQP9fNDisPL23FDfeJHZHiUNzwmGWK+c5icc2y1gwuYLlhpTUoe1XJ+0TSJ9fbT8Ge++zfff4dazBlL2ylcieokN59ajjnTbBdF4Rx2lrLORRX2rqXneVRR4RTyxi4mP3n5Q2v4MJ4Zv+MLMXi6PSsBAAA=';

window.addEventListener('load', () => {
    renderSchematic(
        document.querySelector('#main'),
        COMPLEX_SCHEM,
        {
            size: 500,
            renderArrow: false,
            renderBars: false,
            jarUrl: 'https://corsanywhere.minidigger.me/https://launcher.mojang.com/v1/objects/1952d94a0784e7abda230aae6a1e8fc0522dba99/client.jar'
        }
    );

    renderSchematic(
        document.querySelector('#second'),
        SIMPLE_SCHEM,
        {
            size: 250,
            jarUrl: 'https://corsanywhere.minidigger.me/https://launcher.mojang.com/v1/objects/1952d94a0784e7abda230aae6a1e8fc0522dba99/client.jar',
            renderArrow: false,
            renderBars: false
        }
    );
});
