const SHORTINF = 30000;
const SQRT2 = 1414;
const EPS = 2;

const moveX = [0, 0, -1, 1, -1, 1, -1, 1]
const moveY = [-1, 1, 0, 0, -1, 1, 1, -1]

// var sizeof = require('object-sizeof');
var dem;
var originalDEM;
var m;
var n;
var drainageThreshold;
var maxThreshold;
var errors = 0;
var solvedFirstPass = 0;
var errorMaskAvg = 0;

var flowDir;
var flatMask;
var checked;
var parents;
var mask = (1 << 16) - 1;
var possible = new Array(8).fill(0);

class PriorityQueue {
    constructor(comparator = (a, b) => a > b) {
        this._heap = [];
        this._comparator = comparator;
    }
    size() {
        return this._heap.length;
    }
    isEmpty() {
        return this.size() == 0;
    }
    peek() {
        return this._heap[0];
    }
    queue(...values) {
        values.forEach(value => {
            this._heap.push(value);
            this._siftUp();
        });
        return this.size();
    }
    dequeue() {
        const poppedValue = this.peek();
        const bottom = this.size() - 1;
        if (bottom > 0) {
            this._swap(0, bottom);
        }
        this._heap.pop();
        this._siftDown();
        return poppedValue;
    }
    replace(value) {
        const replacedValue = this.peek();
        this._heap[0] = value;
        this._siftDown();
        return replacedValue;
    }
    _greater(i, j) {
        return this._comparator(this._heap[i], this._heap[j]);
    }
    _swap(i, j) {
        [this._heap[i], this._heap[j]] = [this._heap[j], this._heap[i]];
    }
    _siftUp() {
        let node = this.size() - 1;
        while (node > 0 && this._greater(node, this._parent(node))) {
            this._swap(node, this._parent(node));
            node = this._parent(node);
        }
    }
    _siftDown() {
        let node = 0;
        while (
            (this._left(node) < this.size() && this._greater(this._left(node), node)) ||
            (this._right(node) < this.size() && this._greater(this._right(node), node))
        ) {
            let maxChild = (this._right(node) < this.size() && this._greater(this._right(node), this._left(node))) ? this._right(node) : this._left(node);
            this._swap(node, maxChild);
            node = maxChild;
        }
    }
    _parent(i) { return ((i + 1) >>> 1) - 1; }
    _left(i) { return (i << 1) + 1; }
    _right(i) { return (i + 1) << 1; }
}

function initialize2DArray(rows, cols, value) {
    return new Array(rows).fill(value).map(() => new Array(cols).fill(value))
}

function isBorderCell(x, y) {
    return (x === 0 || x === n - 1 || y === 0 || y === m - 1);
}

function outsideGrid(x, y) {
    return (x < 0 || x >= n || y < 0 || y >= m);
}

function flatEdges(lowEdges, highEdges) {
    for (var i = 0; i < n; i++) {
        for (var j = 0; j < m; j++) {
            var possibleLow = false;
            var checked = false;
            for (var k = 0; k < 8; k++) {
                // var newX = i + moveX[k];
                // var newY = j + moveY[k];
                var newX = i + moveY[k];
                var newY = j + moveX[k];

                if (outsideGrid(newX, newY)) { possibleLow = true; continue; }

                var pos_ij = getPos(i, j);
                var pos_newIJ = getPos(newX, newY);

                if (flowDir[pos_ij] != -1 && flowDir[pos_newIJ] === -1 && dem[pos_ij] === dem[pos_newIJ]) {
                    lowEdges[0]++;
                    //lowEdges[lowEdges[0]] = i + (j << 16);
                    lowEdges[lowEdges[0]] = i * m  + j;
                    checked = true;
                    break;
                } else if (dem[pos_ij] < dem[pos_newIJ] && flowDir[pos_ij] === -1) {
                    highEdges[0]++;
                    //highEdges[highEdges[0]] = i + (j << 16);
                    highEdges[highEdges[0]] = i * m  + j;
                    //checked = true;
                    break;
                }
            }
        }
    }
}

function get2d (d1) {
    var d2 = [Math.floor(d1/m), (d1 % m)];
    return d2;
}

//label the individual flats with bfs
function labelFlats(x, y, label, labels, toFill, tmpQueue) {     // np
    toFill[0] = 1;
    //toFill[toFill[0]] = (x + (y << 16));
    toFill[toFill[0]] = (x * m + y);
    var elevation = dem[x * m + y];

    while (toFill[0] > 0) {
        tmpQueue[0] = 0;
        //if (outsideGrid(x, y) || dem[x][y] != elevation || labels[x][y] != 0) continue;
        //labels[x][y] = label;
        for (var k = 0; k < toFill[0]; k++) {
            for (var i = 0; i < 8; i++) {
                var d2 = get2d(toFill[k + 1]);
                //var newX = (toFill[k + 1] & mask) + moveX[i];
                //var newY = (toFill[k + 1] >> 16) + moveY[i];
                var newX = d2[0] + moveY[i];
                var newY = d2[1] + moveX[i];
                var pos_XY = newX * m + newY;
                if (outsideGrid(newX, newY) || labels[pos_XY] != 0 || dem[pos_XY] != elevation) continue;
                labels[pos_XY] = label;
                tmpQueue[0]++;
                //tmpQueue[tmpQueue[0]] = newX + (newY << 16);
                tmpQueue[tmpQueue[0]] = newX * m + newY;
            }
        }
        var tmp = toFill;
        toFill = tmpQueue;
        tmpQueue = tmp;
    }
}

//apply a gradient away from higher areas on flats.
function awayFromHigher(flatHeight, labels, highEdges) {

    for (var i = 0; i < checked.length; i++) {
        checked[i] = 0;
    }

    var loops = 1;
    var tmpQueue = new Uint32Array(m * n + 1);
    //console.log(highEdges.toString());
    while (highEdges[0] > 0) {
        tmpQueue[0] = 0;
        for (var k = 0; k < highEdges[0]; k++) {
            // var x = highEdges[k + 1] & mask;
            // var y = highEdges[k + 1] >> 16;
            var d2 = get2d(highEdges[k + 1]);
            var x = d2[0];
            var y = d2[1];
            var pos_temp = x * m + y;

            if (flatMask[pos_temp] > 0) continue;
            flatMask[pos_temp] = loops;
            flatHeight[labels[pos_temp]] = loops;

            for (var i = 0; i < 8; i++) {
                //var newX = x + moveX[i];
                //var newY = y + moveY[i];
                var newX = x + moveY[i];
                var newY = y + moveX[i];
                var pos_XY = newX * m + newY;

                if (outsideGrid(newX, newY)) continue;
                // console.log(newX, newY, temp[0], temp[1]);
                if (!checked[pos_XY] && labels[pos_XY] === labels[pos_temp] && flowDir[pos_XY] === -1) {
                    tmpQueue[0]++;
                    //tmpQueue[tmpQueue[0]] = newX + (newY << 16);
                    tmpQueue[tmpQueue[0]] = newX * m + newY;
                    checked[pos_XY] = 1;
                }
            }
        }
        loops++;
        var tmp = highEdges;
        highEdges = tmpQueue; 
        tmpQueue = tmp;
        // console.log(highEdges[0], tmpQueue);
    }
    //console.log(flatHeight.toString());

}

//apply a gradient towards lower areas on flats. 2 times more weight than awayFromHigher.
function towardsLower(flatHeight, labels, lowEdges) {

    for (var i = 0; i < n; i++) {
        for (var j = 0; j < m; j++) {
            flatMask[i * m + j] = -flatMask[i * m + j];
            checked[i * m + j] = 0;
        }
    }
    var loops = 1;
    var tmpQueue = new Uint32Array(m * n + 1);
    while (lowEdges[0] > 0) {
        tmpQueue[0] = 0;
        for (var k = 0; k < lowEdges[0]; k++) {
            // var x = lowEdges[k + 1] & mask;
            // var y = lowEdges[k + 1] >> 16;
            var d2 = get2d(lowEdges[k + 1]);
            var x = d2[0];
            var y = d2[1];

            var pos_xy = x * m + y;
            if (flatMask[pos_xy] > 0) continue;
            if (flatMask[pos_xy] < 0) {
                flatMask[pos_xy] = flatHeight[labels[pos_xy]] + flatMask[pos_xy] + 2 * loops;
                //flatMask[pos_xy] = flatHeight[labels[pos_xy]] + flatMask[pos_xy] + loops;
            } else {
                flatMask[pos_xy] = 2 * loops;
                //flatMask[pos_xy] = loops;
            }

            for (var i = 0; i < 8; i++) {
                // var newX = x + moveX[i];
                // var newY = y + moveY[i];
                var newX = x + moveY[i];
                var newY = y + moveX[i];
                if (outsideGrid(newX, newY)) continue;
                var pos_XY = newX * m + newY;
                if (!checked[pos_XY] && labels[pos_XY] === labels[pos_xy] && flowDir[pos_XY] === -1) {
                    tmpQueue[0]++;
                    //tmpQueue[tmpQueue[0]] = newX + (newY << 16);
                    tmpQueue[tmpQueue[0]] = newX * m + newY;
                    checked[newX * m + newY] = 1;
                }
            }
        }
        var tmp = lowEdges;
        lowEdges = tmpQueue;
        tmpQueue = tmp;
        loops++;
    }
}

function resolveFlats() {
    //from https://arxiv.org/pdf/1511.04433.pdf
    var lowEdges = new Uint32Array(m * n + 1);
    var highEdges = new Uint32Array(m * n + 1);

    flatEdges(lowEdges, highEdges);

    if (lowEdges[0] === 0) {
        if (highEdges[0] === 0) {
            console.log("no flats ");
        } else {
            console.log("undrainable flats -- should have been covered by the depression flooding algorithm?");
        }
        return;
    }

    var labels = new Int32Array(n * m);
    var label = 1;
    var queue1 = new Int32Array(n * m + 1);
    var tempQueue = new Int32Array(n * m + 1);
    for (var i = 0; i < lowEdges[0]; i++) {
        // var x = (lowEdges[i+1] & mask);
        // var y = (lowEdges[i+1] >> 16);
        var d2 = get2d(lowEdges[i + 1]);
        var x = d2[0];
        var y = d2[1];
        if (labels[x * m + y] === 0) {
            labelFlats(x, y, label++, labels, queue1, tempQueue);
        }
    }
    // lowEdges.reverse();
    var removed = 0;
    var newhighEdges = new Uint32Array(m * n + 1);
    
    for (var i = 0; i < highEdges[0]; i++) {
        // var x = (highEdges[i + 1] & mask);
        // var y = (highEdges[i + 1] >> 16);  
        var d2 = get2d(highEdges[i + 1]);
        var x = d2[0];
        var y = d2[1];  
        if (labels[x * m + y] === 0) {
            removed = 1;
        } else {
            newhighEdges[0]++;
            //newhighEdges[newhighEdges[0]] = x + (y << 16);
            newhighEdges[newhighEdges[0]] = x * m + y;
        }
    }
    highEdges = newhighEdges;
    
    if (removed) {
        console.log("not all flats have outlets -- should never happen b/c depression filling");
    }
    // console.log("start awayFromHigher");

    var flatHeight = new Int32Array(n * m);
    awayFromHigher(flatHeight, labels, highEdges);
    // console.log("start towardsLower");
    towardsLower(flatHeight, labels, lowEdges);
    // console.log("end towardsLower");
}


//just plain old d8. if there are lowest gradients then it will randomly choose among them.
function d8(x, y) {
    //if (isBorderCell(x, y)) {flowDir[x][y] = -1; return;}

    var bestSlope = 0;
    var bestDirection = -1;

    var index = 0;
    for (var i = 0; i < 8; i++) {
        //var newX = x + moveX[i];
        //var newY = y + moveY[i];
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
        //count1[0]++;
        return;
    }

    var randomIndex = Math.floor(Math.random() * index);
    // bestDirection = possible[(rand() % index)];
    bestDirection = possible[randomIndex];
    flowDir[x * m + y] = bestDirection;
    solvedFirstPass++;
    //var pos = (x + moveX[bestDirection]) * m + y + moveY[bestDirection];
    var pos = (x + moveY[bestDirection]) * m + y + moveX[bestDirection];
    pos *= 8;
    parents[pos]++;
    var curLen = parents[pos];
    //parents[pos + curLen] = (y << 16) + x;
    parents[pos + curLen] = x * m + y;

}

//resolve flats based on the gradient from resolveFlats
function d8ResolveFlats(x, y) {
    //if (isBorderCell(x, y)) {flowDir[x][y] = -1; return;}
    if (flowDir[x * m + y] != -1) return;

    var bestDirection = -1;
    var bestMask = flatMask[x * m + y];
    var bestSlope = 0;

    var index = 0;
    for (var i = 0; i < 8; i++) {
        //var newX = x + moveX[i];
        //var newY = y + moveY[i];
        var newX = x + moveY[i];
        var newY = y + moveX[i];

        if (outsideGrid(newX, newY)) continue;

        var deltaH = bestMask - flatMask[newX * m + newY];
        if (deltaH === 0) continue;

        var divide = ((moveX[i] + moveY[i] === 0) || Math.abs(moveX[i] + moveY[i]) === 2);
        
        var slope = (1000000 * deltaH) / (divide ? SQRT2 : 1000);
        slope = Math.floor(slope);

        if (dem[x * m + y] === dem[newX * m + newY] && slope > bestSlope) {
            //could be a flat
            bestSlope = slope;
            bestDirection = i;
            //bestMask = flatMask[newX * m + newY];
            index = 0;
            possible[index++] = i;
        } else if (dem[x * m + y] === dem[newX * m + newY] && slope === bestSlope) {
            possible[index++] = i;
        }
    }

    if (bestDirection === -1) {
        errorMaskAvg += flatMask[x * m + y];
        errors++;
        count4[0]++;
        //if (x == 0 || x == n - 1 || y == 0 || y == m - 1) errors++;//cout << "ERROR: flat " << x << ' ' << y << " did not have a flow to any adjacent cells" << endl;
        return;
    }

    var randomIndex = Math.floor(Math.random() * index);
    // bestDirection = possible[(rand() % index)];
    bestDirection = possible[randomIndex];
    flowDir[x * m + y] = bestDirection;
    //var pos = (x + moveX[bestDirection]) * m + y + moveY[bestDirection];
    var pos = (x + moveY[bestDirection]) * m + y + moveX[bestDirection];
    pos *= 8;
    parents[pos]++;
    var curLen = parents[pos];
    if ((y << 16) + x >= 2**32 ){
        console.log("something wrong");
    }
    //parents[pos + curLen] = (y << 16) + x;
    parents[pos + curLen] = x * m + y;
}

//Priority-flood algorithm to condition the DEM
// const PriorityQueue = require('js-priority-queue');
function priorityFlood() {

    for (var i = 0; i < checked.length; i++) {
        checked[i] = 0;
    }
    var open = new PriorityQueue((a, b) => a[0] < b[0]);
    var pit = [];  // used as queue

    for (var i = 0; i < n; i++) {
        open.queue([dem[i * m], i, 0]);
        open.queue([dem[i * m + m - 1], i, m - 1]);
        checked[i * m] = 1;
        checked[i * m + m - 1] = 1;
    }

    for (var j = 1; j < m - 1; j++) {
        open.queue([dem[j], 0, j]);
        open.queue([dem[(n - 1) * m + j], n - 1, j]);
        checked[j] = 1;
        checked[(n - 1) * m + j] = 1;
    }

    while (!open.isEmpty() || pit.length > 0) {
        var temp;

        if (pit.length > 0) {
            temp = pit.shift();
        } else {
            var tmp = open.dequeue();
            temp = [tmp[1], tmp[2]];
        }

        for (var i = 0; i < 8; i++) {
            var newX = temp[0] + moveX[i];
            var newY = temp[1] + moveY[i];

            if (outsideGrid(newX, newY) || checked[newX * m + newY]) continue;//if (outsideGrid(newX, newY) || checked[newX][newY]) continue;

            checked[newX * m + newY] = 1;

            if (dem[newX * m + newY] <= dem[temp[0] * m + temp[1]]) {
                dem[newX * m + newY] = dem[temp[0] * m + temp[1]];
                pit.push([newX, newY]);
            } else {
                open.queue([dem[newX * m + newY], newX, newY]);
            }
        }
    }
}

//gets the accumulated area over the current cell and its parents.
function computeArea() {

    for (var i = 0; i < checked.length; i++) {
        checked[i] = 0;
    }

    var area = new Int32Array(n * m);
    function getArea(x, y) {
        var pos = x * m + y;
        if (checked[pos]) return area[pos];
        area[pos]++;

        for (var i = 0; i < parents[pos*8]; i++) {
            var p = parents[pos*8 + i + 1];
            var d2 = get2d(p);
            var newx = d2[0];
            var newy = d2[1];
            // var newx = p & mask;
            // var newy = p >> 16;
            area[pos] += getArea(newx, newy);
        }
        checked[pos] = 1;

        return area[pos];
    }

    for (var i = 0; i < n; i++) {
        for (var j = 0; j < m; j++) {
            getArea(i, j);
        }
    }
    return area;
}

//gets the nearest drainage cell and computes the HAND for each cell which drains into the current one.
function computeNearestDrainageCells(area) {

    var hand = new Int16Array(n * m);

    for (var i = 0; i < checked.length; i++) {
        hand[i] = SHORTINF;
        checked[i] = 0;
    }

    function getNearestDrainageCells(x, y, closestCellX, closestCellY) {
        var pos = x * m + y;
        if (checked[pos]) return;
        checked[pos] = 1;
        if (area[pos] >= drainageThreshold) {
            //console.log('pos: ',pos);                           /////////
            hand[pos] = 0;
            for (var i = 0; i < parents[pos*8]; i++) {
                var p = parents[pos * 8 + i + 1];
                var d2 = get2d(p);
                var newx = d2[0];
                var newy = d2[1];
                // var newx = p & mask;
                // var newy = p >> 16;
                getNearestDrainageCells(newx, newy, x, y);
            }
        } else {
            hand[pos] = originalDEM[pos] - originalDEM[closestCellX * m + closestCellY];
            for (var i = 0; i < parents[pos*8]; i++) {
                var p = parents[pos * 8 + i + 1];
                var d2 = get2d(p);
                var newx = d2[0];
                var newy = d2[1];
                // var newx = p & mask;
                // var newy = p >> 16;
                getNearestDrainageCells(newx, newy, closestCellX, closestCellY);
            }
        }
    }

    for (var i = 0; i < n; i++) {
        for (var j = 0; j < m; j++) {
            if (area[i * m + j] >= drainageThreshold) {
                getNearestDrainageCells(i, j, i, j);
            }
        }
    }
    return hand;
}

function setDrainageThreshold(a) {
    drainageThreshold = a;
    //console.log('threshold: ', drainageThreshold);                     //////////
}

function getPos(x, y) {
    return x * m + y;
}

this.onmessage = function (e) {
    // console.log('in worker', e.data.data);
    if(e.data.data !== undefined){
        n = e.data.data.height;
        m = e.data.data.width;
        dem = e.data.data.board;
        originalDEM = e.data.data.originalBoard;
        flowDir = new Int8Array(n * m);
        flatMask = new Int16Array(n * m);
        checked = new Uint8Array(n * m);
        parents = new Uint32Array(n * m * 8);
        setDrainageThreshold(Number(e.data.data.threshold));

        //console.log("Area height: " + n + " - width: " + m);      
        var startSolveTime = performance.now();
        
        priorityFlood();

        var afterPFlood = performance.now();
        //var totalPFTime = (afterPFlood - startSolveTime) / 1000;
        //console.log("Done: PriorityFlood");
        //console.log("-- Time: " + totalPFTime.toFixed(2) + " s");


        for (var i = 0; i < n; i++) {
            for (var j = 0; j < m; j++) {
                d8(i, j);
            }
        }

        //console.log('dir substitute: ', countrandom);


        var afterd8 = performance.now();
        var totald8Time = (afterd8 - afterPFlood) / 1000;
        console.log("Done: D8 (" + solvedFirstPass + ")");
        console.log("-- Time: " + totald8Time.toFixed(2) + " s");


        for (var i = 0; i < n; i++) {
            for (var j = 0; j < m; j++) {
                if (i === 0) {
                    if (flowDir[i * m + j] === -1) flowDir[i * m + j] = 0;
                }
                else if (i === (n - 1)) {
                    if (flowDir[i * m + j] === -1) flowDir[i * m + j] = 1;
                }
                else if (j === 0) {
                    if (flowDir[i * m + j] === -1) flowDir[i * m + j] = 2;
                }
                else if (j === (m - 1)) {
                    if (flowDir[i * m + j] === -1) flowDir[i * m + j] = 3;
                }
            }
        }

        resolveFlats();


        var afterResolveFlats = performance.now();
        var totalRFTime = (afterResolveFlats - afterd8) / 1000;


        console.log("Done: ResolveFlats");
        console.log("-- Time: " + totalRFTime.toFixed(2) + " s");


        for (var i = 0; i < n; i++) {
            for (var j = 0; j < m; j++) {
                d8ResolveFlats(i, j);
            }
        }
        // console.log('flat substitute: ', countrandomflat);
        // console.log('flat solve: ', countsolve);
        console.log('errors: ', errors);
        // console.log('first solve: ', firstsolve);

        // console.log('count1: ',count1);
        // console.log('count2: ',count2);
        // console.log('count3: ',count3);
        // console.log('count4: ',count4);
        // console.log('count5: ',count5);
        // console.log('count6: ',count6);


        var afterd8ResolveFlats = performance.now();
        var totald8RFTime = (afterd8ResolveFlats - afterResolveFlats) / 1000;
        console.log("Done: d8ResolveFlats");
        console.log("-- Time: " + totald8RFTime.toFixed(2) + " s");
        //console.log("Error count: " + errors + " - Avg mask: " + (errorMaskAvg / errors).toFixed(3));
        
        var area = computeArea();
        var hand = computeNearestDrainageCells(area);

        console.log("Done: Solver");
        var endSolveTime = performance.now();
        var finalTime = (endSolveTime - afterd8ResolveFlats) / 1000;
        console.log("-- Time: " + finalTime.toFixed(2) + " s");
        var totalElapsedTime = (endSolveTime - startSolveTime) / 1000;
        console.log("TOTAL TIME: " + totalElapsedTime.toFixed(2) + " s");
        var startSendingData = performance.now();

        //console.log(flowDir);

        this.postMessage({result: {Hand: hand, Area: area, Parents: parents, FlowDir: flowDir}});

        var finishedSendingData = performance.now();
        var sendingDataTime = (finishedSendingData - startSendingData) / 1000;

        console.log("Done: Sending Data");
        console.log("-- Time: " + sendingDataTime.toFixed(2) + " s");
    }
};