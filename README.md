# **Esri UK Maps Chrome Extension**

# About

Esri UK Maps is a Chrome Extension that shows you the aerial imagery for a location in the UK when you open a new tab. Built using [Leaflet](https://github.com/Leaflet/Leaflet) and the [Esri Leaflet](https://github.com/Esri/esri-leaflet) plugin.

# Sample
The app has been published to the Chrome Web Store. The listing can be found [here](https://chrome.google.com/webstore/detail/esri-uk-maps/aflbpeobpgdpibcfhkkjhaonbbpkmefg?hl=en-GB).

# Configuring
Start with common.js and the below variables:
- servicerUrl - URL to publicly available ArcGIS polygon feature service of areas of interest
- locationField - Field in the polygon feature service that contains the name of the location
- uniqueIdField - Unique numeric field in the polygon feature service, e.g. ObjectID 
- serviceQuery - Query to restrict locations in the app to a subset of the feature service's content, 1=1 will include everything

# Issues

Find a bug or want to request a new feature? Please let us know by submitting an issue.

# Licensing

Copyright 2016 ESRI (UK) Limited

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the Licence.
