import { renderSchematic } from '../src/';

const COMPLEX_SCHEM = "H4sIAAAAAAAAAH1UTW/kNgylREnUB6UFth9A/8oeF12ghwRdoMBmm0vgTJyJEWcmmHiR5tof1X+255TTdEwPEEQHW+ITH59JmhnSH6ub/q6bhhVC/tyN/TT1p91fAPAuA/1vQPjhbtj0q113PX1YPXWbi8ftdpQ7CeEnRZ76cdw+HrCG8Iti47C+mS7Wu+7pgDuEHxW/3G0fZ1o6hsZudXuA+Ah6vBmm/gCFI5n3w2Z2Kq9IuRy/zZ72yHMpMh8h43A3+3iEnxW569b9ZuoOYDxyW4YyCO8V2fVXBwCOUnn/bXc/zk54hG133WY9Y1Uc6Uu/exi2m/2nWAgn/WY93UDOEE/7qbvqpg4hnX36/fr6oZ++vqiYz3++BJ/P5/szCM1v/T5R++SVX4VijhH/IUgfx+3qdm+WQp6Aseh8oGBjSCZ7KBDIsE2Bao62hhybb8FHLg19SEBhXoqGN5ehFBMht5yrNwEJiVuriUps+3wX21jCk09OpDDVoDtFlU9ZFraWAxZ0IXAKJqPNqbGJyQdEL9dbdhVTCS6jw1Ydprc1K4vakEtJxVaDFBqnaiJE5woVm32JDoxjimKuHEVa8wZ1p6h6KIvGKFxtJhHZKGGQNmCpmGmEnqU4viYXG8qTm/ymjVuwb3/Ha8sXjKVFFz0gWcxCZJC5VimG8c5mE9kEoAzBQUiIrDtF1UNZFsxSIMLiTQL5FG8KF5FsZQrIvegbNQL2pjEFytYGZxb6ZlRtyrKsEZhcnHXekwFjQvI+Sbwqma0uGhtiZO+tL9Zz4GpAfRVdxJ1Z1OZqMiVCA2kYlkPiIsM1xUIVpOm4ZkYrjQZoLJlmljEUVZuyqK3mZJyNtrXC0iGMopVcJkm5hWpDLbHY5Au54ikl5xd50aUer6HSy6WKIMmjlR+hWS9VyJZqrRIfSCrFKM1JzJlClAGkO0XfZk5Q/5stnzbTMA39Q36ZRv5suNrPNJksL2NqP7Sen5+/y/tc3n/DvxT/SgjMBgAA";
const SIMPLE_SCHEM = 'H4sIAAAAAAAAAF1OXUvDQBCc3GHTnIr/wZ8h2Aex4INFQbF+IGVNN8lieoHcgvrqH/Wn6J4KFedl2JndmQ2oruqON6RSe4RL6lmVF/QKwAeUv4LHwUYi1yM1epR0iGy+89jfqiSjaYXH4VZrR0pp9dQP9fNDisPL23FDfeJHZHiUNzwmGWK+c5icc2y1gwuYLlhpTUoe1XJ+0TSJ9fbT8Ge++zfff4dazBlL2ylcieokN59ajjnTbBdF4Rx2lrLORRX2rqXneVRR4RTyxi4mP3n5Q2v4MJ4Zv+MLMXi6PSsBAAA=';

window.addEventListener('load', () => {
    renderSchematic(
        document.querySelector('#main'),
        COMPLEX_SCHEM,
        {
            size: 500,
            texturePrefix: 'https://worldedit.golf/static'
        }
    );

    renderSchematic(
        document.querySelector('#second'),
        COMPLEX_SCHEM,
        {
            size: 250,
            texturePrefix: 'https://worldedit.golf/static'
        }
    );
});
