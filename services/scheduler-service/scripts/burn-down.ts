#!/usr/bin/env node
/**
 * Burn-Down Dashboard Generator
 * Walks docs/Bugs/ counting Fixed vs open by severity per domain.
 * Outputs a markdown summary.
 */

const fs = require('fs');
const path = require('path');

interface BugStats {
  domain: string;
  total: number;
  fixed: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  burndownPercent: number;
}

interface DomainsMap {
  [domain: string]: {
    total: number;
    fixed: number;
    open: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

const REPO_ROOT = path.resolve(__dirname, '..');
const BUGS_DIR = path.join(REPO_ROOT, 'docs', 'Bugs');

function extractMetadata(content: string): { status: string; severity: string; domain: string } {
  const statusMatch = content.match(/status:\s*(Fixed|Open)/i);
  const severityMatch = content.match(/severity:\s*(Critical|High|Medium|Low)/i);
  const domainMatch = content.match(/domain:\s*([a-zA-Z0-9\-]+)/i);

  return {
    status: statusMatch ? statusMatch[1].toLowerCase() : 'open',
    severity: severityMatch ? severityMatch[1].toLowerCase() : 'medium',
    domain: domainMatch ? domainMatch[1] : 'uncategorized',
  };
}

function analyzeBugs(): BugStats[] {
  const domains: DomainsMap = {};

  if (!fs.existsSync(BUGS_DIR)) {
    console.warn(`Warning: ${BUGS_DIR} not found. Using defaults.`);
    return [];
  }

  const files = fs.readdirSync(BUGS_DIR).filter((f: string) => f.endsWith('.md'));

  for (const file of files) {
    const filePath = path.join(BUGS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { status, severity, domain } = extractMetadata(content);

    if (!domains[domain]) {
      domains[domain] = {
        total: 0,
        fixed: 0,
        open: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      };
    }

    domains[domain].total++;
    if (status === 'fixed') {
      domains[domain].fixed++;
    } else {
      domains[domain].open++;
    }

    // Count severity
    if (severity === 'critical') domains[domain].critical++;
    else if (severity === 'high') domains[domain].high++;
    else if (severity === 'medium') domains[domain].medium++;
    else if (severity === 'low') domains[domain].low++;
  }

  const stats: BugStats[] = Object.entries(domains).map(([domain, counts]) => ({
    domain,
    total: counts.total,
    fixed: counts.fixed,
    open: counts.open,
    critical: counts.critical,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    burndownPercent: counts.total > 0 ? Math.round((counts.fixed / counts.total) * 100) : 0,
  }));

  return stats.sort((a, b) => b.total - a.total);
}

function generateMarkdown(stats: BugStats[]): string {
  const timestamp = new Date().toISOString();
  const totalBugs = stats.reduce((sum, s) => sum + s.total, 0);
  const totalFixed = stats.reduce((sum, s) => sum + s.fixed, 0);
  const globalBurndown = totalBugs > 0 ? Math.round((totalFixed / totalBugs) * 100) : 0;

  let md = `# Burn-Down Dashboard

**Generated**: ${timestamp}

## Global Status

- **Total Bugs**: ${totalBugs}
- **Fixed**: ${totalFixed}
- **Open**: ${totalBugs - totalFixed}
- **Global Burndown**: ${globalBurndown}%

---

## By Domain

| Domain | Total | Fixed | Open | Critical | High | Medium | Low | Burndown % |
|--------|-------|-------|------|----------|------|--------|-----|-----------|
`;

  for (const stat of stats) {
    md += `| ${stat.domain} | ${stat.total} | ${stat.fixed} | ${stat.open} | ${stat.critical} | ${stat.high} | ${stat.medium} | ${stat.low} | ${stat.burndownPercent}% |\n`;
  }

  md += '\n---\n\n## Severity Breakdown\n\n';

  const totalCritical = stats.reduce((sum, s) => sum + s.critical, 0);
  const totalHigh = stats.reduce((sum, s) => sum + s.high, 0);
  const totalMedium = stats.reduce((sum, s) => sum + s.medium, 0);
  const totalLow = stats.reduce((sum, s) => sum + s.low, 0);

  md += `- **Critical**: ${totalCritical}\n`;
  md += `- **High**: ${totalHigh}\n`;
  md += `- **Medium**: ${totalMedium}\n`;
  md += `- **Low**: ${totalLow}\n`;

  md += '\n---\n\n## Recommendations\n\n';

  // Find domains with most open bugs
  const highOpenDomains = stats.filter(s => s.open > 0).slice(0, 3);
  if (highOpenDomains.length > 0) {
    md += '### High Priority Domains (most open bugs)\n\n';
    for (const stat of highOpenDomains) {
      md += `- **${stat.domain}**: ${stat.open} open bugs (${stat.critical} critical)\n`;
    }
    md += '\n';
  }

  // Find domains with lowest burndown
  const lowBurndownDomains = stats.filter(s => s.burndownPercent < 50).slice(0, 3);
  if (lowBurndownDomains.length > 0) {
    md += '### Domains Needing Focus (low burndown)\n\n';
    for (const stat of lowBurndownDomains) {
      md += `- **${stat.domain}**: ${stat.burndownPercent}% burndown\n`;
    }
    md += '\n';
  }

  md += '### Next Steps\n\n';
  md += '1. Architect-on-call reviews new bugs within 3 days (see GOVERNANCE.md)\n';
  md += '2. Focus on critical and high-severity items in high-priority domains\n';
  md += '3. Update bug status in docs/Bugs/*.md as fixes are merged\n';

  return md;
}

// Main
const stats = analyzeBugs();
const markdown = generateMarkdown(stats);
console.log(markdown);

// Optionally write to a file
const outputPath = path.join(REPO_ROOT, 'docs', 'BURN_DOWN_DASHBOARD.md');
fs.writeFileSync(outputPath, markdown, 'utf-8');
console.error(`\nBurn-down dashboard written to ${outputPath}`);
