import type { MarketingEmailLanguage } from '../admin/dto/send-marketing-email.dto';
import {
  compileMarketingSections,
  type MarketingEmailSection,
} from './marketing-email-sections';
import {
  resolveMarketingEmailTheme,
  type MarketingEmailTheme,
} from './marketing-email-themes';
import { buildMarketingEmailHtml } from './marketing-email.template';
import {
  applyDoctorWelcomePlaceholders,
  applyDoctorWelcomeSections,
  doctorWelcomeSubject,
  getDefaultDoctorWelcomeSections,
  type DoctorWelcomePlaceholders,
} from './doctor-welcome-email-sections';
import { resolveMarketingImageUrls } from './marketing-screenshots.constants';

export function getDoctorWelcomeTemplatePreview(
  language: MarketingEmailLanguage,
  theme: MarketingEmailTheme = 'blue',
) {
  const resolvedTheme = resolveMarketingEmailTheme(theme);
  const sections = getDefaultDoctorWelcomeSections(language);
  const dir = language === 'ar' ? ('rtl' as const) : ('ltr' as const);
  return {
    language,
    themeColor: resolvedTheme,
    dir,
    subjectTemplate: doctorWelcomeSubject(language, '{{name}}'),
    sections,
    bodyHtml: resolveMarketingImageUrls(
      compileMarketingSections(sections, language, resolvedTheme, dir),
    ),
  };
}

export function buildDoctorWelcomeEmailHtml(input: {
  language: MarketingEmailLanguage;
  theme?: MarketingEmailTheme;
  sections?: MarketingEmailSection[];
  placeholders: DoctorWelcomePlaceholders;
  forPreview?: boolean;
}): { subject: string; html: string; text: string } {
  const resolvedTheme = resolveMarketingEmailTheme(input.theme);
  const vars = input.placeholders;
  const rawSections =
    input.sections?.length && input.sections
      ? input.sections
      : getDefaultDoctorWelcomeSections(input.language);
  const sections = applyDoctorWelcomeSections(rawSections, vars);

  const built = buildMarketingEmailHtml(
    input.language,
    vars.name,
    undefined,
    resolvedTheme,
    sections,
    input.forPreview ?? false,
  );

  return {
    subject: doctorWelcomeSubject(input.language, vars.name),
    html: applyDoctorWelcomePlaceholders(built.html, vars),
    text: applyDoctorWelcomePlaceholders(built.text, vars),
  };
}
