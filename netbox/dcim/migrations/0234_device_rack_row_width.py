import decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('dcim', '0241_nullify_empty_cable_end'),
    ]

    operations = [
        migrations.AddField(
            model_name='devicetype',
            name='rack_position_width',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=1.0,
                help_text='Default fraction of a rack row occupied by devices of this type',
                max_digits=3,
                validators=[
                    django.core.validators.MinValueValidator(decimal.Decimal('0.01')),
                    django.core.validators.MaxValueValidator(decimal.Decimal('1.00')),
                ],
                verbose_name='rack row width',
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='rack_position_offset',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=0,
                help_text='Horizontal offset from the left edge of the rack row, as a fraction of row width',
                max_digits=3,
                validators=[
                    django.core.validators.MinValueValidator(decimal.Decimal('0.00')),
                    django.core.validators.MaxValueValidator(decimal.Decimal('1.00')),
                ],
                verbose_name='rack row offset',
            ),
        ),
        migrations.AddField(
            model_name='device',
            name='rack_position_width',
            field=models.DecimalField(
                blank=True,
                decimal_places=2,
                default=1.0,
                help_text='Fraction of a rack row occupied by this device',
                max_digits=3,
                validators=[
                    django.core.validators.MinValueValidator(decimal.Decimal('0.01')),
                    django.core.validators.MaxValueValidator(decimal.Decimal('1.00')),
                ],
                verbose_name='rack row width',
            ),
            preserve_default=False,
        ),
        migrations.RemoveConstraint(
            model_name='device',
            name='dcim_device_unique_rack_position_face',
        ),
        migrations.AddIndex(
            model_name='device',
            index=models.Index(fields=['rack', 'position', 'face'], name='dcim_device_rack_pos_face_idx'),
        ),
    ]
