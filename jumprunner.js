
var Dropzones = [];
var CompassFeatures = new ol.Collection();
var DropzoneIconFeatures = new ol.Collection();
var GeoJsonFeatures = new ol.Collection();
var SelectedDropzone = null;

var socket = io('https://skycloud.nu');
var KioskMode = false;
var DefaultCenter = [16.503762, 59.578736];
var DefaultZoomLvl = 6;
var DefaultDropzone = null;
var DefaultDropzoneId = null;
var DefaultRotation = 0;
var DefaultCompassCirclesCount = 3;
var DefaultCompassCirclesBaseDistance = 0.5;
var DefaultCompassCirclesInterval = 0.5;
var CompassCirclesCount, CompassCirclesBaseDistance, CompassCirclesInterval;
var SelectedDropzoneId = null;

function initialize_kiosk(){
	
	var url = new URL(window.location.href);
	var params = new URLSearchParams(url.search);
	
	if (params.get('kiosk') === 'true') {
	 	console.log('Running kioskmode');
	 	var id = Number(params.get('id'));
	 	
	 	KioskMode = true;
	 	
	 	if(id){
			
			hideBanner();
			toggleSidebarVisibility();     
			SelectDropzoneById(id);
			
	 	}

		if(id===0){

			ResetJumprunner();

		}
		 
 	}else{
		
		
		if(SelectedDropzoneId){
	   		
			SelectDropzoneById(SelectedDropzoneId);
		
		}
		
	}	
	
}

function toRadians(angleDegrees){
	return angleDegrees * Math.PI / 180;
};

function toDegrees(angleRadians){
	return angleRadians * 180 / Math.PI;
}

function GetDropzoneById(id){

	var dropzone = null;
	
	for(var i = 0; i < Dropzones.length; i++){
   	
   	if(id === Dropzones[i].id){
	  	
	  	dropzone = Dropzones[i];
	  	
	  	break;
   	
   	}
   	
	}
	
	return dropzone
}

function SelectDropzoneById(id){
	console.log('SelectDropzoneById', id);
		
	SelectedDropzone = GetDropzoneById(id);
	
	if(!SelectedDropzone){
   	
   		console.log('Could not find dropzone');
   		
   		return;
		
	}
   	
	var lonlat = ol.proj.fromLonLat(SelectedDropzone.lonlat);
	
	var rotation = Number(localStorage['MapRotation']) || DefaultRotation;
	
	if( KioskMode ){
  	
   	
   		rotation = toRadians(SelectedDropzone.mapRotation);
   		var settings = SelectedDropzone.kiosksettings;
   		
   		var rotation = toRadians(settings.mapRotation);
   	
   		CompassCirclesCount = Number(settings.compass.ringcount) || DefaultCompassCirclesCount;
   		CompassCirclesBaseDistance = Number(settings.compass.ringbase) || DefaultCompassCirclesBaseDistance;
   		CompassCirclesInterval = Number(settings.compass.ringinterval) || DefaultCompassCirclesInterval;
   		
	} else {
		
   		CompassCirclesCount = Number(localStorage['CompassCirclesCount']) || DefaultCompassCirclesCount;
   		CompassCirclesBaseDistance = Number(localStorage['CompassCirclesBaseDistance']) || DefaultCompassCirclesBaseDistance;
   		CompassCirclesInterval = Number(localStorage['CompassCirclesInterval']) || DefaultCompassCirclesInterval;
		
	}
	
	localStorage.setItem('SelectedDropzoneId', id);
	localStorage.setItem('MapRotation', rotation);   
	
	createCompassFeatures();
	
	var extent = null;
	
	OLMap.getLayers().getArray().forEach(function(layer){
   	
   	if(layer instanceof ol.layer.Group) {
	  	
	  	layer.getLayers().forEach(function(layer){
		 				
			if (layer.get('name') === 'lfv' ) {
								
				var features = layer.getSource().getFeatures();
				
				features.forEach(function(feature){
					
					if(feature.getGeometry().intersectsExtent(lonlat)){

						console.log(feature.get('name'))

					}
					
				})
				
			}
			
		 	if (layer.get('name') === 'compass') {
				
				extent =  layer.getSource().getExtent()         
				
		 	}
		 	
	  	})
	  	
   	}
   	
	})
	
	var view = OLMap.getView();
	
	view.fit(extent, {
	
   		padding: [30, 30, 30, 30],
   		duration: 500,
	
	});
	
	view.animate({rotation: localStorage['MapRotation']})
   
}

function ResetJumprunner(){
	
	localStorage['CompassCirclesCount'] = CompassCirclesCount = DefaultCompassCirclesCount;
	localStorage['CompassCirclesBaseDistance'] = CompassCirclesBaseDistance = DefaultCompassCirclesBaseDistance;
	localStorage['CompassCirclesInterval'] = CompassCirclesInterval = CompassCirclesInterval;
	localStorage['MapRotation'] = MapRotation = DefaultRotation;
	
	CompassFeatures.clear();
		
	var lonlat = ol.proj.fromLonLat(DefaultCenter);
	
	var view = OLMap.getView();
	
	view.animate({rotation: DefaultRotation, center: lonlat, zoom: DefaultZoomLvl, duration: 500});
	
}

function GetDropzones() {
	
	$.ajax({
		url: 'https://skycloud.nu/jumprunner/dropzones',
		timeout: 5000,
		cache: false,
		dataType: 'json'
	})
	.done(function(data){
		
		Dropzones = data;
		
		console.log('Dropzones is loaded', data)
		
	})
	.fail(function(data){
		
		console.log('Could not get dropzones', data);
		
	})
	.always(function(){
		
		createDropzoneMarkers();
		initialize_kiosk();
		
	})
	
}

function initialize_jumprunner(){
	SelectedDropzoneId = Number(localStorage['SelectedDropzoneId']) || DefaultDropzoneId;
	MapRotation = Number(localStorage['MapRotation']) || DefaultRotation;
	
	var dropzonesIconsLayer = new ol.layer.Vector({
		 name: 'dz_positions',
		 type: 'overlay',
		 title: 'Dropzones',
		 source: new ol.source.Vector({
		 	features: DropzoneIconFeatures
		 })
	});
	   
	var compassLayer = new ol.layer.Vector({
		name: 'compass',
		type: 'overlay',
		title: 'Compass',
		
		source: new ol.source.Vector({
			features: CompassFeatures,
		})
	})
	
	var lfvgeojson = createGeoJsonLayer('LFV', 'lfv', 'geojson/se.geojson', 'rgba(252, 186, 3, 0.3', 'rgba(252, 186, 3, 1', true);
		
	var groupLayer = new ol.layer.Group({
		name: 'jumprunner',
		title: 'Jumprunner',
		layers: [dropzonesIconsLayer, compassLayer, lfvgeojson]
	})
			
	ol.control.LayerSwitcher.forEachRecursive(groupLayer, function(lyr) {
		if (!lyr.get('name'))
				return;

		if (lyr.get('type') === 'overlay') {
		
			var visible = localStorage['layer_' + lyr.get('name')];
		
			if (visible != undefined) {
			
				lyr.setVisible(visible === "true");
			
			}

			lyr.on('change:visible', function(evt) {
			
				localStorage['layer_' + evt.target.get('name')] = evt.target.getVisible();
			
			});
		
		}
		
	})

	OLMap.addLayer(groupLayer);
	
	OLMap.getView().on('change:rotation', function (event) {
							 
	   MapRotation = localStorage['MapRotation'] = OLMap.getView().getRotation(); 
				  
	})
	
	OLMap.getView().on('change:resolution', function(evt) {
		ZoomLvl = localStorage['ZoomLvl']  = OLMap.getView().getZoom();
		var resolution = evt.target.getResolution()
		var view = OLMap.getView();
		CompassFeatures.forEach(function(feature){				
			if (feature.get('name') === 'windarrow'){
				var style = feature.getStyle();
				
				var image = style.getImage();

				image.setScale(ZoomLvl/resolution+0.1)
			}
			
			if (feature.get('name') === 'compasspoint'){
				
				var style = feature.getStyle();
				
				var text = style.getText();
				
				text.setScale(ZoomLvl/resolution+0.1)
			}
			
		})
	});
	
	
	OLMap.on(['click'], function(event) {
		var id = event.map.forEachFeatureAtPixel(event.pixel,
			  
			  function(feature, layer) {

				 return feature.id;
			  
			  },{
			  
			  layerFilter: function(layer) {
			  
				 return (layer === dropzonesIconsLayer);
			  
			  },
			  
			  hitTolerance: 2,
			  
		   });
		   
	   	if(id){
		  	
	  		SelectDropzoneById(id)
	  		
	  		event.stopPropagation();
   		
	   	}
		   
	})
	
	var selectStyle = function (feature) {
		  return new ol.style.Style({
			  fill: new ol.style.Fill({
				  color : "rgba(252, 186, 3, 0.3)"
			  }),
			  stroke: new ol.style.Stroke({
				  color: "#FFFFFF",
				  width: 3
			  }),
			  text: new ol.style.Text({
				  text: feature.get("name"),
				  overflow: OLMap.getView().getZoom() > 5,
			   scale: 1.25,
				  fill: new ol.style.Fill({
					  color: '#000000'
				  }),
				  stroke: new ol.style.Stroke({
					  color: '#FFFFFF',
					  width: 2
				  })
			  }),
			  zIndex:10
		  })
	   };
	   
	var selected = null;
	// show the hover box
	OLMap.on('pointermove', function(evt) {
		  
		if (selected !== null) {
			
			selected.setStyle(undefined);            
			
			selected = null;
			
		 }
		  
		 OLMap.forEachFeatureAtPixel(evt.pixel, function (feature, layer) {
			
			if (layer.get('name') === 'lfv'){
	
			   selected = feature;
			   
			   feature.setStyle(selectStyle);
			   
			  return true;
			
			} 
	
		 });
	
	})
	
	
	GetDropzones();
	
}

function get_compass_point(center, distance, bearing) {
   
   var lat1 = toRadians(center[1]);
   
   var lon1 = toRadians(center[0]);
   
   var dByR = distance / 6378137.0;
   
   var lat = Math.asin(Math.sin(lat1) * Math.cos(dByR) + Math.cos(lat1) * Math.sin(dByR) * Math.cos(bearing));
   
   var lon = lon1 + Math.atan2(Math.sin(bearing) * Math.sin(dByR) * Math.cos(lat1), Math.cos(dByR) - Math.sin(lat1) * Math.sin(lat));
   
   return [toDegrees(lon), toDegrees(lat)];
   
}
function getAltitudeColor(altitude) {
   var h, s, l;
   
   s = ColorByAlt.air.s;
   l = ColorByAlt.air.l;

   // find the pair of points the current altitude lies between,
   // and interpolate the hue between those points
   var hpoints = ColorByAlt.air.h;
   h = hpoints[0].val;
   for (var i = hpoints.length-1; i >= 0; --i) {
	  if (altitude > hpoints[i].alt) {
		 if (i == hpoints.length-1) {
			h = hpoints[i].val;
		 } else {
			h = hpoints[i].val + (hpoints[i+1].val - hpoints[i].val) * (altitude - hpoints[i].alt) / (hpoints[i+1].alt - hpoints[i].alt)
		 }
	  break;
	  }
   }
	  
   if (h < 0) {
	  h = (h % 360) + 360;
   } else if (h >= 360) {
	  h = h % 360;
   }
   
   if (s < 5) s = 5;
   else if (s > 95) s = 95;
   
   if (l < 5) l = 5;
   else if (l > 95) l = 95;
   
   return 'hsl(' + (h/5).toFixed(0)*5 + ',' + (s/5).toFixed(0)*5 + '%,' + (l/5).toFixed(0)*5 + '%)'
}
function GetConversionFactor(){
   
   var conversionFactor = 1000.0;
   
   if (DisplayUnits === "nautical") {
	  
	  conversionFactor = 1852.0; 
	  
   } else if (DisplayUnits === "imperial") {
	  
	  conversionFactor = 1609.0;
   
   }
   
   return conversionFactor;
   
}


function DropzoneMarkersStyle () {
   return new ol.style.Style({
	  image: new ol.style.Circle({
		 
		 radius: 5,
		 
		 snapToPixel: false,
		 
		 fill: new ol.style.Fill({
			color: 'black'
		 }),
		 
		 stroke: new ol.style.Stroke({
			color: 'white', width: 1
		 })
		 
	  })
   });
}

function CompassCircleStyle (text) {
   return [
	  new ol.style.Style({
			stroke: new ol.style.Stroke({
					color: '#FFFFFF',
					width: 2
			}),
			zIndex: 5
	  }),
	  new ol.style.Style({
		 stroke: new ol.style.Stroke({
			color: '#000000',
			width: 6
		 }),
		 
		 text: new ol.style.Text({
			font: '12px Helvetica Neue, sans-serif',
			fill: new ol.style.Fill({
			   color: '#000000',
			}),
			stroke: new ol.style.Stroke({
					color: '#FFFFFF',
					width: 3
				   
			}),
			offsetY: -18,
			text: format_distance_long(text, DisplayUnits, 1)
		 }),
	  })     
   ];
}

function CompassPointStyle (text, rotation, size, offsetY, baseline) {
	
   return new ol.style.Style({
	  text: new ol.style.Text({
		 font: size + 'px Helvetica Neue, sans-serif',
		 text: text,
		 rotateWithView: true,
		 //textBaseline: baseline,
		 fill: new ol.style.Fill({
			color: '#FFFFFF',
		 }),
		 offsetY: 0,
		 offsetX: 0,
		 rotation: rotation,
		 stroke: new ol.style.Stroke({
			color: '#000000',
			width: 6, 
		 }),
	  })
   })
}

function CompassCenterMarkerStyle(){
   return new ol.style.Style({
	  image: new ol.style.Circle({
		 radius: 8,
		 snapToPixel: false,
		 fill: new ol.style.Fill({color: 'black'}),
		 stroke: new ol.style.Stroke({color: 'white', width: 2})
	  }),
   })
}

function CompassJumprunLineStyle(){
   return new ol.style.Style({
	  stroke: new ol.style.Stroke({color: 'purple', width: 6}),   
	  zIndex: 10
   })  
}

function CompassJumprunCenterMarkerStyle(){
   return new ol.style.Style({
	  image: new ol.style.RegularShape({
		 fill: new ol.style.Fill({color: 'black'}),
		 stroke: new ol.style.Stroke({color: 'blue', width: 2}),
		 points: 4,
		 radius1: 10,
		 radius2: 0,
		 rotation: SelectedDropzone.jumprun.direction * Math.PI / 180,
		 angle: Math.PI / 4,
		 rotateWithView: true,
	  }),
	  zIndex:10
   })
}

function CompassJumprunArrowStyle(){   
   return new ol.style.Style({
	  image: new ol.style.RegularShape({
		fill: new ol.style.Fill({color: 'purple'}),
		stroke: new ol.style.Stroke({color: 'black', width: 1}),
		points: 3,
		radius: 10,
		rotation: SelectedDropzone.jumprun.direction * Math.PI / 180,
		rotateWithView:true,
	  }),
	  zIndex:10,
   });
}

function CompassJumprunGreenLightStyle(distance){
   return [
	  new ol.style.Style({
		 image: new ol.style.Circle({
			radius: 5,
			snapToPixel: false,
			fill: new ol.style.Fill({color: 'lightgreen'}),
			stroke: new ol.style.Stroke({color: 'black',width: 2})
		 }),
		 zIndex:10
	  }),
	  new ol.style.Style({
		 
		 text: new ol.style.Text({
			font: '12px Helvetica Neue, sans-serif',
			fill: new ol.style.Fill({
			   color: '#000000',
			}),
			stroke: new ol.style.Stroke({
					color: '#FFFFFF',
					width: 3
				   
			}),
			offsetX: 30,
			text: format_distance_long(distance, DisplayUnits, 1)
		 }),
		 zIndex: 10
	  
	  })
   
   ];
}

function CompassJumprunRedLightStyle(distance){
   return [
	  new ol.style.Style({
		 image: new ol.style.Circle({
			radius: 5,
			snapToPixel: false,
			fill: new ol.style.Fill({color: 'red'}),
			stroke: new ol.style.Stroke({color: 'black',width: 2})
		 }),
		 zIndex:10
   }),
   
	  new ol.style.Style({
		 text: new ol.style.Text({
			font: '12px Helvetica Neue, sans-serif',
			fill: new ol.style.Fill({
			   color: '#000000',
			}),
			stroke: new ol.style.Stroke({
					color: '#FFFFFF',
					width: 3
				   
			}),
			offsetX: 30,
			text: format_distance_long(distance, DisplayUnits, 1)
		 }),
		 zIndex:10
	  })
   ]
}

function CompassWindArrowStyle(stroke, fill, selected_stroke, wind, distance, scale){
	var shape = {
		   
		svg: '<svg id="svg1850" width="48.833" height="47.962" version="1.1" viewBox="0 0 48.833 47.962" xmlns="http://www.w3.org/2000/svg"><g id="layer1" transform="translate(-45.689 3.8806)"><defs><style>.cls-1{fill:aircraft_color_fill;}</style></defs><path class="cls-1" id="path1370" d="m70.411-3.2703-24.474 47.134 24.474-19.796 23.862 19.325z" fill="none" stroke="#000" stroke-width=".55912px"/></g></svg>',
		size: [50,50],
		
   }
   
    var view = OLMap.getView();
	var res = view.getResolution();
	
	var scale = ZoomLvl/res+0.1;
	
   var icon = new ol.style.Icon({
	  anchor:[25,50],
	  size: shape.size,
	  anchorXUnits: 'fragments',
	  anchorYUnits: 'pixels',
	  imgSize: shape.size,
	  src: svgPathToURI(shape.svg, stroke, fill, selected_stroke),
	  opacity: 1,
	  rotateWithView: true,
	  rotation: (wind.direction-180) * Math.PI / 180,
	  scale: scale
	});
	

   var unit_lable = get_unit_label('altitude', DisplayUnits);
   var alt_text = Math.round(convert_altitude(wind.altitude, DisplayUnits)).toLocaleString() 
	  
   var text =  alt_text + unit_lable
   
   var style = new ol.style.Style({
	  image: icon,
	  text: new ol.style.Text({
		 font: '12px Helvetica Neue, sans-serif',
		 fill: new ol.style.Fill({ color: '#000000'}),
		 stroke: new ol.style.Stroke({ color: '#FFFFFF', width: 3}),
		 //offsetX: 30,
		 text: text
	  }),
	  zIndex:20
   });   
   
   return style;
}

function DropzoneMarkersFeatures(){
   for(var i = 0; i < Dropzones.length; i++){
			
	   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(Dropzones[i].lonlat)));
	   
	   feature.id = Dropzones[i].id
	   
	   var style = DropzoneMarkersStyle();
		
	   feature.setStyle(style);
	   
	   DropzoneIconFeatures.push(feature);
	   
   }   
}

function createGeoJsonLayer(title, name, url, fill, stroke, showLabel = true) {
	return new ol.layer.Vector({
		type: 'overlay',
		title: title,
		name: name,
		zIndex: 99,
		visible: false,
		source: new ol.source.Vector({
		  url: url,
		  format: new ol.format.GeoJSON({
			defaultDataProjection :'EPSG:4326',
				projection: 'EPSG:3857'
		  })
		}),
		style: function style(feature) {
			return new ol.style.Style({
				fill: new ol.style.Fill({
					color : fill
				}),
				stroke: new ol.style.Stroke({
					color: stroke,
					width: 1
				}),
				text: new ol.style.Text({
					text: showLabel ? feature.get("name") : "",
					overflow: OLMap.getView().getZoom() > 5,
					scale: 1.25,
					fill: new ol.style.Fill({
						color: '#000000'
					}),
					stroke: new ol.style.Stroke({
						color: '#FFFFFF',
						width: 2
					})
				})
			});
		}
	});
};

function createDropzoneMarkers(){
   DropzoneMarkersFeatures();  
}

function DropzoneMarkersFeatures(){
   for(var i = 0; i < Dropzones.length; i++){
			
	   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(Dropzones[i].lonlat)));
	   
	   feature.id = Dropzones[i].id
	   
	   var style = DropzoneMarkersStyle();
		
	   feature.setStyle(style);
	   
	   DropzoneIconFeatures.push(feature);
	   
   }   
}

function CompassCircleFeatures() {
   var features = [];
   var conversionFactor = GetConversionFactor();
   
   for (var i=0; i < CompassCirclesCount; ++i) {
	  var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * i)) * conversionFactor;
	  var circle = make_geodesic_circle(SelectedDropzone.lonlat, distance, 360);
	  
	  circle.transform('EPSG:4326', 'EPSG:3857');
	  
	  var feature = new ol.Feature(circle);
	  feature.set('name', 'compasscircle')
	  var style = CompassCircleStyle(distance);
	  
	  feature.setStyle(style);      
	  CompassFeatures.push(feature)
	  
   }   
}

function CompassPointFeatures() {
   var points = [360, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
   var features = [];
   
   for(var i = 0; i < points.length; i++){
	  var conversionFactor = GetConversionFactor();
	  var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * (CompassCirclesCount-1))) * conversionFactor;
	  var text = null;
	  var styles = [];
	  
	  if(points[i] == 360){
		 text = 'N';
	  }
	  
	  if(points[i] == 45){
		 text = 'NE';
	  }
	  
	  if(points[i] == 90){
		 text = 'E';
	  }
	  
	  if(points[i] == 135){
		 text = 'SE';
	  }
	  
	  if(points[i] == 180){
		 text = 'S';
	  }
	  
	  if(points[i] == 225){
		 text = 'SW';
	  }
	  
	  if(points[i] == 270){
		 text = 'W';
	  }
	  
	  if(points[i] == 315){
		 text = 'NW';
	  }
	  if( text ){
	  	var rotation = points[i] * Math.PI / 180;
	  	
	  	distance = distance+150
	  	
	  	console.log(distance)
	  	
	  	var point = get_compass_point(SelectedDropzone.lonlat, distance, rotation);
	  	
	  	var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
	  	
	  	feature.set('name', 'compasspoint')
	  	  	
	  	var style = CompassPointStyle(text, rotation, 20, -16);
		 	
	  	feature.setStyle(style);
				
	  	CompassFeatures.push(feature);
	  
	  }
   }
	  
}

function CompassPointFeatures2() {   
   var points = [360, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345];
   var features = [];
   
   for(var i = 0; i < points.length; i++){
	  var conversionFactor = GetConversionFactor();
	  var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * (CompassCirclesCount-1))) * conversionFactor;

	  var styles = [];
	  	  
	  var rotation = points[i] * Math.PI / 180;
	  
	  distance = distance-150
	  
	  console.log(distance)
	  
	  var point = get_compass_point(SelectedDropzone.lonlat, distance, rotation);
	  
	  var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
	  
	  feature.set('name', 'compasspoint')
	  
	  var style = CompassPointStyle(JSON.stringify(points[i])+'°', rotation, 20, 16);
	  
	  feature.setStyle(style);
			
	  CompassFeatures.push(feature);
   }
	  
}


function CompassCenterMarkerFeatures(){
   
   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(SelectedDropzone.lonlat)));
   
   var style = CompassCenterMarkerStyle();
   
   feature.setStyle(style);
	
   CompassFeatures.push(feature);
}

function CompassJumprunLineFeatures(){
   
   var conversionFactor = GetConversionFactor();
   var direction = SelectedDropzone.jumprun.direction * Math.PI / 180;   
   var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * (CompassCirclesCount-1))) * conversionFactor;
   var offsetDirection = (SelectedDropzone.jumprun.direction + 90) * (Math.PI / 180);
   var center = get_compass_point(SelectedDropzone.lonlat, SelectedDropzone.jumprun.offset, offsetDirection );
   var point1 = get_compass_point(center, distance, direction );
   var point2 = get_compass_point(center, -distance, direction );
   var line = new ol.geom.LineString([point1, point2])
   
   line.transform('EPSG:4326', 'EPSG:3857');
   
   var feature = new ol.Feature(line);
   var style = CompassJumprunLineStyle();
   
   feature.setStyle(style);
   
   CompassFeatures.push(feature);
}

function CompassJumprunCenterMarkerFeatures(){
   var conversionFactor = GetConversionFactor();
   var direction = SelectedDropzone.jumprun.direction * Math.PI / 180;   
   var distance = (CompassCirclesBaseDistance+ (CompassCirclesInterval * (CompassCirclesCount-1))) * conversionFactor;
   var offsetDirection = (SelectedDropzone.jumprun.direction + 90) * (Math.PI / 180);
   var center = get_compass_point(SelectedDropzone.lonlat, SelectedDropzone.jumprun.offset, offsetDirection );
   
   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(center)));
   
   var style = CompassJumprunCenterMarkerStyle();
   
   feature.setStyle(style);
	
   CompassFeatures.push(feature);
}

function CompassJumprunArrowFeatures(){
   
   for (var i = 0; i < CompassCirclesCount; i++) {
	  var conversionFactor = GetConversionFactor();
	  var direction = SelectedDropzone.jumprun.direction * Math.PI / 180;
	  var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * i)) * conversionFactor;
	  var offsetDirection = (SelectedDropzone.jumprun.direction + 90) * (Math.PI / 180);
	  var center = get_compass_point(SelectedDropzone.lonlat, SelectedDropzone.jumprun.offset, offsetDirection );
	  var point = get_compass_point(center, distance, direction);
	  
	  var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
	  
	  var style = CompassJumprunArrowStyle();
	  
	  feature.setStyle(style);
	  
	  CompassFeatures.push(feature);
	  
	  var point = get_compass_point(center, -distance, direction);
	  
	  var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
	  
	  feature.setStyle(style);
	  
	  CompassFeatures.push(feature);
   }
}

function CompassJumprunGreenLightFeature(){
   var conversionFactor = GetConversionFactor();
   var greenlight = SelectedDropzone.jumprun.greenlight;
   var direction = SelectedDropzone.jumprun.direction * Math.PI / 180;
   var distance = greenlight * conversionFactor;
   var offsetDirection = (SelectedDropzone.jumprun.direction + 90) * (Math.PI / 180);
   var center = get_compass_point(SelectedDropzone.lonlat, SelectedDropzone.jumprun.offset, offsetDirection );
   var point = get_compass_point(center, distance, direction);
	 
   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
   
   var style = CompassJumprunGreenLightStyle(distance);
   
   feature.setStyle(style);
	  
   CompassFeatures.push(feature);
}

function CompassJumprunRedLightFeature(){
   var conversionFactor = GetConversionFactor();
   var direction = SelectedDropzone.jumprun.direction * Math.PI / 180;
   var distance = SelectedDropzone.jumprun.redlight * conversionFactor;
   var offsetDirection = (SelectedDropzone.jumprun.direction + 90) * (Math.PI / 180);
   var center = get_compass_point(SelectedDropzone.lonlat, SelectedDropzone.jumprun.offset, offsetDirection );
   var point = get_compass_point(center, distance, direction);
	 
   var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
   
   var style = CompassJumprunRedLightStyle(distance);
   
   feature.setStyle(style);
	  
   CompassFeatures.push(feature);
}

function CompassWindArrowFeature(){
   
   var conversionFactor = GetConversionFactor();
   var point = SelectedDropzone.lonlat;
   var winds = SelectedDropzone.winds;
   
   var distance = (CompassCirclesBaseDistance + (CompassCirclesInterval * (CompassCirclesCount-1))) * conversionFactor;
   var stroke = "#000000";
   var selected_stroke = ' stroke="black" stroke-width="1px" ';
   
   for(var i = 0; i<winds.length; i++){
	  
	  var point = get_compass_point(SelectedDropzone.lonlat, distance, winds[i].direction * Math.PI / 180);
	  
	  var fill = getAltitudeColor(winds[i].altitude)
	  
	  var feature = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(point)));
	  
	  feature.set('name','windarrow');
	  
	  var style = CompassWindArrowStyle(stroke, fill, selected_stroke, winds[i], distance);

	  feature.setStyle(style);
	  
	  CompassFeatures.push(feature);
   
   }
}

function createCompassFeatures () {
   
   CompassFeatures.clear();
   
   CompassCircleFeatures();
   CompassPointFeatures();
   CompassPointFeatures2();
   CompassCenterMarkerFeatures();
   
   CompassWindArrowFeature();
   
   if(SelectedDropzone.jumprun.direction){
	  
	  CompassJumprunLineFeatures();
	  CompassJumprunCenterMarkerFeatures();
	  CompassJumprunArrowFeatures();
	  
	  if(SelectedDropzone.jumprun.greenlight){
		 
		 CompassJumprunGreenLightFeature();
	  
	  }
	  
	  if(SelectedDropzone.jumprun.redlight){
		 
		 CompassJumprunRedLightFeature();
	  
	  }
				
   }
	  
}

