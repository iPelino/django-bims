# -*- coding: utf-8 -*-
# Generated by Django 1.11.23 on 2019-10-28 06:43
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('bims', '0196_auto_20191027_0911'),
    ]

    operations = [
        migrations.CreateModel(
            name='LocationContextFilter',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('display_order', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='LocationContextGroup',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('key', models.CharField(blank=True, default=b'', max_length=100)),
                ('name', models.CharField(blank=True, default=b'', max_length=255)),
                ('layer_name', models.CharField(blank=True, default=b'', max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='LocationContextGroupOrder',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('display_order', models.IntegerField()),
                ('filter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='bims.LocationContextFilter')),
                ('group', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='bims.LocationContextGroup')),
            ],
        ),
        migrations.AddField(
            model_name='locationcontextfilter',
            name='location_context_groups',
            field=models.ManyToManyField(through='bims.LocationContextGroupOrder', to='bims.LocationContextGroup'),
        ),
    ]
