import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { CoverLetterContent, ResumeContent } from "@/lib/resume-content";

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", lineHeight: 1.45, color: "#171717" },
  name: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 12, color: "#0f766e", marginBottom: 8 },
  meta: { fontSize: 9, color: "#525252", marginBottom: 16 },
  section: { marginTop: 14 },
  heading: { fontSize: 10, fontWeight: 700, color: "#0f766e", letterSpacing: 1.5, marginBottom: 6 },
  row: { marginBottom: 8 },
  strong: { fontSize: 11, fontWeight: 700 },
  muted: { color: "#525252" },
  bullet: { marginLeft: 10, marginBottom: 3 },
  paragraph: { marginBottom: 8 },
  skillBarTrack: { height: 3, backgroundColor: "#e5e5e5", marginTop: 3, width: 110 },
});

export function ResumePdfDocument({ content }: { content: ResumeContent }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View>
          <Text style={styles.name}>{content.header.fullName || "Resume"}</Text>
          <Text style={styles.title}>{content.header.title}</Text>
          <Text style={styles.meta}>
            {[content.header.email, content.header.phone, content.header.location, content.header.linkedin].filter(Boolean).join(" | ")}
          </Text>
          {content.mode === "local" ? (
            <Text style={styles.meta}>
              {[content.header.street, content.header.district, content.header.postalCode].filter(Boolean).join(" | ")}
              {content.header.expectedSalary ? ` | Expected ${content.header.expectedSalary} ${content.header.salaryPeriod}` : ""}
            </Text>
          ) : null}
        </View>
        {content.summary ? (
          <View style={styles.section}>
            <Text style={styles.heading}>SUMMARY</Text>
            <Text>{content.summary}</Text>
          </View>
        ) : null}
        <View style={styles.section}>
          <Text style={styles.heading}>EXPERIENCE</Text>
          {content.experience.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.strong}>{[item.title, item.company].filter(Boolean).join(" - ")}</Text>
              <Text style={styles.muted}>{[item.location, item.startDate, item.endDate].filter(Boolean).join(" | ")}</Text>
              {item.bullets.filter(Boolean).map((bullet) => (
                <Text key={bullet} style={styles.bullet}>- {bullet}</Text>
              ))}
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>EDUCATION</Text>
          {content.education.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.strong}>{[item.degree, item.field].filter(Boolean).join(" - ")}</Text>
              <Text style={styles.muted}>{[item.institution, item.startDate, item.endDate].filter(Boolean).join(" | ")}</Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>SKILLS</Text>
          {content.settings?.showSkillRatings && content.skillRatings.length ? (
            content.skillRatings.map((skill) => (
              <View key={skill.id} style={styles.row}>
                <Text>{skill.name} ({skill.rating}/5)</Text>
              </View>
            ))
          ) : (
            <Text>{content.skills.join(", ")}</Text>
          )}
        </View>
        {content.projects.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>PROJECTS</Text>
            {content.projects.map((item) => (
              <View key={item.id} style={styles.row}>
                <Text style={styles.strong}>{item.name}</Text>
                <Text>{item.description}</Text>
                <Text style={styles.muted}>{item.technologies.join(", ")}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {content.certifications.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>CERTIFICATIONS</Text>
            {content.certifications.map((item) => (
              <Text key={item.id}>{[item.name, item.issuer, item.date].filter(Boolean).join(" - ")}</Text>
            ))}
          </View>
        ) : null}
        {content.languages.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>LANGUAGES</Text>
            <Text>{content.languages.map((item) => [item.name, item.proficiency].filter(Boolean).join(" - ")).join(", ")}</Text>
          </View>
        ) : null}
        {content.awards.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>AWARDS</Text>
            {content.awards.map((item) => (
              <Text key={item.id}>{[item.name, item.issuer, item.date].filter(Boolean).join(" - ")}</Text>
            ))}
          </View>
        ) : null}
        {content.publications.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>PUBLICATIONS</Text>
            {content.publications.map((item) => (
              <Text key={item.id}>{[item.title, item.publisher, item.date, item.url].filter(Boolean).join(" - ")}</Text>
            ))}
          </View>
        ) : null}
        {!content.settings?.hideReferences && content.references.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>REFERENCES</Text>
            {content.references.map((item) => (
              <Text key={item.id}>{[item.name, item.title, item.organization, item.phone, item.email].filter(Boolean).join(" - ")}</Text>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export function CoverLetterPdfDocument({ content }: { content: CoverLetterContent }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {[content.subject ? `Subject: ${content.subject}` : "", content.headerContact, content.recipientDetails, content.opener].filter(Boolean).map((part) => (
          <Text key={part} style={styles.paragraph}>{part}</Text>
        ))}
        {content.bodyParagraphs.map((paragraph) => (
          <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
        ))}
        {content.achievements.length ? (
          <View style={styles.section}>
            <Text style={styles.heading}>KEY ACHIEVEMENTS</Text>
            {content.achievements.map((achievement) => (
              <Text key={achievement} style={styles.bullet}>- {achievement}</Text>
            ))}
          </View>
        ) : null}
        {[content.salaryExpectation, content.closing, content.signature].filter(Boolean).map((part) => (
          <Text key={part} style={styles.paragraph}>{part}</Text>
        ))}
      </Page>
    </Document>
  );
}
