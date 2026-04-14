# Manually created migration — safe conditional rename for prod compatibility.
# The auto-generated version on prod (same RenameIndex) fails if the old index
# does not physically exist in the database (e.g. restored prod DB).
# We use SeparateDatabaseAndState: state tracks the rename, DB uses conditional SQL.

from django.db import migrations


def rename_index_if_exists(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'message_reci_user_id_5eca30_idx'
            ) THEN
                ALTER INDEX message_reci_user_id_5eca30_idx
                RENAME TO message_rec_user_id_8e0a65_idx;
            END IF;
        END $$;
    """)


def reverse_rename_index_if_exists(apps, schema_editor):
    if schema_editor.connection.vendor != 'postgresql':
        return
    schema_editor.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'message_rec_user_id_8e0a65_idx'
            ) THEN
                ALTER INDEX message_rec_user_id_8e0a65_idx
                RENAME TO message_reci_user_id_5eca30_idx;
            END IF;
        END $$;
    """)


class Migration(migrations.Migration):

    dependencies = [
        ('communications', '0005_add_schedule_and_footer'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    rename_index_if_exists,
                    reverse_rename_index_if_exists,
                ),
            ],
            state_operations=[
                migrations.RenameIndex(
                    model_name='messagerecipient',
                    new_name='message_rec_user_id_8e0a65_idx',
                    old_name='message_reci_user_id_5eca30_idx',
                ),
            ],
        ),
    ]
