
-- AlterTable
ALTER TABLE "ats_check_results" ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CareerGPSPlan" ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "talent_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "profileImage" TEXT,
    "city" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "targetLocation" TEXT NOT NULL DEFAULT '',
    "isOpenToWork" BOOLEAN NOT NULL DEFAULT true,
    "preferredJobTypes" JSONB NOT NULL DEFAULT '[]',
    "industry" TEXT NOT NULL DEFAULT '',
    "careerLevel" TEXT NOT NULL DEFAULT 'mid',
    "customSlug" TEXT,
    "isPhonePublic" BOOLEAN NOT NULL DEFAULT false,
    "isEmailPublic" BOOLEAN NOT NULL DEFAULT false,
    "expectedSalary" TEXT NOT NULL DEFAULT '',
    "isExpectedSalaryPublic" BOOLEAN NOT NULL DEFAULT false,
    "noticePeriod" TEXT NOT NULL DEFAULT '',
    "nationality" TEXT NOT NULL DEFAULT '',
    "languages" JSONB NOT NULL DEFAULT '[]',
    "visaStatus" TEXT NOT NULL DEFAULT '',
    "availabilityDate" TIMESTAMP(3),
    "cvPath" TEXT,
    "cvFilename" TEXT,
    "isCvPublic" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "completionScore" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationBadge" TEXT NOT NULL DEFAULT '',
    "views" INTEGER NOT NULL DEFAULT 0,
    "searchAppearances" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_experiences" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "employmentType" TEXT NOT NULL DEFAULT 'full_time',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "skillsUsed" JSONB NOT NULL DEFAULT '[]',
    "companyLogo" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "talent_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_educations" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "institutionName" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isOngoing" BOOLEAN NOT NULL DEFAULT false,
    "gpa" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "talent_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_skills" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Technical',
    "proficiency" TEXT NOT NULL DEFAULT 'Intermediate',
    "yearsExperience" INTEGER,
    "isTop" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "talent_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_projects" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "projectType" TEXT NOT NULL DEFAULT 'Personal',
    "description" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT '',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "outcome" TEXT NOT NULL DEFAULT '',
    "projectUrl" TEXT NOT NULL DEFAULT '',
    "githubUrl" TEXT NOT NULL DEFAULT '',
    "demoVideoUrl" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "talent_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_services" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "pricing" TEXT NOT NULL DEFAULT '',
    "deliveryTime" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,

    CONSTRAINT "talent_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_portfolios" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT,
    "fileUrl" TEXT,
    "externalUrl" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "talent_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_certifications" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuingOrg" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "credentialId" TEXT NOT NULL DEFAULT '',
    "credentialUrl" TEXT NOT NULL DEFAULT '',
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "talent_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_awards" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "dateReceived" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "talent_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT NOT NULL DEFAULT '',
    "logo" TEXT,
    "industry" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT 'Sri Lanka',
    "district" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "careersUrl" TEXT NOT NULL DEFAULT '',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationDomain" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "companyId" UUID,
    "title" TEXT NOT NULL DEFAULT '',
    "workEmail" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL,
    "companyLogo" TEXT,
    "websiteUrl" TEXT NOT NULL DEFAULT '',
    "industry" TEXT NOT NULL DEFAULT '',
    "companySize" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "accessLevel" TEXT NOT NULL DEFAULT 'verified',
    "contactCredits" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_searches" (
    "id" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filtersJson" JSONB NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "alertFrequency" TEXT NOT NULL DEFAULT 'never',
    "lastAlertSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recruiter_projects" (
    "id" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recruiter_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_candidates" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'new',
    "notes" TEXT NOT NULL DEFAULT '',
    "rating" INTEGER NOT NULL DEFAULT 0,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_blocks" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_templates" (
    "id" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_contact_requests" (
    "id" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "jobLocation" TEXT NOT NULL DEFAULT '',
    "salaryRange" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talent_contact_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_shortlists" (
    "id" UUID NOT NULL,
    "recruiterId" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "folder" TEXT NOT NULL DEFAULT 'General',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_shortlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_recommendations" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorTitle" TEXT NOT NULL DEFAULT '',
    "relationship" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "talent_profile_views" (
    "id" UUID NOT NULL,
    "talentProfileId" UUID NOT NULL,
    "viewerId" UUID,
    "viewerName" TEXT NOT NULL DEFAULT 'Anonymous Recruiter',
    "viewerCompany" TEXT NOT NULL DEFAULT '',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "talent_profile_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_views" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "ownerId" UUID,
    "visitorHash" TEXT NOT NULL,
    "referrer" TEXT NOT NULL DEFAULT 'direct',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "talent_profiles_userId_key" ON "talent_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_profiles_customSlug_key" ON "talent_profiles"("customSlug");

-- CreateIndex
CREATE UNIQUE INDEX "talent_skills_talentProfileId_name_key" ON "talent_skills"("talentProfileId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "recruiter_profiles_userId_key" ON "recruiter_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_candidates_projectId_talentProfileId_key" ON "project_candidates"("projectId", "talentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_blocks_talentProfileId_companyId_key" ON "candidate_blocks"("talentProfileId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "talent_shortlists_recruiterId_talentProfileId_key" ON "talent_shortlists"("recruiterId", "talentProfileId");

-- CreateIndex
CREATE INDEX "share_views_type_itemId_idx" ON "share_views"("type", "itemId");

-- CreateIndex
CREATE INDEX "share_views_ownerId_idx" ON "share_views"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ats_check_results_shareToken_key" ON "ats_check_results"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "CareerGPSPlan_shareToken_key" ON "CareerGPSPlan"("shareToken");

-- AddForeignKey
ALTER TABLE "talent_profiles" ADD CONSTRAINT "talent_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "django_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_experiences" ADD CONSTRAINT "talent_experiences_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_educations" ADD CONSTRAINT "talent_educations_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_skills" ADD CONSTRAINT "talent_skills_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_projects" ADD CONSTRAINT "talent_projects_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_services" ADD CONSTRAINT "talent_services_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_portfolios" ADD CONSTRAINT "talent_portfolios_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_certifications" ADD CONSTRAINT "talent_certifications_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_awards" ADD CONSTRAINT "talent_awards_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "django_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_profiles" ADD CONSTRAINT "recruiter_profiles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recruiter_projects" ADD CONSTRAINT "recruiter_projects_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_candidates" ADD CONSTRAINT "project_candidates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "recruiter_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_candidates" ADD CONSTRAINT "project_candidates_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_blocks" ADD CONSTRAINT "candidate_blocks_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_blocks" ADD CONSTRAINT "candidate_blocks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "recruiter_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contact_requests" ADD CONSTRAINT "talent_contact_requests_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "django_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_contact_requests" ADD CONSTRAINT "talent_contact_requests_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_shortlists" ADD CONSTRAINT "talent_shortlists_recruiterId_fkey" FOREIGN KEY ("recruiterId") REFERENCES "django_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_shortlists" ADD CONSTRAINT "talent_shortlists_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_recommendations" ADD CONSTRAINT "talent_recommendations_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "talent_profile_views" ADD CONSTRAINT "talent_profile_views_talentProfileId_fkey" FOREIGN KEY ("talentProfileId") REFERENCES "talent_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

