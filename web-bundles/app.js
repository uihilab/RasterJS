import Constant from "./constant.js";
import Raster from "./raster.js";

window.onload = init;

var map
var vectorLayer, tileLayer;
var selectionPane,
  currSelectionPaneId = 1,
  currImageLayerId = 1,
  currWaterShedLayerId = 1
var selectionPaneIdPrefix = "selectionPane", 
    imageLayerIdPrefix = "imageLayer", watershedLayerIdPrefix = "watershedLayer"
var PointerInteraction = ol.interaction.Pointer;
var defaultInteractions = ol.interaction.defaults;

var hand = [], area = [], parents = [], dem = [];
var originalDEM = [], flowdir = [], streamorder = [];
var structures = [];

var currImageDataUrl, 
    currSelectionPaneCoord = [] // uy, rx, ly, lx

var square = new ol.style.Style({
  fill: new ol.style.Fill({ color: "rgba(144, 238, 144, 0.3)" }),
  stroke: new ol.style.Stroke({ color: "rgba(0, 0, 0, 0.8)", width: 1 }),
});

var watershedStyle = new ol.style.Style({
  fill: new ol.style.Fill({color: "rgba(0, 0, 255, 0.1)"}),
  stroke: new ol.style.Stroke({ color: "rgba(0, 0, 0, 1)", width: 2 }),
})


var Drag = /*@__PURE__*/ (function (PointerInteraction) {
  function Drag() {
    PointerInteraction.call(this, {
      handleDownEvent: handleDownEvent,
      handleDragEvent: handleDragEvent,
      handleMoveEvent: handleMoveEvent,
      handleUpEvent: handleUpEvent,
    });

    /**
     * @type {import("../src/ol/coordinate.js").Coordinate}
     * @private
     */
    this.coordinate_ = null;

    /**
     * @type {string|undefined}
     * @private
     */
    this.cursor_ = "pointer";

    /**
     * @type {Feature}
     * @private
     */
    this.feature_ = null;

    /**
     * @type {string|undefined}
     * @private
     */
    this.previousCursor_ = undefined;
  }

  if (PointerInteraction) Drag.__proto__ = PointerInteraction;
  Drag.prototype = Object.create(
    PointerInteraction && PointerInteraction.prototype
  );
  Drag.prototype.constructor = Drag;

  return Drag;
})(PointerInteraction);

/**
 * @param {import("../src/ol/MapBrowserEvent.js").default} evt Map browser event.
 * @return {boolean} `true` to start the drag sequence.
 */
function handleDownEvent(evt) {
  var map = evt.map;

  var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
    if (feature.id_ == selectionPaneIdPrefix + currSelectionPaneId) return feature;
  });

  if (feature) {
    this.coordinate_ = evt.coordinate;
    this.feature_ = feature;
  }

  return !!feature;
}

/**
 * @param {import("../src/ol/MapBrowserEvent.js").default} evt Map browser event.
 */
function handleDragEvent(evt) {
  var deltaX = evt.coordinate[0] - this.coordinate_[0];
  var deltaY = evt.coordinate[1] - this.coordinate_[1];

  var geometry = this.feature_.getGeometry();
  geometry.translate(deltaX, deltaY);

  this.coordinate_[0] = evt.coordinate[0];
  this.coordinate_[1] = evt.coordinate[1];
}

/**
 * @param {import("../src/ol/MapBrowserEvent.js").default} evt Event.
 */
function handleMoveEvent(evt) {
  if (this.cursor_) {
    var map = evt.map;
    var feature = map.forEachFeatureAtPixel(evt.pixel, function (feature) {
      if (feature.id_ == selectionPaneIdPrefix + currSelectionPaneId) return feature;
    });
    var element = evt.map.getTargetElement();
    if (feature) {
      if (element.style.cursor != this.cursor_) {
        this.previousCursor_ = element.style.cursor;
        element.style.cursor = this.cursor_;
      }
    } else if (this.previousCursor_ !== undefined) {
      element.style.cursor = this.previousCursor_;
      this.previousCursor_ = undefined;
    }
  }
}

/**
 * @return {boolean} `false` to stop the drag sequence.
 */
function handleUpEvent() {
  this.coordinate_ = null;
  this.feature_ = null;
  return false;
}

function init() {

  var defaultStyle = [
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "rgba(5, 5, 5, 1.0)",
        width: 2,
      }),
      fill: new ol.style.Fill({
        color: "rgba(5, 5, 5, 0.2)",
      }),
    }),
  ];

  var selectedCountyStyle = [
    new ol.style.Style({
      stroke: new ol.style.Stroke({
        color: "rgba(5, 5, 5, 0.2)",
        width: 2,
      }),
      fill: new ol.style.Fill({
        color: "rgba(125, 125, 125, 0.0)",
      }),
    }),
  ];

  function styleFunction(feature, resolution) {
    var county = feature.values_.County;
    if (
      county == "Linn" ||
      county == "Johnson" ||
      county == "Muscatine" ||
      county == "Jones" ||
      county == "Cedar"
    ) {
      return selectedCountyStyle;
    } else {
      return defaultStyle;
    }
  }

  tileLayer = new ol.layer.Tile({
    extent: [
      -92.31333366538001,
      41.29734244973272,
      -90.22730461264564,
      42.33280387551397
    ],
    source: new ol.source.OSM({
      url: "./map/iowa_counties/tiles/{z}/{x}/{y}.png",
      projection: "EPSG:4326",
    }),
  });

  vectorLayer = new ol.layer.Vector({
    // Iowa State
    //Min coordinates are close to Mitchell
    //Max coordinates are close to start of Illinois state
    source: new ol.source.Vector({
      // attributions: '&copy; OpenStreetMap contributors, Who’s On First, ' +
      // 'Natural Earth, and openstreetmapdata.com',
      //url:"../map/iowa/tiles/{z}/{x}/{y}.png",
      format: new ol.format.GeoJSON(),
      url: "./iowacounty.json",
      projection: "EPSG:4326",
    }),
    style: styleFunction,
  });

  map = new ol.Map({
    interactions: defaultInteractions().extend([new Drag()]),
    target: "map",
    layers: [tileLayer, vectorLayer],
    view: new ol.View({
      //mercator
      //long, lat
      extent: [
        -92.31333366538001,
        41.29734244973272,
        -90.22730461264564,
        42.33280387551397
      ],
      center: [-91.3, 41.8],
      projection: "EPSG:4326", //long,lat (EPSG:4326) , mercator (EPSG:3857)
      zoom: 10,
      minZoom: 10,
      maxZoom: 12,
    }),
  });

  map.on("click", function (e) {
    // console.log(map.getView().calculateExtent())
    //console.log(e);
    var lat = e.coordinate[1];
		var lng = e.coordinate[0];
    // delinate watershed
		delinate_watershed(lat, lng);
  });
}

window.update_area = function update_area() {
  var res = document.getElementById("resolution").value;
  var opt = document.getElementById("area").options;
  for (var i = 1; i < opt.length; i++) {
    if (res * i > 100) {
      opt[i].setAttribute("hidden", "hidden");
    } else {
      opt[i].hidden = false;
      opt[i].text = " - " + res * i + " km x " + res * i + " km";
      opt[i].value = res * i;
    }
  }
};

window.show_area = function show_area() {
  var res = document.getElementById("resolution").value;
  var area = document.getElementById("area").value;
  if (res + area == "00") {
    console.log("please choose elevation and area values");
    return;
  }

  var areaInM = area * 1000;

  var mapCenter = map.getView().getCenter();
  //  mapCenterMercator = ol.proj.transform(mapCenter, 'EPSG:4326', 'EPSG:3857')

  var p1 = computeOffset(mapCenter, areaInM / 2, 0);
  var p2 = computeOffset(mapCenter, areaInM / 2, 90);
  var p3 = computeOffset(mapCenter, areaInM / 2, 180);
  var p4 = computeOffset(mapCenter, areaInM / 2, 270);

  // removing existing layer
  map.getLayers().forEach(layer => {

    if (layer && layer.get('name') === selectionPaneIdPrefix + currSelectionPaneId) {
      map.removeLayer(layer);
    }

  });

  // 0th index is for longitude and 1st index is for latitude
  var points = [
    [
      [p2[0], p1[1]],
      [p2[0], p3[1]],
      [p4[0], p3[1]],
      [p4[0], p1[1]],
    ],
  ];

  currSelectionPaneId += 1

  let selectionPaneLayer = new ol.layer.Vector({
    name: selectionPaneIdPrefix + currSelectionPaneId,
    source: new ol.source.Vector({
      projection: "EPSG:4326",
    }),
  });

  selectionPane = new ol.Feature(new ol.geom.Polygon(points));
  selectionPane.setId(selectionPaneIdPrefix + currSelectionPaneId);
  
  selectionPane.setStyle(square);

  let selectionPaneCoordinates = selectionPane.getGeometry().getCoordinates();

  let uy = selectionPaneCoordinates[0][0][1].toFixed(6);
  let rx = selectionPaneCoordinates[0][0][0].toFixed(6);
  let ly = selectionPaneCoordinates[0][2][1].toFixed(6);
  let lx = selectionPaneCoordinates[0][2][0].toFixed(6);

  currSelectionPaneCoord[0] = uy
  currSelectionPaneCoord[1] = rx
  currSelectionPaneCoord[2] = ly
  currSelectionPaneCoord[3] = lx
  
  selectionPaneLayer.getSource().addFeature(selectionPane);
  selectionPaneLayer.setVisible(true);
 
  selectionPaneLayer.setZIndex(10)
  
  map.addLayer(selectionPaneLayer)

  map.render();
};

window.toggle_controls = function toggle_controls() {
	if (document.getElementById('controls').style.display=='none') {
		document.getElementById('controls').style.display='block';
	} else {
		document.getElementById('controls').style.display='none';
	}
}

window.toggle_area = function toggle_area() {
  
  map.getLayers().forEach(layer => {
    if (layer && layer.get('name') === selectionPaneIdPrefix + currSelectionPaneId) {
      let currFeature = layer.getSource()
      .getFeatureById(selectionPaneIdPrefix + currSelectionPaneId)
      let fill = currFeature.getStyle().fill_
      let stroke = currFeature.getStyle().stroke_
      if (fill && stroke) {
        currFeature.setStyle(new ol.style.Style(null));
      } else {
        currFeature.setStyle(square);
      }
    }
  });
  
};

window.toggle_data = function toggle_data() {
  map.getLayers().forEach(layer => {
    if (layer && layer.get('name') === imageLayerIdPrefix + (currImageLayerId - 1)) {
      if (layer.getVisible()) {
        layer.setVisible(false);
      } else {
        layer.setVisible(true);
      }
    }
  });
};

window.load_data = function load_data(rasterjs) {

  var building = document.getElementById("building").value;
  if (building == "0") {
    console.log("please choose elevation dataset");
    return;
  }
  var res = document.getElementById("resolution").value;
  if (res == "0") {
    alert("please choose elevation resolution");
    return;
  }

  let selectionPaneFound = false

  map.getLayers().forEach(layer => {
    if (layer && layer.get('name') === selectionPaneIdPrefix + currSelectionPaneId) {
      selectionPaneFound = true
      let selectionPaneFeature = layer.getSource()
        .getFeatureById(selectionPaneIdPrefix + currSelectionPaneId);
      let selectionPaneCoordinates = selectionPaneFeature
        .getGeometry()
        .getCoordinates();

      let area = 1000 * document.getElementById("area").value;
      let raster;
      if (building == "1") raster = "dem2";
      else raster = "buildings2";

      let uy = selectionPaneCoordinates[0][0][1].toFixed(6);
      let rx = selectionPaneCoordinates[0][0][0].toFixed(6);
      let ly = selectionPaneCoordinates[0][2][1].toFixed(6);
      let lx = selectionPaneCoordinates[0][2][0].toFixed(6);

      currSelectionPaneCoord[0] = uy
      currSelectionPaneCoord[1] = rx
      currSelectionPaneCoord[2] = ly
      currSelectionPaneCoord[3] = lx

      if (rasterjs) {
        let origin = [-20037700, 30241100];
        let tileDimension = 1024;
        let indexes = [];
        //converting to mercator coordinates
        let urc = lonLatToXY([rx, uy]);
        let ulc = lonLatToXY([lx, uy]);
        let llc = lonLatToXY([lx, ly]);
        let lrc = lonLatToXY([rx, ly]);
        //first corner
        let row_1 = Math.floor(
          (origin[1] - ulc[1]) / (tileDimension * res)
        ).toString(16);
        let col_1 = Math.floor(
          (ulc[0] - origin[0]) / (tileDimension * res)
        ).toString(16);
        //second corner
        let row_2 = Math.floor(
          (origin[1] - urc[1]) / (tileDimension * res)
        ).toString(16);
        let col_2 = Math.floor(
          (urc[0] - origin[0]) / (tileDimension * res)
        ).toString(16);
        //third corner
        let row_3 = Math.floor(
          (origin[1] - llc[1]) / (tileDimension * res)
        ).toString(16);
        let col_3 = Math.floor(
          (llc[0] - origin[0]) / (tileDimension * res)
        ).toString(16);
        //fourth corner
        let row_4 = Math.floor(
          (origin[1] - lrc[1]) / (tileDimension * res)
        ).toString(16);
        let col_4 = Math.floor(
          (lrc[0] - origin[0]) / (tileDimension * res)
        ).toString(16);

        //calculation of rows and cols of images in between these corners
        let row = row_1;
        let col = col_1;
        while (row != row_4 || col != col_4) {
          indexes.push({ row: "R" + pad(row), col: "C" + pad(col) });
          if (col == col_4 && row != row_4) {
            row = (parseInt(row, 16) + 1).toString(16);
            col = col_1;
          } else {
            col = (parseInt(col, 16) + 1).toString(16);
          }
        }

        indexes.push({ row: "R" + pad(row), col: "C" + pad(col) });

        let roiDimension = {
          rows: Math.abs(parseInt(row_1, 16) - parseInt(row_3, 16)) + 1,
          cols: Math.abs(parseInt(col_1, 16) - parseInt(col_2, 16)) + 1,
        };

        let inner_x = ulc[0] - origin[0];
        let inner_y = origin[1] - ulc[1];

        //calculating pixel starting x,y coordinate (position) of desired image

        let position_x =
          (parseFloat(inner_x / (tileDimension * res)) -
            Math.floor(inner_x / (tileDimension * res))) *
          tileDimension;
        let position_y =
          (parseFloat(inner_y / (tileDimension * res)) -
            Math.floor(inner_y / (tileDimension * res))) *
          tileDimension;

        let position = { x: position_x, y: position_y };

        document.getElementById("loading").style.display = "block";

        let rasterApi = new Raster();

        rasterApi
          .getImage(
            indexes,
            roiDimension,
            position,
            res,
            getElevationConst(raster),
            area
          )
          .then((dataURL) => {
            
            let minLat = Math.min(selectionPaneCoordinates[0][0][1].toFixed(6), selectionPaneCoordinates[0][1][1].toFixed(6), 
                      selectionPaneCoordinates[0][2][1].toFixed(6), selectionPaneCoordinates[0][3][1].toFixed(6))
            
            let minLong = Math.min(selectionPaneCoordinates[0][0][0].toFixed(6), selectionPaneCoordinates[0][1][0].toFixed(6), 
                      selectionPaneCoordinates[0][2][0].toFixed(6), selectionPaneCoordinates[0][3][0].toFixed(6))
            
            let maxLat = Math.max(selectionPaneCoordinates[0][0][1].toFixed(6), selectionPaneCoordinates[0][1][1].toFixed(6), 
                        selectionPaneCoordinates[0][2][1].toFixed(6), selectionPaneCoordinates[0][3][1].toFixed(6))

            let maxLong = Math.max(selectionPaneCoordinates[0][0][0].toFixed(6), selectionPaneCoordinates[0][1][0].toFixed(6), 
            selectionPaneCoordinates[0][2][0].toFixed(6), selectionPaneCoordinates[0][3][0].toFixed(6))
          
            var layersToRemove = [];
            map.getLayers().forEach(layer => {
              // removing current selection window
              if (layer && layer.get('name') === selectionPaneIdPrefix + (currSelectionPaneId)) {
                //layersToRemove.push(layer);
                let currFeature = layer.getSource()
                .getFeatureById(selectionPaneIdPrefix + (currSelectionPaneId))
                currFeature.setStyle(new ol.style.Style(null));
              
              }

              // removing existing image
              if (layer && layer.get('name') === imageLayerIdPrefix + (currImageLayerId - 1)) {
                layersToRemove.push(layer);
              }

              // removing existing watershed
              if (layer && layer.get('name') === watershedLayerIdPrefix + (currWaterShedLayerId - 1)) {
                layersToRemove.push(layer);
              }

            });
            
            var len = layersToRemove.length;
            for(var i = 0; i < len; i++) {
                map.removeLayer(layersToRemove[i]);
            }

            let imgcache = new Image()
            imgcache.src = dataURL
            
            imgcache.onload = function() {
              currImageDataUrl = grayscaleimg(imgcache)

              let imageLayer = new ol.layer.Image({
                name: imageLayerIdPrefix + currImageLayerId,
                source: new ol.source.ImageStatic({
                  url: currImageDataUrl,
                  imageExtent: [minLong, minLat, maxLong, maxLat]
                })
              });
                // will be below selection pane layer
                imageLayer.setZIndex(1)
                map.addLayer(imageLayer)
                map.render()
                currImageLayerId += 1
                // resetting flow of directions
                flowdir = []
                document.getElementById("loading").style.display = "none";
            }
            

          }).catch(error => {
              console.log(error)
              alert('Raster for the requested area is currently unavailable in offline mode.')
              map.getLayers().forEach(layer => {
                if (layer && layer.get('name') === selectionPaneIdPrefix + (currSelectionPaneId)) {
                  map.removeLayer(layer);
                }
              });
              document.getElementById('loading').style.display = 'none'
        
            })
      }
    } 
  });

  // if no selection pane layer is found
  if (!selectionPaneFound) {
    alert("Please define area");
    return;
  }
  
};

window.data_download = function data_download() {
	var e = document.getElementById("datatype");
	var id = 1*e.options[e.selectedIndex].value;

	if (id==2) {
		console.log(originalDEM.toString());
	} else if (id==3) {
		console.log(flowdir.toString());
	}
}

window.menu_data = function menu_data() {
	document.getElementById('maplayer').style.display = 'none';
}

window.generate_map = function generate_map(c) {
	if (!c) {
		getimgcanvas(generate_map);
		return false;
	}

    document.getElementById('loading').style.display = 'block';

	var res = document.getElementById('resolution').value;
	var areaval = document.getElementById('area').value;
	var w = areaval * 1000 / res;
	var h = w
	var ctx = c.getContext("2d");

	dem = new Uint16Array(w * h);
	originalDEM = new Uint16Array(w * h);
    var imgData = ctx.getImageData(0, 0, w, h);
    var z = 0;
    //var lowest = 255;
    //var highest = 0;
    for (var i = 0; i < imgData.data.length; i += 4) {
		dem[z] = imgData.data[i];
		originalDEM[z] = imgData.data[i];
		z++;
		//lowest = Math.min(lowest, imgData.data[i]);
		//highest = Math.max(highest, imgData.data[i]);
	}

    //console.log(lowest, highest);

    if (window.Worker){
        var myWorker = new Worker('./js/worker_hand.js');
        var message = { data: { board: dem, originalBoard: originalDEM, width: w, height: h}};
        myWorker.postMessage(message);        
        myWorker.onmessage = function (e) {            
            flowdir = e.data.result.FlowDir;
            console.log("Flowdir ready");
			document.getElementById('loading').style.display = 'none';
        }
    }
}

function getimgcanvas(f) {
	var res = document.getElementById('resolution').value;
	var areaval = document.getElementById('area').value;
	var w = areaval * 1000 / res;
	var h = w
	var img = new Image();
	img.src = currImageDataUrl;

	var c = document.createElement("canvas");
	c.id = "mapcanvas";
	c.crossorigin = "anonymous";
	c.width = w;
	c.height = h;
	var ctx = c.getContext("2d");

	img.onload = function () {
	    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, w, h);
		f(c); // callback function call
	}
}

function delinate_watershed(lat, lng) {
	
	var res = document.getElementById('resolution').value;
	var area = 1000*document.getElementById('area').value;

  // update current selection pane coordinates if image is not yet projected
  map.getLayers().forEach(layer => {
    if (layer && layer.get('name') === selectionPaneIdPrefix + currSelectionPaneId) {
      let selectionPaneFeature = layer.getSource()
        .getFeatureById(selectionPaneIdPrefix + currSelectionPaneId);
      let selectionPaneCoordinates = selectionPaneFeature
        .getGeometry()
        .getCoordinates();

      let uy = selectionPaneCoordinates[0][0][1].toFixed(6);
      let rx = selectionPaneCoordinates[0][0][0].toFixed(6);
      let ly = selectionPaneCoordinates[0][2][1].toFixed(6);
      let lx = selectionPaneCoordinates[0][2][0].toFixed(6);

      currSelectionPaneCoord[0] = uy
      currSelectionPaneCoord[1] = rx
      currSelectionPaneCoord[2] = ly
      currSelectionPaneCoord[3] = lx
  }})

	var uy = currSelectionPaneCoord[0];
	var rx = currSelectionPaneCoord[1];
	var ly = currSelectionPaneCoord[2];
	var lx = currSelectionPaneCoord[3];

	var w = area/res;
	var h = w
	var dx = (rx - lx) / w;
	var dy = (uy - ly) / h;
	var y = h - Math.round((lat-ly)/dy);
	var x = w + Math.round((lng-rx)/dx);
		
	//test
	// var x = 593;
	// var y = 559;
	// var w = h = 1000;
	// ulx=-91.40688165430203;
	// uly=41.732428009205904;
	// lrx=-91.28660807934801;
	// lry=41.64260972432773;
	// var dx = (lrx - ulx) / w;
	// var dy = (uly - lry) / h;

	// var y = h - Math.round((lat-lry)/dy);
	// var x = w - Math.round((lrx-lng)/dx);
	//flowdir = new Int8Array(direction);
	// test

	console.log(lat, lng, dx, dy, w);
	console.log(x, y, lx, rx, uy, ly);
	
	if (x<0 || x>w || y<0 || y>h) {
		console.log('select a point inside the area');
		return false;
	}

	//return false;
  var tool = document.getElementById('tools').value;

	var worker_delineate = new Worker("./js/worker_delineate.js");
	worker_delineate.onmessage = function(e) {    	
		//if (e.data[1] > 500) console.log(x,y, e.data);
    	draw_watershed(lx, uy, dx, dy, w, h, e.data[0], e.data[1]);
	}
	if (worker_delineate) {
    var toolType = "watershed"
		// if (tool == "1") {
		// 	toolType = "watershed"
		// } else if (tool == "2") {
		// 	toolType = "raintracker"
		// }
		worker_delineate.postMessage([x, y, w, h, flowdir, toolType]);
	}
}

function draw_watershed(x0, y0, dx, dy, w, h, points, numcells) {

	console.log(x0, y0, dx, dy, w, h, points.length, numcells);

	var polycoord = [];	
			
	var len=points.length/2;
	var unitarea = 106207.72/w/h; // sq miles
	for (var i = 0; i < len; i++) {
		var lng=1*x0+points[2*i]*dx;
		var lat=1*y0-points[2*i+1]*dy;
		console.log(lat, lng);
		polycoord.push([lng, lat]);
  }

  // removing existing watershed
  map.getLayers().forEach(layer => {
    if (layer && layer.get('name') === watershedLayerIdPrefix + (currWaterShedLayerId - 1)) {
      map.removeLayer(layer);
    }
  });

  let watershedLayer = new ol.layer.Vector({
    name: watershedLayerIdPrefix + currWaterShedLayerId,
    source: new ol.source.Vector({
      projection: "EPSG:4326",
    }),
  });

  let pos = [polycoord]
 
  let watershedFeature = new ol.Feature(new ol.geom.Polygon(pos));
  watershedFeature.setId(watershedLayerIdPrefix + currWaterShedLayerId);
  watershedFeature.setStyle(watershedStyle);

  watershedLayer.getSource().addFeature(watershedFeature);
  watershedLayer.setVisible(true);
  // middle of image layer and selection pane layer 
  watershedLayer.setZIndex(5);

  map.addLayer(watershedLayer)

  currWaterShedLayerId++;
    
  map.render()

	console.log('Upstream Area: '+(Math.round(10*numcells*unitarea)/10)+' sq mi');	
}

function grayscaleimg(image) {

	var myCanvas=document.createElement("canvas");
	var myCanvasContext=myCanvas.getContext("2d");

	var imgWidth=image.width;
	var imgHeight=image.height;
	myCanvas.width = imgWidth;
	myCanvas.height = imgHeight;
	myCanvasContext.drawImage(image,0,0);
	// This function cannot be called if the image is not rom the same domain.
	// You'll get security error if you do.
	var imageData=myCanvasContext.getImageData(0,0, imgWidth, imgHeight);
	var data = imageData.data;

	console.log(data)

    for (var i = 0; i < data.length; i += 4) {
	  var avg = (data[i]*256 + data[i + 1]) / 5;
	  avg = avg % 256
	  data[i]     = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
	}
	console.log(data)
    myCanvasContext.putImageData(imageData, 0, 0);
	return myCanvas.toDataURL();
	//console.log(myCanvas.toDataURL());
}

function lonLatToXY(ll) {
  let A = 6378137.0;
  let D2R = Math.PI / 180;
  let MAXEXTENT = 20037508.342789244;
  var xy = [
    A * ll[0] * D2R,
    A * Math.log(Math.tan(Math.PI * 0.25 + 0.5 * ll[1] * D2R)),
  ];
  // if xy value is beyond maxextent (e.g. poles), return maxextent.
  xy[0] > MAXEXTENT && (xy[0] = MAXEXTENT);
  xy[0] < -MAXEXTENT && (xy[0] = -MAXEXTENT);
  xy[1] > MAXEXTENT && (xy[1] = MAXEXTENT);
  xy[1] < -MAXEXTENT && (xy[1] = -MAXEXTENT);
  return xy;
}

function getElevationConst(raster) {
  let rasterConst = "";
  if (raster == "buildings2") rasterConst = Constant.ELEVATION_BUILDINGS;
  else if (raster == "dem2") rasterConst = Constant.ELEVATION_BARE_EARTH;
  return rasterConst;
}

function pad(number) {
  let maxLength = 8;
  let paddedNumber = number;
  for (let i = 0; i < maxLength - number.length; i++) {
    paddedNumber = "0" + paddedNumber;
  }
  return paddedNumber;
}

//Following code is taken from https://www.geocodezip.net/scripts/OLfunctions.js

var R = 6371008.8; // radius of the Earth in metres

/** Extend Number object with method to convert numeric degrees to radians */
if (Number.prototype.toRadians === undefined) {
  Number.prototype.toRadians = function () {
    return (this * Math.PI) / 180;
  };
}

/** Extend Number object with method to convert radians to numeric (signed) degrees */
if (Number.prototype.toDegrees === undefined) {
  Number.prototype.toDegrees = function () {
    return (this * 180) / Math.PI;
  };
}

function computeOffset(initPoint, distanceMeters, bearingDegrees, earthRadius) {
  // computeOffset(from, distance, heading[, radius])
  if (!earthRadius) earthRadius = R;
  var lat = initPoint[1];
  var lng = initPoint[0];
  var lat = lat.toRadians();
  var lng = lng.toRadians();
  var bearing = bearingDegrees.toRadians();
  // from https://www.movable-type.co.uk/scripts/latlong.html
  var latDest = Math.asin(
    Math.sin(lat) * Math.cos(distanceMeters / earthRadius) +
      Math.cos(lat) * Math.sin(distanceMeters / earthRadius) * Math.cos(bearing)
  );
  var lngDest =
    lng +
    Math.atan2(
      Math.sin(bearing) *
        Math.sin(distanceMeters / earthRadius) *
        Math.cos(lat),
      Math.cos(distanceMeters / earthRadius) - Math.sin(lat) * Math.sin(latDest)
    );
  return [lngDest.toDegrees(), latDest.toDegrees()];
}