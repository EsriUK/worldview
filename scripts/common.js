// Variables ----------------------------------------------------------------------------------- //
//

// Geographic globals
var map, overviewMap, locationName, locationPoint, bounds;

// Container for home button status. Initialised as false
var homeButtonPressed = false;
var extentButtonPressed = false;
var shareButtonPressed = false;
var saveButtonPressed = false;

// URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "http://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/ChromeSuggestionsTest_wgs84/FeatureServer/0";
//URL to current AOIs
//var serviceUrl = "http://services.arcgis.com/WQ9KVmV6xGGMnCiQ/arcgis/rest/services/ChromeExtension/FeatureServer/0";
// URL to user-suggested areas of interest
// ToDo: new, separate service 
var suggestionsService = "http://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/ChromeSuggestionsTest_wgs84/FeatureServer/0";

// Field name in feature service containing location name
var locationField = "Location_Name";

// ObjectId field in the feature service; usually OBJECTID or FID
var uniqueIdField = "OBJECTID";

// Query to restrict returned features. If all features are to be displayed it should be "1=1"
var serviceQuery = "1=1";


// Functions ----------------------------------------------------------------------------------- //
//

// Make CORS requests to ArcGIS Online
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

// Randomly get a location from the feature service
function randomise() {    
    var queryPart = "/query?geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&units=esriSRUnit_Meter&outFields=" + locationField + "%2C+" + uniqueIdField + "&returnGeometry=false&f=pjson";
    var where;
    // For testing, you can append ?objectID to the app's URL to test specific locations
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

// Perform a reverse geocode to display address information to the user
// Orig elementClassName = "location-name"
function reverseGeocode(lat, lng, elementClassName) {
    var requestUrl = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=" + lng + "," + lat;
    makeRequest("GET", requestUrl, true, function (resp) {
        // Only update the view to the user if the home button has not been recently pressed.
        // Given the asynchronous nature of the request, without this there could be instances
        // after the home button is pressed that the address information from an
        // earlier map move event is incorrectly displayed.
        /*if (homeButtonPressed == false) {
            if (!resp.error) {
                var address = resp.address.Address;
                var city = resp.address.City;
                var country = resp.address.CountryCode;
                if (address != null) {
                    document.getElementsByClassName(elementClassName)[0].innerHTML = address + ', ' + city + ', ' + country;
                } else {
                    document.getElementsByClassName(elementClassName)[0].innerHTML = '';
                }
            } else {
                document.getElementsByClassName(elementClassName)[0].innerHTML = '';
            }
        };*/
    });
}

// Create map and overview maps
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
    L.esri.basemapLayer('Imagery').addTo(overviewMap);
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
        // If the current coords are different to the initial coords, perform a reverse geocode to get an address to display in location-name
        if (lat != initialCenter.lat && lng != initialCenter.lng) {
            reverseGeocode(lat, lng, "location-name");
        }
    });
    // Use easyButton Leaflet plugin to display a home button
    /*L.easyButton('<span class="home"></span>', function () {
        homeButtonPressed = true;
        map.fitBounds(bounds);
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        // After three seconds, set the home button pressed status to false.
        // This should be enough time for any reverse geocoding requests made before the button was pressed to return
        setTimeout(function () {
            homeButtonPressed = false;
        }, 3000);
    }).addTo(map);*/
}

// Update the latitude and longtude values for the user
function updateLatLng(lat, lng) {
    document.getElementsByClassName("location-extent")[0].innerHTML = lat.toFixed(4) + ', ' + lng.toFixed(4);
};

// Update the overview map
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

// Validate input from HTML form 
function validateForm() {
    // ToDo: review whether plugin is necessary, update when input schema confirmed 
    $('#details-form').validate({ // initialize the plugin
        rules: {
            placeName: {
                required: true,
                maxlength: 250
            }//,
            //firstName: {
            //    required: false,
            //    maxlength: 250
            //},
            //lastName: {
            //    required: false,
            //    maxlength: 250
            //},
            //email: {
            //    required: false,
            //    email: true
            //}
        },
        submitHandler: function (form) { // for demo
            alert('valid form submitted'); // for demo
            writeExtent();
            return false; // for demo  
            //console.log('success');
        }
    });
}

// Hide input form 
function hideForm() {
    $(".details-form-div").hide();
    document.getElementById("details-form").reset();
    extentButtonPressed = false;
}

// Hide share form
function hideShare() {
    $(".share-url-div").hide();
    shareButtonPressed = false;
};

// Hide save form
function hideSave() {
    $("#display-screenshot-div").hide();
    saveButtonPressed = false;
};

// Get geographic extent of map div on screen
function getExtent() {
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    xymean = map.getCenter();

    return [xmin, xmax, ymin, ymax, xymean];
}

// Concatenate parameterised URL for sharing 
function getShareUrl() {
    bbox = getExtent();
    shareUrl = "http://techresearch.maps.arcgis.com/apps/Minimalist/index.html?appid=80c7439232b64a079c88c64d4f52ce22&extent=" + bbox[0] + "," + bbox[2] + "," + bbox[1] + "," + bbox[3] + ",4326";

    return shareUrl;
};


// Send current extent to suggestions service
// jQuery (?)
function writeExtent() {
    // Get variables representing screen dimensions 
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    // Get form values to pass as attributes
    var placeName = $('#details-form').find('input[name="placeName"]').val()
    //var firstName = $('#details-form').find('input[name="firstName"]').val()
    //var lastName = $('#details-form').find('input[name="lastName"]').val()
    //var email = $('#details-form').find('input[name="email"]').val()
    // Use Esri leaflet to create new features 
    var service = L.esri.featureLayer({
        url: suggestionsService + "/addFeatures"
    });
    var feature = {
        type: 'Feature',
        geometry: {
            "type": "Polygon",
            "coordinates": [
              [[xmax, ymax],
              [xmax, ymin],
              [xmin, ymin],
              [xmin, ymax],
              [xmax, ymax]]
            ]
        },
        // Todo: create form to get relevant details e.g. 
        // Place name 
        // Email address (?)
        // Get country/location based on extent or centroid rather than user input - or do when processing 
        properties: { 
            "Location_Name": placeName,
            "Status": 1,
            "Status_String": "Live",
            //"firstName": firstName
            //"lastName": lastName,
            //"email": email
        }
    };
    service.addFeature(feature, function (error, response) {
        if (error) {
            alert('error creating feature' + error.message);
        } else {
            alert('Successfully created feature with id ' + response.objectId);
        }
    });
    // Hide form and reset details 
    extentButtonPressed = false;
    hideForm();
    delete placeName;

    return [xmin, xmax, ymin, ymax];
};

// Generate sharing URL and reveal HTML linking to/copying it 
function shareExtent() {
    if (shareButtonPressed == true) {
        hideShare();
        return
    }
    shareButtonPressed = true;
    shareUrl = getShareUrl();
    $(".share-url-div").show();
    $("#share-copy").on('click', function () {
        copyUrlToClipboard();
    });
    $("#share-view").on('click', function () {
        window.open(shareUrl);
        hideShare();
    });
};

function copyUrlToClipboard() {
    shareUrl = getShareUrl();
    window.prompt("Copy to clipboard: Ctrl+C, Enter", shareUrl);
    hideShare();
}

// Check which img are inView
// http://upshots.org/javascript/jquery-test-if-element-is-in-viewport-visible-on-screen 
$.fn.isOnScreen = function () {
    var win = $(window);
    var viewport = {
        top: win.scrollTop(),
        left: win.scrollLeft()
    };
    viewport.right = viewport.left + win.width();
    viewport.bottom = viewport.top + win.height();
    var bounds = this.offset();
    bounds.right = bounds.left + this.outerWidth();
    bounds.bottom = bounds.top + this.outerHeight();

    return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));
};

function showForm() {
    // Click again to close 
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements 
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return
    }
    extentButtonPressed = true; 
    xycenter = map.getBounds().getCenter();
    reverseGeocode(xycenter.lat, xycenter.lng, "place-name-input");
    $(".details-form-div").show();
};




        //code for modal - suggestions box

        // Get the modal
        var modal = document.getElementById('modal');

        // Get the button that opens the modal
        var btn = document.getElementById("show-form");

        // Get the button that opens the modal
        var btn2 = document.getElementById("share-button");

        // Get the <span> element that closes the modal
        var span = document.getElementsByClassName("close")[0];

        // When the user clicks on the button, open the modal 
        btn.onclick = function() {
            modal.style.display = "block";
            modalShare.style.display = "none";
            $("#button-group").fadeOut();
            $(".leaflet-control-zoom").fadeOut();
            $(".leaflet-bottom").fadeOut();
            $("#name").fadeOut();
            $("#latLong").fadeOut();
            $("div.sticky:not([id])").fadeOut();
        }
        
        
        // When the user clicks on the button, open the modal 
        btn2.onclick = function() {
            modalShare.style.display = "block";
        }

        // When the user clicks on <span> (x), close the modal
        span.onclick = function() {
            modal.style.display = "none";
            $("#button-group").fadeIn();
            $("#name").fadeIn();
            $("#latLong").fadeIn();
            $(".leaflet-control-zoom").fadeIn();
            $(".leaflet-bottom").fadeIn();
        }

        // When the user clicks anywhere outside of the modal, close it
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
                $("#button-group").show();
                $("#name").show();
                $("#latLong").show();
            }
            if (event.target == modalShare) {
                modalShare.style.display = "none";
            }
        }





// Event listeners ----------------------------------------------------------------------------- //
// 

document.getElementById('show-form').addEventListener('click', showForm, false);
document.getElementById('details-form-submit-button').addEventListener('click', validateForm, false);
//document.getElementById('details-form-cancel-button').addEventListener('click', hideForm, false);
document.getElementById('display-screenshot-div').addEventListener('click', hideSave, false);
document.getElementById('share-button').addEventListener('click', shareExtent, false);
document.getElementById('save-button').addEventListener('click', makeScreenshot, false); // screenshot.js


// Logic --------------------------------------------------------------------------------------- //
// 

// Function call to start the application
randomise();