//Variables
var firstClick = true;
var href;

//Function to get screenshot from ArcGIS Online
function getScreenshot(map){
    var deferred = $.Deferred();
    var link = document.getElementById('download');
    var extent = map.getBounds();
    var southWest = extent.getSouthWest();
    var southEast = extent.getSouthEast();
    var northWest = extent.getNorthWest();
    var northEast = extent.getNorthEast();
    var bbox = southWest.lng + "," + southWest.lat + "," + southEast.lng + "," + northEast.lat;
    var exportUrl = "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=" + bbox + "&bboxSR=4326&layers=&layerDefs=&size=1920%2C1080&imageSR=&format=png&transparent=false&dpi=&time=&layerTimeOptions=&dynamicLayers=&gdbVersion=&mapScale=&f=json"
    makeRequest("GET", exportUrl, true, function(resp) {
        deferred.resolve(resp.href)
    });
    return deferred.promise();
}

//Function to download screenshot
function downloadScreenshot(link,link2,map,filename){
    if(firstClick == true){
        firstClick = false;        
        getScreenshot(map).done(function(response){
            href = response;
            link2.href = href;
            link2.download = filename;   
            link.click();            
        })
    }
    else{
        link2.click();                    
        firstClick = true; 
    }
}