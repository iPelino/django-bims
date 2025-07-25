define(['backbone', 'underscore', 'jquery'], function (Backbone, _, $) {
    return Backbone.View.extend({
        getVectorTileMapBoxStyle: function (url, styleUrl, layerName, attributions) {
            let tileGrid = ol.tilegrid.createXYZ({tileSize: 512, maxZoom: 14});
            let layer = new ol.layer.VectorTile({
                source: new ol.source.VectorTile({
                    attributions: attributions,
                    format: new ol.format.MVT(),
                    tileGrid: tileGrid,
                    tilePixelRatio: 8,
                    url: url
                })
            });
            if (styleUrl) {
                fetch(styleUrl).then(function (response) {
                    response.json().then(function (glStyle) {
                        // OlMapboxStyle.applyStyle(layer, glStyle, layerName).then(function () {
                        // });
                    });
                });
            }
            return layer;
        },
        getOpenMapTilesTile: function (styleUrl, attributions) {
            if (!attributions) {
                attributions = '© <a href="https://openmaptiles.org/">OpenMapTiles</a> ' +
                    '© <a href="http://www.openstreetmap.org/copyright">' +
                    'OpenStreetMap contributors</a>';
            }
            return this.getVectorTileMapBoxStyle(
                '/bims_proxy/https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=' + mapTilerKey,
                styleUrl,
                'openmaptiles',
                attributions
            );
        },
        getKlokantechTerrainBasemap: function () {
            var attributions = 'Data from <a href="http://www.openstreetmap.org/copyright">' +
                'OpenStreetMap</a> contributors; Tiles &copy; ' +
                '<a href="http://KlokanTech.com">KlokanTech</a>\n';
            var openMapTiles = this.getOpenMapTilesTile('/static/mapbox-style/klokantech-terrain-gl-style.json');
            return new ol.layer.Group({
                title: 'Terrain',
                layers: [openMapTiles,]
            });
        },
        getKartozaBaseMap: function () {
            let layer_NGIOSMPhotos_0 = new ol.layer.Tile({
                title: 'NGIOSMPhotos',
                minZoom: 13,
                maxZoom: 28,
                opacity: 0.75,
                source: new ol.source.XYZ({
                    attributions: ['Data from <a href="http://www.ngi.gov.za/">NGI</a>; tiles from <a href="http://aerial.openstreetmap.org.za">OSM</a>, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'],
                    url: '/bims_proxy/http://c.aerial.openstreetmap.org.za/ngi-aerial/{z}/{x}/{y}.jpg',
                    opacity: 0.75
                })
            });
            let baseMapLayer = new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: '/bims_proxy/https://maps.kartoza.com/geoserver/wms',
                    params: {
                        'layers': 'fbis:fbis_basemap',
                        'uppercase': true,
                        'transparent': true,
                        'continuousWorld': true,
                        'opacity': 1.0,
                        'SRS': 'EPSG:3857',
                        'format': 'image/png'
                    }
                })
            });
            return new ol.layer.Group({
                title: 'Terrain',
                layers: [layer_NGIOSMPhotos_0, baseMapLayer]
            });
        },
        getDarkMatterBasemap: function () {
            var layer = new ol.layer.Tile({
                title: 'Plain B&W',
                source: new ol.source.XYZ({
                    attributions: ['<a id="home-link" target="_top" href="../">Map tiles</a> by ' +
                    '<a target="_top" href="http://stamen.com">Stamen Design</a>, under <a target="_top" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by ' +
                    '<a target="_top" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>'],
                    url: '/bims_proxy/https://tiles.stadiamaps.com/toner/{z}/{x}/{y}.png'
                })
            });
            layer.set('title', 'Plain B&W');
            return layer
        },
        getBaseMaps: function () {
            var baseDefault = null;
            var baseSourceLayers = [];

            // TOPOSHEET MAP
            // var toposheet = new ol.layer.Tile({
            //     title: 'Topography',
            //     source: new ol.source.XYZ({
            //         attributions: ['Data &copy; <a href="http://www.ngi.gov.za/">' +
            //         'National Geospatial Information (NGI)</a>; Tiles from ' +
            //         '<a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'],
            //         url: '/bims_proxy/https://htonl.dev.openstreetmap.org/ngi-tiles/tiles/50k/{z}/{x}/{-y}.png'
            //     })
            // });

            let toposheet = new ol.layer.Tile({
                title: 'Topography',
                type: 'base',
                visible: true,
                source: new ol.source.XYZ({
                    attributions: ['Kartendaten: © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: © <a href="http://opentopomap.org/">OpenTopoMap</a> ' +
                    '<a href="https://creativecommons.org/licenses/by-sa/3.0/">(CC-BY-SA)</a>'],
                    url: '/bims_proxy/https://a.tile.opentopomap.org/{z}/{x}/{y}.png'
                })
            });

            // NGI MAP
            var ngiMap = new ol.layer.Tile({
                title: 'Aerial photography',
                source: new ol.source.XYZ({
                    attributions: ['<a href="http://www.ngi.gov.za/">CD:NGI Aerial</a>'],
                    url: '/bims_proxy/http://aerial.openstreetmap.org.za/ngi-aerial/{z}/{x}/{y}.jpg'
                })
            });

            // add bing
            if (bingMapKey) {
                var bingMap = new ol.layer.Tile({
                    title: 'Bing Satellite Hybrid',
                    source: new ol.source.BingMaps({
                        key: bingMapKey,
                        imagerySet: 'AerialWithLabels'
                    })
                });
                baseSourceLayers.push(bingMap);
            }

            // baseSourceLayers.push(ngiMap);

            // OSM
            let osm = new ol.layer.Tile({
                title: 'OpenStreetMap',
                source: new ol.source.OSM()
            });
            baseSourceLayers.push(osm);

            baseSourceLayers.push(toposheet);
            // baseSourceLayers.push(this.getKartozaBaseMap());

            let defaultLayer = null;
            let defaultLayerIndex = null;

            $.each(baseSourceLayers, function (index, layer) {
                let properties = layer.getProperties();
                let title = properties['title'];
                layer.set('type', 'base');
                layer.set('visible', true);
                layer.set('preload', Infinity);
                if (title === defaultBasemap) {
                    defaultLayer = layer;
                    defaultLayerIndex = index;
                }
            });

            if (defaultLayer) {
                baseSourceLayers.splice(defaultLayerIndex, 1);
                baseSourceLayers.push(defaultLayer);
            }

            let _baseMapLayers = [];
            $.each(baseMapLayers.reverse(), function (index, baseMapData) {
                let _baseMap = null;
                if (baseMapData['source_type'] === "xyz") {
                    _baseMap = new ol.layer.Tile({
                        title: baseMapData['title'],
                        source: new ol.source.XYZ({
                            attributions: [baseMapData['attributions']],
                            url: '/bims_proxy/' + baseMapData['url']
                        })
                    })
                } else if (baseMapData['source_type'] === "bing") {
                    _baseMap = new ol.layer.Tile({
                        title: baseMapData['title'],
                        source: new ol.source.BingMaps({
                            key: baseMapData['key'],
                            imagerySet: 'AerialWithLabels'
                        })
                    });
                } else if (baseMapData['source_type'] === "stamen") {
                    _baseMap = new ol.layer.Tile({
                        title: baseMapData['title'],
                        source: new ol.source.XYZ({
                            attributions: [
                                '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a>',
                                '&copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a>',
                                '&copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a>',
                                '&copy; <a href="https://www.openstreetmap.org/about/" target="_blank">OpenStreetMap contributors</a>'
                            ],
                            url: '/bims_proxy/' + 'https://tiles-eu.stadiamaps.com/tiles/' + baseMapData['layer_name'] + '/{z}/{x}/{y}.jpg?api_key=' + baseMapData['key'],
                            tilePixelRatio: 2,
                            maxZoom: 20
                        })
                    });
                }  else if (baseMapData['source_type'] === "map_tiler") {
                    _baseMap = new ol.layer.Tile({
                        title: baseMapData['title'],
                        source: new ol.source.TileJSON({
                            url: `${baseMapData['url']}?key=${baseMapData['key']}`,
                            tileSize: 512,
                            crossOrigin: 'anonymous'
                          })
                    })
                }
                if (_baseMap) {
                    _baseMap.set('visible', baseMapData['default_basemap']);
                    _baseMap.set('type', 'base');
                    _baseMap.set('preload', Infinity);
                    _baseMapLayers.push(_baseMap);
                }
            });
            if (_baseMapLayers.length === 0) {
                _baseMapLayers.push(
                    new ol.layer.Tile({
                        title: 'OpenStreetMap',
                        type: 'base',
                        visible: true,
                        source: new ol.source.OSM()
                    })
                )
            }
            return _baseMapLayers
        }
    })
});
