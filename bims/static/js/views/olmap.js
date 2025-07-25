define([
    'backbone',
    'underscore',
    'shared',
    'collections/location_site',
    'collections/cluster',
    'collections/cluster_biological',
    'views/map_control_panel',
    'views/side_panel',
    'jquery',
    'layerSwitcher',
    'views/olmap_basemap',
    'views/olmap_layers',
    'views/geocontext',
    'views/right_panel/location_site_detail',
    'views/right_panel/taxon_detail',
    'views/right_panel/records_detail',
    'views/right_panel/multiple_location_sites_details',
    'views/bug_report',
    'views/wetland_mapping_feedback',
    'views/detail_dashboard/taxon_detail',
    'views/detail_dashboard/site_detail',
    'htmlToCanvas',
    'jspdf'
], function (Backbone, _, Shared, LocationSiteCollection, ClusterCollection,
             ClusterBiologicalCollection, MapControlPanelView, SidePanelView,
             $, LayerSwitcher, Basemap, Layers, Geocontext,
             LocationSiteDetail, TaxonDetail, RecordsDetail, MultipleLocationSitesDetail,
             BugReportView, WetlandMappingFeedbackView,
             TaxonDetailDashboard, SiteDetailedDashboard, HtmlToCanvas, jsPDF) {
    return Backbone.View.extend({
        template: _.template($('#map-template').html()),
        className: 'map-wrapper',
        map: null,
        uploadDataState: false,
        isBoundaryEnabled: false,
        // attributes
        mapInteractionEnabled: false,
        previousZoom: 0,
        sidePanelView: null,
        initZoom: 8,
        numInFlightTiles: 0,
        scaleLineControl: null,
        mapIsReady: false,
        polygonDrawn: false,
        feedbackMarker: null,
        feedbackLayer: null,
        resizingLegend: false,
        mapLegendInitialized: false,
        addWetlandMappingIssueActive: false,
        lastLegendWidth: null,
        lastLegendHeight: null,
        initCenter: [22.948492328125, -31.12543669218031],
        apiParameters: _.template(Shared.SearchURLParametersTemplate),
        events: {
            'click .zoom-in': 'zoomInMap',
            'click .zoom-out': 'zoomOutMap',
            'click .layer-control': 'layerControlClicked',
            'click #map-legend-wrapper': 'mapLegendClicked',
            // 'click .print-map-control': 'downloadMap',
            'click #start-tutorial': 'startTutorial',
        },
        clusterLevel: {
            5: 'country',
            7: 'province',
            8: 'district',
            9: 'municipal'
        }, // note that this is the max level for cluster level
        initialize: function () {
            if (defaultCenterMap) {
                this.initCenter = [];
                let center = defaultCenterMap.split(',');
                for (let d=0; d<center.length; d++) {
                    this.initCenter.push(parseFloat(center[d]));
                }
            }
            // Ensure methods keep the `this` references to the view itself
            _.bindAll(this, 'render');
            this.layers = new Layers({parent: this});
            this.locationSiteCollection = new LocationSiteCollection();
            this.clusterCollection = new ClusterCollection();
            this.geocontext = new Geocontext();
            new LocationSiteDetail();
            new TaxonDetail();
            new RecordsDetail();
            new MultipleLocationSitesDetail();
            this.taxonDetailDashboard = new TaxonDetailDashboard();
            this.siteDetailedDashboard = new SiteDetailedDashboard({parent: this});

            Shared.CurrentState.FETCH_CLUSTERS = true;

            Shared.Dispatcher.on('map:addBiodiversityFeatures', this.addBiodiversityFeatures, this);
            Shared.Dispatcher.on('map:addLocationSiteClusterFeatures', this.addLocationSiteClusterFeatures, this);
            Shared.Dispatcher.on('map:zoomToCoordinates', this.zoomToCoordinates, this);
            Shared.Dispatcher.on('map:drawPoint', this.drawPoint, this);
            Shared.Dispatcher.on('map:clearPoint', this.clearPoint, this);
            Shared.Dispatcher.on('map:zoomToExtent', this.zoomToExtent, this);
            Shared.Dispatcher.on('map:reloadXHR', this.reloadXHR, this);
            Shared.Dispatcher.on('map:showPopup', this.showPopup, this);
            Shared.Dispatcher.on('map:closePopup', this.hidePopup, this);
            Shared.Dispatcher.on('map:closeHighlight', this.closeHighlight, this);
            Shared.Dispatcher.on('map:addHighlightFeature', this.addHighlightFeature, this);
            Shared.Dispatcher.on('map:switchHighlight', this.switchHighlight, this);
            Shared.Dispatcher.on('map:addHighlightPinnedFeature', this.addHighlightPinnedFeature, this);
            Shared.Dispatcher.on('map:removeHighlightPinnedFeature', this.removeHighlightPinnedFeature, this);
            Shared.Dispatcher.on('map:switchHighlightPinned', this.switchHighlightPinned, this);
            Shared.Dispatcher.on('map:closeHighlightPinned', this.closeHighlightPinned, this);
            Shared.Dispatcher.on('map:zoomToHighlightPinnedFeatures', this.zoomToHighlightPinnedFeatures, this);
            Shared.Dispatcher.on('map:boundaryEnabled', this.boundaryEnabled, this);
            Shared.Dispatcher.on('map:zoomToDefault', this.zoomToDefault, this);
            Shared.Dispatcher.on('map:clearAllLayers', this.clearAllLayers, this);
            Shared.Dispatcher.on('map:addLayer', this.addLayer, this);
            Shared.Dispatcher.on('map:removeLayer', this.removeLayer, this);
            Shared.Dispatcher.on('map:updateBiodiversityLayerParams', this.updateBiodiversityLayerParams, this);
            Shared.Dispatcher.on('map:updateClusterBiologicalCollectionTaxon', this.updateClusterBiologicalCollectionTaxonID, this);

            Shared.Dispatcher.on('map:showMapLegends', this.showMapLegends, this);
            Shared.Dispatcher.on('map:showTaxonDetailedDashboard', this.showTaxonDetailedDashboard, this);
            Shared.Dispatcher.on('map:showSiteDetailedDashboard', this.showSiteDetailedDashboard, this);
            Shared.Dispatcher.on('map:closeDetailedDashboard', this.closeDetailedDashboard, this);
            Shared.Dispatcher.on('map:downloadMap', this.downloadMap, this);
            Shared.Dispatcher.on('map:resetSitesLayer', this.resetSitesLayer, this);
            Shared.Dispatcher.on('map:toggleMapInteraction', this.toggleMapInteraction, this);
            Shared.Dispatcher.on('map:setPolygonDrawn', this.setPolygonDrawn, this);

            Shared.Dispatcher.on('wetlandFeedback:togglePanel', this.toggleWetlandFeedback, this);

            this.render();
            this.clusterBiologicalCollection = new ClusterBiologicalCollection(this);
            this.mapControlPanel.searchView.initDateFilter();
            this.showInfoPopup();

            this.pointVectorSource = new ol.source.Vector({});
            this.pointLayer = new ol.layer.Vector({
                source: this.pointVectorSource,
                style: [
                    new ol.style.Style({
                        stroke: new ol.style.Stroke({
                            color: 'blue',
                            width: 3
                        }),
                        fill: new ol.style.Fill({
                            color: 'rgba(0, 0, 255, 0.1)'
                        })
                    })]
            });
            this.pointLayer.setZIndex(1000);
            this.map.addLayer(this.pointLayer);
        },
        toggleWetlandFeedback: function () {
            if (!is_logged_in) {
                return;
            }
            this.addWetlandMappingIssueActive = !this.addWetlandMappingIssueActive;
            if (!this.addWetlandMappingIssueActive) {
                // Remove the marker
                if (this.feedbackLayer && this.map) {
                    this.map.removeLayer(this.feedbackLayer);
                    this.feedbackLayer = null;
                    this.feedbackMarker = null;
                }
            }
        },
        zoomInMap: function (e) {
            var view = this.map.getView();
            var zoom = view.getZoom();
            view.animate({
                zoom: zoom - 1,
                duration: 250
            })
        },
        boundaryEnabled: function (value) {
            this.isBoundaryEnabled = value;
        },
        zoomOutMap: function (e) {
            var view = this.map.getView();
            var zoom = view.getZoom();
            view.animate({
                zoom: zoom + 1,
                duration: 250
            })
        },
        zoomToCoordinates: function (coordinates, zoomLevel) {
            this.previousZoom = this.getCurrentZoom();
            this.map.getView().setCenter(coordinates);
            if (typeof zoomLevel !== 'undefined') {
                this.map.getView().setZoom(zoomLevel);
            }
        },
        drawPoint: function (coordinates, zoomLevel) {
            this.zoomToCoordinates(coordinates, zoomLevel);
            var circle = new ol.geom.Circle(coordinates, 1000);
            var circleFeature = new ol.Feature(circle);
            this.pointVectorSource.addFeature(circleFeature);
        },
        clearPoint: function () {
            this.pointVectorSource.clear();
        },
        zoomToExtent: function (coordinates, shouldTransform=true, updateZoom=true) {
            if (this.isBoundaryEnabled) {
                this.fetchingRecords();
                return false;
            }
            this.previousZoom = this.getCurrentZoom();
            let ext = coordinates;
            if (shouldTransform) {
                ext = ol.proj.transformExtent(coordinates, ol.proj.get('EPSG:4326'), ol.proj.get('EPSG:3857'));
            }
            if (this.polygonDrawn) {
                ext = this.polygonDrawn;
            }
            this.map.getView().fit(ext, {
                size: this.map.getSize(), padding: [
                    0, $('.right-panel').width(), 0, 250
                ]
            });
            if (updateZoom && !this.polygonDrawn) {
                if (this.map.getView().getZoom() > 8) {
                    this.map.getView().setZoom(8);
                }
            }
        },
        setPolygonDrawn: function (polygon) {
           this.polygonDrawn = polygon
        },
        showFeedbackMarker: function (coordinate) {
            if (!this.feedbackMarker) {
                this.feedbackMarker = new ol.Feature({
                    geometry: new ol.geom.Point(coordinate),
                });
                let vectorSource = new ol.source.Vector({
                    features: [this.feedbackMarker]
                });
                let iconStyle = new ol.style.Style({
                    image: new ol.style.Icon(({
                        anchor: [0.5, 46],
                        anchorXUnits: 'fraction',
                        anchorYUnits: 'pixels',
                        opacity: 0.75,
                        src: '/static/img/map-marker.png'
                    }))
                });
                this.feedbackLayer = new ol.layer.Vector({
                    source: vectorSource,
                    style: iconStyle
                });
                this.map.addLayer(this.feedbackLayer);
            } else {
                this.feedbackMarker.getGeometry().setCoordinates(coordinate);
            }
        },
        mapClicked: function (e) {
            // Event handler when the map is clicked
            const self = this;
            if (this.mapInteractionEnabled) {
                return;
            }
            this.layers.highlightVectorSource.clear();
            this.hidePopup();

            // Get lat and long map
            let lonlat = ol.proj.transform(e.coordinate, 'EPSG:3857', 'EPSG:4326');
            let lon = lonlat[0];
            let lat = lonlat[1];

            if (this.addWetlandMappingIssueActive) {
                // Show marker on the map
                this.showFeedbackMarker(e.coordinate);
                Shared.Dispatcher.trigger('wetlandFeedback:locationUpdated', lonlat);
                return;
            }

            let layer = this.layers.layers['Sites'];
            let siteVisible = layer['layer'].getVisible();

            // If default bims site layer is visible then check whether user click on the
            // site point or not
            if (siteVisible) {
                let view = this.map.getView();
                let queryLayer = layer['layer'].getSource().getParams()['LAYERS'];
                let layerSource = layer['layer'].getSource().getFeatureInfoUrl(
                    e.coordinate,
                    view.getResolution(),
                    view.getProjection(),
                    {'INFO_FORMAT': 'application/json'}
                );
                layerSource += '&QUERY_LAYERS=' + queryLayer;
                $.ajax({
                    type: 'POST',
                    url: '/get_feature/',
                    data: {
                        'layerSource': layerSource
                    },
                    success: function (result) {
                        const data = result['feature_data'];
                        let objectData = {};
                        if (data.constructor === Object) {
                            objectData = data;
                        } else {
                            try {
                                objectData = JSON.parse(data);
                            } catch (e) {
                                objectData = {
                                    'features': []
                                };
                                console.log(e)
                            }
                        }
                        let features = objectData['features'];
                        if (features.length === 0) {
                            self.showFeature(self.map.getFeaturesAtPixel(e.pixel), lon, lat);
                            return;
                        }
                        let count = features[0]['properties']['count'];
                        if (count > 1) {
                            self.zoomToCoordinates(
                                e.coordinate,
                                self.getCurrentZoom() + 2
                            );
                        } else if (count === 1) {
                            // Check if the feature is a single location site point
                            if (features[0]['id'].includes('location_site_view')) {
                                // Get location site id
                                let siteId = '';
                                if (features[0]['id'].indexOf('fid') > -1) {
                                    siteId = features[0]['properties']['site_id'];
                                } else {
                                    siteId = features[0]['id'].split('.')[1];
                                }
                                Shared.Dispatcher.trigger('siteDetail:show', siteId, '');
                            }
                            let initialRadius = 5;
                            self.getSiteByCoordinate(lat, lon, initialRadius, function () {
                                self.showFeature(self.map.getFeaturesAtPixel(e.pixel), lon, lat, true);
                            });
                        } else {
                            // Check if the feature is single location site marker
                            if (features[0]['id'].includes('location_site_view')) {
                                // Get location site id
                                 // Get location site id
                                let siteId = '';
                                if (features[0]['id'].indexOf('fid') > -1) {
                                    siteId = features[0]['properties']['site_id'];
                                } else {
                                    siteId = features[0]['id'].split('.')[1];
                                }
                                Shared.Dispatcher.trigger('siteDetail:show', siteId, '');
                            } else {
                                self.showFeature(self.map.getFeaturesAtPixel(e.pixel), lon, lat);
                            }
                        }
                    }
                });
            } else {
                self.showFeature(self.map.getFeaturesAtPixel(e.pixel), lon, lat);
            }
        },
        getSiteByCoordinate: function (lat, lon, radius, callback = null) {
            let url = '';
            const self = this;
            const maxRadius = 30;
            const radiusIncrement = 5;
            if (Shared.CurrentState.SEARCH) {
                filterParameters['siteId'] = '';
                url = '/api/get-site-by-coord/' + self.apiParameters(filterParameters) + '&lon=' + lon + '&lat=' + lat + '&radius=' + radius + '&search_mode=True';
            } else {
                url = '/api/get-site-by-coord/?lon=' + lon + '&lat=' + lat + '&radius=' + radius
            }
            $.ajax({
                url: url,
                success: function (data) {
                    if (self.uploadDataState) {
                        self.mapControlPanel.showUploadDataModal(lon, lat, data[0]);
                    } else if (data.length > 0) {
                         Shared.Dispatcher.trigger('siteDetail:show', data[0]['id'], data[0]['site_code'], false, false);
                         if (callback && typeof callback === 'function') {
                             callback();
                         }
                    } else {
                        let nextRadius = radius + radiusIncrement;
                        if (nextRadius < maxRadius) {
                            self.getSiteByCoordinate(lat, lon, nextRadius, callback);
                        } else {
                            Shared.Dispatcher.trigger('siteDetail:closeSidePanel');
                        }
                    }
                }
            });
        },
        showFeature: function (features, lon, lat, siteExist = false) {
            let featuresClickedResponseData = [];
            const self = this;
            // Point of interest flag
            let poiFound = false;
            let featuresData = '';
            if (features) {
                $.each(features, function (index, feature) {
                    const geometry = feature.getGeometry();
                    const properties = feature.getProperties();
                    const geometryType = geometry.getType();
                    if (geometryType === 'Point') {
                        featuresClickedResponseData = self.featureClicked(
                            feature, self.uploadDataState);
                        poiFound = featuresClickedResponseData[0];
                        featuresData = featuresClickedResponseData[1];
                        console.log(featuresClickedResponseData, poiFound)
                        try {
                            self.zoomToCoordinates(geometry.getCoordinates());
                        } catch (e) {
                        }
                        // increase zoom level if it is clusters
                        if (feature.getProperties()['count'] &&
                            feature.getProperties()['count'] > 1) {
                            self.map.getView().setZoom(self.getCurrentZoom() + 1);
                            poiFound = true;
                        }
                        if (feature.getProperties().hasOwnProperty('features')) {
                            if (feature.getProperties()['features'].length > 0) {
                                poiFound = true;
                            }
                        }
                    } else if (geometryType === 'Polygon') {
                        featuresData = properties;
                        poiFound = false;
                    }
                });
            }
            if (!poiFound) {
                // Show feature info
                Shared.Dispatcher.trigger('third_party_layers:showFeatureInfo', lon, lat, siteExist, featuresData);
                Shared.Dispatcher.trigger('layers:showFeatureInfo', lon, lat, siteExist);
            }
        },
        featureClicked: function (feature, uploadDataState) {
            var properties = feature.getProperties();
            if (properties.hasOwnProperty('station')) {
                return [false, feature];
            }
            if (properties.hasOwnProperty('score')) {
                return [false, feature]
            }

            if (properties.hasOwnProperty('features')) {
                if (properties['features'].length > 1) {

                    this.zoomToCoordinates(
                        feature.getGeometry().getCoordinates(),
                        this.getCurrentZoom() + 2
                    );
                } else {
                    var _properties = properties['features'][0].getProperties();
                    Shared.Dispatcher.trigger('locationSite-' + _properties.id + ':clicked');
                }
            }

            if (!properties.hasOwnProperty('record_type')) {
                return [false, ''];
            }

            if (uploadDataState) {
                return [false, feature];
            }

            if (properties['record_type'] === 'site') {
                Shared.Dispatcher.trigger('locationSite-' + properties.id + ':clicked');
            } else {
                Shared.Dispatcher.trigger('cluster-biology' + properties.id + ':clicked');
            }
            this.layers.highlightVectorSource.clear();
            if (this.layers.layerStyle.isIndividialCluster(feature)) {
                this.addHighlightFeature(feature);
            }
            return [true, properties];
        },
        hidePopup: function () {
            this.popup.setPosition(undefined);
        },
        showPopup: function (coordinates, html) {
            $('#popup').html(html);
            this.popup.setPosition(coordinates);
        },
        layerControlClicked: function (e) {
        },
        mapLegendClicked: function (e) {
            if (this.resizingLegend) return;
            var $mapLegend = this.$mapLegendWrapper.find('#map-legend');
            const $mapLegendContainer = $('#map-legend-container');

            if ($mapLegend.is(':visible')) {
                this.lastLegendWidth = this.$mapLegendWrapper.width();
                this.lastLegendHeight = this.$mapLegendWrapper.height();
                this.$mapLegendWrapper.css('width', '31px')
                this.$mapLegendWrapper.css('height', '31px')
                $mapLegendContainer.css('overflow-x', 'hidden');
                $mapLegendContainer.css('overflow-y', 'hidden');
                this.hideMapLegends(true);
            } else {
                if (this.lastLegendHeight && this.lastLegendWidth) {
                    this.$mapLegendWrapper.css('width', this.lastLegendWidth)
                    this.$mapLegendWrapper.css('height', this.lastLegendHeight)
                    $mapLegendContainer.css('overflow-x', 'auto');
                    $mapLegendContainer.css('overflow-y', 'auto');
                }
                this.showMapLegends(true);
            }
        },
        showMapLegends: function (showTooltip) {
            if (!this.mapLegendInitialized) {
                let self = this;
                setTimeout(function () {
                    self.showMapLegends(showTooltip);
                }, 500)
                return;
            }
            let legendsDisplayed = Shared.StorageUtil.getItem('legendsDisplayed');
            if (!legendsDisplayed) {
                Shared.StorageUtil.setItem('legendsDisplayed', true);
            }
            if (Shared.LegendsDisplayed === true) {
                return true;
            }
            this.$mapLegendWrapper = $('#map-legend-wrapper');
            Shared.LegendsDisplayed = true;
            var $mapLegend = this.$mapLegendWrapper.find('#map-legend');
            var $mapLegendSymbol = this.$mapLegendWrapper.find('#map-legend-symbol');

            this.$mapLegendWrapper.removeClass('hide-legend');
            this.$mapLegendWrapper.addClass('show-legend');
            $mapLegendSymbol.hide();
            $mapLegend.show();

            this.$mapLegendWrapper.css({'overflow-x': 'auto', 'overflow-y': 'auto'});
            this.$mapLegendWrapper.attr(
                'data-original-title',
                'Click to hide legends <br/>Drag to move legends'
            ).tooltip('hide');

            if (showTooltip) {
                this.$mapLegendWrapper.tooltip('show');
            }
            this.$mapLegendWrapper.resizable('option', 'disabled', false);
        },
        hideMapLegends: function (showTooltip) {
            let legendsDisplayed = Shared.StorageUtil.getItem('legendsDisplayed');
            if (typeof legendsDisplayed === 'undefined' || legendsDisplayed === true) {
                Shared.StorageUtil.setItem('legendsDisplayed', false);
            }
            if (Shared.LegendsDisplayed === false) {
                return true;
            }
            Shared.LegendsDisplayed = false;
            this.$mapLegendWrapper = $('#map-legend-wrapper');
            var $mapLegend = this.$mapLegendWrapper.find('#map-legend');
            var $mapLegendSymbol = this.$mapLegendWrapper.find('#map-legend-symbol');

            this.$mapLegendWrapper.addClass('hide-legend');
            this.$mapLegendWrapper.removeClass('show-legend');
            $mapLegendSymbol.show();
            $mapLegend.hide();
            this.$mapLegendWrapper.attr('data-original-title', 'Show legends').tooltip('hide');

            if (showTooltip) {
                this.$mapLegendWrapper.tooltip('show');
            }
            if (!this.mapLegendInitialized) return;
            this.$mapLegendWrapper.resizable('option', 'disabled', true);
        },
        getCurrentZoom: function () {
            return this.map.getView().getZoom();
        },
        getCurrentBbox: function () {
            var ext = this.map.getView().calculateExtent(this.map.getSize());
            return ol.proj.transformExtent(ext, ol.proj.get('EPSG:3857'), ol.proj.get('EPSG:4326'));
        },
        render: function () {
            var self = this;
            this.$el.html(this.template());
            $('#map-container').append(this.$el);
            this.loadMap();

            this.map.on('click', function (e) {
                self.mapClicked(e);
            });

            this.sidePanelView = new SidePanelView();
            this.mapControlPanel = new MapControlPanelView({
                parent: this
            });

            this.$el.append(this.mapControlPanel.render().$el);
            this.$el.append(this.sidePanelView.render().$el);

            // add layer switcher
            let layerSwitcher = new LayerSwitcher({
                activationMode: 'click',
                collapseLabel: ''
            });
            this.map.addControl(layerSwitcher);
            $(layerSwitcher.element).addClass('layer-switcher-custom');
            $(layerSwitcher.element).attr('data-toggle', 'popover');
            $(layerSwitcher.element).attr('data-placement', 'right');
            $(layerSwitcher.element).attr('data-trigger', 'hover');
            $(layerSwitcher.element).attr('data-content', 'Change Basemap');
            $(layerSwitcher.element).removeClass('ol-control');
            $('.layer-switcher-custom').click(function () {
                $(this).popover('hide');
            });
            $('.layer-switcher-custom .panel').mouseenter(function () {
                $('.layer-switcher-custom').popover('disable');
            }).mouseleave(function () {
                $('.layer-switcher-custom').popover('enable');
            });
            this.mapControlPanel.addPanel($(layerSwitcher.element));

            $(document).on('click', function (event) {
                if (!$(event.target).closest('.layer-switcher-custom').length) {
                    layerSwitcher.hidePanel();
                }
            });

            this.map.on('moveend', function (evt) {
                self.mapMoved();
            });

            this.wetlandMappingFeedbackView = new WetlandMappingFeedbackView();
            this.bugReportView = new BugReportView();
            this.$el.append(this.wetlandMappingFeedbackView.render().$el);
            this.$el.append(this.bugReportView.render().$el);
            this.$el.append(this.taxonDetailDashboard.render().$el);
            this.$el.append(this.siteDetailedDashboard.render().$el);

            this.$mapLegendWrapper = $('#map-legend-wrapper');
            this.$mapLegendWrapper.draggable({
                containment: '.map-wrapper',
                start: function (event, ui) {
                    self.$mapLegendWrapper.css('bottom', 'auto');
                    $("[data-toggle=tooltip]").tooltip('hide');
                },
                stop: function (event, ui) {
                    var legend_position = self.$mapLegendWrapper.position();
                    var bottom = $('#map').height() - legend_position.top - self.$mapLegendWrapper.outerHeight();
                    self.$mapLegendWrapper.css('bottom', bottom + 'px').css('top', 'auto');
                }
            }).resizable({
                containment: '.map-wrapper',
                handles: 'se',
                minWidth: 100,
                minHeight: 100,
                start: function (event, ui) {
                    self.resizingLegend = true;
                    $("[data-toggle=tooltip]").tooltip('hide');
                    $(this).css('max-height', 'none');
                    $(this).css('max-width', 'none');
                },
                stop: function (event, ui) {
                    setTimeout(function () {
                        self.resizingLegend = false;
                    }, 500);
                }
            });
            this.mapLegendInitialized = true;
            this.$mapLegendWrapper.resizable('option', 'disabled', true);

            this.map.getLayers().forEach(function (layer) {
                try {
                    var source = layer.getSource();
                    if (source instanceof ol.source.TileImage) {
                        source.on('tileloadstart', function () {
                            ++self.numInFlightTiles
                        });
                        source.on('tileloadend', function () {
                            --self.numInFlightTiles
                        });
                        source.on('tileloaderror', function () {
                            --self.numInFlightTiles
                        });
                    }
                } catch (err) {
                }
            });

            this.map.on('postrender', function (evt) {
                if (!evt.frameState)
                    return;

                var numHeldTiles = 0;
                var wanted = evt.frameState.wantedTiles;
                for (var layer in wanted)
                    if (wanted.hasOwnProperty(layer))
                        numHeldTiles += Object.keys(wanted[layer]).length;

                var ready = self.numInFlightTiles <= 15 && numHeldTiles === 0;
                if (self.mapIsReady !== ready) {
                    self.mapIsReady = ready;
                }
            });

            return this;
        },
        mapMoved: function () {
            let self = this;
            let administrative = self.checkAdministrativeLevel();
            if (administrative !== 'detail') {
                this.layers.changeLayerAdministrative(administrative);
            }
        },
        loadMap: function () {
            var self = this;
            var mousePositionControl = new ol.control.MousePosition({
                projection: 'EPSG:4326',
                target: document.getElementById('mouse-position-wrapper'),
                coordinateFormat: function (coordinate) {
                    return ol.coordinate.format(coordinate, '{y},{x}', 4);
                }
            });
            var basemap = new Basemap();

            var center = this.initCenter;
            if (centerPointMap) {
                var centerArray = centerPointMap.split(',');
                for (var i in centerArray) {
                    centerArray[i] = parseFloat(centerArray[i]);
                }
                center = centerArray;
            }

            // Add scaleline control
            let scalelineControl = new ol.control.ScaleLine();

            let extent = defaultExtentMap.split(',');
            let newExtent = [];
            for (let e=0; e < extent.length; e++) {
                newExtent.push(parseFloat(extent[e]));
            }
            extent = ol.proj.transformExtent(newExtent, 'EPSG:4326', 'EPSG:3857');

            // Create a popup overlay which will be used to display feature info
            this.popup = new ol.Overlay({
                element: document.getElementById('popup'),
                positioning: 'bottom-center',
                offset: [0, -10]
            });

            this.map = new ol.Map({
                target: 'map',
                layers: basemap.getBaseMaps(),
                view: new ol.View({
                    center: ol.proj.fromLonLat(center),
                    zoom: this.initZoom,
                    minZoom: mapMinZoom,
                    maxZoom: 19,
                }),
                controls: ol.control.defaults.defaults({ zoom: false }).extend([
                    mousePositionControl,
                    scalelineControl
                ]),
                overlays: [this.popup]
            });

            this.map.getView().fit(extent);

            this.map.addOverlay(this.popup);

            self.layers.addLayersToMap(self.map);
            this.initExtent = this.getCurrentBbox();
        },
        removeLayer: function (layer) {
            this.map.removeLayer(layer);
        },
        addLayer: function (layer) {
            this.map.addLayer(layer);
        },
        reloadXHR: function () {
            this.previousZoom = -1;
            this.clusterCollection.administrative = null;
            this.fetchingRecords();
            $('#fetching-error .call-administrator').show();
        },
        checkAdministrativeLevel: function () {
            var self = this;
            var zoomLevel = this.map.getView().getZoom();
            var administrative = 'detail';
            $.each(Object.keys(this.clusterLevel), function (index, value) {
                if (zoomLevel <= value) {
                    administrative = self.clusterLevel[value];
                    return false;
                }
            });
            return administrative;
        },
        resetAdministrativeLayers: function () {
            var administrative = this.checkAdministrativeLevel();
            if (administrative !== 'detail') {
                if (administrative === this.clusterCollection.administrative) {
                    return
                }
                this.layers.changeLayerAdministrative(administrative);
            } else {
                this.clusterCollection.administrative = null;
            }
        },
        fetchingRecords: function () {
            // get records based on administration
            var self = this;
            return;
            if (!this.layers.isBiodiversityLayerLoaded()) {
                return
            }
            self.updateClusterBiologicalCollectionZoomExt();
        },
        updateClusterBiologicalCollectionTaxonID: function (taxonID, taxonName) {
            this.closeHighlight();
            if (!this.sidePanelView.isSidePanelOpen() && !this.mapControlPanel.searchView.searchPanel.isPanelOpen()) {
                return
            }
        },
        updateClusterBiologicalCollectionZoomExt: function () {
            this.clusterBiologicalCollection.updateZoomAndBBox(
                this.getCurrentZoom(), this.getCurrentBbox());
        },
        addBiodiversityFeatures: function (features) {
            // this.layers.biodiversitySource.addFeatures(features);
        },
        addLocationSiteClusterFeatures: function (features) {
            this.layers.locationSiteClusterSource.addFeatures(features);
        },
        isAllLayersReady: function () {
            if (this.layers.locationSiteClusterSource && this.layers.highlightVectorSource && this.layers.highlightPinnedVectorSource) {
                return true;
            }
            return false;
        },
        switchHighlight: function (features, ignoreZoom) {
            var self = this;
            this.closeHighlight();
            $.each(features, function (index, feature) {
                self.addHighlightFeature(feature);
            });
            if (!ignoreZoom) {
                var extent = this.layers.highlightVectorSource.getExtent();
                this.map.getView().fit(extent, {
                    size: this.map.getSize(), padding: [
                        0, $('.right-panel').width(), 0, 250
                    ]
                });
                if (this.getCurrentZoom() > 8) {
                    this.map.getView().setZoom(8);
                }
            }
        },
        addHighlightFeature: function (feature) {
            this.layers.highlightVectorSource.addFeature(feature);
        },
        closeHighlight: function () {
            this.hidePopup();
            if (this.layers.highlightVectorSource) {
                this.layers.highlightVectorSource.clear();
            }
        },
        switchHighlightPinned: function (features, ignoreZoom) {
            var self = this;
            this.closeHighlightPinned();
            $.each(features, function (index, feature) {
                self.addHighlightPinnedFeature(feature);
            });
        },
        zoomToHighlightPinnedFeatures: function () {
            this.map.getView().fit(
                this.layers.highlightPinnedVectorSource.getExtent(),
                {
                    size: this.map.getSize(),
                    padding: [
                        0, $('.right-panel').width(), 0, 250
                    ]
                });
        },
        addHighlightPinnedFeature: function (feature) {
            this.layers.highlightPinnedVectorSource.addFeature(feature);
        },
        removeHighlightPinnedFeature: function (id) {
            var self = this;
            self.layers.highlightPinnedVectorSource.getFeatures().forEach(function (feature) {
                var feature_id = feature.getProperties()['id'];
                if (feature_id === id) {
                    self.layers.highlightPinnedVectorSource.removeFeature(feature);
                }
            });
        },
        closeHighlightPinned: function () {
            this.hidePopup();
            if (this.layers.highlightPinnedVectorSource) {
                this.layers.highlightPinnedVectorSource.clear();
            }
        },
        showInfoPopup: function () {
            if (!hideBimsInfo && bimsInfoContent) {
                $('#general-info-modal').fadeIn()
            }
        },
        zoomToDefault: function () {
            var center = this.initCenter;

            if (defaultExtentMap) {
                let extent = defaultExtentMap.split(',');
                let newExtent = [];
                for (let e=0; e < extent.length; e++) {
                    newExtent.push(parseFloat(extent[e]));
                }
                extent = ol.proj.transformExtent(newExtent, 'EPSG:4326', 'EPSG:3857');

                this.map.getView().fit(extent);
                return;
            }

            if (centerPointMap) {
                var centerArray = centerPointMap.split(',');
                for (var i in centerArray) {
                    centerArray[i] = parseFloat(centerArray[i]);
                }
                center = centerArray;
            }
            this.zoomToCoordinates(ol.proj.fromLonLat(center), this.initZoom);
        },
        updateBiodiversityLayerParams: function (query) {
            query = query.replaceAll(',', '\\,');
            query = query.replaceAll(';', '\\;');
            let newParams = {
                layers: locationSiteGeoserverLayer,
                format: 'image/png',
                viewparams: 'where:' + tenant + '."' + query + '"'
            };
            this.layers.biodiversitySource.updateParams(newParams);
        },
        clearAllLayers: function () {
            let newParams = {
                layers: locationSiteGeoserverLayer,
                format: 'image/png',
                viewparams: 'where:' + emptyWMSSiteParameter
            };
            this.layers.biodiversitySource.updateParams(newParams);
        },
        resetSitesLayer: function () {
            let newParams = {
                layers: locationSiteGeoserverLayer,
                format: 'image/png',
                viewparams: 'where:' + defaultWMSSiteParameters
            };
            this.layers.biodiversitySource.updateParams(newParams);
        },
        toggleMapInteraction: function (enabled) {
            this.mapInteractionEnabled = enabled;
        },
        showTaxonDetailedDashboard: function (data) {
            this.taxonDetailDashboard.show(data);
        },
        showSiteDetailedDashboard: function (data) {
            this.siteDetailedDashboard.show(data);
        },
        closeDetailedDashboard: function () {
            this.taxonDetailDashboard.closeDashboard();
            this.siteDetailedDashboard.closeDashboard();
        },
        whenMapIsReady: function (callback) {
            var self = this;
            if (this.mapIsReady) {
                callback();
            }
            else {
                setTimeout(function () {
                    self.map.once('change:ready', self.whenMapIsReady.bind(null, callback));
                    self.whenMapIsReady(callback);
                }, 100)
            }
        },
        downloadMap: function (fileType = 'png') {
            var that = this;
            var downloadMap = true;

            that.map.renderSync();

            if (downloadMap) {
                $('#ripple-loading').show();
                $('.map-control-panel-box').hide();
                $('.ol-control').hide();
                $('.map-control-panel').hide();
                $('.zoom-control').hide();
                $('.bug-report-wrapper').hide();
                $('#wetland-map-feedback').hide();
                $('.print-map-control').addClass('control-panel-selected');
                that.map.once('rendercomplete', function (event) {
                    var canvas = document.getElementsByClassName('map-wrapper');
                    var $mapWrapper = $('.map-wrapper');
                    var divHeight = $mapWrapper.height();
                    var divWidth = $mapWrapper.width();
                    var ratio = divHeight / divWidth;
                    html2canvas(canvas, {
                        useCORS: true,
                        background: '#FFFFFF',
                        allowTaint: false,
                        onrendered: function (canvas) {
                            if (fileType === 'pdf') {
                                // Create a new instance of jsPDF
                                let pdf = new jsPDF.jsPDF('l', 'mm', [divWidth, divHeight]);

                                // Add the canvas image to the PDF
                                pdf.addImage(canvas.toDataURL("image/png"), 'PNG', 0, 0, divWidth, divHeight);

                                // Save the PDF
                                pdf.save('map.pdf');
                            } else {
                                var link = document.createElement('a');
                                link.setAttribute("type", "hidden");
                                link.href = canvas.toDataURL("image/" + fileType);
                                link.download = 'map.' + fileType;
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            }
                            $('.zoom-control').show();
                            $('.map-control-panel').show();
                            $('#ripple-loading').hide();
                            $('.bug-report-wrapper').show();
                            $('.ol-control').show();
                            $('#wetland-map-feedback').show();
                            $('.print-map-control').removeClass('control-panel-selected');
                        }
                    })
                });
            }
        },
        startTutorial: function() {
            startIntro();
        }
    })
});
