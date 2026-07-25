const fs = require('fs');
const path = require('path');

const adminDir = path.join('c:\\Users\\HP\\Downloads\\QuubOpenComm\\QuubOpenCommV2', 'apps', 'web', 'src', 'components', 'admin');

const pages = [
  'AdminUsers', 'AdminWorkers', 'AdminJobs', 'AdminCompanies', 
  'AdminVerifications', 'AdminReports', 'AdminMessages', 'AdminSupport', 
  'AdminContent', 'AdminAnnouncements', 'AdminSettings', 'AdminStaff', 'AdminAuditLogs'
];

const template = (name) => `import React from 'react';

export default function ${name}() {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 p-8 text-center">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white">${name.replace('Admin', '')} Management</h2>
      <p className="text-slate-500 mt-2">This module is currently under construction.</p>
    </div>
  );
}
`;

pages.forEach(page => {
  fs.writeFileSync(path.join(adminDir, `${page}.tsx`), template(page), 'utf8');
});

console.log('Successfully created admin placeholder pages.');
