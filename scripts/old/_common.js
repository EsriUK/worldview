    // Geographic globals
var map, overviewMap, locationName, locationPoint, bounds;

// Container for home button status. Initialised as false
var homeButtonPressed = false;
var extentButtonPressed = false;
var shareButtonPressed = false;
var saveButtonPressed = false;
var filterButtonPressed = false; 

// URL to publicly-shared polygon feature service containing areas of interest
var servicerUrl = "http://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/ChromeSuggestionsTest_wgs84/FeatureServer/0";

// URL to user-suggested areas of interest
// ToDo: new, separate service 
var suggestionsService = "http://services.arcgis.com/Qo2anKIAMzIEkIJB/arcgis/rest/services/ChromeSuggestionsTest_wgs84/FeatureServer/0";

/* URL to generalised countries reference service 
var countries = L.esri.featureLayer({
    url: 'http://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0',
});
*/

countriesWithContent = L.esri.featureLayer({
    url: 'http://services.arcgis.com/P3ePLMYs2RVChkJx/ArcGIS/rest/services/World_Countries_(Generalized)/FeatureServer/0/',
    where: "FID > 100"
});

var sfcID = "";

// OIDs of selected filter countries 

var filterCountryIds = []; 

// Field name in feature service containing location name
var locationField = "Location_Name";

// ObjectId field in the feature service; usually OBJECTID or FID
var uniqueIdField = "OBJECTID";

// Query to restrict returned features. If all features are to be displayed it should be "1=1"
var serviceQuery = "1=1";


// Set global storage var from async callback 

function asyncSetter(variable) {
    var sfcID = varible;
    return sfcID;
}


// Restore filter option from Chrome storage 

function restoreOptions() {
    var deferred = $.Deferred();
    chrome.storage.local.get("myFilterCountryId", function (result) {
        var savedFilterCountryId = JSON.stringify(result.myFilterCountryId);
        console.log("getter " + JSON.stringify(result.myFilterCountryId));
        console.log("getter2 " + savedFilterCountryId);
        //return savedFilterCountryId;
        //asyncSetter(savedFilterCountryId);
        sfcID = result.myFilterCountryId;
        console.log("sfcID " + sfcID);
        deferred.resolve(sfcID);
    });
    return deferred.promise();
}


// Function for making CORS requests to ArcGIS Online
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

// Function to randomnly get a location from the feature service
function randomise() {

    // Async call to get country ID 
    restoreOptions().done(function (callback) {
        console.log("sfcID 2 " + callback);

        //ToDo put the rest of randomise() inside here 
    

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
    }); 
}

// Perform a reverse geocode to display address information to the user
// Orig elementClassName = "location-name"
function reverseGeocode(lat, lng, elementClassName) {
    console.log("reverseGeocode");
    var requestUrl = "http://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=json&location=" + lng + "," + lat;
    makeRequest("GET", requestUrl, true, function (resp) {
        // Only update the view to the user if the home button has not been recently pressed.
        // Given the asynchronous nature of the request, without this there could be instances
        // after the home button is pressed that the address information from an
        // earlier map move event is incorrectly displayed.
        console.log("makerequest");
        if (homeButtonPressed == false) {
            console.log("homebutton = false");
            if (!resp.error) {
                var address = resp.address.Address;
                var city = resp.address.City;
                var country = resp.address.CountryCode;
                if (address != null) {
                    document.getElementsByClassName(elementClassName)[0].innerHTML = address + ', ' + city + ', ' + country;
                    console.log("write address");
                } else {
                    document.getElementsByClassName(elementClassName)[0].innerHTML = '';
                }
            } else {
                document.getElementsByClassName(elementClassName)[0].innerHTML = '';
                console.log("else");
            }
        };
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
        // If the current coords are different to the initial coords, perform a reverse geocode to get an address to display in location-name
        if (lat != initialCenter.lat && lng != initialCenter.lng) {
            reverseGeocode(lat, lng, "location-name");
        }
    });
    // Use easyButton Leaflet plugin to display a home button
    L.easyButton('<span class="home"></span>', function () {
        homeButtonPressed = true;
        map.fitBounds(bounds);
        document.getElementsByClassName("location-name")[0].innerHTML = locationName;
        // After three seconds, set the home button pressed status to false.
        // This should be enough time for any reverse geocoding requests made before the button was pressed to return
        setTimeout(function () {
            homeButtonPressed = false;
        }, 3000);
    }).addTo(map);

    // Double-click event for selecting filter by country
    // ToDo: 
    countriesWithContent.on('dblclick', function (e) {
        if (filterButtonPressed == true) {
            countriesWithContent.query().intersects(e.latlng).ids(function (error, ids) {
                console.log(ids[0].toString());
                chrome.storage.local.set({
                    "myFilterCountryId": ids[0].toString()
                });
                console.log("storage " + JSON.stringify(chrome.storage));
                filterCountryIds.push(ids[0]);
                console.log(filterCountryIds);
                map.removeLayer(basemapLayer);
                map.removeLayer(countriesWithContent);
                // delete ids;
                filterButtonPressed = false;
                // filter();
                map.doubleClickZoom.enable();
            });

        }
    });
}

// Update the latitude and longtude values for the user
function updateLatLng(lat, lng) {
    document.getElementsByClassName("location-extent")[0].innerHTML = lat.toFixed(4) + ', ' + lng.toFixed(4);;
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

document.getElementById('details-form-submit-button').addEventListener('click', validateForm, false);

function validateForm() {
    // ToDo: review whether plugin is necessary, update when input schema confirmed 
    $('#details-form').validate({ // initialize the plugin
        rules: {
            placeName: {
                required: true,
                maxlength: 250
            },
            firstName: {
                required: false,
                maxlength: 250
            },
            lastName: {
                required: false,
                maxlength: 250
            },
            email: {
                required: false,
                email: true
            }
        },
        submitHandler: function (form) { // for demo
            alert('valid form submitted'); // for demo
            writeExtent();
            return false; // for demo            
        }
    });
}

// Hide input form 

document.getElementById('details-form-cancel-button').addEventListener('click', hideForm, false);

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

document.getElementById('display-screenshot-div').addEventListener('click', hideSave, false);

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

function writeExtent() {
    // Get variables representing screen dimensions 
    xmin = map.getBounds().getSouthWest().lng;
    xmax = map.getBounds().getNorthEast().lng;
    ymin = map.getBounds().getSouthWest().lat;
    ymax = map.getBounds().getNorthEast().lat;
    // Get form values to pass as attributes
    var placeName = $('#details-form').find('input[name="placeName"]').val()
    var firstName = $('#details-form').find('input[name="firstName"]').val()
    var lastName = $('#details-form').find('input[name="lastName"]').val()
    var email = $('#details-form').find('input[name="email"]').val()
    // Below code uses JQuery/Ajax to create feature 
    // params must be string  for this to work
    params = [{
        "geometry": {
            "hasZ": false,
            "hasM": false,
            "rings": [[
                [10.0, 10.0],
                [10.0, 0.0],
                [0.0, 0.0],
                [0.0, 10.0],
                [10.0, 10.0]
            ]],
            "spatialReference": {
                "wkid": 3857
            }
        },
        "attributes": {
        }
    }];
    postData =
        {
            "f": "json",
            "features": [{
                "geometry": {
                    "hasZ": false,
                    "hasM": false,
                    "rings": [[
                        [xmax, ymax],
                        [xmax, ymin],
                        [xmin, ymin],
                        [xmin, ymax],
                        [xmax, ymax]
                    ]],
                    "spatialReference": {
                        "wkid": 3857
                    }
                },
                "attributes": {
                }
            }]
        };
    postData2 =
        '{"f": "json","features": [{"geometry": {"hasZ": false,"hasM": false,"rings": [[['+xmax+', '+ymax+'],['+xmax+', '+ymin+'],['+xmin+', '+ymin+'],['+xmin+', '+ymax+'],['+xmax+', '+ymax+']]],"spatialReference": {"wkid": 3857}},"attributes": {}}]}';
    // ToDo: make AJAX work or fix leaflet 
    // esri-leaflet.min.js:93 Uncaught TypeError: Cannot read property 'objectIdField' of nullerror 
    $.ajax({
        type: "POST",
        url: suggestionsService + "/addFeatures",
        data: decodeURIComponent($.param(postData.toString())),
        dataType: "json"
    }).done(function () {
        // this is the leaderboard
        // ?? 
    });
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
            "firstName": firstName,
            "lastName": lastName,
            "email": email
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

document.getElementById('share-button').addEventListener('click', shareExtent, false);



function shareExtent() {
    // ToDo: rewrite to remove inline js from html
    console.log("shareExtent()");
    if (shareButtonPressed == true) {
        hideShare();
        return
    }
    shareButtonPressed = true;
    shareUrl = getShareUrl();

    /*
    shareUrlHtml = '<a onClick="copyUrlToClipboard()">Copy</a>';
    viewUrlHTML = '<a href="' + shareUrl + '" target="_blank" onClick="hideShare()">View</a>';
    
    $("#share-view").empty();
    $("#share-copy").empty();

    $("#share-copy").append(shareUrlHtml);
    $("#share-view").append(viewUrlHTML);
    
    $("#share-view").on('click', function () {
        window.location = viewUrl;
    }).show();
    $("#share-copy").show();
    */
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

document.getElementById('save-button').addEventListener('click', saveMapAsImage, false);

function saveMapAsImage() {
    console.log("saveMapAsImage()");
    //saveButtonPressed = true; 
    if (saveButtonPressed == false) {
        $("#display-screenshot-div").show();
        saveButtonPressed = true;
    } else {
        $("#display-screenshot-div").hide();
        saveButtonPressed = false;
    }
    // $("#display-screenshot-div").show();
    // Array to be populated with visible map tile URLs 
    var imgSrcArray = [];
    // Loop through images in relevant div
    $('.leaflet-tile-container.leaflet-zoom-animated img').each(function () {
        // Add the relevant World Imagery tiles (otherwise overview tiles are included)
        // Also filter out images that have been loaded and scrolled past 
        if ($(this).attr('src').includes("World_Imagery") && ($(this).isOnScreen())) {
            imgSrcArray.push($(this).attr('src'));
        }
    });

    // ToDo: Should this be in screenshot.js? 
    getTotalRowAndColResults = getTotalRowAndColFromArray(imgSrcArray);
    maxMinIndexResults = maxMinIndexGetter(getTotalRowAndColResults[1], getTotalRowAndColResults[3]);
    columnAndRowResults = columnAndRowArrays(getTotalRowAndColResults[1], getTotalRowAndColResults[0]);
    parseAndPutResults = parseAndPutInOrder(imgSrcArray, columnAndRowResults[0], columnAndRowResults[1]);
    getViewPortResults = getViewPortTopLeftInFirstTile(parseAndPutResults[0])
    draw4(parseAndPutResults[1], columnAndRowResults[1], parseAndPutResults[0], getViewPortResults[0], getViewPortResults[1]);
};

document.getElementById('show-form').addEventListener('click', showForm, false);

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
    console.log(xycenter);
    reverseGeocode(xycenter.lat, xycenter.lng, "place-name-input");
    $(".details-form-div").show();
};

document.getElementById('filter').addEventListener('click', filter, false);

function filter() {
    console.log("filter()");
    // call functions from filter.js 
    if (filterButtonPressed == false) {
        console.log("if false");
        map.doubleClickZoom.disable();
        basemapLayer = L.esri.basemapLayer('ImageryLabels').addTo(map); 
        // ToDo: Point to own hosted Countries layer, set e.g. where "approvedExtents > 5"  
        countriesWithContent.addTo(map);
        //map.removeLayer('Imagery');
        filterButtonPressed = true;
        
        
    } else {
        //L.esri.basemapLayer('Imagery').addTo(map);
        console.log("if true"); 
        map.doubleClickZoom.enable();
        //L.esri.basemapLayer('ImageryLabels').removeLayer;
        map.removeLayer(basemapLayer);
        map.removeLayer(countriesWithContent);
        filterButtonPressed = false;
        
    }
    
}

//Function call to start the application
randomise();
//restoreOptions();