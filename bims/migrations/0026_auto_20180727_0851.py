# -*- coding: utf-8 -*-
# Generated by Django 1.11.11 on 2018-07-27 08:51
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('bims', '0025_locationsite_location_context_document'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='locationsite',
            name=b'location_context',
        ),
        migrations.DeleteModel(
            name='LocationContext',
        ),
    ]
