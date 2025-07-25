import json
import logging

import factory
from django.db.models import signals
from django_tenants.test.cases import FastTenantTestCase
from django_tenants.test.client import TenantClient

from bims.api_views.taxon_images import TaxonImageList
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIRequestFactory, APIClient

from bims.models import LocationSite
from bims.tests.model_factories import (
    BiologicalCollectionRecordF,
    UserF,
    ContentTypeF,
    PermissionF,
    GroupF,
    LocationSiteF,
    TaxonomyF,
    TaxonGroupF, TaxonImageF,
    SiteF
)
from bims.api_views.location_site import (
    LocationSiteDetail,
)
from bims.api_views.location_type import (
    LocationTypeAllowedGeometryDetail
)
from bims.api_views.non_validated_record import (
    GetNonValidatedRecords
)
from bims.api_views.taxon import TaxonDetail
from bims.api_views.reference_category import ReferenceCategoryList
from bims.api_views.module_summary import ModuleSummary
from bims.enums.taxonomic_rank import TaxonomicRank
from bims.enums.taxonomic_group_category import TaxonomicGroupCategory
from bims.views.autocomplete_search import autocomplete
from django.test import TestCase, override_settings

logger = logging.getLogger('bims')


class TestApiView(FastTenantTestCase):
    """Test Location site API """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.location_site = LocationSiteF.create(
            location_context_document='""'
        )

        self.taxonomy_class_1 = TaxonomyF.create(
            scientific_name='Aves',
            rank=TaxonomicRank.CLASS.name
        )
        self.taxonomy_1 = TaxonomyF.create(
            scientific_name='Some aves name 1',
            canonical_name='aves name 1',
            rank=TaxonomicRank.SPECIES.name,
            parent=self.taxonomy_class_1
        )
        self.taxonomy_2 = TaxonomyF.create(
            scientific_name='Some aves name 2',
            canonical_name='aves name 2',
            rank=TaxonomicRank.SPECIES.name,
            parent=self.taxonomy_class_1
        )
        self.aves_collection_1 = BiologicalCollectionRecordF.create(
            original_species_name=u'Aves collection 1',
            site=self.location_site,
            validated=True,
            ready_for_validation=True,
            taxonomy=self.taxonomy_1
        )
        self.aves_collection_2 = BiologicalCollectionRecordF.create(
            original_species_name=u'Aves collection 2',
            site=self.location_site,
            validated=True,
            ready_for_validation=True,
            taxonomy=self.taxonomy_2
        )

        self.fish_collection_1 = BiologicalCollectionRecordF.create(
            original_species_name=u'Test fish species name 1',
            site=self.location_site,
            validated=True
        )
        self.fish_collection_2 = BiologicalCollectionRecordF.create(
            original_species_name=u'Test fish species name 2',
            site=self.location_site,
            validated=True
        )
        self.admin_user = UserF.create(
            is_superuser=True,
            is_staff=True
        )

    def test_get_location_by_id(self):
        view = LocationSiteDetail.as_view()
        pk = str(self.location_site.id)
        request = self.factory.get('/api/location-site-detail/?siteId=' + pk)
        response = view(request)
        self.assertTrue(
            'id' in response.data
        )

    def test_get_taxon_by_id(self):
        pk = 1
        taxon = TaxonomyF.create(
            pk=1,
            scientific_name=u'Golden fish',
        )
        view = TaxonDetail.as_view()
        request = self.factory.get('/api/taxon/' + str(pk))
        response = view(request, str(pk))
        self.assertEqual(
            taxon.scientific_name,
            response.data['scientific_name']
        )

        # def test_get_allowed_geometry_location_type_by_id(self):
        view = LocationTypeAllowedGeometryDetail.as_view()
        pk = '%s' % self.fish_collection_1.site.location_type.pk
        request = self.factory.get(
            '/api/location-type/%s/allowed-geometry/' % pk)
        response = view(request, pk)
        self.assertEqual(response.data, 'POINT')

    def test_get_unvalidated_records_as_public(self):
        view = GetNonValidatedRecords.as_view()
        request = self.factory.get(reverse('get-unvalidated-records'))
        response = view(request)
        self.assertEqual(response.status_code, 401)

    def test_get_unvalidated_records_as_admin(self):
        view = GetNonValidatedRecords.as_view()
        request = self.factory.get(reverse('get-unvalidated-records'))
        request.user = self.admin_user
        response = view(request)
        self.assertEqual(response.status_code, 200)

    def test_get_unvalidated_records_as_validator(self):
        view = GetNonValidatedRecords.as_view()
        BiologicalCollectionRecordF.create(
            original_species_name=u'Aves collection 1',
            site=self.location_site,
            validated=False,
            ready_for_validation=True,
            taxonomy=self.taxonomy_1
        )
        BiologicalCollectionRecordF.create(
            original_species_name=u'Aves collection 2',
            site=self.location_site,
            validated=False,
            ready_for_validation=True,
            taxonomy=self.taxonomy_2
        )
        user = UserF.create()
        content_type = ContentTypeF.create(
            app_label='bims',
            model='bims'
        )
        permission = PermissionF.create(
            name='Can validate Aves',
            content_type=content_type,
            codename='can_validate_aves'
        )
        group = GroupF.create()
        group.permissions.add(permission)
        user.groups.add(group)

        request = self.factory.get(reverse('get-unvalidated-records'))
        request.user = user
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['data']), 2)

    def test_get_referece_category(self):
        view = ReferenceCategoryList.as_view()
        BiologicalCollectionRecordF.create(
            original_species_name=u'Test name',
            site=self.location_site,
            reference_category=u'Database'
        )
        request = self.factory.get(reverse('list-reference-category'))
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(len(response.data) > 0)

    def test_get_module_summary(self):
        view = ModuleSummary.as_view()
        taxon_class_1 = TaxonomyF.create(
            scientific_name='Aves',
            rank=TaxonomicRank.CLASS.name,
        )

        taxon_species_1 = TaxonomyF.create(
            scientific_name='Bird1',
            rank=TaxonomicRank.SPECIES.name,
            parent=taxon_class_1,
            additional_data={"Division": "Chlorophyta"}
        )
        taxon_group_1 = TaxonGroupF.create(
            name='algae',
            category=TaxonomicGroupCategory.SPECIES_MODULE.name,
            taxonomies=(taxon_species_1,),
            chart_data='division',
        )

        taxon_group_2 = TaxonGroupF.create(
            name='fish',
            category=TaxonomicGroupCategory.SPECIES_MODULE.name,
            taxonomies=(taxon_species_1,),
            chart_data='conservation status',
        )

        bio1 = BiologicalCollectionRecordF.create(
            taxonomy=taxon_species_1,
            validated=True,
            site=self.location_site,
        )

        bio2 = BiologicalCollectionRecordF.create(
            taxonomy=taxon_species_1,
            validated=True,
            site=self.location_site,
        )

        module_summary = ModuleSummary()
        module_summary.summary_data()
        request = self.factory.get(reverse('module-summary'))
        response = view(request)
        self.assertGreater(
            response.data['general_summary']['total_occurrences'],
            1
        )
        self.assertGreater(
            response.data['general_summary']['total_taxa'],
            1
        )
        self.assertTrue(len(response.data['fish']) > 0)
        self.assertEqual(len(response.data['algae']['division']), 1)

    def test_get_autocomplete(self):
        view = autocomplete
        TaxonGroupF.create(
            name='algae',
            category=TaxonomicGroupCategory.SPECIES_MODULE.name,
            taxonomies=(self.taxonomy_1,),
            chart_data='division'
        )

        TaxonGroupF.create(
            name='fish',
            category=TaxonomicGroupCategory.SPECIES_MODULE.name,
            taxonomies=(self.taxonomy_2,),
            chart_data='conservation status'
        )
        request = self.factory.get(
            '%s/?q=aves' % reverse('autocomplete-search'))
        response = view(request)
        self.assertTrue(response.status_code == 200)

        content = json.loads(response.content)
        self.assertTrue(len(content['results']) > 0)

    @factory.django.mute_signals(signals.pre_save, signals.post_save)
    def test_send_notification_to_validator(self):
        client = TenantClient(self.tenant)
        user = UserF.create(is_superuser=True)
        client.login(
            username=user.username,
            password='password'
        )
        new_site = LocationSiteF.create()
        api_url = '/api/send-email-validation/'
        res = client.get(api_url, {'pk': new_site.pk, 'model': 'Site'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        new_site = LocationSite.objects.get(pk=new_site.pk)
        self.assertEqual(new_site.ready_for_validation, True)

    def test_get_taxon_images(self):
        taxon = TaxonomyF.create(
            scientific_name=u'Golden fish',
        )
        image = TaxonImageF.create(
            taxon_image='taxon_images/im_U5BfJrC.jpg',
            taxonomy=taxon
        )
        view = TaxonImageList.as_view()
        request = self.factory.get('/api/taxon-images/' + str(taxon.pk))
        response = view(request, str(taxon.pk))
        self.assertEqual(
            image.taxon_image.url,
            response.data[0]['url']
        )
