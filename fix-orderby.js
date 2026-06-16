import fs from 'fs';

let content = fs.readFileSync('src/modules/reports/routes.js', 'utf8');

// Fix service-sales orderBy
content = content.replace(
  'orderBy: { createdAt: "desc" }',
  'orderBy: { invoice: { createdAt: "desc" } }' // Assuming invoice relation has createdAt
);

fs.writeFileSync('src/modules/reports/routes.js', content);
console.log("Fixed service-sales orderBy!");
