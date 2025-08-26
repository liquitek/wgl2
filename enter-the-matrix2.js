
const sharedMemory = new SharedArrayBuffer(96);
const matrixMemoryView = new Float32Array(sharedMemory);
const cameraQuat = new Float32Array(sharedMemory,0,4);
const viewMatrix = new Float32Array(sharedMemory,16,16);
const cameraPosition = new Float32Array(sharedMemory,80,4);

function setRotatonFromQuat() {
    const [x, y, z, w] = cameraQuat;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    viewMatrix.set([1 - 2 * (yy + zz), 2 * (xy - wz),     2 * (xz + wy),    0,
    2 * (xy + wz),     1 - 2 * (xx + zz), 2 * (yz - wx),     0,
    2 * (xz - wy),     2 * (yz + wx),     1 - 2 * (xx + yy), -0,
    0,     0,     0,     1]);

}



let defaults = {
    cameraQuat:[0,0,0,1],
    viewMatrix:quatToMatrix([0,0,0,1],[0,0,10]),
    cameraPosition:[0,0,10],
}

function quatToMatrix(q,cam) {
    const [x, y, z, w] = q;
    const [camX,camY,camZ] = cam;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    return [
        1 - 2 * (yy + zz), 2 * (xy - wz),     2 * (xz + wy),     0,
        2 * (xy + wz),     1 - 2 * (xx + zz), 2 * (yz - wx),     0,
        2 * (xz - wy),     2 * (yz + wx),     1 - 2 * (xx + yy), 0,
        -camX,                 -camY,                 -camZ,                 1.0
    ];
}

function updateQuaternion(rotationDelta) {
    const halfAngles = rotationDelta.map(angle => angle * 0.5);
    const sinHalf = halfAngles.map(angle => Math.sin(angle));
    const cosHalf = halfAngles.map(angle => Math.cos(angle));

    const deltaQuat = [
        sinHalf[0] * cosHalf[1] * cosHalf[2] - cosHalf[0] * sinHalf[1] * sinHalf[2],
        cosHalf[0] * sinHalf[1] * cosHalf[2] + sinHalf[0] * cosHalf[1] * sinHalf[2],
        cosHalf[0] * cosHalf[1] * sinHalf[2] - sinHalf[0] * sinHalf[1] * cosHalf[2],
        cosHalf[0] * cosHalf[1] * cosHalf[2] + sinHalf[0] * sinHalf[1] * sinHalf[2]
    ];

    qd =[];
    for (var i = 0 ; i < cameraQuat.length;i++)
        qd.push(deltaQuat.map(e=>e*cameraQuat[i]))

    cameraQuat.set(normalizeVector([  
    qd[3][0] + qd[0][3] + qd[1][2] - qd[2][1], 
    qd[3][1] - qd[0][2] + qd[1][3] + qd[2][0],
    qd[3][2] + qd[0][1] - qd[1][0] + qd[2][3], 
    qd[3][3] - qd[0][0] - qd[1][1] - qd[2][2],
            ]));

    setRotatonFromQuat();

    viewMatrix[12] = -(viewMatrix[0] * cameraPosition[0] + viewMatrix[4] * cameraPosition[1] + viewMatrix[8] * cameraPosition[2]);
    viewMatrix[13] = -(viewMatrix[1] * cameraPosition[0] + viewMatrix[5] * cameraPosition[1] + viewMatrix[9] * cameraPosition[2]);
    viewMatrix[14] = -(viewMatrix[2] * cameraPosition[0] + viewMatrix[6] * cameraPosition[1] + viewMatrix[10] * cameraPosition[2]);
}

function normalizeVector(vector) {
    const length = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return vector.map(val => val / length);
}

function rotateCam(opData) {
    updateQuaternion(opData);
}

function moveCam(opData) {
    var [dx,dy,dz] = opData;
    var [moveX,moveY,moveZ] = [
        (dx * viewMatrix[0] + dy * viewMatrix[1] + dz * viewMatrix[2]),
        (dx * viewMatrix[4] + dy * viewMatrix[5] + dz * viewMatrix[6]),
        (dx * viewMatrix[8] + dy * viewMatrix[9] + dz * viewMatrix[10])
    ];

    viewMatrix[12] -= moveX  * viewMatrix[0] + moveY * viewMatrix[4] + moveZ * viewMatrix[8];
    viewMatrix[13] -= moveX  * viewMatrix[1] + moveY * viewMatrix[5] + moveZ * viewMatrix[9];
    viewMatrix[14] -= moveX  * viewMatrix[2] + moveY * viewMatrix[6] + moveZ * viewMatrix[10];

    cameraPosition[0] = -(viewMatrix[0] * viewMatrix[12] + viewMatrix[1] * viewMatrix[13] + viewMatrix[2] * viewMatrix[14]);
    cameraPosition[1] = -(viewMatrix[4] * viewMatrix[12] + viewMatrix[5] * viewMatrix[13] + viewMatrix[6] * viewMatrix[14]);
    cameraPosition[2] = -(viewMatrix[8] * viewMatrix[12] + viewMatrix[9] * viewMatrix[13] + viewMatrix[10] * viewMatrix[14]);
}


async function init(e) {
    if (e.data.init) {
        let init = e.data.init;
        console.log(e.data);
        console.log("Worker: Entering the Matrix...");
        defaults.cameraQuat = init.cameraQuat||defaults.cameraQuat;
        defaults.viewMatrix = init.cameraPosition&&quatToMatrix(defaults.cameraQuat,init.cameraPosition)||init.viewMatrix||defaults.viewMatrix;
        defaults.cameraPosition = init.cameraPosition||defaults.cameraPosition;
        cameraQuat.set(defaults.cameraQuat);
        viewMatrix.set(defaults.viewMatrix);
        cameraPosition.set(defaults.cameraPosition);
        console.log(defaults);
        let matrixMemory = sharedMemory;
        console.log('Worker: Matrix Initialized ;)');
        console.log(`Memory Data: ${matrixMemoryView}`);
        self.onmessage = process;
        postMessage({matrixMemory});
    } 
}
async function process(e) {
   /* console.log(e.data);*/
    if (!e.data) return;
    let opData = [e.data[0],e.data[1],e.data[2]];
    if (e.data[3]) 
        rotateCam(opData);
    else
        moveCam(opData);
    postMessage({ready:true});
}

self.onmessage = (e) => {
    if (e.data.init) init(e)
    else console.log(`Worker: pls sent {init} first`)
};