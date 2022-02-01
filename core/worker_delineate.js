onmessage = function (e) {
  var arr = instant_watershed(
    e.data[0],
    e.data[1],
    e.data[2],
    e.data[3],
    e.data[4],
    e.data[5]
  );
  postMessage(arr);
};

var apprunning = false;
function instant_watershed(x, y, w, h, flowdir, toolType) {
  if (apprunning) return;
  else apprunning = true;

  t1 = Date.now();

  if (toolType == "watershed") return find_watershed(x, y, w, h, flowdir);
  else if (toolType == "raintracker")
    return find_drainagepath(x, y, w, h, flowdir);

  function find_drainagepath(x, y, w, h, flowdir) {
    console.log(x, y, w, h);

    t51 = Date.now();

    w = w | 0;
    h = h | 0;
    x = (x - 1) | 0;
    y = (h - y) | 0;

    var i = 0 | 0;
    var direction = 1 | 0;
    var newpro = new Uint8ClampedArray(7000);

    var dirf = new Int32Array([-1, 1, -1, 1, -1, 1, 0, 0]); // x
    var dirg = new Int32Array([1, -1, -1, 1, 0, 0, -1, 1]); // y

    while (direction > 0 && i < 7000) {
      var direction = flowdir[y * w + x];
      if (direction != 0) {
        newpro[i++] = direction;
      }
      x = (x + dirf[direction]) | 0;
      y = (y + dirg[direction]) | 0;
    }
    newpro[i] = 0;

    tempnewpro = new Uint8ClampedArray(i);

    for (let j = 0; j < i; j++) {
      tempnewpro[j] = newpro[j];
    }

    t52 = Date.now();

    apprunning = false;
    return tempnewpro;
  }

  function find_watershed(x, y, w, h, flowdir) {
    console.log("v5", x, y);

    var matrixbuff = new ArrayBuffer(w * h);
    var matrix = new Uint8Array(matrixbuff);
    matrix[x + w * y] = 1 | 0;

    // new values from flowdir
    var dirf = new Int32Array([-1, 1, -1, 1, -1, 1, 0, 0]); // x
    var dirg = new Int32Array([1, -1, -1, 1, 0, 0, -1, 1]); // y
    var e = new Uint8ClampedArray([7, 6, 5, 4, 3, 2, 1, 0]);

    // new method 2  - 550ms
    var processbuff = new ArrayBuffer(11000 * 4);
    var process = new Uint32Array(processbuff);
    process[0] = x | 0;
    process[1] = y | 0;
    var c = 2 | 0;
    var o1 = 0 | 0;
    var o2 = 5500 | 0;
    while (c > o1) {
      o2 = o1 + (o1 = o2 | 0) - o2;
      var len = c | 0;
      c = o1 | 0;
      for (var k = o2 | 0; k < len; k += 2) {
        var arx = process[k] | 0;
        var ary = process[k + 1] | 0;
        for (var i = 7 | 0; i > -1; i--) {
          var nx = (arx + dirf[i]) | 0;
          var ny = (ary + dirg[i]) | 0;
          var ind = (ny * w + nx) | 0;
          if (flowdir[ind] === e[i]) {
            process[c++] = nx;
            process[c++] = ny;
            matrix[ind] = 1 | 0;
          }
        }
      }
    }

    var len = matrix.length,
      cmat = 0;
    for (var i = 0; i < len; i++) {
      if (matrix[i]) cmat++;
    }

    var dirx = new Array(0, 0, 1, 0, -1);
    var diry = new Array(0, -1, 0, 1, 0);
    var dirxyr = new Array(0, -w, 1, w, -1);
    var found = 1 | 0;
    var curX = x | 0;
    var curY = y | 0;
    var dir = 1 | 0;
    var border = new Array();
    var sdir1 = new Array(1, 2, 3, 4, 1);
    var sdir3 = new Array(3, 4, 1, 2, 3);
    var sdir4 = new Array(2, 3, 4, 1, 2);

    var offsetx = 1;

    // first point on the border
    find_dir();
    border.push(curX + offsetx);
    border.push(curY);

    var icurX = curX;
    var icurY = curY;

    // second point on the border
    find_dir();
    border.push(curX + offsetx);
    border.push(curY);

    while (found > 0) {
      find_dir();
      if (icurX === curX && icurY === curY) {
        found = 0;
      } else {
        border.push(curX + offsetx);
        border.push(curY);
      }
    }

    matrix = null;
    process = null;
    dirxy = null;
    newpro = null;

    t5 = Date.now();

    apprunning = false;
    return [border, cmat];

    function find_dir() {
      var dir1 = sdir1[dir];
      var dir3 = sdir3[dir];
      var dir4 = sdir4[dir];
      var ofs = curX + w * curY;
      if (!matrix[ofs + dirxyr[dir1]]) {
        dir = dir1;
      } else if (!matrix[ofs + dirxyr[dir]]) {
        //dir=dir;
      } else if (!matrix[ofs + dirxyr[dir3]]) {
        dir = dir3;
      } else if (!matrix[ofs + dirxyr[dir4]]) {
        dir = dir4;
      } else {
        dir = 0;
      }
      curX += dirx[dir];
      curY += diry[dir];
    }
  }
}
