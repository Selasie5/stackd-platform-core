import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) {
      const content = readFileSync(p, 'utf8');
      const re = /from\s+['"]\.\.\/graphql['"]/;
      if (re.test(content)) {
        const matches = content.match(/from\s+['"][^'"]+['"]/g);
        console.log(p, ':', matches);
      }
    }
  }
}
walk('dist');
console.log('done');
