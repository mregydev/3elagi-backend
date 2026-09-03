import { MigrationInterface, QueryRunner } from 'typeorm';

const BASE =
  'https://hjluqxfmvpvtjvwzqxgi.supabase.co/storage/v1/object/public/files/static/test-attachments';

/** Swap specialty test patient attachments to realistic imaging per speciality. */
export class SpecialtyTestAttachmentsRealistic1778720000000
  implements MigrationInterface
{
  name = 'SpecialtyTestAttachmentsRealistic1778720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const testPatient = `
      FROM patient_profiles pp
      WHERE md.patient_id = pp.user_id
        AND pp.is_specialty_test_account = TRUE
    `;

    await queryRunner.query(`
      UPDATE medical_documents md
      SET
        title = 'Chest X-ray',
        notes = 'Cardiomegaly noted — enlarged cardiac silhouette; correlate with echo and BNP.',
        body_part = 'heart',
        type = 'xray',
        file_url = '${BASE}/cardiology-chest-xray.png',
        file_name = 'cardiology-chest-xray.png'
      ${testPatient}
        AND md.title IN ('Echocardiogram snapshot', 'Chest X-ray')
    `);

    await queryRunner.query(`
      UPDATE medical_documents md
      SET
        title = 'Mole analysis report',
        notes = '6×7 mm lesion on right lower leg — asymmetry and pigment network; excision recommended (melanoma vs atypical naevus).',
        body_part = 'right_leg',
        type = 'lab',
        file_url = '${BASE}/dermatology-molesafe-report.png',
        file_name = 'dermatology-molesafe-report.png'
      ${testPatient}
        AND md.title IN ('Dermoscopy — forearm lesion', 'Mole analysis report')
    `);

    await queryRunner.query(`
      UPDATE medical_documents md
      SET
        title = 'Forearm X-ray — post ORIF',
        notes = 'Radius mid-shaft fracture treated with plate and screws; alignment satisfactory at 6-week follow-up.',
        body_part = 'left_arm',
        type = 'xray',
        file_url = '${BASE}/orthopedics-forearm-orif.png',
        file_name = 'orthopedics-forearm-orif.png'
      ${testPatient}
        AND md.title IN ('Left knee X-ray', 'Forearm X-ray — post ORIF')
    `);

    await queryRunner.query(`
      UPDATE medical_documents md
      SET
        notes = 'Full dentition visible; lower-right molar shows prior root canal treatment.',
        file_url = '${BASE}/dentistry-panoramic-xray.png',
        file_name = 'dentistry-panoramic-xray.png'
      ${testPatient}
        AND md.title = 'Panoramic dental X-ray'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-reversible — demo attachment URLs only.
  }
}
