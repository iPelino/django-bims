import factory
from django.db.models import signals
from django.test import TestCase
from django_tenants.test.cases import FastTenantTestCase
from django_tenants.test.client import TenantClient

from bims.tests.model_factories import (
    LocationSiteF,
    UserF
)
from sass.tests.model_factories import (
    SiteVisitF
)
from sass.models import SiteVisit


class TestSiteVisitFormView(FastTenantTestCase):

    def setUp(self):
        self.client = TenantClient(self.tenant)

    def test_site_visit_form_view(self):
        site = LocationSiteF.create()
        site_visit = SiteVisitF.create(
            location_site=site
        )
        response = self.client.get(
            '/sass/view/{}/'.format(site_visit.id)
        )
        self.assertEqual(
            response.context['sass_version'],
            5
        )

    @factory.django.mute_signals(signals.pre_save, signals.post_save)
    def test_common_user_delete_site_visit(self):
        """Test common user deleting site visit"""
        user = UserF.create()
        self.client.login(
            username=user.username,
            password='password'
        )
        site_visit = SiteVisitF.create()
        self.client.post(
            '/sass/delete/{}/'.format(
                site_visit.id
            )
        )
        self.assertTrue(SiteVisit.objects.filter(id=site_visit.id).exists())

    @factory.django.mute_signals(signals.pre_save, signals.post_save)
    def test_super_user_delete_site_visit(self):
        """Test super user deleting site visit"""
        user = UserF.create(is_superuser=True)
        self.client.login(
            username=user.username,
            password='password'
        )
        site_visit = SiteVisitF.create()
        self.client.post(
            '/sass/delete/{}/'.format(
                site_visit.id
            )
        )
        self.assertFalse(SiteVisit.objects.filter(id=site_visit.id).exists())

    @factory.django.mute_signals(signals.pre_save, signals.post_save)
    def test_owner_user_delete_site_visit(self):
        """Test owner user deleting site visit"""
        user = UserF.create()
        self.client.login(
            username=user.username,
            password='password'
        )
        site_visit = SiteVisitF.create(
            owner=user
        )
        self.client.post(
            '/sass/delete/{}/'.format(
                site_visit.id
            )
        )
        self.assertFalse(SiteVisit.objects.filter(id=site_visit.id).exists())
