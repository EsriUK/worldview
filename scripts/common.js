//Geographic globals
var map, overviewMap, locationName, locationPoint, bounds;

//Container for home button status. Initialised as false
var homeButtonPressed = false;

//URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "http://services.arcgis.com/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/ChromeExtension/FeatureServer/0";

//Field name in feature service containing location name
var locationField = "Location_Name";

//ObjectId field in the feature service; usually OBJECTID or FID
var uniqueIdField = "OBJECTID";

//Query to restrict returned features. If all features are to be displayed it should be "1=1"
var serviceQuery = "Editor%3D%27bflanagan_bureau%27+AND+Status%3D1";

//Function for making CORS requests to ArcGIS Online
function makeRequest(method, url, async, readyStateHandler) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url, async);
    xhr.onreadystatechange = function () {
        if (this.readyState == 4 && this.status == 200) {
            var resp = JSON.parse(this.responseText);
            readyStateHandler(resp);
        }
    }
    xhr.send();
}

//Function to randomnly get a location from the feature service
function randomise() {
    var queryPart = "/query?geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&units=esriSRUnit_Meter&outFields=" + locationField + "%2C+" + uniqueIdField + "&returnGeometry=false&f=pjson";
    var where;
    //For testing, you can append ?objectID to the app's URL to test specific locations
    var objectID = window.location.search.substring(1).split("&")[0];
    if (objectID == "") {
        where = "&where=" + serviceQuery;
    }
    else {
        where = "&objectIds=" + objectID;
    }

    var requestUrl = servicerUrl + queryPart + where;

    makeRequest("GET", requestUrl, true, function (resp) {
        var randomFeature = resp.features[Math.floor(Math.random() * resp.features.length)].attributes;
        locationName = randomFeature[locationField];
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        makeRequest("GET", servicerUrl + queryPart + "&returnExtentOnly=true&objectIds=" + randomFeature[uniqueIdField], true, function (resp) {
            createMap(resp.extent);
        });
    });
}

//Perform a reverse geocode to display address information to the user
function reverseGeocode(lat, lng) {
    var requestUrl = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=" + lng + "," + lat;
    makeRequest("GET", requestUrl, true, function (resp) {
        //Only update the view to the user if the home button has not been recently pressed. 
        //Given the asynchronous nature of the request, without this there could be instances 
        //after the home button is pressed that the address information from an 
        //earlier map move event is incorrectly displayed.
        if (homeButtonPressed == false) {
            if (!resp.error) {
                var address = resp.address.Address;
                var city = resp.address.City;
                var country = resp.address.CountryCode;
                if (address != null) {
                    document.getElementsByClassName("location-name")[0].innerHTML = address + ', ' + city + ', ' + country;
                } else {
                    document.getElementsByClassName("location-name")[0].innerHTML = '';
                }
            } else {
                document.getElementsByClassName("location-name")[0].innerHTML = '';
            }
        };
    });
}

//Create map and overview maps
function createMap(extent) {
    var southWest = L.latLng(extent.ymin, extent.xmin);
    var northEast = L.latLng(extent.ymax, extent.xmax);
    bounds = L.latLngBounds(southWest, northEast);
    map = L.map('map', {
        maxZoom: 18
    }).fitBounds(bounds);
    L.esri.basemapLayer('Imagery').addTo(map);
    overviewMap = L.map('overview-map', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchzoom: false,
        boxZoom: false,
        doubleClickZoom: false,
        scrollWheelZoom: false
    }).setView(bounds.getCenter(), 2);
    L.esri.basemapLayer('DarkGray').addTo(overviewMap);
    initialCenter = map.getCenter();
    var lat = map.getCenter().lat;
    var lng = map.getCenter().lng;
    updateLatLng(lat, lng);
    updateOverviewMap(lat, lng);
    map.on("moveend", function () {
        var lat = map.getCenter().lat;
        var lng = map.getCenter().lng;
        updateLatLng(lat, lng);
        updateOverviewMap(lat, lng);
        //If the current coords are different to the initial coords, perform a reverse geocode to get an address to display
        if (lat != initialCenter.lat && lng != initialCenter.lng) {
            reverseGeocode(lat, lng);
        }
    });
    //Use easyButton Leaflet plugin to display a home button
    L.easyButton('<span class="home"></span>', function () {
        homeButtonPressed = true;
        map.fitBounds(bounds);
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        //After three seconds, set the home button pressed status to false. 
        //This should be enough time for any reverse geocoding requests made before the button was pressed to return
        setTimeout(function () {
            homeButtonPressed = false;
        }, 3000);
    }).addTo(map);
}

//Update the latitude and longtude values for the user
function updateLatLng(lat, lng) {
    document.getElementsByClassName("location-extent")[0].innerHTML = lat.toFixed(4) + ', ' + lng.toFixed(4);;
};

//Update the overview map
function updateOverviewMap(lat, lng) {
    if (overviewMap.hasLayer(locationPoint)) {
        overviewMap.removeLayer(locationPoint);
    };
    overviewMap.panTo([lat, lng]);

    locationPoint = L.circle([lat, lng], 100000, {
        fillColor: "transparent",
        weight: 2,
        color: '#fff',
        stroke: true,
        fillOpacity: 0.6,
        clickable: false
    });
    overviewMap.addLayer(locationPoint);
};

//Function call to start the application
randomise();