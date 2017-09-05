// Variables ----------------------------------------------------------------------------------- //
//
// Geographic globals
var map, overviewMap, locationName, locationPoint, bounds;

// Container for button press statuses. Initialised as false
var homeButtonPressed = false;

var extentButtonPressed = false;

var shareButtonPressed = false;

var saveButtonPressed = false;

// Global string for reverse geocode results
var currentLocation = "";

// URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "https://utility.arcgis.com/usrsvcs/servers/fd092b1add784ab1abbd84e50f18d841/rest/services/Approvals_Test/FeatureServer/0";

// URL to service where submissions are stored
var suggestionsService = "http://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/ChromeSuggestionsTest_wgs84/FeatureServer/0";

// Field name in feature service containing location name
var locationField = "Location_Name";

// ObjectId field in the feature service; usually OBJECTID or FID
var uniqueIdField = "OBJECTID";

// Query to restrict returned features. If all features are to be displayed it should be "1=1"
var serviceQuery = "1=1";


// Functions ----------------------------------------------------------------------------------- //
//
// 1. Map stuff
// 2. Geocoding
// 3. Tools:
//      Open sharing link
//      Create screenshot
//      Add this location
//      (See 2. Geocoding for 'Find somewhere')
// 4. UI interactions
//

// 1. Map stuff

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

// Create initial map
function createMap(extent) {
    var southWest = L.latLng(extent.ymin, extent.xmin);
    var northEast = L.latLng(extent.ymax, extent.xmax);
    bounds = L.latLngBounds(southWest, northEast);
    map = L.map('map', {
        maxZoom: 18
    }).fitBounds(bounds);
    L.esri.basemapLayer('Imagery').addTo(map);
    initialCenter = map.getCenter();
    var lat = map.getCenter().lat;
    var lng = map.getCenter().lng;
    map.on("moveend", function(e) {
        $("#name").fadeOut();
        $("#button-group").fadeOut();
        xycenter = map.getBounds().getCenter();
        currentLocation = 'Here be dragons...'
        reverseGeocode(xycenter.lat, xycenter.lng).done(function(data) {
            data = makeReadable(data);
            currentLocation = data;
        });
    });

    map._layersMinZoom = 4; // Min zoom to work around screenshot issue

    // Reveal button group on hover
    $("#hidden-button-group").mouseenter(
        function() {
            $("#button-group").fadeIn();
        }
    );
};

// Get geographic extent of map div on screen
function getExtent() {
    // Get variables representing screen dimensions
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    xymean = map.getCenter();

    return [xmin, xmax, ymin, ymax, xymean];
};

// 2. Geocoding

// Catch geocode-form submit event
function geocodeFormHandler(e) {

    if (e.preventDefault) e.preventDefault();
    geocode();
    return false;
};

// Perform a geocode to allow user to search locations
function geocode() {

    // e.g. https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=spiti,%20india&f=json&maxLocations=1
    var deferred = $.Deferred();

    // Get user input
    var searchString = document.getElementById('location-search').value;
    var encodedSearchString = encodeURI(searchString);

    // Concatenate search URL
    var requestUrlStart = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=';
    var requestUrlEnd = '&f=json&maxLocations=1'; // return first result only
    var params = searchString;
    var concatUrl = requestUrlStart + params + requestUrlEnd;

    // Call geocode service and pan to the extent of the result
    makeRequest("GET", concatUrl, true, function(resp) {
        // Get bounding box from response
        var xmax = resp.candidates[0].extent.xmax;
        var ymax = resp.candidates[0].extent.ymax;
        var xmin = resp.candidates[0].extent.xmin;
        var ymin = resp.candidates[0].extent.ymin;
        // Pan to bounding box
        map.fitBounds([
            [ymin, xmin],
            [ymax, xmax]
        ]);

        closeOnClick();
        deferred.resolve(resp);
    });

    return deferred.promise();
};

// Perform a reverse geocode to display address information to the user
// Orig elementClassName = "location-name"
function reverseGeocode(lat, lng, elementId) {

    var deferred = $.Deferred();
    var requestUrl = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=" + lng + "," + lat;
    makeRequest("GET", requestUrl, true, function(resp) {

        if (!resp.error) {
            var address = resp.address.Address;
            var city = resp.address.City;
            var region = resp.address.Region;
            var country = resp.address.CountryCode;
            var worldRegion = "";
            [country, worldRegion] = getNameFromCode(country, worldCountries); // country-codes.js
            deferred.resolve([address, city, region, country, worldRegion]);
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

    // Retrieve individual variables
    var address = reverseGeocodeData[0];
    var city = reverseGeocodeData[1];
    var region = reverseGeocodeData[2];
    var country = reverseGeocodeData[3];
    var worldRegion = reverseGeocodeData[4];

    // Concatenate suggestion based on map zoom level
    if (map._zoom <= 6) {
        locationString = 'Somewhere in ' + worldRegion;
    } else if (map._zoom > 6 && map._zoom <= 8) {
        locationString = 'Somewhere in ' + country;
    } else if (map._zoom > 8 && map._zoom <= 11) {
        locationString = 'Somewhere in ' + region + ', ' + country;
    } else if (map._zoom > 11 && map._zoom <= 15) {
        locationString = 'Somewhere in ' + city + ', ' + country;
    } else if (map._zoom > 15) {
        // Remove any specific building number from address
        address = address.replace(/[0-9]/g, '');
        locationString = address + ', ' + city + ', ' + country;
    };

    // Remove any leading/trailing commas or spaces in case logic above fails
    locationString = locationString.replace(/^\s*,+\s*|\s*,+\s*$/g, '');
    // Remove any commas preceded by spaces within the string
    locationString = locationString.replace(/ ,/g, '');

    return locationString;
};

// 3. Tools:
//      Open sharing link

// Concatenate parameterised URL for sharing
function getShareUrl() {
    bbox = getExtent();
    shareUrl = "http://techresearch.maps.arcgis.com/apps/Minimalist/index.html?appid=80c7439232b64a079c88c64d4f52ce22&extent=" + bbox[0] + "," + bbox[2] + "," + bbox[1] + "," + bbox[3] + ",4326";

    return shareUrl;
};

// Generate sharing URL and reveal HTML linking to/copying it
function shareExtent() {
    if (shareButtonPressed == true) {
        hideShare();
        return
    }
    shareButtonPressed = true;
    shareUrl = getShareUrl();
    // copyUrlToClipboard();
    window.open(shareUrl);
    hideShare();
};

// 3. Tools:
//      Create screenshot

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

// See also: screenshot.js

// 3. Tools:
//      Add this location

// Validate input from HTML form
function validateForm(e) {
    if (e.preventDefault) e.preventDefault();
    writeExtent();
    return false;
};

// Send current extent to suggestions service
// jQuery
function writeExtent() {
    // Get variables representing screen dimensions
    var [xmin, xmax, ymin, ymax, xymean] = getExtent();
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
    },     function(data, status) {    });

    // Hide form and reset details
    extentButtonPressed = false;
    closeOnClick();
    delete placeName;

    return [xmin, xmax, ymin, ymax];
};

// 4. UI interaction

// Show location suggestion form
function showForm() {
    // Click again to close
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return;
    }
    extentButtonPressed = true;
    document.getElementById("location").value = currentLocation;
    // $(".details-form-div").show();

    modal.style.display = "block";
    $('#location').focus();
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

// Show location search form
function showSearch() {
    // Click again to close
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements
    var suggestions = ["Spiti", "Siem Reap", "Barcelona", "Beijing", "Leh", "Bangkok", "Dehli", "Kuala Lumpur", "Berlin"];
    var random = suggestions[Math.floor(Math.random() * suggestions.length)];
    document.getElementById("location-search").placeholder = "e.g. " + random;
    document.getElementById("location-search").value = "";
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return;
    }
    extentButtonPressed = true;
    //$(".details-form-div").show();

    modalSearch.style.display = "block";
    $('#location-search').focus();
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

// Show all default ui elements
function showStandardUiElements() {
    $("#button-group").fadeIn();
    // $("#name").fadeIn();
    $(".leaflet-bottom").fadeIn();
    $("#hidden-button-group").fadeIn();
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

function hideStandardUiElements() {
    $("#button-group").fadeOut();
    $(".leaflet-bottom").fadeOut();
    $("#name").fadeOut();
    $("div.sticky:not([id])").fadeOut();
    $("#hidden-button-group").hide();
};

// Code for modal - suggestions box interactions

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
    if (event.target == modalSearch) {
        modalSearch.style.display = "none";
        showStandardUiElements();
    }
    if (event.target == modalShare) {
        modalShare.style.display = "none";
        showStandardUiElements();
    }

};

// Close modals
function closeOnClick() {
    modal.style.display = "none";
    modalSearch.style.display = "none";
    // modalShare.style.display = "none";
    showStandardUiElements();
};

// Event listeners ----------------------------------------------------------------------------- //
//

// Open sharing link
document.getElementById('share-button').addEventListener('click', shareExtent, false);

// Create screenshot
document.getElementById('save-button').addEventListener('click', makeScreenshot, false); // see screenshot.js
document.getElementById('display-screenshot-div').addEventListener('click', hideSave, false);

// Add this location
document.getElementById('show-form').addEventListener('click', showForm, false);
document.getElementById('details-form').addEventListener('submit', validateForm, false);

// Find somewhere
document.getElementById('search-button').addEventListener('click', showSearch, false);
document.getElementById('geocode-form').addEventListener('submit', geocodeFormHandler, false);

// Close windows with 'X'
document.getElementsByClassName('close')[0].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[1].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[2].addEventListener('click', closeOnClick, false);

// Logic --------------------------------------------------------------------------------------- //
//

// Function call to start the application
randomise();
