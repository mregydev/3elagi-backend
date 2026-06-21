import { expect } from 'chai';
import * as sinon from 'sinon';
import { ReviewsService } from './reviews.service';
import { NotFoundException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Minimal stubs — no database, no NestJS runtime needed
// ---------------------------------------------------------------------------

function makeReview(overrides: Partial<{
  id: string;
  doctor_id: string;
  patient_user_id: string;
  patient_name: string;
  rating: number;
  comment: string | null;
  created_at: Date;
}> = {}) {
  return {
    id: 'review-1',
    doctor_id: 'doctor-1',
    patient_user_id: 'patient-user-1',
    patient_name: 'Ahmed Ali',
    rating: 4,
    comment: 'Great doctor',
    created_at: new Date('2024-01-15T10:00:00Z'),
    ...overrides,
  };
}

function buildService(overrides: {
  doctorRepoStub?: Partial<{ findOne: sinon.SinonStub }>;
  reviewRepoStub?: Partial<{ findAndCount: sinon.SinonStub }>;
}) {
  const doctorRepo = {
    findOne: sinon.stub(),
    ...overrides.doctorRepoStub,
  } as any;

  const reviewRepo = {
    findAndCount: sinon.stub(),
    ...overrides.reviewRepoStub,
  } as any;

  // patientProfile, diagnosis repos are not exercised by listForDoctorUser
  const profileRepo = {} as any;
  const diagnosisRepo = {} as any;

  const service = new ReviewsService(reviewRepo, doctorRepo, profileRepo, diagnosisRepo);
  return { service, doctorRepo, reviewRepo };
}

// ---------------------------------------------------------------------------

describe('ReviewsService', () => {
  describe('listForDoctorUser', () => {
    it('returns paginated reviews for the logged-in doctor', async () => {
      const review1 = makeReview({ id: 'r1' });
      const review2 = makeReview({ id: 'r2', patient_name: 'Sara Mohamed', rating: 5 });

      const { service, doctorRepo, reviewRepo } = buildService({});
      doctorRepo.findOne.resolves({ id: 'doctor-1', user_id: 'user-doc-1' });
      reviewRepo.findAndCount.resolves([[review1, review2], 2]);

      const result = await service.listForDoctorUser('user-doc-1', 1, 10);

      expect(result.data).to.have.length(2);
      expect(result.data[0].id).to.equal('r1');
      expect(result.data[1].patientName).to.equal('Sara Mohamed');
      expect(result.pagination.page).to.equal(1);
      expect(result.pagination.limit).to.equal(10);
      expect(result.pagination.total).to.equal(2);
      expect(result.pagination.totalPages).to.equal(1);
    });

    it('returns empty data array with correct pagination when no reviews exist', async () => {
      const { service, doctorRepo, reviewRepo } = buildService({});
      doctorRepo.findOne.resolves({ id: 'doctor-1', user_id: 'user-doc-1' });
      reviewRepo.findAndCount.resolves([[], 0]);

      const result = await service.listForDoctorUser('user-doc-1', 1, 10);

      expect(result.data).to.deep.equal([]);
      expect(result.pagination.total).to.equal(0);
      expect(result.pagination.totalPages).to.equal(0);
      expect(result.pagination.page).to.equal(1);
    });

    it('filters only the logged-in doctor reviews, not other doctors', async () => {
      const myDoctorId = 'doctor-mine';
      const myReview = makeReview({ id: 'r-mine', doctor_id: myDoctorId });

      const { service, doctorRepo, reviewRepo } = buildService({});
      doctorRepo.findOne.resolves({ id: myDoctorId, user_id: 'user-me' });
      reviewRepo.findAndCount.resolves([[myReview], 1]);

      await service.listForDoctorUser('user-me', 1, 10);

      // Verify the query was made with THIS doctor's id, not a different one
      const callArgs = reviewRepo.findAndCount.getCall(0).args[0];
      expect(callArgs.where.doctor_id).to.equal(myDoctorId);
    });

    it('throws NotFoundException when doctor profile does not exist', async () => {
      const { service, doctorRepo } = buildService({});
      doctorRepo.findOne.resolves(null);

      let err: unknown;
      try {
        await service.listForDoctorUser('unknown-user', 1, 10);
      } catch (e) {
        err = e;
      }

      expect(err).to.be.instanceOf(NotFoundException);
    });

    it('respects page and limit for correct skip/take in the query', async () => {
      const { service, doctorRepo, reviewRepo } = buildService({});
      doctorRepo.findOne.resolves({ id: 'doctor-1', user_id: 'user-doc-1' });
      reviewRepo.findAndCount.resolves([[], 25]);

      const result = await service.listForDoctorUser('user-doc-1', 3, 5);

      const callArgs = reviewRepo.findAndCount.getCall(0).args[0];
      // page=3, limit=5 → skip=10
      expect(callArgs.skip).to.equal(10);
      expect(callArgs.take).to.equal(5);
      expect(result.pagination.page).to.equal(3);
      expect(result.pagination.limit).to.equal(5);
      expect(result.pagination.totalPages).to.equal(5); // ceil(25/5)
    });
  });
});
