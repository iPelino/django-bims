# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.contrib import admin
from django_extensions.admin import ForeignKeyAutocompleteAdmin
from sass.models import (
    River,
    SiteVisit,
    SassBiotopeFraction,
    Rate,
    SassTaxon
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


class RateAdmin(admin.ModelAdmin):
    list_display = (
        'rate',
        'description',
        'group'
    )


class SassBiotopeFractionAdmin(admin.ModelAdmin):
    list_display = (
        'rate',
        'sass_biotope'
    )
    list_filter = (
        'rate',
        'sass_biotope'
    )


class SassTaxonAdmin(admin.ModelAdmin):
    list_display = (
        'taxon',
        'score'
    )


# Register your models here.
admin.site.register(River, RiverAdmin)
admin.site.register(SiteVisit, SiteVisitAdmin)
admin.site.register(Rate, RateAdmin)
admin.site.register(SassBiotopeFraction, SassBiotopeFractionAdmin)
admin.site.register(SassTaxon, SassTaxonAdmin)