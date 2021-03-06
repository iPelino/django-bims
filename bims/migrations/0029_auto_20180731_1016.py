# -*- coding: utf-8 -*-
# Generated by Django 1.11 on 2018-07-31 10:16
from __future__ import unicode_literals

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('bims', '0028_merge_20180731_1015'),
    ]

    operations = [
        migrations.CreateModel(
            name='Pageview',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('url', models.TextField(editable=False)),
                ('referer', models.TextField(editable=False, null=True)),
                ('query_string', models.TextField(editable=False, null=True)),
                ('method', models.CharField(max_length=20, null=True)),
                ('view_time', models.DateTimeField()),
            ],
            options={
                'ordering': ('-view_time',),
            },
        ),
        migrations.CreateModel(
            name='Visitor',
            fields=[
                ('session_key', models.CharField(max_length=40, primary_key=True, serialize=False)),
                ('ip_address', models.CharField(editable=False, max_length=39)),
                ('user_agent', models.TextField(editable=False, null=True)),
                ('start_time', models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ('expiry_age', models.IntegerField(editable=False, null=True)),
                ('expiry_time', models.DateTimeField(editable=False, null=True)),
                ('time_on_site', models.IntegerField(editable=False, null=True)),
                ('end_time', models.DateTimeField(editable=False, null=True)),
                ('user', models.ForeignKey(editable=False, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='visit_history', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ('-start_time',),
                'permissions': (('view_visitor', 'Can view visitor'),),
            },
        ),
        migrations.DeleteModel(
            name='CSVDocument',
        ),
        migrations.AddField(
            model_name='pageview',
            name='visitor',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='pageviews', to='bims.Visitor'),
        ),
    ]
