export function make3DArray<T>(x: number, y: number, z: number): T[][][] {
    const arr = new Array(x);
    for (let i = 0; i < x; i++) {
        arr[i] = new Array(y);
        for (let j = 0; j < y; j++) {
            arr[i][j] = new Array(z);
        }
    }
    return arr;
}
