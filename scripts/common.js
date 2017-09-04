// Variables ----------------------------------------------------------------------------------- //
//
// Geographic globals
var map, overviewMap, locationName, locationPoint, bounds;

// Container for home button status. Initialised as false
var homeButtonPressed = false;

var extentButtonPressed = false;

var shareButtonPressed = false;

var saveButtonPressed = false;

var currentLocation = "";

// URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "https://utility.arcgis.com/usrsvcs/servers/fd092b1add784ab1abbd84e50f18d841/rest/services/Approvals_Test/FeatureServer/0";

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
    xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            var resp = JSON.parse(this.responseText);
            readyStateHandler(resp);
        }
    }
    xhr.send();
};

// Randomly get a location from the feature service
function randomise() {
    var queryPart = "/query?geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&units=esriSRUnit_Meter&outFields=" + locationField + "%2C+" + uniqueIdField + "&returnGeometry=false&outSR=4326&f=pjson";
    var where;
    // For testing, you can append ?objectID to the app's URL to test specific locations
    var objectID = window.location.search.substring(1).split("&")[0];
    if (objectID == "") {
        where = "&where=" + serviceQuery;
    } else {
        where = "&objectIds=" + objectID;
    }
    var requestUrl = servicerUrl + queryPart + where;
    makeRequest("GET", requestUrl, true, function(resp) {
        var randomFeature = resp.features[Math.floor(Math.random() * resp.features.length)].attributes;
        locationName = randomFeature[locationField];
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        makeRequest("GET", servicerUrl + queryPart + "&returnExtentOnly=true&objectIds=" + randomFeature[uniqueIdField], true, function(resp) {
            createMap(resp.extent);
        });
    });
};

// Perform a geocode to allow user to search locations
function geocode() {
    // var deferred = $.Deferred();
    var searchString = document.getElementById('location-search').value;
    var requestUrl = 'http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates';
    var params = '?SingleLine=' + searchString;
    var concatUrl = requestUrl + params;
    // // load icon?
    // $.ajax(url, {
    //     data: {
    //         text: searchString,
    //         f: 'json',
    //         outSR:102100,
    //         maxlocations:6
    //     },
    //     dataType: 'json',
    //     success: this.geocodeResultsHandler ,
    //     error: this.geocodeError,
    //     complete: this.geocodeComplete
    // });
    // return deferred.promise();

    makeRequest("GET", concatUrl, true, function(resp) {
        // var randomFeature = resp.features[Math.floor(Math.random() * resp.features.length)].attributes;
        // locationName = randomFeature[locationField];
        // document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        // makeRequest("GET", servicerUrl + queryPart + "&returnExtentOnly=true&objectIds=" + randomFeature[uniqueIdField], true, function(resp) {
        //     createMap(resp.extent);
        // });
        // console.log(resp);
    });
};

// Perform a reverse geocode to display address information to the user
// Orig elementClassName = "location-name"
function reverseGeocode(lat, lng, elementId) {
    var deferred = $.Deferred();
    var requestUrl = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=" + lng + "," + lat;
    makeRequest("GET", requestUrl, true, function(resp) {
        // Only update the view to the user if the home button has not been recently pressed.
        // Given the asynchronous nature of the request, without this there could be instances
        // after the home button is pressed that the address information from an
        // earlier map move event is incorrectly displayed.
        if (homeButtonPressed == false) {
            if (!resp.error) {
                console.log("resp:");
                console.log(resp);
                var address = resp.address.Address;
                if (map._zoom <= 15) {
                  address = "";
                }
                if (address == "") {
                  address = "Somewhere in "
                }
                var city = resp.address.City;
                var region = resp.address.Region;
                var country = resp.address.CountryCode;
                country = getNameFromCode(country, worldCountries); // country-codes.js
                console.log("country " + country);
                deferred.resolve([address, city, region, country]);
                if (address != null) {
                    // document.getElementsByClassName(elementClassName)[0].innerHTML = address + ', ' + city + ', ' + country;
                } else {
                    // document.getElementsByClassName(elementClassName)[0].innerHTML = '';
                }
            } else {
                // document.getElementsByClassName(elementClassName)[0].innerHTML = '';
            }
        };
        var suggestionString = "";
        var geocodeResult = [address, city, country];
        return suggestionString;
    });

    return deferred.promise();
};

// Make geocode result into a friendly string
// http://www.toptip.ca/2010/02/javascript-trim-leading-or-trailing.html
function makeReadable(reverseGeocodeData) {
    locationString = reverseGeocodeData.toString();
    // Leading & trailing spaces and commas
    locationString = locationString.replace(/^\s*,+\s*|\s*,+\s*$/g, '');
    // Add space after remaining comma
    locationString = locationString.split(",").join(", ")
    console.log(locationString);
    locationString = locationString.replace(/ ,/g, '');
    console.log(locationString);

    return locationString;
};

// Get country name from 3 letter ISO code
function getCountryName(countryCode) {

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
    updateOverviewMap(lat, lng);
    map.on("moveend", function(e) {
        $("#name").fadeOut();
        $("#button-group").fadeOut();
        xycenter = map.getBounds().getCenter();
        reverseGeocode(xycenter.lat, xycenter.lng).done(function(data) {
            // document.getElementById("location").value = "Somewhere in " + data;
            // console.log("reverseGeocode() data = " + data);
            data = makeReadable(data);
            currentLocation = data;
        });
    });

    map._layersMinZoom = 4; // Workaround screenshot issue

    $("#hidden-button-group").mouseenter(
        function() {
            $("#button-group").fadeIn();
        }
    );
};


// Geocoding test

// // create the geocoding control and add it to the map
// var searchControl = L.esri.Geocoding.geosearch().addTo(map);
//
// // create an empty layer group to store the results and add it to the map
// var results = L.layerGroup().addTo(map);
//
// // listen for the results event and add every result to the map
// searchControl.on("results", function(data) {
//     results.clearLayers();
//     for (var i = data.results.length - 1; i >= 0; i--) {
//         results.addLayer(L.marker(data.results[i].latlng));
//     }
// });

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
            }
        },
        submitHandler: function(form) { // for demo
            // console.log('valid form submitted'); // for demo
            writeExtent();
            return false; // for demo
        }
    });
};

// Hide input form
function hideForm() {
    $(".details-form-div").hide();
    document.getElementById("details-form").reset();
    extentButtonPressed = false;
};

// Hide share form
function hideShare() {
    $(".share-url-div").hide();
    shareButtonPressed = false;
};

// Hide save form
function hideSave() {
    $("#display-screenshot-div").hide();
    showStandardUiElements();
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
};

// Concatenate parameterised URL for sharing
function getShareUrl() {
    bbox = getExtent();
    shareUrl = "http://techresearch.maps.arcgis.com/apps/Minimalist/index.html?appid=80c7439232b64a079c88c64d4f52ce22&extent=" + bbox[0] + "," + bbox[2] + "," + bbox[1] + "," + bbox[3] + ",4326";

    return shareUrl;
};

// Send current extent to suggestions service
// jQuery
function writeExtent() {
    // Get variables representing screen dimensions
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    // Get form values to pass as attributes
    var placeName = $('#details-form').find('input[name="placeName"]').val();

    // Use AJAX to create features
    var url = suggestionsService + "/applyEdits";
    var json = [{
        "geometry": {
            "rings": [
                [
                    [xmax, ymax],
                    [xmax, ymin],
                    [xmin, ymin],
                    [xmin, ymax],
                    [xmax, ymax]
                ]
            ],
            "spatialReference": {
                "wkid": 4326
            }
        },
        "attributes": {
            "Location_Name": placeName
        }
    }];

    $.post(url,     {
        f: "json",
        adds: JSON.stringify(json)   
    },     function(data, status) {        // console.log("Data: " + data + "\nStatus: " + status);
           });

    // Hide form and reset details
    extentButtonPressed = false;
    // hideForm();
    closeOnClick();
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
    copyUrlToClipboard();
    window.open(shareUrl);
};

function copyUrlToClipboard() {
    shareUrl = getShareUrl();
    hideShare();
};

// Check which img are inView
// http://upshots.org/javascript/jquery-test-if-element-is-in-viewport-visible-on-screen
$.fn.isOnScreen = function() {
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

// Make string from geocode results
function locationNameSuggestion(x, y, geocodeCallback) {
    var geocodeResult = geocodeCallback(x, y);
    var suggestionString = "";
    for (i = 0; i < 3; i++) {
        if (geocodeResult[i].length > 0) {
            suggestionString += geocodeResult[i] + " ";
        }
    }

    return;
};

function showForm() {
    // Click again to close
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return;
    }
    extentButtonPressed = true;
    // xycenter = map.getBounds().getCenter();
    // reverseGeocode(xycenter.lat, xycenter.lng).done(function(data) {
    //     document.getElementById("location").value = data;
    // });
    document.getElementById("location").value = currentLocation;
    $(".details-form-div").show();
    modal.style.display = "block";
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

function showSearch() {
    // Click again to close
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return;
    }
    extentButtonPressed = true;
    // xycenter = map.getBounds().getCenter();
    // reverseGeocode(xycenter.lat, xycenter.lng).done(function(data) {
    //     document.getElementById("location").value = "Somewhere in " + data;
    // });
    $(".details-form-div").show();
    modalSearch.style.display = "block";
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

function hideStandardUiElements() {
    $("#button-group").fadeOut();
    $(".leaflet-bottom").fadeOut();
    $("#name").fadeOut();
    $("div.sticky:not([id])").fadeOut();
    $("#hidden-button-group").hide();
};

function showStandardUiElements() {
    $("#button-group").fadeIn();
    // $("#name").fadeIn();
    $(".leaflet-bottom").fadeIn();
    $("#hidden-button-group").fadeIn();
};

// code for modal - suggestions box

// Get the modal
var modal = document.getElementById('modal');

// Get the modal
var modalSearch = document.getElementById('search-modal');

// Get modal-content div
var modalShare = document.getElementById("modalShare");

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
    if (event.target == modal) {
        modal.style.display = "none";
        $("#button-group").show();
        $("#name").show();
    }
    if (event.target == modalShare) {
        modalShare.style.display = "none";
        showStandardUiElements();
    }
};

function closeOnClick() {
    modal.style.display = "none";
    modalSearch.style.display = "none";
    // modalShare.style.display = "none";
    showStandardUiElements();
};

// Event listeners ----------------------------------------------------------------------------- //
//

document.getElementById('share-button').addEventListener('click', shareExtent, false);

document.getElementById('save-button').addEventListener('click', makeScreenshot, false); // see screenshot.js
document.getElementById('display-screenshot-div').addEventListener('click', hideSave, false);

document.getElementById('show-form').addEventListener('click', showForm, false);
document.getElementById('details-form-submit-button').addEventListener('click', validateForm, false);

document.getElementById('search-button').addEventListener('click', showSearch, false);
document.getElementById('geocode-submit-button').addEventListener('click', geocode, false);

document.getElementsByClassName('close')[0].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[1].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[2].addEventListener('click', closeOnClick, false);

// Logic --------------------------------------------------------------------------------------- //
//

// Function call to start the application
randomise();
