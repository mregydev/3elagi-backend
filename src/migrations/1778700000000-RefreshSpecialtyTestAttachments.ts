import { MigrationInterface, QueryRunner } from 'typeorm';

/** Replace generic Unsplash placeholders on specialty test patient records. */
export class RefreshSpecialtyTestAttachments1778700000000 implements MigrationInterface {
  name = 'RefreshSpecialtyTestAttachments1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE medical_documents md
      SET
        file_url = CASE
          WHEN md.type = 'lab' THEN
            'https://upload.wikimedia.org/wikipedia/commons/f/f8/CMP_report.JPG'
          ELSE
            'https://upload.wikimedia.org/wikipedia/commons/a/a1/Normal_posteroanterior_%28PA%29_chest_radiograph_%28X-ray%29.jpg'
        END,
        file_name = CASE
          WHEN md.type = 'lab' THEN 'lab-results.jpg'
          ELSE 'imaging.jpg'
        END
      FROM patient_profiles pp
      WHERE md.patient_id = pp.user_id
        AND pp.is_specialty_test_account = TRUE
        AND md.file_url LIKE '%unsplash.com%'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-reversible — demo attachment URLs only.
  }
}
