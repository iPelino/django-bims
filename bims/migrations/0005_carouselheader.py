# Generated by Django 2.0.4 on 2018-05-28 12:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bims', '0004_biologicalcollectionrecord_validated'),
    ]

    operations = [
        migrations.CreateModel(
            name='CarouselHeader',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('banner', models.ImageField(upload_to='banner')),
                ('description', models.TextField(blank=True, default='')),
            ],
        ),
    ]
