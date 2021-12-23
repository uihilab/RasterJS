var map, areapolygon, mapoverlay;
var imgurl, polybound;
var dem = [], originalDEM = [], flowdir = [];
var watershed_polygon, raintrack, rainanim_timer;
var utm = true;

function init() {
	map = new google.maps.Map(document.getElementById('map'), {
		mapTypeId: google.maps.MapTypeId.TERRAIN,
		zoom: 9,
		streetViewControl: false,
		fullscreenControl: false,
		mapTypeControlOptions: {
			style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
		},
		center: {lat: 41.8, lng: -91.3},
		styles: [
				  {
				    "featureType": "administrative",
				    "elementType": "geometry",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "administrative.land_parcel",
				    "elementType": "labels",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "poi",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "poi",
				    "elementType": "labels.text",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "road",
				    "elementType": "labels.icon",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "road.local",
				    "elementType": "labels",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  },
				  {
				    "featureType": "transit",
				    "stylers": [
				      {
				        "visibility": "off"
				      }
				    ]
				  }
		]
	});
	map.data.loadGeoJson('iowacounty.json');
	map.data.setStyle(function(feature) {
	  var color = 'rgba(5, 5, 5, 1.0)';
	  var border = 'rgba(5, 5, 5, 1.0)';
	  var ftr = feature.getProperty('County');
      if (ftr=='Linn' || ftr=='Johnson' || ftr=='Muscatine' || ftr=='Jones' || ftr=='Cedar') {
        color = 'rgba(5, 5, 5, 0.0)';
        border = 'rgba(125, 125, 125, 0.3)'
      }
      return ({
      	clickable: false,
        fillColor: color,
        strokeColor: border,
        strokeWeight: 1
      });
    });    

	google.maps.Polygon.prototype.getPolyBounds=function(){
	    var bounds = new google.maps.LatLngBounds();
	    this.getPath().forEach(function(element,index){bounds.extend(element)});
	    return bounds;
	}

	google.maps.event.addListener(map, 'click', function(event) {
		var myLatLng = event.latLng;
		var lat = myLatLng.lat();
		var lng = myLatLng.lng();

		delineate(lat, lng);
	});
}

function delineate(lat, lng) {
	
	var res = document.getElementById('resolution').value;
	var area = 1000*document.getElementById('area').value;

	polybound = areapolygon.getPolyBounds();
	var uy = polybound.getNorthEast().lat().toFixed(6);
	var rx = polybound.getNorthEast().lng().toFixed(6);
	var ly = polybound.getSouthWest().lat().toFixed(6);
	var lx = polybound.getSouthWest().lng().toFixed(6);

	var w = h = area/res;
	var dx = (rx - lx) / w;
	var dy = (uy - ly) / h;
	var y = h - Math.round((lat-ly)/dy);
	var x = w + Math.round((lng-rx)/dx);
	
	if (x<0 || x>w || y<0 || y>h) {
		console.log('select a point inside the area');
		return false;
	}

	var tool = document.getElementById('tools').value;

	var worker_delineate = new Worker("worker_delineate.js?id=8");
	worker_delineate.onmessage = function(e) {    	

		if (tool == "1") {
			draw_watershed(lx, uy, dx, dy, w, h, e.data[0], e.data[1]);
		} else if (tool == "2") {
			draw_rain_tracker(lx, uy, dx, dy, w, h, lat, lng, e.data)
		}
		
	}

	if (worker_delineate) {
		var toolType = ""
		if (tool == "1") {
			toolType = "watershed"
		} else if (tool == "2") {
			toolType = "raintracker"
		}

		worker_delineate.postMessage([x, y, w, h, flowdir, toolType]);
	}
}

function draw_rain_tracker(x0, y0, dx, dy, w, h, clicked_lat, clicked_lng, points) {
	
	var i = dy
	var n = dx
	var r = 1
	// finding center of the clicked cell
	var lat = Math.round(.2 + clicked_lat / i) * i
	var lng = Math.round(.2 + clicked_lng / n) * n - n / 5 
    var c = [];

	raintrack && (raintrack.setMap(null), raintrack = null), 

	// fliiping  values
	dir_arr = new Array(8), 
	dir_arr[0] = new Array(0, 1),
	dir_arr[1] = new Array(0, -1), 
	dir_arr[2] = new Array(-1, 0), 
	dir_arr[3] = new Array(1, 0), 
	dir_arr[4] = new Array(-1, 1), 
	dir_arr[5] = new Array(1, -1), 
	dir_arr[6] = new Array(-1, -1), 
	dir_arr[7] = new Array(1, 1);

	var g = points.length

	for (var h = 0; h < g; h++) {
		
		c.push(new google.maps.LatLng(lat, lng))

		direction = points[h]
		
		mx = dir_arr[direction][0] 
		my = dir_arr[direction][1]
		
		lng += mx * n
		lat -= my * r * i
	}


    raintrack = new google.maps.Polyline({
        path: c,
        strokeOpacity: 0,
        icons: [{
            icon: {
                path: "M 0,-0.1 0, 0.1",
                strokeColor: "#0000FF",
                strokeOpacity: 1,
                scale: 5
            },
            offset: "0",
            repeat: "1px"
        }, {
            icon: {
                path: "M-4,0a4,4 0 1,0 8,0a4,4 0 1,0 -8,0",
                scale: 1,
                fillColor: "#FFFFFF",
                fillOpacity: 1,
                strokeColor: "#0000FF",
                strokeOpacity: 1,
                strokeWeight: 2
            },
            fixedRotation: !0,
            offset: "0",
            repeat: "80px"
        }],
        map: map
	});
	c = null
	points = null

	animateRainPoly(1, g)
}

function animateRainPoly(e, a) {
        var t = (e + 2) % 80, n = raintrack.get("icons");
		n[1].offset = t + "px";
		raintrack.set("icons", n);
		rainanim_timer && clearTimeout(rainanim_timer);
		rainanim_timer = setTimeout("animateRainPoly(" + t + ", " + a + ");", 50)
}

function draw_watershed(x0, y0, dx, dy, w, h, points, numcells) {

	var polycoord = [];	
	if (watershed_polygon) {
		watershed_polygon.setMap(null);
	}		
	var len=points.length/2;
	var unitarea = 106207.72/w/h; // sq miles
	for (var i = 0; i < len; i++) {
		lng=1*x0+points[2*i]*dx;
		lat=1*y0-points[2*i+1]*dy;
		polycoord.push(new google.maps.LatLng(lat, lng));
	}
	watershed_polygon = new google.maps.Polygon({
		paths: polycoord,
		strokeColor: '#000000',
		clickable: false,
		strokeOpacity: 1.0,
		strokeWeight: 2,
		fillColor: '#0000FF',
		fillOpacity: 0.1
	});
	watershed_polygon.setMap(map);	
	watershed_polygon.vis = true;
}

function toggle_controls() {
	if (document.getElementById('controls').style.display=='none') {
		document.getElementById('controls').style.display='block';
	} else {
		document.getElementById('controls').style.display='none';
	}
}

function getimgcanvas(f) {
	var res = document.getElementById('resolution').value;
	var areaval = document.getElementById('area').value;
	var w = h = areaval * 1000 / res;

	var img = new Image();
	img.src = 'inc_proxy.php?mimetype=image/png&url='+encodeURIComponent(imgurl);

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

function update_area() {
	var res = document.getElementById('resolution').value;
	var opt = document.getElementById('area').options;
	for (var i = 1; i < opt.length; i++) {
		if (res*i > 100) {
			opt[i].setAttribute('hidden', 'hidden');
		} else {				
			opt[i].hidden = false;
			opt[i].text = ' - '+(res*i)+' km x '+(res*i)+' km';
			opt[i].value = (res*i);
		}
	}
}

function show_area() {
	var res = document.getElementById('resolution').value;
	var area = document.getElementById('area').value;
	if (res+area=='00') {
		console.log('please choose elevation and area values');
		return;
	}

	if (areapolygon) areapolygon.setMap(null);

	var c = map.getCenter();
	var cutm = fromLatLon(c.lat(), c.lng())
	var co1 = toLatLon(cutm.easting+(area*1000/2), cutm.northing-(area*1000/2), 15, "T");
	var co2 = toLatLon(cutm.easting-(area*1000/2), cutm.northing+(area*1000/2), 15, "T");
	
    var areacoords = [
      {lat: co1.latitude, lng: co2.longitude},
      {lat: co2.latitude, lng: co2.longitude},
      {lat: co2.latitude, lng: co1.longitude},
      {lat: co1.latitude, lng: co1.longitude}
    ];

    areapolygon = new google.maps.Polygon({
      paths: areacoords,
      //clickable: false,
      draggable: true,
      strokeColor: '#000',
      strokeOpacity: 0.8,
      strokeWeight: 1,
      fillColor: '#080',
      fillOpacity: 0.3
	});
	

    areapolygon.easting = cutm.easting;
    areapolygon.northing = cutm.northing;
    areapolygon.setMap(map);
	areapolygon.vis = true;

	google.maps.event.addListener(areapolygon, 'click', function (event) {
		var myLatLng = event.latLng;
		var lat = myLatLng.lat();
		var lng = myLatLng.lng();
		// delinate watershed
		delinate_watershed(lat, lng);
	}); 
}

function toggle_area() {
	if (areapolygon.vis) {
		areapolygon.setMap(null);
		areapolygon.vis = false;
	} else {
		areapolygon.setMap(map);
		areapolygon.vis = true;
		polybound = areapolygon.getPolyBounds();
		var area = document.getElementById('area').value;
		var uy = 1*polybound.getNorthEast().lat().toFixed(6);
		var rx = 1*polybound.getNorthEast().lng().toFixed(6);
		var ly = 1*polybound.getSouthWest().lat().toFixed(6);
		var lx = 1*polybound.getSouthWest().lng().toFixed(6);
	}
}

function toggle_data(id = 0) {
	if (mapoverlay.vis || id) {
		mapoverlay.setMap(null);
		mapoverlay.vis = false;
	} else {
		mapoverlay.setMap(map);
		mapoverlay.vis = true;
	}
}

function fromlatlngtoGoogle(lat, lon) {
	// convert from long/lat to google mercator (or EPSG:4326 to EPSG:900913)
	var x1 = lon * 20037508.34 / 180;
    var y1 = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 20037508.34 / Math.PI;
    return [x1, y1];
}

function load_data() {
	if (!areapolygon) {
		console.log('please define area');
		return;
	}
	areapolygon.draggable = false;
	var building = document.getElementById('building').value;
	if (building=='0') {
		console.log('please choose elevation dataset');
		return;
	}
	var res = document.getElementById('resolution').value;
	var area = 1000*document.getElementById('area').value;
	if (building=='1') raster='dem2';
	else raster='buildings2';

	polybound = areapolygon.getPolyBounds();
	var uy = 1*polybound.getNorthEast().lat().toFixed(6);
	var rx = 1*polybound.getNorthEast().lng().toFixed(6);
	var ly = 1*polybound.getSouthWest().lat().toFixed(6);
	var lx = 1*polybound.getSouthWest().lng().toFixed(6);

	// TODO: You need to provide an endpoint to retrieve the raster images.
	// Parameters available to customize the request are:
	//    * ly, lx, uy, rx as Bounding Box
	//    * area/res as Width ad Height
	//    * raster (String) (Building or DEM)
	if (utm) {
		imgurl = "<YourRasterDataEndpoint>";

	} else {
		var cellsize = 0.00000774555*res;
		imgurl = "<YourRasterDataEndpoint>";
	}

	var imgcache = new Image();
	var proxyimg = 'inc_proxy.php?mimetype=image/png&url='+encodeURIComponent(imgurl);
	imgcache.src = proxyimg;

    document.getElementById('loading').style.display = 'block';
    imgcache.onload = function(){
    	document.getElementById('loading').style.display = 'none';
	    areapolygon.setMap(null);
	    areapolygon.vis = false;
    	if (mapoverlay) mapoverlay.setMap(null);
		if (utm) proxyimg = grayscaleimg(imgcache);
	
		mapoverlay = new google.maps.GroundOverlay(proxyimg, polybound);
	    mapoverlay.setMap(map);
		mapoverlay.vis = true;
		google.maps.event.addListener(mapoverlay, 'click', function (event) {
			var myLatLng = event.latLng;
			var lat = myLatLng.lat();
			var lng = myLatLng.lng();
			delineate(lat, lng);
		});
    }
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

    for (var i = 0; i < data.length; i += 4) {
      var avg = (data[i]*256 + data[i + 1]) / 5;
	  data[i]     = avg; // red
      data[i + 1] = avg; // green
      data[i + 2] = avg; // blue
	}
    myCanvasContext.putImageData(imageData, 0, 0);
	return myCanvas.toDataURL();
}

function data_download() {
	var e = document.getElementById("datatype");
	var id = 1*e.options[e.selectedIndex].value;

	if (id==2) {
		console.log(originalDEM.toString());
	} else if (id==3) {
		console.log(flowdir.toString());
	}
}

function menu_data() {
	document.getElementById('maplayer').style.display = 'none';
}

function generate_map(c) {
	if (!c) {
		getimgcanvas(generate_map);
		return false;
	}

    document.getElementById('loading').style.display = 'block';

	var res = document.getElementById('resolution').value;
	var areaval = document.getElementById('area').value;
	var w = h = areaval * 1000 / res;
	var ctx = c.getContext("2d");

	dem = new Uint16Array(w * h);
	originalDEM = new Uint16Array(w * h);
    var imgData = ctx.getImageData(0, 0, w, h);
    var z = 0;

    if (utm) {	
	    for (var i = 0; i < imgData.data.length; i += 4) {
	        dem[z] = imgData.data[i]*256+imgData.data[i+1];
	        originalDEM[z] = imgData.data[i]*256+imgData.data[i+1];
	        z++;
	    }
    } else {	    	
	    for (var i = 0; i < imgData.data.length; i += 4) {
	        dem[z] = imgData.data[i];
	        originalDEM[z] = imgData.data[i];
	        z++;
	    }
    }

    if (window.Worker){
        var myWorker = new Worker('worker_flowdirection.js');
        var message = { data: { board: dem, originalBoard: originalDEM, width: w, height: h}};
        myWorker.postMessage(message);        
        myWorker.onmessage = function (e) {            
            flowdir = e.data.result.FlowDir;
            console.log("Flowdir ready");
			document.getElementById('loading').style.display = 'none';
        }
    }
}
