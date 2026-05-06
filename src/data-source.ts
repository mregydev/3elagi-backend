import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Clinic } from './entities/clinic.entity';
import { Doctor } from './entities/doctor.entity';
import { ClinicJoinRequest } from './entities/clinic-join-request.entity';
import { Patient } from './entities/patient.entity';
import { Appointment } from './entities/appointment.entity';
import { MedicalDocument } from './entities/medical-document.entity';

console.log('db url is '+process.env.DATABASE_URL);
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Clinic, Doctor, ClinicJoinRequest, Patient, Appointment, MedicalDocument],
  migrations: ['src/migrations/*.ts'],
  ssl: { rejectUnauthorized: false },
  logging: false,
});
