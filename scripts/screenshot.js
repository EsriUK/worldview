// Identify the visible tiles and merge them into a single image

// Functions ----------------------------------------------------------------------------------- //
//

// Return array of all tiles visible in viewport
// jQuery
function getTileUrls() {
    var tiles = [];
    // Loop through images in relevant div
    $('.leaflet-tile-container.leaflet-zoom-animated img').each(function() {
        // Add the relevant World Imagery tiles (otherwise overview tiles are included)
        // Also filter out images that have been loaded and scrolled past
        if ($(this).attr('src').includes("World_Imagery") && ($(this).isOnScreen())) {
            tiles.push($(this).attr('src'));
        }
    });
    // tiles.splice(0, 1); // First tile is at the wrong scale level ToDo find out why
    // resolved following several edits on 05/09

    return tiles;
};

// Parse row and column data from individual URLs
function getRowAndColFromUrl(url) {
    splitUrl = url.split("/");
    colVal = splitUrl[splitUrl.length - 1];
    rowVal = splitUrl[splitUrl.length - 2];

    return [colVal, rowVal];
};

// Create array of x-indices for every map tile on screen
function getXArray(tiles) {
    var xArray = [];
    // Iterate through file URLs and parse column values
    for (i = 0; i < tiles.length; i++) {
        [colVal, rowVal] = getRowAndColFromUrl(tiles[i]);
        xArray.push(parseInt(colVal));
    }

    return xArray;
};

// Create array of y-indices for every map tile on screen
function getYArray(tiles) {
    var yArray = [];
    // Iterate through file URLs and parse row values
    for (i = 0; i < tiles.length; i++) {
        [colVal, rowVal] = getRowAndColFromUrl(tiles[i]);
        yArray.push(parseInt(rowVal));
    }

    return yArray;
};

// Function to filter duplicate values and order array
function filterAndOrderArray(array) {
    var unique = array.filter(function(elem, index, self) {
        return index == self.indexOf(elem);
    });
    uniqueSorted = unique.sort(function(a, b) {
        return a - b;
    });

    return uniqueSorted;
};

// Get total number of columns on screen
function getNumCols(xArray) {
    var numOfCols = filterAndOrderArray(xArray).length;

    return numOfCols;
};

// Get total number of rows on screen
function getNumRows(yArray) {
    var numOfRows = Math.max.apply(null, yArray) - Math.min.apply(null, yArray) + 1;

    return numOfRows;
};

// Re-order non continuous array
function reOrderNonContinuousArray(array, start) {
    reOrderedNonContinuousArray = [];
    beginning = array.slice(array.indexOf(start));
    end = array.slice(0, array.indexOf(start));
    for (i = 0; i < beginning.length; i++) {
        reOrderedNonContinuousArray.push(beginning[i]);
    }
    for (i = 0; i < end.length; i++) {
        reOrderedNonContinuousArray.push(end[i]);
    }

    return reOrderedNonContinuousArray;
};

// Get max and min row index, and adjust when crossing dateline
function maxMinIndexGetter(rowNumberArray, numOfRows) {
    // if a 0 is present in the row indexes, enumerate up from 0 until an
    // iteration greater than 1 is found. e.g. [0, 1, 2, 4, 5, 6] becomes
    // [4, 5, 6, 0, 1, 2] key nums are 4 (start), 2 (end) and dif(2, end)
    maxRowIndex = Math.max.apply(null, rowNumberArray);
    minRowIndex = Math.min.apply(null, rowNumberArray);
    rowIndexRange = maxRowIndex - minRowIndex + 1;
    uniqueSorted = filterAndOrderArray(rowNumberArray);
    uniqueReOrdered = null;
    if (rowIndexRange == numOfRows) {
        var startRowIndex = minRowIndex;
        var stopRowIndex = maxRowIndex;
    } else {
        // remove duplicate numbers from array
        // iterate from 0 until step is > 1 - this gives max and min value
        start = parseInt(uniqueSorted[0]);
        for (i = 0; i < uniqueSorted.length; i++) {
            if (uniqueSorted[i] == start) {
                // Pass first iteration
            } else if (uniqueSorted[i] == (start + 1)) {
                // Update start variable if difference == 1
                start = uniqueSorted[i];
            } else {
                // call reOrder.. if difference > 1
                uniqueReOrdered = reOrderNonContinuousArray(uniqueSorted, uniqueSorted[i]);
                break;
            }
        }
        startRowIndex = uniqueReOrdered[0];
        stopRowIndex = uniqueReOrdered[uniqueReOrdered.length - 1]; // placeholder
    }

    return [startRowIndex, stopRowIndex, uniqueSorted, uniqueReOrdered];
};

// Create empty array with appropriate dimensions - to be filled with img src
function orderedArrayMaker(numOfCols, numOfRows) {
    var masterArray = [];
    subArray = [];
    for (j = 0; j < numOfRows; j++) {
        subArray[j] = "";
    }
    for (i = 0; i < numOfCols; i++) {
        masterArray[i] = subArray;
    }

    return masterArray;
};

// Parse row and col number from each url, and place in appropriate location in array
function parseAndPutInOrder(imgSrcArray, xArray, reOrderedColArray, sortedRowArray) {
    orderedArray = [];
    if (reOrderedColArray == null) {
        reOrderedColArray = filterAndOrderArray(xArray);
    };
    for (j = 0; j < reOrderedColArray.length; j++) {
        orderedArray.push([]);
    }
    for (i = 0; i < imgSrcArray.length; i++) {
        rowAndCol = getRowAndColFromUrl(imgSrcArray[i]);
        colVal = rowAndCol[0];
        rowVal = rowAndCol[1];
        masterColIndex = reOrderedColArray.indexOf(parseInt(colVal));
        masterRowIndex = sortedRowArray.indexOf(parseInt(rowVal));
        orderedArray[masterColIndex][masterRowIndex] = imgSrcArray[i];
    }

    return [orderedArray, reOrderedColArray];
};

// Get coordinate of viewport top left in first tile
// jQuery
function getViewportOffset(orderedArray) {
    // This can be used to clip the canvas to get the exact viewport
    // Clip can be a final stage, or achieved when defining canvas
    // dimensions (i.e. screen.width x screen.height) and x y location of
    // map tile imgs
    // http://stackoverflow.com/questions/17067061/calculate-div-overlap-area-and-position
    // http://stackoverflow.com/questions/27146403/efficiently-get-an-elements-visible-area-coordinates
    // http://stackoverflow.com/questions/1960082/position-of-div-in-relation-to-the-top-of-the-viewport
    var img = new Image();
    img.onload = function() {};
    var x = $("img[src$='" + orderedArray[0][0] + "']");
    var pos = x.position();
    var allImages = document.getElementsByTagName("img");
    var target;
    for (var i = 0, max = allImages.length; i < max; i++)
        if (allImages[i].src === orderedArray[0][0]) {
            target = allImages[i];
            var rect = target.getBoundingClientRect();
            var leftOffset = rect.left;
            var topOffset = rect.top;
            break;
        }

    return [leftOffset, topOffset];
};

function drawScreenShot(normalisedTileArray, viewportOffset) {
    var deferred = $.Deferred();
    // Normalised tile data
    var orderedArray = normalisedTileArray[0][0];
    var reOrderedColArray = normalisedTileArray[0][1];
    var sortedRowArray = normalisedTileArray[1];
    // Viewport offset values
    var leftOffset = viewportOffset[0];
    var topOffset = viewportOffset[1];
    var parsedLeftOffset = parseInt(leftOffset);
    var parsedTopOffset = parseInt(topOffset);
    // HTML canvas element handler
    var canvas = document.getElementById("canvas");
    var context = canvas.getContext("2d");
    // Map tile dimensions
    mapTilePixels = 256; // Should be dynamic
    context.canvas.width = screen.width;
    context.canvas.height = screen.height;
    // Create blank canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Iterate normalised TileArray and arrange images on canvas
    for (var i = 0; i < reOrderedColArray.length; i++) {
        for (var j = 0; j < sortedRowArray.length; j++) {
            var offsetX = (i * mapTilePixels) + parsedLeftOffset;
            var offsetY = (j * mapTilePixels) + (parsedTopOffset / 2);
            imageToBase64(orderedArray[i][j],offsetX,offsetY, function(result, resultX,resultY){
                var imageObj = new Image();
                imageObj.src = result; // << added
                imageObj.onload = function() {
                    context.drawImage(imageObj,resultX, resultY);
                };
            })
            
        }
    }
    deferred.resolve();
    
    reOrderedColArray = [];
    sortedRowArray = [];
    orderedArray = [];
    return deferred.promise();
};

var imageToBase64 = function(url, offsetX, offsetY, callback){
    var xhr = new XMLHttpRequest();
    xhr.onload = function () {
        var reader = new FileReader();
        reader.onloadend = function () {
            callback(reader.result,offsetX,offsetY);
        }
        reader.readAsDataURL(xhr.response);
    };
    xhr.open('GET', url);
    xhr.onreadystatechange = function () {  
        if (xhr.readyState === 4) {  
            if (xhr.status != 200) { 
                callback("error");   
            }  
        }  
    }; 
    xhr.responseType = 'blob';
    xhr.send();
}


// Logic --------------------------------------------------------------------------------------- //

// Get drawing positions from tile URLs, check for date line special case
function normaliseDateLine(tiles) {
    // Get dimensions and x, y indices of all visible map tiles
    var xArray = getXArray(tiles);
    var yArray = getYArray(tiles);
    var numCols = getNumCols(xArray);
    var numRows = getNumRows(yArray);

    // Sort x, y indices into final drawing order
    var reOrderedColArray = maxMinIndexGetter(xArray, numCols)[3];
    var sortedRowArray = maxMinIndexGetter(yArray, numRows)[2];
    var ordered2dArray = parseAndPutInOrder(tiles, xArray, reOrderedColArray, sortedRowArray);

    return [ordered2dArray, sortedRowArray];
};

// Gets URLs of all visible map tiles and draws them to a single canvas element
// jQuery
function makeScreenshot() {

    // Toggle button visibility
    //hideStandardUiElements();
    if (saveButtonPressed == false) {
        //$("#display-screenshot-div").fadeIn();
        saveButtonPressed = true;
    } else {
        //$("#display-screenshot-div").fadeOut();
        saveButtonPressed = false;
    }

    // Array of visible map tile URLs
    var tiles = getTileUrls();

    // Parse tile location data and applies correction if viewport crosses the date line
    var normalisedTileArray = normaliseDateLine(tiles);

    // Measures distance between top left corner of viewport, and top left corner of top left tile
    var viewportOffset = getViewportOffset(orderedArray);

    // Fill canvas with tile images and reveal it
    drawScreenShot(normalisedTileArray, viewportOffset);
};

function makeScreenshot2(link,canvasId,filename){
    link.download = filename;
    
    link.href = document.getElementById(canvasId).toDataURL('image/jpeg', 0.75);
    console.log(link)
}