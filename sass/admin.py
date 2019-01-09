# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib import admin
from django_extensions.admin import ForeignKeyAutocompleteAdmin
from sass.models import (
    River,
    SiteVisit,
    SassBiotope
)


class RiverAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'validated')
    list_filter = ('owner',)
    ordering = ('name', 'owner', 'validated')


class SiteVisitAdmin(ForeignKeyAutocompleteAdmin):
    list_display = (
        'location_site',
        'assessor',
        'site_visit_date',
        'water_level',
        'water_turbidity',
        'canopy_cover'
    )
    list_filter = (
        'water_level',
        'water_turbidity',
        'canopy_cover'
    )
    raw_id_fields = (
        'location_site',
    )


class SassBiotopeAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'display_order',
        'biotope_form'
    )
    list_filter = (
        'name',
    )
    ordering = (
        'name',
        'display_order',
        'biotope_form'
    )

# Register your models here.
admin.site.register(River, RiverAdmin)
admin.site.register(SiteVisit, SiteVisitAdmin)
admin.site.register(SassBiotope, SassBiotopeAdmin)
