import type { Dictionary } from "./i18n/dictionaries";
import type { FIELD_ALIASES } from "./leads";

export type LeadField = keyof typeof FIELD_ALIASES;

/** Import-mapping order (identity first) with their translated labels. */
export const IMPORT_FIELDS: LeadField[] = [
  "company_name", "contact_name", "email", "phone", "job_title", "city", "industry", "company_size", "website",
  "services", "budget_range", "timeline", "requirements", "status", "priority", "source", "lead_score", "deal_value",
  "utm_source", "utm_medium", "utm_campaign", "preferred_language", "tags",
];

export function fieldLabel(t: Dictionary, f: LeadField): string {
  const c = t.clients;
  const map: Record<LeadField, string> = {
    company_name: c.company, contact_name: c.contact, job_title: c.jobTitle, email: c.email, phone: c.phone,
    city: c.city, industry: c.industry, company_size: c.companySize, website: c.website, services: c.services,
    budget_range: c.budget, timeline: c.timeline, requirements: c.requirements, lead_score: c.score,
    deal_value: c.dealValue, status: c.status, priority: c.priority, source: c.source, utm_source: c.utmSource,
    utm_medium: c.utmMedium, utm_campaign: c.utmCampaign, preferred_language: c.language, tags: c.tags,
  };
  return map[f];
}
