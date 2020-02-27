var map, overviewMap, Location_Name, locationPoint, bounds, searchControl;
var currentLocation			= "";
var masterServiceEndpoint	= "https://services.arcgis.com/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/WorldviewMaster/FeatureServer/0";
var editableServiceEndpoint	= 'https://services.arcgis.com/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/WorldviewEditable/FeatureServer/0';
var reportServiceEndpoint	= 'https://services.arcgis.com/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/WorldviewReported/FeatureServer/0';
var serviceQuery			= "Status='Approved'";
var existing;

var loadedObj;

function makeRequest(method, url, async, readyStateHandler) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, async);
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var resp = JSON.parse(this.responseText);
            readyStateHandler(resp);
        }
    }
    xhr.send();
};

function init() {

    var query = "/query?geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&units=esriSRUnit_Meter&outFields=*&outSR=4326&returnGeometry=true&f=json";
    var where = "&where=" + serviceQuery;

    var requestUrl = masterServiceEndpoint + query + where;
   
	makeRequest("GET", requestUrl, true, function(resp) {

		var randomFeature = resp.features[Math.floor(Math.random() * resp.features.length)];

		loadedObj = randomFeature;

		Location_Name = randomFeature.attributes.Location_Name;
		document.getElementsByClassName("location-name")[0].innerHTML = Location_Name;
		createMap(randomFeature.geometry, randomFeature.attributes.Zoom_Level);

    });

};

function createMap(centroid, Zoom_Level) {

	map = L.map('map', {
		center: [centroid.y, centroid.x],
		zoom: Zoom_Level,
		inertia: true,
		inertiaMaxSpeed: 1000
	});

	var layer = L.esri.basemapLayer('Imagery');
	layer.addTo(map);
	
	initialCenter = map.getCenter();
    
	var lat = map.getCenter().lat;
    var lng = map.getCenter().lng;
    
	panTo([lng,lat]);

	var omni = document.getElementById("omnibox-container");

    map.on("moveend", function(e) {
		
		var elem = document.getElementById("name");
		requestAnimationFrame(() => elem.style.opacity = 0);

		var br = document.getElementById("brand");
		br.classList.add('low');

		var mv = document.getElementById("map-viewer");
		mv.classList.add('low');

		var rp = document.getElementById("map-reporter");
		rp.classList.add('low');

	    var omni = document.getElementById("omnibox-container");
		requestAnimationFrame(() => omni.style.opacity = 1);

		var lat = map.getCenter().lat;
        var lng = map.getCenter().lng;
        //Update overview map (see overviewmap.js)
        panTo([lng,lat])

    });

    map._layersMinZoom = 4;

};

function getExtent() {
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    xymean = map.getCenter();

    return [xmin, xmax, ymin, ymax, xymean];
};

function openMapViewer() {

	var center	= map.getCenter();
	var zoom	= map.getZoom();
	var url = 'https://www.arcgis.com/apps/mapviewer/index.html?center=' + center.lng + ',' +center.lat + '&level=' + zoom + '&basemapUrl=https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'

	var win = window.open(url, '_blank');
	win.focus();
}

function openMapReporter() {

	toastr.clear();

	toastr.options = {
		"positionClass": "toast-top-right",
		"timeOut": "5000",
		"extendedTimeOut": "1000",
		"showEasing": "swing",
		"hideEasing": "linear",
		"showMethod": "fadeIn",
		"hideMethod": "fadeOut"
	}

	loadedObj.attributes.Reported = 1;

	var url = reportServiceEndpoint + "/applyEdits";

    var payload = '[' + JSON.stringify(loadedObj) + ']';
    
	$.post(url, {
        f: "json",
        updates: payload
    }, function(data, status) {
		var d = JSON.parse(data);
		if(d.updateResults[0].success) {
			toastr["info"]("Location successfully reported")
		} else {
			toastr["error"]("Oh no... Something went wrong")
		};
	});
	
}

function validateForm(e) {
    if (e.preventDefault) e.preventDefault();
    writeExtent();
    return false;
};

function writeExtent() {

	const search	= document.getElementById('searchbox-searchbutton');
	const clear		= document.getElementById('searchbox-searchclear');
	const input		= document.querySelector('input');

	clear.style.opacity = 0;

	search.disabled		= true;
	input.dataset.state = 'invalid';
	
	toastr.clear();
	
	var [xmin, xmax, ymin, ymax, xymean] = getExtent();

    var placeName = $('#details-form').find('input[name="placeName"]').val();

	placeName = decodeURIComponent(placeName);

    var url = editableServiceEndpoint + "/applyEdits";
    var json = [{
        "geometry": {"x" : xymean.lng, "y" : xymean.lat},
        "attributes": {
            "Location_Name": placeName,
            "Zoom_Level": map.getZoom()
        }
    }];

	toastr.options = {
		"positionClass": "toast-top-left",
		"timeOut": "5000",
		"extendedTimeOut": "1000",
		"showEasing": "swing",
		"hideEasing": "linear",
		"showMethod": "fadeIn",
		"hideMethod": "fadeOut"
	}
    
	$.post(url, {
        f: "json",
        adds: JSON.stringify(json)   
    }, function(data, status) {

		var d = JSON.parse(data);
			
		if(d.addResults[0].success) {
			$('#details-form').find('input[name="placeName"]').val('');
			toastr["info"]("Location successfully added")
		} else {
			$('#details-form').find('input[name="placeName"]').val('');	
			toastr["error"]("Oh no... Something went wrong")
		};
		
	});

    return [xmin, xmax, ymin, ymax];

};

document.getElementById('details-form').addEventListener('submit', validateForm, false);
document.getElementById('map-viewer').addEventListener('click', openMapViewer, false);
document.getElementById('map-reporter').addEventListener('click', openMapReporter, false);

const input		= document.querySelector('input');
const clear		= document.getElementById('searchbox-searchclear');
const search	= document.getElementById('searchbox-searchbutton');

clear.addEventListener('click', evt => {
	input.value = '';
	input.dataset.state = 'invalid';
	clear.style.opacity = 0;
	toastr.clear();
});

input.addEventListener('input', evt => {

	const value = input.value

	if (!value) {
		input.dataset.state = ''
		return
	}

	const trimmed = value.trim();

	if (trimmed) {
		search.disabled = false;
		input.dataset.state = 'valid';
	} else {
		input.dataset.state = 'invalid';
	}
})

// Init
init();