import { Injectable } from '@nestjs/common';
import type { AiIntent } from './context/ai-context.types';

const IDENTITY =
  /\b(who (created|made|built|owns)|who is your (owner|creator)|what company|which company|are you (google|gemini|chatgpt))\b/i;
const PROFILE =
  /\b(my name|what is my name|what's my name|my age|how old am i|about me|my profile|information about me|who am i)\b/i;
const DOCTOR_PROFILE =
  /\b(my specialty|my speciality|my practice|my clinic|my experience|my consultation fee|my rating|my reviews?|about me as a doctor)\b/i;
const DOCTOR_PRACTICE =
  /\b(my patients?|patients? i (treated|saw|dealt|diagnosed|worked)|patients? (i've|i have)|diagnos(e|is|es) i (added|made|created)|i diagnosed|patient records?|which patient)\b/i;
const MEDICAL =
  /\b(diagnos|symptom|lab result|blood test|x-?ray|xray|scan|medical record|my record|my last|my latest|prescription|allerg)\b/i;
const DOCTOR =
  /\b(doctor|dr\.|specialist|neurolog|cardiolog|dermatolog|pediatr|psychiatr|recommend|best rated|highest rating|rating|review|which doctor|see a doctor|message price|pts\/message)\b/i;
const GENERAL =
  /\b(what is|what are|what causes|how to prevent|how to treat|define|explain|tell me about|foods that|benefits of|symptoms of)\b/i;

const URGENT =
  /\b(chest pain|heart attack|can't breathe|cannot breathe|difficulty breathing|severe breathing|stroke|face drooping|sudden numbness|loss of consciousness|passed out|unconscious|severe bleeding|heavy bleeding|suicidal|kill myself|end my life|want to die)\b/i;

@Injectable()
export class AiIntentClassifierService {
  detectUrgent(question: string): boolean {
    return URGENT.test(question);
  }

  urgentResponse(): string {
    return 'This may require urgent medical attention. Please contact emergency services or a healthcare professional immediately.';
  }

  classify(question: string): AiIntent {
    const q = question.trim();
    if (IDENTITY.test(q)) return 'general_medical_question';
    const profile = PROFILE.test(q);
    const doctorProfile = DOCTOR_PROFILE.test(q);
    const doctorPractice = DOCTOR_PRACTICE.test(q);
    const medical = MEDICAL.test(q);
    const doctor = DOCTOR.test(q);
    const general = GENERAL.test(q);

    const hits = [profile, doctorProfile, doctorPractice, medical, doctor, general].filter(
      Boolean,
    ).length;
    if (hits >= 2) return 'mixed_question';
    if (doctorPractice) return 'doctor_practice_question';
    if (doctorProfile) return 'doctor_profile_question';
    if (profile) return 'patient_profile_question';
    if (medical) return 'medical_record_question';
    if (doctor) return 'doctor_recommendation_question';
    if (general) return 'general_medical_question';

    // Default: treat as mixed so patient context + records are considered.
    return 'mixed_question';
  }

  intentsForSource(intent: AiIntent): AiIntent[] {
    if (intent === 'mixed_question') {
      return [
        'patient_profile_question',
        'doctor_profile_question',
        'doctor_practice_question',
        'medical_record_question',
        'doctor_recommendation_question',
        'general_medical_question',
        'mixed_question',
      ];
    }
    return [intent, 'mixed_question'];
  }
}
