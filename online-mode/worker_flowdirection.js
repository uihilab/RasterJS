const SQRT2 = 1414;

const moveX = [0, 0, -1, 1, -1, 1, -1, 1]
const moveY = [-1, 1, 0, 0, -1, 1, 1, -1]

var dem;
var originalDEM;
var m;
var n;
var errors = 0;
var solvedFirstPass = 0;

var flowDir;
var parents;
var possible = new Array(8).fill(0);

function outsideGrid(x, y) {
    return (x < 0 || x >= n || y < 0 || y >= m);
}

//just plain old d8. if there are lowest gradients then it will randomly choose among them.
function d8(x, y) {

    var bestSlope = 0;
    var bestDirection = -1;

    var index = 0;
    for (var i = 0; i < 8; i++) {
        var newX = x + moveY[i];
        var newY = y + moveX[i];

        if (outsideGrid(newX, newY)) continue;

        var deltaH = dem[x * m + y] - dem[newX * m + newY];
        if (deltaH === 0) continue;

        var divide = ((moveX[i] + moveY[i] === 0) || Math.abs(moveX[i] + moveY[i]) === 2);

        var slope = (1000000 * deltaH) / (divide ? SQRT2 : 1000);
        slope = Math.floor(slope);
        if (slope > bestSlope) {
            bestSlope = slope;
            bestDirection = i;
            index = 0;
            possible[index++] = i;
        } else if (slope === bestSlope) {
            possible[index++] = i;
        }
    }
    if (bestDirection === -1) {

        flowDir[x * m + y] = bestDirection;
        return;
    }
 
    var randomIndex = Math.floor(Math.random() * index);
    bestDirection = possible[randomIndex];
    flowDir[x * m + y] = bestDirection;
    solvedFirstPass++;
    var pos = (x + moveY[bestDirection]) * m + y + moveX[bestDirection];
    pos *= 8;
    parents[pos]++;
    var curLen = parents[pos];
    parents[pos + curLen] = x * m + y;

}

this.onmessage = function (e) {

    if(e.data.data !== undefined){
        n = e.data.data.height;
        m = e.data.data.width;
        dem = e.data.data.board;
        originalDEM = e.data.data.originalBoard;
        flowDir = new Int8Array(n * m);
        parents = new Uint32Array(n * m * 8);
        
        for (var i = 0; i < n; i++) {
            for (var j = 0; j < m; j++) {
                d8(i, j);
            }
        }

        this.postMessage({result: {FlowDir: flowDir}});

        console.log("Done: Sending Data");
    }
};