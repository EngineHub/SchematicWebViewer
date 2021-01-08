import { renderSchematic } from '../src/';

const VILLAGE_SCHEM =
    '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';
const COMPLEX_SCHEM =
    'H4sIAAAAAAAAANWaX2/cxhHAl7vk6Y7k3Umy5KTIU/PSh9ZBHNUwGkAFEtRAHprEgIs6rVEYtERJhM93xR2dxl+gX6Nfr+/Jc9T9vzO7w5NkqwmygC3dj8PZ5fxmlwfYJZs8ObloXzV9dyJY+bhZtH3fftl8xxh7r2Q7Fgh29Kpbtifr5qz/9EW3Prl4vmibb9vNs9Nu0zfLk/b46Hf/bNcb+ald9sdnzWLT/kPmmAr2q3Dnqnn5fLE6f9Z8122O36jrY8H2w/Vmedpuur6VF3LBZuHCabfuJeSC7QV4vm6WJnh0jfX9nlzfXcF+jTJuNs9fLFYnL59tlqt/vTnu16913O41ZrhPznAo2P2oAtF9n5D3VehZT7vV2jxrJtguWvG37ULiHcHmAW/61VIFsysnpxddCzYFWrq1ZAWaQZdK0vmVM9CFn1yjoHRhZoJ9kNyJmmpPsA+3SfWpxJWLp7u6FOx9UGyZ9NmieSMDjz9Rl+8MXr6vLu8LdgeYVU2/6FZLeeVA+tr5q5pQf+Scjf7cLs/7C3ZYsvGXbd+cNn1TssnT1Xpx+ui06+XvjxdNf7Zav9qUbFcGy8QXr198+uL1y5ddP2b5V82rls0/1x/vfX121p10zWIcpvng4UdHH31878lXnz1+8sXXf/ntgwcP/3Dv6OOjswfNQ7k/2VxN0y3P3TTUJD7ZDCer2EjOuGnV3hWXl5c/yD//ZaYvJ08fmWvfqAvg899UEPj8d32DLMUXbXd+0asNVf1JlsHXqXx/h00+V34VZuw3/2FgZGqoWkrZGGY6b4LNdFwwYnCphOYkZh5n5OUsp6BbQ0JtdG6GX3AGKcAZoBFmDnJ6zhhn6tfwlAhnEGfht1ATn1tTorApzkxyjO36JU2ScDVEURAFVTilyjCFcUOgcPdrniPuKZrbVZDC0mSWYvNsDms/3AY7bF1yHZy7cmcIe8UqJDcLVMRx+4MDxRajxwEYasA4lCq0j4qOCjsaKS7rDXosuIQaMo+FKHZ2YJmd4USxakyDUU11Eol99wfMA/aXMt0ozBB8C1RM4JzCWRZoKCxUDDQAxaa+OY8V2zMM4wxjRkSHjwEDl2AhQQPCRYEOBu1SlnCM8UgrVvWmFCMcxEtpQTF3o1AYTemcFTmWGWFfbmQecRUenYmmYX1NQH6FeUz1KWhxUJwBnJFYW/MU44zEPHQMkObnRpgDDE62GBcFyhFqgre+dKkqSCiWuIgaIhuNMp06NW+2q1dsd7AcSjHDw21u9HYzDjTGzrSaYlImKlV4WeGXocteu7kQhubd4jEGlUrfOxHOaexbA2EOMJaGsQYQG5d+x4SSu1fdFgwXXowdtlApNi5HqB9G3g4YmnLo0vot7AihaHPboubggsdOmj/tS4Y7woQrxTqDs2Piq5rhYdNUNC5pTLUm9WUBY19EU4QifAgBokhcGlz6Ark9rx+nQootrqo6Ma9wWY1GaEKN63GpNi4Qr2es6spg9DSTsipRarctpzNwr/frFXMwxJUYXYDYNJQP9zRwOXcdcPhWIGCSoMxj3FUW+7ZCGDRbGg29F7F59zy6epm3Y3FQ7N3II7bGik20qI1i8AbX2CoG1ky0UYxMcl5WNjeiAipG1baKvSukGMYKHswjPoDphhCcxirabdcRxq7eeR76wWH3DRjjPMLzAr/+UbT+Cgb7wSbx36f9aVJOVFljXJvC+nCDa6s4wpWJBt/GrbRyYlW6r3BqFDILdxx8F67q8BLAGmjqXWLDBQM7SQsbRziIjBtiAOspx0RDwJVcB4eu8hoRzklsXEbJDQ48JAnfow2XGjzOwvlgpEXhQhjFDnMUbU2CJarcPB5CuaxSKhu2SlzaetO0cOvChi0WIXAMsR7jOJqHb2sRdn3iFXMinhS8DbMb4YzI4k/WbZjvCoDDhd1dyWpVb9TIKloqJrdUndoRlB0ah1rRtBBozP3D41qok7602O06OSrVlz7aS4fRcC7JfW50YQwWiNshrFvxvRSjPOgpMWY0huFzGpPRXOzu0/iO4lWEd4WmsUubvBq0E+P51qeUEdz+iU5faui7w0cnzdJYMXfv08IqVu8Ru5KQZGKzcBgesnB6TvsgOn7P8NI9peDxw/hqUH0ygJO2oopdxF21n2I+iPcHkvgh6JXA7Udj9PTFwdhV6eqhl6uLPDG6ardAq8QIUEePibZKjK7KaZBJ1P1WF5Bmp9FxQTFaMWwIi9TiJ6F9iFaN2wfiNJwoqsOqfTiF1S5JcZpHCN2ZKQ5yDnA4vflM0Dy9IK8coBRq3ESxmgwqriweI8WV3sQg2uqqQhKl0e1fEw5KZFrBNEr6gDY6VBosfuAsUoWlMNkPhaC8m3KrLAcxhq8yjIWIi60uhPMOjDTQjD15hTJ5o3EDxcIajLE2aJQYu3G03dcGm+7Qw0Trv0BVp7Np4cxDemg4nnx2uHc4S5fqolM+ves/jK/xcrrWME2Z0pri7kV2dbSs094ElMslKMn56oqcryr1fLHikl6d23bkmo2SioxGusCaiSctnOKUktLeSTE5/VuMVIOh76q4MIrjBFoxehI1jOLkuY3ipErlhIxON7BNPh7gJH3rQamUdO/wBtFo3JrioZGqvDudzYhyqY6cpeXa1r+p4llVz9LW1ucrlUgqTqPJplR9MqG3I03fetDOZmDtsONBNL2bCno3DUXTO3X7INJLM/ErqLDS0ugbHVHVdFpJ6+kNaj5qI6j5YjqsmMI/wxjQcFuK321x28fAUUQfUbMtR9TVG2Fb9C0fvD/dIFUOvV8G3kb/5/FuZm5t3PLB+9ONgfcIbf6X+5i3MCZsqv+73qNl3/Vdu9H/EMtZ8bQ77S/Ye/H/Gvy3/PnHy8sfv2f/A4KYCFCuLAAA';
const SIMPLE_SCHEM =
    'H4sIAAAAAAAAAF1OXUvDQBCc3GHTnIr/wZ8h2Aex4INFQbF+IGVNN8lieoHcgvrqH/Wn6J4KFedl2JndmQ2oruqON6RSe4RL6lmVF/QKwAeUv4LHwUYi1yM1epR0iGy+89jfqiSjaYXH4VZrR0pp9dQP9fNDisPL23FDfeJHZHiUNzwmGWK+c5icc2y1gwuYLlhpTUoe1XJ+0TSJ9fbT8Ge++zfff4dazBlL2ylcieokN59ajjnTbBdF4Rx2lrLORRX2rqXneVRR4RTyxi4mP3n5Q2v4MJ4Zv+MLMXi6PSsBAAA=';

window.addEventListener('load', () => {
    renderSchematic(document.querySelector('#main'), VILLAGE_SCHEM, {
        size: 500,
        renderArrow: false,
        renderBars: false,
        jarUrl:
            'https://corsanywhere.minidigger.me/https://launcher.mojang.com/v1/objects/1952d94a0784e7abda230aae6a1e8fc0522dba99/client.jar'
    });

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
