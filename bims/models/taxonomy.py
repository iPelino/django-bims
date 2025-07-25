import json
import re
from datetime import date

from django.conf import settings
from django.template.loader import render_to_string
from django.utils.formats import date_format
from django.utils.functional import cached_property
from taggit.managers import TaggableManager
from taggit.models import GenericTaggedItemBase, TagBase, TaggedItemBase

from bims.models.cites_listing_info import CITESListingInfo
from bims.models.source_reference import SourceReference
from bims.models.validation import AbstractValidation
from django.db import models
from django.dispatch import receiver

from bims.enums.taxonomic_status import TaxonomicStatus
from bims.enums.taxonomic_rank import TaxonomicRank
from bims.models.iucn_status import IUCNStatus
from bims.models.endemism import Endemism
from bims.utils.domain import get_current_domain
from bims.utils.iucn import get_iucn_status
from bims.models.vernacular_name import VernacularName
from bims.models.notification import (
    get_recipients_for_notification,
    NEW_TAXONOMY
)
from django.db.models import JSONField, OuterRef, Subquery, signals

ORIGIN_CATEGORIES = {
    'non-native': 'alien',
    'native': 'indigenous',
    'unknown': 'unknown',
    'non-native: invasive': 'alien-invasive',
    'non-native: non-invasive': 'alien-non-invasive'
}


class TaxonTag(TagBase):
    name = models.CharField(
        verbose_name="A taxon tag name",
        unique=False,
        max_length=100
    )
    doubtful = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Taxonomy Tag"
        verbose_name_plural = "Taxonomy Tags"


class CustomTaggedTaxonomy(TaggedItemBase):
    content_object = models.ForeignKey(
        'Taxonomy',
        on_delete=models.CASCADE)
    tag = models.ForeignKey(
        TaxonTag,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_items",
    )

    class Meta:
        verbose_name = "Custom Tagged Taxonomy"
        verbose_name_plural = "Custom Tagged Taxa"


class TaxonomyField(models.CharField):

    description = 'A taxonomy field.'

    def __init__(self, taxonomy_key=None, *args, **kwargs):
        kwargs['max_length'] = 100
        kwargs['blank'] = True
        kwargs['default'] = ''
        self.taxonomy_key = taxonomy_key
        super(TaxonomyField, self).__init__(*args, **kwargs)


class AbstractTaxonomy(AbstractValidation):
    CATEGORY_CHOICES = (
        ('alien', 'Non-Native'),
        ('indigenous', 'Native'),
        ('unknown', 'Unknown'),
        ('alien-invasive', 'Non-native: invasive'),
        ('alien-non-invasive', 'Non-native: non-invasive')
    )
    tags = TaggableManager(
        blank=True,
    )

    biographic_distributions = TaggableManager(
        through=CustomTaggedTaxonomy,
        related_name='bio_distribution',
        blank=True,
        verbose_name='Biographic Distributions'
    )

    invasion = models.ForeignKey(
        'bims.Invasion',
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    fada_id = models.IntegerField(
        verbose_name='FADA ID',
        unique=True,
        null=True,
        blank=True
    )

    gbif_key = models.IntegerField(
        verbose_name='GBIF Key',
        null=True,
        blank=True
    )

    verified = models.BooleanField(
        help_text='The data has been verified',
        default=False
    )

    scientific_name = models.CharField(
        verbose_name='Scientific Name',
        max_length=200,
        null=False,
        blank=False
    )

    canonical_name = models.CharField(
        verbose_name='Canonical Name',
        max_length=200,
        null=True,
        blank=True,
        db_index=True
    )

    legacy_canonical_name = models.CharField(
        verbose_name='Legacy Canonical Name',
        max_length=700,
        blank=True,
        default=''
    )

    rank = models.CharField(
        verbose_name='Taxonomic Rank',
        max_length=50,
        choices=[(rank.name, rank.value) for rank in TaxonomicRank],
        blank=True,
    )

    vernacular_names = models.ManyToManyField(
        to=VernacularName,
        blank=True,
    )

    taxonomic_status = models.CharField(
        verbose_name='Taxonomic Status',
        max_length=50,
        choices=[(status.name, status.value) for status in TaxonomicStatus],
        blank=True
    )

    parent = models.ForeignKey(
        verbose_name='Parent',
        to='self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    national_conservation_status = models.ForeignKey(
        IUCNStatus,
        models.SET_NULL,
        related_name='national_conservation_status',
        verbose_name='National Conservation Status',
        null=True,
        blank=True,
    )

    iucn_status = models.ForeignKey(
        IUCNStatus,
        models.SET_NULL,
        verbose_name='Global Red List Status (IUCN)',
        null=True,
        blank=True,
    )

    iucn_redlist_id = models.IntegerField(
        verbose_name='IUCN taxon id',
        null=True,
        blank=True
    )

    iucn_data = models.TextField(
        verbose_name='Data from IUCN',
        null=True,
        blank=True
    )

    endemism = models.ForeignKey(
        Endemism,
        models.SET_NULL,
        verbose_name='Endemism',
        null=True,
        blank=True
    )

    origin = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        blank=True,
        default='',
        help_text='Origin'
    )

    author = models.CharField(
        verbose_name='Author',
        max_length=200,
        null=True,
        blank=True
    )

    gbif_data = JSONField(
        verbose_name='Json data from gbif',
        null=True,
        blank=True
    )

    additional_data = JSONField(
        verbose_name='Additional json data',
        null=True,
        blank=True
    )

    import_date = models.DateField(
        default=date.today,
        blank=True,
        null=True,
    )

    accepted_taxonomy = models.ForeignKey(
        related_name='synonym',
        to='self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    hierarchical_data = JSONField(
        verbose_name='Hierarchical Data',
        null=True,
        blank=True
    )

    source_reference = models.ForeignKey(
        SourceReference,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='%(class)s_source_reference',
    )

    class Meta:
        abstract = True

    @property
    def data_name(self):
        return self.canonical_name

    @cached_property
    def common_name(self):
        vernacular_names = list(
            self.vernacular_names.filter(
                language__istartswith='en'
            ).values_list('name', flat=True))
        if len(vernacular_names) == 0:
            return ''
        else:
            return vernacular_names[0]

    @cached_property
    def cites_listing(self):
        cites_listing_info = CITESListingInfo.objects.filter(
            taxonomy_id=self.id
        )
        if cites_listing_info.exists():
            return ','.join(list(cites_listing_info.values_list(
                'appendix', flat=True
            )))
        if self.additional_data:
            if 'CITES Listing' in self.additional_data:
                return self.additional_data['CITES Listing']
            if 'Cites listing' in self.additional_data:
                return self.additional_data['Cites listing']
            if 'CITES listing' in self.additional_data:
                return self.additional_data['CITES listing']
        return ''

    @property
    def taxon_class(self):
        if self.rank != TaxonomicRank.CLASS.name and self.parent:
            return self.parent.taxon_class
        if self.rank == TaxonomicRank.CLASS.name:
            return self
        return None

    def get_parent_by_rank(self, rank):
        limit = 20
        current_try = 0
        _taxon = self
        _parent = _taxon.parent if _taxon.parent else None
        _rank = _taxon.rank
        while (
                _parent and _rank
                and _rank != rank
                and current_try < limit
        ):
            current_try += 1
            _taxon = _parent
            _rank = _taxon.rank
            _parent = _taxon.parent if _taxon.parent else None

        if _rank == rank:
            return _taxon
        return None

    def get_taxon_rank_name(self, rank):
        limit = 20
        current_try = 0
        _taxon = self
        _parent = _taxon.parent if _taxon.parent else None
        _rank = _taxon.rank
        while (
                _parent and _rank
                and _rank != rank
                and current_try < limit
        ):
            current_try += 1
            _taxon = _parent
            _rank = _taxon.rank
            _parent = _taxon.parent if _taxon.parent else None

        if _rank == rank:
            return _taxon.canonical_name
        return ''

    @property
    def class_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.CLASS.name)

    @property
    def kingdom_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.KINGDOM.name)

    @property
    def phylum_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.PHYLUM.name)

    @property
    def order_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.ORDER.name)

    @property
    def family_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.FAMILY.name)

    @property
    def genus(self):
        return self.get_parent_by_rank(TaxonomicRank.GENUS.name)

    @property
    def genus_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.GENUS.name)

    @property
    def sub_genus_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.SUBGENUS.name)

    @cached_property
    def full_species_name(self):
        genus_name = self.get_taxon_rank_name(TaxonomicRank.GENUS.name)
        species_name = self.species_name
        if genus_name not in species_name:
            return genus_name + ' ' + species_name
        return species_name

    @property
    def species_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.SPECIES.name)

    @property
    def specific_epithet(self):
        species_name = self.species_name
        genus_name = self.get_taxon_rank_name(TaxonomicRank.GENUS.name)
        if genus_name in species_name:
            pattern = r'^' + re.escape(genus_name) + r'\s+'
            return re.sub(pattern, '', species_name).strip()
        return species_name

    @property
    def sub_species_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.SUBSPECIES.name)

    @property
    def sub_family_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.SUBFAMILY.name)

    @property
    def tribe_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.TRIBE.name)

    @property
    def sub_tribe_name(self):
        return self.get_taxon_rank_name(TaxonomicRank.SUBTRIBE.name)

    @property
    def variety_name(self):
        self.get_taxon_rank_name(TaxonomicRank.VARIETY.name)

    @property
    def taxon_name(self):
        if self.rank.lower() == 'subspecies':
            canonical_names = self.canonical_name.split(' ')
            if len(canonical_names) >= 3:
                return canonical_names[-1]
            return self.canonical_name.split(self.full_species_name)[-1].strip()
        if self.is_species and self.genus_name:
            return self.canonical_name.split(self.genus_name)[-1].strip()
        return self.canonical_name

    @property
    def is_species(self):
        return (
            self.rank == TaxonomicRank.SPECIES.name or
            self.rank == TaxonomicRank.SUBSPECIES.name
        )

    @property
    def name(self):
        if self.canonical_name:
            return self.canonical_name
        elif self.scientific_name:
            return self.scientific_name
        return '-'

    @cached_property
    def last_modified(self):
        from easyaudit.models import CRUDEvent
        last_update_event = CRUDEvent.objects.filter(
            object_id=self.id,
            content_type__model=self._meta.model_name,
            event_type=CRUDEvent.UPDATE
        ).order_by('-datetime').first()

        if last_update_event:
            return date_format(
                last_update_event.datetime, format='F j, Y', use_l10n=True)
        return self.import_date

    @cached_property
    def last_modified_by(self):
        from bims.models.taxonomy_update_proposal import (
            TaxonomyUpdateProposal
        )
        from easyaudit.models import CRUDEvent
        taxon_proposal = TaxonomyUpdateProposal.objects.filter(
            original_taxonomy=self
        ).order_by('-id')
        if taxon_proposal.exists():
            return taxon_proposal.first().collector_user

        crud_event = CRUDEvent.objects.filter(
            content_type__model=self._meta.model_name,
            object_id=self.id,
            event_type=CRUDEvent.UPDATE
        ).order_by('-datetime')

        if crud_event.exists():
            return crud_event.first().user

        return None

class Taxonomy(AbstractTaxonomy):
    CATEGORY_CHOICES = (
        (ORIGIN_CATEGORIES['non-native'], 'Non-Native'),
        (ORIGIN_CATEGORIES['native'], 'Native'),
        (ORIGIN_CATEGORIES['unknown'], 'Unknown'),
        (ORIGIN_CATEGORIES['non-native: invasive'], 'Non-native: invasive'),
        (
            ORIGIN_CATEGORIES['non-native: non-invasive'],
            'Non-native: non-invasive'
        )
    )
    CATEGORY_CHOICES_DICT = {
        ORIGIN_CATEGORIES['non-native']: 'Non-Native',
        ORIGIN_CATEGORIES['native']: 'Native',
        ORIGIN_CATEGORIES['unknown']: 'Unknown',
        ORIGIN_CATEGORIES['non-native: invasive']: 'Non-native: invasive',
        ORIGIN_CATEGORIES['non-native: non-invasive']: 'Non-native: non-invasive'
    }

    def save_json_data(self, json_field):
        max_allowed = 10
        attempt = 0
        is_dictionary = False
        json_data = {}
        if not json_field:
            return json_data
        while not is_dictionary and attempt < max_allowed:
            if not json_field:
                break
            if isinstance(json_field, dict):
                is_dictionary = True
                json_data = json_field
            else:
                json_data = json.loads(json_field)
                attempt += 1
        return json_data

    # noinspection PyClassicStyleClass
    class Meta:
        """Meta class for project."""
        app_label = 'bims'
        verbose_name_plural = 'Taxa'
        verbose_name = 'Taxonomy'

    def __unicode__(self):
        return '%s - %s' % (
            self.scientific_name,
            self.rank
        )

    def __str__(self):
        return '%s - %s' % (
            self.scientific_name,
            self.rank
        )

    def get_direct_children(self):
        children = Taxonomy.objects.filter(
            parent=self
        )
        return children

    def get_all_children(self):
        query = {}
        parent = ''
        or_condition = models.Q()
        for i in range(6):  # species to class
            parent += 'parent__'
            query[parent + 'in'] = [self]
        for key, value in query.items():
            or_condition |= models.Q(**{key: value})
        return Taxonomy.objects.filter(or_condition)

    def parent_by_rank(self, rank):
        taxon = self
        current_rank = taxon.rank
        while current_rank != rank and taxon.parent:
            taxon = taxon.parent
            current_rank = taxon.rank
        if current_rank == rank:
            return taxon
        return None


    def save(self, *args, **kwargs):
        update_taxon_with_gbif = False
        if self.gbif_data:
            self.gbif_data = self.save_json_data(self.gbif_data)
        if self.additional_data:
            self.additional_data = self.save_json_data(self.additional_data)
        if self.additional_data and 'fetch_gbif' in self.additional_data:
            update_taxon_with_gbif = True
            del self.additional_data['fetch_gbif']
        species_name = ''
        if not self.hierarchical_data or 'species_name' not in self.hierarchical_data:
            species_name = self.species_name
            genus_name = self.genus_name
            if genus_name in species_name and genus_name:
                species_name = species_name.split(genus_name)[-1].strip()
        if not self.hierarchical_data:
            self.hierarchical_data = {
                'family_name': self.get_taxon_rank_name(TaxonomicRank.FAMILY.name),
                'genus_name': self.get_taxon_rank_name(TaxonomicRank.GENUS.name),
                'species_name': species_name
            }
        elif 'family_name' not in self.hierarchical_data:
            self.hierarchical_data['family_name'] = self.get_taxon_rank_name(TaxonomicRank.FAMILY.name)
        elif 'genus_name' not in self.hierarchical_data:
            self.hierarchical_data['genus_name'] = self.get_taxon_rank_name(TaxonomicRank.GENUS.name)
        elif 'species_name' not in self.hierarchical_data:
            self.hierarchical_data['species_name'] = species_name

        super(Taxonomy, self).save(*args, **kwargs)

        if update_taxon_with_gbif:
            from bims.utils.fetch_gbif import fetch_all_species_from_gbif
            fetch_all_species_from_gbif(
                species=self.scientific_name,
                parent=self.parent,
                gbif_key=self.gbif_key,
                fetch_vernacular_names=True)

    def get_experts_email(self, taxon_group, max_depth=10):
        experts = set()
        depth = 0
        while taxon_group and depth < max_depth:
            expert_email = taxon_group.experts.values_list('email', flat=True)
            experts.update(expert_email)
            taxon_group = taxon_group.parent
            depth += 1
        return list(experts)

    def send_new_taxon_email(self, taxon_group_id=None):
        from bims.models import TaxonGroup
        from bims.tasks.send_notification import send_mail_notification

        current_site = get_current_domain()
        recipients = get_recipients_for_notification(NEW_TAXONOMY)
        taxon_group = TaxonGroup.objects.get(id=taxon_group_id)

        # Get experts
        experts_email = self.get_experts_email(
            taxon_group=taxon_group
        )
        recipients = list(set(experts_email + recipients))

        email_body = render_to_string(
            'notifications/taxonomy/added_message.txt',
            {
                'taxonomy': self,
                'current_site': current_site,
                'taxon_group': taxon_group
            }
        )
        subject = '[{}] Taxon Validation Required'.format(current_site)
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = recipients

        send_mail_notification.delay(subject, email_body, from_email, recipient_list)

    def send_updated_taxon_email(self, taxon_group_id=None, creator=None):
        from bims.models import TaxonGroup
        from bims.tasks.send_notification import send_mail_notification

        current_site = get_current_domain()
        recipients = get_recipients_for_notification(NEW_TAXONOMY)
        taxon_group = TaxonGroup.objects.get(id=taxon_group_id)

        # Get experts
        experts_email = self.get_experts_email(
            taxon_group=taxon_group
        )
        recipients = list(set(experts_email + recipients))

        email_body = render_to_string(
            'notifications/taxonomy/updated_message.txt',
            {
                'taxonomy': self,
                'current_site': current_site,
                'taxon_group': taxon_group,
                'creator': creator
            }
        )
        subject = '[{}] Taxon Validation Required'.format(current_site)
        from_email = settings.DEFAULT_FROM_EMAIL
        recipient_list = recipients

        send_mail_notification.delay(subject, email_body, from_email, recipient_list)


@receiver(models.signals.pre_save, sender=Taxonomy)
def taxonomy_pre_save_handler(sender, instance: Taxonomy, **kwargs):
    """Set IUCN status and redlist ID before saving taxonomy."""
    if instance.is_species and not instance.iucn_status:
        iucn_status, sis_id, iucn_url = get_iucn_status(taxon=instance)
        if iucn_status:
            instance.iucn_status = iucn_status
        else:
            try:
                instance.iucn_status = IUCNStatus.objects.get(category='NE')
            except IUCNStatus.DoesNotExist:
                instance.iucn_status = IUCNStatus.objects.create(category='NE')
            except IUCNStatus.MultipleObjectsReturned:
                instance.iucn_status = IUCNStatus.objects.filter(category='NE').first()

        if sis_id:
            instance.iucn_redlist_id = sis_id

        if iucn_url:
            instance.iucn_data = {
                'url': iucn_url
            }


class TaxonImage(models.Model):

    taxon_image = models.ImageField(
        upload_to='taxon_images',
        null=True,
        blank=True
    )
    taxonomy = models.ForeignKey(
        Taxonomy, on_delete=models.CASCADE
    )
    source = models.CharField(
        max_length=256,
        blank=True,
        default=''
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='User who uploaded the taxon image (Optional)',
        related_name='taxon_image_uploader'
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text='Owner of the taxon image (Optional)',
        related_name='taxon_image_owner'
    )
    date = models.DateField(
        null=True,
        blank=True
    )
    survey = models.ForeignKey(
        'bims.Survey',
        null=True,
        blank=True,
        on_delete=models.CASCADE
    )


def check_taxa_duplicates(taxon_name, taxon_rank):
    """
    Check for taxa duplicates, then merge if found
    :param taxon_name: Name of the taxon to check
    :param taxon_rank: Rank of the taxon to check
    :return: Merged taxonomy
    """
    from django.db.models import Q, Min
    from bims.utils.gbif import get_species
    from bims.utils.fetch_gbif import merge_taxa_data

    taxon_rank = taxon_rank.strip().upper()
    taxon_name = taxon_name.strip()
    taxa = Taxonomy.objects.filter(
        Q(canonical_name__iexact=taxon_name) |
        Q(legacy_canonical_name__icontains=taxon_name),
        rank=taxon_rank
    )
    if not taxa.count() > 1:
        return
    preferred_taxa = taxa
    accepted_taxa = taxa.filter(taxonomic_status='ACCEPTED')
    if accepted_taxa.exists():
        preferred_taxa = accepted_taxa
    preferred_taxon = preferred_taxa.values('gbif_key', 'id').annotate(
        Min('gbif_key')).order_by('gbif_key')[0]
    preferred_taxon_gbif_data = get_species(preferred_taxon['gbif_key'])
    preferred_taxon = Taxonomy.objects.get(
        id=preferred_taxon['id']
    )
    for taxon in taxa[1:]:
        gbif_data = get_species(taxon.gbif_key)
        if not preferred_taxon_gbif_data:
            preferred_taxon = taxon
            preferred_taxon_gbif_data = gbif_data
            continue
        if not gbif_data:
            continue
        if gbif_data['taxonomicStatus'] == 'ACCEPTED':
            preferred_taxon_gbif_data = gbif_data
            preferred_taxon = taxon
            continue
        if 'issues' in gbif_data and len(gbif_data['issues']) > 0:
            continue
        if 'nubKey' not in gbif_data:
            continue
        if (
            'taxonomicStatus' in gbif_data and
            gbif_data['taxonomicStatus'] != 'ACCEPTED'
        ):
            continue
        if 'key' not in preferred_taxon_gbif_data:
            preferred_taxon = taxon
            preferred_taxon_gbif_data = gbif_data
            continue
        if (
            'key' in gbif_data and
            gbif_data['key'] > preferred_taxon_gbif_data['key']
        ):
            continue
        preferred_taxon = taxon
        preferred_taxon_gbif_data = gbif_data

    merge_taxa_data(
        taxa_list=taxa.exclude(id=preferred_taxon.id),
        excluded_taxon=preferred_taxon
    )
    return preferred_taxon


