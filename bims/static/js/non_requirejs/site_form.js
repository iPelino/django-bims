let map = null;
let markerSource = null;
let riversLayer = 'https://maps.kartoza.com/geoserver/wms';
let parkLayer = null;

const modal = `<!-- Modal -->
<div id="error-modal" class="modal hide fade" tabindex="-1" role="dialog">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="myModalLabel">Error!</h3>
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
            </div>
            <div class="modal-body">
                <p>Site is not in the correct country</p>
            </div>
            <div class="modal-footer">
                <button class="btn" data-dismiss="modal" aria-hidden="true">Close</button>
            </div>
        </div>
    </div>
</div>
`;

let validator = $('#site-form').validate({
    submitHandler: function(form) {
        let siteCode = $('#site_code').val();
        let formAlert = $('#form-alert');
        let submitButton = $('.submit-button');
        formAlert.html('');
        formAlert.hide();

        // river name
        let riverName = $('#river_name').val();
        let userRiverName = $('#user_river_name').val();

        if (siteCodeGeneratorMethod === 'fbis') {
            if (!riverName && !userRiverName) {
                formAlert.show();
                formAlert.html('River name is required.');
                return false;
            }

            // Check length
            if (ecosystemType == 'River') {
                if (siteCode.length !== 12) {
                    showSiteCodeError();
                    return false;
                }
            } else {
                if (siteCode.length < 15) {
                    showSiteCodeError();
                    return false;
                }
            }
            // Check regex
            let regex = /(\w{6})-(\w{5})/g;
            if (ecosystemType == 'Open waterbody' || ecosystemType == 'Wetland') {
                regex = /(\w{4})-(\w{4})-(\w{5})/g;
            }
            let regexResult = regex.test(siteCode);
            if (!regexResult) {
                showSiteCodeError();
                return false;
            }
        }

        let latitude = $('#latitude').val();
        let longitude = $('#longitude').val();
        let originalSubmitButtonVal = submitButton.val();
        submitButton.val('Checking...')
        submitButton.attr('disabled', 'disabled')
        checkSiteInCountry(latitude, longitude, function (isInCountry) {
            if (isInCountry) {
                form.submit();
            } else {
                $('#error-modal').modal('show');
                submitButton.val(originalSubmitButtonVal)
                submitButton.removeAttr('disabled')
            }
        })
    }
});

let showSiteCodeError = function () {
    validator.showErrors({
        site_code: 'Invalid Site Code format'
    });
};

const mapOnClicked = (e) => {
    let coords = ol.proj.toLonLat(e.coordinate);
    let lat = coords[1];
    let lon = coords[0];
    $('#latitude').val(lat);
    $('#longitude').val(lon);
    updateCoordinate(false);
}

const convertStyles = (styles, name) => {
    styles = JSON.parse(styles)
    styles['sources'] = {}
    styles['sources'][name] = {
        "type": "vector",
        "data": "",
    }
    styles['name'] = name;
    for (let i = 0; i < styles['layers'].length; i++) {
        styles['layers'][i]['id'] = `${name}-${i}`;
        styles['layers'][i]['source'] = name
        styles['layers'][i]['minzoom'] = 0
    }
    return styles
}

$(function () {
    $('body').append(modal);
    let mapView = new ol.View({
        center: [0,0],
        zoom: 5
    });
    const baseLayer = [];
    if(bingKey){
        baseLayer.push(
            new ol.layer.Tile({
                source: new ol.source.BingMaps({
                key: bingKey,
                imagerySet: 'AerialWithLabels'
            })
            })
        )
    }
    else {
        baseLayer.push(
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        )
    }

    let extent = defaultExtentMap.split(',');
    let newExtent = [];
    for (let e = 0; e < extent.length; e++) {
        newExtent.push(parseFloat(extent[e]));
    }
    extent = ol.proj.transformExtent(newExtent, 'EPSG:4326', 'EPSG:3857');

    map = new ol.Map({
        target: 'site-map',
        layers: baseLayer,
        view: mapView
    });

    if (isFbis) {
        let options = {
            url: 'https://maps.kartoza.com/geoserver/wms',
            params: {
                layers: 'kartoza:sa_rivers',
                format: 'image/png'
            }
        };
        let riverLayer = new ol.layer.Tile({
            source: new ol.source.TileWMS(options)
        });
        map.addLayer(riverLayer);
    }

    if (parkLayerTiles) {
        const vectorSource = new olpmtiles.PMTilesVectorSource({
          url: parkLayerTiles,
          attributions: ['']
        });

        parkLayer = new ol.layer.VectorTile({
            title: parkLayerName,
            source: vectorSource,
            tileGrid: ol.tilegrid.createXYZ(),
            declutter: true,
        })

        if (parkLayerStyle) {
            olms.applyStyle(
                parkLayer,
                convertStyles(parkLayerStyle, parkLayerName), parkLayerName).catch((error) => {
                    console.error('Failed to apply style:', error);
                });
        }

        map.addLayer(parkLayer);
    }

    let biodiversityLayersOptions = {
        url: geoserverPublicUrl + 'wms',
        params: {
            LAYERS: locationSiteGeoserverLayer,
            FORMAT: 'image/png8',
            viewparams: 'where:' + defaultWMSSiteParameters
        },
        ratio: 1,
        serverType: 'geoserver'
    };
    if (ecosystemType) {
        biodiversityLayersOptions['params']['viewparams'] += ';ecosystem_type:' + ecosystemType;
    }
    let biodiversitySource = new ol.source.TileWMS(biodiversityLayersOptions);
    let biodiversityTileLayer = new ol.layer.Tile({
        source: biodiversitySource
    });
    map.addLayer(biodiversityTileLayer);

    map.on('click', mapOnClicked);

    map.getView().fit(extent);

    $('[data-toggle="popover"]').popover();

    $('#update-coordinate').click(updateCoordinateHandler);
    $('#update-site-code').click(updateSiteCode);
    $('#fetch-river-name').click(fetchRiverName);
    $('#fetch-geomorphological-zone').click(fetchGeomorphologicalZone);

    if (locationSiteLat && locationSiteLong) {
        addMarkerToMap(parseFloat(locationSiteLat), parseFloat(locationSiteLong));
    }

    if(typeof mapReady !== 'undefined') {
        mapReady(map);
    }
});

$('#latitude').keyup((e) => {
    let $target = $(e.target);
    if (!$('#latitude').val() || !$('#longitude').val()) {
        document.getElementById('update-coordinate').disabled = true;
        return;
    }
    document.getElementById('update-coordinate').disabled = false;
});
$('#longitude').keyup((e) => {
    let $target = $(e.target);
    if (!$('#latitude').val() || !$('#longitude').val()) {
        document.getElementById('update-coordinate').disabled = true;
        return;
    }
    document.getElementById('update-coordinate').disabled = false;
});

const updateSiteCode = (e) => {
    let latitude = $('#latitude').val();
    let longitude = $('#longitude').val();
    let button = $('#update-site-code');
    let siteCodeInput = $('#site_code');
    let catchmentInput = $('#catchment_geocontext');
    let userRiverName = $('#user_river_name').val();
    let siteName = $('#site_name').val();
    let siteDesc = $('#site_desc').val();
    let buttonLabel = button.html();

    document.getElementById('update-site-code').disabled = true;
    button.html('Generating...');
    siteCodeInput.prop('disabled', true);
    let url = '/api/get-site-code/?ecosystem_type=' + ecosystemType  + '&user_river_name=' + userRiverName  + '&lon=' + longitude + '&lat=' + latitude + '&site_name=' + siteName + '&site_desc=' + siteDesc;
    if (siteId) {
        url += '&site_id=' + siteId
    }

    checkSiteInCountry(latitude, longitude, function (isInCountry) {
        if (isInCountry) {
            $.ajax({
                url: url,
                success: function (data) {
                    siteCodeInput.prop('disabled', false);
                    siteCodeInput.val(data['site_code']);
                    catchmentInput.val(JSON.stringify(data['catchment']));
                    document.getElementById('update-site-code').disabled = false;
                    button.html(buttonLabel);
                }
            });
        } else {
            document.getElementById('update-site-code').disabled = false;
            button.html(buttonLabel);
            $('#error-modal').modal('show');
        }
    });

};

let fetchRiverName = (e) => {
    let latitude = $('#latitude').val();
    let longitude = $('#longitude').val();
    let riverInput = $('#river_name');
    let button = $('#fetch-river-name');
    let url = '/api/get-river-name/?lon=' + longitude + '&lat=' + latitude;
    let buttonLabel = button.html();

    document.getElementById('fetch-river-name').disabled = true;
    button.html('Fetching...');

    $.ajax({
        url: url,
        success: function (data) {
            riverInput.val(data['river']);
            document.getElementById('fetch-river-name').disabled = false;
            button.html(buttonLabel);
        }
    });
};

let fetchGeomorphologicalZone = (e) => {
    let latitude = $('#latitude').val();
    let longitude = $('#longitude').val();
    let button = $('#fetch-geomorphological-zone');
    let geomorphologicalInput = $('#geomorphological_zone');
    let geomorphologicalGeocontextInput = $('#geomorphological_group_geocontext');
    let buttonLabel = button.html();

    button.prop('disabled', true);
    button.html('Fetching...');

    $.ajax({
        url: '/api/get-geomorphological-zone/?lon=' + longitude + '&lat=' + latitude,
        success: function (data) {
            geomorphologicalInput.val(data['geomorphological_zone']);
            geomorphologicalGeocontextInput.val(JSON.stringify(data['geomorphological_group']));
            button.prop('disabled', false);
            button.html(buttonLabel);
        }
    });
};

let updateCoordinateHandler = (e) => {
    updateCoordinate();
};

let updateCoordinate = function (zoomToMap = true) {
    let latitude = $('#latitude').val();
    let longitude = $('#longitude').val();
    let tableBody = $('#closest-site-table-body');
    let loadingIndicator = document.getElementById('loading-indicator');

    loadingIndicator.style.display = 'block';
    loadingIndicator.textContent = 'Checking nearby sites...';

    document.getElementById('update-coordinate').disabled = true;
    $('#closest-sites-container').show();
    tableBody.html('');

    moveMarkerOnTheMap(latitude, longitude, zoomToMap);
    let radius = 0.5;
    let url =  '/api/get-site-by-coord/?lon=' + longitude + '&lat=' + latitude + '&radius=' + radius;
    if (ecosystemType) {
        url += '&ecosystem=' + ecosystemType;
    }

    if (parkLayerTiles && parkAttribute) {
        const coordinate = ol.proj.transform(
                [longitude, latitude], 'EPSG:4326', 'EPSG:3857');
        const pixel = map.getPixelFromCoordinate(coordinate);
        map.forEachFeatureAtPixel(pixel, function (feature, _layer) {
            if (_layer === parkLayer) {
                const properties = feature.getProperties();
                if (properties.hasOwnProperty(parkAttribute)) {
                    const layerValue = properties[parkAttribute];
                    $('#site_name').val(layerValue);
                }
            }
        })
    }

    $.ajax({
        url: url,
        success: function (all_data) {
            loadingIndicator.style.display = 'none';
            if (all_data.length > 0) {
                let nearestSite = null;
                if (siteId) {
                    let site_id = parseInt(siteId);
                    $.each(all_data, function (index, site_data) {
                    if (site_data['id'] !== site_id) {
                            nearestSite = site_data;
                            return false;
                        }
                    });
                } else {
                    nearestSite = all_data[0];
                }

                if (nearestSite) {
                    let modal = $("#site-modal");
                    let nearestSiteName = '';
                    if (nearestSite['site_code']) {
                        nearestSiteName = nearestSite['site_code'];
                    } else {
                        nearestSiteName = nearestSite['name'];
                    }
                    modal.find('#nearest-site-name').html(nearestSiteName);
                    modal.find('#existing-site-button').attr('onClick', 'location.href="/location-site-form/update/?id=' + nearestSite['id'] + '"');
                    modal.modal('show');
                }
            }
        },
        error: function (xhr, ajaxOptions, thrownError) {
            loadingIndicator.style.display = 'none';
        }
    });
};

let moveMarkerOnTheMap = (lat, lon, zoomToMap = true) => {
    if (!markerSource) {
        addMarkerToMap(lat, lon, zoomToMap);
        return;
    }
    let locationSiteCoordinate = ol.proj.transform([
            parseFloat(lon),
            parseFloat(lat)],
        'EPSG:4326',
        'EPSG:3857');
    let iconFeature = new ol.Feature({
        geometry: new ol.geom.Point(locationSiteCoordinate),
    });
    markerSource.clear();
    markerSource.addFeature(iconFeature);
    if (zoomToMap) {
        map.getView().setCenter(locationSiteCoordinate);
        map.getView().setZoom(6);
    }
};

let addMarkerToMap = (lat, lon, zoomToMap = true) => {
    markerSource = new ol.source.Vector();
    let locationSiteCoordinate = ol.proj.transform([
            parseFloat(lon),
            parseFloat(lat)],
        'EPSG:4326',
        'EPSG:3857');
    let markerStyle = new ol.style.Style({
        image: new ol.style.Icon(({
            anchor: [0.55, 43],
            anchorXUnits: 'fraction',
            anchorYUnits: 'pixels',
            opacity: 1,
            src: '/static/img/map-marker.png'
        }))
    });
    let iconFeature = new ol.Feature({
        geometry: new ol.geom.Point(locationSiteCoordinate),
    });
    markerSource.addFeature(iconFeature);
    map.addLayer(new ol.layer.Vector({
        source: markerSource,
        style: markerStyle,
        zIndex: 1000
    }));
    if (zoomToMap) {
        map.getView().setCenter(locationSiteCoordinate);
        map.getView().setZoom(14);
    }
    if (allowToEdit) {
        document.getElementById('update-site-code').disabled = false;
        try {
            document.getElementById('fetch-geomorphological-zone').disabled = false;
            document.getElementById('fetch-river-name').disabled = false;
        } catch (e) {}
    }
};

$('#owner').autocomplete({
    source: function (request, response) {
        $.ajax({
            url: '/user-autocomplete/?term=' + encodeURIComponent(request.term),
            type: 'get',
            dataType: 'json',
            success: function (data) {
                response($.map(data, function (item) {
                    return {
                        label: item.first_name + ' ' + item.last_name,
                        value: item.id
                    }
                }));
            }
        });
    },
    minLength: 3,
    open: function (event, ui) {
        setTimeout(function () {
            $('.ui-autocomplete').css('z-index', 99);
        }, 0);
    },
    change: function (event, ui) {
        let $ownerIdInput = $('#owner_id');
        if (ui.item) {
            $ownerIdInput.val(ui.item.value);
        } else {
            $('#owner').val(' ');
            $ownerIdInput.val(' ');
        }
    },
    select: function (e, u) {
        e.preventDefault();
        $('#owner').val(u.item.label);
        $('#owner_id').val(u.item.value);
    }
});

$('.delete-image-btn').click(function () {
    let imageId = $('#siteImageCarousel .carousel-item.active').data('id');
    $('#id_site_image_delete').val(imageId);
    $('#confirm-delete-site-image').modal('show');
});

$('.open-image-btn').click(function () {
    let imageUrl = $('#siteImageCarousel .carousel-item.active').data('image-url');
    window.open(imageUrl,'Image','width=largeImage.stylewidth,height=largeImage.style.height,resizable=1');
});

let checkSiteInCountry = (latitude, longitude, callback) => {

    let url = `/api/site-in-country/?lon=${longitude}&lat=${latitude}`;
    $.ajax({
        url: url,
        success: function (data) {
            try {
                callback(data);
            } catch (e) {
                callback(false);
            }
        },
        error:function (xhr, ajaxOptions, thrownError){
            if(xhr.status === 404) {
                callback(false)
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
});