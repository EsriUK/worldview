// Variables ----------------------------------------------------------------------------------- //
//
// Geographic globals
var map, overviewMap, locationName, locationPoint, bounds, searchControl;

// Container for button press statuses. Initialised as false
var homeButtonPressed = false;

var extentButtonPressed = false;

var shareButtonPressed = false;

var saveButtonPressed = false;

// Global string for reverse geocode results
var currentLocation = "";

// URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "https://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/worldviewlive/FeatureServer/0";

// URL to service where submissions are stored
var suggestionsService = "https://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/worldviewsuggestions/FeatureServer/0";

// Field name in feature service containing location name
var locationField = "Location_Name";

// ObjectId field in the feature service; usually OBJECTID or FID
var uniqueIdField = "OBJECTID";

// Query to restrict returned features. If all features are to be displayed it should be "1=1"
var serviceQuery = "1=1";

// Social sharing text prefix
var shareText = "I found a cool place with maptabs by Esri UK! "


// Functions ----------------------------------------------------------------------------------- //
//
// 1. Map stuff
// 2. Geocoding
// 3. Tools:
//      Open sharing link
//      Create screenshot
//      Add this location
//      (See 2. Geocoding for 'Find somewhere functions')
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
    var queryPart = "/query?geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects&units=esriSRUnit_Meter&outFields=*&returnGeometry=true&outSR=4326&f=json";
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
        var randomFeature = resp.features[Math.floor(Math.random() * resp.features.length)];
        locationName = randomFeature.attributes.Location_Name;
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        //makeRequest("GET", servicerUrl + queryPart + "&returnExtentOnly=true&objectIds=" + randomFeature[uniqueIdField], true, function(resp) {
            createMap(randomFeature.geometry, randomFeature.attributes.Zoom_Level);
        //});
    });
};

// Create initial map
// jQuery
function createMap(centroid, zoomLevel) {

    //var southWest = L.latLng(extent.ymin, extent.xmin);
    //var northEast = L.latLng(extent.ymax, extent.xmax);
    //bounds = L.latLngBounds(southWest, northEast);
    map = L.map('map', {
        center: [centroid.y, centroid.x],
        zoom: zoomLevel
    });
    var layer = L.esri.basemapLayer('Imagery');
    layer.addTo(map)
    initialCenter = map.getCenter();
    var lat = map.getCenter().lat;
    var lng = map.getCenter().lng;
    //Update overview map (see overviewmap.js)
    panTo([lng,lat])
    updateLocationSuggestion();

    // Hide UI elements and update location suggestion on zoom/pan
    map.on("moveend", function(e) {
        $("#name").fadeOut();
        $("#button-group").fadeOut();
        $(".geocoder-control-input").fadeOut();
        $(".geocoder-control-input").fadeOut();
        currentLocation = 'Here be dragons...';
        updateLocationSuggestion();
        var lat = map.getCenter().lat;
        var lng = map.getCenter().lng;
        //Update overview map (see overviewmap.js)
        panTo([lng,lat])
    });

    map._layersMinZoom = 4; // Min zoom to work around screenshot issue

    searchControl = L.esri.Geocoding.geosearch({useMapBounds: false}).addTo(map);

    // create an empty layer group to store the results and add it to the map
    var results = L.layerGroup().addTo(map);

    // listen for the results event and add every result to the map
    searchControl.on("results", function(data) {
        results.clearLayers();
        for (var i = data.results.length - 1; i >= 0; i--) {
            results.addLayer(L.marker(data.results[i].latlng));
        }
    });

    // Reveal button group on hover
    $("#hidden-button-group").mouseenter(
        function() {
            $("#button-group").fadeIn();
            $(".geocoder-control-input").fadeIn();
        }
    );

    $(".geocoder-control-input").mouseenter(
        function() {
            $("#button-group").fadeIn();
            $(".geocoder-control-input").fadeIn();
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




// Catch geocode-form submit event and prevent page refresh
function geocodeFormHandler(e) {

    if (e.preventDefault) e.preventDefault();
    geocode();

    return false;
};

// Perform a geocode to allow user to search locations
// jQuery
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
// jQuery
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
// jQuery
function makeReadable(reverseGeocodeData) {
    // Retrieve individual variables
    var address = reverseGeocodeData[0];
    var city = reverseGeocodeData[1];
    var region = reverseGeocodeData[2];
    var country = reverseGeocodeData[3];
    var worldRegion = reverseGeocodeData[4];

    // Concatenate suggestion based on map zoom level
    if (map._zoom <= 6) {
        locationString = worldRegion;
    } else if (map._zoom > 6 && map._zoom <= 8) {
        locationString = country;
    } else if (map._zoom > 8 && map._zoom <= 11) {
        // avoid duplication (E.g. 'Somewhere in Turkmenistan, Turkmenistan')
        if (region == country) {
            locationString = country;
        } else {
            locationString = region + ', ' + country;
        }
    } else if (map._zoom > 11 && map._zoom <= 15) {
        locationString = city + ', ' + country;
    } else if (map._zoom > 15) {
        // Remove any specific building number from address
        address = address.replace(/[0-9]/g, '') + ', ';
        // If a city is returned, add it to the result
        if (city != "") {
          city = city + ', ';
        }
        // Edge case for very remote areas e.g. himalayan Pakistan
        locationString = address + city + country;
    };

    // Remove any leading/trailing commas or spaces in case logic above fails
    locationString = locationString.replace(/^\s*,+\s*|\s*,+\s*$/g, '');
    // Remove any commas preceded by spaces within the string
    locationString = locationString.replace(/ ,/g, '');

    return locationString;
};

// Store readable location in currentLocation global variable
function updateLocationSuggestion() {
    xycenter = map.getBounds().getCenter();
    reverseGeocode(xycenter.lat, xycenter.lng).done(function(data) {
        data = makeReadable(data);
        currentLocation = data;
    });
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
function shareExtent(e) {
    if (e.preventDefault) e.preventDefault();
    if (shareButtonPressed == true) {
        hideShare();
        return
    }
    shareButtonPressed = true;
    shareUrl = getShareUrl();
    copyTextToClipboard(shareUrl);
    window.open(shareUrl);
    hideShare();
    closeOnClick();
};

// Generate social sharing links

// Twitter
function twitterShare(shareUrl) {
  var baseUrl = "https://twitter.com/intent/tweet?text="
  var params = encodeURIComponent(shareText) + encodeURIComponent(shareUrl);
  var encodedUrl = baseUrl + params;
  // console.log(baseUrl + shareUrl);
  // console.log(encodedUrl);
  document.getElementsByClassName("share-btn twitter")[0].href = encodedUrl;
};

// Facebook
function facebookShare(shareUrl) {
  var baseUrl = "http://www.facebook.com/sharer/sharer.php?u="
  var params = encodeURIComponent(shareText) + encodeURIComponent(shareUrl);
  var encodedUrl = baseUrl + params;
  document.getElementsByClassName("share-btn facebook")[0].href = encodedUrl;
};

// Reddit
function redditShare(shareUrl) {
  var baseUrl = "http://reddit.com/"
  var url = baseUrl + shareUrl;
  document.getElementsByClassName("share-btn reddit")[0].href = url;
};

// linkedin
function linkedinShare(shareUrl) {
  var baseUrl = "http://www.linkedin.com/shareArticle?url="
  var params = encodeURIComponent(shareUrl);
  var encodedUrl = baseUrl + params;
  document.getElementsByClassName("share-btn linkedin")[0].href = encodedUrl;
};


// Creates DOM element and adds text so that it can be copied onclick
function copyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);
    } catch (err) {
        console.log('Oops, unable to copy');
    }

    document.body.removeChild(textArea);
};

// Gets current sharing URL and copies to clipboard
function copyUrlToClipboard(e) {

    if (e.preventDefault) e.preventDefault();
    shareUrl = getShareUrl();
    // window.prompt("Copy to clipboard: Ctrl+C, Enter", shareUrl);
    copyTextToClipboard(shareUrl);
    // hideShare();
    closeOnClick();
    showSnackBar("Link copied to clipboard");
};

function showSnackBar(text) {
    // Get the snackbar DIV
    var x = document.getElementById("snackbar")
    x.value = text;
    // Add the "show" class to DIV
    x.className = "show";

    // After 3 seconds, remove the show class from DIV
    setTimeout(function() {
        x.className = x.className.replace("show", "");
    }, 2400);
};

// 3. Tools:
//      Create screenshot


// Check which img are inView
// http://upshots.org/javascript/jquery-test-if-element-is-in-viewport-visible-on-screen
// jQuery
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
        "geometry": {"x" : xymean.lng, "y" : xymean.lat},
        "attributes": {
            "Location_Name": placeName,
            "Zoom_Level": map.getZoom(),
        }
    }];

    console.log(xymean);

    $.post(url,     {
       f: "json",
       adds: JSON.stringify(json)   
    },     function(data, status) {});

    // Hide form and reset details
    extentButtonPressed = false;
    closeOnClick();
    delete placeName;

    return [xmin, xmax, ymin, ymax];
};

// 4. UI interactions

// Show location suggestion form modal
function showForm() {
    // Click again to close
    // ToDo: auto-set reverse geocode value https://stackoverflow.com/questions/20604299/what-is-innerhtml-on-input-elements
    if (extentButtonPressed == true) {
        hideForm();
        extentButtonPressed = false;
        return;
    };

    extentButtonPressed = true;
    document.getElementById("location").value = currentLocation;
    // $(".details-form-div").show();

    modal.style.display = "block";
    $('#location').focus();
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

// Show location search form modal
// jQuery
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
    // Hide modal border for screenshot
    modalSearch.style.border = "15px solid rgba(0, 0, 0, 0)";
    modalSearch.style.display = "block";
    $('#location-search').focus();
    // modalShare.style.display = "none";
    hideStandardUiElements();
};

// Show share modal
function showShare() {
    // Update social sharing links
    shareUrl = getShareUrl();
    twitterShare(shareUrl);
    facebookShare(shareUrl);
    redditShare(shareUrl);
    linkedinShare(shareUrl);

    modalShare.style.display = "block";
    hideStandardUiElements();
};

// Show all default ui elements
// jQuery
function showStandardUiElements() {
    $("#button-group").fadeIn();
    // $("#name").fadeIn();
    $(".leaflet-bottom").fadeIn();
    $("#hidden-button-group").fadeIn();
    $(".geocoder-control-input").fadeIn();
};

// Hide input form
// jQuery
function hideForm() {
    $(".details-form-div").hide();
    document.getElementById("details-form").reset();
    extentButtonPressed = false;
};

// Hide share form
// jQuery
function hideShare() {
    $(".share-url-div").hide();
    shareButtonPressed = false;
};

// Hide save form
// jQuery
function hideSave() {
    $("#display-screenshot-div").hide();
    showStandardUiElements();
    saveButtonPressed = false;
};

// Hide all default UI elements
// jQuery
function hideStandardUiElements() {
    $("#button-group").fadeOut();
    $(".leaflet-bottom").fadeOut();
    $("#name").fadeOut();
    $("div.sticky:not([id])").fadeOut();
    $("#hidden-button-group").hide();
    $(".geocoder-control-input").fadeOut();
};

// Code for modal - suggestions box interactions

// Get the modal
var modal = document.getElementById('modal');

// Get the modal
var modalSearch = document.getElementById('search-modal');

// // Get modal-content div
// var modalShare = document.getElementById("modalShare");

// Get modal-share div
var modalShare = document.getElementById("share-modal");

// When the user clicks anywhere outside of the modal, close it
// jQuery
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
    modalShare.style.display = "none";
    extentButtonPressed = false;
    // modalShare.style.display = "none";
    showStandardUiElements();
};

function showFAB() {
	$(this).find('button').toggleClass('active');
}

// Event listeners ----------------------------------------------------------------------------- //
//

// Open sharing link
// document.getElementById('share-button').addEventListener('click', shareExtent, false); // opens new window directly

document.getElementById('fixed-action-button').addEventListener('click', showFAB, false);

document.getElementById('share-button').addEventListener('click', showShare, false);
document.getElementById('open-share-button').addEventListener('click', shareExtent, false);
document.getElementById('copy-share-button').addEventListener('click', copyUrlToClipboard, false);

//Download screenshot
document.getElementById('download').addEventListener('click', function(){
    var that = document.getElementById('download2');
    downloadScreenshot(this,that,map,'maptab.jpg'), false
}); // see screenshot.js

// Add this location
document.getElementById('show-form').addEventListener('click', showForm, false);
document.getElementById('details-form').addEventListener('submit', validateForm, false);

// Find somewhere
document.getElementById('geocode-form').addEventListener('submit', geocodeFormHandler, false);

// Close windows with 'X'
document.getElementsByClassName('close')[0].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[1].addEventListener('click', closeOnClick, false);
document.getElementsByClassName('close')[2].addEventListener('click', closeOnClick, false);


// Logic --------------------------------------------------------------------------------------- //
//

// Function call to start the application
randomise();