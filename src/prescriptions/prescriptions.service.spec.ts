import { expect } from 'chai';
import * as sinon from 'sinon';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';

// ---------------------------------------------------------------------------
// Minimal stubs — no database, no NestJS runtime needed
// ---------------------------------------------------------------------------

function makePatientProfile(overrides: Partial<{ id: string; user_id: string; name: string; phone: string }> = {}) {
  return {
    id: 'profile-1',
    user_id: 'patient-user-1',
    name: 'Ahmed Ali',
    phone: '01012345678',
    ...overrides,
  };
}

function makeDoctor(overrides: Partial<{ id: string; user_id: string; name: string; default_clinic_id: string | null; digital_signature_url: string | null; personal_clinic_location: string | null; phone: string | null }> = {}) {
  return {
    id: 'doctor-1',
    user_id: 'doctor-user-1',
    name: 'Dr. Hassan',
    default_clinic_id: null,
    digital_signature_url: null,
    personal_clinic_location: null,
    phone: null,
    ...overrides,
  };
}

function makePrescription(overrides: Partial<{
  id: string;
  doctor_id: string | null;
  patient_id: string | null;
  patient_user_id: string | null;
  clinic_id: string | null;
  title: string;
  symptoms: string | null;
  image_url: string | null;
  items: unknown[];
  pdf_url: string | null;
  created_at: Date;
}> = {}) {
  return {
    id: 'rx-1',
    doctor_id: null,
    patient_id: null,
    patient_user_id: 'patient-user-1',
    clinic_id: null,
    title: 'Hypertension',
    symptoms: null,
    image_url: null,
    items: [],
    pdf_url: null,
    created_at: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildService(overrides: {
  rxRepoStub?: Partial<{
    create: sinon.SinonStub;
    save: sinon.SinonStub;
    update: sinon.SinonStub;
    find: sinon.SinonStub;
    findOne: sinon.SinonStub;
    count: sinon.SinonStub;
    createQueryBuilder: sinon.SinonStub;
  }>;
  medRepoStub?: Partial<{
    create: sinon.SinonStub;
    save: sinon.SinonStub;
    delete: sinon.SinonStub;
  }>;
  doctorRepoStub?: Partial<{ findOne: sinon.SinonStub; find: sinon.SinonStub }>;
  patientRepoStub?: Partial<{ findOne: sinon.SinonStub }>;
  clinicRepoStub?: Partial<{ findOne: sinon.SinonStub }>;
  profileRepoStub?: Partial<{ findOne: sinon.SinonStub }>;
  userRepoStub?: Partial<{ findOne: sinon.SinonStub }>;
  uploadsStub?: Partial<{ getBufferFromUrl: sinon.SinonStub; uploadFile: sinon.SinonStub }>;
  knowledgeIndexerStub?: Partial<{ indexPrescription: sinon.SinonStub }>;
  accessServiceStub?: Partial<{
    assertDoctorCanEditRecords: sinon.SinonStub;
    assertDoctorCanPrescribeForPatient: sinon.SinonStub;
    findOrCreate: sinon.SinonStub;
  }>;
  imageAnalyzerStub?: Partial<{ extractMedications: sinon.SinonStub }>;
}) {
  const rxRepo = {
    create: sinon.stub().callsFake((data) => ({ ...makePrescription(), ...data })),
    save: sinon.stub().callsFake(async (rx) => ({ ...rx, id: 'rx-saved-1' })),
    update: sinon.stub().resolves(),
    find: sinon.stub().resolves([]),
    findOne: sinon.stub().resolves(null),
    count: sinon.stub().resolves(0),
    createQueryBuilder: sinon.stub().returns({
      select: sinon.stub().returnsThis(),
      addSelect: sinon.stub().returnsThis(),
      where: sinon.stub().returnsThis(),
      andWhere: sinon.stub().returnsThis(),
      groupBy: sinon.stub().returnsThis(),
      orderBy: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      getRawMany: sinon.stub().resolves([]),
    }),
    delete: sinon.stub().resolves(),
    ...overrides.rxRepoStub,
  } as any;

  const medRepo = {
    create: sinon.stub().callsFake((data) => data),
    save: sinon.stub().resolves([]),
    delete: sinon.stub().resolves(),
    ...overrides.medRepoStub,
  } as any;

  const doctorRepo = {
    findOne: sinon.stub().resolves(null),
    find: sinon.stub().resolves([]),
    ...overrides.doctorRepoStub,
  } as any;

  const patientRepo = {
    findOne: sinon.stub().resolves(null),
    ...overrides.patientRepoStub,
  } as any;

  const clinicRepo = {
    findOne: sinon.stub().resolves(null),
    ...overrides.clinicRepoStub,
  } as any;

  const profileRepo = {
    findOne: sinon.stub().resolves(null),
    ...overrides.profileRepoStub,
  } as any;

  const userRepo = {
    findOne: sinon.stub().resolves(null),
    ...overrides.userRepoStub,
  } as any;

  const uploads = {
    getBufferFromUrl: sinon.stub().resolves(Buffer.from('')),
    uploadFile: sinon.stub().resolves({ url: 'https://storage.example.com/pdf.pdf' }),
    ...overrides.uploadsStub,
  } as any;

  const knowledgeIndexer = {
    indexPrescription: sinon.stub().resolves(),
    ...overrides.knowledgeIndexerStub,
  } as any;

  const accessService = {
    assertDoctorCanEditRecords: sinon.stub().resolves(),
    assertDoctorCanPrescribeForPatient: sinon
      .stub()
      .callsFake(async () => makeDoctor()),
    findOrCreate: sinon.stub().resolves({
      records_allowed: true,
      blocked_by_patient: false,
      blocked_by_doctor: false,
    }),
    ...overrides.accessServiceStub,
  } as any;

  const imageAnalyzer = {
    extractMedications: sinon.stub().resolves([]),
    ...overrides.imageAnalyzerStub,
  } as any;

  const service = new PrescriptionsService(
    rxRepo,
    medRepo,
    doctorRepo,
    patientRepo,
    clinicRepo,
    profileRepo,
    userRepo,
    uploads,
    knowledgeIndexer,
    accessService,
    imageAnalyzer,
  );

  return { service, rxRepo, medRepo, doctorRepo, patientRepo, clinicRepo, profileRepo, uploads };
}

// ---------------------------------------------------------------------------

describe('PrescriptionsService', () => {
  describe('createForPatientUser — image_url regression (column existence)', () => {
    it('persists image_url when provided', async () => {
      const profile = makePatientProfile({ user_id: 'patient-user-1' });
      const savedRx = makePrescription({ image_url: 'https://cdn.example.com/rx-photo.jpg', id: 'rx-saved-1' });
      savedRx.medications = [] as any;

      const { service, rxRepo, profileRepo } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(profile) },
        rxRepoStub: {
          create: sinon.stub().callsFake((data) => ({ ...makePrescription(), ...data })),
          save: sinon.stub().resolves(savedRx),
          update: sinon.stub().resolves(),
        },
      });

      const result = await service.createForPatientUser(
        {
          patient_user_id: 'patient-user-1',
          title: 'Hypertension',
          medications: [{ medication_name: 'Amlodipine' }],
          image_url: 'https://cdn.example.com/rx-photo.jpg',
        },
        'patient-user-1',
        'patient',
      );

      // The column must be forwarded to repo.create() — this is what caused the
      // "column prescription.image_url does not exist" error when the DB had
      // never received the 1778170000000-PrescriptionImageUrl migration.
      const createCall = rxRepo.create.getCall(0).args[0];
      expect(createCall).to.have.property('image_url', 'https://cdn.example.com/rx-photo.jpg');
      expect(result.image_url).to.equal('https://cdn.example.com/rx-photo.jpg');
    });

    it('stores null for image_url when not provided', async () => {
      const profile = makePatientProfile({ user_id: 'patient-user-1' });
      const savedRx = makePrescription({ image_url: null, id: 'rx-saved-2' });
      savedRx.medications = [] as any;

      const { service, rxRepo } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(profile) },
        rxRepoStub: {
          create: sinon.stub().callsFake((data) => ({ ...makePrescription(), ...data })),
          save: sinon.stub().resolves(savedRx),
          update: sinon.stub().resolves(),
        },
      });

      await service.createForPatientUser(
        {
          patient_user_id: 'patient-user-1',
          title: 'Fever',
          medications: [{ medication_name: 'Paracetamol' }],
        },
        'patient-user-1',
        'patient',
      );

      const createCall = rxRepo.create.getCall(0).args[0];
      // image_url should be null (not undefined) so TypeORM doesn't omit it
      expect(createCall.image_url).to.equal(null);
    });

    it('trims whitespace-only image_url to null', async () => {
      const profile = makePatientProfile({ user_id: 'patient-user-1' });
      const savedRx = makePrescription({ image_url: null, id: 'rx-saved-3' });
      savedRx.medications = [] as any;

      const { service, rxRepo } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(profile) },
        rxRepoStub: {
          create: sinon.stub().callsFake((data) => ({ ...makePrescription(), ...data })),
          save: sinon.stub().resolves(savedRx),
          update: sinon.stub().resolves(),
        },
      });

      await service.createForPatientUser(
        {
          patient_user_id: 'patient-user-1',
          title: 'Cold',
          medications: [{ medication_name: 'Vitamin C' }],
          image_url: '   ',
        },
        'patient-user-1',
        'patient',
      );

      const createCall = rxRepo.create.getCall(0).args[0];
      expect(createCall.image_url).to.equal(null);
    });

    it('throws BadRequestException when no medications are provided', async () => {
      const profile = makePatientProfile({ user_id: 'patient-user-1' });

      const { service } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(profile) },
      });

      let err: unknown;
      try {
        await service.createForPatientUser(
          {
            patient_user_id: 'patient-user-1',
            title: 'Flu',
            medications: [],
            image_url: 'https://cdn.example.com/image.jpg',
          },
          'patient-user-1',
          'patient',
        );
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(BadRequestException);
    });

    it('throws NotFoundException when patient profile does not exist', async () => {
      const { service } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(null) },
      });

      let err: unknown;
      try {
        await service.createForPatientUser(
          {
            patient_user_id: 'patient-user-1',
            title: 'Back Pain',
            medications: [{ medication_name: 'Ibuprofen' }],
          },
          'patient-user-1',
          'patient',
        );
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(NotFoundException);
    });

    it('throws ForbiddenException for patient trying to create for another user', async () => {
      const { service } = buildService({});

      let err: unknown;
      try {
        await service.createForPatientUser(
          {
            patient_user_id: 'other-patient-user',
            title: 'Diabetes',
            medications: [{ medication_name: 'Metformin' }],
          },
          'my-user-id',
          'patient',
        );
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(ForbiddenException);
    });

    it('allows doctor to prescribe without full medical records access', async () => {
      const profile = makePatientProfile({ user_id: 'patient-user-1' });
      const doctor = makeDoctor({ id: 'doctor-1', user_id: 'doctor-user-1' });
      const savedRx = makePrescription({
        doctor_id: doctor.id,
        patient_user_id: 'patient-user-1',
        id: 'rx-saved-doctor',
      });
      savedRx.medications = [] as any;

      const assertPrescribe = sinon.stub().resolves(doctor);
      const assertEditRecords = sinon
        .stub()
        .rejects(new ForbiddenException('Patient has not granted permission to access medical records'));

      const { service, rxRepo } = buildService({
        profileRepoStub: { findOne: sinon.stub().resolves(profile) },
        doctorRepoStub: { findOne: sinon.stub().resolves(doctor) },
        accessServiceStub: {
          assertDoctorCanPrescribeForPatient: assertPrescribe,
          assertDoctorCanEditRecords: assertEditRecords,
        },
        rxRepoStub: {
          create: sinon.stub().callsFake((data) => ({ ...makePrescription(), ...data })),
          save: sinon.stub().resolves(savedRx),
          update: sinon.stub().resolves(),
        },
      });

      const result = await service.createForPatientUser(
        {
          patient_user_id: 'patient-user-1',
          title: 'Hypertension',
          medications: [{ medication_name: 'Amlodipine' }],
        },
        'doctor-user-1',
        'doctor',
      );

      expect(assertPrescribe.calledOnceWith('doctor-user-1', 'patient-user-1')).to.equal(true);
      expect(assertEditRecords.called).to.equal(false);
      expect(rxRepo.create.getCall(0).args[0].doctor_id).to.equal('doctor-1');
      expect(result.doctor_id).to.equal('doctor-1');
    });
  });
});
